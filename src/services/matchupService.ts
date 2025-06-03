import { toast } from '@/hooks/use-toast';

export interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  players_points?: { [playerId: string]: number };
}

export interface PlayerData {
  id: number;
  sleeper_player_id: string;
  player_name: string;
  position: string;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
}

export interface TeamRosterData {
  teamId: number;
  teamName: string;
  ownerName: string;
  totalPoints: number;
  starters: PlayerWithPoints[];
  bench: PlayerWithPoints[];
}

export interface PlayerWithPoints extends PlayerData {
  points: number;
  isStarter: boolean;
  starterPosition?: string;
}

const STARTER_POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];

export class MatchupService {
  
  static async fetchSleeperMatchupData(leagueId: string, week: number): Promise<SleeperMatchupData[]> {
    try {
      console.log(`Fetching Sleeper matchup data for league ${leagueId}, week ${week}`);
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch matchup data: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Sleeper API Response:', data);
      return data;
    } catch (error) {
      console.error('Error fetching Sleeper matchup data:', error);
      throw error;
    }
  }

  static async getTeamIdFromRoster(conferenceId: number, rosterId: number): Promise<number | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage("12853", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
          { "name": "conference_id", "op": "Equal", "value": conferenceId },
          { "name": "roster_id", "op": "Equal", "value": rosterId.toString() }
        ]
      });

      if (error) throw error;
      
      if (data?.List && data.List.length > 0) {
        return data.List[0].team_id;
      }
      
      return null;
    } catch (error) {
      console.error('Error mapping roster to team:', error);
      return null;
    }
  }

  static async getTeamInfo(teamId: number) {
    try {
      const { data, error } = await window.ezsite.apis.tablePage("12852", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
          { "name": "id", "op": "Equal", "value": teamId }
        ]
      });

      if (error) throw error;
      
      return data?.List?.[0] || null;
    } catch (error) {
      console.error('Error fetching team info:', error);
      return null;
    }
  }

  static async getPlayersData(sleeperPlayerIds: string[]): Promise<PlayerData[]> {
    if (sleeperPlayerIds.length === 0) return [];

    try {
      // Since we can't use OR filters easily, we'll fetch all players and filter client-side
      const { data, error } = await window.ezsite.apis.tablePage("12870", {
        "PageNo": 1,
        "PageSize": 2000
      });

      if (error) throw error;
      
      const allPlayers = data?.List || [];
      return allPlayers.filter((player: any) => 
        sleeperPlayerIds.includes(player.sleeper_player_id)
      );
    } catch (error) {
      console.error('Error fetching players data:', error);
      return [];
    }
  }

  static async getConferenceIdFromLeague(leagueId: string): Promise<number | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage("12820", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
          { "name": "league_id", "op": "Equal", "value": leagueId }
        ]
      });

      if (error) throw error;
      
      return data?.List?.[0]?.id || null;
    } catch (error) {
      console.error('Error fetching conference:', error);
      return null;
    }
  }

  static async processMatchupData(
    leagueId: string, 
    week: number, 
    matchupId?: number
  ): Promise<TeamRosterData[]> {
    try {
      // Get conference ID from league ID
      const conferenceId = await this.getConferenceIdFromLeague(leagueId);
      if (!conferenceId) {
        throw new Error('Conference not found for league ID');
      }

      // Fetch Sleeper matchup data
      const sleeperData = await this.fetchSleeperMatchupData(leagueId, week);
      
      // Filter by matchup ID if provided
      const filteredData = matchupId 
        ? sleeperData.filter(team => team.matchup_id === matchupId)
        : sleeperData;

      const teamRosterData: TeamRosterData[] = [];

      for (const teamData of filteredData) {
        // Map roster ID to team ID
        const teamId = await this.getTeamIdFromRoster(conferenceId, teamData.roster_id);
        if (!teamId) {
          console.warn(`Team not found for roster ID: ${teamData.roster_id}`);
          continue;
        }

        // Get team info
        const teamInfo = await this.getTeamInfo(teamId);
        if (!teamInfo) {
          console.warn(`Team info not found for team ID: ${teamId}`);
          continue;
        }

        // Get all players data
        const allPlayerIds = [...new Set([...teamData.starters, ...teamData.players])];
        const playersData = await this.getPlayersData(allPlayerIds);

        // Create player lookup
        const playerLookup = new Map<string, PlayerData>();
        playersData.forEach(player => {
          playerLookup.set(player.sleeper_player_id, player);
        });

        // Process starters
        const starters: PlayerWithPoints[] = [];
        teamData.starters.forEach((playerId, index) => {
          const player = playerLookup.get(playerId);
          if (player) {
            // Handle both string and number player IDs for points lookup
            const playerPoints = teamData.players_points?.[playerId] || 
                               teamData.players_points?.[player.sleeper_player_id] || 0;
            starters.push({
              ...player,
              points: typeof playerPoints === 'number' ? playerPoints : 0,
              isStarter: true,
              starterPosition: STARTER_POSITIONS[index] || 'FLEX'
            });
          } else {
            // Create placeholder for unknown players
            starters.push({
              id: 0,
              sleeper_player_id: playerId,
              player_name: `Player ${playerId}`,
              position: 'UNK',
              nfl_team: '',
              jersey_number: 0,
              status: 'Unknown',
              injury_status: 'Healthy',
              age: 0,
              height: '',
              weight: 0,
              years_experience: 0,
              depth_chart_position: 1,
              college: '',
              points: teamData.players_points?.[playerId] || 0,
              isStarter: true,
              starterPosition: STARTER_POSITIONS[index] || 'FLEX'
            });
          }
        });

        // Process bench players
        const benchPlayerIds = teamData.players.filter(id => !teamData.starters.includes(id));
        const bench: PlayerWithPoints[] = [];
        benchPlayerIds.forEach(playerId => {
          const player = playerLookup.get(playerId);
          if (player) {
            const playerPoints = teamData.players_points?.[playerId] || 
                               teamData.players_points?.[player.sleeper_player_id] || 0;
            bench.push({
              ...player,
              points: typeof playerPoints === 'number' ? playerPoints : 0,
              isStarter: false
            });
          } else {
            // Create placeholder for unknown players
            bench.push({
              id: 0,
              sleeper_player_id: playerId,
              player_name: `Player ${playerId}`,
              position: 'UNK',
              nfl_team: '',
              jersey_number: 0,
              status: 'Unknown',
              injury_status: 'Healthy',
              age: 0,
              height: '',
              weight: 0,
              years_experience: 0,
              depth_chart_position: 1,
              college: '',
              points: teamData.players_points?.[playerId] || 0,
              isStarter: false
            });
          }
        });

        teamRosterData.push({
          teamId,
          teamName: teamInfo.team_name,
          ownerName: teamInfo.owner_name,
          totalPoints: teamData.points,
          starters,
          bench
        });
      }

      return teamRosterData;
    } catch (error) {
      console.error('Error processing matchup data:', error);
      throw error;
    }
  }
}