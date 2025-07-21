import { DatabaseService } from '@/services/databaseService';
import { DbSeason, DbConference, DbTeam, DbTeamRecord } from '@/types/database';

export interface StandingsData {
  id: number;
  team_id: number;
  team_name: string;
  owner_name: string;
  conference_id: number;
  conference_name: string;
  season_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  win_percentage: number;
  conference_rank: number;
  overall_rank: number;
  playoff_eligible: boolean;
  is_conference_champion: boolean;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

/**
 * Enhanced Standings Service using native Supabase calls
 * This replaces the old standingsService.ts with direct database operations
 */
export class SupabaseStandingsService {
  
  /**
   * Get standings data for a specific season and optionally filter by conference
   */
  static async getStandingsData(seasonYear: number, conferenceId?: string | number): Promise<StandingsData[]> {
    try {
      // First, get the season
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: seasonYear }],
        limit: 1
      });

      if (seasons.length === 0) {
        console.warn(`No season found for year ${seasonYear}`);
        return [];
      }

      const season = seasons[0];

      // Build filters for team records
      const teamRecordFilters = [
        { column: 'season_id', operator: 'eq' as const, value: season.id }
      ];

      // Add conference filter if specified
      if (conferenceId && conferenceId !== 'all') {
        const numericConferenceId = typeof conferenceId === 'string' 
          ? this.getConferenceIdFromString(conferenceId) 
          : conferenceId;
        
        if (numericConferenceId) {
          teamRecordFilters.push({ 
            column: 'conference_id', 
            operator: 'eq' as const, 
            value: numericConferenceId 
          });
        }
      }

      // Get team records with join data
      const standingsData = await this.getStandingsWithJoins(season.id, teamRecordFilters);

      // Calculate additional fields
      return this.enhanceStandingsData(standingsData);

    } catch (error) {
      console.error('Error fetching standings data:', error);
      throw error;
    }
  }

  /**
   * Get top standings across all conferences
   */
  static async getTopStandings(seasonYear: number, limit: number): Promise<StandingsData[]> {
    try {
      const allStandings = await this.getStandingsData(seasonYear);
      
      // Sort by overall rank and return top N
      return allStandings
        .sort((a, b) => a.overall_rank - b.overall_rank)
        .slice(0, limit);
        
    } catch (error) {
      console.error('Error fetching top standings:', error);
      throw error;
    }
  }

  /**
   * Get conference champions for a season
   */
  static async getConferenceChampions(seasonYear: number): Promise<StandingsData[]> {
    try {
      const allStandings = await this.getStandingsData(seasonYear);
      
      // Get the top team from each conference
      const conferenceChampions = new Map<number, StandingsData>();
      
      allStandings.forEach(team => {
        const currentChamp = conferenceChampions.get(team.conference_id);
        if (!currentChamp || team.conference_rank < currentChamp.conference_rank) {
          conferenceChampions.set(team.conference_id, {
            ...team,
            is_conference_champion: true
          });
        }
      });

      return Array.from(conferenceChampions.values());
      
    } catch (error) {
      console.error('Error fetching conference champions:', error);
      throw error;
    }
  }

  /**
   * Refresh standings data by recalculating from matchup results
   */
  static async refreshStandings(seasonId: number): Promise<void> {
    // This would implement the standings calculation logic
    // For now, this is a placeholder that would recalculate team records
    // based on completed matchups
    console.log(`Refreshing standings for season ${seasonId}`);
    // Implementation would go here
  }

  /**
   * Private helper methods
   */

  private static async getStandingsWithJoins(
    seasonId: number, 
    teamRecordFilters: any[]
  ): Promise<any[]> {
    // For now, we'll do separate queries and join in memory
    // In the future, this could be optimized with a Supabase view or function
    
    // Get team records
    const { data: teamRecords } = await DatabaseService.getTeamRecords({
      filters: teamRecordFilters,
      orderBy: { column: 'wins', ascending: false }
    });

    // Get all teams
    const teamIds = teamRecords.map(record => record.team_id);
    const { data: teams } = await DatabaseService.getTeams({
      filters: [{ column: 'id', operator: 'in', value: teamIds }]
    });

    // Get all conferences
    const conferenceIds = teamRecords.map(record => record.conference_id);
    const { data: conferences } = await DatabaseService.getConferences({
      filters: [{ column: 'id', operator: 'in', value: conferenceIds }]
    });

    // Join the data
    return teamRecords.map(record => {
      const team = teams.find(t => t.id === record.team_id);
      const conference = conferences.find(c => c.id === record.conference_id);
      
      return {
        ...record,
        team_name: team?.team_name || 'Unknown Team',
        owner_name: team?.owner_name || 'Unknown Owner',
        team_logo_url: team?.team_logo_url || '',
        conference_name: conference?.conference_name || 'Unknown Conference'
      };
    });
  }

  private static enhanceStandingsData(rawData: any[]): StandingsData[] {
    return rawData.map((record, index) => {
      const totalGames = record.wins + record.losses + record.ties;
      const winPercentage = totalGames > 0 ? record.wins / totalGames : 0;
      
      return {
        id: record.id,
        team_id: record.team_id,
        team_name: record.team_name,
        owner_name: record.owner_name,
        conference_id: record.conference_id,
        conference_name: record.conference_name,
        season_id: record.season_id,
        wins: record.wins || 0,
        losses: record.losses || 0,
        ties: record.ties || 0,
        points_for: record.points_for || 0,
        points_against: record.points_against || 0,
        win_percentage: winPercentage,
        conference_rank: index + 1, // This would need proper conference-specific ranking
        overall_rank: index + 1,
        playoff_eligible: winPercentage >= 0.5, // Simplified logic
        is_conference_champion: false, // Would be calculated separately
        team_logo_url: record.team_logo_url || '',
        team_primary_color: '#000000', // Default colors - could be stored in teams table
        team_secondary_color: '#ffffff'
      } as StandingsData;
    });
  }

  private static getConferenceIdFromString(conferenceId: string): number | null {
    // This mapping would ideally come from the database
    // For now, using the same logic as the original service
    const mapping: {[key: string]: number} = {
      'mars': 1,
      'jupiter': 2,
      'vulcan': 3
    };
    return mapping[conferenceId] || null;
  }
}

export default SupabaseStandingsService;
