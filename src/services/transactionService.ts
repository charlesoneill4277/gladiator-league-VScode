interface SleeperTransaction {
  type: 'trade' | 'free_agent' | 'waiver' | 'commissioner';
  transaction_id: string;
  status_updated: number;
  status: string;
  settings: {waiver_bid?: number;} | null;
  roster_ids: number[];
  metadata: {notes?: string;} | null;
  leg: number; // week
  drops: {[player_id: string]: number;} | null;
  draft_picks: DraftPick[];
  creator: string;
  created: number;
  consenter_ids: number[];
  adds: {[player_id: string]: number;} | null;
  waiver_budget: WaiverBudget[];
}

interface DraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

interface WaiverBudget {
  sender: number;
  receiver: number;
  amount: number;
}

interface ProcessedTransaction {
  id: string;
  type: 'trade' | 'free_agent' | 'waiver' | 'commissioner';
  week: number;
  date: Date;
  status: string;
  teams: string[];
  rosterIds: number[];
  details: string;
  players: {
    added: {id: string;name: string;team: string;}[];
    dropped: {id: string;name: string;team: string;}[];
  };
  draftPicks: DraftPick[];
  waiverBid?: number;
  waiverBudget: WaiverBudget[];
  notes?: string;
}

class TransactionService {
  private static cache: Map<string, SleeperTransaction[]> = new Map();
  private static teamNamesCache: Map<string, Map<number, string>> = new Map();

  /**
   * Fetch transactions for a specific league and week
   */
  static async fetchTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
    const cacheKey = `${leagueId}_${week}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`Fetching transactions for league ${leagueId}, week ${week}`);
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }

      const transactions: SleeperTransaction[] = await response.json();
      this.cache.set(cacheKey, transactions);

      console.log(`Fetched ${transactions.length} transactions for week ${week}`);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Fetch team names for roster ID mapping
   */
  static async fetchTeamNames(leagueId: string): Promise<Map<number, string>> {
    if (this.teamNamesCache.has(leagueId)) {
      return this.teamNamesCache.get(leagueId)!;
    }

    try {
      // Get conference data for this league
      const conferenceResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'league_id', op: 'Equal', value: leagueId }]
      });

      if (conferenceResponse.error || !conferenceResponse.data?.List?.length) {
        throw new Error('Conference not found');
      }

      const conferenceId = conferenceResponse.data.List[0].id;

      // Get all team-conference mappings for this conference
      const junctionResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 50,
        Filters: [{ name: 'conference_id', op: 'Equal', value: conferenceId }]
      });

      if (junctionResponse.error) {
        throw new Error(junctionResponse.error);
      }

      const teamNameMap = new Map<number, string>();

      // For each junction record, get the team name
      for (const junction of junctionResponse.data?.List || []) {
        const teamResponse = await window.ezsite.apis.tablePage('12852', {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: junction.team_id }]
        });

        if (!teamResponse.error && teamResponse.data?.List?.length) {
          const rosterId = parseInt(junction.roster_id);
          const teamName = teamResponse.data.List[0].team_name;
          teamNameMap.set(rosterId, teamName);
        }
      }

      this.teamNamesCache.set(leagueId, teamNameMap);
      return teamNameMap;
    } catch (error) {
      console.error('Error fetching team names:', error);
      return new Map();
    }
  }

  /**
   * Fetch player name from database or API
   */
  static async getPlayerName(playerId: string): Promise<string> {
    try {
      // First try to get from database
      const playerResponse = await window.ezsite.apis.tablePage('12870', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: playerId }]
      });

      if (!playerResponse.error && playerResponse.data?.List?.length) {
        return playerResponse.data.List[0].player_name;
      }

      // If not in database, try to fetch from Sleeper API
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (response.ok) {
        const players = await response.json();
        if (players[playerId]) {
          const player = players[playerId];
          return `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player';
        }
      }

      return 'Unknown Player';
    } catch (error) {
      console.error('Error fetching player name:', error);
      return 'Unknown Player';
    }
  }

  /**
   * Process raw transactions into a more user-friendly format
   */
  static async processTransactions(
  transactions: SleeperTransaction[],
  teamNameMap: Map<number, string>)
  : Promise<ProcessedTransaction[]> {
    const processed: ProcessedTransaction[] = [];

    for (const tx of transactions) {
      try {
        const teams = tx.roster_ids.map((rosterId) => teamNameMap.get(rosterId) || `Team ${rosterId}`);

        // Process added players
        const addedPlayers = [];
        if (tx.adds) {
          for (const [playerId, rosterId] of Object.entries(tx.adds)) {
            const playerName = await this.getPlayerName(playerId);
            addedPlayers.push({
              id: playerId,
              name: playerName,
              team: teamNameMap.get(rosterId) || `Team ${rosterId}`
            });
          }
        }

        // Process dropped players
        const droppedPlayers = [];
        if (tx.drops) {
          for (const [playerId, rosterId] of Object.entries(tx.drops)) {
            const playerName = await this.getPlayerName(playerId);
            droppedPlayers.push({
              id: playerId,
              name: playerName,
              team: teamNameMap.get(rosterId) || `Team ${rosterId}`
            });
          }
        }

        // Generate transaction details
        let details = '';
        switch (tx.type) {
          case 'trade':
            details = this.generateTradeDetails(tx, teams, addedPlayers, droppedPlayers);
            break;
          case 'free_agent':
            details = this.generateFreeAgentDetails(addedPlayers, droppedPlayers);
            break;
          case 'waiver':
            details = this.generateWaiverDetails(tx, addedPlayers, droppedPlayers);
            break;
          default:
            details = `${tx.type} transaction`;
        }

        processed.push({
          id: tx.transaction_id,
          type: tx.type,
          week: tx.leg,
          date: new Date(tx.created),
          status: tx.status,
          teams,
          rosterIds: tx.roster_ids,
          details,
          players: {
            added: addedPlayers,
            dropped: droppedPlayers
          },
          draftPicks: tx.draft_picks,
          waiverBid: tx.settings?.waiver_bid,
          waiverBudget: tx.waiver_budget,
          notes: tx.metadata?.notes
        });
      } catch (error) {
        console.error('Error processing transaction:', error);
      }
    }

    return processed.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private static generateTradeDetails(
  tx: SleeperTransaction,
  teams: string[],
  addedPlayers: any[],
  droppedPlayers: any[])
  : string {
    const parts = [];

    if (teams.length >= 2) {
      parts.push(`Trade between ${teams.join(' and ')}`);
    }

    if (addedPlayers.length > 0 || droppedPlayers.length > 0) {
      const playerMoves = [];
      addedPlayers.forEach((p) => playerMoves.push(`${p.name} to ${p.team}`));
      droppedPlayers.forEach((p) => playerMoves.push(`${p.name} from ${p.team}`));
      if (playerMoves.length > 0) {
        parts.push(playerMoves.join(', '));
      }
    }

    if (tx.draft_picks.length > 0) {
      const picks = tx.draft_picks.map((pick) =>
      `${pick.season} Round ${pick.round} pick`
      );
      parts.push(`Draft picks: ${picks.join(', ')}`);
    }

    if (tx.waiver_budget.length > 0) {
      const faabMoves = tx.waiver_budget.map((wb) =>
      `$${wb.amount} FAAB`
      );
      parts.push(`FAAB: ${faabMoves.join(', ')}`);
    }

    return parts.join(' | ');
  }

  private static generateFreeAgentDetails(addedPlayers: any[], droppedPlayers: any[]): string {
    const parts = [];

    if (addedPlayers.length > 0) {
      parts.push(`Added: ${addedPlayers.map((p) => p.name).join(', ')}`);
    }

    if (droppedPlayers.length > 0) {
      parts.push(`Dropped: ${droppedPlayers.map((p) => p.name).join(', ')}`);
    }

    return parts.join(' | ') || 'Free agent pickup';
  }

  private static generateWaiverDetails(
  tx: SleeperTransaction,
  addedPlayers: any[],
  droppedPlayers: any[])
  : string {
    const parts = [];

    if (addedPlayers.length > 0) {
      parts.push(`Claimed: ${addedPlayers.map((p) => p.name).join(', ')}`);
    }

    if (droppedPlayers.length > 0) {
      parts.push(`Dropped: ${droppedPlayers.map((p) => p.name).join(', ')}`);
    }

    if (tx.settings?.waiver_bid) {
      parts.push(`Bid: $${tx.settings.waiver_bid}`);
    }

    return parts.join(' | ') || 'Waiver claim';
  }

  /**
   * Fetch all transactions for a league across multiple weeks
   */
  static async fetchAllSeasonTransactions(leagueId: string, maxWeek: number = 18): Promise<ProcessedTransaction[]> {
    const allTransactions: SleeperTransaction[] = [];
    const teamNameMap = await this.fetchTeamNames(leagueId);

    // Fetch transactions for weeks 1 through maxWeek
    for (let week = 1; week <= maxWeek; week++) {
      try {
        const weekTransactions = await this.fetchTransactions(leagueId, week);
        allTransactions.push(...weekTransactions);
      } catch (error) {
        console.warn(`Failed to fetch transactions for week ${week}:`, error);
      }
    }

    return this.processTransactions(allTransactions, teamNameMap);
  }
}

export default TransactionService;
export type { ProcessedTransaction, SleeperTransaction };