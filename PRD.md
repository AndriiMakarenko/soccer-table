# PRD: Round Robin Tournament Manager

## 1. Product Summary

Build a local-first browser and Tauri v2 desktop application for creating and managing round robin football-style tournaments.

The app allows users to create leagues and seasons, enter teams in bulk, generate round robin fixtures, manually enter match scores and card counts, and view live standings with full, home-only, and away-only table modes.

The app is intended for local, single-user use. Browser builds persist tournament data in versioned localStorage. A Rust host persists desktop data in SQLite through a narrow, typed Tauri command bridge. The bundled desktop application is self-contained and does not require a browser, development server, Node.js, pnpm, or Rust at runtime.

---

## 2. Target Tech Stack

- Vue 3
- Vite
- pnpm
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS for layout
- PrimeVue for UI components/styling
- Vitest for tests
- Tauri v2 with a Rust host and capability-scoped IPC
- build-time-selected versioned localStorage for browsers or SQLite in Tauri's per-user application-data directory
- Playwright for renderer accessibility, responsive, and representative workflow tests

The asynchronous storage layer must remain isolated behind one typed interface. Ordinary Vite development and browser production builds use localStorage; Tauri development and bundles use only the native adapter. Selection happens at build time, and Tauri failures never fall back to browser storage. Injectable in-memory and failing adapters keep renderer tests independent of a native window.

---

## 3. Core Concepts

### League

A league is a container for seasons.

A league should support:

- create
- rename
- delete
- list seasons belonging to the league

### Season

A season belongs to one league.

A season contains:

- season name
- team list
- generated fixtures
- match scores
- yellow/red card counts
- standings data derived from fixtures
- locked random tiebreaker data, if applicable

A season should support:

- create
- rename
- delete
- open
- reset all results
- regenerate fixtures only before results exist, or after explicit confirmation that existing results will be deleted

The app does not need to automatically open the last active season by default.

---

## 4. Team Input

The app must allow users to enter team names in bulk.

Input format:

```text
Team One
Team Two
Team Three
```

Rules:

- one line = one team
- empty lines are ignored
- leading/trailing whitespace is trimmed
- duplicate team names are rejected
- minimum teams: 2
- supported team cap: at least 64 teams

After fixtures are generated, the team list is locked unless the user resets/regenerates the season.

---

## 5. Fixture Generation

The app must generate round robin fixtures automatically.

Requirements:

- support any number of teams from 2 to 64
- support 1 to 4 legs per season
- no BYE pseudo-team should be displayed to the user
- if the number of teams is odd, one real team sits out each round
- every team must play every other team once per leg
- for 2+ legs, home/away should be balanced as evenly as possible
- for a normal 2-leg season, the second leg should reverse home/away from the first leg
- for 3 or 4 legs, home/away should continue alternating as evenly as possible

Each fixture must include:

- fixture id
- leg number
- round number
- home team id
- away team id
- optional home score
- optional away score
- home yellow cards
- away yellow cards
- home red cards
- away red cards

Unplayed games have empty scores.

---

## 6. Match Result Entry

The user must be able to manually enter the score of every game.

For each side, the user can enter:

- goals scored
- yellow cards
- red cards

Validation:

- scores must be empty or non-negative integers
- card counts must be non-negative integers
- card counts default to `0`
- a match is considered played only when both scores are filled
- a score can be cleared, making the match unplayed again
- standings update immediately after changes

Result rules:

- more goals than opponent = win
- same goals as opponent = draw
- fewer goals than opponent = loss

Points:

- win = 3 points
- draw = 1 point
- loss = 0 points

Penalty points:

- yellow card = 1 penalty point
- red card = 3 penalty points

Penalty points are used as a later tiebreaker.

---

## 7. Fixtures UI

Fixtures should be grouped clearly by:

- leg
- round

Each round should be displayed inside a dark rectangular panel with a subtle border. The panel should have a header area with the round title on the left, for example `Round 1`, and a prominent action button on the right for editing results.

The fixture list should use a spacious row layout. Each row should show:

- home team score
- home team name
- centered `v` / versus separator
- away team name
- away team score
- optional right-side placeholder/status area

The score inputs must be visually centered around the versus separator and between the two team names. They must not be pushed to the far left and far right edges of the panel.

Desired row structure:

```text
Home Team        [home score] - [away score]        Away Team
```

Alternative display structure is also acceptable if it keeps the score visually central:

```text
Home Team        [home score] v [away score]        Away Team
```

The user must be able to edit scores/results for each round.

A button similar to `Edit Times / Results` may be used, but exact wording is not fixed.

Visual style expectations:

- dark background
- light text
- large readable team names
- clear row spacing
- strong round heading
- highly visible primary action button

---

## 8. Standings Table

The app must display a dense league standings table.

The table should use a dark background with light text, bold column headers, and horizontal separators between rows. The team position and name should be on the left. Numeric stat columns should be aligned in a clean grid to the right.

Columns:

| Column | Meaning |
|---|---|
| POS | Position |
| Team | Team name |
| PLD | Games played |
| W | Wins |
| D | Draws |
| L | Losses |
| SF | Goals scored / Goals for |
| SA | Goals against |
| SD | Goal difference |
| PTS | Points |

Column labels should be:

- `POS`
- `Team`
- `PLD`
- `W`
- `D`
- `L`
- `SF`
- `SA`
- `SD`
- `PTS`

Table visual expectations:

- `POS` column is narrow
- `Team` column is wider than stat columns
- stat columns are compact
- headers are bold and clearly separated from rows
- rows are horizontally separated
- numbers are easy to scan vertically
- table should remain readable with 20+ teams

Below the standings table, display an `Average total` value.

`Average total` means the average total goals per played match for the currently selected table mode.

Formula:

```text
Average total = (sum(SF) / sum(PLD)) * 2
```

Display rules:

- respect the current table mode: Overall, Home only, or Away only
- show exactly 2 digits after the decimal point
- show `N/A` when `sum(PLD) = 0`

Examples:

```text
Average total: 2.75
Average total: N/A
```

---

## 9. Standings Calculation

For each team:

- `PLD`: number of played matches
- `W`: wins
- `D`: draws
- `L`: losses
- `SF`: goals scored
- `SA`: goals conceded
- `SD`: `SF - SA`
- `PTS`: total points
- `Penalty Points`: yellow cards × 1 + red cards × 3

Only played matches count toward standings.

Also calculate `Average total` for the current table mode:

```text
Average total = (sum(SF) / sum(PLD)) * 2
```

If `sum(PLD) = 0`, return `N/A`.

Otherwise, format the result with exactly 2 digits after the decimal point.

---

## 10. Ranking Rules

Teams must be ranked by the following order:

1. Points
2. Goal difference
3. Head-to-head points among tied teams
4. Head-to-head goals scored among tied teams
5. Total goals scored
6. Lower penalty points
7. Locked random tiebreaker, but only after the full season is complete

### Head-to-head rules

Head-to-head applies when teams are tied after points and goal difference.

For 2 tied teams:

- compare points earned in matches between those two teams
- if still tied, compare goals scored in matches between those two teams

For 3+ tied teams:

- build a mini-table using only matches between the tied teams
- compare head-to-head points in that mini-table
- if still tied, compare head-to-head goals scored in that mini-table

### Random tiebreaker rule

If teams are still tied after all ranking rules, the app must behave differently depending on season state.

If the season is still ongoing:

- do not randomize
- show tied teams on the same position
- use standard competition ranking

Example:

| POS | Team | PTS |
|---|---|---|
| 1 | Team A | 30 |
| 1 | Team B | 30 |
| 3 | Team C | 28 |

If the season is complete:

- generate a random final order only for teams still fully tied
- save this random order into the season data
- reuse the saved random order forever unless the relevant results change
- if results change and the season becomes incomplete or the tie state changes, invalidate affected random tiebreaker data

A season is complete when every fixture has both scores filled.

---

## 11. Home / Away / Overall Table Views

The standings page must support three table modes:

- Overall
- Home only
- Away only

Overall:

- calculate stats from all played matches

Home only:

- calculate stats only from matches where the team was the home team

Away only:

- calculate stats only from matches where the team was the away team

In filtered modes, all stats must be recalculated from the filtered match set, including:

- PLD
- W
- D
- L
- SF
- SA
- SD
- PTS
- penalty points
- ranking
- Average total

`Average total` must always be calculated from the same filtered table data currently shown to the user.

---

## 12. Persistence

The backend is selected at build time. `pnpm dev` and `pnpm build` use the browser adapter and the versioned localStorage key `round-robin-tournament-manager:v1`; they must not create or require SQLite. `pnpm tauri:dev` and `pnpm tauri:build` use the native adapter and must not fall back to localStorage after initialization, bridge, or database failures.

The Rust host stores desktop tournament state in `db.sqlite`. Desktop production resolves the database through Tauri's platform app-data API:

- macOS: `~/Library/Application Support/space.andymac.roundrobin/db.sqlite`
- Windows: `%APPDATA%\space.andymac.roundrobin\db.sqlite`

The database must never be created in the application bundle, installation directory, renderer assets, current working directory, or a browser storage API. Browser state remains origin/profile-specific and must not be read by the desktop persistence adapter.

Persist:

- leagues
- seasons
- teams
- fixtures
- scores
- card counts
- locked random tiebreaker data

Requirements:

- browser data survives reloads for the same origin/profile; desktop data survives renderer reload, app relaunch, and in-place upgrades
- writes are asynchronous and serialized so an older write cannot overwrite newer accepted state
- accepted in-memory edits remain available when persistence fails
- database busy/lock, disk-full, permission, corruption, bridge, and unexpected I/O failures produce actionable UI
- app shutdown waits for pending persistence or presents a recoverable failure instead of silently losing data
- versioned migrations run transactionally at startup
- desktop production never reads or writes application state through `localStorage`
- browser production never initializes SQLite or invokes the Tauri persistence bridge

Example error message:

```text
Could not save changes to the desktop database. Check available disk space and permissions, then try again.
```

Backups are made while the application is closed. Copy `db.sqlite` together with `db.sqlite-wal` and `db.sqlite-shm` when those sidecar files exist.

Portable backups use deterministic interchange JSON envelope version `1` with top-level `version` and `state` fields. The state contains every league, season, team, fixture, result, card count, and locked random tiebreaker. Import validates the complete schema and relationships before mutation. Replace requires explicit destructive confirmation and applies atomically. Merge preserves existing data, skips an entire imported league when its normalized name conflicts, reports every skipped league, and remaps identifier collisions without overwriting data. Cancellation or any read, validation, file, or persistence failure must leave the prior state intact with no partial import.

---

## 13. Navigation / Pages

Suggested routes:

```text
/
  League list / dashboard

/leagues/:leagueId
  League detail with season list

/leagues/:leagueId/seasons/new
  Create season

/leagues/:leagueId/seasons/:seasonId
  Season overview

/leagues/:leagueId/seasons/:seasonId/fixtures
  Fixtures and result entry

/leagues/:leagueId/seasons/:seasonId/table
  Standings table
```

Exact route names can vary, but the app should clearly separate:

- league management
- season management
- team entry
- fixture generation
- result editing
- standings view

---

## 14. UI Requirements

General:

- dark theme preferred
- responsive enough for desktop and tablet
- mobile support is not a strict priority
- use PrimeVue components where practical
- use Tailwind for layout spacing and structure

Important fixture UI details:

- rounds should be shown as bordered dark panels
- each round panel should have a clear header
- round title should be aligned left
- result-editing action should be aligned right
- fixture rows should have generous vertical spacing
- score inputs must be centered between teams
- fixtures must be grouped by round and leg

Important standings UI details:

- standings table should be readable and dense
- table should use clear columns for position, team name, played, wins, draws, losses, goals for, goals against, goal difference, and points
- numeric columns should align cleanly
- rows should be separated with horizontal dividers
- home/away/overall filter should be easy to switch
- `Average total` should be shown below the standings table

---

## 15. State Management

Use Pinia stores.

Suggested stores:

### `leagueStore`

Handles:

- leagues
- current league selection
- create/rename/delete league

### `seasonStore`

Handles:

- seasons
- create/rename/delete season
- team list
- fixture generation
- score/card updates
- season reset

### `standingsStore` or composable

Handles derived calculations:

- overall standings
- home standings
- away standings
- Average total
- ranking
- tiebreakers
- completion detection
- random tiebreaker locking

Derived data should generally be recalculated from stored fixtures, not manually stored, except for locked random tiebreaker data.

---

## 16. Data Model Draft

### Team

```ts
type Team = {
  id: string
  name: string
}
```

### Match

```ts
type Match = {
  id: string
  leg: number
  round: number
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
}
```

### Season

```ts
type Season = {
  id: string
  leagueId: string
  name: string
  teams: Team[]
  matches: Match[]
  numberOfLegs: number
  randomTiebreakers: Record<string, string[]>
  createdAt: string
  updatedAt: string
}
```

### League

```ts
type League = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
```

### Storage Root

```ts
type AppState = {
  leagues: League[]
  seasons: Season[]
}
```

---

## 17. Testing Requirements

Use Vitest.

Test coverage should focus on business rules.

Required tests:

### Fixture generation

- generates correct number of matches for even number of teams
- generates correct number of matches for odd number of teams
- no team plays itself
- no duplicate pairings inside the same leg
- 2-leg season reverses home/away
- supports up to 64 teams
- supports up to 4 legs

### Match result calculation

- win/loss/draw points
- PLD counts only completed matches
- empty scores do not count
- goals for/against/difference
- yellow/red card penalty points

### Standings ranking

- ranks by points
- ranks by goal difference
- ranks by head-to-head points
- ranks by head-to-head goals scored
- ranks by total goals scored
- ranks by lower penalty points
- tied teams share same position while season is incomplete
- standard competition ranking works: `1, 1, 3`
- random tiebreaker is inactive while season is incomplete
- random tiebreaker is generated and locked when season is complete
- locked random tiebreaker remains stable after reload

### Average total

- calculates `Average total` as `(sum(SF) / sum(PLD)) * 2`
- formats `Average total` with exactly 2 digits after the decimal point
- shows `N/A` when `sum(PLD) = 0`
- recalculates `Average total` for Overall mode
- recalculates `Average total` for Home only mode
- recalculates `Average total` for Away only mode

### Filtered tables

- home-only table recalculates stats using only home matches
- away-only table recalculates stats using only away matches
- penalty points are filtered too

### Persistence

- selects versioned localStorage for ordinary browser development and production builds
- restores browser data after reload and handles missing, corrupt, quota-full, and unavailable storage safely
- initializes and migrates a fresh SQLite database in an isolated app-data directory
- saves and loads app state through typed Tauri commands
- serializes overlapping writes and retains the newest accepted state
- persists CRUD, results, cards, and locked random tiebreakers across relaunch
- maps database lock, disk/write, permission, corruption, and bridge failures
- preserves in-memory edits and supports retry after a recoverable failure
- coordinates close requests with pending and failed writes
- proves desktop production does not access or fall back to `localStorage`
- proves browser production does not create or require SQLite
- round-trips the complete state through interchange JSON version `1`
- rejects invalid JSON and preserves state on cancellation or failed import
- replaces only after confirmation and merges by skipping/reporting whole conflicting leagues

---

## 18. Non-Goals for MVP

The MVP does not need:

- backend server
- user accounts
- cloud sync
- match dates/times
- playoff/bracket formats
- live match tracking
- team logos
- advanced permissions
- multi-user collaboration

---

## 19. Acceptance Criteria

The project is done when:

1. User can create, rename, and delete leagues.
2. User can create, rename, and delete seasons inside a league.
3. User can bulk-enter teams, one team per line.
4. User can generate round robin fixtures with 1 to 4 legs.
5. User can manage at least 64 teams.
6. User can manually enter and clear match scores.
7. User can enter yellow and red cards for each side.
8. Standings update immediately after result changes.
9. Standings correctly show PLD, W, D, L, SF, SA, SD, and PTS.
10. Standings show `Average total` below the table.
11. `Average total` respects the current table mode.
12. `Average total` shows exactly 2 digits after the decimal point, or `N/A` when no games are played.
13. Ranking follows the required tiebreaker order.
14. Tied teams share positions while the season is incomplete.
15. Standard competition ranking is used, for example `1, 1, 3`.
16. Final unresolved ties are randomized only after all matches are complete.
17. Random final tiebreakers are saved and remain stable.
18. User can switch between overall, home-only, and away-only tables.
19. Browser data persists in versioned localStorage after reload; desktop data persists in SQLite after renderer reload and native app relaunch.
20. Browser storage, database, and Tauri bridge failures are shown clearly without discarding accepted in-memory edits or switching backends.
21. Fixture UI uses round panels with centered score inputs between team names.
22. Standings UI uses a dense dark table with clear aligned stat columns.
23. Core business logic is covered by Vitest tests.
24. Browser production uses only versioned localStorage; desktop production creates `db.sqlite` only in Tauri's per-user app-data directory and never falls back to localStorage.
25. The macOS bundle contains the Rust host and renderer and requires no development server or developer toolchain at runtime.
26. Pending writes and recoverable shutdown failures cannot cause silent data loss.
27. Versioned JSON export contains complete application state and works in browser and desktop builds.
28. Valid imports can replace after confirmation or merge by reporting and skipping whole conflicting leagues; invalid, cancelled, or failed imports make no partial changes.

---

## 20. Suggested Implementation Order

1. Project setup with Vue 3, Vite, pnpm, TypeScript, Pinia, Router, Tailwind, PrimeVue, Vitest.
2. Define TypeScript models.
3. Build the typed Tauri command bridge and SQLite persistence service.
4. Build league and season CRUD.
5. Build bulk team input.
6. Build fixture generation.
7. Build fixture/results UI.
8. Build standings calculation.
9. Build Average total calculation.
10. Build ranking and tiebreaker logic.
11. Add home/away/overall table filters.
12. Add random tiebreaker locking.
13. Add desktop startup, persistence-failure, and shutdown coordination UX.
14. Add Vitest, Rust, and Playwright coverage.
15. Configure least-privilege Tauri capabilities and production security checks.
16. Build and smoke-test reproducible signed or unsigned desktop artifacts.
17. Polish UI according to the verbal layout and style requirements.
