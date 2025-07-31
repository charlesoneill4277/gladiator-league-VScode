Below is a comprehensive document covering all Sleeper API request URLs, with detailed endpoint descriptions, example JSON responses, and explanations for each response object. This guide is organized by functional area, ensuring you have clarity on every API call available in the Sleeper platform. 
________________________________________
Sleeper API Endpoint Reference
Introduction & General Guidelines
________________________________________
User Endpoints
1. Get User by Username or User ID
Request URL: 
GET https://api.sleeper.app/v1/user/<username>
GET https://api.sleeper.app/v1/user/<user_id>
Description: Fetches a user object via either the user’s username or their user ID. The user ID is preferable for long-term storage, as usernames may change. Example JSON Response: 
{
  "user_id": "123456789",
  "username": "john_doe",
  "display_name": "John D",
  "avatar": "avatar_id",
  "metadata": {}
}
Object Description: A user object, with unique user ID, username, display name, avatar ID, and metadata. 
________________________________________
Avatars
2. Get Avatar Image URL
Request URLs: `https://sleepercdn.com/avatars/` `https://sleepercdn.com/avatars/thumbs/` Description: Fetches a user’s or league’s avatar image (in full size or thumbnail). 
________________________________________
Leagues Endpoints
3. Get All Leagues for a User
Request URL: 
GET https://api.sleeper.app/v1/user/<user_id>/leagues/nfl/<season>
Description: Returns a list of leagues the specified user participates in for a given season. Example JSON Response: 
[
  {
    "league_id": "987654321",
    "name": "Main Fantasy League",
    "season": "2024",
    "sport": "nfl"
  }
]
Object Description: An array of league objects for the given user and season. 
________________________________________
4. Get a Specific League
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>
Description: Retrieves all data for a given league. Example JSON Response: 
{
  "league_id": "987654321",
  "name": "Main Fantasy League",
  "season": "2024",
  "settings": { ... }
}
Object Description: A detailed league object, with settings and identifying information. 
________________________________________
5. Get All Rosters in a League
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/rosters
Description: Returns all roster details for the league. Example JSON Response: 
[
  {
    "roster_id": 1,
    "player_ids": ["1042", "2403"],
    "owner_id": "123456789"
  }
]
Object Description: List of roster objects, including roster ID, player IDs, and owner ID. 
________________________________________
6. Get All Users in a League
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/users
Description: Lists all users in the league, including display names and avatar information. Example JSON Response: 
[
  {
    "user_id": "123456789",
    "display_name": "John D",
    "avatar": "avatar_id",
    "metadata": {}
  }
]
Object Description: Array of user objects as described under User Endpoints. 
________________________________________
7. Get All Matchups in a League (For a Specific Week)
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/matchups/<week>
Description: Returns matchup objects for all teams in a specified week. Example JSON Response: 
[
  {
    "matchup_id": 1,
    "roster_id": 1,
    "starters": ["1042", "2403"],
    "players": ["1042", "2403", "3024"]
  }
]
Object Description: Array of matchup objects, showing starters and full player pool per team. 
________________________________________
8. Get Playoff Bracket (Winners and Losers)
Request URLs: 
GET https://api.sleeper.app/v1/league/<league_id>/winners_bracket
GET https://api.sleeper.app/v1/league/<league_id>/losers_bracket
Description: Returns the structure and results (if available) for playoff matchups. Example JSON Response: 
[
  {
    "r": 1,
    "m": 1,
    "t1": 2,
    "t2": 3,
    "w": 2,
    "l": 3,
    "t1_from": {"winner_of": 1},
    "t2_from": {"loser_of": 1}
  }
]
Object Description: Each object details a playoff matchup, including round, match ID, team IDs, winners, losers, and progression. 
________________________________________
9. Get Transactions (Waivers/Trades/Free Agent Moves)
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/transactions/<round>
Description: Returns all league transactions from a particular round/week. Example JSON Response: 
[
  {
    "transaction_id": "1",
    "type": "waiver",
    "status": "complete"
  }
]
Object Description: List of transaction objects with details about type and status. 
________________________________________
10. Get Traded Picks in a League
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/traded_picks
Description: Retrieves all traded draft picks in a league, including future picks. Example JSON Response: 
[
  {
    "season": "2024",
    "round": 1,
    "roster_id": 2,
    "owner_id": "123456789"
  }
]
Object Description: Array of traded pick objects, specifying season, round, roster, and owner. 
________________________________________
11. Get NFL State
Request URL: 
GET https://api.sleeper.app/v1/state/nfl
Description: Returns details about the state of the NFL (e.g., season progress, week, etc.). Example JSON Response: 
{
  "season": "2024",
  "week": 3,
  "leg": "regular"
}
Object Description: Object indicating current season, week, and league phase. 
________________________________________
Drafts Endpoints
12. Get All Drafts for a User
Request URL: 
GET https://api.sleeper.app/v1/user/<user_id>/drafts/nfl/<season>
Description: Returns all draft objects for the given user and season. Example JSON Response: 
[
  {
    "draft_id": "444",
    "season": "2024",
    "league_id": "987654321"
  }
]
Object Description: List of draft objects owned by the user. 
________________________________________
13. Get All Drafts for a League
Request URL: 
GET https://api.sleeper.app/v1/league/<league_id>/drafts
Description: Lists all drafts associated with a league (useful for dynasty leagues). Example JSON Response: 
[
  {
    "draft_id": "555",
    "season": "2024"
  }
]
Object Description: Array of draft objects belonging to the league. 
________________________________________
14. Get a Specific Draft
Request URL: 
GET https://api.sleeper.app/v1/draft/<draft_id>
Description: Fetches detailed information about a specific draft. Example JSON Response: 
{
  "draft_id": "555",
  "settings": { ... }
}
Object Description: A single draft object with configurations and IDs. 
________________________________________
15. Get All Picks in a Draft
Request URL: 
GET https://api.sleeper.app/v1/draft/<draft_id>/picks
Description: Returns all picks for a specific draft. Example JSON Response: 
[
  {
    "pick_id": 1,
    "player_id": "1042",
    "roster_id": 2
  }
]
Object Description: Array of pick objects, including pick number, player, and roster assigned. 
________________________________________
16. Get Traded Picks in a Draft
Request URL: 
GET https://api.sleeper.app/v1/draft/<draft_id>/traded_picks
Description: Lists all picks that have been traded within that draft. Example JSON Response: 
[
  {
    "pick_id": 3,
    "original_owner_id": "987654321",
    "current_owner_id": "123456789"
  }
]
Object Description: Array of objects describing traded picks during the draft. 
________________________________________
Players Endpoints
17. Fetch All Players
Request URL: 
GET https://api.sleeper.app/v1/players/nfl
Description: Returns a large JSON object mapping player IDs to player details (5MB+ file). Use this to map roster and pick IDs to real player info. Recommendation: Call this once per day and cache it locally. Example JSON Response: 
{
  "1042": { "player_id": "1042", "first_name": "Patrick", "last_name": "Mahomes" }
}
Object Description: Key-value map of player IDs to player details. 
________________________________________
18. Get Trending Players (by Add/Drop)
Request URL: 
GET https://api.sleeper.app/v1/players/<sport>/trending/<type>?lookback_hours=<hours>&limit=<int>
Description: Provides a list of players trending in adds or drops over a specified timeframe. Example JSON Response: 
[
  {
    "player_id": "1042",
    "count": 124
  }
]
Object Description: List of player objects with associated add/drop counts, showing activity trends. 
________________________________________
19. Get NFL Player Information
Request URL:
GET
https://api.sleeper.app/players/nfl/<player id>
Description: Provides information about a specific player in the NFL.
Example JSON Response: 
{
  "years_exp": 20,
  "injury_status": null,
  "team_abbr": null,
  "team": "PIT",
  "birth_country": null,
  "birth_city": null,
  "fantasy_positions": [
    "QB"
  ],
  "team_changed_at": null,
  "injury_notes": null,
  "metadata": {
    "channel_id": "1113708741519241216",
    "rookie_year": "2005"
  },
  "active": true,
  "gsis_id": "00-0023459",
  "pandascore_id": null,
  "weight": "223",
  "practice_participation": null,
  "opta_id": null,
  "espn_id": 8439,
  "injury_body_part": null,
  "status": "Active",
  "number": 8,
  "swish_id": 213957,
  "rotowire_id": 4307,
  "height": "74",
  "player_id": "96",
  "birth_state": null,
  "age": 41,
  "high_school": "Pleasant Valley (CA)",
  "depth_chart_order": 1,
  "first_name": "Aaron",
  "injury_start_date": null,
  "birth_date": "1983-12-02",
  "search_rank": 188,
  "news_updated": 1751072130520,
  "college": "California",
  "last_name": "Rodgers",
  "fantasy_data_id": 2593,
  "position": "QB",
  "yahoo_id": 7200,
  "stats_id": 213957,
  "practice_description": null,
  "sport": "nfl",
  "sportradar_id": "0ce48193-e2fa-466e-a986-33f751add206",
  "depth_chart_position": "QB",
  "rotoworld_id": 3118,
  "oddsjam_id": "16E7FD97D946",
  "competitions": []
}
Object Description: List of player details 
________________________________________
20. Get NFL player research
Request URL: 
GET https://api.sleeper.app/players/nfl/research/<regular or post>/<year>/<week>
Description: Provides ownership and starter % information for NFL players in a specific season and week.
Example JSON Response: 
{
  "8842": {
    "owned": 1.3
  },
  "1875": {
    "owned": 16.4,
    "started": 8.8
  },
  "11533": {
    "owned": 96.7,
    "started": 93.7
  }
}
Object Description: Key-value map of player IDs to player owned and started percentages. ________________________________________
21. Get NFL Player Season Stats
Request URL: 
GET https://api.sleeper.app/stats/nfl/player/<player id>?season_type=<regular or post>&season=<season>

Description: A list of seasonal stats for a specific player in a specific season.
Example JSON Response: 
type PlayerStats struct {
	Date  any `json:"date"`
	Stats struct {
		BonusPassCmp25 float64 `json:"bonus_pass_cmp_25"`
		BonusPassYd300 float64 `json:"bonus_pass_yd_300"`
		BonusRecWr     float64 `json:"bonus_rec_wr"`
		BonusSack2P    float64 `json:"bonus_sack_2p"`
		BonusTkl10P    float64 `json:"bonus_tkl_10p"`
		CmpPct         float64 `json:"cmp_pct"`
		DefSnp         float64 `json:"def_snp"`
		Fga            float64 `json:"fga"`
		Fgm2029        float64 `json:"fgm_20_29"`
		Fgm3039        float64 `json:"fgm_30_39"`
		Fgm4049        float64 `json:"fgm_40_49"`
		Fgm50P         float64 `json:"fgm_50p"`
		Fgm            float64 `json:"fgm"`
		Fgmiss3039     float64 `json:"fgmiss_30_39"`
		Fgmiss4049     float64 `json:"fgmiss_40_49"`
		Fgmiss50P      float64 `json:"fgmiss_50p"`
		Fgmiss         float64 `json:"fgmiss"`
		FgmLng         float64 `json:"fgm_lng"`
		FgmPct         float64 `json:"fgm_pct"`
		FgmYds         float64 `json:"fgm_yds"`
		FgmYdsOver30   float64 `json:"fgm_yds_over_30"`
		Fum            float64 `json:"fum"`
		FumLost        float64 `json:"fum_lost"`
		GmsActive      float64 `json:"gms_active"`
		Gp             float64 `json:"gp"`
		Gs             float64 `json:"gs"`
		IdpFf          float64 `json:"idp_ff"`
		IdpFumRec      float64 `json:"idp_fum_rec"`
		IdpFumRetYd    float64 `json:"idp_fum_ret_yd"`
		IdpInt         float64 `json:"idp_int"`
		IdpIntRetYd    float64 `json:"idp_int_ret_yd"`
		IdpPassDef     float64 `json:"idp_pass_def"`
		IdpQbHit       float64 `json:"idp_qb_hit"`
		IdpSack        float64 `json:"idp_sack"`
		IdpSackYd      float64 `json:"idp_sack_yd"`
		IdpTklAst      float64 `json:"idp_tkl_ast"`
		IdpTkl         float64 `json:"idp_tkl"`
		IdpTklLoss     float64 `json:"idp_tkl_loss"`
		IdpTklSolo     float64 `json:"idp_tkl_solo"`
		OffSnp         float64 `json:"off_snp"`
		PassAirYd      float64 `json:"pass_air_yd"`
		PassAtt        float64 `json:"pass_att"`
		PassCmp40P     float64 `json:"pass_cmp_40p"`
		PassCmp        float64 `json:"pass_cmp"`
		PassFd         float64 `json:"pass_fd"`
		PassInc        float64 `json:"pass_inc"`
		PassInt        float64 `json:"pass_int"`
		PassIntTd      float64 `json:"pass_int_td"`
		PassLng        float64 `json:"pass_lng"`
		PassRtg        float64 `json:"pass_rtg"`
		PassRushYd     float64 `json:"pass_rush_yd"`
		PassRzAtt      float64 `json:"pass_rz_att"`
		PassSack       float64 `json:"pass_sack"`
		PassSackYds    float64 `json:"pass_sack_yds"`
		PassTd40P      float64 `json:"pass_td_40p"`
		PassTd         float64 `json:"pass_td"`
		PassTdLng      float64 `json:"pass_td_lng"`
		PassYd         float64 `json:"pass_yd"`
		PassYpa        float64 `json:"pass_ypa"`
		PassYpc        float64 `json:"pass_ypc"`
		Penalty        float64 `json:"penalty"`
		PenaltyYd      float64 `json:"penalty_yd"`
		PosRankHalfPpr int     `json:"pos_rank_half_ppr"`
		PosRankPpr     int     `json:"pos_rank_ppr"`
		PosRankStd     int     `json:"pos_rank_std"`
		PtsHalfPpr     float64 `json:"pts_half_ppr"`
		PtsPpr         float64 `json:"pts_ppr"`
		PtsStd         float64 `json:"pts_std"`
		PuntIn20       float64 `json:"punt_in_20"`
		PuntNetYd      float64 `json:"punt_net_yd"`
		Punts          float64 `json:"punts"`
		PuntTb         float64 `json:"punt_tb"`
		PuntYds        float64 `json:"punt_yds"`
		RankHalfPpr    int     `json:"rank_half_ppr"`
		RankPpr        int     `json:"rank_ppr"`
		RankStd        int     `json:"rank_std"`
		Rec04          float64 `json:"rec_0_4"`
		Rec1019        float64 `json:"rec_10_19"`
		Rec2029        float64 `json:"rec_20_29"`
		Rec3039        float64 `json:"rec_30_39"`
		Rec40P         float64 `json:"rec_40p"`
		Rec59          float64 `json:"rec_5_9"`
		RecAirYd       float64 `json:"rec_air_yd"`
		RecDrop        float64 `json:"rec_drop"`
		RecFd          float64 `json:"rec_fd"`
		Rec            float64 `json:"rec"`
		RecLng         float64 `json:"rec_lng"`
		RecTd40P       float64 `json:"rec_td_40p"`
		RecTd          float64 `json:"rec_td"`
		RecTdLng       float64 `json:"rec_td_lng"`
		RecTgt         float64 `json:"rec_tgt"`
		RecYar         float64 `json:"rec_yar"`
		RecYd          float64 `json:"rec_yd"`
		RecYpr         float64 `json:"rec_ypr"`
		RecYpt         float64 `json:"rec_ypt"`
		RushAtt        float64 `json:"rush_att"`
		RushBtkl       float64 `json:"rush_btkl"`
		RushFd         float64 `json:"rush_fd"`
		RushLng        float64 `json:"rush_lng"`
		RushRecYd      float64 `json:"rush_rec_yd"`
		RushRzAtt      float64 `json:"rush_rz_att"`
		RushTd         float64 `json:"rush_td"`
		RushTdLng      float64 `json:"rush_td_lng"`
		RushTklLoss    float64 `json:"rush_tkl_loss"`
		RushTklLossYd  float64 `json:"rush_tkl_loss_yd"`
		RushYac        float64 `json:"rush_yac"`
		RushYd         float64 `json:"rush_yd"`
		RushYpa        float64 `json:"rush_ypa"`
		SackYd         float64 `json:"sack_yd"`
		Snp            float64 `json:"snp"`
		StSnp          float64 `json:"st_snp"`
		StTklSolo      float64 `json:"st_tkl_solo"`
		TmDefSnp       float64 `json:"tm_def_snp"`
		TmOffSnp       float64 `json:"tm_off_snp"`
		TmStSnp        float64 `json:"tm_st_snp"`
		Xpa            float64 `json:"xpa"`
		Xpm            float64 `json:"xpm"`
	} `json:"stats"`
	Category     string `json:"category"`
	LastModified any    `json:"last_modified"`
	Week         any    `json:"week"`
	Season       string `json:"season"`
	SeasonType   string `json:"season_type"`
	Sport        string `json:"sport"`
	PlayerID     string `json:"player_id"`
	GameID       string `json:"game_id"`
	UpdatedAt    any    `json:"updated_at"`
	Team         string `json:"team"`
	Company      string `json:"company"`
	Opponent     any    `json:"opponent"`
	Player       Player `json:"player"`
}
Object Description: List of player stats for a specific season.
________________________________________
22. Get NFL Player Projections
Request URL: 
GET https://api.sleeper.app/projections/nfl/<season>/<week>?season_type=regular&position[]=FLEX&position[]=QB&position[]=RB&position[]=TE&position[]=WR
Description: Provides a list of players trending in adds or drops over a specified timeframe. Example JSON Response: 
[
  {
    "status": null,
    "date": "2024-09-08",
    "stats": {
      "adp_dd_ppr": 237,
      "bonus_rec_te": 1.29,
      "gp": 1,
      "pos_adp_dd_ppr": 46,
      "pts_half_ppr": 2.64,
      "pts_ppr": 3.28,
      "pts_std": 1.99,
      "rec": 1.29,
      "rec_0_4": 0.26,
      "rec_10_19": 0.39,
      "rec_20_29": 0.26,
      "rec_30_39": 0.13,
      "rec_40p": 0.13,
      "rec_5_9": 0.26,
      "rec_fd": 1.32,
      "rec_td": 0.11,
      "rec_tgt": 1.9,
      "rec_yd": 13.21
    },
    "category": "proj",
    "last_modified": 1725939916451,
    "week": 1,
    "season": "2024",
    "season_type": "regular",
    "sport": "nfl",
    "player_id": "10212",
    "game_id": "202410106",
    "updated_at": 1725939916451,
    "team": "TEN",
    "company": "rotowire",
    "opponent": "CHI",
    "player": {
      "fantasy_positions": [
        "TE"
      ],
      "first_name": "Josh",
      "injury_body_part": null,
      "injury_notes": null,
      "injury_start_date": null,
      "injury_status": null,
      "last_name": "Whyle",
      "metadata": {
        "channel_id": "1113708832116207616",
        "rookie_year": "2023"
      },
      "news_updated": 1752108913309,
      "position": "TE",
      "team": "TEN",
      "team_abbr": null,
      "team_changed_at": null,
      "years_exp": 2
    }
  }
}
Object Description: List of player objects with point projections.
________________________________________
23. Get NFL Schedule
Request URL: 
GET https://api.sleeper.app/schedule/nfl/<regular or post>/<year> 
Description: Provides the NFL schedule for a specific season in either regular or post season.
Example JSON Response: 
[
  {
    "status": "pre_game",
    "date": "2025-09-07",
    "home": "ATL",
    "week": 1,
    "game_id": "202510102",
    "away": "TB"
  },
{
    "status": "complete",
    "date": "2024-09-08",
    "home": "ATL",
    "week": 1,
    "game_id": "202410102",
    "away": "PIT"
  }
]
Object Description: List of NFL games by season.
________________________________________
24. Get NFL Team Depth Chart
Request URL: 
GET https://api.sleeper.app/players/nfl/<team>/depth_chart
Description: Provides a list of positions and player’s position on the depth chart for each position.
Example JSON Response: 
{
  "DB": [
    "12979",
    "11801",
    "12115",
    "12980",
    "12726",
    "12977",
    "6284",
    "8726"
  ],
  "DL": [
    "11972",
    "12229",
    "13163",
    "10989"
  ],
  "FS": [
    "4056",
    "12654"
  ],
  "K": [
    "12713",
    "8670"
  ],
  "LB": [
    "12978",
    "12970"
  ],
  "LCB": [
    "5054",
    "11027"
  ],
  "LDE": [
    "10904",
    "8914"
  ],
  "LILB": [
    "7921",
    "8680",
    "10926"
  ],
  "LOLB": [
    "5030",
    "12677"
  ],
  "LS": [
    "12727"
  ],
  "NB": [
    "8359",
    "11033"
  ],
  "NT": [
    "7664",
    "7756"
  ],
  "OL": [
    "7123",
    "11444",
    "12592",
    "12728",
    "8802",
    "12570",
    "8594",
    "11745",
    "5855",
    "8787",
    "11711",
    "2098",
    "8482",
    "8448",
    "10951",
    "13204",
    "12968"
  ],
  "P": [
    "11007"
  ],
  "QB": [
    "11564",
    "4179",
    "13065"
  ],
  "RB": [
    "12529",
    "7611",
    "6945",
    "12969",
    "12412"
  ],
  "RCB": [
    "10881",
    "11809",
    "12182"
  ],
  "RDE": [
    "7696",
    "12587"
  ],
  "RILB": [
    "5726",
    "6179",
    "7683"
  ],
  "ROLB": [
    "6848",
    "6800",
    "11319"
  ],
  "SS": [
    "6872",
    "7058"
  ],
  "TE": [
    "3214",
    "3202",
    "11605",
    "8840",
    "12984",
    "12981",
    "7131",
    "12045"
  ],
  "WR1": [
    "2449",
    "12547",
    "11619"
  ],
  "WR2": [
    "9501",
    "4454",
    "12383",
    "11645",
    "12542"
  ],
  "WR3": [
    "9504",
    "4177"
  ]
}
Object Description: Key-value map of positions to players on depth chart for specific team.
________________________________________
25. Get NFL Player Season Stats By Week
Request URL: 
GET https://api.sleeper.app/stats/nfl/player/<player id>?season_type=<regular or post>&season=<season>&grouping=week 
Description: A list of seasonal stats for a specific player in a specific season broken down week by week like a player’s game log for the season.
Example JSON Response: 
{
  "1": {
    "status": null,
    "date": "2024-09-09",
    "stats": {
      "rush_lng": -1,
      "pass_int": 1,
      "pass_air_yd": 74,
      "pos_rank_std": 26,
      "gp": 1,
      "tm_def_snp": 72,
      "gms_active": 1,
      "pass_sack_yds": 5,
      "pos_rank_half_ppr": 26,
      "pass_ypc": 12.85,
      "pass_lng": 36,
      "pass_rush_yd": 166,
      "pts_std": 9.58,
      "tm_st_snp": 26,
      "pass_rtg": 82.8,
      "pass_att": 21,
      "rush_att": 1,
      "pass_rz_att": 3,
      "rush_ypa": -1,
      "gs": 1,
      "tm_off_snp": 51,
      "pos_rank_ppr": 26,
      "pass_sack": 1,
      "off_snp": 38,
      "pass_cmp": 13,
      "cmp_pct": 61.91,
      "pts_half_ppr": 9.58,
      "pass_ypa": 7.95,
      "pass_fd": 7,
      "pass_yd": 167,
      "rush_rec_yd": -1,
      "pass_td": 1,
      "bonus_fd_qb": 7,
      "rush_yd": -1,
      "pass_td_lng": 36,
      "pts_ppr": 9.58,
      "pass_inc": 8
    },
    "category": "stat",
    "last_modified": 1725984560159,
    "week": 1,
    "sport": "nfl",
    "season_type": "regular",
    "season": "2024",
    "player_id": "96",
    "game_id": "202410131",
    "updated_at": 1725984560159,
    "team": "NYJ",
    "company": "sportradar",
    "opponent": "SF"
  },
"10": {
    "status": null,
    "date": "2024-11-10",
    "stats": {
      "rush_lng": 11,
      "pos_rank_std": 22,
      "gp": 1,
      "tm_def_snp": 60,
      "gms_active": 1,
      "rec_ypt": 12,
      "pos_rank_half_ppr": 24,
      "idp_tkl": 1,
      "pass_rush_yd": 66,
      "pts_std": 7.8,
      "rec_lng": 12,
      "tm_st_snp": 28,
      "rush_fd": 4,
      "idp_tkl_solo": 1,
      "rec": 1,
      "rec_yar": 21,
      "rec_fd": 1,
      "rush_att": 14,
      "rush_ypa": 4.71,
      "gs": 1,
      "tm_off_snp": 68,
      "pos_rank_ppr": 27,
      "rec_rz_tgt": 1,
      "off_snp": 35,
      "rush_yac": 21,
      "pts_half_ppr": 8.3,
      "rec_air_yd": -9,
      "rec_ypr": 12,
      "rec_10_19": 1,
      "rush_rz_att": 2,
      "rush_rec_yd": 78,
      "rush_yd": 66,
      "bonus_rec_rb": 1,
      "rec_tgt": 1,
      "pts_ppr": 8.8,
      "rec_yd": 12,
      "bonus_fd_rb": 5
    },
    "category": "stat",
    "last_modified": 1731366532816,
    "week": 10,
    "season": "2024",
    "season_type": "regular",
    "sport": "nfl",
    "player_id": "4866",
    "game_id": "202411009",
    "updated_at": 1731366532816,
    "team": "PHI",
    "company": "sportradar",
    "opponent": "DAL"
  },
}

Object Description: Key-Value map of weeks of the season to player weekly stats.
________________________________________
Errors and Codes
Common API Error Codes: 

400	Bad Request -- Your request is invalid.
404	Not Found -- The specified kitten could not be found.
429	Too Many Requests -- You're requesting too many kittens! Slow down!
500	Internal Server Error -- We had a problem with our server. Try again later.
503	Service Unavailable -- We're temporarily offline for maintenance. Please try again later.

________________________________________
Summary
This document gives you a full reference to all available Sleeper API endpoints, the shape of the returned data, and clear description of every object you’ll encounter. This is your complete guide to interacting with the Sleeper fantasy sports platform programmatically. 
