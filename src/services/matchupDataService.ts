// Service for handling complex matchup data operations
export interface MatchupData {
  id: number;
  week: number;
  conference: {
    id: number;
    name: string;
    leagueId: string;
    seasonId: number;
  };
  team1: {
    id: number;
    name: string;
    ownerName: string;
    ownerId: string;
    rosterId: string;
  };
  team2: {
    id: number;
    name: string;
    ownerName: string;
    ownerId: string;
    rosterId: string;
  };
  isPlayoff: boolean;
}

export interface PlayerData {
  id: number;
  sleeperPlayerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  isStarter: boolean;
  points?: number;
}

export interface TeamRosterData {
  teamId: number;
  rosterId: string;
  totalPoints: number;
  starters: PlayerData[];
  bench: PlayerData[];
}

export interface LiveMatchupData extends MatchupData {
  team1Roster: TeamRosterData;
  team2Roster: TeamRosterData;
  status: 'upcoming' | 'live' | 'completed';
  lastUpdate?: string;
}

export class MatchupDataService {
  // Table IDs from the database schema
  private static readonly TABLE_IDS = {
    matchups: 13329,
    conferences: 12820,
    seasons: 12818,
    teams: 12852,
    teamConferencesJunction: 12853,
    players: 12870
  };

  // Standard lineup positions in order
  private static readonly STARTER_POSITIONS = [
    'QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'
  ];

  /**
   * Fetch matchups for a specific season, conference, and week
   */
  static async getMatchupsData(
    seasonId: number, 
    conferenceId?: number, 
    week?: number
  ): Promise<MatchupData[]> {
    try {
      console.log('Fetching matchups data...', { seasonId, conferenceId, week });

      // Build filters for matchups query
      const filters: any[] = [];
      if (week) {
        filters.push({ name: 'week', op: 'Equal', value: week });
      }

      // Get matchups
      const matchupsResponse = await window.ezsite.apis.tablePage(
        this.TABLE_IDS.matchups,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'week',
          IsAsc: true,
          Filters: filters
        }
      );

      if (matchupsResponse.error) {
        throw new Error(matchupsResponse.error);
      }

      const matchups = matchupsResponse.data?.List || [];
      console.log('Raw matchups:', matchups);

      // Process each matchup to get full data
      const processedMatchups: MatchupData[] = [];

      for (const matchup of matchups) {
        try {
          // Get conference data
          const conferenceResponse = await window.ezsite.apis.tablePage(
            this.TABLE_IDS.conferences,
            {
              PageNo: 1,
              PageSize: 1,
              Filters: [{ name: 'ID', op: 'Equal', value: matchup.conference_id }]
            }
          );

          if (conferenceResponse.error) {
            console.error('Error fetching conference:', conferenceResponse.error);
            continue;
          }

          const conference = conferenceResponse.data?.List[0];
          if (!conference) {
            console.error('Conference not found for ID:', matchup.conference_id);
            continue;
          }

          // Check if this conference matches the filter
          if (conferenceId && conference.ID !== conferenceId) {
            continue;
          }

          // Check if this conference belongs to the selected season
          if (conference.season_id !== seasonId) {
            continue;
          }

          // Get team 1 data
          const team1Response = await window.ezsite.apis.tablePage(
            this.TABLE_IDS.teams,
            {
              PageNo: 1,
              PageSize: 1,
              Filters: [{ name: 'ID', op: 'Equal', value: matchup.team_1_id }]
            }
          );

          // Get team 2 data
          const team2Response = await window.ezsite.apis.tablePage(
            this.TABLE_IDS.teams,
            {
              PageNo: 1,
              PageSize: 1,
              Filters: [{ name: 'ID', op: 'Equal', value: matchup.team_2_id }]
            }
          );

          if (team1Response.error || team2Response.error) {
            console.error('Error fetching teams:', team1Response.error, team2Response.error);
            continue;
          }

          const team1 = team1Response.data?.List[0];
          const team2 = team2Response.data?.List[0];

          if (!team1 || !team2) {
            console.error('Teams not found:', { team1, team2 });
            continue;
          }

          // Get roster IDs for both teams
          const team1JunctionResponse = await window.ezsite.apis.tablePage(
            this.TABLE_IDS.teamConferencesJunction,
            {
              PageNo: 1,
              PageSize: 1,
              Filters: [
                { name: 'team_id', op: 'Equal', value: team1.ID },
                { name: 'conference_id', op: 'Equal', value: conference.ID }
              ]
            }
          );

          const team2JunctionResponse = await window.ezsite.apis.tablePage(
            this.TABLE_IDS.teamConferencesJunction,
            {
              PageNo: 1,
              PageSize: 1,
              Filters: [
                { name: 'team_id', op: 'Equal', value: team2.ID },
                { name: 'conference_id', op: 'Equal', value: conference.ID }
              ]
            }
          );

          if (team1JunctionResponse.error || team2JunctionResponse.error) {
            console.error('Error fetching team junction data:', team1JunctionResponse.error, team2JunctionResponse.error);
            continue;
          }

          const team1Junction = team1JunctionResponse.data?.List[0];
          const team2Junction = team2JunctionResponse.data?.List[0];

          if (!team1Junction || !team2Junction) {
            console.error('Team junction data not found');
            continue;
          }

          // Build the complete matchup data
          const processedMatchup: MatchupData = {
            id: matchup.ID,
            week: matchup.week,
            conference: {
              id: conference.ID,
              name: conference.conference_name,
              leagueId: conference.league_id,
              seasonId: conference.season_id
            },
            team1: {
              id: team1.ID,
              name: team1.team_name,
              ownerName: team1.owner_name,
              ownerId: team1.owner_id,
              rosterId: team1Junction.roster_id
            },
            team2: {
              id: team2.ID,
              name: team2.team_name,
              ownerName: team2.owner_name,
              ownerId: team2.owner_id,
              rosterId: team2Junction.roster_id
            },
            isPlayoff: matchup.is_playoff || false
          };

          processedMatchups.push(processedMatchup);
        } catch (error) {
          console.error('Error processing matchup:', error);
          continue;
        }
      }

      console.log('Processed matchups:', processedMatchups);
      return processedMatchups;
    } catch (error) {
      console.error('Error in getMatchupsData:', error);
      throw error;
    }
  }

  /**
   * Fetch live data from Sleeper API for a specific matchup
   */
  static async getLiveMatchupData(matchupData: MatchupData): Promise<LiveMatchupData> {
    try {
      console.log('Fetching live data for matchup:', matchupData);

      // Fetch data from Sleeper API
      const sleeperResponse = await fetch(
        `https://api.sleeper.app/v1/league/${matchupData.conference.leagueId}/matchups/${matchupData.week}`
      );

      if (!sleeperResponse.ok) {
        throw new Error(`Sleeper API error: ${sleeperResponse.status}`);
      }

      const sleeperData = await sleeperResponse.json();
      console.log('Sleeper API response:', sleeperData);

      // Find data for both teams by roster_id
      const team1SleeperData = sleeperData.find((data: any) => 
        data.roster_id.toString() === matchupData.team1.rosterId.toString()
      );
      const team2SleeperData = sleeperData.find((data: any) => 
        data.roster_id.toString() === matchupData.team2.rosterId.toString()
      );

      if (!team1SleeperData || !team2SleeperData) {
        console.error('Sleeper data not found for teams', { 
          team1RosterId: matchupData.team1.rosterId, 
          team2RosterId: matchupData.team2.rosterId,
          availableRosterIds: sleeperData.map((d: any) => d.roster_id)
        });
        throw new Error('Sleeper data not found for one or both teams');
      }

      // Process roster data for both teams
      const team1Roster = await this.processTeamRosterData(
        matchupData.team1.id,
        matchupData.team1.rosterId,
        team1SleeperData
      );

      const team2Roster = await this.processTeamRosterData(
        matchupData.team2.id,
        matchupData.team2.rosterId,
        team2SleeperData
      );

      // Determine matchup status
      const status = this.determineMatchupStatus(team1SleeperData, team2SleeperData);

      const liveMatchupData: LiveMatchupData = {
        ...matchupData,
        team1Roster,
        team2Roster,
        status,
        lastUpdate: new Date().toISOString()
      };

      console.log('Complete live matchup data:', liveMatchupData);
      return liveMatchupData;
    } catch (error) {
      console.error('Error in getLiveMatchupData:', error);
      throw error;
    }
  }

  /**
   * Process team roster data from Sleeper API
   */
  private static async processTeamRosterData(
    teamId: number,
    rosterId: string,
    sleeperTeamData: any
  ): Promise<TeamRosterData> {
    try {
      const { starters = [], players = [], points = 0, players_points = {} } = sleeperTeamData;

      // Get all players for this team from the database
      const playersResponse = await window.ezsite.apis.tablePage(
        this.TABLE_IDS.players,
        {
          PageNo: 1,
          PageSize: 100,
          Filters: [{ name: 'team_id', op: 'Equal', value: teamId }]
        }
      );

      if (playersResponse.error) {
        throw new Error(playersResponse.error);
      }

      const dbPlayers = playersResponse.data?.List || [];
      console.log('DB players for team', teamId, ':', dbPlayers);

      // Create lookup map for DB players by sleeper_player_id
      const playerLookup = new Map();
      dbPlayers.forEach((player: any) => {
        playerLookup.set(player.sleeper_player_id, player);
      });

      // Process starters
      const starterData: PlayerData[] = [];
      starters.forEach((sleeperPlayerId: string, index: number) => {
        const dbPlayer = playerLookup.get(sleeperPlayerId);
        if (dbPlayer) {
          starterData.push({
            id: dbPlayer.ID,
            sleeperPlayerId,
            playerName: dbPlayer.player_name,
            position: dbPlayer.position,
            nflTeam: dbPlayer.nfl_team,
            isStarter: true,
            points: players_points[sleeperPlayerId] || 0
          });
        } else {
          // Handle case where player is not in our DB yet
          starterData.push({
            id: 0,
            sleeperPlayerId,
            playerName: `Player ${sleeperPlayerId}`,
            position: 'UNKNOWN',
            nflTeam: '',
            isStarter: true,
            points: players_points[sleeperPlayerId] || 0
          });
        }
      });

      // Process bench players (players not in starters)
      const benchData: PlayerData[] = [];
      players.forEach((sleeperPlayerId: string) => {
        if (!starters.includes(sleeperPlayerId)) {
          const dbPlayer = playerLookup.get(sleeperPlayerId);
          if (dbPlayer) {
            benchData.push({
              id: dbPlayer.ID,
              sleeperPlayerId,
              playerName: dbPlayer.player_name,
              position: dbPlayer.position,
              nflTeam: dbPlayer.nfl_team,
              isStarter: false,
              points: players_points[sleeperPlayerId] || 0
            });
          } else {
            benchData.push({
              id: 0,
              sleeperPlayerId,
              playerName: `Player ${sleeperPlayerId}`,
              position: 'UNKNOWN',
              nflTeam: '',
              isStarter: false,
              points: players_points[sleeperPlayerId] || 0
            });
          }
        }
      });

      return {
        teamId,
        rosterId,
        totalPoints: points,
        starters: starterData,
        bench: benchData
      };
    } catch (error) {
      console.error('Error processing team roster data:', error);
      throw error;
    }
  }

  /**
   * Determine matchup status based on Sleeper data
   */
  private static determineMatchupStatus(team1Data: any, team2Data: any): 'upcoming' | 'live' | 'completed' {
    const team1Points = team1Data.points || 0;
    const team2Points = team2Data.points || 0;

    // If both teams have 0 points, it's likely upcoming
    if (team1Points === 0 && team2Points === 0) {
      return 'upcoming';
    }

    // Check if games are still ongoing by looking at current NFL week
    // For now, we'll assume if there are points, it's either live or completed
    // This could be enhanced with more sophisticated logic
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentDay = currentTime.getDay(); // 0 = Sunday

    // Simple heuristic: if it's Sunday between 1 PM and 11 PM, games might be live
    if (currentDay === 0 && currentHour >= 13 && currentHour <= 23) {
      return 'live';
    }

    // If we have points but it's not game time, assume completed
    if (team1Points > 0 || team2Points > 0) {
      return 'completed';
    }

    return 'upcoming';
  }

  /**
   * Get all weeks for a season
   */
  static getWeeksForSeason(): Array<{ week: number; status: string }> {
    // Generate weeks 1-17 for NFL season
    return Array.from({ length: 17 }, (_, i) => {
      const week = i + 1;
      const currentTime = new Date();
      const currentMonth = currentTime.getMonth(); // 0-11
      
      // Simple logic to determine current week (this could be enhanced)
      let currentWeek = 1;
      if (currentMonth >= 8) { // September onwards
        currentWeek = Math.min(17, Math.floor((currentTime.getDate() - 1) / 7) + 1);
      }

      return {
        week,
        status: week < currentWeek ? 'completed' : week === currentWeek ? 'current' : 'upcoming'
      };
    });
  }
}

export default MatchupDataService;