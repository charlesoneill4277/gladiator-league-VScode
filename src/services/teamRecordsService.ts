import { toast } from '@/hooks/use-toast';

export interface TeamRecord {
  id: number;
  team_id: number;
  conference_id: number;
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
  last_updated: string;
}

export interface MatchupResult {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_playoff: boolean;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
}

export interface StandingsData {
  team_id: number;
  team_name: string;
  owner_name: string;
  conference_name: string;
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
}

export interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
  joined_date: string;
}

class TeamRecordsService {
  private readonly TEAM_RECORDS_TABLE_ID = 13768;
  private readonly MATCHUPS_TABLE_ID = 13329;
  private readonly TEAMS_TABLE_ID = 12852;
  private readonly CONFERENCES_TABLE_ID = 12820;
  private readonly SEASONS_TABLE_ID = 12818;
  private readonly TEAM_CONFERENCES_JUNCTION_TABLE_ID = 12853;

  // Auto-sync flag to prevent infinite loops
  private isAutoSyncing = false;

  /**
   * Get team records for a specific season and conference
   */
  async getTeamRecords(seasonId: number, conferenceId?: number): Promise<TeamRecord[]> {
    try {
      const filters = [
        { name: 'season_id', op: 'Equal', value: seasonId }
      ];

      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(
        this.TEAM_RECORDS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'overall_rank',
          IsAsc: true,
          Filters: filters
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching team records:', error);
      throw error;
    }
  }

  /**
   * Get team-conference junction data
   */
  async getTeamConferenceJunctions(conferenceId?: number): Promise<TeamConferenceJunction[]> {
    try {
      const filters = [
        { name: 'is_active', op: 'Equal', value: true }
      ];

      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(
        this.TEAM_CONFERENCES_JUNCTION_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'id',
          IsAsc: true,
          Filters: filters
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching team-conference junctions:', error);
      throw error;
    }
  }

  /**
   * Calculate team records from matchup results with automatic syncing
   */
  async calculateTeamRecords(seasonId: number, conferenceId?: number, autoSync: boolean = true): Promise<void> {
    try {
      // Prevent infinite loops during auto-sync
      if (autoSync && this.isAutoSyncing) {
        return;
      }

      if (autoSync) {
        this.isAutoSyncing = true;
      }

      // Get all completed matchups for the season
      const matchups = await this.getCompletedMatchups(seasonId, conferenceId);

      // Get team-conference junctions
      const teamConferenceJunctions = await this.getTeamConferenceJunctions(conferenceId);

      // Calculate records for each team
      const teamRecords = new Map<number, {
        wins: number;
        losses: number;
        ties: number;
        points_for: number;
        points_against: number;
        conference_id: number;
      }>();

      // Initialize records for all teams in the conference(s)
      teamConferenceJunctions.forEach((junction) => {
        teamRecords.set(junction.team_id, {
          wins: 0,
          losses: 0,
          ties: 0,
          points_for: 0,
          points_against: 0,
          conference_id: junction.conference_id
        });
      });

      // Process matchups to calculate records
      matchups.forEach((matchup) => {
        const team1Record = teamRecords.get(matchup.team_1_id);
        const team2Record = teamRecords.get(matchup.team_2_id);

        if (team1Record && team2Record) {
          // Update points
          team1Record.points_for += matchup.team_1_score || 0;
          team1Record.points_against += matchup.team_2_score || 0;
          team2Record.points_for += matchup.team_2_score || 0;
          team2Record.points_against += matchup.team_1_score || 0;

          // Update win/loss/tie records
          if (matchup.winner_id === matchup.team_1_id) {
            team1Record.wins++;
            team2Record.losses++;
          } else if (matchup.winner_id === matchup.team_2_id) {
            team2Record.wins++;
            team1Record.losses++;
          } else if (matchup.team_1_score === matchup.team_2_score && matchup.team_1_score > 0) {
            // Tie (both teams have same score and it's not 0)
            team1Record.ties++;
            team2Record.ties++;
          }
        }
      });

      // Update database with calculated records
      await this.updateTeamRecordsInDatabase(seasonId, teamRecords);

      // Calculate and update rankings
      await this.updateTeamRankings(seasonId, conferenceId);

      if (!autoSync) {
        toast({
          title: 'Success',
          description: 'Team records calculated and updated successfully'
        });
      }
    } catch (error) {
      console.error('Error calculating team records:', error);
      if (!autoSync) {
        toast({
          title: 'Error',
          description: 'Failed to calculate team records',
          variant: 'destructive'
        });
      }
      throw error;
    } finally {
      if (autoSync) {
        this.isAutoSyncing = false;
      }
    }
  }

  /**
   * Get completed matchups for record calculation
   */
  private async getCompletedMatchups(seasonId: number, conferenceId?: number): Promise<MatchupResult[]> {
    try {
      const filters = [
        { name: 'status', op: 'Equal', value: 'complete' }
      ];

      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(
        this.MATCHUPS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'week',
          IsAsc: true,
          Filters: filters
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching completed matchups:', error);
      throw error;
    }
  }

  /**
   * Update team records in database
   */
  private async updateTeamRecordsInDatabase(
    seasonId: number,
    teamRecords: Map<number, {
      wins: number;
      losses: number;
      ties: number;
      points_for: number;
      points_against: number;
      conference_id: number;
    }>
  ): Promise<void> {
    try {
      for (const [teamId, record] of teamRecords.entries()) {
        const totalGames = record.wins + record.losses + record.ties;
        const winPercentage = totalGames > 0 ? record.wins / totalGames : 0;

        // Check if record exists
        const existingRecord = await this.getTeamRecord(teamId, seasonId, record.conference_id);

        const recordData = {
          team_id: teamId,
          conference_id: record.conference_id,
          season_id: seasonId,
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          points_for: record.points_for,
          points_against: record.points_against,
          win_percentage: winPercentage,
          playoff_eligible: false, // Will be updated in ranking calculation
          is_conference_champion: false,
          last_updated: new Date().toISOString()
        };

        if (existingRecord) {
          // Update existing record
          await window.ezsite.apis.tableUpdate(this.TEAM_RECORDS_TABLE_ID, {
            ID: existingRecord.id,
            ...recordData
          });
        } else {
          // Create new record
          await window.ezsite.apis.tableCreate(this.TEAM_RECORDS_TABLE_ID, recordData);
        }
      }
    } catch (error) {
      console.error('Error updating team records in database:', error);
      throw error;
    }
  }

  /**
   * Get specific team record
   */
  private async getTeamRecord(teamId: number, seasonId: number, conferenceId: number): Promise<TeamRecord | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.TEAM_RECORDS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1,
          Filters: [
            { name: 'team_id', op: 'Equal', value: teamId },
            { name: 'season_id', op: 'Equal', value: seasonId },
            { name: 'conference_id', op: 'Equal', value: conferenceId }
          ]
        }
      );

      if (error) throw error;
      return data.List?.[0] || null;
    } catch (error) {
      console.error('Error fetching team record:', error);
      return null;
    }
  }

  /**
   * Update team rankings based on records
   */
  private async updateTeamRankings(seasonId: number, conferenceId?: number): Promise<void> {
    try {
      // Get all records for ranking
      const teamRecords = await this.getTeamRecords(seasonId, conferenceId);

      // Group by conference for conference rankings
      const conferenceGroups = new Map<number, TeamRecord[]>();
      teamRecords.forEach((record) => {
        if (!conferenceGroups.has(record.conference_id)) {
          conferenceGroups.set(record.conference_id, []);
        }
        conferenceGroups.get(record.conference_id)!.push(record);
      });

      // Sort and rank within conferences
      for (const [confId, records] of conferenceGroups.entries()) {
        records.sort((a, b) => {
          if (a.win_percentage !== b.win_percentage) {
            return b.win_percentage - a.win_percentage;
          }
          return b.points_for - a.points_for;
        });

        // Update conference rankings
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          await window.ezsite.apis.tableUpdate(this.TEAM_RECORDS_TABLE_ID, {
            ID: record.id,
            conference_rank: i + 1,
            playoff_eligible: i < 4 // Top 4 teams are playoff eligible
          });
        }
      }

      // Calculate overall rankings across all conferences
      const allRecords = Array.from(conferenceGroups.values()).flat();
      allRecords.sort((a, b) => {
        if (a.win_percentage !== b.win_percentage) {
          return b.win_percentage - a.win_percentage;
        }
        return b.points_for - a.points_for;
      });

      // Update overall rankings
      for (let i = 0; i < allRecords.length; i++) {
        const record = allRecords[i];
        await window.ezsite.apis.tableUpdate(this.TEAM_RECORDS_TABLE_ID, {
          ID: record.id,
          overall_rank: i + 1
        });
      }
    } catch (error) {
      console.error('Error updating team rankings:', error);
      throw error;
    }
  }

  /**
   * Complete a matchup and automatically trigger record updates
   */
  async completeMatchup(matchupId: number, team1Score: number, team2Score: number, isManualOverride: boolean = false): Promise<void> {
    try {
      // Get matchup details
      const { data, error } = await window.ezsite.apis.tablePage(
        this.MATCHUPS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: matchupId }]
        }
      );

      if (error) throw error;
      if (!data.List?.[0]) throw new Error('Matchup not found');

      const matchup = data.List[0];

      // Determine winner
      let winnerId = 0;
      if (team1Score > team2Score) {
        winnerId = matchup.team_1_id;
      } else if (team2Score > team1Score) {
        winnerId = matchup.team_2_id;
      }
      // winnerId remains 0 for ties

      // Update matchup with results
      await window.ezsite.apis.tableUpdate(this.MATCHUPS_TABLE_ID, {
        ID: matchupId,
        team_1_score: team1Score,
        team_2_score: team2Score,
        winner_id: winnerId,
        is_manual_override: isManualOverride,
        status: 'complete'
      });

      // Get current season for auto-sync
      const currentSeason = await this.getCurrentSeason();
      
      // Automatically recalculate records for affected teams' conference
      await this.calculateTeamRecords(currentSeason?.id || 1, matchup.conference_id, true);

      toast({
        title: 'Success',
        description: 'Matchup completed and records updated automatically'
      });
    } catch (error) {
      console.error('Error completing matchup:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete matchup',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Get current season
   */
  async getCurrentSeason(): Promise<any> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.SEASONS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1,
          OrderByField: 'season_year',
          IsAsc: false,
          Filters: [{ name: 'is_current_season', op: 'Equal', value: true }]
        }
      );

      if (error) throw error;
      return data.List?.[0] || { id: 1, season_year: 2024 };
    } catch (error) {
      console.error('Error fetching current season:', error);
      return { id: 1, season_year: 2024 };
    }
  }

  /**
   * Initialize automatic sync for existing completed matchups
   */
  async initializeAutoSync(): Promise<void> {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      // Get all conferences
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(
        this.CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (conferencesError) throw conferencesError;
      const conferences = conferencesData.List || [];

      // Calculate records for each conference
      for (const conference of conferences) {
        await this.calculateTeamRecords(currentSeason.id, conference.id, true);
      }

      console.log('Auto-sync initialized successfully');
    } catch (error) {
      console.error('Error initializing auto-sync:', error);
    }
  }

  /**
   * Get standings data with team information
   */
  async getStandingsData(seasonId: number, conferenceId?: number): Promise<StandingsData[]> {
    try {
      // Get team records
      const teamRecords = await this.getTeamRecords(seasonId, conferenceId);

      // Get team details
      const teamPromises = teamRecords.map(async (record) => {
        const { data: teamData } = await window.ezsite.apis.tablePage(
          this.TEAMS_TABLE_ID,
          {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: record.team_id }]
          }
        );

        const { data: conferenceData } = await window.ezsite.apis.tablePage(
          this.CONFERENCES_TABLE_ID,
          {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: record.conference_id }]
          }
        );

        const team = teamData?.List?.[0];
        const conference = conferenceData?.List?.[0];

        return {
          team_id: record.team_id,
          team_name: team?.team_name || 'Unknown Team',
          owner_name: team?.owner_name || 'Unknown Owner',
          conference_name: conference?.conference_name || 'Unknown Conference',
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          points_for: record.points_for,
          points_against: record.points_against,
          win_percentage: record.win_percentage,
          conference_rank: record.conference_rank,
          overall_rank: record.overall_rank,
          playoff_eligible: record.playoff_eligible,
          is_conference_champion: record.is_conference_champion
        };
      });

      const standings = await Promise.all(teamPromises);

      // Sort by overall rank
      standings.sort((a, b) => a.overall_rank - b.overall_rank);

      return standings;
    } catch (error) {
      console.error('Error fetching standings data:', error);
      throw error;
    }
  }

  /**
   * Mark conference champions
   */
  async markConferenceChampions(seasonId: number): Promise<void> {
    try {
      const teamRecords = await this.getTeamRecords(seasonId);

      // Reset all championship flags first
      for (const record of teamRecords) {
        await window.ezsite.apis.tableUpdate(this.TEAM_RECORDS_TABLE_ID, {
          ID: record.id,
          is_conference_champion: false
        });
      }

      // Group by conference and find champions (rank 1 in each conference)
      const conferenceGroups = new Map<number, TeamRecord[]>();
      teamRecords.forEach((record) => {
        if (!conferenceGroups.has(record.conference_id)) {
          conferenceGroups.set(record.conference_id, []);
        }
        conferenceGroups.get(record.conference_id)!.push(record);
      });

      // Mark champions
      for (const [conferenceId, records] of conferenceGroups.entries()) {
        const champion = records.find((r) => r.conference_rank === 1);
        if (champion) {
          await window.ezsite.apis.tableUpdate(this.TEAM_RECORDS_TABLE_ID, {
            ID: champion.id,
            is_conference_champion: true
          });
        }
      }

      toast({
        title: 'Success',
        description: 'Conference champions marked successfully'
      });
    } catch (error) {
      console.error('Error marking conference champions:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark conference champions',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Reset all team records for a season
   */
  async resetTeamRecords(seasonId: number, conferenceId?: number): Promise<void> {
    try {
      const teamRecords = await this.getTeamRecords(seasonId, conferenceId);

      for (const record of teamRecords) {
        await window.ezsite.apis.tableDelete(this.TEAM_RECORDS_TABLE_ID, { ID: record.id });
      }

      toast({
        title: 'Success',
        description: 'Team records reset successfully'
      });
    } catch (error) {
      console.error('Error resetting team records:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset team records',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Get team records summary
   */
  async getRecordsSummary(seasonId: number): Promise<{
    totalTeams: number;
    totalMatchups: number;
    completedMatchups: number;
    pendingMatchups: number;
    recordsLastUpdated: string;
  }> {
    try {
      const [teamRecords, allMatchups, completedMatchups] = await Promise.all([
        this.getTeamRecords(seasonId),
        this.getAllMatchups(seasonId),
        this.getCompletedMatchups(seasonId)
      ]);

      const lastUpdated = teamRecords.reduce((latest, record) => {
        const recordDate = new Date(record.last_updated);
        return recordDate > latest ? recordDate : latest;
      }, new Date(0));

      return {
        totalTeams: teamRecords.length,
        totalMatchups: allMatchups.length,
        completedMatchups: completedMatchups.length,
        pendingMatchups: allMatchups.length - completedMatchups.length,
        recordsLastUpdated: lastUpdated.toISOString()
      };
    } catch (error) {
      console.error('Error getting records summary:', error);
      throw error;
    }
  }

  /**
   * Get all matchups for a season
   */
  private async getAllMatchups(seasonId: number): Promise<MatchupResult[]> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.MATCHUPS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'week',
          IsAsc: true,
          Filters: []
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching all matchups:', error);
      throw error;
    }
  }
}

export const teamRecordsService = new TeamRecordsService();

// Initialize auto-sync on service load
teamRecordsService.initializeAutoSync();
