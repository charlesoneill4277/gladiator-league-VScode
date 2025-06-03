/**
 * MatchupDataService - Handles complex database queries for matchup data
 * Manages relationships between matchups, conferences, teams, and team_conferences_junction tables
 */

export interface MatchupTeam {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
  roster_id: string;
}

export interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  conference_name: string;
  league_id: string;
  team_1: MatchupTeam;
  team_2: MatchupTeam;
}

export interface ConferenceData {
  id: number;
  conference_name: string;
  league_id: string;
  status: string;
}

class MatchupDataService {
  private static instance: MatchupDataService;

  public static getInstance(): MatchupDataService {
    if (!MatchupDataService.instance) {
      MatchupDataService.instance = new MatchupDataService();
    }
    return MatchupDataService.instance;
  }

  /**
   * Get all matchups for a specific week with full team and conference data
   */
  async getMatchupsForWeek(week: number): Promise<DatabaseMatchup[]> {
    try {
      console.log('🔍 Fetching matchups for week:', week);
      
      // First get all matchups for the week
      const matchupsResponse = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: "ID",
        IsAsc: true,
        Filters: [
          {
            name: "week",
            op: "Equal",
            value: week
          }
        ]
      });

      if (matchupsResponse.error) {
        throw new Error(`Failed to fetch matchups: ${matchupsResponse.error}`);
      }

      const matchups = matchupsResponse.data?.List || [];
      console.log('📊 Found matchups:', matchups.length);

      // Get all unique conference IDs and team IDs
      const conferenceIds = [...new Set(matchups.map((m: any) => m.conference_id))];
      const teamIds = [...new Set(matchups.flatMap((m: any) => [m.team_1_id, m.team_2_id]))];

      // Batch fetch conferences
      const conferences = await this.getConferencesByIds(conferenceIds);
      const teams = await this.getTeamsByIds(teamIds);
      
      // Build the complete matchup data
      const completeMatchups: DatabaseMatchup[] = [];

      for (const matchup of matchups) {
        const conference = conferences.find(c => c.id === matchup.conference_id);
        const team1 = teams.find(t => t.id === matchup.team_1_id);
        const team2 = teams.find(t => t.id === matchup.team_2_id);

        if (conference && team1 && team2) {
          completeMatchups.push({
            id: matchup.id,
            conference_id: matchup.conference_id,
            week: matchup.week,
            team_1_id: matchup.team_1_id,
            team_2_id: matchup.team_2_id,
            is_playoff: matchup.is_playoff,
            conference_name: conference.conference_name,
            league_id: conference.league_id,
            team_1: team1,
            team_2: team2
          });
        }
      }

      console.log('✅ Built complete matchups:', completeMatchups.length);
      return completeMatchups;
    } catch (error) {
      console.error('❌ Error fetching matchups for week:', error);
      throw error;
    }
  }

  /**
   * Get conferences by IDs
   */
  private async getConferencesByIds(conferenceIds: number[]): Promise<ConferenceData[]> {
    try {
      const conferences: ConferenceData[] = [];
      
      // Batch fetch conferences
      for (const id of conferenceIds) {
        const response = await window.ezsite.apis.tablePage(12820, {
          PageNo: 1,
          PageSize: 1,
          Filters: [
            {
              name: "id",
              op: "Equal",
              value: id
            }
          ]
        });

        if (response.data?.List?.[0]) {
          conferences.push(response.data.List[0]);
        }
      }

      return conferences;
    } catch (error) {
      console.error('❌ Error fetching conferences:', error);
      throw error;
    }
  }

  /**
   * Get teams with their roster IDs from team_conferences_junction
   */
  private async getTeamsByIds(teamIds: number[]): Promise<MatchupTeam[]> {
    try {
      const teams: MatchupTeam[] = [];

      for (const teamId of teamIds) {
        // Get team data
        const teamResponse = await window.ezsite.apis.tablePage(12852, {
          PageNo: 1,
          PageSize: 1,
          Filters: [
            {
              name: "id",
              op: "Equal",
              value: teamId
            }
          ]
        });

        if (teamResponse.data?.List?.[0]) {
          const team = teamResponse.data.List[0];

          // Get roster ID from team_conferences_junction
          const junctionResponse = await window.ezsite.apis.tablePage(12853, {
            PageNo: 1,
            PageSize: 1,
            Filters: [
              {
                name: "team_id",
                op: "Equal",
                value: teamId
              },
              {
                name: "is_active",
                op: "Equal",
                value: true
              }
            ]
          });

          const roster_id = junctionResponse.data?.List?.[0]?.roster_id || '';

          teams.push({
            id: team.id,
            team_name: team.team_name,
            owner_name: team.owner_name,
            owner_id: team.owner_id,
            team_logo_url: team.team_logo_url,
            team_primary_color: team.team_primary_color,
            team_secondary_color: team.team_secondary_color,
            roster_id: roster_id
          });
        }
      }

      return teams;
    } catch (error) {
      console.error('❌ Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Get all active conferences
   */
  async getActiveConferences(): Promise<ConferenceData[]> {
    try {
      const response = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: "ID",
        IsAsc: true,
        Filters: [
          {
            name: "status",
            op: "Equal",
            value: "in_season"
          }
        ]
      });

      if (response.error) {
        throw new Error(`Failed to fetch conferences: ${response.error}`);
      }

      return response.data?.List || [];
    } catch (error) {
      console.error('❌ Error fetching active conferences:', error);
      throw error;
    }
  }

  /**
   * Get available weeks for matchups
   */
  async getAvailableWeeks(): Promise<number[]> {
    try {
      const response = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: "week", 
        IsAsc: true
      });

      if (response.error) {
        throw new Error(`Failed to fetch weeks: ${response.error}`);
      }

      const matchups = response.data?.List || [];
      const weeks = [...new Set(matchups.map((m: any) => m.week))].sort((a, b) => a - b);
      return weeks;
    } catch (error) {
      console.error('❌ Error fetching available weeks:', error);
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]; // Default weeks
    }
  }
}

export default MatchupDataService;