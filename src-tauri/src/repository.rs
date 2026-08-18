use rusqlite::{params, Connection, ErrorCode, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::database::Database;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub leagues: Vec<League>,
    pub seasons: Vec<Season>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct League {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Season {
    pub id: String,
    pub league_id: String,
    pub name: String,
    pub teams: Vec<Team>,
    pub matches: Vec<Match>,
    pub leg_count: i64,
    pub random_tiebreaker_locks: Vec<RandomTiebreakerLock>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub id: String,
    pub leg: i64,
    pub round: i64,
    pub home_team_id: String,
    pub away_team_id: String,
    pub home_score: Option<i64>,
    pub away_score: Option<i64>,
    pub home_yellow_cards: i64,
    pub away_yellow_cards: i64,
    pub home_red_cards: i64,
    pub away_red_cards: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RandomTiebreakerLock {
    pub mode: TableMode,
    pub team_ids: Vec<String>,
    pub ordered_team_ids: Vec<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TableMode {
    Overall,
    Home,
    Away,
}

impl TableMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Overall => "overall",
            Self::Home => "home",
            Self::Away => "away",
        }
    }

    fn from_database(value: String) -> rusqlite::Result<Self> {
        match value.as_str() {
            "overall" => Ok(Self::Overall),
            "home" => Ok(Self::Home),
            "away" => Ok(Self::Away),
            _ => Err(rusqlite::Error::InvalidQuery),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundResultUpdate {
    pub match_id: String,
    pub home_score: Option<i64>,
    pub away_score: Option<i64>,
    pub home_yellow_cards: i64,
    pub away_yellow_cards: i64,
    pub home_red_cards: i64,
    pub away_red_cards: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RepositoryErrorCode {
    Constraint,
    Busy,
    DiskFull,
    PermissionDenied,
    Corrupt,
    Io,
    NotFound,
    Unexpected,
}

#[derive(Debug, Error, Serialize)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct RepositoryError {
    pub code: RepositoryErrorCode,
    pub message: String,
}

impl Database {
    pub fn load_state(&self) -> Result<AppState, RepositoryError> {
        let connection = self.connection.lock().map_err(|_| lock_error())?;
        load_state(&connection).map_err(map_repository_error)
    }

    pub fn persist_state(&self, state: &AppState) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            transaction.execute("DELETE FROM leagues", [])?;
            insert_state(transaction, state)
        })
    }

    pub fn delete_league(&self, league_id: &str) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            require_changed(
                transaction.execute("DELETE FROM leagues WHERE id = ?1", [league_id])?,
                "league",
                league_id,
            )
        })
    }

    pub fn delete_season(&self, season_id: &str) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            require_changed(
                transaction.execute("DELETE FROM seasons WHERE id = ?1", [season_id])?,
                "season",
                season_id,
            )
        })
    }

    pub fn regenerate_fixtures(
        &self,
        season_id: &str,
        matches: &[Match],
    ) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            ensure_season(transaction, season_id)?;
            transaction.execute(
                "DELETE FROM random_tiebreaker_locks WHERE season_id = ?1",
                [season_id],
            )?;
            transaction.execute("DELETE FROM matches WHERE season_id = ?1", [season_id])?;
            insert_matches(transaction, season_id, matches)
        })
    }

    pub fn update_round_results(
        &self,
        season_id: &str,
        leg: i64,
        round: i64,
        updates: &[RoundResultUpdate],
    ) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            ensure_season(transaction, season_id)?;
            for update in updates {
                let changed = transaction.execute(
                    "UPDATE matches SET home_score = ?1, away_score = ?2, home_yellow_cards = ?3, away_yellow_cards = ?4, home_red_cards = ?5, away_red_cards = ?6 WHERE id = ?7 AND season_id = ?8 AND leg = ?9 AND round = ?10",
                    params![update.home_score, update.away_score, update.home_yellow_cards, update.away_yellow_cards, update.home_red_cards, update.away_red_cards, update.match_id, season_id, leg, round],
                )?;
                require_changed(changed, "match", &update.match_id)?;
            }
            transaction.execute(
                "DELETE FROM random_tiebreaker_locks WHERE season_id = ?1",
                [season_id],
            )?;
            Ok(())
        })
    }

    pub fn reset_results(&self, season_id: &str) -> Result<(), RepositoryError> {
        self.transaction(|transaction| {
            ensure_season(transaction, season_id)?;
            transaction.execute(
                "UPDATE matches SET home_score = NULL, away_score = NULL, home_yellow_cards = 0, away_yellow_cards = 0, home_red_cards = 0, away_red_cards = 0 WHERE season_id = ?1",
                [season_id],
            )?;
            transaction.execute(
                "DELETE FROM random_tiebreaker_locks WHERE season_id = ?1",
                [season_id],
            )?;
            Ok(())
        })
    }

    fn transaction<T>(
        &self,
        operation: impl FnOnce(&Transaction<'_>) -> Result<T, rusqlite::Error>,
    ) -> Result<T, RepositoryError> {
        let mut connection = self.connection.lock().map_err(|_| lock_error())?;
        let transaction = connection.transaction().map_err(map_repository_error)?;
        let result = operation(&transaction).map_err(map_repository_error)?;
        transaction.commit().map_err(map_repository_error)?;
        Ok(result)
    }
}

fn load_state(connection: &Connection) -> rusqlite::Result<AppState> {
    let leagues = query_all(
        connection,
        "SELECT id, name, created_at, updated_at FROM leagues ORDER BY sort_order",
        [],
        |row| {
            Ok(League {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    )?;
    let mut seasons = query_all(
        connection,
        "SELECT s.id, s.league_id, s.name, s.leg_count, s.created_at, s.updated_at FROM seasons s JOIN leagues l ON l.id = s.league_id ORDER BY l.sort_order, s.sort_order",
        [],
        |row| Ok(Season { id: row.get(0)?, league_id: row.get(1)?, name: row.get(2)?, leg_count: row.get(3)?, teams: vec![], matches: vec![], random_tiebreaker_locks: vec![], created_at: row.get(4)?, updated_at: row.get(5)? }),
    )?;

    for season in &mut seasons {
        season.teams = query_all(
            connection,
            "SELECT id, name FROM teams WHERE season_id = ?1 ORDER BY sort_order",
            [&season.id],
            |row| {
                Ok(Team {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            },
        )?;
        season.matches = query_all(connection, "SELECT id, leg, round, home_team_id, away_team_id, home_score, away_score, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards FROM matches WHERE season_id = ?1 ORDER BY leg, round, sort_order", [&season.id], map_match)?;
        season.random_tiebreaker_locks = load_locks(connection, &season.id)?;
    }
    Ok(AppState { leagues, seasons })
}

fn query_all<P, T>(
    connection: &Connection,
    sql: &str,
    params: P,
    mapper: impl FnMut(&Row<'_>) -> rusqlite::Result<T>,
) -> rusqlite::Result<Vec<T>>
where
    P: rusqlite::Params,
{
    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map(params, mapper)?.collect();
    rows
}

fn map_match(row: &Row<'_>) -> rusqlite::Result<Match> {
    Ok(Match {
        id: row.get(0)?,
        leg: row.get(1)?,
        round: row.get(2)?,
        home_team_id: row.get(3)?,
        away_team_id: row.get(4)?,
        home_score: row.get(5)?,
        away_score: row.get(6)?,
        home_yellow_cards: row.get(7)?,
        away_yellow_cards: row.get(8)?,
        home_red_cards: row.get(9)?,
        away_red_cards: row.get(10)?,
    })
}

fn load_locks(
    connection: &Connection,
    season_id: &str,
) -> rusqlite::Result<Vec<RandomTiebreakerLock>> {
    let lock_rows = query_all(
        connection,
        "SELECT id, mode FROM random_tiebreaker_locks WHERE season_id = ?1 ORDER BY sort_order",
        [season_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                TableMode::from_database(row.get(1)?)?,
            ))
        },
    )?;
    lock_rows.into_iter().map(|(lock_id, mode)| {
        let members = query_all(connection, "SELECT team_id, group_order, random_order FROM random_tiebreaker_lock_members WHERE lock_id = ?1 ORDER BY group_order", [lock_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)))?;
        let team_ids = members.iter().map(|member| member.0.clone()).collect();
        let mut ordered = members;
        ordered.sort_by_key(|member| member.2);
        Ok(RandomTiebreakerLock { mode, team_ids, ordered_team_ids: ordered.into_iter().map(|member| member.0).collect() })
    }).collect()
}

fn insert_state(transaction: &Transaction<'_>, state: &AppState) -> rusqlite::Result<()> {
    for (league_order, league) in state.leagues.iter().enumerate() {
        transaction.execute("INSERT INTO leagues (id, name, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)", params![league.id, league.name, league_order as i64, league.created_at, league.updated_at])?;
    }
    for season in &state.seasons {
        let season_order = state
            .seasons
            .iter()
            .filter(|candidate| candidate.league_id == season.league_id)
            .position(|candidate| candidate.id == season.id)
            .expect("season is present") as i64;
        transaction.execute("INSERT INTO seasons (id, league_id, name, leg_count, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)", params![season.id, season.league_id, season.name, season.leg_count, season_order, season.created_at, season.updated_at])?;
        for (order, team) in season.teams.iter().enumerate() {
            transaction.execute(
                "INSERT INTO teams (id, season_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![team.id, season.id, team.name, order as i64],
            )?;
        }
        insert_matches(transaction, &season.id, &season.matches)?;
        insert_locks(transaction, &season.id, &season.random_tiebreaker_locks)?;
    }
    Ok(())
}

fn insert_matches(
    transaction: &Transaction<'_>,
    season_id: &str,
    matches: &[Match],
) -> rusqlite::Result<()> {
    for fixture in matches {
        let order = matches
            .iter()
            .filter(|candidate| candidate.leg == fixture.leg && candidate.round == fixture.round)
            .position(|candidate| candidate.id == fixture.id)
            .expect("fixture is present") as i64;
        transaction.execute("INSERT INTO matches (id, season_id, leg, round, sort_order, home_team_id, away_team_id, home_score, away_score, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)", params![fixture.id, season_id, fixture.leg, fixture.round, order, fixture.home_team_id, fixture.away_team_id, fixture.home_score, fixture.away_score, fixture.home_yellow_cards, fixture.away_yellow_cards, fixture.home_red_cards, fixture.away_red_cards])?;
    }
    Ok(())
}

fn insert_locks(
    transaction: &Transaction<'_>,
    season_id: &str,
    locks: &[RandomTiebreakerLock],
) -> rusqlite::Result<()> {
    for (lock_order, lock) in locks.iter().enumerate() {
        transaction.execute(
            "INSERT INTO random_tiebreaker_locks (season_id, mode, sort_order) VALUES (?1, ?2, ?3)",
            params![season_id, lock.mode.as_str(), lock_order as i64],
        )?;
        let lock_id = transaction.last_insert_rowid();
        for (group_order, team_id) in lock.team_ids.iter().enumerate() {
            let random_order = lock
                .ordered_team_ids
                .iter()
                .position(|ordered_id| ordered_id == team_id)
                .ok_or(rusqlite::Error::InvalidQuery)?;
            transaction.execute("INSERT INTO random_tiebreaker_lock_members (lock_id, season_id, team_id, group_order, random_order) VALUES (?1, ?2, ?3, ?4, ?5)", params![lock_id, season_id, team_id, group_order as i64, random_order as i64])?;
        }
    }
    Ok(())
}

fn ensure_season(transaction: &Transaction<'_>, season_id: &str) -> rusqlite::Result<()> {
    let exists = transaction
        .query_row("SELECT 1 FROM seasons WHERE id = ?1", [season_id], |_| {
            Ok(())
        })
        .optional()?;
    exists.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

fn require_changed(changed: usize, _entity: &str, _id: &str) -> rusqlite::Result<()> {
    if changed == 0 {
        Err(rusqlite::Error::QueryReturnedNoRows)
    } else {
        Ok(())
    }
}

fn lock_error() -> RepositoryError {
    RepositoryError {
        code: RepositoryErrorCode::Unexpected,
        message: "the database connection is unavailable; restart the application and try again"
            .into(),
    }
}

fn map_repository_error(error: rusqlite::Error) -> RepositoryError {
    let (code, message) = match error.sqlite_error_code() {
        Some(ErrorCode::ConstraintViolation) => (RepositoryErrorCode::Constraint, "The change conflicts with existing tournament data. Check names, teams, and values, then try again."),
        Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked) => (RepositoryErrorCode::Busy, "The tournament database is busy or locked. Close other running instances and try again."),
        Some(ErrorCode::DiskFull) => (RepositoryErrorCode::DiskFull, "The database could not be saved because the disk is full. Free some space and try again."),
        Some(ErrorCode::PermissionDenied | ErrorCode::ReadOnly | ErrorCode::CannotOpen) => (RepositoryErrorCode::PermissionDenied, "The database cannot be written because access was denied. Check the app-data folder permissions and try again."),
        Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => (RepositoryErrorCode::Corrupt, "The tournament database is corrupt. Restore a backup before making more changes."),
        Some(ErrorCode::SystemIoFailure) => (RepositoryErrorCode::Io, "A disk I/O error prevented access to the tournament database. Check the disk and try again."),
        _ if matches!(error, rusqlite::Error::QueryReturnedNoRows) => (RepositoryErrorCode::NotFound, "The requested tournament data was not found. Reload and try again."),
        _ => (RepositoryErrorCode::Unexpected, "An unexpected database error occurred. No partial changes were saved."),
    };
    RepositoryError {
        code,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DATABASE_FILE_NAME;
    use rusqlite::ffi;

    fn database() -> (tempfile::TempDir, Database) {
        let directory = tempfile::tempdir().expect("temporary directory");
        let database =
            Database::open(directory.path().join(DATABASE_FILE_NAME)).expect("database opens");
        (directory, database)
    }

    fn state() -> AppState {
        AppState {
            leagues: vec![League {
                id: "league".into(),
                name: "League".into(),
                created_at: "created".into(),
                updated_at: "updated".into(),
            }],
            seasons: vec![Season {
                id: "season".into(),
                league_id: "league".into(),
                name: "Season".into(),
                leg_count: 2,
                teams: vec![
                    Team {
                        id: "team-b".into(),
                        name: "Beta".into(),
                    },
                    Team {
                        id: "team-a".into(),
                        name: "Alpha".into(),
                    },
                ],
                matches: vec![Match {
                    id: "match-2".into(),
                    leg: 1,
                    round: 1,
                    home_team_id: "team-b".into(),
                    away_team_id: "team-a".into(),
                    home_score: None,
                    away_score: None,
                    home_yellow_cards: 0,
                    away_yellow_cards: 0,
                    home_red_cards: 0,
                    away_red_cards: 0,
                }],
                random_tiebreaker_locks: vec![RandomTiebreakerLock {
                    mode: TableMode::Overall,
                    team_ids: vec!["team-b".into(), "team-a".into()],
                    ordered_team_ids: vec!["team-a".into(), "team-b".into()],
                }],
                created_at: "created".into(),
                updated_at: "updated".into(),
            }],
        }
    }

    #[test]
    fn round_trips_complete_state_with_order_nulls_zeroes_and_locks() {
        let (_directory, database) = database();
        let expected = state();
        database.persist_state(&expected).expect("state persists");
        assert_eq!(database.load_state().expect("state loads"), expected);
    }

    #[test]
    fn cascades_deletions_and_rolls_back_invalid_state_atomically() {
        let (_directory, database) = database();
        let original = state();
        database.persist_state(&original).expect("state persists");
        let mut invalid = original.clone();
        invalid.seasons[0].matches[0].away_team_id = "missing".into();
        assert_eq!(
            database
                .persist_state(&invalid)
                .expect_err("constraint fails")
                .code,
            RepositoryErrorCode::Constraint
        );
        assert_eq!(database.load_state().expect("original remains"), original);
        database.delete_league("league").expect("league deletes");
        assert_eq!(
            database.load_state().expect("empty loads"),
            AppState::default()
        );
    }

    #[test]
    fn deleting_a_season_cascades_all_of_its_children() {
        let (_directory, database) = database();
        database.persist_state(&state()).expect("state persists");
        database.delete_season("season").expect("season deletes");
        let loaded = database.load_state().expect("state loads");
        assert_eq!(loaded.leagues.len(), 1);
        assert!(loaded.seasons.is_empty());
    }

    #[test]
    fn updates_and_resets_results_and_regenerates_fixtures_transactionally() {
        let (_directory, database) = database();
        database.persist_state(&state()).expect("state persists");
        let update = RoundResultUpdate {
            match_id: "match-2".into(),
            home_score: Some(3),
            away_score: Some(1),
            home_yellow_cards: 2,
            away_yellow_cards: 1,
            home_red_cards: 0,
            away_red_cards: 1,
        };
        database
            .update_round_results("season", 1, 1, &[update])
            .expect("round updates");
        let updated = database.load_state().expect("state loads");
        assert_eq!(updated.seasons[0].matches[0].home_score, Some(3));
        assert!(updated.seasons[0].random_tiebreaker_locks.is_empty());
        database.reset_results("season").expect("results reset");
        let reset = database.load_state().expect("state loads");
        assert_eq!(reset.seasons[0].matches[0].home_score, None);
        assert_eq!(reset.seasons[0].matches[0].home_yellow_cards, 0);
        let mut replacement = reset.seasons[0].matches[0].clone();
        replacement.id = "replacement".into();
        database
            .regenerate_fixtures("season", &[replacement])
            .expect("fixtures regenerate");
        assert_eq!(
            database.load_state().expect("state loads").seasons[0].matches[0].id,
            "replacement"
        );
    }

    #[test]
    fn a_missing_round_match_rolls_back_every_update() {
        let (_directory, database) = database();
        database.persist_state(&state()).expect("state persists");
        let valid = RoundResultUpdate {
            match_id: "match-2".into(),
            home_score: Some(1),
            away_score: Some(0),
            home_yellow_cards: 0,
            away_yellow_cards: 0,
            home_red_cards: 0,
            away_red_cards: 0,
        };
        let mut missing = valid.clone();
        missing.match_id = "missing".into();
        let error = database
            .update_round_results("season", 1, 1, &[valid, missing])
            .expect_err("round fails");
        assert_eq!(error.code, RepositoryErrorCode::NotFound);
        assert_eq!(
            database.load_state().expect("state loads").seasons[0].matches[0].home_score,
            None
        );
    }

    #[test]
    fn maps_important_sqlite_failures_to_stable_codes() {
        let cases = [
            (ffi::SQLITE_CONSTRAINT, RepositoryErrorCode::Constraint),
            (ffi::SQLITE_BUSY, RepositoryErrorCode::Busy),
            (ffi::SQLITE_LOCKED, RepositoryErrorCode::Busy),
            (ffi::SQLITE_FULL, RepositoryErrorCode::DiskFull),
            (ffi::SQLITE_PERM, RepositoryErrorCode::PermissionDenied),
            (ffi::SQLITE_READONLY, RepositoryErrorCode::PermissionDenied),
            (ffi::SQLITE_CANTOPEN, RepositoryErrorCode::PermissionDenied),
            (ffi::SQLITE_CORRUPT, RepositoryErrorCode::Corrupt),
            (ffi::SQLITE_NOTADB, RepositoryErrorCode::Corrupt),
            (ffi::SQLITE_IOERR, RepositoryErrorCode::Io),
            (ffi::SQLITE_ERROR, RepositoryErrorCode::Unexpected),
        ];
        for (sqlite_code, expected) in cases {
            let error = rusqlite::Error::SqliteFailure(ffi::Error::new(sqlite_code), None);
            assert_eq!(map_repository_error(error).code, expected);
        }
    }
}
