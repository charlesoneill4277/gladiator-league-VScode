// Service for handling draft data from Sleeper API
import { SleeperApiService } from './sleeperApi';

export interface SleeperDraft {
  type: string;
  status: string;
  start_time: number;
  sport: string;
  settings: {
    teams: number;
    slots_wr: number;
    slots_te: number;
    slots_rb: number;
    slots_qb: number;
    slots_k: number;
    slots_flex: number;
    slots_def: number;
    slots_bn: number;
    rounds: number;
    reversal_round: number;
    player_type: number;
    pick_timer: number;
    nom_timer: number;
    enforce_position_limits: number;
    cpu_autopick: number;
    alpha_sort: number;
  };
  season_type: string;
  season: string;
  metadata: any;
  league_id: string;
  last_picked: number;
  last_message_time: number;
  last_message_id: string;
  draft_order: Record<string, number>;
  draft_id: string;
  creators: string[];
  created: number;
}

export interface SleeperDraftPick {
  player_id: string;
  picked_by: string;
  roster_id: number;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    team: string;
    status: string;
    sport: string;
    position: string;
    player_id: string;
    number: string;
    news_updated: string;
    last_name: string;
    injury_status: string;
    first_name: string;
  };
  is_keeper: boolean;
  draft_id: string;
}

export interface ProcessedDraftPick {
  season_id: number;
  conference_id: number;
  round: number;
  draft_slot: number;
  pick_number: number;
  team_id: number; // Team ID from database
  player_id: string;
  player_name: string;
  position: string;
  nfl_team: string;
  draft_id: string;
}

export class DraftService {
  private static baseUrl = 'https://api.sleeper.app/v1';

  /**
   * Fetch draft information for a league
   */
  static async fetchLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
    try {
      console.log(`Fetching drafts for league: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/drafts`);

      if (!response.ok) {
        throw new Error(`Failed to fetch drafts: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} drafts for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league drafts:', error);
      throw error;
    }
  }

  /**
   * Fetch all picks for a specific draft
   */
  static async fetchDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
    try {
      console.log(`Fetching picks for draft: ${draftId}`);
      const response = await fetch(`${this.baseUrl}/draft/${draftId}/picks`);

      if (!response.ok) {
        throw new Error(`Failed to fetch draft picks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} picks for draft ${draftId}`);
      return data;
    } catch (error) {
      console.error('Error fetching draft picks:', error);
      throw error;
    }
  }

  /**
   * Get team ID from Sleeper owner ID using junction table
   */
  static async getTeamIdFromOwnerMatcher(sleeperOwnerId: string, conferenceId: number): Promise<number | null> {
    try {
      // First, try to find the team using the junction table (roster_id mapping)
      // The picked_by field from Sleeper API contains the roster_id
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'roster_id', op: 'Equal', value: sleeperOwnerId },
        { name: 'conference_id', op: 'Equal', value: conferenceId },
        { name: 'is_active', op: 'Equal', value: true }]

      });

      if (!junctionError && junctionData?.List?.length > 0) {
        const teamId = junctionData.List[0].team_id;
        console.log(`Found team ID ${teamId} for roster_id ${sleeperOwnerId} in conference ${conferenceId}`);
        return teamId;
      }

      // Fallback: try to find by owner_id directly (for legacy data)
      const { data, error } = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 1,
        Filters: [{
          name: 'owner_id',
          op: 'Equal',
          value: sleeperOwnerId
        }]
      });

      if (error) {
        console.error(`Error finding team for owner_id ${sleeperOwnerId}:`, error);
        return null;
      }

      if (data?.List?.length > 0) {
        console.log(`Found team ID ${data.List[0].id} for owner_id ${sleeperOwnerId} (legacy mapping)`);
        return data.List[0].id;
      }

      console.warn(`No team found for Sleeper roster_id/owner_id ${sleeperOwnerId} in conference ${conferenceId}`);
      return null;
    } catch (error) {
      console.error('Error in getTeamIdFromOwnerMatcher:', error);
      return null;
    }
  }

  /**
   * Process draft picks and prepare them for database insertion
   */
  static async processDraftPicksForDatabase(
  conferenceId: number,
  seasonId: number,
  draftPicks: SleeperDraftPick[])
  : Promise<ProcessedDraftPick[]> {
    try {
      console.log(`Processing ${draftPicks.length} draft picks for conference ${conferenceId}, season ${seasonId}`);

      const processedPicks: ProcessedDraftPick[] = [];

      for (const pick of draftPicks) {
        // Map Sleeper picked_by (which contains roster_id) to team ID
        const teamId = await this.getTeamIdFromOwnerMatcher(pick.picked_by, conferenceId);

        if (!teamId) {
          console.warn(`Skipping pick ${pick.pick_no} - no team found for roster_id ${pick.picked_by}`);
          continue;
        }

        processedPicks.push({
          season_id: seasonId,
          conference_id: conferenceId,
          round: pick.round,
          draft_slot: pick.draft_slot,
          pick_number: pick.pick_no,
          team_id: teamId, // Use team ID from database
          player_id: pick.player_id,
          player_name: pick.metadata ? `${pick.metadata.first_name || ''} ${pick.metadata.last_name || ''}`.trim() : 'Unknown Player',
          position: pick.metadata?.position || 'UNK',
          nfl_team: pick.metadata?.team || 'UNK',
          draft_id: pick.draft_id
        });
      }

      console.log(`Processed ${processedPicks.length} draft picks (${draftPicks.length - processedPicks.length} skipped due to missing team mapping)`);
      return processedPicks;
    } catch (error) {
      console.error('Error processing draft picks:', error);
      throw error;
    }
  }

  /**
   * Fetch and store draft results for all conferences
   */
  static async fetchAndStoreDraftResults(): Promise<{success: boolean;message: string;data?: any;}> {
    try {
      console.log('🏈 Starting draft results sync for all conferences...');

      // Get conferences from database
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "id",
        IsAsc: true
      });

      if (conferencesError) {
        throw new Error(`Failed to fetch conferences: ${conferencesError}`);
      }

      const conferences = conferencesData?.List || [];
      console.log(`Found ${conferences.length} conferences`);

      // Get seasons from database
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "season_year",
        IsAsc: false
      });

      if (seasonsError) {
        throw new Error(`Failed to fetch seasons: ${seasonsError}`);
      }

      const seasons = seasonsData?.List || [];
      console.log(`Found ${seasons.length} seasons`);

      let totalPicksProcessed = 0;
      const results = [];

      // Process each conference
      for (const conference of conferences) {
        try {
          console.log(`\n📋 Processing conference: ${conference.conference_name} (League ID: ${conference.league_id})`);

          // Find the season for this conference
          const season = seasons.find((s) => s.id === conference.season_id);
          if (!season) {
            console.warn(`⚠️ Season not found for conference ${conference.conference_name}`);
            continue;
          }

          // Fetch drafts for this league
          const drafts = await this.fetchLeagueDrafts(conference.league_id);

          if (drafts.length === 0) {
            console.warn(`⚠️ No drafts found for league ${conference.league_id}`);
            continue;
          }

          // Process each draft (there should typically be one per season)
          for (const draft of drafts) {
            console.log(`📊 Processing draft: ${draft.draft_id} for season ${season.season_year}`);

            // Fetch all picks for this draft
            const draftPicks = await this.fetchDraftPicks(draft.draft_id);

            if (draftPicks.length === 0) {
              console.warn(`⚠️ No picks found for draft ${draft.draft_id}`);
              continue;
            }

            // Process picks for database insertion
            const processedPicks = await this.processDraftPicksForDatabase(
              conference.id,
              season.id,
              draftPicks
            );

            // Clear existing draft results for this conference and season
            console.log(`🗑️ Clearing existing draft results for conference ${conference.id}, season ${season.id}`);

            // Get existing draft results to delete
            const { data: existingData, error: existingError } = await window.ezsite.apis.tablePage(27845, {
              PageNo: 1,
              PageSize: 1000,
              Filters: [
              { name: "conference_id", op: "Equal", value: conference.id },
              { name: "season_id", op: "Equal", value: season.id }]

            });

            if (!existingError && existingData?.List) {
              for (const existingPick of existingData.List) {
                await window.ezsite.apis.tableDelete(27845, { ID: existingPick.id });
              }
            }

            // Insert new draft results
            console.log(`💾 Inserting ${processedPicks.length} draft picks into database...`);

            for (const pick of processedPicks) {
              const { error: insertError } = await window.ezsite.apis.tableCreate(27845, {
                season_id: pick.season_id,
                conference_id: pick.conference_id,
                round: pick.round,
                draft_slot: pick.draft_slot,
                pick_number: pick.pick_number,
                team_id: pick.team_id,
                player_id: pick.player_id
              });

              if (insertError) {
                console.error(`❌ Error inserting pick ${pick.pick_number}:`, insertError);
              } else {
                totalPicksProcessed++;
              }
            }

            results.push({
              conference: conference.conference_name,
              season: season.season_year,
              draftId: draft.draft_id,
              picksProcessed: processedPicks.length
            });
          }
        } catch (error) {
          console.error(`❌ Error processing conference ${conference.conference_name}:`, error);
          results.push({
            conference: conference.conference_name,
            error: error.message
          });
        }
      }

      console.log(`\n✅ Draft sync completed! Total picks processed: ${totalPicksProcessed}`);

      return {
        success: true,
        message: `Successfully processed ${totalPicksProcessed} draft picks across ${results.length} conference/season combinations`,
        data: results
      };

    } catch (error) {
      console.error('❌ Error in draft sync:', error);
      return {
        success: false,
        message: `Draft sync failed: ${error.message}`
      };
    }
  }
}

export default DraftService;