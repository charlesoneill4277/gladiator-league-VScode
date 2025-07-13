// Service for handling matchup data routing with override functionality
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';

export interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  sleeper_matchup_id: string;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
}

export interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

export interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name: string;
  co_owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

export interface MatchupOverride {
  id: number;
  season_id: number;
  week: number;
  conference_id: number;
  matchup_id: number;
  team_1_id: number;
  team_2_id: number;
  team_1_roster_id: string;
  team_2_roster_id: string;
  is_active: boolean;
  created_by: string;
  notes: string;
}

export interface OrganizedMatchupTeam {
  roster_id: number;
  points: number;
  projected_points?: number;
  owner: SleeperUser | null;
  roster: SleeperRoster | null;
  team: Team | null;
  players_points: Record<string, number>;
  starters_points: number[];
  matchup_starters: string[];
}

export interface OrganizedMatchup {
  matchup_id: number;
  conference: Conference;
  teams: OrganizedMatchupTeam[];
  status: 'live' | 'completed' | 'upcoming';
  rawData?: any;
}

export class MatchupService {
  /**
   * Get matchup overrides for a specific season, week, and conference
   */
  static async getMatchupOverrides(
  seasonId: number,
  week: number,
  conferenceId?: number)
  : Promise<MatchupOverride[]> {
    try {
      const filters = [
      { name: 'season_id', op: 'Equal', value: seasonId },
      { name: 'week', op: 'Equal', value: week },
      { name: 'is_active', op: 'Equal', value: true }];


      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(27780, {
        PageNo: 1,
        PageSize: 100,
        Filters: filters
      });

      if (error) {
        console.error('Error fetching matchup overrides:', error);
        return [];
      }

      return data.List || [];
    } catch (error) {
      console.error('Error in getMatchupOverrides:', error);
      return [];
    }
  }

  /**
   * Get database matchups for a specific season, week, and conference
   */
  static async getDatabaseMatchups(
  seasonId: number,
  week: number,
  conferenceId?: number)
  : Promise<DatabaseMatchup[]> {
    try {
      const filters = [
      { name: 'week', op: 'Equal', value: week }];


      if (conferenceId) {
        filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
      }

      const { data, error } = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 100,
        Filters: filters
      });

      if (error) {
        console.error('Error fetching database matchups:', error);
        return [];
      }

      return data.List || [];
    } catch (error) {
      console.error('Error in getDatabaseMatchups:', error);
      return [];
    }
  }

  /**
   * Map roster ID to team ID using team-conference junction
   */
  static async mapRosterToTeam(rosterId: number, conferenceId: number): Promise<number | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 10,
        Filters: [
        { name: 'roster_id', op: 'Equal', value: rosterId.toString() },
        { name: 'conference_id', op: 'Equal', value: conferenceId }]

      });

      if (error || !data.List || data.List.length === 0) {
        return null;
      }

      return data.List[0].team_id;
    } catch (error) {
      console.error('Error mapping roster to team:', error);
      return null;
    }
  }

  /**
   * Fetch and organize matchups with override support
   */
  static async fetchOrganizedMatchups(
  conferences: Conference[],
  teams: Team[],
  week: number,
  seasonId: number,
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<OrganizedMatchup[]> {
    try {
      console.log('🔄 Starting fetchOrganizedMatchups with override support...');
      console.log(`📊 Processing ${conferences.length} conferences for week ${week}, season ${seasonId}`);

      const allMatchups: OrganizedMatchup[] = [];

      for (const conference of conferences) {
        try {
          console.log(`🏟️ Processing conference: ${conference.conference_name}`);

          // Step 1: Get database matchups for this conference (ALWAYS fetch these first)
          const dbMatchups = await this.getDatabaseMatchups(seasonId, week, conference.id);
          console.log(`📋 Found ${dbMatchups.length} database matchups for ${conference.conference_name}`);

          // Step 2: Get override data
          const overrides = await this.getMatchupOverrides(seasonId, week, conference.id);
          console.log(`🔧 Found ${overrides.length} overrides for ${conference.conference_name}`);

          // Step 3: Fetch Sleeper API data
          const [sleeperMatchups, sleeperRosters, sleeperUsers] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, week),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          console.log(`🏈 Sleeper data for ${conference.conference_name}:`, {
            matchups: sleeperMatchups.length,
            rosters: sleeperRosters.length,
            users: sleeperUsers.length
          });

          const conferenceMatchups: OrganizedMatchup[] = [];

          // Step 4: Process based on data availability
          if (dbMatchups.length > 0) {
            // We have database matchups - apply overrides and process
            console.log(`🎯 Processing ${dbMatchups.length} database matchups for ${conference.conference_name}`);
            const processedMatchups = this.applyOverridesToMatchups(dbMatchups, overrides);
            
            for (const dbMatchup of processedMatchups) {
              try {
                const organizedMatchup = await this.processDbMatchup(
                  dbMatchup,
                  teams,
                  conference,
                  sleeperMatchups,
                  sleeperRosters,
                  sleeperUsers
                );
                
                if (organizedMatchup) {
                  conferenceMatchups.push(organizedMatchup);
                }
              } catch (matchupError) {
                console.error(`❌ Error processing database matchup ${dbMatchup.id}:`, matchupError);
              }
            }
          } else {
            // No database matchups - fallback to Sleeper API data
            console.log(`🔄 No database matchups found for ${conference.conference_name}, falling back to Sleeper API data`);
            
            if (sleeperMatchups.length > 0) {
              const sleeperOrganizedMatchups = await this.processSleeperMatchups(
                sleeperMatchups,
                sleeperRosters,
                sleeperUsers,
                teams,
                conference,
                overrides
              );
              conferenceMatchups.push(...sleeperOrganizedMatchups);
            } else {
              console.warn(`⚠️ No Sleeper matchup data available for ${conference.conference_name}, week ${week}`);
            }
          }

          allMatchups.push(...conferenceMatchups);
          console.log(`🏆 Completed processing ${conference.conference_name}: ${conferenceMatchups.length} matchups`);

        } catch (conferenceError) {
          console.error(`❌ Error processing conference ${conference.conference_name}:`, conferenceError);
        }
      }

      console.log(`🎉 Total organized matchups: ${allMatchups.length}`);
      return allMatchups;

    } catch (error) {
      console.error('❌ Critical error in fetchOrganizedMatchups:', error);
      throw error;
    }
  }

  /**
   * Process a database matchup into an organized matchup
   */
  private static async processDbMatchup(
    dbMatchup: DatabaseMatchup,
    teams: Team[],
    conference: Conference,
    sleeperMatchups: any[],
    sleeperRosters: any[],
    sleeperUsers: any[]
  ): Promise<OrganizedMatchup | null> {
    try {
      console.log(`⚔️ Processing DB matchup ${dbMatchup.id}: Team ${dbMatchup.team_1_id} vs Team ${dbMatchup.team_2_id}${dbMatchup.is_manual_override ? ' (OVERRIDDEN)' : ''}`);

      // Find the teams in our database
      const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
      const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

      if (!team1 || !team2) {
        console.warn(`⚠️ Missing team data for matchup ${dbMatchup.id}: team1=${!!team1}, team2=${!!team2}`);
        return null;
      }

      // Map teams to their roster IDs and get Sleeper data
      const team1RosterId = await this.getRosterIdForTeam(team1.id, conference.id);
      const team2RosterId = await this.getRosterIdForTeam(team2.id, conference.id);

      if (!team1RosterId || !team2RosterId) {
        console.warn(`⚠️ Missing roster IDs for matchup ${dbMatchup.id}: team1=${team1RosterId}, team2=${team2RosterId}`);
        return null;
      }

      // Get Sleeper matchup data for these rosters
      const team1SleeperData = sleeperMatchups.find((m) => m.roster_id === parseInt(team1RosterId));
      const team2SleeperData = sleeperMatchups.find((m) => m.roster_id === parseInt(team2RosterId));

      // Get roster and user data
      const team1Roster = sleeperRosters.find((r) => r.roster_id === parseInt(team1RosterId));
      const team2Roster = sleeperRosters.find((r) => r.roster_id === parseInt(team2RosterId));

      const team1Owner = team1Roster ? sleeperUsers.find((u) => u.user_id === team1Roster.owner_id) : null;
      const team2Owner = team2Roster ? sleeperUsers.find((u) => u.user_id === team2Roster.owner_id) : null;

      // Create organized matchup
      const organizedMatchup: OrganizedMatchup = {
        matchup_id: dbMatchup.id,
        conference,
        teams: [
        {
          roster_id: parseInt(team1RosterId),
          points: this.getTeamScore(dbMatchup, 'team_1', team1SleeperData),
          projected_points: team1SleeperData?.custom_points,
          owner: team1Owner,
          roster: team1Roster,
          team: team1,
          players_points: team1SleeperData?.players_points || {},
          starters_points: team1SleeperData?.starters_points || [],
          matchup_starters: team1SleeperData?.starters || []
        },
        {
          roster_id: parseInt(team2RosterId),
          points: this.getTeamScore(dbMatchup, 'team_2', team2SleeperData),
          projected_points: team2SleeperData?.custom_points,
          owner: team2Owner,
          roster: team2Roster,
          team: team2,
          players_points: team2SleeperData?.players_points || {},
          starters_points: team2SleeperData?.starters_points || [],
          matchup_starters: team2SleeperData?.starters || []
        }],

        status: this.determineMatchupStatus(dbMatchup, team1SleeperData, team2SleeperData),
        rawData: {
          dbMatchup,
          team1SleeperData,
          team2SleeperData,
          isOverride: dbMatchup.is_manual_override
        }
      };

      console.log(`✅ Successfully processed DB matchup ${dbMatchup.id}${dbMatchup.is_manual_override ? ' (OVERRIDE)' : ''}`);
      return organizedMatchup;

    } catch (error) {
      console.error(`❌ Error processing DB matchup ${dbMatchup.id}:`, error);
      return null;
    }
  }

  /**
   * Process Sleeper matchups when no database matchups exist
   */
  private static async processSleeperMatchups(
    sleeperMatchups: any[],
    sleeperRosters: any[],
    sleeperUsers: any[],
    teams: Team[],
    conference: Conference,
    overrides: MatchupOverride[]
  ): Promise<OrganizedMatchup[]> {
    try {
      console.log(`🏈 Processing ${sleeperMatchups.length} Sleeper matchups for ${conference.conference_name}`);

      // Group Sleeper matchups by matchup_id
      const matchupGroups = new Map<number, any[]>();
      sleeperMatchups.forEach((matchup) => {
        if (!matchupGroups.has(matchup.matchup_id)) {
          matchupGroups.set(matchup.matchup_id, []);
        }
        matchupGroups.get(matchup.matchup_id)!.push(matchup);
      });

      const organizedMatchups: OrganizedMatchup[] = [];

      for (const [matchupId, matchupPair] of matchupGroups.entries()) {
        if (matchupPair.length !== 2) {
          console.warn(`⚠️ Skipping incomplete matchup ${matchupId} - only ${matchupPair.length} teams`);
          continue;
        }

        try {
          const [team1SleeperData, team2SleeperData] = matchupPair;

          // Get roster and user data
          const team1Roster = sleeperRosters.find((r) => r.roster_id === team1SleeperData.roster_id);
          const team2Roster = sleeperRosters.find((r) => r.roster_id === team2SleeperData.roster_id);

          const team1Owner = team1Roster ? sleeperUsers.find((u) => u.user_id === team1Roster.owner_id) : null;
          const team2Owner = team2Roster ? sleeperUsers.find((u) => u.user_id === team2Roster.owner_id) : null;

          // Try to find teams in our database by roster mapping
          const team1 = await this.findTeamByRosterId(team1SleeperData.roster_id, conference.id, teams);
          const team2 = await this.findTeamByRosterId(team2SleeperData.roster_id, conference.id, teams);

          // Create organized matchup
          const organizedMatchup: OrganizedMatchup = {
            matchup_id: matchupId,
            conference,
            teams: [
            {
              roster_id: team1SleeperData.roster_id,
              points: team1SleeperData.points || 0,
              projected_points: team1SleeperData.custom_points,
              owner: team1Owner,
              roster: team1Roster,
              team: team1,
              players_points: team1SleeperData.players_points || {},
              starters_points: team1SleeperData.starters_points || [],
              matchup_starters: team1SleeperData.starters || []
            },
            {
              roster_id: team2SleeperData.roster_id,
              points: team2SleeperData.points || 0,
              projected_points: team2SleeperData.custom_points,
              owner: team2Owner,
              roster: team2Roster,
              team: team2,
              players_points: team2SleeperData.players_points || {},
              starters_points: team2SleeperData.starters_points || [],
              matchup_starters: team2SleeperData.starters || []
            }],

            status: this.determineSleeperMatchupStatus(team1SleeperData, team2SleeperData),
            rawData: {
              team1SleeperData,
              team2SleeperData,
              isOverride: false,
              source: 'sleeper_api'
            }
          };

          organizedMatchups.push(organizedMatchup);
          console.log(`✅ Successfully processed Sleeper matchup ${matchupId}`);

        } catch (matchupError) {
          console.error(`❌ Error processing Sleeper matchup ${matchupId}:`, matchupError);
        }
      }

      console.log(`🏆 Processed ${organizedMatchups.length} Sleeper matchups for ${conference.conference_name}`);
      return organizedMatchups;

    } catch (error) {
      console.error('❌ Error processing Sleeper matchups:', error);
      return [];
    }
  }

  /**
   * Find team by roster ID
   */
  private static async findTeamByRosterId(rosterId: number, conferenceId: number, teams: Team[]): Promise<Team | null> {
    try {
      const teamId = await this.mapRosterToTeam(rosterId, conferenceId);
      if (!teamId) return null;
      return teams.find(t => t.id === teamId) || null;
    } catch (error) {
      console.error(`Error finding team for roster ${rosterId}:`, error);
      return null;
    }
  }

  /**
   * Determine matchup status for Sleeper-only data
   */
  private static determineSleeperMatchupStatus(
    team1Data: any,
    team2Data: any
  ): 'live' | 'completed' | 'upcoming' {
    // Check if either team has points > 0
    const hasPoints = (team1Data?.points || 0) > 0 || (team2Data?.points || 0) > 0;

    if (hasPoints) {
      // If both teams have final scores, it's completed
      if ((team1Data?.points || 0) > 0 && (team2Data?.points || 0) > 0) {
        return 'completed';
      }
      // If only one team has points, it's live
      return 'live';
    }

    return 'upcoming';
  }

  /**
   * Apply overrides to database matchups (HYBRID PROCESSING)
   * This preserves all database matchup data while applying team assignment overrides
   */
  private static applyOverridesToMatchups(
  dbMatchups: DatabaseMatchup[],
  overrides: MatchupOverride[])
  : DatabaseMatchup[] {
    if (overrides.length === 0) {
      return dbMatchups;
    }

    console.log(`🔀 Applying ${overrides.length} overrides to ${dbMatchups.length} database matchups`);

    return dbMatchups.map((dbMatchup) => {
      // Check if this matchup has an override
      const override = overrides.find((o) => o.matchup_id === dbMatchup.id);

      if (override) {
        console.log(`🔄 Applying override to matchup ${dbMatchup.id}: ${dbMatchup.team_1_id}→${override.team_1_id}, ${dbMatchup.team_2_id}→${override.team_2_id}`);

        // Apply override while preserving all other database data
        return {
          ...dbMatchup,
          team_1_id: override.team_1_id,
          team_2_id: override.team_2_id,
          is_manual_override: true,
          notes: override.notes || dbMatchup.notes
        };
      }

      return dbMatchup;
    });
  }

  /**
   * Get roster ID for a team in a specific conference
   */
  private static async getRosterIdForTeam(teamId: number, conferenceId: number): Promise<string | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 10,
        Filters: [
        { name: 'team_id', op: 'Equal', value: teamId },
        { name: 'conference_id', op: 'Equal', value: conferenceId }]

      });

      if (error || !data.List || data.List.length === 0) {
        return null;
      }

      return data.List[0].roster_id;
    } catch (error) {
      console.error('Error getting roster ID for team:', error);
      return null;
    }
  }

  /**
   * Convert override data to matchup format (DEPRECATED - replaced by applyOverridesToMatchups)
   * This method is kept for backward compatibility but should not be used
   */
  private static convertOverridesToMatchups(overrides: MatchupOverride[], conferenceId: number): DatabaseMatchup[] {
    console.warn('⚠️ convertOverridesToMatchups is deprecated. Use applyOverridesToMatchups instead.');
    return overrides.map((override) => ({
      id: override.matchup_id,
      conference_id: conferenceId,
      week: override.week,
      team_1_id: override.team_1_id,
      team_2_id: override.team_2_id,
      is_playoff: false,
      sleeper_matchup_id: '',
      team_1_score: 0,
      team_2_score: 0,
      winner_id: 0,
      is_manual_override: true,
      status: 'pending',
      matchup_date: '',
      notes: override.notes || ''
    }));
  }

  /**
   * Get the appropriate score for a team
   */
  private static getTeamScore(
  dbMatchup: DatabaseMatchup | any,
  teamPosition: 'team_1' | 'team_2',
  sleeperData?: SleeperMatchup)
  : number {
    // If manual override exists and has valid scores, use database score
    if (dbMatchup.is_manual_override && (
    teamPosition === 'team_1' && dbMatchup.team_1_score > 0 ||
    teamPosition === 'team_2' && dbMatchup.team_2_score > 0))
    {
      return teamPosition === 'team_1' ? dbMatchup.team_1_score : dbMatchup.team_2_score;
    }

    // Otherwise use Sleeper API score
    return sleeperData?.points || 0;
  }

  /**
   * Determine matchup status
   */
  private static determineMatchupStatus(
  dbMatchup: DatabaseMatchup | any,
  team1Data?: SleeperMatchup,
  team2Data?: SleeperMatchup)
  : 'live' | 'completed' | 'upcoming' {
    // Check if manually marked as complete
    if (dbMatchup.is_manual_override && dbMatchup.status === 'complete') {
      return 'completed';
    }

    // Check if either team has points > 0
    const hasPoints = (team1Data?.points || 0) > 0 || (team2Data?.points || 0) > 0;

    if (hasPoints) {
      // If both teams have final scores, it's completed
      if ((team1Data?.points || 0) > 0 && (team2Data?.points || 0) > 0) {
        return 'completed';
      }
      // If only one team has points, it's live
      return 'live';
    }

    return 'upcoming';
  }
}

export default MatchupService;