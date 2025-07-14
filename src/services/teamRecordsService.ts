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

class TeamRecordsService {
  private readonly TEAM_RECORDS_TABLE_ID = 13768;
  private readonly MATCHUPS_TABLE_ID = 13329;
  private readonly TEAMS_TABLE_ID = 12852;
  private readonly CONFERENCES_TABLE_ID = 12820;
  private readonly SEASONS_TABLE_ID = 12818;

  /**
   * Get team records for a specific season and conference
   */
  async getTeamRecords(seasonId: number, conferenceId?: number): Promise<TeamRecord[]> {
    try {
      const filters = [
      { name: 'season_id', op: 'Equal', value: seasonId }];


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
   * Calculate team records from matchup results
   */
  async calculateTeamRecords(seasonId: number, conferenceId?: number): Promise<void> {
    try {
      // Get all completed matchups for the season
      const matchups = await this.getCompletedMatchups(seasonId, conferenceId);

      // Get all teams for the season/conference
      const teams = await this.getTeams(conferenceId);

      // Calculate records for each team
      const teamRecords = new Map<number, {
        wins: number;
        losses: number;
        ties: number;
        points_for: number;
        points_against: number;
        conference_id: number;
      }>();

      // Initialize records for all teams
      teams.forEach((team) => {
        teamRecords.set(team.id, {
          wins: 0,
          losses: 0,
          ties: 0,
          points_for: 0,
          points_against: 0,
          conference_id: team.conference_id
        });
      });

      // Process matchups to calculate records
      matchups.forEach((matchup) => {
        const team1Record = teamRecords.get(matchup.team_1_id);
        const team2Record = teamRecords.get(matchup.team_2_id);

        if (team1Record && team2Record) {
          // Update points
          team1Record.points_for += matchup.team_1_score;
          team1Record.points_against += matchup.team_2_score;
          team2Record.points_for += matchup.team_2_score;
          team2Record.points_against += matchup.team_1_score;

          // Update win/loss/tie records
          if (matchup.winner_id === matchup.team_1_id) {
            team1Record.wins++;
            team2Record.losses++;
          } else if (matchup.winner_id === matchup.team_2_id) {
            team2Record.wins++;
            team1Record.losses++;
          } else {
            // Tie
            team1Record.ties++;
            team2Record.ties++;
          }
        }
      });

      // Update database with calculated records
      await this.updateTeamRecordsInDatabase(seasonId, teamRecords);

      // Calculate and update rankings
      await this.updateTeamRankings(seasonId, conferenceId);

      toast({
        title: 'Success',
        description: 'Team records calculated and updated successfully'
      });
    } catch (error) {
      console.error('Error calculating team records:', error);
      toast({
        title: 'Error',
        description: 'Failed to calculate team records',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Get completed matchups for record calculation
   */
  private async getCompletedMatchups(seasonId: number, conferenceId?: number): Promise<MatchupResult[]> {
    try {
      const filters = [
      { name: 'status', op: 'Equal', value: 'complete' }];


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
   * Get teams for record calculation
   */
  private async getTeams(conferenceId?: number): Promise<Array<{id: number;conference_id: number;}>> {
    try {
      // This would need to join with team_conferences_junction table
      // For now, assuming teams have conference_id
      const { data, error } = await window.ezsite.apis.tablePage(
        this.TEAMS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'id',
          IsAsc: true,
          Filters: conferenceId ? [{ name: 'conference_id', op: 'Equal', value: conferenceId }] : []
        }
      );

      if (error) throw error;
      return data.List || [];
    } catch (error) {
      console.error('Error fetching teams:', error);
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
  }>)
  : Promise<void> {
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
          { name: 'conference_id', op: 'Equal', value: conferenceId }]

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
      conferenceGroups.forEach(async (records, confId) => {
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
      });

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
   * Complete a matchup and update records
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

      // Recalculate records for affected teams' conference
      await this.calculateTeamRecords(matchup.season_id, matchup.conference_id);

      toast({
        title: 'Success',
        description: 'Matchup completed and records updated'
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
   * Get standings data with team information
   */
  async getStandingsData(seasonId: number, conferenceId?: number): Promise<StandingsData[]> {
    try {
      // This would ideally be a database view or join query
      // For now, we'll fetch records and teams separately and combine them
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
}

export const teamRecordsService = new TeamRecordsService();