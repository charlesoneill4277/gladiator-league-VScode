// Matchup service for handling complex data relationships and Sleeper API integration

export interface LiveMatchupData {
  id: string;
  week: number;
  conference: {
    id: number;
    name: string;
    league_id: string;
    season_id: number;
  };
  season: {
    id: number;
    year: number;
    name: string;
  };
  homeTeam: {
    id: number;
    name: string;
    owner: string;
    roster_id: string;
    score: number;
    projected: number;
    starters: PlayerInfo[];
    bench: PlayerInfo[];
  };
  awayTeam: {
    id: number;
    name: string;
    owner: string;
    roster_id: string;
    score: number;
    projected: number;
    starters: PlayerInfo[];
    bench: PlayerInfo[];
  };
  status: 'live' | 'completed' | 'upcoming';
  lastUpdate: string | null;
  isPlayoff: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
  points: number;
  projected: number;
  status: string;
  injury_status: string;
}

export interface SleeperMatchupResponse {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  players_points?: { [playerId: string]: number };
}

const STARTING_POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];

class MatchupService {
  // Table IDs - these should match your actual table IDs
  private readonly TABLE_IDS = {
    MATCHUPS: '13329',
    CONFERENCES: '12820',
    SEASONS: '12818', 
    TEAMS: '12852',
    TEAM_CONFERENCES_JUNCTION: '12853',
    PLAYERS: '12870'
  };

  // Fetch all matchups with complete data integration
  async getMatchupsForWeek(week: number, conferenceId?: number): Promise<LiveMatchupData[]> {
    try {
      console.log(`Fetching matchups for week ${week}, conference: ${conferenceId || 'all'}`);

      // 1. Fetch matchups from database
      const matchupsQuery = {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          { name: 'week', op: 'Equal', value: week }
        ]
      };

      if (conferenceId) {
        matchupsQuery.Filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data: matchupsData, error: matchupsError } = await window.ezsite.apis.tablePage(
        this.TABLE_IDS.MATCHUPS, 
        matchupsQuery
      );

      if (matchupsError) throw new Error(matchupsError);

      const matchups = matchupsData?.List || [];
      console.log(`Found ${matchups.length} matchups`);

      // 2. Process each matchup
      const liveMatchups = await Promise.all(
        matchups.map(matchup => this.processMatchup(matchup, week))
      );

      return liveMatchups.filter(matchup => matchup !== null);
    } catch (error) {
      console.error('Error fetching matchups:', error);
      throw error;
    }
  }

  // Process individual matchup with all data relationships
  private async processMatchup(matchup: any, week: number): Promise<LiveMatchupData | null> {
    try {
      console.log(`Processing matchup ID: ${matchup.id}`);

      // Fetch conference data
      const conference = await this.getConferenceData(matchup.conference_id);
      if (!conference) return null;

      // Fetch season data  
      const season = await this.getSeasonData(conference.season_id);
      if (!season) return null;

      // Fetch team data
      const [homeTeam, awayTeam] = await Promise.all([
        this.getTeamData(matchup.team_1_id, matchup.conference_id),
        this.getTeamData(matchup.team_2_id, matchup.conference_id)
      ]);

      if (!homeTeam || !awayTeam) return null;

      // Fetch Sleeper API data
      const sleeperData = await this.getSleeperMatchupData(conference.league_id, week);
      
      // Find the specific matchup data for both teams
      const homeSleeperData = sleeperData.find(data => data.roster_id.toString() === homeTeam.roster_id);
      const awaySleeperData = sleeperData.find(data => data.roster_id.toString() === awayTeam.roster_id);

      // Process player data for both teams
      const [homeTeamPlayers, awayTeamPlayers] = await Promise.all([
        this.processTeamPlayers(homeSleeperData, homeTeam.roster_id),
        this.processTeamPlayers(awaySleeperData, awayTeam.roster_id)
      ]);

      return {
        id: matchup.id.toString(),
        week,
        conference: {
          id: conference.id,
          name: conference.conference_name,
          league_id: conference.league_id,
          season_id: conference.season_id
        },
        season: {
          id: season.id,
          year: season.season_year,
          name: season.season_name
        },
        homeTeam: {
          id: homeTeam.id,
          name: homeTeam.team_name,
          owner: homeTeam.owner_name,
          roster_id: homeTeam.roster_id,
          score: homeSleeperData?.points || 0,
          projected: homeTeamPlayers.starters.reduce((sum, p) => sum + p.projected, 0),
          starters: homeTeamPlayers.starters,
          bench: homeTeamPlayers.bench
        },
        awayTeam: {
          id: awayTeam.id,
          name: awayTeam.team_name,
          owner: awayTeam.owner_name,
          roster_id: awayTeam.roster_id,
          score: awaySleeperData?.points || 0,
          projected: awayTeamPlayers.starters.reduce((sum, p) => sum + p.projected, 0),
          starters: awayTeamPlayers.starters,
          bench: awayTeamPlayers.bench
        },
        status: this.determineMatchupStatus(homeSleeperData, awaySleeperData, week),
        lastUpdate: homeSleeperData || awaySleeperData ? new Date().toISOString() : null,
        isPlayoff: matchup.is_playoff || false
      };
    } catch (error) {
      console.error(`Error processing matchup ${matchup.id}:`, error);
      return null;
    }
  }

  // Get conference data by ID
  private async getConferenceData(conferenceId: number) {
    const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.CONFERENCES, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: conferenceId }]
    });

    if (error) {
      console.error('Error fetching conference:', error);
      return null;
    }

    return data?.List?.[0] || null;
  }

  // Get season data by ID
  private async getSeasonData(seasonId: number) {
    const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.SEASONS, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: seasonId }]
    });

    if (error) {
      console.error('Error fetching season:', error);
      return null;
    }

    return data?.List?.[0] || null;
  }

  // Get team data with roster ID from junction table
  private async getTeamData(teamId: number, conferenceId: number) {
    // Get team info
    const { data: teamData, error: teamError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAMS, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: teamId }]
    });

    if (teamError || !teamData?.List?.[0]) {
      console.error('Error fetching team:', teamError);
      return null;
    }

    // Get roster ID from junction table
    const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(
      this.TABLE_IDS.TEAM_CONFERENCES_JUNCTION, 
      {
        PageNo: 1,
        PageSize: 1,
        Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'conference_id', op: 'Equal', value: conferenceId }
        ]
      }
    );

    if (junctionError || !junctionData?.List?.[0]) {
      console.error('Error fetching junction data:', junctionError);
      return null;
    }

    const team = teamData.List[0];
    const junction = junctionData.List[0];

    return {
      ...team,
      roster_id: junction.roster_id
    };
  }

  // Fetch Sleeper API matchup data
  private async getSleeperMatchupData(leagueId: string, week: number): Promise<SleeperMatchupResponse[]> {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching Sleeper matchup data:', error);
      return [];
    }
  }

  // Process team players (starters and bench)
  private async processTeamPlayers(sleeperData: SleeperMatchupResponse | undefined, rosterId: string) {
    if (!sleeperData) {
      return { starters: [], bench: [] };
    }

    const allPlayerIds = sleeperData.players || [];
    const starterIds = sleeperData.starters || [];
    const benchIds = allPlayerIds.filter(id => !starterIds.includes(id));

    // Fetch player info from database
    const [starters, bench] = await Promise.all([
      this.getPlayersInfo(starterIds, sleeperData.players_points || {}),
      this.getPlayersInfo(benchIds, sleeperData.players_points || {})
    ]);

    return { starters, bench };
  }

  // Get player information from database
  private async getPlayersInfo(playerIds: string[], playerPoints: { [key: string]: number }): Promise<PlayerInfo[]> {
    if (playerIds.length === 0) return [];

    try {
      // Fetch players in batches if needed
      const players: PlayerInfo[] = [];
      
      for (const playerId of playerIds) {
        const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYERS, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: playerId }]
        });

        if (!error && data?.List?.[0]) {
          const player = data.List[0];
          players.push({
            id: playerId,
            name: player.player_name,
            position: player.position,
            nfl_team: player.nfl_team,
            points: playerPoints[playerId] || 0,
            projected: 0, // You may want to add projected points to your database
            status: player.status,
            injury_status: player.injury_status
          });
        } else {
          // Fallback for unknown players
          players.push({
            id: playerId,
            name: `Player ${playerId}`,
            position: 'UNKNOWN',
            nfl_team: '',
            points: playerPoints[playerId] || 0,
            projected: 0,
            status: 'Active',
            injury_status: 'Healthy'
          });
        }
      }

      return players;
    } catch (error) {
      console.error('Error fetching player info:', error);
      return [];
    }
  }

  // Determine matchup status based on available data
  private determineMatchupStatus(homeData: SleeperMatchupResponse | undefined, awayData: SleeperMatchupResponse | undefined, week: number): 'live' | 'completed' | 'upcoming' {
    const currentWeek = this.getCurrentNFLWeek();
    
    if (week > currentWeek) {
      return 'upcoming';
    }
    
    if (homeData?.points || awayData?.points) {
      // If we have any points, consider it live or completed
      // You might want to add more sophisticated logic here
      return week < currentWeek ? 'completed' : 'live';
    }
    
    return 'upcoming';
  }

  // Get current NFL week (simplified - you might want to make this more sophisticated)
  private getCurrentNFLWeek(): number {
    // This is a simplified calculation - you might want to use a more accurate method
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 18);
  }

  // Get available weeks
  async getAvailableWeeks(): Promise<{ week: number; status: string }[]> {
    const currentWeek = this.getCurrentNFLWeek();
    
    return Array.from({ length: 18 }, (_, i) => ({
      week: i + 1,
      status: i + 1 < currentWeek ? 'completed' : i + 1 === currentWeek ? 'current' : 'upcoming'
    }));
  }
}

export const matchupService = new MatchupService();