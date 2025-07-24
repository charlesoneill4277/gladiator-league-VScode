// New Supabase-based service for handling matchup data
import { DatabaseService } from './databaseService';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';
import { DbMatchup, DbConference, DbTeam, DbMatchupAdminOverride, DbPlayoffBracket } from '@/types/database';

// Use database types directly
export type DatabaseMatchup = DbMatchup;
export type Conference = DbConference;
export type Team = DbTeam;
export type MatchupOverride = DbMatchupAdminOverride;

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

export class SupabaseMatchupService {
  /**
   * Get comprehensive matchup data combining Sleeper API with database overrides
   * This is the main method for getting matchup data with override support
   */
  static async getHybridMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<OrganizedMatchup[]> {
    try {
      console.log('🔄 Getting hybrid matchups:', { seasonId, week, conferenceId });

      // 1. Get matchup records from database (contains team1_id, team2_id)
      // Use different tables based on week: weeks 1-12 use matchups, weeks 13+ use playoff_brackets
      let dbMatchups: DatabaseMatchup[] = [];
      let playoffBrackets: DbPlayoffBracket[] = [];
      
      if (week >= 13) {
        console.log(`🏆 Week ${week} is playoffs - using playoff_brackets table`);
        playoffBrackets = await this.getPlayoffBrackets(seasonId, week, conferenceId);
        const conferences = await this.getConferences(seasonId);
        dbMatchups = this.convertPlayoffBracketsToMatchups(playoffBrackets, conferences);
      } else {
        console.log(`📅 Week ${week} is regular season - using matchups table`);
        dbMatchups = await this.getDatabaseMatchups(seasonId, week, conferenceId);
      }
      
      console.log(`📋 Found ${dbMatchups.length} database matchups`);

      if (dbMatchups.length === 0) {
        console.warn('No database matchups found for the specified criteria');
        return [];
      }

      // 2. Get supporting data
      const conferences = await this.getConferences(seasonId);
      const teams = await this.getTeams();
      const teamConferenceJunctions = await this.getTeamConferenceJunctions();
      
      console.log(`🏢 Loaded ${conferences.length} conferences, ${teams.length} teams`);

      // 3. Process each database matchup
      const organizedMatchups: OrganizedMatchup[] = [];
      
      for (const dbMatchup of dbMatchups) {
        try {
          console.log(`🔄 Processing matchup: Team ${dbMatchup.team1_id} vs Team ${dbMatchup.team2_id}`);

          // Find the conference for this matchup
          const conference = conferences.find(c => c.id === dbMatchup.conference_id);
          if (!conference) {
            console.warn(`Conference ${dbMatchup.conference_id} not found for matchup ${dbMatchup.id}`);
            continue;
          }

          // Get the teams for this matchup
          const team1 = teams.find(t => t.id === dbMatchup.team1_id);
          const team2 = dbMatchup.team2_id ? teams.find(t => t.id === dbMatchup.team2_id) : null;
          
          // Handle bye weeks - team1 must exist, team2 can be null for byes
          if (!team1) {
            console.warn(`Team1 not found: team1_id=${dbMatchup.team1_id}`);
            continue;
          }
          
          // For non-bye matchups, team2 must exist
          if (!dbMatchup.is_bye && !team2) {
            console.warn(`Team2 not found for non-bye matchup: team2_id=${dbMatchup.team2_id}`);
            continue;
          }
          
          // Handle bye weeks separately
          if (dbMatchup.is_bye || !team2) {
            console.log(`🏆 Processing bye week for team ${team1.id}`);
            
            // Find team1's conference junction
            let team1Junction = teamConferenceJunctions.find(j => 
              j.team_id === team1.id && j.conference_id === conference.id
            );
            
            if (!team1Junction) {
              team1Junction = teamConferenceJunctions.find(j => j.team_id === team1.id);
            }
            
            if (!team1Junction) {
              console.warn(`Roster mapping not found for bye team ${team1.id}`);
              continue;
            }
            
            // Get team1's conference and Sleeper data
            const team1Conference = conferences.find(c => c.id === team1Junction.conference_id);
            if (!team1Conference) {
              console.warn(`Conference not found for bye team ${team1.id}`);
              continue;
            }
            
            const team1Matchups = await SleeperApiService.fetchMatchups(team1Conference.league_id, parseInt(dbMatchup.week));
            const team1Rosters = await SleeperApiService.fetchLeagueRosters(team1Conference.league_id);
            const team1Users = await SleeperApiService.fetchLeagueUsers(team1Conference.league_id);
            
            const team1SleeperMatchup = team1Matchups.find(m => m.roster_id === team1Junction.roster_id);
            
            if (!team1SleeperMatchup) {
              console.warn(`Sleeper matchup not found for bye team roster ID ${team1Junction.roster_id}`);
              continue;
            }
            
            // Build bye matchup with only team1
            const byeMatchupTeams = await this.buildByeMatchupTeam(
              team1,
              team1SleeperMatchup,
              team1Rosters,
              team1Users,
              team1Junction.roster_id
            );
            
            const organizedMatchup: OrganizedMatchup = {
              matchup_id: team1SleeperMatchup.matchup_id || 0,
              conference,
              teams: byeMatchupTeams,
              status: 'completed', // Bye weeks are automatically "completed"
              rawData: {
                dbMatchup,
                team1SleeperMatchup,
                team2SleeperMatchup: null,
                isOverride: dbMatchup.manual_override || false,
                isBye: true,
                playoffBracket: week >= 13 ? playoffBrackets.find(pb => pb.id === dbMatchup.id) : undefined
              }
            };
            
            organizedMatchups.push(organizedMatchup);
            console.log(`✅ Successfully processed bye matchup ${dbMatchup.id}`);
            continue;
          }

          // Get roster IDs for these teams - handle interconference matchups
          // For manual overrides/interconference, teams may be from different conferences
          let team1Junction = teamConferenceJunctions.find(j => 
            j.team_id === team1.id && j.conference_id === conference.id
          );
          let team2Junction = teamConferenceJunctions.find(j => 
            j.team_id === team2.id && j.conference_id === conference.id
          );

          // If either team is not found in the matchup's conference, search in their home conferences
          if (!team1Junction) {
            console.log(`🔄 Team ${team1.id} not in conference ${conference.id}, searching home conference`);
            team1Junction = teamConferenceJunctions.find(j => j.team_id === team1.id);
            if (team1Junction) {
              console.log(`✅ Found team ${team1.id} in conference ${team1Junction.conference_id}`);
            }
          }
          
          if (!team2Junction) {
            console.log(`🔄 Team ${team2.id} not in conference ${conference.id}, searching home conference`);
            team2Junction = teamConferenceJunctions.find(j => j.team_id === team2.id);
            if (team2Junction) {
              console.log(`✅ Found team ${team2.id} in conference ${team2Junction.conference_id}`);
            }
          }

          if (!team1Junction || !team2Junction) {
            console.warn(`Roster mappings not found for teams ${team1.id}, ${team2.id} (searched all conferences)`);
            continue;
          }

          // For playoff matchups, always treat as interconference since teams aren't actually 
          // playing each other in Sleeper during playoffs, even if they're in the same conference
          const isPlayoffMatchup = dbMatchup.is_playoff || parseInt(dbMatchup.week) >= 13;
          const isInterconference = isPlayoffMatchup || (team1Junction.conference_id !== team2Junction.conference_id);
          
          let team1SleeperMatchup, team2SleeperMatchup;
          let team1SleeperRosters, team2SleeperRosters;
          let team1SleeperUsers, team2SleeperUsers;

          if (isInterconference) {
            if (isPlayoffMatchup) {
              console.log(`🏆 Processing playoff matchup (treated as interconference): Team ${team1.id} (conf ${team1Junction.conference_id}) vs Team ${team2.id} (conf ${team2Junction.conference_id})`);
            } else {
              console.log(`🔀 Processing interconference matchup: Team ${team1.id} (conf ${team1Junction.conference_id}) vs Team ${team2.id} (conf ${team2Junction.conference_id})`);
            }
            
            // Get conference details for both teams
            const team1Conference = conferences.find(c => c.id === team1Junction.conference_id);
            const team2Conference = conferences.find(c => c.id === team2Junction.conference_id);
            
            if (!team1Conference || !team2Conference) {
              console.warn(`Conference details not found for interconference matchup`);
              continue;
            }

            // Fetch Sleeper data from both conferences
            const [team1Matchups, team2Matchups] = await Promise.all([
              SleeperApiService.fetchMatchups(team1Conference.league_id, parseInt(dbMatchup.week)),
              SleeperApiService.fetchMatchups(team2Conference.league_id, parseInt(dbMatchup.week))
            ]);

            const [team1Rosters, team2Rosters] = await Promise.all([
              SleeperApiService.fetchLeagueRosters(team1Conference.league_id),
              SleeperApiService.fetchLeagueRosters(team2Conference.league_id)
            ]);

            const [team1Users, team2Users] = await Promise.all([
              SleeperApiService.fetchLeagueUsers(team1Conference.league_id),
              SleeperApiService.fetchLeagueUsers(team2Conference.league_id)
            ]);

            // Find each team's matchup in their respective conferences
            team1SleeperMatchup = team1Matchups.find(m => m.roster_id === team1Junction.roster_id);
            team2SleeperMatchup = team2Matchups.find(m => m.roster_id === team2Junction.roster_id);
            
            team1SleeperRosters = team1Rosters;
            team2SleeperRosters = team2Rosters;
            team1SleeperUsers = team1Users;
            team2SleeperUsers = team2Users;

          } else {
            // Same conference - this should only happen for regular season now
            console.log(`📅 Processing same-conference regular season matchup: Team ${team1.id} vs Team ${team2.id} (conf ${team1Junction.conference_id})`);
            const sleeperMatchups = await SleeperApiService.fetchMatchups(conference.league_id, parseInt(dbMatchup.week));
            const sleeperRosters = await SleeperApiService.fetchLeagueRosters(conference.league_id);
            const sleeperUsers = await SleeperApiService.fetchLeagueUsers(conference.league_id);
            
            // Find the specific Sleeper matchups for these roster IDs
            team1SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
            team2SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
            
            team1SleeperRosters = sleeperRosters;
            team2SleeperRosters = sleeperRosters;
            team1SleeperUsers = sleeperUsers;
            team2SleeperUsers = sleeperUsers;
          }

          if (!team1SleeperMatchup || !team2SleeperMatchup) {
            console.warn(`Sleeper matchups not found for roster IDs ${team1Junction.roster_id}, ${team2Junction.roster_id}`);
            continue;
          }

          // For interconference and playoff matchups, skip the matchup_id verification 
          // since they're either in different leagues or artificially matched for playoffs
          if (!isInterconference && !isPlayoffMatchup && team1SleeperMatchup.matchup_id !== team2SleeperMatchup.matchup_id) {
            console.warn(`Teams are not matched against each other in Sleeper: ${team1SleeperMatchup.matchup_id} vs ${team2SleeperMatchup.matchup_id}`);
            continue;
          }

          // Build organized matchup teams with live Sleeper data (updated for interconference)
          const matchupTeams = await this.buildMatchupTeamsFromDatabaseInterconference(
            team1, team2,
            team1SleeperMatchup, team2SleeperMatchup,
            team1SleeperRosters, team2SleeperRosters,
            team1SleeperUsers, team2SleeperUsers,
            team1Junction.roster_id, team2Junction.roster_id
          );

          // Determine status from Sleeper data
          const status = this.determineMatchupStatusFromSleeper(team1SleeperMatchup, team2SleeperMatchup);

          const organizedMatchup: OrganizedMatchup = {
            matchup_id: team1SleeperMatchup.matchup_id || 0,
            conference,
            teams: matchupTeams,
            status,
            rawData: {
              dbMatchup,
              team1SleeperMatchup,
              team2SleeperMatchup,
              isOverride: dbMatchup.manual_override || false,
              playoffBracket: week >= 13 ? playoffBrackets.find(pb => pb.id === dbMatchup.id) : undefined
            }
          };
          
          organizedMatchups.push(organizedMatchup);
          console.log(`✅ Successfully processed matchup ${dbMatchup.id}`);
          
        } catch (error) {
          console.error(`Error processing matchup ${dbMatchup.id}:`, error);
        }
      }
      
      console.log(`✅ Processed ${organizedMatchups.length} hybrid matchups from ${dbMatchups.length} database records`);
      return organizedMatchups;
      
    } catch (error) {
      console.error('Error in getHybridMatchups:', error);
      return [];
    }
  }

  /**
   * Get conferences for a specific season
   */
  static async getConferences(seasonId: number): Promise<Conference[]> {
    try {
      const response = await DatabaseService.getConferences({
        filters: [{ column: 'season_id', operator: 'eq', value: seasonId }],
        limit: 50
      });
      return response.data || [];
    } catch (error) {
      console.error('Error in getConferences:', error);
      return [];
    }
  }

  /**
   * Get all teams
   */
  static async getTeams(): Promise<Team[]> {
    try {
      const response = await DatabaseService.getTeams({
        limit: 500
      });
      return response.data || [];
    } catch (error) {
      console.error('Error in getTeams:', error);
      return [];
    }
  }

  /**
   * Get team-conference junction table data
   */
  static async getTeamConferenceJunctions() {
    try {
      const response = await DatabaseService.getTeamConferenceJunctions({
        limit: 1000
      });
      return response.data || [];
    } catch (error) {
      console.error('Error in getTeamConferenceJunctions:', error);
      return [];
    }
  }

  /**
   * Get playoff brackets for a specific season, week, and conference (weeks 13+)
   */
  static async getPlayoffBrackets(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<DbPlayoffBracket[]> {
    try {
      console.log(`🏆 Getting playoff brackets for season ${seasonId}, week ${week}, conference: ${conferenceId || 'all'}`);

      const filters = [
        { column: 'season_id', operator: 'eq' as const, value: seasonId },
        { column: 'week', operator: 'eq' as const, value: week }
      ];

      // Note: playoff_brackets table doesn't have conference_id directly
      // We'll need to filter by teams that belong to the specified conference
      const response = await DatabaseService.getPlayoffBrackets({
        filters,
        limit: 100
      });

      let playoffBrackets = response.data || [];

      // If conferenceId is specified, filter by teams in that conference
      if (conferenceId && playoffBrackets.length > 0) {
        const teamConferenceJunctions = await this.getTeamConferenceJunctions();
        const teamsInConference = teamConferenceJunctions
          .filter(j => j.conference_id === conferenceId)
          .map(j => j.team_id);

        playoffBrackets = playoffBrackets.filter(bracket => 
          teamsInConference.includes(bracket.team1_id) || 
          teamsInConference.includes(bracket.team2_id)
        );
      }

      console.log(`🏆 Found ${playoffBrackets.length} playoff brackets`);
      return playoffBrackets;
    } catch (error) {
      console.error('Error in getPlayoffBrackets:', error);
      return [];
    }
  }

  /**
   * Convert playoff brackets to matchup format for consistent processing
   */
  static convertPlayoffBracketsToMatchups(
    playoffBrackets: DbPlayoffBracket[],
    conferences: Conference[]
  ): DatabaseMatchup[] {
    return playoffBrackets.map(bracket => {
      // For playoff brackets, we need to determine which conference this matchup belongs to
      // This is a bit tricky since playoff brackets can be interconference
      // For now, we'll use the first conference found, but this could be enhanced
      const conference = conferences[0]; // This is a simplification
      
      const matchup: DatabaseMatchup = {
        id: bracket.id,
        conference_id: conference?.id || 1, // Fallback to 1 if no conference
        week: bracket.week.toString(), // Convert to string to match matchups table format
        team1_id: bracket.team1_id,
        team2_id: bracket.team2_id, // This can be null for bye weeks
        is_playoff: true,
        manual_override: false,
        matchup_status: bracket.winner_team_id ? 'completed' : 'upcoming',
        notes: bracket.playoff_round_name || null,
        matchup_type: 'playoff' as any, // This might need to be adjusted based on your enum
        team1_score: bracket.team1_score || null,
        team2_score: bracket.team2_score || null,
        winning_team_id: bracket.winner_team_id || null,
        // Add is_bye flag to help with processing
        is_bye: bracket.is_bye || false
      };
      
      return matchup;
    });
  }

  /**
   * Get database matchups for a specific season, week, and conference (weeks 1-12)
   */
  static async getDatabaseMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<DatabaseMatchup[]> {
    try {
      // If conferenceId is specified, filter directly
      if (conferenceId) {
        console.log(`🔍 Filtering matchups for specific conference: ${conferenceId}`);
        const filters = [
          { column: 'week', operator: 'eq' as const, value: week.toString() }, // week is text in database
          { column: 'conference_id', operator: 'eq' as const, value: conferenceId }
        ];

        const response = await DatabaseService.getMatchups({
          filters,
          limit: 100
        });

        console.log(`📋 Found ${response.data?.length || 0} matchups for conference ${conferenceId}`);
        return response.data || [];
      }

      // If no specific conference, get all conferences for the season first
      const conferences = await this.getConferences(seasonId);
      const conferenceIds = conferences.map(c => c.id);

      if (conferenceIds.length === 0) {
        console.warn('No conferences found for season:', seasonId);
        return [];
      }

      // Get matchups for all conferences in this season
      const filters = [
        { column: 'week', operator: 'eq' as const, value: week.toString() }, // week is text in database
        { column: 'conference_id', operator: 'in' as const, value: conferenceIds }
      ];

      const response = await DatabaseService.getMatchups({
        filters,
        limit: 100
      });

      console.log(`📋 Found ${response.data?.length || 0} matchups for season ${seasonId}, week ${week}`);
      return response.data || [];
    } catch (error) {
      console.error('Error in getDatabaseMatchups:', error);
      return [];
    }
  }

  /**
   * Get matchup overrides for a specific season, week, and conference
   */
  static async getMatchupOverrides(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<MatchupOverride[]> {
    try {
      console.log('Fetching matchup overrides:', { seasonId, week, conferenceId });

      const filters = [
        { column: 'season_id', operator: 'eq' as const, value: seasonId },
        { column: 'week', operator: 'eq' as const, value: week },
        { column: 'is_active', operator: 'eq' as const, value: true }
      ];

      if (conferenceId) {
        filters.push({ column: 'conference_id', operator: 'eq' as const, value: conferenceId });
      }

      const overridesResponse = await DatabaseService.getMatchupAdminOverrides({
        filters,
        limit: 100
      });

      console.log('Matchup overrides found:', overridesResponse.data?.length || 0);
      return overridesResponse.data || [];
    } catch (error) {
      console.error('Error in getMatchupOverrides:', error);
      return [];
    }
  }

  /**
   * Get organized matchups using database data
   */
  static async getOrganizedMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<OrganizedMatchup[]> {
    try {
      console.log('Getting organized matchups:', { seasonId, week, conferenceId });

      // Get database matchups (using week-based logic)
      let dbMatchups: DatabaseMatchup[] = [];
      
      if (week >= 13) {
        console.log(`🏆 Week ${week} is playoffs - using playoff_brackets table`);
        const playoffBrackets = await this.getPlayoffBrackets(seasonId, week, conferenceId);
        const conferences = await this.getConferences(seasonId);
        dbMatchups = this.convertPlayoffBracketsToMatchups(playoffBrackets, conferences);
      } else {
        console.log(`📅 Week ${week} is regular season - using matchups table`);
        dbMatchups = await this.getDatabaseMatchups(seasonId, week, conferenceId);
      }
      
      // Get conferences and teams
      const conferences = await this.getConferences(seasonId);
      const teams = await this.getTeams();

      // Get matchup overrides
      const overrides = await this.getMatchupOverrides(seasonId, week, conferenceId);

      console.log('Found data:', {
        matchups: dbMatchups.length,
        conferences: conferences.length,
        teams: teams.length,
        overrides: overrides.length
      });

      // For now, return the results from getHybridMatchups since it's more complete
      return this.getHybridMatchups(seasonId, week, conferenceId);
    } catch (error) {
      console.error('Error in getOrganizedMatchups:', error);
      return [];
    }
  }

  /**
   * Simplified team building for basic matchup display
   */
  private static async buildMatchupTeamsSimple(
    sleeperMatchup: any,
    sleeperRosters: any[],
    sleeperUsers: any[],
    teams: Team[],
    conference: Conference
  ): Promise<OrganizedMatchupTeam[]> {
    try {
      const matchupTeams: OrganizedMatchupTeam[] = [];
      
      // Get the roster for this specific matchup
      const currentRoster = sleeperRosters.find(r => r.roster_id === sleeperMatchup.roster_id);
      if (!currentRoster) {
        console.warn(`No roster found for roster_id: ${sleeperMatchup.roster_id}`);
        return [];
      }

      const currentUser = sleeperUsers.find(u => u.user_id === currentRoster.owner_id);
      const currentTeam = teams.find(t => t.owner_id === currentRoster.owner_id);
      
      const matchupTeam: OrganizedMatchupTeam = {
        roster_id: sleeperMatchup.roster_id,
        points: sleeperMatchup.points || 0,
        projected_points: sleeperMatchup.projected_points || 0,
        owner: currentUser || null,
        roster: currentRoster || null,
        team: currentTeam || null,
        players_points: sleeperMatchup.players_points || {},
        starters_points: sleeperMatchup.starters_points || [],
        matchup_starters: sleeperMatchup.starters || []
      };
      
      matchupTeams.push(matchupTeam);
      
      // Note: This simplified version only handles one team per matchup object
      // In the full Sleeper API, matchups come as individual roster entries
      // and need to be paired up by matchup_id
      
      return matchupTeams;
    } catch (error) {
      console.error('Error building simple matchup teams:', error);
      return [];
    }
  }

  /**
   * Simplified status determination
   */
  private static determineMatchupStatusSimple(sleeperMatchup: any): 'live' | 'completed' | 'upcoming' {
    // Basic status logic - this could be enhanced
    if (sleeperMatchup.points && sleeperMatchup.points > 0) {
      return 'completed';
    }
    return 'upcoming';
  }

  /**
   * Build matchup teams using database team assignments and Sleeper live data
   */
  private static async buildMatchupTeamsFromDatabase(
    team1: Team,
    team2: Team,
    team1SleeperMatchup: any,
    team2SleeperMatchup: any,
    sleeperRosters: any[],
    sleeperUsers: any[],
    team1RosterId: number,
    team2RosterId: number
  ): Promise<OrganizedMatchupTeam[]> {
    try {
      const matchupTeams: OrganizedMatchupTeam[] = [];
      
      // Build Team 1
      const team1Roster = sleeperRosters.find(r => r.roster_id === team1RosterId);
      const team1User = sleeperUsers.find(u => u.user_id === team1Roster?.owner_id);
      
      const team1Data: OrganizedMatchupTeam = {
        roster_id: team1RosterId,
        points: team1SleeperMatchup.points || 0,
        projected_points: team1SleeperMatchup.projected_points || 0,
        owner: team1User || null,
        roster: team1Roster || null,
        team: team1,
        players_points: team1SleeperMatchup.players_points || {},
        starters_points: team1SleeperMatchup.starters_points || [],
        matchup_starters: team1SleeperMatchup.starters || []
      };
      
      // Build Team 2
      const team2Roster = sleeperRosters.find(r => r.roster_id === team2RosterId);
      const team2User = sleeperUsers.find(u => u.user_id === team2Roster?.owner_id);
      
      const team2Data: OrganizedMatchupTeam = {
        roster_id: team2RosterId,
        points: team2SleeperMatchup.points || 0,
        projected_points: team2SleeperMatchup.projected_points || 0,
        owner: team2User || null,
        roster: team2Roster || null,
        team: team2,
        players_points: team2SleeperMatchup.players_points || {},
        starters_points: team2SleeperMatchup.starters_points || [],
        matchup_starters: team2SleeperMatchup.starters || []
      };
      
      matchupTeams.push(team1Data, team2Data);
      return matchupTeams;
      
    } catch (error) {
      console.error('Error building matchup teams from database:', error);
      return [];
    }
  }

  /**
   * Build matchup teams for interconference matchups where teams are from different conferences
   */
  private static async buildMatchupTeamsFromDatabaseInterconference(
    team1: Team,
    team2: Team,
    team1SleeperMatchup: any,
    team2SleeperMatchup: any,
    team1SleeperRosters: any[],
    team2SleeperRosters: any[],
    team1SleeperUsers: any[],
    team2SleeperUsers: any[],
    team1RosterId: number,
    team2RosterId: number
  ): Promise<OrganizedMatchupTeam[]> {
    try {
      const matchupTeams: OrganizedMatchupTeam[] = [];
      
      // Build Team 1 (from conference 1)
      const team1Roster = team1SleeperRosters.find(r => r.roster_id === team1RosterId);
      const team1User = team1SleeperUsers.find(u => u.user_id === team1Roster?.owner_id);
      
      const team1Data: OrganizedMatchupTeam = {
        roster_id: team1RosterId,
        points: team1SleeperMatchup.points || 0,
        projected_points: team1SleeperMatchup.projected_points || 0,
        owner: team1User || null,
        roster: team1Roster || null,
        team: team1,
        players_points: team1SleeperMatchup.players_points || {},
        starters_points: team1SleeperMatchup.starters_points || [],
        matchup_starters: team1SleeperMatchup.starters || []
      };
      
      // Build Team 2 (from conference 2)
      const team2Roster = team2SleeperRosters.find(r => r.roster_id === team2RosterId);
      const team2User = team2SleeperUsers.find(u => u.user_id === team2Roster?.owner_id);
      
      const team2Data: OrganizedMatchupTeam = {
        roster_id: team2RosterId,
        points: team2SleeperMatchup.points || 0,
        projected_points: team2SleeperMatchup.projected_points || 0,
        owner: team2User || null,
        roster: team2Roster || null,
        team: team2,
        players_points: team2SleeperMatchup.players_points || {},
        starters_points: team2SleeperMatchup.starters_points || [],
        matchup_starters: team2SleeperMatchup.starters || []
      };
      
      matchupTeams.push(team1Data, team2Data);
      return matchupTeams;
      
    } catch (error) {
      console.error('Error building interconference matchup teams from database:', error);
      return [];
    }
  }

  /**
   * Build matchup team for bye weeks (single team)
   */
  private static async buildByeMatchupTeam(
    team: Team,
    sleeperMatchup: any,
    sleeperRosters: any[],
    sleeperUsers: any[],
    rosterId: number
  ): Promise<OrganizedMatchupTeam[]> {
    try {
      const roster = sleeperRosters.find(r => r.roster_id === rosterId);
      const user = sleeperUsers.find(u => u.user_id === roster?.owner_id);
      
      const matchupTeam: OrganizedMatchupTeam = {
        roster_id: rosterId,
        points: sleeperMatchup.points || 0,
        projected_points: sleeperMatchup.projected_points || 0,
        owner: user || null,
        roster: roster || null,
        team: team,
        players_points: sleeperMatchup.players_points || {},
        starters_points: sleeperMatchup.starters_points || [],
        matchup_starters: sleeperMatchup.starters || []
      };
      
      return [matchupTeam];
    } catch (error) {
      console.error('Error building bye matchup team:', error);
      return [];
    }
  }

  /**
   * Determine matchup status from Sleeper matchup data
   */
  private static determineMatchupStatusFromSleeper(
    team1SleeperMatchup: any,
    team2SleeperMatchup: any
  ): 'live' | 'completed' | 'upcoming' {
    // Check if both teams have points data
    const team1HasPoints = team1SleeperMatchup.points && team1SleeperMatchup.points > 0;
    const team2HasPoints = team2SleeperMatchup && team2SleeperMatchup.points && team2SleeperMatchup.points > 0;
    
    // If both teams have points, it's likely completed
    if (team1HasPoints && team2HasPoints) {
      return 'completed';
    }
    
    // If either team has points, it might be live
    if (team1HasPoints || team2HasPoints) {
      return 'live';
    }
    
    // No points yet, probably upcoming
    return 'upcoming';
  }
}

export default SupabaseMatchupService;
