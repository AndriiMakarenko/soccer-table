CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE leagues (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (sort_order)
);

CREATE TABLE seasons (
    id TEXT PRIMARY KEY NOT NULL,
    league_id TEXT NOT NULL REFERENCES leagues(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    leg_count INTEGER NOT NULL CHECK (leg_count BETWEEN 1 AND 4),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (league_id, sort_order)
);

CREATE INDEX seasons_league_id_idx ON seasons (league_id);

CREATE TABLE teams (
    id TEXT PRIMARY KEY NOT NULL,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    UNIQUE (season_id, name),
    UNIQUE (season_id, sort_order),
    UNIQUE (id, season_id)
);

CREATE INDEX teams_season_id_idx ON teams (season_id);

CREATE TABLE matches (
    id TEXT PRIMARY KEY NOT NULL,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON UPDATE CASCADE ON DELETE CASCADE,
    leg INTEGER NOT NULL CHECK (leg BETWEEN 1 AND 4),
    round INTEGER NOT NULL CHECK (round > 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_score INTEGER CHECK (home_score IS NULL OR home_score >= 0),
    away_score INTEGER CHECK (away_score IS NULL OR away_score >= 0),
    home_yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (home_yellow_cards >= 0),
    away_yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (away_yellow_cards >= 0),
    home_red_cards INTEGER NOT NULL DEFAULT 0 CHECK (home_red_cards >= 0),
    away_red_cards INTEGER NOT NULL DEFAULT 0 CHECK (away_red_cards >= 0),
    FOREIGN KEY (home_team_id, season_id) REFERENCES teams(id, season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (away_team_id, season_id) REFERENCES teams(id, season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CHECK (home_team_id <> away_team_id),
    UNIQUE (season_id, leg, round, sort_order)
);

CREATE INDEX matches_season_order_idx ON matches (season_id, leg, round, sort_order);

CREATE TABLE random_tiebreaker_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON UPDATE CASCADE ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('overall', 'home', 'away')),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    UNIQUE (season_id, mode, sort_order),
    UNIQUE (id, season_id)
);

CREATE INDEX random_tiebreaker_locks_season_idx ON random_tiebreaker_locks (season_id);

CREATE TABLE random_tiebreaker_lock_members (
    lock_id INTEGER NOT NULL REFERENCES random_tiebreaker_locks(id) ON UPDATE CASCADE ON DELETE CASCADE,
    season_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    group_order INTEGER NOT NULL CHECK (group_order >= 0),
    random_order INTEGER NOT NULL CHECK (random_order >= 0),
    PRIMARY KEY (lock_id, team_id),
    FOREIGN KEY (lock_id, season_id) REFERENCES random_tiebreaker_locks(id, season_id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (team_id, season_id) REFERENCES teams(id, season_id) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (lock_id, group_order),
    UNIQUE (lock_id, random_order)
);

CREATE INDEX random_tiebreaker_members_team_idx ON random_tiebreaker_lock_members (team_id);
