use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use rusqlite::{Connection, ErrorCode, OptionalExtension, Transaction};
use tauri::{AppHandle, Manager, Runtime};
use thiserror::Error;

pub const DATABASE_FILE_NAME: &str = "db.sqlite";
const CURRENT_SCHEMA_VERSION: i64 = 1;
const BUSY_TIMEOUT_MILLISECONDS: u64 = 5_000;

struct Migration {
    version: i64,
    description: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    description: "create normalized tournament schema",
    sql: include_str!("../migrations/0001_initial.sql"),
}];

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("could not resolve the application data directory: {0}")]
    AppDataPath(#[source] tauri::Error),
    #[error("could not create the application data directory at {path}: {source}")]
    CreateDirectory {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("the database is busy or locked; close other running instances and try again")]
    Busy,
    #[error("the database is corrupt or is not a valid SQLite database")]
    Corrupt,
    #[error("the database could not be opened at {path}: {message}")]
    Open { path: PathBuf, message: String },
    #[error("database schema version {found} is newer than supported version {supported}")]
    UnsupportedVersion { found: i64, supported: i64 },
    #[error("database migration {version} ({description}) failed: {message}")]
    Migration {
        version: i64,
        description: &'static str,
        message: String,
    },
    #[error("database configuration failed: {0}")]
    Configuration(String),
}

#[derive(Debug)]
pub struct Database {
    path: PathBuf,
    pub(crate) connection: Mutex<Connection>,
}

impl Database {
    pub fn open_in_app_data<R: Runtime>(app: &AppHandle<R>) -> Result<Self, DatabaseError> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(DatabaseError::AppDataPath)?;
        Self::open(app_data_dir.join(DATABASE_FILE_NAME))
    }

    pub fn open(path: PathBuf) -> Result<Self, DatabaseError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|source| DatabaseError::CreateDirectory {
                path: parent.to_path_buf(),
                source,
            })?;
        }

        let mut connection =
            Connection::open(&path).map_err(|error| map_open_error(&path, error))?;
        configure_connection(&connection)?;
        migrate(&mut connection, MIGRATIONS, CURRENT_SCHEMA_VERSION)?;

        Ok(Self {
            path,
            connection: Mutex::new(connection),
        })
    }

    #[allow(dead_code)]
    pub fn path(&self) -> &Path {
        &self.path
    }
}

fn configure_connection(connection: &Connection) -> Result<(), DatabaseError> {
    connection
        .busy_timeout(std::time::Duration::from_millis(BUSY_TIMEOUT_MILLISECONDS))
        .map_err(map_configuration_error)?;
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;\n\
             PRAGMA journal_mode = WAL;\n\
             PRAGMA synchronous = FULL;",
        )
        .map_err(map_configuration_error)?;
    Ok(())
}

fn migrate(
    connection: &mut Connection,
    migrations: &[Migration],
    supported_version: i64,
) -> Result<(), DatabaseError> {
    let pragma_version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(map_configuration_error)?;
    let table_version = read_schema_version(connection)?;
    let found_version = table_version.unwrap_or(pragma_version).max(pragma_version);

    if found_version > supported_version {
        return Err(DatabaseError::UnsupportedVersion {
            found: found_version,
            supported: supported_version,
        });
    }

    for migration in migrations
        .iter()
        .filter(|migration| migration.version > found_version)
    {
        apply_migration(connection, migration)?;
    }

    Ok(())
}

fn read_schema_version(connection: &Connection) -> Result<Option<i64>, DatabaseError> {
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_version')",
            [],
            |row| row.get(0),
        )
        .map_err(map_configuration_error)?;

    if !exists {
        return Ok(None);
    }

    connection
        .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
            row.get(0)
        })
        .optional()
        .map(|version| version.flatten())
        .map_err(map_configuration_error)
}

fn apply_migration(
    connection: &mut Connection,
    migration: &Migration,
) -> Result<(), DatabaseError> {
    let transaction = connection
        .transaction()
        .map_err(|error| map_migration_error(migration, error))?;

    apply_migration_in_transaction(&transaction, migration)
        .map_err(|error| map_migration_error(migration, error))?;

    transaction
        .commit()
        .map_err(|error| map_migration_error(migration, error))
}

fn apply_migration_in_transaction(
    transaction: &Transaction<'_>,
    migration: &Migration,
) -> rusqlite::Result<()> {
    transaction.execute_batch(migration.sql)?;
    transaction.execute(
        "INSERT INTO schema_version (version, description, applied_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
        (migration.version, migration.description),
    )?;
    transaction.pragma_update(None, "user_version", migration.version)?;
    Ok(())
}

fn map_open_error(path: &Path, error: rusqlite::Error) -> DatabaseError {
    match error.sqlite_error_code() {
        Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked) => DatabaseError::Busy,
        Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => DatabaseError::Corrupt,
        _ => DatabaseError::Open {
            path: path.to_path_buf(),
            message: error.to_string(),
        },
    }
}

fn map_configuration_error(error: rusqlite::Error) -> DatabaseError {
    match error.sqlite_error_code() {
        Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked) => DatabaseError::Busy,
        Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => DatabaseError::Corrupt,
        _ => DatabaseError::Configuration(error.to_string()),
    }
}

fn map_migration_error(migration: &Migration, error: rusqlite::Error) -> DatabaseError {
    match error.sqlite_error_code() {
        Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked) => DatabaseError::Busy,
        Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => DatabaseError::Corrupt,
        _ => DatabaseError::Migration {
            version: migration.version,
            description: migration.description,
            message: error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use tempfile::TempDir;

    fn temporary_database() -> (TempDir, PathBuf) {
        let directory = tempfile::tempdir().expect("temporary directory should be created");
        let path = directory.path().join(DATABASE_FILE_NAME);
        (directory, path)
    }

    #[test]
    fn creates_the_current_schema_on_first_run() {
        let (_directory, path) = temporary_database();

        let database = Database::open(path.clone()).expect("database should open");
        let connection = database.connection.lock().expect("database lock");
        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .expect("schema version should exist");
        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign key setting should be readable");

        assert_eq!(version, CURRENT_SCHEMA_VERSION);
        assert_eq!(foreign_keys, 1);
    }

    #[test]
    fn enforces_relationships_checks_and_cascades() {
        let (_directory, path) = temporary_database();
        let database = Database::open(path).expect("database should open");
        let connection = database.connection.lock().expect("database lock");

        let missing_league = connection.execute(
            "INSERT INTO seasons (id, league_id, name, leg_count, sort_order, created_at, updated_at) VALUES ('s1', 'missing', 'Season', 1, 0, 'now', 'now')",
            [],
        );
        assert!(missing_league.is_err());

        connection
            .execute(
                "INSERT INTO leagues VALUES ('l1', 'League', 0, 'now', 'now')",
                [],
            )
            .expect("league should insert");
        connection
            .execute(
                "INSERT INTO seasons VALUES ('s1', 'l1', 'Season', 1, 0, 'now', 'now')",
                [],
            )
            .expect("season should insert");
        connection
            .execute("INSERT INTO teams VALUES ('t1', 's1', 'Team', 0)", [])
            .expect("team should insert");
        assert!(connection
            .execute("UPDATE seasons SET leg_count = 5 WHERE id = 's1'", [])
            .is_err());

        connection
            .execute("DELETE FROM leagues WHERE id = 'l1'", [])
            .expect("league should delete");
        let teams: i64 = connection
            .query_row("SELECT COUNT(*) FROM teams", [], |row| row.get(0))
            .expect("team count should load");
        assert_eq!(teams, 0);
    }

    #[test]
    fn rerunning_migrations_is_idempotent_and_reopening_preserves_data() {
        let (_directory, path) = temporary_database();
        {
            let database = Database::open(path.clone()).expect("database should open");
            let connection = database.connection.lock().expect("database lock");
            connection
                .execute(
                    "INSERT INTO leagues VALUES ('l1', 'League', 0, 'created', 'updated')",
                    [],
                )
                .expect("league should insert");
        }

        let reopened = Database::open(path).expect("database should reopen");
        let connection = reopened.connection.lock().expect("database lock");
        let migration_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM schema_version", [], |row| row.get(0))
            .expect("migration count should load");
        let league_name: String = connection
            .query_row("SELECT name FROM leagues WHERE id = 'l1'", [], |row| {
                row.get(0)
            })
            .expect("league should remain");

        assert_eq!(migration_count, 1);
        assert_eq!(league_name, "League");
    }

    #[test]
    fn rolls_back_a_failed_migration() {
        let connection = &mut Connection::open_in_memory().expect("memory database should open");
        configure_connection(connection).expect("connection should configure");
        let migrations = [
            Migration {
                version: 1,
                description: "base",
                sql: "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL); CREATE TABLE stable (id INTEGER PRIMARY KEY);",
            },
            Migration {
                version: 2,
                description: "broken",
                sql: "CREATE TABLE transient (id INTEGER PRIMARY KEY); INSERT INTO missing_table VALUES (1);",
            },
        ];

        let error = migrate(connection, &migrations, 2).expect_err("migration should fail");
        assert!(matches!(error, DatabaseError::Migration { version: 2, .. }));
        let transient_exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = 'transient')",
                [],
                |row| row.get(0),
            )
            .expect("schema should be readable");
        assert!(!transient_exists);
    }

    #[test]
    fn rejects_a_future_schema_without_modifying_it() {
        let connection = &mut Connection::open_in_memory().expect("memory database should open");
        connection
            .execute_batch("PRAGMA user_version = 99; CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES ('unchanged');")
            .expect("future database should be created");

        let error = migrate(connection, MIGRATIONS, CURRENT_SCHEMA_VERSION)
            .expect_err("future version should be rejected");
        assert!(matches!(
            error,
            DatabaseError::UnsupportedVersion { found: 99, .. }
        ));
        let sentinel: String = connection
            .query_row("SELECT value FROM sentinel", [], |row| row.get(0))
            .expect("sentinel should remain");
        assert_eq!(sentinel, "unchanged");
    }

    #[test]
    fn reports_corrupt_and_unopenable_databases() {
        let directory = tempfile::tempdir().expect("temporary directory should be created");
        let corrupt_path = directory.path().join("corrupt.sqlite");
        fs::write(&corrupt_path, b"not a sqlite database").expect("fixture should write");
        let corrupt = Database::open(corrupt_path).expect_err("corrupt database should fail");
        assert!(matches!(corrupt, DatabaseError::Corrupt));

        let directory_path = directory.path().join("database-directory");
        fs::create_dir(&directory_path).expect("database directory fixture should exist");
        let unopenable =
            Database::open(directory_path).expect_err("directory cannot be a database");
        assert!(matches!(unopenable, DatabaseError::Open { .. }));
    }

    #[test]
    fn reports_a_locked_database_after_the_busy_timeout() {
        let (_directory, path) = temporary_database();
        let database = Database::open(path.clone()).expect("database should open");
        let blocker = Connection::open(path).expect("second connection should open");
        blocker
            .execute_batch(
                "BEGIN EXCLUSIVE; INSERT INTO leagues VALUES ('held', 'Held', 0, 'now', 'now');",
            )
            .expect("exclusive transaction should start");

        let connection = database.connection.lock().expect("database lock");
        let error = connection
            .execute(
                "INSERT INTO leagues VALUES ('blocked', 'Blocked', 1, 'now', 'now')",
                params![],
            )
            .expect_err("write should be locked");
        assert!(matches!(
            error.sqlite_error_code(),
            Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked)
        ));
    }
}
