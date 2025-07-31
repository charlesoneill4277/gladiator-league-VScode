Supabase Database Schema Documentation
Table: conferences
Description: Stores metadata about fantasy sports leagues or divisions.
Columns:
●	id (integer): Primary key, auto-generated ID.

●	conference_name (text): Name of the conference.

●	league_id (text): External league ID (unique).

●	season_id (bigint): FK to seasons.id.

●	draft_id (text): Unique draft identifier.

●	status (text): Status of the conference (e.g., active, pending).

●	league_logo_url (text): URL to the league’s logo.

Constraints:
●	Primary Key: id

●	Foreign Key: season_id → seasons.id

●	Unique: league_id, draft_id

________________________________________
Table: teams
Description: Fantasy teams managed by users.
Columns:
●	id (integer): Primary key.

●	team_name (text): Name of the team.

●	owner_name (text): Team owner.

●	owner_id (text): Unique identifier.

●	co_owner_name (text): Co-owner name.

●	co_owner_id (text): Unique identifier.

●	team_logourl (text): Team logo URL.

●	team_primarycolor (text): Primary team color.

●	team_secondarycolor (text): Secondary team color.

Constraints:
●	Primary Key: id

●	Unique: owner_id, co_owner_id
________________________________________
Table: current_team_rosters
Description: Tracks current team compositions.
Columns:
●	team_id (integer): FK to teams.id.

●	sleeper_id (text): FK to players.sleeper_id.

●	conference_id (integer): FK to conferences.id.

●	is_starter (boolean): Whether the player is a starter.

Constraints:
●	Foreign Keys: team_id, sleeper_id, conference_id

________________________________________
Table: draft_results
Description: Records draft picks.
Columns:
●	id (bigint): Primary key.

●	draft_year (text): FK to seasons.season_year.

●	league_id (text): FK to conferences.league_id.

●	round (text): Draft round.

●	draft_slot (text): Draft slot.

●	pick_number (text): Overall pick number.

●	owner_id (text): FK to teams.owner_id.

●	sleeper_id (text): FK to players.sleeper_id.

Constraints:
●	Primary Key: id

●	Foreign Keys: draft_year, league_id, owner_id, sleeper_id

________________________________________
Table: matchup_admin_override
Description: Allows admins to override matchups.
Columns:
●	id (bigint): Primary key.

●	matchup_id (integer): FK to matchups.id.

●	home_team_id (integer): FK to teams.id.

●	away_team_id (integer): FK to teams.id.

●	date_overridden (timestamp): Default is now().

●	overridden_by_admin_id (text): Admin user ID.

Constraints:
●	Primary Key: id

●	Foreign Keys: matchup_id, home_team_id, away_team_id

________________________________________
Table: matchups
Description: Holds matchup data for games.
Columns:
●	id (integer): Primary key.

●	conference_id (integer): FK to conferences.id.

●	week (integer): Week number.

●	team1_id (bigint): FK to teams.id.

●	team2_id (bigint): FK to teams.id.

●	is_playoff (boolean): If the game is a playoff.

●	manual_override (boolean): If the result was manually overridden.

●	matchup_status (text): Status string.

●	notes (text): Notes or comments.

●	matchup_type (USER-DEFINED): Custom or enum type.

●	team1_score (numeric): Score of team 1.

●	team2_score (numeric): Score of team 2.

●	winning_team_id (integer): FK to teams.id.

Constraints:
●	Primary Key: id

●	Foreign Keys: conference_id, team1_id, team2_id, winning_team_id

________________________________________
Table: player_season_stats
Description: Season stats for each player.
Columns:
●	sleeper_id (text): FK to players.sleeper_id.

●	season_id (integer): FK to seasons.id.

●	total_points (integer): Default is 0.

●	avg_points (integer): Default is 0.

●	espn_id (text): External ESPN ID.

●	id (bigint): Primary key.

________________________________________
Table: players
Description: Details of players.
Columns:
●	id (integer): Primary key.

●	sleeper_id (text): Unique player ID.

●	player_name (text): Name of the player.

●	position (text): Position (QB, WR, etc.).

●	nfl_team (text): Associated NFL team.

●	number (integer): Jersey number.

●	playing_status (text): Active, bench, etc.

●	injury_status (text): Current injury status.

●	age (integer): Player age.

●	height (integer): Height in inches.

●	weight (integer): Weight in pounds.

●	depth_chart (integer): Depth chart position.

●	college (text): College attended.

●	years_exp (integer): Years of experience.
●	espn_id (integer): Espn id for player

________________________________________
Table: playoff_brackets
Description: Structure of playoff matchups.
Columns:
●	id (bigint): Primary key.

●	season_id (integer): FK to seasons.id.

●	round (integer): Playoff round.

●	team1_seed (integer): Seed of team 1.

●	team2_seed (integer): Seed of team 2.

●	team1_id (integer): FK to teams.id.

●	team2_id (integer): FK to teams.id.

●	winning_team_id (integer): FK to teams.id.

●	playoff_round_name (varchar): Name of the round.

●	is_bye (boolean): If a team had a bye.

●	matchup_number (integer): Matchup order.

●	week (integer): Week number.

●	team1_score (numeric): Score of team 1.

●	team2_score (numeric): Score of team 2.

________________________________________
Table: playoff_formats
Description: Defines playoff setup.
Columns:
●	id (bigint): Primary key.

●	season_id (integer): FK to seasons.id.

●	playoff_teams (integer): Default is 10.

●	week_14_byes (integer): Default is 6.

●	reseed (boolean): Default is true.

●	playoff_start_week (integer): Default is 14.

●	championship_week (integer): Default is 17.

●	is_active (boolean): Default is true.

●	created_at (timestamp): Creation time.

●	updated_at (timestamp): Last update.

________________________________________
Table: seasons
Description: Stores season metadata.
Columns:
●	id (integer): Primary key.
●	season_name (text): Unique season name.
●	is_current (boolean): Whether it's the current season.
●	season_year (text): Unique identifier year.
●	league_settings (jsonb): Settings for league
●	roster_positions (jsonb): Settings for roster positions
●	scoring_settings (jsonb): Settings for player scoring
●	charter_file_url (text): File URL for league charter
●	charter_file_name (text): Name of league charter
●	charter_uploaded_at (timestampz): When charter was last updated
●	charter_uploaded_by (text): Admin who updated charter


________________________________________
Table: team_conference_junction
Description: Associates teams with conferences.
Columns:
●	id (bigint): Primary key.

●	team_id (integer): FK to teams.id.

●	conference_id (integer): FK to conferences.id.

●	roster_id (integer): Possibly FK to a roster.

________________________________________
Table: team_records
Description: Seasonal records of each team.
Columns:
●	id (bigint): Primary key.
●	team_id (integer): FK to teams.id.
●	conference_id (integer): FK to conferences.id.
●	season_id (integer): FK to seasons.id.
●	wins (integer): Number of wins.
●	losses (integer): Number of losses.
●	Ties (integer): Number of ties.
●	points_for (integer): Points scored.
●	points_against (integer): Points allowed.
●	point_diff (integer): Net point difference.
●	streak (text): How many wins or losses in a row a team has
●	created_at (timestamp): Record creation time.

________________________________________
Table: team_rosters
Description: Historical weekly team rosters.
Columns:
●	id (bigint): Primary key.

●	team_id (integer): FK to teams.id.

●	sleeper_id (text): FK to players.sleeper_id.

●	season_id (integer): FK to seasons.id.

●	week (integer): Week number.

●	status (text): Player status.

●	is_starter (boolean): Starter or not.

●	inserted_at (timestamp): Timestamp of insert.

________________________________________
Table: transactions
Description: Logs league transactions.
Columns:
●	id (bigint): Primary key.

●	season_id (integer): FK to seasons.id.

●	conference_id (integer): FK to conferences.id.

●	sleeper_transaction_id (text): Unique external transaction ID.

●	type (text): Transaction type (trade, waiver, etc.).

●	data (jsonb): Transaction metadata.

●	created_at (timestamp): When the transaction was logged.

