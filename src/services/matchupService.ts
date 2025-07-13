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
   * Get the conference ID for a specific team
   */
  static async getTeamConference(teamId: number, seasonId: number): Promise<number | null> {
    try {
      console.log(`🔍 Looking up conference for team ${teamId} in season ${seasonId}`);
      
      const { data, error } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 10,
        Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'is_active', op: 'Equal', value: true }
        ]
      });

      if (error || !data.List || data.List.length === 0) {
        console.warn(`⚠️ Team ${teamId} not found in any active conference`);
        return null;
      }

      // If multiple conferences, prioritize by season (if we have season context)
      const teamConferences = data.List;
      console.log(`✅ Found team ${teamId} in ${teamConferences.length} conference(s)`);
      
      // For now, return the first active conference
      // TODO: Add season-specific filtering when available
      return teamConferences[0].conference_id;
    } catch (error) {
      console.error(`❌ Error getting conference for team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Get conference details by ID
   */
  static async getConferenceById(conferenceId: number): Promise<Conference | null> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
          { name: 'id', op: 'Equal', value: conferenceId }
        ]
      });

      if (error || !data.List || data.List.length === 0) {
        return null;
      }

      return data.List[0] as Conference;
    } catch (error) {
      console.error(`Error getting conference ${conferenceId}:`, error);
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
   * Process a database matchup into an organized matchup with cross-conference support
   */
  private static async processDbMatchup(
  dbMatchup: DatabaseMatchup,
  teams: Team[],
  conference: Conference,
  sleeperMatchups: any[],
  sleeperRosters: any[],
  sleeperUsers: any[])
  : Promise<OrganizedMatchup | null> {
    try {
      console.log(`⚔️ Processing DB matchup ${dbMatchup.id}: Team ${dbMatchup.team_1_id} vs Team ${dbMatchup.team_2_id}${dbMatchup.is_manual_override ? ' (OVERRIDDEN)' : ''}`);

      // Find the teams in our database
      const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
      const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

      if (!team1 || !team2) {
        console.warn(`⚠️ Missing team data for matchup ${dbMatchup.id}:`);
        console.warn(`   Team ${dbMatchup.team_1_id}: ${team1 ? '✅ Found' : '❌ Not Found'}`);
        console.warn(`   Team ${dbMatchup.team_2_id}: ${team2 ? '✅ Found' : '❌ Not Found'}`);
        console.warn(`   Available teams: [${teams.map((t) => t.id).join(', ')}]`);
        console.warn(`   Is override: ${dbMatchup.is_manual_override}`);
        console.warn(`   Conference: ${conference.conference_name} (ID: ${conference.id})`);
        return null;
      }

      // For overridden matchups, determine each team's actual conference
      let team1Conference = conference;
      let team2Conference = conference;
      let team1SleeperData = null;
      let team2SleeperData = null;
      let team1Roster = null;
      let team2Roster = null;
      let team1Owner = null;
      let team2Owner = null;

      if (dbMatchup.is_manual_override) {
        console.log(`🔄 Processing override matchup - determining team conferences...`);
        
        // Get actual conferences for each team
        const team1ConferenceId = await this.getTeamConference(team1.id, conference.season_id);
        const team2ConferenceId = await this.getTeamConference(team2.id, conference.season_id);
        
        if (team1ConferenceId) {
          const team1ConferenceData = await this.getConferenceById(team1ConferenceId);
          if (team1ConferenceData) {
            team1Conference = team1ConferenceData;
            console.log(`✅ Team ${team1.id} belongs to conference ${team1Conference.conference_name}`);
          }
        }
        
        if (team2ConferenceId) {
          const team2ConferenceData = await this.getConferenceById(team2ConferenceId);
          if (team2ConferenceData) {
            team2Conference = team2ConferenceData;
            console.log(`✅ Team ${team2.id} belongs to conference ${team2Conference.conference_name}`);
          }
        }

        // Fetch Sleeper data for each team's actual conference
        const [team1SleeperMatchups, team1SleeperRosters, team1SleeperUsers] = team1Conference.league_id === conference.league_id 
          ? [sleeperMatchups, sleeperRosters, sleeperUsers]
          : await Promise.all([
              SleeperApiService.fetchMatchups(team1Conference.league_id, dbMatchup.week),
              SleeperApiService.fetchLeagueRosters(team1Conference.league_id),
              SleeperApiService.fetchLeagueUsers(team1Conference.league_id)
            ]);

        const [team2SleeperMatchups, team2SleeperRosters, team2SleeperUsers] = team2Conference.league_id === conference.league_id 
          ? [sleeperMatchups, sleeperRosters, sleeperUsers]
          : team2Conference.league_id === team1Conference.league_id
            ? [team1SleeperMatchups, team1SleeperRosters, team1SleeperUsers]
            : await Promise.all([
                SleeperApiService.fetchMatchups(team2Conference.league_id, dbMatchup.week),
                SleeperApiService.fetchLeagueRosters(team2Conference.league_id),
                SleeperApiService.fetchLeagueUsers(team2Conference.league_id)
              ]);

        // Get roster IDs using team-specific conferences
        const team1RosterId = await this.getRosterIdForTeam(team1.id, team1Conference.id);
        const team2RosterId = await this.getRosterIdForTeam(team2.id, team2Conference.id);

        if (!team1RosterId || !team2RosterId) {
          console.warn(`⚠️ Missing roster IDs for override matchup ${dbMatchup.id}:`);
          console.warn(`   Team ${team1.id} in conference ${team1Conference.conference_name}: ${team1RosterId ? `✅ ${team1RosterId}` : '❌ Not Found'}`);
          console.warn(`   Team ${team2.id} in conference ${team2Conference.conference_name}: ${team2RosterId ? `✅ ${team2RosterId}` : '❌ Not Found'}`);
          return null;
        }

        // Get Sleeper data using team-specific roster IDs and conference data
        team1SleeperData = team1SleeperMatchups.find((m) => m.roster_id === parseInt(team1RosterId));
        team2SleeperData = team2SleeperMatchups.find((m) => m.roster_id === parseInt(team2RosterId));

        team1Roster = team1SleeperRosters.find((r) => r.roster_id === parseInt(team1RosterId));
        team2Roster = team2SleeperRosters.find((r) => r.roster_id === parseInt(team2RosterId));

        team1Owner = team1Roster ? team1SleeperUsers.find((u) => u.user_id === team1Roster.owner_id) : null;
        team2Owner = team2Roster ? team2SleeperUsers.find((u) => u.user_id === team2Roster.owner_id) : null;

        console.log(`🎯 Override matchup data retrieved:`);
        console.log(`   Team ${team1.id}: Sleeper data ${team1SleeperData ? '✅' : '❌'}, Roster ${team1Roster ? '✅' : '❌'}, Owner ${team1Owner ? '✅' : '❌'}`);
        console.log(`   Team ${team2.id}: Sleeper data ${team2SleeperData ? '✅' : '❌'}, Roster ${team2Roster ? '✅' : '❌'}, Owner ${team2Owner ? '✅' : '❌'}`);

      } else {
        // Standard matchup - use provided conference data
        const team1RosterId = await this.getRosterIdForTeam(team1.id, conference.id);
        const team2RosterId = await this.getRosterIdForTeam(team2.id, conference.id);

        if (!team1RosterId || !team2RosterId) {
          console.warn(`⚠️ Missing roster IDs for standard matchup ${dbMatchup.id}:`);
          console.warn(`   Team ${team1.id} (${team1.team_name}): ${team1RosterId ? `✅ Roster ID ${team1RosterId}` : '❌ No Roster ID'}`);
          console.warn(`   Team ${team2.id} (${team2.team_name}): ${team2RosterId ? `✅ Roster ID ${team2RosterId}` : '❌ No Roster ID'}`);
          console.warn(`   Conference: ${conference.conference_name} (ID: ${conference.id})`);
          return null;
        }

        // Get Sleeper matchup data for these rosters
        team1SleeperData = sleeperMatchups.find((m) => m.roster_id === parseInt(team1RosterId));
        team2SleeperData = sleeperMatchups.find((m) => m.roster_id === parseInt(team2RosterId));

        // Get roster and user data
        team1Roster = sleeperRosters.find((r) => r.roster_id === parseInt(team1RosterId));
        team2Roster = sleeperRosters.find((r) => r.roster_id === parseInt(team2RosterId));

        team1Owner = team1Roster ? sleeperUsers.find((u) => u.user_id === team1Roster.owner_id) : null;
        team2Owner = team2Roster ? sleeperUsers.find((u) => u.user_id === team2Roster.owner_id) : null;
      }

      // Create organized matchup
      const organizedMatchup: OrganizedMatchup = {
        matchup_id: dbMatchup.id,
        conference: dbMatchup.is_manual_override ? team1Conference : conference,
        teams: [
        {
          roster_id: team1Roster?.roster_id || 0,
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
          roster_id: team2Roster?.roster_id || 0,
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
          isOverride: dbMatchup.is_manual_override,
          team1Conference: team1Conference,
          team2Conference: team2Conference
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
  overrides: MatchupOverride[])
  : Promise<OrganizedMatchup[]> {
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
      return teams.find((t) => t.id === teamId) || null;
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
  team2Data: any)
  : 'live' | 'completed' | 'upcoming' {
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
   * Get roster ID for a team in a specific conference (optimized for cross-conference support)
   */
  private static async getRosterIdForTeam(teamId: number, conferenceId: number): Promise<string | null> {
    try {
      console.log(`🔍 Looking up roster ID for team ${teamId} in conference ${conferenceId}`);

      // Primary lookup: try the specific conference first
      const { data, error } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 10,
        Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'conference_id', op: 'Equal', value: conferenceId },
          { name: 'is_active', op: 'Equal', value: true }
        ]
      });

      if (!error && data.List && data.List.length > 0) {
        console.log(`✅ Found roster ID ${data.List[0].roster_id} for team ${teamId} in conference ${conferenceId}`);
        return data.List[0].roster_id;
      }

      // Fallback: cross-conference lookup for overridden matchups
      console.log(`🔄 Team ${teamId} not found in conference ${conferenceId}, trying cross-conference lookup...`);

      const crossConferenceResponse = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 50,
        Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'is_active', op: 'Equal', value: true }
        ]
      });

      if (crossConferenceResponse.error || !crossConferenceResponse.data.List || crossConferenceResponse.data.List.length === 0) {
        console.warn(`⚠️ Team ${teamId} not found in any active conference`);
        return null;
      }

      // Return the first active match from any conference
      const crossConferenceResult = crossConferenceResponse.data.List[0];
      console.log(`✅ Found roster ID ${crossConferenceResult.roster_id} for team ${teamId} in conference ${crossConferenceResult.conference_id} (cross-conference)`);
      return crossConferenceResult.roster_id;

    } catch (error) {
      console.error(`❌ Error getting roster ID for team ${teamId}:`, error);
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