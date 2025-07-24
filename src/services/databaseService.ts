import { supabase, TABLES } from '@/lib/supabase';
import { 
  DbQueryOptions, 
  DbFilter, 
  PaginatedResponse,
  DbSeason,
  DbConference,
  DbTeam,
  DbTeamConferenceJunction,
  DbMatchup,
  DbTeamRecord,
  DbPlayer,
  DbDraftResult,
  DbMatchupAdminOverride,
  DbTransaction,
  DbPlayoffBracket
} from '@/types/database';

/**
 * Generic database service for Supabase operations
 * Replaces the EzSite API functionality
 */
export class DatabaseService {
  
  /**
   * Generic method to fetch paginated data from any table
   */
  static async queryTable<T>(
    tableName: string, 
    options: DbQueryOptions = {}
  ): Promise<PaginatedResponse<T>> {
    try {
      let query = supabase.from(tableName).select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        options.filters.forEach(filter => {
          query = this.applyFilter(query, filter);
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending 
        });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error(`Error querying ${tableName}:`, error);
        return { data: [], error };
      }

      return { data: data || [], count: count || 0 };
    } catch (error) {
      console.error(`Error in queryTable for ${tableName}:`, error);
      return { data: [], error };
    }
  }

  /**
   * Generic method to create a record in any table
   */
  static async createRecord<T>(tableName: string, data: Partial<T>): Promise<{ data: T | null; error: any }> {
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error(`Error creating record in ${tableName}:`, error);
        return { data: null, error };
      }

      return { data: result, error: null };
    } catch (error) {
      console.error(`Error in createRecord for ${tableName}:`, error);
      return { data: null, error };
    }
  }

  /**
   * Generic method to update a record in any table
   */
  static async updateRecord<T>(
    tableName: string, 
    id: number, 
    data: Partial<T>
  ): Promise<{ data: T | null; error: any }> {
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating record in ${tableName}:`, error);
        return { data: null, error };
      }

      return { data: result, error: null };
    } catch (error) {
      console.error(`Error in updateRecord for ${tableName}:`, error);
      return { data: null, error };
    }
  }

  /**
   * Generic method to delete a record from any table
   */
  static async deleteRecord(tableName: string, id: number): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error deleting record from ${tableName}:`, error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error(`Error in deleteRecord for ${tableName}:`, error);
      return { error };
    }
  }

  /**
   * Helper method to apply filters to Supabase queries
   */
  private static applyFilter(query: any, filter: DbFilter) {
    const { column, operator, value } = filter;
    
    switch (operator) {
      case 'eq':
        return query.eq(column, value);
      case 'neq':
        return query.neq(column, value);
      case 'gt':
        return query.gt(column, value);
      case 'gte':
        return query.gte(column, value);
      case 'lt':
        return query.lt(column, value);
      case 'lte':
        return query.lte(column, value);
      case 'like':
        return query.like(column, value);
      case 'ilike':
        return query.ilike(column, value);
      case 'in':
        return query.in(column, value);
      case 'is':
        return query.is(column, value);
      case 'not':
        return query.not(column, value);
      default:
        return query;
    }
  }

  // Specific methods for each table (convenience methods)

  /**
   * Seasons table operations
   */
  static async getSeasons(options?: DbQueryOptions): Promise<PaginatedResponse<DbSeason>> {
    return this.queryTable<DbSeason>(TABLES.SEASONS, options);
  }

  static async createSeason(data: Partial<DbSeason>): Promise<{ data: DbSeason | null; error: any }> {
    return this.createRecord<DbSeason>(TABLES.SEASONS, data);
  }

  static async updateSeason(id: number, data: Partial<DbSeason>): Promise<{ data: DbSeason | null; error: any }> {
    return this.updateRecord<DbSeason>(TABLES.SEASONS, id, data);
  }

  /**
   * Conferences table operations
   */
  static async getConferences(options?: DbQueryOptions): Promise<PaginatedResponse<DbConference>> {
    return this.queryTable<DbConference>(TABLES.CONFERENCES, options);
  }

  static async createConference(data: Partial<DbConference>): Promise<{ data: DbConference | null; error: any }> {
    return this.createRecord<DbConference>(TABLES.CONFERENCES, data);
  }

  static async updateConference(id: number, data: Partial<DbConference>): Promise<{ data: DbConference | null; error: any }> {
    return this.updateRecord<DbConference>(TABLES.CONFERENCES, id, data);
  }

  /**
   * Teams table operations
   */
  static async getTeams(options?: DbQueryOptions): Promise<PaginatedResponse<DbTeam>> {
    return this.queryTable<DbTeam>(TABLES.TEAMS, options);
  }

  static async createTeam(data: Partial<DbTeam>): Promise<{ data: DbTeam | null; error: any }> {
    return this.createRecord<DbTeam>(TABLES.TEAMS, data);
  }

  static async updateTeam(id: number, data: Partial<DbTeam>): Promise<{ data: DbTeam | null; error: any }> {
    return this.updateRecord<DbTeam>(TABLES.TEAMS, id, data);
  }

  /**
   * Team-Conference Junction table operations
   */
  static async getTeamConferenceJunctions(options?: DbQueryOptions): Promise<PaginatedResponse<DbTeamConferenceJunction>> {
    return this.queryTable<DbTeamConferenceJunction>(TABLES.TEAM_CONFERENCE_JUNCTION, options);
  }

  static async createTeamConferenceJunction(data: Partial<DbTeamConferenceJunction>): Promise<{ data: DbTeamConferenceJunction | null; error: any }> {
    return this.createRecord<DbTeamConferenceJunction>(TABLES.TEAM_CONFERENCE_JUNCTION, data);
  }

  /**
   * Matchups table operations
   */
  static async getMatchups(options?: DbQueryOptions): Promise<PaginatedResponse<DbMatchup>> {
    return this.queryTable<DbMatchup>(TABLES.MATCHUPS, options);
  }

  static async createMatchup(data: Partial<DbMatchup>): Promise<{ data: DbMatchup | null; error: any }> {
    return this.createRecord<DbMatchup>(TABLES.MATCHUPS, data);
  }

  static async updateMatchup(id: number, data: Partial<DbMatchup>): Promise<{ data: DbMatchup | null; error: any }> {
    return this.updateRecord<DbMatchup>(TABLES.MATCHUPS, id, data);
  }

  /**
   * Team Records table operations
   */
  static async getTeamRecords(options?: DbQueryOptions): Promise<PaginatedResponse<DbTeamRecord>> {
    return this.queryTable<DbTeamRecord>(TABLES.TEAM_RECORDS, options);
  }

  static async createTeamRecord(data: Partial<DbTeamRecord>): Promise<{ data: DbTeamRecord | null; error: any }> {
    return this.createRecord<DbTeamRecord>(TABLES.TEAM_RECORDS, data);
  }

  static async updateTeamRecord(id: number, data: Partial<DbTeamRecord>): Promise<{ data: DbTeamRecord | null; error: any }> {
    return this.updateRecord<DbTeamRecord>(TABLES.TEAM_RECORDS, id, data);
  }

  static async deleteTeamRecord(id: number): Promise<{ error: any }> {
    return this.deleteRecord(TABLES.TEAM_RECORDS, id);
  }

  /**
   * Players table operations
   */
  static async getPlayers(options?: DbQueryOptions): Promise<PaginatedResponse<DbPlayer>> {
    try {
      let query = supabase.from(TABLES.PLAYERS).select('*', { count: 'exact' });

      // Apply filters
      if (options?.filters) {
        options.filters.forEach(filter => {
          query = this.applyFilter(query, filter);
        });
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending 
        });
      }

      // Override the default 1000-row limit to get all players
      query = query.range(0, 14999);

      const { data, error, count } = await query;

      if (error) {
        console.error(`Error querying ${TABLES.PLAYERS}:`, error);
        return { data: [], error };
      }

      return { data: data || [], count: count || 0 };
    } catch (error) {
      console.error(`Error in getPlayers:`, error);
      return { data: [], error };
    }
  }

  static async createPlayer(data: Partial<DbPlayer>): Promise<{ data: DbPlayer | null; error: any }> {
    return this.createRecord<DbPlayer>(TABLES.PLAYERS, data);
  }

  static async updatePlayer(id: number, data: Partial<DbPlayer>): Promise<{ data: DbPlayer | null; error: any }> {
    return this.updateRecord<DbPlayer>(TABLES.PLAYERS, id, data);
  }

  /**
   * Dedicated method for fetching ALL players for transaction mapping
   * This ensures we get complete coverage regardless of table size
   */
  static async getAllPlayersForMapping(filters?: DbFilter[]): Promise<DbPlayer[]> {
    try {
      const allPlayers: DbPlayer[] = [];
      const batchSize = 1000;
      let currentOffset = 0;
      let hasMoreData = true;
      
      while (hasMoreData) {
        let query = supabase.from(TABLES.PLAYERS).select('*');

        // Apply filters if provided
        if (filters) {
          filters.forEach(filter => {
            query = this.applyFilter(query, filter);
          });
        }

        // Order by sleeper_id for consistent pagination
        query = query.order('sleeper_id', { ascending: true });
        
        // Use range for this batch
        query = query.range(currentOffset, currentOffset + batchSize - 1);

        const { data, error } = await query;

        if (error) {
          console.error(`Error in getAllPlayersForMapping:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allPlayers.push(...data);
          
          // If we got fewer results than requested, we're done
          if (data.length < batchSize) {
            hasMoreData = false;
          } else {
            currentOffset += batchSize;
          }
        } else {
          hasMoreData = false;
        }
      }

      return allPlayers;
      
    } catch (error) {
      console.error(`Error in getAllPlayersForMapping:`, error);
      throw error;
    }
  }

  /**
   * Get all players formatted as Sleeper API response for compatibility
   */
  static async getPlayersAsSleeperFormat(): Promise<Record<string, any>> {
    try {
      const response = await this.getPlayers();
      if (!response.data) {
        throw new Error('Failed to fetch players from database');
      }

      const playersRecord: Record<string, any> = {};
      
      response.data.forEach(player => {
        if (player.sleeper_id) {
          // Parse first and last name from player_name
          const nameParts = player.player_name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          playersRecord[player.sleeper_id] = {
            player_id: player.sleeper_id,
            first_name: firstName,
            last_name: lastName,
            position: player.position || '',
            team: player.nfl_team || '',
            jersey_number: player.number || 0,
            status: player.playing_status || '',
            injury_status: player.injury_status || '',
            age: player.age || 0,
            height: player.height?.toString() || '',
            weight: player.weight || 0,
            years_exp: 0, // Not available in database
            college: player.college || ''
          };
        }
      });

      return playersRecord;
    } catch (error) {
      console.error('Error fetching players from database:', error);
      throw error;
    }
  }

  /**
   * Draft Results table operations
   */
  static async getDraftResults(options?: DbQueryOptions): Promise<PaginatedResponse<DbDraftResult>> {
    return this.queryTable<DbDraftResult>(TABLES.DRAFT_RESULTS, options);
  }

  static async createDraftResult(data: Partial<DbDraftResult>): Promise<{ data: DbDraftResult | null; error: any }> {
    return this.createRecord<DbDraftResult>(TABLES.DRAFT_RESULTS, data);
  }

  /**
   * Matchup Admin Override table operations
   */
  static async getMatchupAdminOverrides(options?: DbQueryOptions): Promise<PaginatedResponse<DbMatchupAdminOverride>> {
    return this.queryTable<DbMatchupAdminOverride>(TABLES.MATCHUP_ADMIN_OVERRIDE, options);
  }

  static async createMatchupAdminOverride(data: Partial<DbMatchupAdminOverride>): Promise<{ data: DbMatchupAdminOverride | null; error: any }> {
    return this.createRecord<DbMatchupAdminOverride>(TABLES.MATCHUP_ADMIN_OVERRIDE, data);
  }

  static async updateMatchupAdminOverride(id: number, data: Partial<DbMatchupAdminOverride>): Promise<{ data: DbMatchupAdminOverride | null; error: any }> {
    return this.updateRecord<DbMatchupAdminOverride>(TABLES.MATCHUP_ADMIN_OVERRIDE, id, data);
  }

  static async deleteMatchupAdminOverride(id: number): Promise<{ error: any }> {
    return this.deleteRecord(TABLES.MATCHUP_ADMIN_OVERRIDE, id);
  }

  /**
   * Transactions table operations
   */
  static async getTransactions(options?: DbQueryOptions): Promise<PaginatedResponse<DbTransaction>> {
    return this.queryTable<DbTransaction>(TABLES.TRANSACTIONS, options);
  }

  static async createTransaction(data: Partial<DbTransaction>): Promise<{ data: DbTransaction | null; error: any }> {
    return this.createRecord<DbTransaction>(TABLES.TRANSACTIONS, data);
  }

  /**
   * Playoff Brackets table operations
   */
  static async getPlayoffBrackets(options?: DbQueryOptions): Promise<PaginatedResponse<DbPlayoffBracket>> {
    return this.queryTable<DbPlayoffBracket>(TABLES.PLAYOFF_BRACKETS, options);
  }

  static async createPlayoffBracket(data: Partial<DbPlayoffBracket>): Promise<{ data: DbPlayoffBracket | null; error: any }> {
    return this.createRecord<DbPlayoffBracket>(TABLES.PLAYOFF_BRACKETS, data);
  }
}

// Export database types for components
export type {
  DbSeason,
  DbConference,
  DbTeam,
  DbMatchup,
  DbTeamRecord,
  DbPlayer,
  DbDraftResult,
  DbMatchupAdminOverride,
  DbTransaction,
  DbTeamConferenceJunction,
  DbPlayoffBracket
};

// Service aliases for backward compatibility
export const SupabaseMatchupService = DatabaseService;

export default DatabaseService;
