import { toast } from '@/hooks/use-toast';

export interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  players_points?: {[playerId: string]: number;};
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
  age: number;
  height: string;
  weight: number;
  years_experience: number;
  depth_chart_position: number;
  college: string;
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

export interface TeamMappingCache {
  [rosterId: number]: number | null;
}

export interface TeamInfoCache {
  [teamId: number]: any;
}

const STARTER_POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];

export class MatchupService {

  private static teamMappingCache: TeamMappingCache = {};
  private static teamInfoCache: TeamInfoCache = {};
  private static playersCache: Map<string, PlayerData> = new Map();

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

  static async fetchSleeperPlayerData(playerId: string): Promise<any> {
    try {
      console.log(`Fetching Sleeper player data for player ${playerId}`);
      const response = await fetch(`https://api.sleeper.app/v1/players/nfl/${playerId}`);
      if (!response.ok) {
        console.warn(`Failed to fetch player data for ${playerId}: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`Error fetching Sleeper player data for ${playerId}:`, error);
      return null;
    }
  }

  static async getTeamIdFromRoster(conferenceId: number, rosterId: number): Promise<number | null> {
    // Check cache first
    const cacheKey = rosterId;
    if (this.teamMappingCache[cacheKey] !== undefined) {
      return this.teamMappingCache[cacheKey];
    }

    try {
      // Fix: Convert rosterId to string for database comparison since roster_id is stored as string
      const { data, error } = await window.ezsite.apis.tablePage("12853", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
        { "name": "conference_id", "op": "Equal", "value": conferenceId },
        { "name": "roster_id", "op": "Equal", "value": rosterId.toString() }]

      });

      if (error) {
        console.error('Database error in getTeamIdFromRoster:', error);
        this.teamMappingCache[cacheKey] = null;
        return null;
      }

      if (data?.List && data.List.length > 0) {
        const teamId = data.List[0].team_id;
        this.teamMappingCache[cacheKey] = teamId;
        return teamId;
      }

      console.warn(`No team mapping found for roster ID: ${rosterId} in conference: ${conferenceId}`);
      this.teamMappingCache[cacheKey] = null;
      return null;
    } catch (error) {
      console.error('Error mapping roster to team:', error);
      this.teamMappingCache[cacheKey] = null;
      return null;
    }
  }

  static async getTeamInfo(teamId: number) {
    // Check cache first
    if (this.teamInfoCache[teamId] !== undefined) {
      return this.teamInfoCache[teamId];
    }

    try {
      const { data, error } = await window.ezsite.apis.tablePage("12852", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
        { "name": "id", "op": "Equal", "value": teamId }]

      });

      if (error) {
        console.error('Database error in getTeamInfo:', error);
        this.teamInfoCache[teamId] = null;
        return null;
      }

      const teamInfo = data?.List?.[0] || null;
      this.teamInfoCache[teamId] = teamInfo;
      return teamInfo;
    } catch (error) {
      console.error('Error fetching team info:', error);
      this.teamInfoCache[teamId] = null;
      return null;
    }
  }

  static async getPlayersDataOptimized(sleeperPlayerIds: string[]): Promise<PlayerData[]> {
    if (sleeperPlayerIds.length === 0) return [];

    // Check cache for existing players
    const cachedPlayers: PlayerData[] = [];
    const uncachedPlayerIds: string[] = [];

    sleeperPlayerIds.forEach((playerId) => {
      if (this.playersCache.has(playerId)) {
        const cachedPlayer = this.playersCache.get(playerId);
        if (cachedPlayer) {
          cachedPlayers.push(cachedPlayer);
        }
      } else {
        uncachedPlayerIds.push(playerId);
      }
    });

    if (uncachedPlayerIds.length === 0) {
      return cachedPlayers;
    }

    try {
      // Batch query using string filtering - more efficient than fetching all players
      const batchSize = 50; // Process in smaller batches to avoid query limits
      const allFetchedPlayers: PlayerData[] = [];

      for (let i = 0; i < uncachedPlayerIds.length; i += batchSize) {
        const batch = uncachedPlayerIds.slice(i, i + batchSize);

        // Create filter conditions for this batch
        const playerPromises = batch.map(async (playerId) => {
          try {
            const { data, error } = await window.ezsite.apis.tablePage("12870", {
              "PageNo": 1,
              "PageSize": 10,
              "Filters": [
              { "name": "sleeper_player_id", "op": "Equal", "value": playerId }]

            });

            if (error) {
              console.warn(`Error fetching player ${playerId}:`, error);
              return null;
            }

            return data?.List?.[0] || null;
          } catch (error) {
            console.warn(`Error in player query for ${playerId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(playerPromises);
        const validPlayers = batchResults.filter((player) => player !== null);
        allFetchedPlayers.push(...validPlayers);
      }

      // Cache the fetched players
      allFetchedPlayers.forEach((player) => {
        this.playersCache.set(player.sleeper_player_id, player);
      });

      // Handle missing players by attempting to fetch from Sleeper API
      const foundPlayerIds = new Set(allFetchedPlayers.map((p) => p.sleeper_player_id));
      const missingPlayerIds = uncachedPlayerIds.filter((id) => !foundPlayerIds.has(id));

      if (missingPlayerIds.length > 0) {
        console.log(`Attempting to fetch ${missingPlayerIds.length} missing players from Sleeper API`);

        // Attempt to fetch missing players from Sleeper API
        const sleeperPlayerPromises = missingPlayerIds.slice(0, 10).map(async (playerId) => {
          try {
            const sleeperPlayerData = await this.fetchSleeperPlayerData(playerId);
            if (sleeperPlayerData) {
              // Create a minimal player object from Sleeper data
              const playerData: PlayerData = {
                id: 0, // Will be set when saved to database
                sleeper_player_id: playerId,
                player_name: sleeperPlayerData.full_name || `Player ${playerId}`,
                position: sleeperPlayerData.position || 'UNK',
                nfl_team: sleeperPlayerData.team || '',
                jersey_number: sleeperPlayerData.number || 0,
                status: 'Active',
                injury_status: sleeperPlayerData.injury_status || 'Healthy',
                age: sleeperPlayerData.age || 0,
                height: sleeperPlayerData.height || '',
                weight: sleeperPlayerData.weight || 0,
                years_experience: sleeperPlayerData.years_exp || 0,
                depth_chart_position: 1,
                college: sleeperPlayerData.college || ''
              };

              // Cache the player data
              this.playersCache.set(playerId, playerData);
              return playerData;
            }
          } catch (error) {
            console.warn(`Failed to fetch player ${playerId} from Sleeper API:`, error);
          }
          return null;
        });

        const sleeperPlayers = await Promise.all(sleeperPlayerPromises);
        const validSleeperPlayers = sleeperPlayers.filter((p) => p !== null) as PlayerData[];
        allFetchedPlayers.push(...validSleeperPlayers);
      }

      return [...cachedPlayers, ...allFetchedPlayers];
    } catch (error) {
      console.error('Error fetching players data:', error);
      return cachedPlayers; // Return cached players if database fails
    }
  }

  static async getConferenceIdFromLeague(leagueId: string): Promise<number | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage("12820", {
        "PageNo": 1,
        "PageSize": 1,
        "Filters": [
        { "name": "league_id", "op": "Equal", "value": leagueId }]

      });

      if (error) {
        console.error('Database error in getConferenceIdFromLeague:', error);
        return null;
      }

      const conferenceId = data?.List?.[0]?.id || null;
      if (!conferenceId) {
        console.error(`No conference found for league ID: ${leagueId}`);
      }
      return conferenceId;
    } catch (error) {
      console.error('Error fetching conference:', error);
      return null;
    }
  }

  static async getAllTeamMappingsForConference(conferenceId: number): Promise<TeamMappingCache> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage("12853", {
        "PageNo": 1,
        "PageSize": 50, // Assuming max 50 teams per conference
        "Filters": [
        { "name": "conference_id", "op": "Equal", "value": conferenceId }]

      });

      if (error) {
        console.error('Error fetching team mappings:', error);
        return {};
      }

      const mappings: TeamMappingCache = {};
      if (data?.List) {
        data.List.forEach((mapping: any) => {
          // Convert string roster_id to number for cache key
          const rosterId = parseInt(mapping.roster_id);
          if (!isNaN(rosterId)) {
            mappings[rosterId] = mapping.team_id;
          }
        });
      }

      return mappings;
    } catch (error) {
      console.error('Error in getAllTeamMappingsForConference:', error);
      return {};
    }
  }

  static createPlayerPlaceholder(playerId: string, points: number = 0, isStarter: boolean = false, starterIndex?: number): PlayerWithPoints {
    return {
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
      points: typeof points === 'number' ? points : 0,
      isStarter,
      starterPosition: isStarter && starterIndex !== undefined ? STARTER_POSITIONS[starterIndex] || 'FLEX' : undefined
    };
  }

  static async processMatchupData(
  leagueId: string,
  week: number,
  matchupId?: number)
  : Promise<TeamRosterData[]> {
    try {
      console.log(`Processing matchup data for league ${leagueId}, week ${week}, matchup ${matchupId || 'all'}`);

      // Step 1: Get conference ID from league ID
      const conferenceId = await this.getConferenceIdFromLeague(leagueId);
      if (!conferenceId) {
        throw new Error(`Conference not found for league ID: ${leagueId}`);
      }

      // Step 2: Pre-load all team mappings for this conference
      const teamMappings = await this.getAllTeamMappingsForConference(conferenceId);
      console.log('Team mappings loaded:', teamMappings);

      // Step 3: Fetch Sleeper matchup data
      const sleeperData = await this.fetchSleeperMatchupData(leagueId, week);
      if (!sleeperData || sleeperData.length === 0) {
        console.warn('No matchup data returned from Sleeper API');
        return [];
      }

      // Step 4: Filter by matchup ID if provided
      const filteredData = matchupId ?
      sleeperData.filter((team) => team.matchup_id === matchupId) :
      sleeperData;

      if (filteredData.length === 0) {
        console.warn(`No matchup data found for matchup ID: ${matchupId}`);
        return [];
      }

      // Step 5: Collect all unique team IDs and player IDs for batch processing
      const teamIds = new Set<number>();
      const allPlayerIds = new Set<string>();

      const validTeamData = filteredData.filter((teamData) => {
        const teamId = teamMappings[teamData.roster_id];
        if (teamId) {
          teamIds.add(teamId);
          [...teamData.starters, ...teamData.players].forEach((playerId) => {
            if (playerId) allPlayerIds.add(playerId);
          });
          return true;
        } else {
          console.warn(`Team not found for roster ID: ${teamData.roster_id}`);
          return false;
        }
      });

      if (validTeamData.length === 0) {
        throw new Error('No valid team mappings found for any roster IDs');
      }

      // Step 6: Batch fetch team info and player data in parallel
      const [teamInfoResults, playersData] = await Promise.all([
      Promise.all(Array.from(teamIds).map((teamId) => this.getTeamInfo(teamId))),
      this.getPlayersDataOptimized(Array.from(allPlayerIds))]
      );

      // Step 7: Create lookup maps
      const teamInfoLookup = new Map<number, any>();
      Array.from(teamIds).forEach((teamId, index) => {
        teamInfoLookup.set(teamId, teamInfoResults[index]);
      });

      const playerLookup = new Map<string, PlayerData>();
      playersData.forEach((player) => {
        if (player) {
          playerLookup.set(player.sleeper_player_id, player);
        }
      });

      console.log(`Loaded ${playersData.length} players and ${teamInfoLookup.size} teams`);

      // Step 8: Process team roster data
      const teamRosterData: TeamRosterData[] = [];

      for (const teamData of validTeamData) {
        try {
          const teamId = teamMappings[teamData.roster_id];
          const teamInfo = teamInfoLookup.get(teamId);

          if (!teamInfo) {
            console.warn(`Team info not found for team ID: ${teamId}`);
            continue;
          }

          // Process starters
          const starters: PlayerWithPoints[] = [];
          teamData.starters.forEach((playerId, index) => {
            if (!playerId) return;

            const player = playerLookup.get(playerId);
            const playerPoints = teamData.players_points?.[playerId] || 0;

            if (player) {
              starters.push({
                ...player,
                points: typeof playerPoints === 'number' ? playerPoints : 0,
                isStarter: true,
                starterPosition: STARTER_POSITIONS[index] || 'FLEX'
              });
            } else {
              // Create placeholder for missing players
              starters.push(this.createPlayerPlaceholder(playerId, playerPoints, true, index));
            }
          });

          // Process bench players
          const benchPlayerIds = teamData.players.filter((id) => id && !teamData.starters.includes(id));
          const bench: PlayerWithPoints[] = [];

          benchPlayerIds.forEach((playerId) => {
            if (!playerId) return;

            const player = playerLookup.get(playerId);
            const playerPoints = teamData.players_points?.[playerId] || 0;

            if (player) {
              bench.push({
                ...player,
                points: typeof playerPoints === 'number' ? playerPoints : 0,
                isStarter: false
              });
            } else {
              // Create placeholder for missing players
              bench.push(this.createPlayerPlaceholder(playerId, playerPoints, false));
            }
          });

          teamRosterData.push({
            teamId,
            teamName: teamInfo.team_name || 'Unknown Team',
            ownerName: teamInfo.owner_name || 'Unknown Owner',
            totalPoints: typeof teamData.points === 'number' ? teamData.points : 0,
            starters,
            bench
          });

        } catch (error) {
          console.error(`Error processing team data for roster ${teamData.roster_id}:`, error);
          // Continue processing other teams
          continue;
        }
      }

      console.log(`Successfully processed ${teamRosterData.length} teams`);
      return teamRosterData;

    } catch (error) {
      console.error('Error processing matchup data:', error);
      toast({
        title: "Error Loading Matchup Data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      throw error;
    }
  }

  // Clear caches when needed (e.g., when switching leagues)
  static clearCaches() {
    this.teamMappingCache = {};
    this.teamInfoCache = {};
    this.playersCache.clear();
    console.log('MatchupService caches cleared');
  }

  // Get cache statistics for debugging
  static getCacheStats() {
    return {
      teamMappings: Object.keys(this.teamMappingCache).length,
      teamInfo: Object.keys(this.teamInfoCache).length,
      players: this.playersCache.size
    };
  }
}