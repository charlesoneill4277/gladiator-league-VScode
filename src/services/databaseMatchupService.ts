import { Conference } from './matchupService';

export interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  sleeper_matchup_id: string;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
}

export interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name: string;
  co_owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

export interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
  joined_date: string;
}

export interface EnhancedMatchupData {
  databaseMatchup: DatabaseMatchup;
  team1: Team;
  team2: Team;
  team1Conference: Conference;
  team2Conference: Conference;
  team1RosterId: string;
  team2RosterId: string;
  isInterConference: boolean;
  team1SleeperData?: any;
  team2SleeperData?: any;
}

/**
 * Service for handling database-driven matchups with cross-conference support
 */
class DatabaseMatchupService {
  private teamConferenceCache = new Map<string, TeamConferenceJunction>();
  private teamCache = new Map<number, Team>();
  private conferenceCache = new Map<number, Conference>();

  /**
   * Fetch all database matchups for a specific week
   */
  async fetchDatabaseMatchups(week: number, conferenceIds?: number[]): Promise<DatabaseMatchup[]> {
    try {
      console.log(`🗄️ Fetching database matchups for week ${week}...`);

      const filters = [
      {
        name: 'week',
        op: 'Equal',
        value: week
      }];


      // Add conference filter if specified
      if (conferenceIds && conferenceIds.length > 0) {
        if (conferenceIds.length === 1) {
          filters.push({
            name: 'conference_id',
            op: 'Equal',
            value: conferenceIds[0]
          });
        }
        // For multiple conferences, we'll filter in memory
      }

      const response = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      let matchups = response.data.List as DatabaseMatchup[];

      // Filter by conference IDs if multiple conferences specified
      if (conferenceIds && conferenceIds.length > 1) {
        matchups = matchups.filter((m) => conferenceIds.includes(m.conference_id));
      }

      console.log(`✅ Found ${matchups.length} database matchups for week ${week}`);

      // Identify inter-conference matchups
      const interConferenceCount = await this.countInterConferenceMatchups(matchups);
      console.log(`🌐 Inter-conference matchups: ${interConferenceCount}`);

      return matchups;
    } catch (error) {
      console.error('❌ Error fetching database matchups:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive team-conference mapping
   */
  async buildTeamConferenceMapping(): Promise<Map<string, TeamConferenceJunction>> {
    try {
      console.log('🔗 Building team-conference mapping...');

      const response = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
          name: 'is_active',
          op: 'Equal',
          value: true
        }]

      });

      if (response.error) {
        throw new Error(response.error);
      }

      const junctions = response.data.List as TeamConferenceJunction[];
      const mapping = new Map<string, TeamConferenceJunction>();

      junctions.forEach((junction) => {
        // Map both ways for easy lookup
        mapping.set(`team_${junction.team_id}`, junction);
        mapping.set(`roster_${junction.roster_id}`, junction);
      });

      this.teamConferenceCache = mapping;
      console.log(`✅ Built team-conference mapping with ${mapping.size} entries`);

      return mapping;
    } catch (error) {
      console.error('❌ Error building team-conference mapping:', error);
      throw error;
    }
  }

  /**
   * Fetch all teams
   */
  async fetchTeams(): Promise<Team[]> {
    try {
      console.log('👥 Fetching teams...');

      const response = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 200,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const teams = response.data.List as Team[];

      // Cache teams for quick lookup
      teams.forEach((team) => {
        this.teamCache.set(team.id, team);
      });

      console.log(`✅ Loaded ${teams.length} teams`);
      return teams;
    } catch (error) {
      console.error('❌ Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Fetch conferences by IDs
   */
  async fetchConferences(conferenceIds: number[]): Promise<Conference[]> {
    try {
      console.log(`🏛️ Fetching conferences: ${conferenceIds.join(', ')}`);

      const filters = [];
      if (conferenceIds.length === 1) {
        filters.push({
          name: 'id',
          op: 'Equal',
          value: conferenceIds[0]
        });
      }

      const response = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      let conferences = response.data.List as Conference[];

      // Filter by IDs if multiple conferences
      if (conferenceIds.length > 1) {
        conferences = conferences.filter((c) => conferenceIds.includes(c.id));
      }

      // Cache conferences
      conferences.forEach((conf) => {
        this.conferenceCache.set(conf.id, conf);
      });

      console.log(`✅ Loaded ${conferences.length} conferences`);
      return conferences;
    } catch (error) {
      console.error('❌ Error fetching conferences:', error);
      throw error;
    }
  }

  /**
   * Enhanced matchup processing with full database-to-Sleeper mapping
   */
  async processEnhancedMatchups(
  databaseMatchups: DatabaseMatchup[],
  teamMapping: Map<string, TeamConferenceJunction>,
  teams: Team[])
  : Promise<EnhancedMatchupData[]> {
    console.log(`🚀 Processing ${databaseMatchups.length} enhanced matchups...`);

    const enhancedMatchups: EnhancedMatchupData[] = [];

    for (const dbMatchup of databaseMatchups) {
      try {
        console.log(`📋 Processing matchup ${dbMatchup.id}: Team ${dbMatchup.team_1_id} vs Team ${dbMatchup.team_2_id}`);

        // Get teams from database
        const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
        const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

        if (!team1 || !team2) {
          console.warn(`⚠️ Missing teams for matchup ${dbMatchup.id}`);
          continue;
        }

        // Get team-conference mappings
        const team1Mapping = teamMapping.get(`team_${team1.id}`);
        const team2Mapping = teamMapping.get(`team_${team2.id}`);

        if (!team1Mapping || !team2Mapping) {
          console.warn(`⚠️ Missing roster mappings for matchup ${dbMatchup.id}`);
          continue;
        }

        // Get conferences for each team
        const team1Conference = this.conferenceCache.get(team1Mapping.conference_id);
        const team2Conference = this.conferenceCache.get(team2Mapping.conference_id);

        if (!team1Conference || !team2Conference) {
          console.warn(`⚠️ Missing conference data for matchup ${dbMatchup.id}`);
          continue;
        }

        // Determine if this is an inter-conference matchup
        const isInterConference = team1Mapping.conference_id !== team2Mapping.conference_id;

        if (isInterConference) {
          console.log(`🌐 Inter-conference matchup detected: ${team1Conference.conference_name} vs ${team2Conference.conference_name}`);
        }

        const enhancedMatchup: EnhancedMatchupData = {
          databaseMatchup: dbMatchup,
          team1,
          team2,
          team1Conference,
          team2Conference,
          team1RosterId: team1Mapping.roster_id,
          team2RosterId: team2Mapping.roster_id,
          isInterConference
        };

        enhancedMatchups.push(enhancedMatchup);

        console.log(`✅ Enhanced matchup ${dbMatchup.id}: ${team1.team_name} (${team1Conference.conference_name}) vs ${team2.team_name} (${team2Conference.conference_name})`);

      } catch (error) {
        console.error(`❌ Error processing matchup ${dbMatchup.id}:`, error);
        continue;
      }
    }

    console.log(`🎯 Successfully processed ${enhancedMatchups.length} enhanced matchups`);
    return enhancedMatchups;
  }

  /**
   * Count inter-conference matchups
   */
  private async countInterConferenceMatchups(matchups: DatabaseMatchup[]): Promise<number> {
    if (this.teamConferenceCache.size === 0) {
      await this.buildTeamConferenceMapping();
    }

    let interConferenceCount = 0;

    for (const matchup of matchups) {
      const team1Mapping = this.teamConferenceCache.get(`team_${matchup.team_1_id}`);
      const team2Mapping = this.teamConferenceCache.get(`team_${matchup.team_2_id}`);

      if (team1Mapping && team2Mapping &&
      team1Mapping.conference_id !== team2Mapping.conference_id) {
        interConferenceCount++;
      }
    }

    return interConferenceCount;
  }

  /**
   * Get team's conference ID
   */
  getTeamConferenceId(teamId: number): number | null {
    const mapping = this.teamConferenceCache.get(`team_${teamId}`);
    return mapping ? mapping.conference_id : null;
  }

  /**
   * Get team's roster ID
   */
  getTeamRosterId(teamId: number): string | null {
    const mapping = this.teamConferenceCache.get(`team_${teamId}`);
    return mapping ? mapping.roster_id : null;
  }

  /**
   * Get roster's team ID
   */
  getRosterTeamId(rosterId: string): number | null {
    const mapping = this.teamConferenceCache.get(`roster_${rosterId}`);
    return mapping ? mapping.team_id : null;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.teamConferenceCache.clear();
    this.teamCache.clear();
    this.conferenceCache.clear();
    console.log('🧹 Database matchup service caches cleared');
  }

  /**
   * Validate matchup data integrity
   */
  validateMatchupIntegrity(matchup: EnhancedMatchupData): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate team assignments
    if (!matchup.team1 || !matchup.team2) {
      issues.push('Missing team data');
    }

    // Validate roster mappings
    if (!matchup.team1RosterId || !matchup.team2RosterId) {
      issues.push('Missing roster ID mappings');
    }

    // Validate conference assignments
    if (!matchup.team1Conference || !matchup.team2Conference) {
      issues.push('Missing conference data');
    }

    // Check for inter-conference matchups on appropriate weeks
    if (matchup.isInterConference) {
      const week = matchup.databaseMatchup.week;
      if (week % 3 !== 0 && !matchup.databaseMatchup.is_playoff) {
        warnings.push(`Inter-conference matchup on non-inter-conference week ${week}`);
      }
    }

    // Validate manual override scenarios
    if (matchup.databaseMatchup.is_manual_override) {
      warnings.push('Manual override detected - verify team assignments');
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      warnings
    };
  }

  /**
   * Get comprehensive matchup statistics
   */
  getMatchupStatistics(matchups: EnhancedMatchupData[]): {
    total: number;
    interConference: number;
    intraConference: number;
    manualOverrides: number;
    playoffs: number;
    conferenceBreakdown: Record<string, number>;
  } {
    const stats = {
      total: matchups.length,
      interConference: 0,
      intraConference: 0,
      manualOverrides: 0,
      playoffs: 0,
      conferenceBreakdown: {} as Record<string, number>
    };

    matchups.forEach((matchup) => {
      if (matchup.isInterConference) {
        stats.interConference++;
      } else {
        stats.intraConference++;
      }

      if (matchup.databaseMatchup.is_manual_override) {
        stats.manualOverrides++;
      }

      if (matchup.databaseMatchup.is_playoff) {
        stats.playoffs++;
      }

      // Track conference participation
      const conf1Name = matchup.team1Conference.conference_name;
      const conf2Name = matchup.team2Conference.conference_name;

      stats.conferenceBreakdown[conf1Name] = (stats.conferenceBreakdown[conf1Name] || 0) + 1;
      if (conf1Name !== conf2Name) {
        stats.conferenceBreakdown[conf2Name] = (stats.conferenceBreakdown[conf2Name] || 0) + 1;
      }
    });

    return stats;
  }
}

export default new DatabaseMatchupService();