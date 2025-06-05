/**
 * Optimized Matchup Data Pipeline Service
 * High-performance data processing with batch operations, caching, and parallel processing
 */

export interface TeamInfo {
  teamId: number;
  teamName: string;
  ownerName: string;
  ownerId: string;
  conferenceId: number;
  conferenceName: string;
  leagueId: string;
  rosterId: string;
  seasonId: number;
  seasonYear: number;
}

export interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  starters_points?: {[key: string]: number;};
  players_points?: {[key: string]: number;};
}

export interface ProcessedTeamMatchupData {
  teamInfo: TeamInfo;
  sleeperData: SleeperMatchupData;
  starters: Array<{playerId: string;playerName: string;points: number;}>;
  bench: Array<{playerId: string;playerName: string;points: number;}>;
  totalPoints: number;
}

export interface ProcessedMatchup {
  matchupId: number;
  week: number;
  team1: ProcessedTeamMatchupData;
  team2: ProcessedTeamMatchupData;
  isPlayoff: boolean;
  status: string;
  winner?: ProcessedTeamMatchupData;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MatchupDataPipeline {
  private static instance: MatchupDataPipeline;
  
  // Enhanced caching with TTL and proper invalidation
  private playerCache: Map<string, CacheEntry<string>> = new Map();
  private teamInfoCache: Map<string, CacheEntry<TeamInfo>> = new Map();
  private sleeperDataCache: Map<string, CacheEntry<SleeperMatchupData[]>> = new Map();
  private batchedPlayerCache: Map<string, CacheEntry<{[key: string]: string}>> = new Map();
  
  // Cache TTL configurations (in milliseconds)
  private readonly CACHE_TTL = {
    PLAYER_NAME: 30 * 60 * 1000, // 30 minutes
    TEAM_INFO: 15 * 60 * 1000,   // 15 minutes  
    SLEEPER_DATA: 5 * 60 * 1000, // 5 minutes
    BATCH_PLAYERS: 60 * 60 * 1000 // 1 hour
  };
  
  // Request timeout configuration
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  public static getInstance(): MatchupDataPipeline {
    if (!MatchupDataPipeline.instance) {
      MatchupDataPipeline.instance = new MatchupDataPipeline();
    }
    return MatchupDataPipeline.instance;
  }

  /**
   * OPTIMIZED: Main method to get processed matchup data for a specific week
   * Uses batch processing and parallel operations for maximum performance
   */
  async getMatchupsForWeek(week: number): Promise<ProcessedMatchup[]> {
    const startTime = Date.now();
    console.log(`🚀 Starting optimized matchup data pipeline for week ${week}`);

    try {
      // Step 1: Get all matchups for the week
      const matchups = await this.getMatchupsFromDatabase(week);
      console.log(`📊 Found ${matchups.length} matchups for week ${week}`);

      if (matchups.length === 0) {
        console.log('✅ No matchups found for this week');
        return [];
      }

      // Step 2: Extract all unique team IDs and conference IDs for batch processing
      const uniqueTeamIds = new Set<number>();
      const uniqueConferenceIds = new Set<number>();
      const uniqueLeagueIds = new Set<string>();

      matchups.forEach(matchup => {
        uniqueTeamIds.add(matchup.team_1_id);
        uniqueTeamIds.add(matchup.team_2_id);
        uniqueConferenceIds.add(matchup.conference_id);
      });

      console.log(`🔄 Batch processing ${uniqueTeamIds.size} teams across ${uniqueConferenceIds.size} conferences`);

      // Step 3: Load team information only for valid team-conference combinations
      const teamConferencePairs: Array<{teamId: number, conferenceId: number}> = [];
      
      matchups.forEach(matchup => {
        teamConferencePairs.push(
          { teamId: matchup.team_1_id, conferenceId: matchup.conference_id },
          { teamId: matchup.team_2_id, conferenceId: matchup.conference_id }
        );
      });
      
      // Remove duplicates
      const uniquePairs = teamConferencePairs.filter((pair, index, array) => 
        array.findIndex(p => p.teamId === pair.teamId && p.conferenceId === pair.conferenceId) === index
      );
      
      console.log(`🔄 Loading ${uniquePairs.length} unique team-conference combinations`);

      const teamInfoPromises = uniquePairs.map(pair => 
        this.getTeamInfoBatched(pair.teamId, pair.conferenceId).catch(error => {
          console.warn(`⚠️ Failed to load team ${pair.teamId} in conference ${pair.conferenceId}:`, error.message);
          return null;
        })
      );

      const teamInfoResults = await Promise.allSettled(teamInfoPromises);
      const teamInfos = teamInfoResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<TeamInfo>).value);

      // Extract unique league IDs for Sleeper API calls
      teamInfos.forEach(teamInfo => {
        if (teamInfo.leagueId) {
          uniqueLeagueIds.add(teamInfo.leagueId);
        }
      });

      console.log(`📡 Fetching Sleeper data for ${uniqueLeagueIds.size} leagues`);

      // Step 4: Batch fetch all Sleeper data in parallel
      const sleeperDataPromises = Array.from(uniqueLeagueIds).map(leagueId => 
        this.getSleeperMatchupDataWithTimeout(leagueId, week).catch(error => {
          console.warn(`⚠️ Failed to fetch Sleeper data for league ${leagueId}:`, error);
          return { leagueId, data: [] };
        })
      );

      const sleeperResults = await Promise.allSettled(sleeperDataPromises);
      const sleeperDataMap = new Map<string, SleeperMatchupData[]>();
      
      sleeperResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const { leagueId, data } = result.value;
          sleeperDataMap.set(leagueId, data);
        }
      });

      // Step 5: Process all matchups in parallel with error isolation
      console.log(`⚡ Processing ${matchups.length} matchups in parallel`);
      
      const matchupPromises = matchups.map(matchup => 
        this.processMatchupOptimized(matchup, week, sleeperDataMap).catch(error => {
          console.error(`❌ Error processing matchup ${matchup.id}:`, error);
          return null; // Return null for failed matchups to maintain error isolation
        })
      );

      const matchupResults = await Promise.allSettled(matchupPromises);
      const processedMatchups = matchupResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<ProcessedMatchup>).value);

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log(`✅ Successfully processed ${processedMatchups.length}/${matchups.length} matchups in ${processingTime}ms`);
      console.log(`📈 Performance: ${(processingTime / matchups.length).toFixed(2)}ms per matchup`);
      
      return processedMatchups;

    } catch (error) {
      const endTime = Date.now();
      console.error(`❌ Error in optimized matchup data pipeline (${endTime - startTime}ms):`, error);
      throw error;
    }
  }

  /**
   * OPTIMIZED: Get matchup records from database with improved query
   */
  private async getMatchupsFromDatabase(week: number) {
    try {
      const response = await Promise.race([
        window.ezsite.apis.tablePage('13329', {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'id',
          IsAsc: true,
          Filters: [{
            name: 'week',
            op: 'Equal',
            value: week
          }]
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), this.REQUEST_TIMEOUT)
        )
      ]);

      if (response.error) {
        throw new Error(`Failed to fetch matchups: ${response.error}`);
      }

      const matchups = response.data?.List || [];
      console.log(`📋 Retrieved ${matchups.length} matchup records from database`);
      return matchups;
      
    } catch (error) {
      console.error(`❌ Database query failed for week ${week}:`, error);
      throw error;
    }
  }

  /**
   * OPTIMIZED: Process individual matchup with pre-loaded data
   */
  private async processMatchupOptimized(
    matchupRecord: any, 
    week: number, 
    sleeperDataMap: Map<string, SleeperMatchupData[]>
  ): Promise<ProcessedMatchup> {
    console.log(`⚡ Processing matchup ${matchupRecord.id}: Team ${matchupRecord.team_1_id} vs Team ${matchupRecord.team_2_id}`);

    try {
      // Get team information (should be cached from batch operation)
      const [team1Info, team2Info] = await Promise.all([
        this.getTeamInfoFromCache(matchupRecord.team_1_id, matchupRecord.conference_id),
        this.getTeamInfoFromCache(matchupRecord.team_2_id, matchupRecord.conference_id)
      ]);

      if (!team1Info) {
        throw new Error(`Missing team info for team ${matchupRecord.team_1_id} in conference ${matchupRecord.conference_id}`);
      }
      if (!team2Info) {
        throw new Error(`Missing team info for team ${matchupRecord.team_2_id} in conference ${matchupRecord.conference_id}`);
      }

      // Get pre-loaded Sleeper data
      const sleeperMatchups = sleeperDataMap.get(team1Info.leagueId) || [];

      if (sleeperMatchups.length === 0) {
        console.warn(`⚠️ No Sleeper data available for league ${team1Info.leagueId}`);
        throw new Error(`No Sleeper data for league ${team1Info.leagueId}`);
      }

      // Map Sleeper data to teams
      const [team1SleeperData, team2SleeperData] = await Promise.all([
        this.findSleeperDataForTeam(sleeperMatchups, team1Info),
        this.findSleeperDataForTeam(sleeperMatchups, team2Info)
      ]);

      if (!team1SleeperData || !team2SleeperData) {
        throw new Error(`Could not find Sleeper data for both teams in matchup ${matchupRecord.id}`);
      }

      // Process team data in parallel
      const [team1Processed, team2Processed] = await Promise.all([
        this.processTeamMatchupDataOptimized(team1Info, team1SleeperData),
        this.processTeamMatchupDataOptimized(team2Info, team2SleeperData)
      ]);

      // Determine winner
      let winner: ProcessedTeamMatchupData | undefined;
      if (team1Processed.totalPoints > team2Processed.totalPoints) {
        winner = team1Processed;
      } else if (team2Processed.totalPoints > team1Processed.totalPoints) {
        winner = team2Processed;
      }

      return {
        matchupId: matchupRecord.id,
        week,
        team1: team1Processed,
        team2: team2Processed,
        isPlayoff: matchupRecord.is_playoff || false,
        status: matchupRecord.status || 'pending',
        winner
      };
      
    } catch (error) {
      console.error(`❌ Failed to process matchup ${matchupRecord.id}:`, error);
      throw error;
    }
  }

  /**
   * LEGACY: Process individual matchup (kept for backward compatibility)
   */
  private async processMatchup(matchupRecord: any, week: number): Promise<ProcessedMatchup> {
    console.log(`Processing matchup ${matchupRecord.id}: Team ${matchupRecord.team_1_id} vs Team ${matchupRecord.team_2_id}`);

    // Get team information for both teams
    const team1Info = await this.getTeamInfo(matchupRecord.team_1_id, matchupRecord.conference_id);
    const team2Info = await this.getTeamInfo(matchupRecord.team_2_id, matchupRecord.conference_id);

    // Get Sleeper matchup data
    const sleeperMatchups = await this.getSleeperMatchupData(team1Info.leagueId, week);

    // Map Sleeper data to teams
    const team1SleeperData = this.findSleeperDataForTeam(sleeperMatchups, team1Info);
    const team2SleeperData = this.findSleeperDataForTeam(sleeperMatchups, team2Info);

    if (!team1SleeperData || !team2SleeperData) {
      throw new Error(`Could not find Sleeper data for matchup ${matchupRecord.id}`);
    }

    // Process team data
    const team1Processed = await this.processTeamMatchupData(team1Info, team1SleeperData);
    const team2Processed = await this.processTeamMatchupData(team2Info, team2SleeperData);

    // Determine winner
    let winner: ProcessedTeamMatchupData | undefined;
    if (team1Processed.totalPoints > team2Processed.totalPoints) {
      winner = team1Processed;
    } else if (team2Processed.totalPoints > team1Processed.totalPoints) {
      winner = team2Processed;
    }

    return {
      matchupId: matchupRecord.id,
      week,
      team1: team1Processed,
      team2: team2Processed,
      isPlayoff: matchupRecord.is_playoff || false,
      status: matchupRecord.status || 'pending',
      winner
    };
  }

  /**
   * OPTIMIZED: Enhanced cache management with TTL
   */
  private isValidCacheEntry<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private setCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (entry && this.isValidCacheEntry(entry)) {
      return entry.data;
    }
    if (entry) {
      cache.delete(key); // Remove expired entry
    }
    return null;
  }

  /**
   * OPTIMIZED: Get team info from cache first
   */
  private async getTeamInfoFromCache(teamId: number, conferenceId: number): Promise<TeamInfo | null> {
    const cacheKey = `${teamId}-${conferenceId}`;
    const cached = this.getCacheEntry(this.teamInfoCache, cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // If not in cache, try to fetch (this should ideally not happen with batch loading)
    try {
      return await this.getTeamInfoBatched(teamId, conferenceId);
    } catch (error) {
      console.warn(`⚠️ Could not fetch team info for ${teamId}-${conferenceId}:`, error);
      return null;
    }
  }

  /**
   * OPTIMIZED: Batch-friendly team info retrieval
   */
  private async getTeamInfoBatched(teamId: number, conferenceId: number): Promise<TeamInfo> {
    const cacheKey = `${teamId}-${conferenceId}`;
    const cached = this.getCacheEntry(this.teamInfoCache, cacheKey);
    
    if (cached) {
      return cached;
    }

    console.log(`🔍 Fetching team info for team ${teamId} in conference ${conferenceId}`);

    try {
      // Batch all required queries in parallel with timeout
      const [teamResponse, conferenceResponse, junctionResponse] = await Promise.race([
        Promise.all([
          window.ezsite.apis.tablePage('12852', {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: teamId }]
          }),
          window.ezsite.apis.tablePage('12820', {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: conferenceId }]
          }),
          window.ezsite.apis.tablePage('12853', {
            PageNo: 1,
            PageSize: 1,
            Filters: [
              { name: 'team_id', op: 'Equal', value: teamId },
              { name: 'conference_id', op: 'Equal', value: conferenceId },
              { name: 'is_active', op: 'Equal', value: true }
            ]
          })
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Team info query timeout')), this.REQUEST_TIMEOUT)
        )
      ]);

      // Validate all responses with detailed error info
      if (teamResponse.error || !teamResponse.data?.List?.[0]) {
        console.error(`Team query failed for ID ${teamId}:`, teamResponse.error, teamResponse.data);
        throw new Error(`Failed to fetch team ${teamId}: ${teamResponse.error || 'No data returned'}`);
      }
      if (conferenceResponse.error || !conferenceResponse.data?.List?.[0]) {
        console.error(`Conference query failed for ID ${conferenceId}:`, conferenceResponse.error, conferenceResponse.data);
        throw new Error(`Failed to fetch conference ${conferenceId}: ${conferenceResponse.error || 'No data returned'}`);
      }
      if (junctionResponse.error || !junctionResponse.data?.List?.[0]) {
        console.error(`Junction query failed for team ${teamId}, conference ${conferenceId}:`, junctionResponse.error, junctionResponse.data);
        throw new Error(`Failed to fetch roster ID for team ${teamId} in conference ${conferenceId}: ${junctionResponse.error || 'No data returned'}`);
      }

      const [team, conference, junction] = [
        teamResponse.data.List[0],
        conferenceResponse.data.List[0],
        junctionResponse.data.List[0]
      ];

      // Get season info using the correct table ID
      const seasonResponse = await Promise.race([
        window.ezsite.apis.tablePage('12818', {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: conference.season_id }]
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Season query timeout')), this.REQUEST_TIMEOUT)
        )
      ]);

      if (seasonResponse.error || !seasonResponse.data?.List?.[0]) {
        console.error(`Season query failed for ID ${conference.season_id}:`, seasonResponse.error, seasonResponse.data);
        throw new Error(`Failed to fetch season ${conference.season_id}: ${seasonResponse.error || 'No data returned'}`);
      }

      const season = seasonResponse.data.List[0];

      const teamInfo: TeamInfo = {
        teamId: team.id,
        teamName: team.team_name,
        ownerName: team.owner_name,
        ownerId: team.owner_id,
        conferenceId: conference.id,
        conferenceName: conference.conference_name,
        leagueId: conference.league_id,
        rosterId: junction.roster_id,
        seasonId: season.id,
        seasonYear: season.season_year
      };

      this.setCacheEntry(this.teamInfoCache, cacheKey, teamInfo, this.CACHE_TTL.TEAM_INFO);
      console.log(`✅ Team info cached for ${teamInfo.teamName} (${teamInfo.rosterId})`);

      return teamInfo;
      
    } catch (error) {
      console.error(`❌ Error fetching team info for ${teamId}-${conferenceId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive team information from multiple tables
   */
  private async getTeamInfo(teamId: number, conferenceId: number): Promise<TeamInfo> {
    const cacheKey = `${teamId}-${conferenceId}`;

    if (this.teamInfoCache.has(cacheKey)) {
      return this.teamInfoCache.get(cacheKey)!;
    }

    console.log(`Fetching team info for team ${teamId} in conference ${conferenceId}`);

    // Get team data
    const teamResponse = await window.ezsite.apis.tablePage('12852', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: teamId }]
    });

    if (teamResponse.error || !teamResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch team ${teamId}: ${teamResponse.error}`);
    }

    const team = teamResponse.data.List[0];

    // Get conference data
    const conferenceResponse = await window.ezsite.apis.tablePage('12820', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: conferenceId }]
    });

    if (conferenceResponse.error || !conferenceResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch conference ${conferenceId}: ${conferenceResponse.error}`);
    }

    const conference = conferenceResponse.data.List[0];

    // Get season data
    const seasonResponse = await window.ezsite.apis.tablePage('12818', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: conference.season_id }]
    });

    if (seasonResponse.error || !seasonResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch season ${conference.season_id}: ${seasonResponse.error}`);
    }

    const season = seasonResponse.data.List[0];

    // Get roster ID from junction table
    const junctionResponse = await window.ezsite.apis.tablePage('12853', {
      PageNo: 1,
      PageSize: 1,
      Filters: [
      { name: 'team_id', op: 'Equal', value: teamId },
      { name: 'conference_id', op: 'Equal', value: conferenceId },
      { name: 'is_active', op: 'Equal', value: true }]

    });

    if (junctionResponse.error || !junctionResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch roster ID for team ${teamId} in conference ${conferenceId}: ${junctionResponse.error}`);
    }

    const junction = junctionResponse.data.List[0];

    const teamInfo: TeamInfo = {
      teamId: team.id,
      teamName: team.team_name,
      ownerName: team.owner_name,
      ownerId: team.owner_id,
      conferenceId: conference.id,
      conferenceName: conference.conference_name,
      leagueId: conference.league_id,
      rosterId: junction.roster_id,
      seasonId: season.id,
      seasonYear: season.season_year
    };

    this.teamInfoCache.set(cacheKey, teamInfo);
    console.log(`Team info cached for ${teamInfo.teamName} (${teamInfo.rosterId})`);

    return teamInfo;
  }

  /**
   * OPTIMIZED: Get matchup data from Sleeper API with caching and timeout
   */
  private async getSleeperMatchupDataWithTimeout(leagueId: string, week: number): Promise<{leagueId: string, data: SleeperMatchupData[]}> {
    const cacheKey = `${leagueId}-${week}`;
    const cached = this.getCacheEntry(this.sleeperDataCache, cacheKey);
    
    if (cached) {
      console.log(`📂 Using cached Sleeper data for league ${leagueId}, week ${week}`);
      return { leagueId, data: cached };
    }

    try {
      console.log(`📡 Fetching Sleeper matchup data for league ${leagueId}, week ${week}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} roster entries from Sleeper for league ${leagueId}, week ${week}`);

      // Cache the result
      this.setCacheEntry(this.sleeperDataCache, cacheKey, data, this.CACHE_TTL.SLEEPER_DATA);
      
      return { leagueId, data };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`⏰ Timeout fetching Sleeper data for league ${leagueId}, week ${week}`);
        throw new Error(`Timeout fetching Sleeper data for league ${leagueId}`);
      }
      console.error(`❌ Error fetching Sleeper data for league ${leagueId}, week ${week}:`, error);
      throw error;
    }
  }

  /**
   * Get matchup data from Sleeper API
   */
  private async getSleeperMatchupData(leagueId: string, week: number): Promise<SleeperMatchupData[]> {
    const result = await this.getSleeperMatchupDataWithTimeout(leagueId, week);
    return result.data;
  }

  /**
   * Find Sleeper data for specific team using roster ID verification
   */
  private findSleeperDataForTeam(sleeperMatchups: SleeperMatchupData[], teamInfo: TeamInfo): SleeperMatchupData | null {
    const rosterId = parseInt(teamInfo.rosterId);

    console.log(`Looking for roster_id ${rosterId} for team ${teamInfo.teamName} in league ${teamInfo.leagueId}`);

    const matchingData = sleeperMatchups.find((data) => data.roster_id === rosterId);

    if (matchingData) {
      console.log(`Found Sleeper data for ${teamInfo.teamName}: ${matchingData.points} points`);
    } else {
      console.error(`No Sleeper data found for ${teamInfo.teamName} with roster_id ${rosterId}`);
      console.log('Available roster_ids:', sleeperMatchups.map((d) => d.roster_id));
    }

    return matchingData || null;
  }

  /**
   * OPTIMIZED: Process team matchup data with batch player name resolution
   */
  private async processTeamMatchupDataOptimized(teamInfo: TeamInfo, sleeperData: SleeperMatchupData): Promise<ProcessedTeamMatchupData> {
    console.log(`⚡ Processing team data for ${teamInfo.teamName}`);

    // Collect all unique player IDs
    const allPlayerIds = [...new Set([...sleeperData.starters, ...sleeperData.players])];
    
    // Batch fetch player names
    const playerNamesMap = await this.getBatchPlayerNames(allPlayerIds);

    // Process starters with cached player names
    const starters = sleeperData.starters.map((playerId, index) => {
      const playerName = playerNamesMap[playerId] || `Player ${playerId}`;
      const points = sleeperData.starters_points?.[index.toString()] || 0;
      return { playerId, playerName, points };
    });

    // Process bench (players not in starters) with cached player names
    const benchPlayerIds = sleeperData.players.filter((playerId) => !sleeperData.starters.includes(playerId));
    const bench = benchPlayerIds.map((playerId) => {
      const playerName = playerNamesMap[playerId] || `Player ${playerId}`;
      const points = sleeperData.players_points?.[playerId] || 0;
      return { playerId, playerName, points };
    });

    return {
      teamInfo,
      sleeperData,
      starters,
      bench,
      totalPoints: sleeperData.custom_points || sleeperData.points
    };
  }

  /**
   * OPTIMIZED: Batch fetch player names to reduce API calls
   */
  private async getBatchPlayerNames(playerIds: string[]): Promise<{[key: string]: string}> {
    if (playerIds.length === 0) return {};

    const result: {[key: string]: string} = {};
    const uncachedIds: string[] = [];

    // Check cache first
    for (const playerId of playerIds) {
      const cached = this.getCacheEntry(this.playerCache, playerId);
      if (cached) {
        result[playerId] = cached;
      } else {
        uncachedIds.push(playerId);
      }
    }

    if (uncachedIds.length === 0) {
      console.log(`📂 All ${playerIds.length} player names found in cache`);
      return result;
    }

    console.log(`🔍 Fetching ${uncachedIds.length}/${playerIds.length} player names`);

    try {
      // Try to get player names from database first (batch query)
      if (uncachedIds.length > 0) {
        const dbPlayers = await this.getBatchPlayerNamesFromDatabase(uncachedIds);
        Object.assign(result, dbPlayers);
        
        // Cache database results
        Object.entries(dbPlayers).forEach(([playerId, playerName]) => {
          this.setCacheEntry(this.playerCache, playerId, playerName, this.CACHE_TTL.PLAYER_NAME);
        });
      }

      // For any players still not found, try Sleeper API batch
      const stillMissing = uncachedIds.filter(id => !result[id]);
      if (stillMissing.length > 0) {
        const sleeperPlayers = await this.getBatchPlayerNamesFromSleeper(stillMissing);
        Object.assign(result, sleeperPlayers);
        
        // Cache Sleeper results
        Object.entries(sleeperPlayers).forEach(([playerId, playerName]) => {
          this.setCacheEntry(this.playerCache, playerId, playerName, this.CACHE_TTL.PLAYER_NAME);
        });
      }

      // Fill in fallback names for any remaining missing players
      uncachedIds.forEach(playerId => {
        if (!result[playerId]) {
          const fallbackName = `Player ${playerId}`;
          result[playerId] = fallbackName;
          this.setCacheEntry(this.playerCache, playerId, fallbackName, this.CACHE_TTL.PLAYER_NAME);
        }
      });

      console.log(`✅ Resolved ${Object.keys(result).length} player names`);
      return result;
      
    } catch (error) {
      console.error('❌ Error in batch player name resolution:', error);
      
      // Fallback: provide default names for all uncached players
      uncachedIds.forEach(playerId => {
        if (!result[playerId]) {
          const fallbackName = `Player ${playerId}`;
          result[playerId] = fallbackName;
          this.setCacheEntry(this.playerCache, playerId, fallbackName, this.CACHE_TTL.PLAYER_NAME);
        }
      });
      
      return result;
    }
  }

  /**
   * OPTIMIZED: Batch fetch player names from database
   */
  private async getBatchPlayerNamesFromDatabase(playerIds: string[]): Promise<{[key: string]: string}> {
    if (playerIds.length === 0) return {};

    try {
      // Note: This is a simplified approach. In a real implementation,
      // you might want to use a more sophisticated query with IN clause
      const promises = playerIds.slice(0, 50).map(playerId => // Limit batch size
        Promise.race([
          window.ezsite.apis.tablePage('12870', {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: playerId }]
          }),
          new Promise((resolve) => 
            setTimeout(() => resolve({ data: { List: [] } }), 3000) // 3 second timeout per query
          )
        ]).catch(() => ({ data: { List: [] } })) // Handle errors gracefully
      );

      const responses = await Promise.all(promises);
      const result: {[key: string]: string} = {};

      responses.forEach((response, index) => {
        if (response.data?.List?.[0]) {
          const playerId = playerIds[index];
          result[playerId] = response.data.List[0].player_name;
        }
      });

      console.log(`📊 Found ${Object.keys(result).length}/${playerIds.length} players in database`);
      return result;
      
    } catch (error) {
      console.warn('⚠️ Error fetching player names from database:', error);
      return {};
    }
  }

  /**
   * OPTIMIZED: Batch fetch player names from Sleeper API
   */
  private async getBatchPlayerNamesFromSleeper(playerIds: string[]): Promise<{[key: string]: string}> {
    if (playerIds.length === 0) return {};

    const cacheKey = 'sleeper-players-batch';
    let allPlayers = this.getCacheEntry(this.batchedPlayerCache, cacheKey);

    if (!allPlayers) {
      try {
        console.log('📡 Fetching complete player database from Sleeper API');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT * 2); // Longer timeout for batch

        const response = await fetch('https://api.sleeper.app/v1/players/nfl', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          allPlayers = await response.json();
          this.setCacheEntry(this.batchedPlayerCache, cacheKey, allPlayers, this.CACHE_TTL.BATCH_PLAYERS);
          console.log('✅ Cached complete Sleeper player database');
        } else {
          throw new Error(`Sleeper API error: ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch Sleeper player database:', error);
        return {};
      }
    }

    const result: {[key: string]: string} = {};
    
    playerIds.forEach(playerId => {
      if (allPlayers[playerId]) {
        const player = allPlayers[playerId];
        result[playerId] = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || `Player ${playerId}`;
      }
    });

    console.log(`📊 Found ${Object.keys(result).length}/${playerIds.length} players in Sleeper API`);
    return result;
  }

  /**
   * Process team matchup data including player names and points
   */
  private async processTeamMatchupData(teamInfo: TeamInfo, sleeperData: SleeperMatchupData): Promise<ProcessedTeamMatchupData> {
    console.log(`Processing team data for ${teamInfo.teamName}`);

    // Process starters
    const starters = await Promise.all(
      sleeperData.starters.map(async (playerId, index) => {
        const playerName = await this.getPlayerName(playerId);
        const points = sleeperData.starters_points?.[index.toString()] || 0;
        return { playerId, playerName, points };
      })
    );

    // Process bench (players not in starters)
    const benchPlayerIds = sleeperData.players.filter((playerId) => !sleeperData.starters.includes(playerId));
    const bench = await Promise.all(
      benchPlayerIds.map(async (playerId) => {
        const playerName = await this.getPlayerName(playerId);
        const points = sleeperData.players_points?.[playerId] || 0;
        return { playerId, playerName, points };
      })
    );

    return {
      teamInfo,
      sleeperData,
      starters,
      bench,
      totalPoints: sleeperData.custom_points || sleeperData.points
    };
  }

  /**
   * Get player name from database or Sleeper API
   */
  private async getPlayerName(sleeperId: string): Promise<string> {
    if (this.playerCache.has(sleeperId)) {
      return this.playerCache.get(sleeperId)!;
    }

    try {
      // First try to get from database
      const response = await window.ezsite.apis.tablePage('12870', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: sleeperId }]
      });

      if (!response.error && response.data?.List?.[0]) {
        const playerName = response.data.List[0].player_name;
        this.playerCache.set(sleeperId, playerName);
        return playerName;
      }

      // If not in database, try Sleeper API
      const sleeperResponse = await fetch(`https://api.sleeper.app/v1/players/nfl`);
      if (sleeperResponse.ok) {
        const players = await sleeperResponse.json();
        if (players[sleeperId]) {
          const fullName = players[sleeperId].full_name || `${players[sleeperId].first_name} ${players[sleeperId].last_name}`;
          this.playerCache.set(sleeperId, fullName);
          return fullName;
        }
      }

      // Fallback to player ID if name not found
      const fallbackName = `Player ${sleeperId}`;
      this.playerCache.set(sleeperId, fallbackName);
      return fallbackName;

    } catch (error) {
      console.error(`Error getting player name for ${sleeperId}:`, error);
      const fallbackName = `Player ${sleeperId}`;
      this.playerCache.set(sleeperId, fallbackName);
      return fallbackName;
    }
  }

  /**
   * OPTIMIZED: Enhanced cache management with selective clearing
   */
  public clearCaches(type?: 'all' | 'players' | 'teams' | 'sleeper' | 'expired'): void {
    switch (type) {
      case 'players':
        this.playerCache.clear();
        this.batchedPlayerCache.clear();
        console.log('🧹 Player caches cleared');
        break;
      case 'teams':
        this.teamInfoCache.clear();
        console.log('🧹 Team info cache cleared');
        break;
      case 'sleeper':
        this.sleeperDataCache.clear();
        console.log('🧹 Sleeper data cache cleared');
        break;
      case 'expired':
        this.clearExpiredCaches();
        console.log('🧹 Expired caches cleared');
        break;
      case 'all':
      default:
        this.playerCache.clear();
        this.teamInfoCache.clear();
        this.sleeperDataCache.clear();
        this.batchedPlayerCache.clear();
        console.log('🧹 All matchup data pipeline caches cleared');
        break;
    }
  }

  private clearExpiredCaches(): void {
    const now = Date.now();
    
    // Clear expired player cache entries
    for (const [key, entry] of this.playerCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.playerCache.delete(key);
      }
    }
    
    // Clear expired team info cache entries
    for (const [key, entry] of this.teamInfoCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.teamInfoCache.delete(key);
      }
    }
    
    // Clear expired sleeper data cache entries
    for (const [key, entry] of this.sleeperDataCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.sleeperDataCache.delete(key);
      }
    }
    
    // Clear expired batched player cache entries
    for (const [key, entry] of this.batchedPlayerCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.batchedPlayerCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): {
    playerCache: number;
    teamInfoCache: number;
    sleeperDataCache: number;
    batchedPlayerCache: number;
    totalMemoryEstimate: string;
  } {
    return {
      playerCache: this.playerCache.size,
      teamInfoCache: this.teamInfoCache.size,
      sleeperDataCache: this.sleeperDataCache.size,
      batchedPlayerCache: this.batchedPlayerCache.size,
      totalMemoryEstimate: `~${Math.round((this.playerCache.size + this.teamInfoCache.size + this.sleeperDataCache.size + this.batchedPlayerCache.size) * 0.5)}KB`
    };
  }
}

export const matchupDataPipeline = MatchupDataPipeline.getInstance();