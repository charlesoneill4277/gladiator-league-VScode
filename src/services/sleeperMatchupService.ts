interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  players_points?: {[key: string]: number;};
}

interface SleeperPlayerData {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  status: string;
  injury_status: string;
  number: number;
  age: number;
  height: string;
  weight: number;
  years_exp: number;
  college: string;
}

class SleeperMatchupService {
  private static instance: SleeperMatchupService;

  public static getInstance(): SleeperMatchupService {
    if (!SleeperMatchupService.instance) {
      SleeperMatchupService.instance = new SleeperMatchupService();
    }
    return SleeperMatchupService.instance;
  }

  /**
   * Fetch matchup data from Sleeper API for a specific league and week
   */
  async getMatchupData(leagueId: string, week: number): Promise<SleeperMatchupData[]> {
    try {
      console.log(`Fetching matchup data for league ${leagueId}, week ${week}`);

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Retrieved ${data.length} matchup entries for week ${week}`);

      return data;
    } catch (error) {
      console.error('Error fetching Sleeper matchup data:', error);
      throw error;
    }
  }

  /**
   * Fetch all NFL players data from Sleeper API
   */
  async getAllPlayersData(): Promise<{[key: string]: SleeperPlayerData;}> {
    try {
      console.log('Fetching all players data from Sleeper');

      const response = await fetch('https://api.sleeper.app/v1/players/nfl');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Retrieved data for ${Object.keys(data).length} players`);

      return data;
    } catch (error) {
      console.error('Error fetching Sleeper players data:', error);
      throw error;
    }
  }

  /**
   * Fetch league information from Sleeper API
   */
  async getLeagueInfo(leagueId: string) {
    try {
      console.log(`Fetching league info for ${leagueId}`);

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Retrieved league info: ${data.name} (${data.status})`);

      return data;
    } catch (error) {
      console.error('Error fetching Sleeper league info:', error);
      throw error;
    }
  }

  /**
   * Fetch roster information for a specific league
   */
  async getLeagueRosters(leagueId: string) {
    try {
      console.log(`Fetching rosters for league ${leagueId}`);

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Retrieved ${data.length} rosters`);

      return data;
    } catch (error) {
      console.error('Error fetching Sleeper rosters:', error);
      throw error;
    }
  }

  /**
   * Fetch users information for a specific league
   */
  async getLeagueUsers(leagueId: string) {
    try {
      console.log(`Fetching users for league ${leagueId}`);

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Retrieved ${data.length} users`);

      return data;
    } catch (error) {
      console.error('Error fetching Sleeper users:', error);
      throw error;
    }
  }

  /**
   * Get current NFL week
   */
  async getCurrentNFLWeek(): Promise<number> {
    try {
      const response = await fetch('https://api.sleeper.app/v1/state/nfl');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.week || 1;
    } catch (error) {
      console.error('Error fetching current NFL week:', error);
      return 1; // Default to week 1 if unable to fetch
    }
  }

  /**
   * Process matchup data to group by matchup_id
   */
  processMatchupData(matchupData: SleeperMatchupData[]): Map<number, SleeperMatchupData[]> {
    const groupedMatchups = new Map<number, SleeperMatchupData[]>();

    matchupData.forEach((team) => {
      if (!groupedMatchups.has(team.matchup_id)) {
        groupedMatchups.set(team.matchup_id, []);
      }
      groupedMatchups.get(team.matchup_id)!.push(team);
    });

    return groupedMatchups;
  }
}

export default SleeperMatchupService;