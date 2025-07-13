// Service for combining database matchup assignments with Sleeper API data
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

export interface TeamWithConference {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name: string;
  co_owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
  conference_id: number;
  roster_id: string;
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

export interface EnrichedMatchup {
  matchup_id: number;
  database_id: number;
  conference: Conference;
  teams: Array<{
    roster_id: number;
    points: number;
    projected_points?: number;
    owner: SleeperUser | null;
    roster: SleeperRoster | null;
    team: TeamWithConference | null;
    players_points: Record<string, number>;
    starters_points: number[];
    matchup_starters: string[];
  }>;
  status: 'live' | 'completed' | 'upcoming';
  is_manual_override: boolean;
  database_scores: {
    team_1_score: number;
    team_2_score: number;
    winner_id: number;
  };
  rawData?: any;
}

export class MatchupService {
  /**
   * Fetch database matchups for specific filters
   */
  static async fetchDatabaseMatchups(filters: {
    conference_ids?: number[];
    week?: number;
    season_id?: number;
  }): Promise<DatabaseMatchup[]> {
    try {
      console.log('🔍 Fetching database matchups with filters:', filters);
      
      const queryFilters: any[] = [];
      
      if (filters.week) {
        queryFilters.push({
          name: 'week',
          op: 'Equal',
          value: filters.week
        });
      }
      
      if (filters.conference_ids && filters.conference_ids.length > 0) {
        // For multiple conference IDs, we'll need to fetch them separately
        // since the API doesn't support IN operator
        const allMatchups: DatabaseMatchup[] = [];
        
        for (const conferenceId of filters.conference_ids) {
          const { data, error } = await window.ezsite.apis.tablePage(13329, {
            PageNo: 1,
            PageSize: 100,
            Filters: [
              ...queryFilters,
              {
                name: 'conference_id',
                op: 'Equal',
                value: conferenceId
              }
            ],
            OrderByField: 'id',
            IsAsc: true
          });
          
          if (error) {
            console.error(`Error fetching matchups for conference ${conferenceId}:`, error);
            throw error;
          }
          
          allMatchups.push(...(data.List || []));
        }
        
        console.log(`✅ Fetched ${allMatchups.length} total database matchups`);
        return allMatchups;
      } else {
        // Fetch all matchups if no conference filter
        const { data, error } = await window.ezsite.apis.tablePage(13329, {
          PageNo: 1,
          PageSize: 1000,
          Filters: queryFilters,
          OrderByField: 'id',
          IsAsc: true
        });
        
        if (error) throw error;
        
        console.log(`✅ Fetched ${data.List?.length || 0} database matchups`);
        return data.List || [];
      }
    } catch (error) {
      console.error('❌ Error fetching database matchups:', error);
      throw error;
    }
  }

  /**
   * Fetch teams with conference associations
   */
  static async fetchTeamsWithConferences(): Promise<TeamWithConference[]> {
    try {
      console.log('👥 Fetching teams with conference associations...');
      
      // Fetch teams
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'team_name',
        IsAsc: true
      });
      
      if (teamsError) throw teamsError;
      
      // Fetch team-conference junction data
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1000
      });
      
      if (junctionError) throw junctionError;
      
      // Combine team data with conference associations
      const teamsWithConferences = (teamsData.List || []).map((team: any) => {
        const junction = (junctionData.List || []).find((j: any) => j.team_id === team.id);
        return {
          ...team,
          conference_id: junction?.conference_id || 0,
          roster_id: junction?.roster_id || ''
        };
      });
      
      console.log(`✅ Loaded ${teamsWithConferences.length} teams with conference data`);
      return teamsWithConferences;
    } catch (error) {
      console.error('❌ Error fetching teams with conferences:', error);
      throw error;
    }
  }

  /**
   * Get Sleeper data for a specific roster in a league
   */
  static async getSleeperDataForRoster(
    leagueId: string, 
    rosterId: number, 
    week: number,
    cachedData?: {
      rosters?: SleeperRoster[];
      users?: SleeperUser[];
      matchups?: SleeperMatchup[];
    }
  ): Promise<{
    roster: SleeperRoster | null;
    user: SleeperUser | null;
    matchup: SleeperMatchup | null;
  }> {
    try {
      // Use cached data if available, otherwise fetch
      const rosters = cachedData?.rosters || await SleeperApiService.fetchLeagueRosters(leagueId);
      const users = cachedData?.users || await SleeperApiService.fetchLeagueUsers(leagueId);
      const matchups = cachedData?.matchups || await SleeperApiService.fetchMatchups(leagueId, week);
      
      const roster = rosters.find(r => r.roster_id === rosterId) || null;
      const user = roster ? users.find(u => u.user_id === roster.owner_id) || null : null;
      const matchup = matchups.find(m => m.roster_id === rosterId) || null;
      
      return { roster, user, matchup };
    } catch (error) {
      console.error(`❌ Error getting Sleeper data for roster ${rosterId} in league ${leagueId}:`, error);
      return { roster: null, user: null, matchup: null };
    }
  }

  /**
   * Build enriched matchups by combining database assignments with Sleeper API data
   */
  static async buildEnrichedMatchups(
    databaseMatchups: DatabaseMatchup[],
    conferences: Conference[],
    teams: TeamWithConference[],
    week: number,
    selectedSeason: number,
    currentWeek: number,
    allPlayers: Record<string, SleeperPlayer>
  ): Promise<EnrichedMatchup[]> {
    try {
      console.log('🔧 Building enriched matchups...');
      console.log(`📊 Processing ${databaseMatchups.length} database matchups`);
      
      const enrichedMatchups: EnrichedMatchup[] = [];
      
      // Group conferences by league_id for efficient API calls
      const conferencesByLeague = new Map<string, Conference>();
      conferences.forEach(conf => {
        conferencesByLeague.set(conf.league_id, conf);
      });
      
      // Cache Sleeper data by league to avoid duplicate API calls
      const sleeperDataCache = new Map<string, {
        rosters: SleeperRoster[];
        users: SleeperUser[];
        matchups: SleeperMatchup[];
      }>();
      
      for (const dbMatchup of databaseMatchups) {
        try {
          console.log(`🔄 Processing database matchup ${dbMatchup.id}`);
          
          const conference = conferences.find(c => c.id === dbMatchup.conference_id);
          if (!conference) {
            console.warn(`⚠️ Conference not found for matchup ${dbMatchup.id}`);
            continue;
          }
          
          const team1 = teams.find(t => t.id === dbMatchup.team_1_id);
          const team2 = teams.find(t => t.id === dbMatchup.team_2_id);
          
          if (!team1 || !team2) {
            console.warn(`⚠️ Teams not found for matchup ${dbMatchup.id} (team1: ${dbMatchup.team_1_id}, team2: ${dbMatchup.team_2_id})`);
            continue;
          }
          
          // Get or fetch Sleeper data for this league
          let sleeperData = sleeperDataCache.get(conference.league_id);
          if (!sleeperData) {
            console.log(`📡 Fetching Sleeper data for league ${conference.league_id}`);
            try {
              const [rosters, users, matchups] = await Promise.all([
                SleeperApiService.fetchLeagueRosters(conference.league_id),
                SleeperApiService.fetchLeagueUsers(conference.league_id),
                SleeperApiService.fetchMatchups(conference.league_id, week)
              ]);
              
              sleeperData = { rosters, users, matchups };
              sleeperDataCache.set(conference.league_id, sleeperData);
            } catch (error) {
              console.error(`❌ Failed to fetch Sleeper data for league ${conference.league_id}:`, error);
              continue;
            }
          }
          
          // Get Sleeper data for both teams using their roster_ids
          const team1RosterId = parseInt(team1.roster_id) || 0;
          const team2RosterId = parseInt(team2.roster_id) || 0;
          
          const team1SleeperData = await this.getSleeperDataForRoster(
            conference.league_id, 
            team1RosterId, 
            week, 
            sleeperData
          );
          
          const team2SleeperData = await this.getSleeperDataForRoster(
            conference.league_id, 
            team2RosterId, 
            week, 
            sleeperData
          );
          
          // Determine points based on manual override or Sleeper data
          const team1Points = dbMatchup.is_manual_override 
            ? dbMatchup.team_1_score 
            : (team1SleeperData.matchup?.points ?? 0);
            
          const team2Points = dbMatchup.is_manual_override 
            ? dbMatchup.team_2_score 
            : (team2SleeperData.matchup?.points ?? 0);
          
          // Determine status
          const status = this.determineMatchupStatus(
            week, 
            currentWeek, 
            selectedSeason, 
            dbMatchup,
            team1Points + team2Points > 0
          );
          
          const enrichedMatchup: EnrichedMatchup = {
            matchup_id: dbMatchup.id, // Use database ID as unique identifier
            database_id: dbMatchup.id,
            conference,
            teams: [
              {
                roster_id: team1RosterId,
                points: team1Points,
                projected_points: team1SleeperData.matchup?.custom_points,
                owner: team1SleeperData.user,
                roster: team1SleeperData.roster,
                team: team1,
                players_points: team1SleeperData.matchup?.players_points || {},
                starters_points: team1SleeperData.matchup?.starters_points || [],
                matchup_starters: team1SleeperData.matchup?.starters || []
              },
              {
                roster_id: team2RosterId,
                points: team2Points,
                projected_points: team2SleeperData.matchup?.custom_points,
                owner: team2SleeperData.user,
                roster: team2SleeperData.roster,
                team: team2,
                players_points: team2SleeperData.matchup?.players_points || {},
                starters_points: team2SleeperData.matchup?.starters_points || [],
                matchup_starters: team2SleeperData.matchup?.starters || []
              }
            ],
            status,
            is_manual_override: dbMatchup.is_manual_override,
            database_scores: {
              team_1_score: dbMatchup.team_1_score,
              team_2_score: dbMatchup.team_2_score,
              winner_id: dbMatchup.winner_id
            }
          };
          
          enrichedMatchups.push(enrichedMatchup);
          console.log(`✅ Created enriched matchup ${dbMatchup.id} (${team1.team_name} vs ${team2.team_name})`);
          
        } catch (error) {
          console.error(`❌ Error processing database matchup ${dbMatchup.id}:`, error);
          continue;
        }
      }
      
      console.log(`🎯 Built ${enrichedMatchups.length} enriched matchups`);
      return enrichedMatchups;
      
    } catch (error) {
      console.error('❌ Error building enriched matchups:', error);
      throw error;
    }
  }

  /**
   * Determine matchup status based on various factors
   */
  static determineMatchupStatus(
    selectedWeek: number,
    currentWeek: number,
    selectedSeason: number,
    dbMatchup: DatabaseMatchup,
    hasPoints: boolean
  ): 'live' | 'completed' | 'upcoming' {
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;
    
    // For historical seasons, all matchups should be completed
    if (isHistoricalSeason) {
      return 'completed';
    }
    
    // If manually overridden and marked complete, it's completed
    if (dbMatchup.is_manual_override && dbMatchup.status === 'complete') {
      return 'completed';
    }
    
    // For current season, use normal logic
    if (selectedWeek > currentWeek) {
      return 'upcoming';
    } else if (selectedWeek < currentWeek) {
      return 'completed';
    } else {
      // Current week - check if scoring has started
      return hasPoints ? 'live' : 'upcoming';
    }
  }

  /**
   * Main method to get matchups for display
   */
  static async getMatchupsForDisplay(params: {
    selectedSeason: number;
    selectedConference?: string;
    selectedWeek: number;
    currentWeek: number;
    currentSeasonConfig: any;
  }): Promise<{
    matchups: EnrichedMatchup[];
    errors: string[];
    conferences: Conference[];
    teams: TeamWithConference[];
    allPlayers: Record<string, SleeperPlayer>;
  }> {
    try {
      console.log('🚀 Starting getMatchupsForDisplay with params:', params);
      
      const errors: string[] = [];
      
      // Step 1: Get the season ID
      const seasonsResponse = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: [{
          name: 'season_year',
          op: 'Equal',
          value: params.selectedSeason
        }]
      });
      
      if (seasonsResponse.error) {
        throw new Error(seasonsResponse.error);
      }
      
      const currentSeason = seasonsResponse.data.List?.find((s: any) => s.season_year === params.selectedSeason);
      if (!currentSeason) {
        throw new Error(`No season found for year ${params.selectedSeason}`);
      }
      
      // Step 2: Get conferences for this season
      const conferencesFilters = [{
        name: 'season_id',
        op: 'Equal',
        value: currentSeason.id
      }];
      
      if (params.selectedConference) {
        const targetConference = params.currentSeasonConfig.conferences.find((c: any) => c.id === params.selectedConference);
        if (targetConference) {
          conferencesFilters.push({
            name: 'league_id',
            op: 'Equal',
            value: targetConference.leagueId
          });
        }
      }
      
      const conferencesResponse = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: conferencesFilters
      });
      
      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }
      
      const conferences: Conference[] = conferencesResponse.data.List || [];
      console.log(`📋 Found ${conferences.length} conferences`);
      
      // Step 3: Get teams with conference associations
      const teams = await this.fetchTeamsWithConferences();
      
      // Step 4: Get all players data
      const allPlayers = await SleeperApiService.fetchAllPlayers();
      
      // Step 5: Get database matchups
      const conferenceIds = conferences.map(c => c.id);
      const databaseMatchups = await this.fetchDatabaseMatchups({
        conference_ids: conferenceIds,
        week: params.selectedWeek
      });
      
      console.log(`📊 Found ${databaseMatchups.length} database matchups for week ${params.selectedWeek}`);
      
      // Step 6: Build enriched matchups
      const enrichedMatchups = await this.buildEnrichedMatchups(
        databaseMatchups,
        conferences,
        teams,
        params.selectedWeek,
        params.selectedSeason,
        params.currentWeek,
        allPlayers
      );
      
      return {
        matchups: enrichedMatchups,
        errors,
        conferences,
        teams,
        allPlayers
      };
      
    } catch (error) {
      console.error('❌ Error in getMatchupsForDisplay:', error);
      throw error;
    }
  }
}

export default MatchupService;
