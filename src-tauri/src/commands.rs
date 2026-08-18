use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{
    database::Database,
    repository::{
        AppState, Match, RepositoryError, RepositoryErrorCode, RoundResultUpdate, Season,
    },
};

const MAX_IDENTIFIER_LENGTH: usize = 256;
const MAX_NAME_LENGTH: usize = 256;
const MAX_TEAMS_PER_SEASON: usize = 64;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistStateRequest {
    pub state: AppState,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EntityRequest {
    pub id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegenerateFixturesRequest {
    pub season_id: String,
    pub matches: Vec<Match>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRoundResultsRequest {
    pub season_id: String,
    pub leg: i64,
    pub round: i64,
    pub updates: Vec<RoundResultUpdate>,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandErrorCode {
    Validation,
    Constraint,
    Busy,
    DiskFull,
    PermissionDenied,
    Corrupt,
    Io,
    NotFound,
    Unexpected,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: CommandErrorCode,
    pub message: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct CommandSuccess {
    pub success: bool,
}

impl CommandSuccess {
    fn new() -> Self {
        Self { success: true }
    }
}

impl From<RepositoryError> for CommandError {
    fn from(error: RepositoryError) -> Self {
        let code = match error.code {
            RepositoryErrorCode::Constraint => CommandErrorCode::Constraint,
            RepositoryErrorCode::Busy => CommandErrorCode::Busy,
            RepositoryErrorCode::DiskFull => CommandErrorCode::DiskFull,
            RepositoryErrorCode::PermissionDenied => CommandErrorCode::PermissionDenied,
            RepositoryErrorCode::Corrupt => CommandErrorCode::Corrupt,
            RepositoryErrorCode::Io => CommandErrorCode::Io,
            RepositoryErrorCode::NotFound => CommandErrorCode::NotFound,
            RepositoryErrorCode::Unexpected => CommandErrorCode::Unexpected,
        };
        Self {
            code,
            message: error.message,
        }
    }
}

#[tauri::command]
pub async fn load_app_state(app: AppHandle) -> Result<AppState, CommandError> {
    run_database(app, |database| database.load_state()).await
}

#[tauri::command]
pub async fn persist_app_state(
    app: AppHandle,
    request: PersistStateRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_state(&request.state)?;
    run_database(app, move |database| database.persist_state(&request.state)).await?;
    Ok(CommandSuccess::new())
}

#[tauri::command]
pub async fn delete_league(
    app: AppHandle,
    request: EntityRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_id(&request.id, "league id")?;
    run_database(app, move |database| database.delete_league(&request.id)).await?;
    Ok(CommandSuccess::new())
}

#[tauri::command]
pub async fn delete_season(
    app: AppHandle,
    request: EntityRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_id(&request.id, "season id")?;
    run_database(app, move |database| database.delete_season(&request.id)).await?;
    Ok(CommandSuccess::new())
}

#[tauri::command]
pub async fn regenerate_fixtures(
    app: AppHandle,
    request: RegenerateFixturesRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_id(&request.season_id, "season id")?;
    validate_matches(&request.matches)?;
    run_database(app, move |database| {
        database.regenerate_fixtures(&request.season_id, &request.matches)
    })
    .await?;
    Ok(CommandSuccess::new())
}

#[tauri::command]
pub async fn update_round_results(
    app: AppHandle,
    request: UpdateRoundResultsRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_id(&request.season_id, "season id")?;
    positive(request.leg, "leg")?;
    positive(request.round, "round")?;
    if request.updates.is_empty() {
        return Err(validation_error("round updates must not be empty"));
    }
    let mut ids = HashSet::new();
    for update in &request.updates {
        validate_id(&update.match_id, "match id")?;
        if !ids.insert(update.match_id.as_str()) {
            return Err(validation_error(
                "round updates contain duplicate match ids",
            ));
        }
        optional_non_negative(update.home_score, "home score")?;
        optional_non_negative(update.away_score, "away score")?;
        non_negative(update.home_yellow_cards, "home yellow cards")?;
        non_negative(update.away_yellow_cards, "away yellow cards")?;
        non_negative(update.home_red_cards, "home red cards")?;
        non_negative(update.away_red_cards, "away red cards")?;
    }
    run_database(app, move |database| {
        database.update_round_results(
            &request.season_id,
            request.leg,
            request.round,
            &request.updates,
        )
    })
    .await?;
    Ok(CommandSuccess::new())
}

#[tauri::command]
pub async fn reset_results(
    app: AppHandle,
    request: EntityRequest,
) -> Result<CommandSuccess, CommandError> {
    validate_id(&request.id, "season id")?;
    run_database(app, move |database| database.reset_results(&request.id)).await?;
    Ok(CommandSuccess::new())
}

async fn run_database<T: Send + 'static>(
    app: AppHandle,
    operation: impl FnOnce(&Database) -> Result<T, RepositoryError> + Send + 'static,
) -> Result<T, CommandError> {
    tauri::async_runtime::spawn_blocking(move || operation(app.state::<Database>().inner()))
        .await
        .map_err(|_| CommandError {
            code: CommandErrorCode::Unexpected,
            message: "The native persistence command could not be completed. Try again.".into(),
        })?
        .map_err(CommandError::from)
}

fn validate_state(state: &AppState) -> Result<(), CommandError> {
    let mut league_ids = HashSet::new();
    for league in &state.leagues {
        validate_id(&league.id, "league id")?;
        validate_name(&league.name, "league name")?;
        validate_timestamp(&league.created_at)?;
        validate_timestamp(&league.updated_at)?;
        if !league_ids.insert(league.id.as_str()) {
            return Err(validation_error("league ids must be unique"));
        }
    }

    let mut season_ids = HashSet::new();
    for season in &state.seasons {
        validate_season(season, &league_ids)?;
        if !season_ids.insert(season.id.as_str()) {
            return Err(validation_error("season ids must be unique"));
        }
    }
    Ok(())
}

fn validate_season(season: &Season, league_ids: &HashSet<&str>) -> Result<(), CommandError> {
    validate_id(&season.id, "season id")?;
    validate_id(&season.league_id, "league id")?;
    if !league_ids.contains(season.league_id.as_str()) {
        return Err(validation_error(
            "every season must belong to a supplied league",
        ));
    }
    validate_name(&season.name, "season name")?;
    if !(1..=4).contains(&season.leg_count) {
        return Err(validation_error("leg count must be between 1 and 4"));
    }
    if season.teams.len() > MAX_TEAMS_PER_SEASON {
        return Err(validation_error(
            "a season cannot contain more than 64 teams",
        ));
    }
    validate_timestamp(&season.created_at)?;
    validate_timestamp(&season.updated_at)?;

    let mut team_ids = HashSet::new();
    for team in &season.teams {
        validate_id(&team.id, "team id")?;
        validate_name(&team.name, "team name")?;
        if !team_ids.insert(team.id.as_str()) {
            return Err(validation_error("team ids must be unique within a season"));
        }
    }
    validate_matches_for_teams(&season.matches, &team_ids)?;

    for lock in &season.random_tiebreaker_locks {
        if lock.team_ids.len() < 2
            || lock.team_ids.len() != lock.ordered_team_ids.len()
            || lock.team_ids.iter().collect::<HashSet<_>>().len() != lock.team_ids.len()
            || lock.ordered_team_ids.iter().collect::<HashSet<_>>()
                != lock.team_ids.iter().collect::<HashSet<_>>()
            || lock
                .team_ids
                .iter()
                .any(|id| !team_ids.contains(id.as_str()))
        {
            return Err(validation_error("random tiebreaker locks must contain the same unique season team ids in both orders"));
        }
    }
    Ok(())
}

fn validate_matches(matches: &[Match]) -> Result<(), CommandError> {
    let team_ids = matches
        .iter()
        .flat_map(|fixture| [&fixture.home_team_id, &fixture.away_team_id])
        .map(String::as_str)
        .collect::<HashSet<_>>();
    validate_matches_for_teams(matches, &team_ids)
}

fn validate_matches_for_teams(
    matches: &[Match],
    team_ids: &HashSet<&str>,
) -> Result<(), CommandError> {
    let mut match_ids = HashSet::new();
    for fixture in matches {
        validate_id(&fixture.id, "match id")?;
        validate_id(&fixture.home_team_id, "home team id")?;
        validate_id(&fixture.away_team_id, "away team id")?;
        if !match_ids.insert(fixture.id.as_str()) {
            return Err(validation_error("match ids must be unique"));
        }
        if fixture.home_team_id == fixture.away_team_id {
            return Err(validation_error("a team cannot play itself"));
        }
        if !team_ids.contains(fixture.home_team_id.as_str())
            || !team_ids.contains(fixture.away_team_id.as_str())
        {
            return Err(validation_error(
                "matches must reference supplied season teams",
            ));
        }
        positive(fixture.leg, "leg")?;
        positive(fixture.round, "round")?;
        optional_non_negative(fixture.home_score, "home score")?;
        optional_non_negative(fixture.away_score, "away score")?;
        non_negative(fixture.home_yellow_cards, "home yellow cards")?;
        non_negative(fixture.away_yellow_cards, "away yellow cards")?;
        non_negative(fixture.home_red_cards, "home red cards")?;
        non_negative(fixture.away_red_cards, "away red cards")?;
    }
    Ok(())
}

fn validate_id(value: &str, label: &str) -> Result<(), CommandError> {
    if value.trim().is_empty() || value.len() > MAX_IDENTIFIER_LENGTH {
        return Err(validation_error(format!(
            "{label} must be between 1 and {MAX_IDENTIFIER_LENGTH} characters"
        )));
    }
    Ok(())
}

fn validate_name(value: &str, label: &str) -> Result<(), CommandError> {
    if value.trim().is_empty() || value.len() > MAX_NAME_LENGTH {
        return Err(validation_error(format!(
            "{label} must be between 1 and {MAX_NAME_LENGTH} characters"
        )));
    }
    Ok(())
}

fn validate_timestamp(value: &str) -> Result<(), CommandError> {
    if value.trim().is_empty() || value.len() > 64 {
        return Err(validation_error(
            "timestamps must be non-empty and at most 64 characters",
        ));
    }
    Ok(())
}

fn positive(value: i64, label: &str) -> Result<(), CommandError> {
    if value <= 0 {
        return Err(validation_error(format!(
            "{label} must be a positive integer"
        )));
    }
    Ok(())
}

fn non_negative(value: i64, label: &str) -> Result<(), CommandError> {
    if value < 0 {
        return Err(validation_error(format!(
            "{label} must be a non-negative integer"
        )));
    }
    Ok(())
}

fn optional_non_negative(value: Option<i64>, label: &str) -> Result<(), CommandError> {
    if let Some(value) = value {
        non_negative(value, label)?;
    }
    Ok(())
}

fn validation_error(message: impl Into<String>) -> CommandError {
    CommandError {
        code: CommandErrorCode::Validation,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repository::{League, RandomTiebreakerLock, TableMode, Team};

    fn valid_state() -> AppState {
        AppState {
            leagues: vec![League {
                id: "league".into(),
                name: "League".into(),
                created_at: "2026-08-18T00:00:00Z".into(),
                updated_at: "2026-08-18T00:00:00Z".into(),
            }],
            seasons: vec![Season {
                id: "season".into(),
                league_id: "league".into(),
                name: "Season".into(),
                teams: vec![
                    Team {
                        id: "a".into(),
                        name: "Alpha".into(),
                    },
                    Team {
                        id: "b".into(),
                        name: "Beta".into(),
                    },
                ],
                matches: vec![Match {
                    id: "match".into(),
                    leg: 1,
                    round: 1,
                    home_team_id: "a".into(),
                    away_team_id: "b".into(),
                    home_score: None,
                    away_score: None,
                    home_yellow_cards: 0,
                    away_yellow_cards: 0,
                    home_red_cards: 0,
                    away_red_cards: 0,
                }],
                leg_count: 1,
                random_tiebreaker_locks: vec![RandomTiebreakerLock {
                    mode: TableMode::Overall,
                    team_ids: vec!["a".into(), "b".into()],
                    ordered_team_ids: vec!["b".into(), "a".into()],
                }],
                created_at: "2026-08-18T00:00:00Z".into(),
                updated_at: "2026-08-18T00:00:00Z".into(),
            }],
        }
    }

    #[test]
    fn accepts_a_complete_valid_application_payload() {
        assert_eq!(validate_state(&valid_state()), Ok(()));
    }

    #[test]
    fn rejects_malformed_state_and_round_payloads_before_repository_dispatch() {
        let mut state = valid_state();
        state.seasons[0].matches[0].home_score = Some(-1);
        assert_eq!(
            validate_state(&state).expect_err("invalid score").code,
            CommandErrorCode::Validation
        );

        let request = UpdateRoundResultsRequest {
            season_id: "season".into(),
            leg: 1,
            round: 1,
            updates: Vec::new(),
        };
        assert!(request.updates.is_empty());
    }

    #[test]
    fn serializes_stable_success_and_error_contracts() {
        assert_eq!(
            serde_json::to_string(&CommandSuccess::new()).unwrap(),
            r#"{"success":true}"#
        );
        let error = CommandError::from(RepositoryError {
            code: RepositoryErrorCode::DiskFull,
            message: "disk full".into(),
        });
        assert_eq!(
            serde_json::to_string(&error).unwrap(),
            r#"{"code":"disk-full","message":"disk full"}"#
        );
    }

    #[test]
    fn request_deserialization_rejects_unknown_fields() {
        let malformed = serde_json::from_str::<EntityRequest>(r#"{"id":"league","path":"/tmp"}"#);
        assert!(malformed.is_err());
    }
}
