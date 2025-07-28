// Enhanced Supabase-based service for handling matchup data with performance optimizations
import { DatabaseService } from './databaseService';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';
import { DbMatchup, DbConference, DbTeam, DbMatchupAdminOverride, DbPlayoffBracket } from '@/types/database';
import MatchupCache from './matchupCache';

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
   * Enhanced with caching and parallel processing for better performance
   */
  static async getHybridMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<OrganizedMatchup[]> {
    try {
      console.log('🚀 Getting optimized hybrid matchups:', { seasonId, week, conferenceId });
      const startTime = performance.now();

      // 1. Batch all database queries in parallel for better performance
      const [dbMatchupsResult, conferencesResult, teamsResult, junctionsResult] = await Promise.all([
        week >= 13 
          ? this.getPlayoffBrackets(seasonId, week, conferenceId)
          : this.getDatabaseMatchups(seasonId, week, conferenceId),
        this.getConferences(seasonId),
        this.getTeams(),
        this.getTeamConferenceJunctions()
      ]);

      // Process results based on week type
      let dbMatchups: DatabaseMatchup[] = [];
      if (week >= 13) {
        console.log(`🏆 Week ${week} is playoffs - using playoff_brackets table`);
        dbMatchups = this.convertPlayoffBracketsToMatchups(dbMatchupsResult as DbPlayoffBracket[], conferencesResult);
      } else {
        console.log(`📅 Week ${week} is regular season - using matchups table`);
        dbMatchups = dbMatchupsResult as DatabaseMatchup[];
      }
      
      console.log(`📋 Found ${dbMatchups.length} database matchups in ${(performance.now() - startTime).toFixed(2)}ms`);

      if (dbMatchups.length === 0) {
        console.warn('No database matchups found for the specified criteria');
        return [];
      }

      const conferences = conferencesResult;
      const teams = teamsResult;
      const teamConferenceJunctions = junctionsResult;
      
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
   * Get minimal matchup data for fast initial loading
   * Only includes essential information without detailed roster data
   */
  static async getMinimalMatchups(
    seasonId: number,
    week: number,
    conferenceId?: number
  ): Promise<{
    id: number;
    matchup_id: number;
    conference: { id: number; name: string };
    teams: { id: number; name: string; owner: string; points: number; roster_id: number; conference?: { id: number; name: string } }[];
    status: 'live' | 'completed' | 'upcoming';
    week: number;
    is_playoff: boolean;
    is_bye?: boolean;
    playoff_round_name?: string;
    manual_override?: boolean;
  }[]> {
    try {
      console.log('🚀 Loading minimal matchups (optimized)...');
      const startTime = performance.now();

      // Batch all database queries in parallel
      const [dbMatchupsResult, conferences, teams, junctions] = await Promise.all([
        week >= 13 
          ? this.getPlayoffBrackets(seasonId, week, conferenceId)
          : this.getDatabaseMatchups(seasonId, week, conferenceId),
        this.getConferences(seasonId),
        this.getTeams(),
        this.getTeamConferenceJunctions()
      ]);

      // Process matchups based on week type
      let dbMatchups: DatabaseMatchup[] = [];
      if (week >= 13) {
        dbMatchups = this.convertPlayoffBracketsToMatchups(dbMatchupsResult as DbPlayoffBracket[], conferences);
      } else {
        dbMatchups = dbMatchupsResult as DatabaseMatchup[];
      }

      console.log(`📊 Batch data loaded in ${(performance.now() - startTime).toFixed(2)}ms`);

      // Process matchups with minimal data only
      const minimalMatchups = [];

      for (const dbMatchup of dbMatchups) {
        const conference = conferences.find(c => c.id === dbMatchup.conference_id);
        if (!conference) continue;

        const team1 = teams.find(t => t.id === dbMatchup.team1_id);
        const team2 = dbMatchup.team2_id ? teams.find(t => t.id === dbMatchup.team2_id) : null;

        if (!team1) continue;

        // Get roster IDs for teams and their conferences
        const team1Junction = junctions.find(j => j.team_id === team1.id);
        const team2Junction = team2 ? junctions.find(j => j.team_id === team2.id) : null;

        // Get team conferences for interconference matchup detection
        const team1Conference = team1Junction ? conferences.find(c => c.id === team1Junction.conference_id) : null;
        const team2Conference = team2Junction ? conferences.find(c => c.id === team2Junction.conference_id) : null;

        // Build minimal matchup
        const minimalMatchup = {
          id: dbMatchup.id,
          matchup_id: 0, // Will be populated from Sleeper data if needed
          conference: {
            id: conference.id,
            name: conference.conference_name
          },
          teams: [
            {
              id: team1.id,
              name: team1.team_name,
              owner: team1.owner_name,
              points: dbMatchup.team1_score || 0,
              roster_id: team1Junction?.roster_id || 0,
              conference: team1Conference ? {
                id: team1Conference.id,
                name: team1Conference.conference_name
              } : undefined
            }
          ],
          status: this.determineMatchupStatusFromDb(dbMatchup),
          week: parseInt(dbMatchup.week),
          is_playoff: dbMatchup.is_playoff || false,
          is_bye: dbMatchup.is_bye || false,
          manual_override: dbMatchup.manual_override || false
        };

        // Add team2 if not a bye
        if (team2 && team2Junction && !dbMatchup.is_bye) {
          minimalMatchup.teams.push({
            id: team2.id,
            name: team2.team_name,
            owner: team2.owner_name,
            points: dbMatchup.team2_score || 0,
            roster_id: team2Junction.roster_id,
            conference: team2Conference ? {
              id: team2Conference.id,
              name: team2Conference.conference_name
            } : undefined
          });
        }

        // Add playoff round name if applicable
        if (week >= 13 && 'playoff_round_name' in dbMatchup) {
          (minimalMatchup as any).playoff_round_name = (dbMatchup as any).playoff_round_name;
        }

        minimalMatchups.push(minimalMatchup);
      }

      console.log(`✅ Minimal matchups loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      return minimalMatchups;

    } catch (error) {
      console.error('Error loading minimal matchups:', error);
      return [];
    }
  }

  /**
   * Get detailed matchup data on-demand (when expanded)
   */
  static async getMatchupDetails(
    matchupId: number,
    seasonId: number,
    week: number
  ): Promise<{
    players_points: Record<string, Record<string, number>>;
    starters: Record<string, string[]>;
    bench_players: Record<string, string[]>;
    rosters: Record<string, SleeperRoster>;
    users: Record<string, SleeperUser>;
  } | null> {
    try {
      console.log(`🔍 Loading details for matchup ${matchupId}...`);
      const startTime = performance.now();

      // Check cache first
      const cached = MatchupCache.getCachedMatchupDetails(matchupId, week);
      if (cached) {
        return cached;
      }

      // Get matchup from database
      const matchupResult = week >= 13 
        ? await DatabaseService.getPlayoffBrackets({
            filters: [{ column: 'id', operator: 'eq', value: matchupId }]
          })
        : await DatabaseService.getMatchups({
            filters: [{ column: 'id', operator: 'eq', value: matchupId }]
          });

      const dbMatchup = matchupResult.data?.[0];
      if (!dbMatchup) return null;

      // Get conference and team data
      const [conferences, teams, junctions] = await Promise.all([
        DatabaseService.getConferences({
          filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
        }),
        DatabaseService.getTeams({ limit: 500 }),
        DatabaseService.getTeamConferenceJunctions({ limit: 1000 })
      ]);

      const conference = conferences.data?.find(c => c.id === dbMatchup.conference_id);
      if (!conference) return null;

      // Check cache for Sleeper data
      let sleeperMatchups, sleeperRosters, sleeperUsers;
      const cachedSleeperData = MatchupCache.getCachedConferenceData(conference.league_id, week);
      
      if (cachedSleeperData) {
        ({ matchups: sleeperMatchups, rosters: sleeperRosters, users: sleeperUsers } = cachedSleeperData);
      } else {
        // Fetch Sleeper data for this specific conference
        [sleeperMatchups, sleeperRosters, sleeperUsers] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, week),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)
        ]);

        // Cache the Sleeper data
        MatchupCache.setCachedConferenceData(conference.league_id, week, {
          matchups: sleeperMatchups,
          rosters: sleeperRosters,
          users: sleeperUsers
        });
      }

      // Build detailed data
      const detailedData = {
        players_points: {} as Record<string, Record<string, number>>,
        starters: {} as Record<string, string[]>,
        bench_players: {} as Record<string, string[]>,
        rosters: {} as Record<string, SleeperRoster>,
        users: {} as Record<string, SleeperUser>
      };

      // Process team data
      const team1 = teams.data?.find(t => t.id === dbMatchup.team1_id);
      const team2 = dbMatchup.team2_id ? teams.data?.find(t => t.id === dbMatchup.team2_id) : null;

      if (team1) {
        const team1Junction = junctions.data?.find(j => j.team_id === team1.id);
        if (team1Junction) {
          const team1SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
          const team1Roster = sleeperRosters.find(r => r.roster_id === team1Junction.roster_id);
          const team1User = sleeperUsers.find(u => u.user_id === team1Roster?.owner_id);

          if (team1SleeperMatchup && team1Roster) {
            detailedData.players_points[team1.id.toString()] = team1SleeperMatchup.players_points || {};
            detailedData.starters[team1.id.toString()] = team1SleeperMatchup.starters || [];
            detailedData.bench_players[team1.id.toString()] = (team1Roster.players || [])
              .filter(p => !team1SleeperMatchup.starters?.includes(p));
            detailedData.rosters[team1.id.toString()] = team1Roster;
            if (team1User) detailedData.users[team1.id.toString()] = team1User;
          }
        }
      }

      if (team2) {
        const team2Junction = junctions.data?.find(j => j.team_id === team2.id);
        if (team2Junction) {
          const team2SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
          const team2Roster = sleeperRosters.find(r => r.roster_id === team2Junction.roster_id);
          const team2User = sleeperUsers.find(u => u.user_id === team2Roster?.owner_id);

          if (team2SleeperMatchup && team2Roster) {
            detailedData.players_points[team2.id.toString()] = team2SleeperMatchup.players_points || {};
            detailedData.starters[team2.id.toString()] = team2SleeperMatchup.starters || [];
            detailedData.bench_players[team2.id.toString()] = (team2Roster.players || [])
              .filter(p => !team2SleeperMatchup.starters?.includes(p));
            detailedData.rosters[team2.id.toString()] = team2Roster;
            if (team2User) detailedData.users[team2.id.toString()] = team2User;
          }
        }
      }

      // Cache the result
      MatchupCache.setCachedMatchupDetails(matchupId, week, detailedData);

      console.log(`✅ Matchup details loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      return detailedData;

    } catch (error) {
      console.error(`Error loading matchup details for ${matchupId}:`, error);
      return null;
    }
  }

  /**
   * Determine matchup status from database data
   */
  private static determineMatchupStatusFromDb(matchup: any): 'live' | 'completed' | 'upcoming' {
    if (matchup.matchup_status === 'completed' || matchup.winning_team_id) {
      return 'completed';
    }
    
    if (matchup.team1_score > 0 || matchup.team2_score > 0) {
      return 'live';
    }
    
    return 'upcoming';
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
        matchup_status: bracket.winning_team_id ? 'completed' : 'upcoming',
        notes: bracket.playoff_round_name || null,
        matchup_type: 'playoff' as any, // This might need to be adjusted based on your enum
        team1_score: bracket.team1_score || null,
        team2_score: bracket.team2_score || null,
        winning_team_id: bracket.winning_team_id || null,
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

  /**
   * Get detailed matchup data for the matchup detail page
   */
  static async getDetailedMatchup(
    matchupId: number,
    seasonId: number
  ): Promise<any | null> {
    try {
      console.log(`🔍 Loading detailed matchup ${matchupId} for season ${seasonId}...`);
      
      // Get matchup from database
      const matchupResult = await DatabaseService.getMatchups({
        filters: [{ column: 'id', operator: 'eq', value: matchupId }]
      });

      const dbMatchup = matchupResult.data?.[0];
      if (!dbMatchup) return null;

      // Get related data
      const [conferences, teams, junctions] = await Promise.all([
        this.getConferences(seasonId),
        this.getTeams(),
        this.getTeamConferenceJunctions()
      ]);

      const conference = conferences.find(c => c.id === dbMatchup.conference_id);
      if (!conference) return null;

      const team1 = teams.find(t => t.id === dbMatchup.team1_id);
      const team2 = dbMatchup.team2_id ? teams.find(t => t.id === dbMatchup.team2_id) : null;

      if (!team1) return null;

      // Get roster mappings
      const team1Junction = junctions.find(j => j.team_id === team1.id);
      const team2Junction = team2 ? junctions.find(j => j.team_id === team2.id) : null;

      if (!team1Junction || (team2 && !team2Junction)) return null;

      // Get Sleeper data
      const [sleeperMatchups, sleeperRosters, sleeperUsers] = await Promise.all([
        SleeperApiService.fetchMatchups(conference.league_id, parseInt(dbMatchup.week)),
        SleeperApiService.fetchLeagueRosters(conference.league_id),
        SleeperApiService.fetchLeagueUsers(conference.league_id)
      ]);

      // Build detailed matchup object
      const detailedMatchup = {
        id: dbMatchup.id,
        week: parseInt(dbMatchup.week),
        status: this.determineMatchupStatusFromDb(dbMatchup),
        isPlayoff: dbMatchup.is_playoff || false,
        playoffRound: dbMatchup.notes,
        conference: {
          id: conference.id,
          name: conference.conference_name
        },
        teams: [] as any[],
        isBye: dbMatchup.is_bye || false,
        scoreDifferential: Math.abs((dbMatchup.team1_score || 0) - (dbMatchup.team2_score || 0)),
        gameTimeRemaining: undefined // Would need to be calculated from NFL data
      };

      // Build team data
      const team1SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
      const team1Roster = sleeperRosters.find(r => r.roster_id === team1Junction.roster_id);
      const team1User = sleeperUsers.find(u => u.user_id === team1Roster?.owner_id);

      if (team1SleeperMatchup && team1Roster) {
        detailedMatchup.teams.push({
          id: team1.id,
          name: team1.team_name,
          owner: team1.owner_name,
          avatar: team1.team_logourl,
          record: { wins: 0, losses: 0 }, // Would need to be fetched from team_records
          points: dbMatchup.team1_score || 0,
          projectedPoints: team1SleeperMatchup.projected_points || 0,
          rosterId: team1Junction.roster_id,
          starters: team1SleeperMatchup.starters || [],
          bench: (team1Roster.players || []).filter(p => !team1SleeperMatchup.starters?.includes(p)),
          playersPoints: team1SleeperMatchup.players_points || {},
          playersProjected: {} // Would need to be calculated from projections
        });
      }

      if (team2 && team2Junction && !dbMatchup.is_bye) {
        const team2SleeperMatchup = sleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
        const team2Roster = sleeperRosters.find(r => r.roster_id === team2Junction.roster_id);
        const team2User = sleeperUsers.find(u => u.user_id === team2Roster?.owner_id);

        if (team2SleeperMatchup && team2Roster) {
          detailedMatchup.teams.push({
            id: team2.id,
            name: team2.team_name,
            owner: team2.owner_name,
            avatar: team2.team_logourl,
            record: { wins: 0, losses: 0 }, // Would need to be fetched from team_records
            points: dbMatchup.team2_score || 0,
            projectedPoints: team2SleeperMatchup.projected_points || 0,
            rosterId: team2Junction.roster_id,
            starters: team2SleeperMatchup.starters || [],
            bench: (team2Roster.players || []).filter(p => !team2SleeperMatchup.starters?.includes(p)),
            playersPoints: team2SleeperMatchup.players_points || {},
            playersProjected: {} // Would need to be calculated from projections
          });
        }
      }

      return detailedMatchup;

    } catch (error) {
      console.error(`Error loading detailed matchup ${matchupId}:`, error);
      return null;
    }
  }

  /**
   * Get head-to-head history between two teams
   */
  static async getHeadToHeadHistory(
    team1Id: number,
    team2Id: number,
    seasonId: number
  ): Promise<any[]> {
    try {
      console.log(`📊 Loading head-to-head history for teams ${team1Id} vs ${team2Id}...`);
      
      // Get all matchups between these teams
      const matchupsResult = await DatabaseService.getMatchups({
        filters: [
          { column: 'season_id', operator: 'eq', value: seasonId }
        ],
        limit: 100
      });

      const allMatchups = matchupsResult.data || [];
      
      // Filter for matchups between these specific teams
      const headToHeadMatchups = allMatchups.filter(matchup => 
        (matchup.team1_id === team1Id && matchup.team2_id === team2Id) ||
        (matchup.team1_id === team2Id && matchup.team2_id === team1Id)
      );

      // Get team names for display
      const teams = await this.getTeams();
      const team1 = teams.find(t => t.id === team1Id);
      const team2 = teams.find(t => t.id === team2Id);

      // Convert to history format
      const history = headToHeadMatchups.map(matchup => {
        const isTeam1First = matchup.team1_id === team1Id;
        const team1Score = isTeam1First ? (matchup.team1_score || 0) : (matchup.team2_score || 0);
        const team2Score = isTeam1First ? (matchup.team2_score || 0) : (matchup.team1_score || 0);
        
        let winner = 'Tie';
        if (team1Score > team2Score) {
          winner = team1?.team_name || 'Team 1';
        } else if (team2Score > team1Score) {
          winner = team2?.team_name || 'Team 2';
        }

        return {
          week: parseInt(matchup.week),
          season: '2024', // Would need to be dynamic based on season
          team1Score,
          team2Score,
          winner,
          date: new Date(matchup.created_at || Date.now())
        };
      });

      return history.sort((a, b) => b.week - a.week); // Most recent first

    } catch (error) {
      console.error(`Error loading head-to-head history:`, error);
      return [];
    }
  }
}

export default SupabaseMatchupService;