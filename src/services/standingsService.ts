import { useApp } from '@/contexts/AppContext';

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

export class StandingsService {
  // Map string conference IDs to numeric database IDs
  private static getConferenceIdFromString(conferenceId: string): number | null {
    const mapping: { [key: string]: number } = {
      'mars': 1,
      'jupiter': 2,
      'vulcan': 3
    };
    return mapping[conferenceId] || null;
  }

  static async getStandingsData(seasonYear: number, conferenceId?: string | number): Promise<StandingsData[]> {
    try {
      // First, get the season ID from the seasons table
      const seasonsResponse = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          { name: 'season_year', op: 'Equal', value: seasonYear }
        ]
      });

      if (seasonsResponse.error) {
        throw new Error(seasonsResponse.error);
      }

      const seasons = seasonsResponse.data?.List || [];
      if (seasons.length === 0) {
        console.warn(`No season found for year ${seasonYear}`);
        return [];
      }

      const seasonId = seasons[0].id;

      const filters = [
        { name: 'season_id', op: 'Equal', value: seasonId }
      ];

      if (conferenceId && conferenceId !== 'all') {
        // Convert string conference ID to numeric if needed
        const numericConferenceId = typeof conferenceId === 'string' ? 
          this.getConferenceIdFromString(conferenceId) : conferenceId;
        if (numericConferenceId) {
          filters.push({ name: 'conference_id', op: 'Equal', value: numericConferenceId });
        }
      }

      // Get team records data
      const teamRecordsResponse = await window.ezsite.apis.tablePage(13768, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'overall_rank',
        IsAsc: true,
        Filters: filters
      });

      if (teamRecordsResponse.error) {
        throw new Error(teamRecordsResponse.error);
      }

      const teamRecords = teamRecordsResponse.data?.List || [];

      if (teamRecords.length === 0) {
        console.warn('No team records found');
        return [];
      }

      // Get teams data
      const teamsResponse = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) {
        throw new Error(teamsResponse.error);
      }

      const teams = teamsResponse.data?.List || [];

      // Get conferences data
      const conferencesResponse = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferences = conferencesResponse.data?.List || [];

      // Join the data
      const standingsData: StandingsData[] = teamRecords.map((record: any) => {
        const team = teams.find((t: any) => t.id === record.team_id);
        const conference = conferences.find((c: any) => c.id === record.conference_id);

        return {
          id: record.id,
          team_id: record.team_id,
          team_name: team?.team_name || 'Unknown Team',
          owner_name: team?.owner_name || 'Unknown Owner',
          conference_id: record.conference_id,
          conference_name: conference?.conference_name || 'Unknown Conference',
          season_id: record.season_id,
          wins: record.wins || 0,
          losses: record.losses || 0,
          ties: record.ties || 0,
          points_for: record.points_for || 0,
          points_against: record.points_against || 0,
          win_percentage: record.win_percentage || 0,
          conference_rank: record.conference_rank || 0,
          overall_rank: record.overall_rank || 0,
          playoff_eligible: record.playoff_eligible || false,
          is_conference_champion: record.is_conference_champion || false,
          team_logo_url: team?.team_logo_url || '',
          team_primary_color: team?.team_primary_color || '#1f2937',
          team_secondary_color: team?.team_secondary_color || '#6b7280'
        };
      });

      return standingsData;
    } catch (error) {
      console.error('Error fetching standings data:', error);
      throw error;
    }
  }

  static async getTopStandings(seasonYear: number, limit: number = 5): Promise<StandingsData[]> {
    try {
      const allStandings = await this.getStandingsData(seasonYear);
      
      // Sort by overall rank and return top teams
      return allStandings
        .sort((a, b) => a.overall_rank - b.overall_rank)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top standings:', error);
      throw error;
    }
  }

  static formatRecord(wins: number, losses: number, ties: number = 0): string {
    if (ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  }

  static formatPoints(points: number): string {
    return points.toFixed(1);
  }

  static getWinPercentage(wins: number, losses: number, ties: number = 0): number {
    const totalGames = wins + losses + ties;
    if (totalGames === 0) return 0;
    return (wins + ties * 0.5) / totalGames;
  }
}

export default StandingsService;
