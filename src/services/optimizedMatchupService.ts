// Optimized Matchup Service with improved performance
import { DatabaseService } from './databaseService';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';
import { DbMatchup, DbConference, DbTeam, DbPlayoffBracket } from '@/types/database';

// Performance-optimized caching layer
class MatchupDataCache {
  private static playerCache: Map<string, SleeperPlayer> = new Map();
  private static cacheTimestamp: number = 0;
  private static conferenceDataCache: Map<string, any> = new Map();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly PLAYER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for players

  static async getPlayers(): Promise<Record<string, SleeperPlayer>> {
    const now = Date.now();
    if (now - this.cacheTimestamp > this.PLAYER_CACHE_DURATION || this.playerCache.size === 0) {
      console.log('🔄 Refreshing player cache...');
      const players = await DatabaseService.getPlayersAsSleeperFormat();
      this.playerCache.clear();
      Object.entries(players).forEach(([id, player]) => {
        this.playerCache.set(id, player);
      });
      this.cacheTimestamp = now;
      console.log(`✅ Player cache refreshed with ${this.playerCache.size} players`);
    } else {
      console.log(`📋 Using cached player data (${this.playerCache.size} players)`);
    }
    
    return Object.fromEntries(this.playerCache);
  }

  static getCachedConferenceData(key: string): any | null {
    const cached = this.conferenceDataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  static setCachedConferenceData(key: string, data: any): void {
    this.conferenceDataCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  static clearCache(): void {
    this.playerCache.clear();
    this.conferenceDataCache.clear();
    this.cacheTimestamp = 0;
  }
}

// Minimal matchup interface for initial load
export interface MinimalMatchup {
  id: number;
  matchup_id: number;
  conference: {
    id: number;
    name: string;
  };
  teams: {
    id: number;
    name: string;
    owner: string;
    points: number;
    roster_id: number;
  }[];
  status: 'live' | 'completed' | 'upcoming';
  week: number;
  is_playoff: boolean;
  is_bye?: boolean;
  playoff_round_name?: string;
}

// Detailed matchup data loaded on-demand
export interface DetailedMatchupData {
  players_points: Record<string, Record<string, number>>;
  starters: Record<string, string[]>;
  bench_players: Record<string, string[]>;
  rosters: Record<string, SleeperRoster>;
  users: Record<string, SleeperUser>;
}

export class OptimizedMatchupService {
  /**
   * Fast initial load - only essential matchup data
   */
  static async getMinimalMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<MinimalMatchup[]> {
    try {
      console.log('🚀 Loading minimal matchups (optimized)...');
      const startTime = performance.now();

      // Batch all database queries in parallel
      const batchData = await this.getMatchupDataBatch(seasonId, week, conferenceId);
      const { conferences, teams, junctions, matchups } = batchData;

      console.log(`📊 Batch data loaded in ${(performance.now() - startTime).toFixed(2)}ms`);

      // Process matchups with minimal data
      const minimalMatchups: MinimalMatchup[] = [];

      for (const dbMatchup of matchups) {
        const conference = conferences.find(c => c.id === dbMatchup.conference_id);
        if (!conference) continue;

        const team1 = teams.find(t => t.id === dbMatchup.team1_id);
        const team2 = dbMatchup.team2_id ? teams.find(t => t.id === dbMatchup.team2_id) : null;

        if (!team1) continue;

        // Get roster IDs for score fetching
        const team1Junction = junctions.find(j => j.team_id === team1.id);
        const team2Junction = team2 ? junctions.find(j => j.team_id === team2.id) : null;

        // Build minimal matchup
        const minimalMatchup: MinimalMatchup = {
          id: dbMatchup.id,
          matchup_id: 0, // Will be populated from Sleeper data if needed
          conference: {
            id: conference.id,
            name: conference.conference_name
          },
          teams: [
            {
              id: team1.id,
              name: team1.team_name,
              owner: team1.owner_name,
              points: dbMatchup.team1_score || 0,
              roster_id: team1Junction?.roster_id || 0
            }
          ],
          status: this.determineMatchupStatus(dbMatchup),
          week: parseInt(dbMatchup.week),
          is_playoff: dbMatchup.is_playoff || false,
          is_bye: dbMatchup.is_bye || false
        };

        // Add team2 if not a bye
        if (team2 && team2Junction && !dbMatchup.is_bye) {
          minimalMatchup.teams.push({
            id: team2.id,
            name: team2.team_name,
            owner: team2.owner_name,
            points: dbMatchup.team2_score || 0,
            roster_id: team2Junction.roster_id
          });
        }

        // Add playoff round name if applicable
        if (week >= 13 && 'playoff_round_name' in dbMatchup) {
          minimalMatchup.playoff_round_name = (dbMatchup as any).playoff_round_name;
        }

        minimalMatchups.push(minimalMatchup);
      }

      console.log(`✅ Minimal matchups loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      return minimalMatchups;

    } catch (error) {
      console.error('Error loading minimal matchups:', error);
      return [];
    }
  }

  /**
   * Load detailed matchup data on-demand (when expanded)
   */
  static async getMatchupDetails(
    matchupId: number,
    seasonId: number,
    week: number
  ): Promise<DetailedMatchupData | null> {
    try {
      console.log(`🔍 Loading details for matchup ${matchupId}...`);
      const startTime = performance.now();

      // Check cache first
      const cacheKey = `details_${matchupId}_${week}`;
      const cached = MatchupDataCache.getCachedConferenceData(cacheKey);
      if (cached) {
        console.log(`📋 Using cached matchup details for ${matchupId}`);
        return cached;
      }

      // Get matchup from database
      const matchupResult = week >= 13 
        ? await DatabaseService.getPlayoffBrackets({
            filters: [{ column: 'id', operator: 'eq', value: matchupId }]
          })
        : await DatabaseService.getMatchups({
            filters: [{ column: 'id', operator: 'eq', value: matchupId }]
          });

      const dbMatchup = matchupResult.data?.[0];
      if (!dbMatchup) return null;

      // Get conference and team data
      const [conferences, teams, junctions] = await Promise.all([
        DatabaseService.getConferences({
          filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
        }),
        DatabaseService.getTeams({ limit: 500 }),
        DatabaseService.getTeamConferenceJunctions({ limit: 1000 })
      ]);

      const conference = conferences.data?.find(c => c.id === dbMatchup.conference_id);
      if (!conference) return null;

      // Fetch Sleeper data for this specific conference
      const [sleeperMatchups, sleeperRosters, sleeperUsers] = await Promise.all([
        SleeperApiService.fetchMatchups(conference.league_id, week),
        SleeperApiService.fetchLeagueRosters(conference.league_id),
        SleeperApiService.fetchLeagueUsers(conference.league_id)
      ]);

      // Build detailed data
      const detailedData: DetailedMatchupData = {
        players_points: {},
        starters: {},
        bench_players: {},
        rosters: {},
        users: {}
      };

      // Process team data
      const team1 = teams.data?.find(t => t.id === dbMatchup.team1_id);
      const team2 = dbMatchup.team2_id ? teams.data?.find(t => t.id === dbMatchup.team2_id) : null;

      if (team1) {
        const team1Junction = junctions.data?.find(j => j.team_id === team1.id);
        if (team1Junction) {
          const team1SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
          const team1Roster = sleeperRosters.find(r => r.roster_id === team1Junction.roster_id);
          const team1User = sleeperUsers.find(u => u.user_id === team1Roster?.owner_id);

          if (team1SleeperMatchup && team1Roster) {
            detailedData.players_points[team1.id.toString()] = team1SleeperMatchup.players_points || {};
            detailedData.starters[team1.id.toString()] = team1SleeperMatchup.starters || [];
            detailedData.bench_players[team1.id.toString()] = (team1Roster.players || [])
              .filter(p => !team1SleeperMatchup.starters?.includes(p));
            detailedData.rosters[team1.id.toString()] = team1Roster;
            if (team1User) detailedData.users[team1.id.toString()] = team1User;
          }
        }
      }

      if (team2) {
        const team2Junction = junctions.data?.find(j => j.team_id === team2.id);
        if (team2Junction) {
          const team2SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
          const team2Roster = sleeperRosters.find(r => r.roster_id === team2Junction.roster_id);
          const team2User = sleeperUsers.find(u => u.user_id === team2Roster?.owner_id);

          if (team2SleeperMatchup && team2Roster) {
            detailedData.players_points[team2.id.toString()] = team2SleeperMatchup.players_points || {};
            detailedData.starters[team2.id.toString()] = team2SleeperMatchup.starters || [];
            detailedData.bench_players[team2.id.toString()] = (team2Roster.players || [])
              .filter(p => !team2SleeperMatchup.starters?.includes(p));
            detailedData.rosters[team2.id.toString()] = team2Roster;
            if (team2User) detailedData.users[team2.id.toString()] = team2User;
          }
        }
      }

      // Cache the result
      MatchupDataCache.setCachedConferenceData(cacheKey, detailedData);

      console.log(`✅ Matchup details loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      return detailedData;

    } catch (error) {
      console.error(`Error loading matchup details for ${matchupId}:`, error);
      return null;
    }
  }

  /**
   * Batch database queries for better performance
   */
  private static async getMatchupDataBatch(
    seasonId: number,
    week: number,
    conferenceId?: number
  ) {
    const queries = [
      DatabaseService.getConferences({
        filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
      }),
      DatabaseService.getTeams({ limit: 500 }),
      DatabaseService.getTeamConferenceJunctions({ limit: 1000 })
    ];

    // Add matchup query based on week
    if (week >= 13) {
      queries.push(
        DatabaseService.getPlayoffBrackets({
          filters: [
            { column: 'season_id', operator: 'eq', value: seasonId },
            { column: 'week', operator: 'eq', value: week }
          ]
        })
      );
    } else {
      const matchupFilters = [
        { column: 'week', operator: 'eq' as const, value: week.toString() }
      ];
      
      if (conferenceId) {
        matchupFilters.push({ column: 'conference_id', operator: 'eq' as const, value: conferenceId });
      }

      queries.push(
        DatabaseService.getMatchups({
          filters: matchupFilters,
          limit: 100
        })
      );
    }

    const [conferences, teams, junctions, matchups] = await Promise.all(queries);

    return {
      conferences: conferences.data || [],
      teams: teams.data || [],
      junctions: junctions.data || [],
      matchups: matchups.data || []
    };
  }

  /**
   * Parallel Sleeper API calls for all conferences
   */
  static async fetchAllConferenceData(conferences: DbConference[], week: number) {
    console.log(`🔗 Fetching Sleeper data for ${conferences.length} conferences in parallel...`);
    const startTime = performance.now();

    const conferencePromises = conferences.map(async (conference) => {
      const cacheKey = `sleeper_${conference.league_id}_${week}`;
      const cached = MatchupDataCache.getCachedConferenceData(cacheKey);
      
      if (cached) {
        return { conference, ...cached };
      }

      try {
        const [matchups, rosters, users] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, week),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)
        ]);

        const data = { matchups, rosters, users };
        MatchupDataCache.setCachedConferenceData(cacheKey, data);
        
        return { conference, ...data };
      } catch (error) {
        console.error(`Error fetching data for conference ${conference.conference_name}:`, error);
        return { conference, matchups: [], rosters: [], users: [] };
      }
    });

    const results = await Promise.all(conferencePromises);
    console.log(`✅ All conference data fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
    
    return results;
  }

  /**
   * Update matchup scores in real-time (optimistic updates)
   */
  static async updateMatchupScores(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<{ matchupId: number; team1Score: number; team2Score: number }[]> {
    try {
      console.log('🔄 Updating matchup scores...');
      
      // Get minimal data needed for score updates
      const conferences = conferenceId 
        ? [await DatabaseService.getConferences({
            filters: [{ column: 'id', operator: 'eq', value: conferenceId }]
          }).then(r => r.data?.[0])]
        : (await DatabaseService.getConferences({
            filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
          })).data || [];

      const scoreUpdates: { matchupId: number; team1Score: number; team2Score: number }[] = [];

      // Fetch current scores from Sleeper API
      for (const conference of conferences.filter(Boolean)) {
        try {
          const sleeperMatchups = await SleeperApiService.fetchMatchups(conference!.league_id, week);
          
          // Map scores back to database matchups
          // This would require additional logic to match Sleeper roster_ids to database team_ids
          // Implementation depends on your specific matching logic
          
        } catch (error) {
          console.error(`Error updating scores for conference ${conference!.conference_name}:`, error);
        }
      }

      return scoreUpdates;
    } catch (error) {
      console.error('Error updating matchup scores:', error);
      return [];
    }
  }

  /**
   * Determine matchup status from database data
   */
  private static determineMatchupStatus(matchup: any): 'live' | 'completed' | 'upcoming' {
    if (matchup.matchup_status === 'completed' || matchup.winning_team_id) {
      return 'completed';
    }
    
    if (matchup.team1_score > 0 || matchup.team2_score > 0) {
      return 'live';
    }
    
    return 'upcoming';
  }

  /**
   * Clear all caches (useful for debugging or forced refresh)
   */
  static clearCache(): void {
    MatchupDataCache.clearCache();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats() {
    return {
      playerCacheSize: MatchupDataCache['playerCache'].size,
      conferenceCacheSize: MatchupDataCache['conferenceDataCache'].size,
      lastPlayerCacheUpdate: MatchupDataCache['cacheTimestamp']
    };
  }
}

export default OptimizedMatchupService;