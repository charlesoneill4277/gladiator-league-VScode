import { SleeperApiService } from './sleeperApi';

export interface HistoricalRosterChange {
  id: number;
  team_id: number;
  player_id: number;
  season_id: number;
  week: number;
  action_type: string;
  transaction_date: string;
  from_team_id?: number;
  to_team_id?: number;
  faab_cost?: number;
  notes?: string;
}

export interface PlayerJourneyEntry {
  season_year: number;
  season_name: string;
  team_name: string;
  conference_name: string;
  action_type: string;
  transaction_date: string;
  week: number;
  faab_cost?: number;
  from_team?: string;
  to_team?: string;
}

export interface HistoricalPerformanceMetric {
  season_year: number;
  team_name: string;
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

export interface DraftHistoryEntry {
  season_year: number;
  conference_name: string;
  round: number;
  draft_slot: number;
  pick_number: number;
  player_name: string;
  position: string;
  team_name: string;
  current_team?: string;
  still_owned: boolean;
}

export interface TradeHistoryEntry {
  transaction_date: string;
  season_year: number;
  week: number;
  players_traded: {
    player_name: string;
    position: string;
    from_team: string;
    to_team: string;
  }[];
  faab_involved?: number;
}

export interface SeasonalComparison {
  metric: string;
  seasons: {
    season_year: number;
    value: number;
    rank?: number;
  }[];
}

export class HistoricalDataService {
  private static instance: HistoricalDataService;
  private sleeperApi: SleeperApiService;

  private constructor() {
    this.sleeperApi = new SleeperApiService();
  }

  static getInstance(): HistoricalDataService {
    if (!HistoricalDataService.instance) {
      HistoricalDataService.instance = new HistoricalDataService();
    }
    return HistoricalDataService.instance;
  }

  async getPlayerJourney(playerId: number, seasons?: number[]): Promise<PlayerJourneyEntry[]> {
    try {
      const filters = [
        { name: 'player_id', op: 'Equal', value: playerId }
      ];

      if (seasons && seasons.length > 0) {
        filters.push({ name: 'season_id', op: 'In', value: seasons });
      }

      const response = await window.ezsite.apis.tablePage(27936, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'transaction_date',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) throw response.error;

      // Transform the data to include team and season information
      const journeyEntries: PlayerJourneyEntry[] = [];
      
      for (const entry of response.data.List) {
        // Get season information
        const seasonResponse = await window.ezsite.apis.tablePage(12818, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: entry.season_id }]
        });

        // Get team information
        const teamResponse = await window.ezsite.apis.tablePage(12852, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: entry.team_id }]
        });

        // Get from/to team information if applicable
        let fromTeam = '';
        let toTeam = '';
        
        if (entry.from_team_id) {
          const fromTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: entry.from_team_id }]
          });
          fromTeam = fromTeamResponse.data.List[0]?.team_name || '';
        }

        if (entry.to_team_id) {
          const toTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: entry.to_team_id }]
          });
          toTeam = toTeamResponse.data.List[0]?.team_name || '';
        }

        journeyEntries.push({
          season_year: seasonResponse.data.List[0]?.season_year || 0,
          season_name: seasonResponse.data.List[0]?.season_name || '',
          team_name: teamResponse.data.List[0]?.team_name || '',
          conference_name: '', // Will be populated from team-conference junction
          action_type: entry.action_type,
          transaction_date: entry.transaction_date,
          week: entry.week,
          faab_cost: entry.faab_cost,
          from_team: fromTeam,
          to_team: toTeam
        });
      }

      return journeyEntries;
    } catch (error) {
      console.error('Error fetching player journey:', error);
      throw error;
    }
  }

  async getHistoricalPerformanceMetrics(
    teamId?: number,
    seasonIds?: number[],
    conferenceId?: number
  ): Promise<HistoricalPerformanceMetric[]> {
    try {
      const filters = [];

      if (teamId) {
        filters.push({ name: 'team_id', op: 'Equal', value: teamId });
      }

      if (seasonIds && seasonIds.length > 0) {
        filters.push({ name: 'season_id', op: 'In', value: seasonIds });
      }

      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const response = await window.ezsite.apis.tablePage(13768, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'season_id',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw response.error;

      const metrics: HistoricalPerformanceMetric[] = [];

      for (const record of response.data.List) {
        // Get season information
        const seasonResponse = await window.ezsite.apis.tablePage(12818, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: record.season_id }]
        });

        // Get team information
        const teamResponse = await window.ezsite.apis.tablePage(12852, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: record.team_id }]
        });

        // Get conference information
        const conferenceResponse = await window.ezsite.apis.tablePage(12820, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: record.conference_id }]
        });

        metrics.push({
          season_year: seasonResponse.data.List[0]?.season_year || 0,
          team_name: teamResponse.data.List[0]?.team_name || '',
          conference_name: conferenceResponse.data.List[0]?.conference_name || '',
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
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching historical performance metrics:', error);
      throw error;
    }
  }

  async getDraftHistory(
    seasonIds?: number[],
    conferenceId?: number,
    teamId?: number
  ): Promise<DraftHistoryEntry[]> {
    try {
      const filters = [];

      if (seasonIds && seasonIds.length > 0) {
        filters.push({ name: 'season_id', op: 'In', value: seasonIds });
      }

      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      if (teamId) {
        filters.push({ name: 'team_id', op: 'Equal', value: teamId });
      }

      const response = await window.ezsite.apis.tablePage(27845, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'pick_number',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) throw response.error;

      const draftHistory: DraftHistoryEntry[] = [];

      for (const pick of response.data.List) {
        // Get player information
        const playerResponse = await window.ezsite.apis.tablePage(12870, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: pick.player_id }]
        });

        // Get season information
        const seasonResponse = await window.ezsite.apis.tablePage(12818, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: pick.season_id }]
        });

        // Get team information
        const teamResponse = await window.ezsite.apis.tablePage(12852, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: pick.team_id }]
        });

        // Get conference information
        const conferenceResponse = await window.ezsite.apis.tablePage(12820, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: pick.conference_id }]
        });

        const player = playerResponse.data.List[0];
        const season = seasonResponse.data.List[0];
        const team = teamResponse.data.List[0];
        const conference = conferenceResponse.data.List[0];

        // Check if player is still owned by the same team
        const currentRosterResponse = await window.ezsite.apis.tablePage(27886, {
          PageNo: 1,
          PageSize: 1,
          Filters: [
            { name: 'player_id', op: 'Equal', value: player?.id },
            { name: 'is_current', op: 'Equal', value: true }
          ]
        });

        const stillOwned = currentRosterResponse.data.List.length > 0 && 
          currentRosterResponse.data.List[0].team_id === pick.team_id;

        let currentTeam = '';
        if (currentRosterResponse.data.List.length > 0) {
          const currentTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: currentRosterResponse.data.List[0].team_id }]
          });
          currentTeam = currentTeamResponse.data.List[0]?.team_name || '';
        }

        draftHistory.push({
          season_year: season?.season_year || 0,
          conference_name: conference?.conference_name || '',
          round: pick.round,
          draft_slot: pick.draft_slot,
          pick_number: pick.pick_number,
          player_name: player?.player_name || '',
          position: player?.position || '',
          team_name: team?.team_name || '',
          current_team: currentTeam,
          still_owned: stillOwned
        });
      }

      return draftHistory;
    } catch (error) {
      console.error('Error fetching draft history:', error);
      throw error;
    }
  }

  async getTradeHistory(
    seasonIds?: number[],
    teamId?: number,
    playerId?: number
  ): Promise<TradeHistoryEntry[]> {
    try {
      const filters = [
        { name: 'action_type', op: 'Equal', value: 'trade' }
      ];

      if (seasonIds && seasonIds.length > 0) {
        filters.push({ name: 'season_id', op: 'In', value: seasonIds });
      }

      if (teamId) {
        filters.push({ name: 'team_id', op: 'Equal', value: teamId });
      }

      if (playerId) {
        filters.push({ name: 'player_id', op: 'Equal', value: playerId });
      }

      const response = await window.ezsite.apis.tablePage(27936, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'transaction_date',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw response.error;

      // Group trades by transaction_id and date
      const tradesMap = new Map<string, TradeHistoryEntry>();

      for (const trade of response.data.List) {
        const key = `${trade.transaction_id}_${trade.transaction_date}`;
        
        if (!tradesMap.has(key)) {
          // Get season information
          const seasonResponse = await window.ezsite.apis.tablePage(12818, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: trade.season_id }]
          });

          tradesMap.set(key, {
            transaction_date: trade.transaction_date,
            season_year: seasonResponse.data.List[0]?.season_year || 0,
            week: trade.week,
            players_traded: [],
            faab_involved: trade.faab_cost
          });
        }

        const tradeEntry = tradesMap.get(key)!;

        // Get player information
        const playerResponse = await window.ezsite.apis.tablePage(12870, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: trade.player_id }]
        });

        // Get from/to team information
        let fromTeam = '';
        let toTeam = '';

        if (trade.from_team_id) {
          const fromTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: trade.from_team_id }]
          });
          fromTeam = fromTeamResponse.data.List[0]?.team_name || '';
        }

        if (trade.to_team_id) {
          const toTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: trade.to_team_id }]
          });
          toTeam = toTeamResponse.data.List[0]?.team_name || '';
        }

        const player = playerResponse.data.List[0];
        tradeEntry.players_traded.push({
          player_name: player?.player_name || '',
          position: player?.position || '',
          from_team: fromTeam,
          to_team: toTeam
        });
      }

      return Array.from(tradesMap.values());
    } catch (error) {
      console.error('Error fetching trade history:', error);
      throw error;
    }
  }

  async getSeasonalComparisons(
    teamId: number,
    metrics: string[] = ['wins', 'points_for', 'points_against', 'win_percentage']
  ): Promise<SeasonalComparison[]> {
    try {
      const response = await window.ezsite.apis.tablePage(13768, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'season_id',
        IsAsc: true,
        Filters: [{ name: 'team_id', op: 'Equal', value: teamId }]
      });

      if (response.error) throw response.error;

      const comparisons: SeasonalComparison[] = [];

      for (const metric of metrics) {
        const seasonalData: { season_year: number; value: number; rank?: number }[] = [];

        for (const record of response.data.List) {
          // Get season information
          const seasonResponse = await window.ezsite.apis.tablePage(12818, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: record.season_id }]
          });

          const season = seasonResponse.data.List[0];
          const value = record[metric] || 0;
          const rank = metric === 'wins' ? record.overall_rank : undefined;

          seasonalData.push({
            season_year: season?.season_year || 0,
            value,
            rank
          });
        }

        comparisons.push({
          metric,
          seasons: seasonalData
        });
      }

      return comparisons;
    } catch (error) {
      console.error('Error fetching seasonal comparisons:', error);
      throw error;
    }
  }

  async archiveSeasonData(seasonId: number): Promise<void> {
    try {
      // This would typically involve moving data to an archive table
      // For now, we'll just update the sync_status to indicate archival
      await window.ezsite.apis.tableCreate(27938, {
        sync_type: 'archive',
        season_id: seasonId,
        sync_status: 'completed',
        last_sync_completed: new Date().toISOString(),
        records_processed: 0,
        errors_encountered: 0
      });
    } catch (error) {
      console.error('Error archiving season data:', error);
      throw error;
    }
  }

  async migrateHistoricalData(fromSeasonId: number, toSeasonId: number): Promise<void> {
    try {
      // This would involve copying relevant data from old season to new season
      // Implementation would depend on specific migration requirements
      console.log(`Migrating data from season ${fromSeasonId} to ${toSeasonId}`);
      
      // Create sync status record for migration
      await window.ezsite.apis.tableCreate(27938, {
        sync_type: 'migration',
        season_id: toSeasonId,
        sync_status: 'in_progress',
        last_sync_started: new Date().toISOString(),
        records_processed: 0,
        errors_encountered: 0
      });
    } catch (error) {
      console.error('Error migrating historical data:', error);
      throw error;
    }
  }
}

export default HistoricalDataService;
