import { DatabaseService } from '@/services/databaseService';
import { DbTeamRecord, DbTeam, DbConference, DbPlayoffFormat } from '@/types/database';

export interface StandingsData {
  team_id: number;
  team_name: string;
  owner_name: string;
  conference_name: string;
  team_logourl: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  win_percentage: number;
  conference_rank: number;
  overall_rank: number;
  playoff_eligible: boolean;
  is_conference_champion: boolean;
}

export class StandingsService {
  
  /**
   * Get standings data for a specific season and optionally conference
   */
  static async getStandingsData(
    seasonId: string | number, 
    conferenceId?: string | number,
    playoffFormat?: DbPlayoffFormat | null
  ): Promise<StandingsData[]> {
    try {
      console.log(`StandingsService: Fetching standings for season ${seasonId}, conference ${conferenceId || 'all'}`);

      // Build filters for team records query
      const filters = [
        { column: 'season_id', operator: 'eq' as const, value: seasonId }
      ];

      if (conferenceId) {
        filters.push({ column: 'conference_id', operator: 'eq' as const, value: conferenceId });
      }

      // Get team records from Supabase
      const teamRecordsResult = await DatabaseService.getTeamRecords({ filters });
      
      if (teamRecordsResult.error) {
        throw new Error(`Failed to fetch team records: ${teamRecordsResult.error}`);
      }

      const teamRecords = teamRecordsResult.data || [];
      console.log(`StandingsService: Found ${teamRecords.length} team records`);

      if (teamRecords.length === 0) {
        console.log('StandingsService: No team records found, returning empty array');
        return [];
      }

      // Get unique team IDs and conference IDs
      const teamIds = [...new Set(teamRecords.map(record => record.team_id))];
      const conferenceIds = [...new Set(teamRecords.map(record => record.conference_id))];

      // Fetch teams and conferences in parallel
      const [teamsResult, conferencesResult] = await Promise.all([
        DatabaseService.getTeams({ 
          filters: [{ column: 'id', operator: 'in' as const, value: teamIds }]
        }),
        DatabaseService.getConferences({ 
          filters: [{ column: 'id', operator: 'in' as const, value: conferenceIds }]
        })
      ]);

      if (teamsResult.error) {
        throw new Error(`Failed to fetch teams: ${teamsResult.error}`);
      }

      if (conferencesResult.error) {
        throw new Error(`Failed to fetch conferences: ${conferencesResult.error}`);
      }

      const teams = teamsResult.data || [];
      const conferences = conferencesResult.data || [];

      // Create lookup maps
      const teamMap = new Map<number, DbTeam>();
      teams.forEach(team => teamMap.set(team.id, team));

      const conferenceMap = new Map<number, DbConference>();
      conferences.forEach(conf => conferenceMap.set(conf.id, conf));

      // Transform data to standings format
      const standingsData: StandingsData[] = teamRecords.map(record => {
        const team = teamMap.get(record.team_id);
        const conference = conferenceMap.get(record.conference_id);

        const wins = record.wins || 0;
        const losses = record.losses || 0;
        const ties = 0; // Assuming ties are not used, but could be added to schema
        const totalGames = wins + losses + ties;
        const winPercentage = totalGames > 0 ? wins / totalGames : 0;

        return {
          team_id: record.team_id,
          team_name: team?.team_name || `Team ${record.team_id}`,
          owner_name: team?.owner_name || 'Unknown Owner',
          conference_name: conference?.conference_name || 'Unknown Conference',
          team_logourl: team?.team_logourl || '',
          wins,
          losses,
          ties,
          points_for: record.points_for || 0,
          points_against: record.points_against || 0,
          point_diff: record.point_diff || ((record.points_for || 0) - (record.points_against || 0)),
          win_percentage: winPercentage,
          conference_rank: 0, // Will be calculated below
          overall_rank: 0, // Will be calculated below
          playoff_eligible: false, // Will be calculated below
          is_conference_champion: false // Will be calculated below
        };
      });

      // Sort by win percentage (desc), then by points_for (desc)
      standingsData.sort((a, b) => {
        if (b.win_percentage !== a.win_percentage) {
          return b.win_percentage - a.win_percentage;
        }
        return b.points_for - a.points_for;
      });

      // Calculate overall ranks
      standingsData.forEach((team, index) => {
        team.overall_rank = index + 1;
      });

      // Calculate conference ranks and identify conference champions
      const conferenceGroups = new Map<string, StandingsData[]>();
      standingsData.forEach(team => {
        if (!conferenceGroups.has(team.conference_name)) {
          conferenceGroups.set(team.conference_name, []);
        }
        conferenceGroups.get(team.conference_name)!.push(team);
      });

      // Rank within conferences and identify conference champions
      conferenceGroups.forEach((teams, conferenceName) => {
        teams.sort((a, b) => {
          if (b.win_percentage !== a.win_percentage) {
            return b.win_percentage - a.win_percentage;
          }
          return b.points_for - a.points_for;
        });

        teams.forEach((team, index) => {
          team.conference_rank = index + 1;
          // Conference champion is #1 in conference
          team.is_conference_champion = index === 0;
        });
      });

      // Calculate playoff eligibility with new seeding logic
      // Seeds 1-3: Conference Champions (guaranteed spots)
      // Seeds 4+: Next best teams by overall standings (including Conference Championship losers)
      const conferenceChampions = standingsData.filter(team => team.is_conference_champion);
      const nonChampions = standingsData.filter(team => !team.is_conference_champion);
      
      // All conference champions make playoffs
      conferenceChampions.forEach(team => {
        team.playoff_eligible = true;
      });
      
      // Determine how many additional playoff spots are available
      const totalPlayoffTeams = playoffFormat?.playoff_teams || 10; // Use playoff format or default to 10
      const remainingPlayoffSpots = totalPlayoffTeams - conferenceChampions.length;
      
      // Award remaining playoff spots to top non-champions by overall rank
      nonChampions.slice(0, remainingPlayoffSpots).forEach(team => {
        team.playoff_eligible = true;
      });
      
      // Mark remaining teams as not playoff eligible
      nonChampions.slice(remainingPlayoffSpots).forEach(team => {
        team.playoff_eligible = false;
      });

      console.log(`StandingsService: Returning ${standingsData.length} standings records`);
      return standingsData;

    } catch (error) {
      console.error('StandingsService: Error fetching standings data:', error);
      throw error;
    }
  }

  /**
   * Get standings for a specific conference only
   */
  static async getConferenceStandings(
    seasonId: string | number, 
    conferenceId: string | number,
    playoffFormat?: DbPlayoffFormat | null
  ): Promise<StandingsData[]> {
    return this.getStandingsData(seasonId, conferenceId, playoffFormat);
  }

  /**
   * Get overall league standings (all conferences)
   */
  static async getLeagueStandings(
    seasonId: string | number,
    playoffFormat?: DbPlayoffFormat | null
  ): Promise<StandingsData[]> {
    return this.getStandingsData(seasonId, undefined, playoffFormat);
  }

  /**
   * Format team record as "W-L" or "W-L-T" format
   */
  static formatRecord(wins: number, losses: number, ties: number = 0): string {
    if (ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  }

  /**
   * Format points with proper decimal places
   */
  static formatPoints(points: number): string {
    return points.toFixed(1);
  }
}

export default StandingsService;