import { DatabaseService } from '@/services/databaseService';
import { DbQueryOptions, DbFilter } from '@/types/database';

/**
 * Migration adapter to provide backward compatibility with EzSite API calls
 * This allows existing code to work with minimal changes while we gradually migrate
 */
export class MigrationAdapter {
  
  /**
   * Convert EzSite tablePage format to Supabase format
   */
  static convertEzSiteOptions(ezSiteOptions: any): DbQueryOptions {
    const options: DbQueryOptions = {};

    // Convert pagination
    if (ezSiteOptions.PageNo && ezSiteOptions.PageSize) {
      options.offset = (ezSiteOptions.PageNo - 1) * ezSiteOptions.PageSize;
      options.limit = ezSiteOptions.PageSize;
    }

    // Convert ordering
    if (ezSiteOptions.OrderByField) {
      options.orderBy = {
        column: ezSiteOptions.OrderByField,
        ascending: ezSiteOptions.IsAsc !== false
      };
    }

    // Convert filters
    if (ezSiteOptions.Filters && Array.isArray(ezSiteOptions.Filters)) {
      options.filters = ezSiteOptions.Filters.map((filter: any) => {
        return {
          column: filter.name,
          operator: MigrationAdapter.convertEzSiteOperator(filter.op),
          value: filter.value
        } as DbFilter;
      });
    }

    return options;
  }

  /**
   * Convert EzSite operators to Supabase operators
   */
  static convertEzSiteOperator(ezSiteOp: string): DbFilter['operator'] {
    const operatorMap: Record<string, DbFilter['operator']> = {
      'Equal': 'eq',
      'NotEqual': 'neq',
      'GreaterThan': 'gt',
      'GreaterThanOrEqual': 'gte',
      'LessThan': 'lt',
      'LessThanOrEqual': 'lte',
      'Contains': 'ilike',
      'In': 'in',
      'IsNull': 'is',
      'IsNotNull': 'not'
    };

    return operatorMap[ezSiteOp] || 'eq';
  }

  /**
   * Convert EzSite table ID to Supabase table name
   */
  static getTableName(tableId: string | number): string {
    const tableMap: Record<string, string> = {
      // Map EzSite table IDs to actual Supabase table names
      '12818': 'seasons',
      '12820': 'conferences',
      '12852': 'teams', 
      '12853': 'team_conference_junction', // Note: your table uses singular
      '13329': 'matchups',
      '13768': 'team_records',
      '12870': 'players',
      // Additional mappings for other tables found in your schema
      'draft_results': 'draft_results',
      'transactions': 'transactions',
      'playoff_bracket': 'playoff_bracket',
      'matchup_admin_override': 'matchup_admin_override',
      'team_rosters': 'team_rosters'
    };

    return tableMap[tableId.toString()] || tableId.toString();
  }

  /**
   * Emulate EzSite tablePage API call
   */
  static async tablePage(tableId: string | number, options: any = {}) {
    const tableName = MigrationAdapter.getTableName(tableId);
    const dbOptions = MigrationAdapter.convertEzSiteOptions(options);
    
    const result = await DatabaseService.queryTable(tableName, dbOptions);
    
    // Format response to match EzSite API structure
    return {
      data: {
        List: result.data,
        TotalCount: result.count || 0
      },
      error: result.error
    };
  }

  /**
   * Emulate EzSite tableCreate API call
   */
  static async tableCreate(tableId: string | number, data: any) {
    const tableName = MigrationAdapter.getTableName(tableId);
    
    // Remove 'ID' field if present (Supabase auto-generates 'id')
    const cleanData = { ...data };
    delete cleanData.ID;
    
    const result = await DatabaseService.createRecord(tableName, cleanData);
    
    return {
      data: result.data,
      error: result.error
    };
  }

  /**
   * Emulate EzSite tableUpdate API call
   */
  static async tableUpdate(tableId: string | number, data: any) {
    const tableName = MigrationAdapter.getTableName(tableId);
    
    if (!data.ID && !data.id) {
      return { error: 'Missing ID for update operation' };
    }

    const id = data.ID || data.id;
    const updateData = { ...data };
    delete updateData.ID;
    delete updateData.id;
    
    const result = await DatabaseService.updateRecord(tableName, id, updateData);
    
    return {
      data: result.data,
      error: result.error
    };
  }

  /**
   * Emulate EzSite tableDelete API call
   */
  static async tableDelete(tableId: string | number, data: any) {
    const tableName = MigrationAdapter.getTableName(tableId);
    
    if (!data.ID && !data.id) {
      return { error: 'Missing ID for delete operation' };
    }

    const id = data.ID || data.id;
    
    const result = await DatabaseService.deleteRecord(tableName, id);
    
    return {
      data: null,
      error: result.error
    };
  }
}

// Create a global replacement for window.ezsite.apis
export const ezsiteApiReplacement = {
  tablePage: MigrationAdapter.tablePage,
  tableCreate: MigrationAdapter.tableCreate,
  tableUpdate: MigrationAdapter.tableUpdate,
  tableDelete: MigrationAdapter.tableDelete
};

export default MigrationAdapter;
