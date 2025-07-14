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
   * Get team records for a specific season and conference with proper filtering
   */
  async getTeamRecords(seasonId: number, conferenceId?: number): Promise<TeamRecord[]> {
    try {
      // Validate season exists
      const season = await this.getSeasonById(seasonId);
      if (!season) {
        throw new Error(`Season with ID ${seasonId} not found`);
      }

      const filters = [
        { name: 'season_id', op: 'Equal', value: seasonId }
      ];

      if (conferenceId) {
        // Validate conference exists and is in the correct season
        const conference = await this.getConferenceById(conferenceId);
        if (!conference) {
          throw new Error(`Conference with ID ${conferenceId} not found`);
        }
        if (conference.season_id !== seasonId) {
          throw new Error(`Conference ${conferenceId} does not belong to season ${seasonId}`);
        }
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(
        this.TEAM_RECORDS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
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
   * Get team-conference junction data with proper filtering
   */
  async getTeamConferenceJunctions(seasonId: number, conferenceId?: number): Promise<TeamConferenceJunction[]> {
    try {
      // First get conferences for the season
      const conferences = await this.getConferencesForSeason(seasonId);
      const validConferenceIds = conferences.map(c => c.id);

      if (conferenceId && !validConferenceIds.includes(conferenceId)) {
        throw new Error(`Conference ${conferenceId} does not exist in season ${seasonId}`);
      }

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
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: filters
        }
      );

      if (error) throw error;
      
      // Filter by valid conference IDs for the season
      const junctions = (data.List || []).filter(junction => 
        validConferenceIds.includes(junction.conference_id)
      );

      return junctions;
    } catch (error) {
      console.error('Error fetching team-conference junctions:', error);
      throw error;
    }
  }

  /**
   * Calculate team records from matchup results with proper season-conference filtering
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

      // Validate season exists
      const season = await this.getSeasonById(seasonId);
      if (!season) {
        throw new Error(`Season with ID ${seasonId} not found`);
      }

      // Get conferences for this season
      const conferences = await this.getConferencesForSeason(seasonId);
      const conferencesToProcess = conferenceId 
        ? conferences.filter(c => c.id === conferenceId)
        : conferences;

      if (conferencesToProcess.length === 0) {
        throw new Error(`No conferences found for season ${seasonId}`);
      }

      // Process each conference
      for (const conference of conferencesToProcess) {
        await this.calculateTeamRecordsForConference(seasonId, conference.id);
      }

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
   * Calculate team records for a specific conference
   */
  private async calculateTeamRecordsForConference(seasonId: number, conferenceId: number): Promise<void> {
    try {
      // Get all completed matchups for this conference
      const matchups = await this.getCompletedMatchups(seasonId, conferenceId);
      
      // Get team-conference junctions for this specific conference and season
      const teamConferenceJunctions = await this.getTeamConferenceJunctions(seasonId, conferenceId);

      // Calculate records for each team
      const teamRecords = new Map<number, {
        wins: number;
        losses: number;
        ties: number;
        points_for: number;
        points_against: number;
        conference_id: number;
      }>();

      // Initialize records for all teams in this conference
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
      await this.updateTeamRecordsInDatabase(seasonId, conferenceId, teamRecords);
    } catch (error) {
      console.error(`Error calculating team records for conference ${conferenceId}:`, error);
      throw error;
    }
  }

  /**
   * Get completed matchups for record calculation with proper filtering
   */
  private async getCompletedMatchups(seasonId: number, conferenceId: number): Promise<MatchupResult[]> {
    try {
      const filters = [
        { name: 'conference_id', op: 'Equal', value: conferenceId },
        { name: 'status', op: 'Equal', value: 'complete' }
      ];

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
   * Update team records in database with upsert logic
   */
  private async updateTeamRecordsInDatabase(
    seasonId: number,
    conferenceId: number,
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

        // Check if record exists (proper upsert logic)
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
   * Update team rankings based on records with proper seasonal filtering
   */
  private async updateTeamRankings(seasonId: number, conferenceId?: number): Promise<void> {
    try {
      // Get all records for ranking with proper seasonal filtering
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

      // Calculate overall rankings across all conferences for this season
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
   * Get standings data with proper season-conference filtering
   */
  async getStandingsData(seasonId: number, conferenceId?: number): Promise<StandingsData[]> {
    try {
      // Validate season exists
      const season = await this.getSeasonById(seasonId);
      if (!season) {
        throw new Error(`Season with ID ${seasonId} not found`);
      }

      // Get team records with proper filtering
      const teamRecords = await this.getTeamRecords(seasonId, conferenceId);

      // Get team-conference junctions to ensure we only include valid relationships
      const teamConferenceJunctions = await this.getTeamConferenceJunctions(seasonId, conferenceId);
      const validTeamConferenceRelationships = new Set<string>();
      teamConferenceJunctions.forEach(junction => {
        validTeamConferenceRelationships.add(`${junction.team_id}_${junction.conference_id}`);
      });

      // Filter team records to only include those with valid relationships
      const validTeamRecords = teamRecords.filter(record => {
        const key = `${record.team_id}_${record.conference_id}`;
        return validTeamConferenceRelationships.has(key);
      });

      // Get team details in batches to avoid too many API calls
      const teamDetailsMap = new Map<number, any>();
      const conferenceDetailsMap = new Map<number, any>();

      // Fetch all teams
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(
        this.TEAMS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (teamsError) throw teamsError;
      (teamsData.List || []).forEach(team => {
        teamDetailsMap.set(team.id, team);
      });

      // Fetch all conferences
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(
        this.CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (conferencesError) throw conferencesError;
      (conferencesData.List || []).forEach(conference => {
        conferenceDetailsMap.set(conference.id, conference);
      });

      // Build standings data
      const standings: StandingsData[] = validTeamRecords.map(record => {
        const team = teamDetailsMap.get(record.team_id);
        const conference = conferenceDetailsMap.get(record.conference_id);

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

      // Sort by overall rank
      standings.sort((a, b) => a.overall_rank - b.overall_rank);

      return standings;
    } catch (error) {
      console.error('Error fetching standings data:', error);
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
   * Initialize automatic sync for existing completed matchups
   */
  async initializeAutoSync(): Promise<void> {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      if (!currentSeason) {
        console.warn('No current season found, skipping auto-sync initialization');
        return;
      }

      // Get all conferences for the current season
      const conferences = await this.getConferencesForSeason(currentSeason.id);

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
   * Get team records summary with proper filtering
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
        this.getAllMatchupsForSeason(seasonId),
        this.getCompletedMatchupsForSeason(seasonId)
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

  // Helper methods for better organization
  private async getSeasonById(seasonId: number): Promise<any> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.SEASONS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: seasonId }]
        }
      );

      if (error) throw error;
      return data.List?.[0] || null;
    } catch (error) {
      console.error('Error fetching season:', error);
      return null;
    }
  }

  private async getConferenceById(conferenceId: number): Promise<any> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: conferenceId }]
        }
      );

      if (error) throw error;
      return data.List?.[0] || null;
    } catch (error) {
      console.error('Error fetching conference:', error);
      return null;
    }
  }

  private async getConferencesForSeason(seasonId: number): Promise<any[]> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(
        this.CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: [{ name: 'season_id', op: 'Equal', value: seasonId }]
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching conferences for season:', error);
      return [];
    }
  }

  private async getAllMatchupsForSeason(seasonId: number): Promise<MatchupResult[]> {
    try {
      // Get conferences for this season
      const conferences = await this.getConferencesForSeason(seasonId);
      const conferenceIds = conferences.map(c => c.id);

      if (conferenceIds.length === 0) {
        return [];
      }

      // Get all matchups for these conferences
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
      
      // Filter by conference IDs that belong to this season
      const matchups = (data.List || []).filter(matchup => 
        conferenceIds.includes(matchup.conference_id)
      );

      return matchups;
    } catch (error) {
      console.error('Error fetching all matchups for season:', error);
      return [];
    }
  }

  private async getCompletedMatchupsForSeason(seasonId: number): Promise<MatchupResult[]> {
    try {
      const allMatchups = await this.getAllMatchupsForSeason(seasonId);
      return allMatchups.filter(matchup => matchup.status === 'complete');
    } catch (error) {
      console.error('Error fetching completed matchups for season:', error);
      return [];
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
      return data.List?.[0] || null;
    } catch (error) {
      console.error('Error fetching current season:', error);
      return null;
    }
  }
}

export const teamRecordsService = new TeamRecordsService();

// Initialize auto-sync on service load with a delay to allow proper initialization
// Temporarily disabled to avoid initialization errors
// setTimeout(() => {
//   teamRecordsService.initializeAutoSync();
// }, 1000);
