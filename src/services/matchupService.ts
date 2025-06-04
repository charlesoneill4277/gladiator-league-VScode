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

export interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
  joined_date: string;
}

export interface HybridMatchupTeam {
  roster_id: number;
  points: number;
  projected_points?: number;
  owner: SleeperUser | null;
  roster: SleeperRoster | null;
  team: Team | null;
  players_points: Record<string, number>;
  starters_points: number[];
  matchup_starters: string[];
  database_team_id?: number; // From database
}

export interface HybridMatchup {
  matchup_id: number;
  conference: Conference;
  teams: HybridMatchupTeam[];
  status: 'live' | 'completed' | 'upcoming';
  isManualOverride: boolean;
  databaseMatchupId?: number;
  overrideNotes?: string;
  dataSource: 'database' | 'sleeper' | 'hybrid';
  week: number;
  rawData?: any;
}

class MatchupService {
  private teamConferenceMap = new Map<string, {teamId: number;rosterId: string;}>();

  /**
   * Fetch database matchups for a specific week and conferences
   */
  async fetchDatabaseMatchups(conferenceIds: number[], week: number): Promise<DatabaseMatchup[]> {
    try {
      console.log('🗄️ Fetching database matchups...', { conferenceIds, week });

      if (conferenceIds.length === 0) {
        console.log('No conference IDs provided, skipping database query');
        return [];
      }

      const filters = [
      {
        name: 'week',
        op: 'Equal',
        value: week
      }];


      // If we have specific conferences, filter by them
      if (conferenceIds.length === 1) {
        filters.push({
          name: 'conference_id',
          op: 'Equal',
          value: conferenceIds[0]
        });
      }

      const response = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const dbMatchups = response.data.List as DatabaseMatchup[];

      // Filter by conference IDs if we have multiple
      const filteredMatchups = conferenceIds.length > 1 ?
      dbMatchups.filter((m) => conferenceIds.includes(m.conference_id)) :
      dbMatchups;

      console.log(`✅ Found ${filteredMatchups.length} database matchups for week ${week}`);
      return filteredMatchups;
    } catch (error) {
      console.error('❌ Error fetching database matchups:', error);
      throw error;
    }
  }

  /**
   * Build mapping between teams and conferences from junction table
   */
  async buildTeamConferenceMap(conferenceIds: number[]): Promise<Map<string, {teamId: number;rosterId: string;}>> {
    try {
      console.log('🔗 Building team-conference mapping...', { conferenceIds });

      const filters = conferenceIds.length > 0 ? [
      conferenceIds.length === 1 ? {
        name: 'conference_id',
        op: 'Equal',
        value: conferenceIds[0]
      } : null].
      filter(Boolean) : [];

      const response = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const junctions = response.data.List as TeamConferenceJunction[];
      const map = new Map<string, {teamId: number;rosterId: string;}>();

      junctions.forEach((junction) => {
        if (conferenceIds.length === 0 || conferenceIds.includes(junction.conference_id)) {
          // Map both ways: rosterId -> teamId and teamId -> rosterId
          map.set(`roster_${junction.roster_id}`, {
            teamId: junction.team_id,
            rosterId: junction.roster_id
          });
          map.set(`team_${junction.team_id}`, {
            teamId: junction.team_id,
            rosterId: junction.roster_id
          });
        }
      });

      this.teamConferenceMap = map;
      console.log(`✅ Built team-conference mapping with ${map.size} entries`);
      return map;
    } catch (error) {
      console.error('❌ Error building team-conference map:', error);
      throw error;
    }
  }

  /**
   * Fetch teams from database
   */
  async fetchTeams(): Promise<Team[]> {
    try {
      const response = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data.List as Team[];
    } catch (error) {
      console.error('❌ Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Get hybrid matchup data by combining database assignments with Sleeper API data
   */
  async getHybridMatchups(
  conferences: Conference[],
  teams: Team[],
  week: number,
  currentWeek: number,
  selectedSeason: number,
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<HybridMatchup[]> {
    try {
      console.log('🚀 Starting hybrid matchup data fetch...', {
        conferences: conferences.length,
        teams: teams.length,
        week,
        currentWeek,
        selectedSeason
      });

      const conferenceIds = conferences.map((c) => c.id);

      // Step 1: Fetch database matchups (team assignments)
      const [databaseMatchups, teamMap] = await Promise.all([
      this.fetchDatabaseMatchups(conferenceIds, week),
      this.buildTeamConferenceMap(conferenceIds)]
      );

      console.log(`📊 Database matchups: ${databaseMatchups.length}`);
      console.log(`🔗 Team mappings: ${teamMap.size}`);

      const hybridMatchups: HybridMatchup[] = [];

      // Step 2: Process each conference
      for (const conference of conferences) {
        try {
          console.log(`🏟️ Processing conference: ${conference.conference_name}`);

          // Get database matchups for this conference
          const conferenceDbMatchups = databaseMatchups.filter(
            (m) => m.conference_id === conference.id
          );

          console.log(`📋 Conference DB matchups: ${conferenceDbMatchups.length}`);

          if (conferenceDbMatchups.length === 0) {
            // No database matchups - fall back to Sleeper API for matchup assignments
            console.log(`⚠️ No database matchups for ${conference.conference_name}, falling back to Sleeper API`);

            const sleeperMatchups = await this.getSleeperMatchups(
              conference,
              teams,
              week,
              currentWeek,
              selectedSeason,
              allPlayers
            );

            hybridMatchups.push(...sleeperMatchups);
            continue;
          }

          // Fetch real-time data from Sleeper API
          const [sleeperMatchupsData, rostersData, usersData] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, week),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          console.log(`📈 Sleeper API data:`, {
            matchups: sleeperMatchupsData.length,
            rosters: rostersData.length,
            users: usersData.length
          });

          // Step 3: Create hybrid matchups using database assignments + Sleeper data
          for (const dbMatchup of conferenceDbMatchups) {
            const hybridMatchup = await this.createHybridMatchup(
              dbMatchup,
              conference,
              teams,
              sleeperMatchupsData,
              rostersData,
              usersData,
              teamMap,
              allPlayers,
              week,
              currentWeek,
              selectedSeason
            );

            if (hybridMatchup) {
              hybridMatchups.push(hybridMatchup);
            }
          }

        } catch (error) {
          console.error(`❌ Error processing conference ${conference.conference_name}:`, error);

          // Continue with other conferences even if one fails
          continue;
        }
      }

      console.log(`✅ Created ${hybridMatchups.length} hybrid matchups`);
      return hybridMatchups;

    } catch (error) {
      console.error('❌ Error creating hybrid matchups:', error);
      throw error;
    }
  }

  /**
   * Create a single hybrid matchup from database assignment + Sleeper data
   */
  private async createHybridMatchup(
  dbMatchup: DatabaseMatchup,
  conference: Conference,
  teams: Team[],
  sleeperMatchupsData: SleeperMatchup[],
  rostersData: SleeperRoster[],
  usersData: SleeperUser[],
  teamMap: Map<string, {teamId: number;rosterId: string;}>,
  allPlayers: Record<string, SleeperPlayer>,
  week: number,
  currentWeek: number,
  selectedSeason: number)
  : Promise<HybridMatchup | null> {
    try {
      // Find teams from database
      const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
      const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

      if (!team1 || !team2) {
        console.warn(`❌ Could not find teams for matchup ${dbMatchup.id}`);
        return null;
      }

      // Get roster IDs for these teams
      const team1RosterMapping = teamMap.get(`team_${team1.id}`);
      const team2RosterMapping = teamMap.get(`team_${team2.id}`);

      if (!team1RosterMapping || !team2RosterMapping) {
        console.warn(`❌ Could not find roster mappings for teams ${team1.id}, ${team2.id}`);
        return null;
      }

      const team1RosterId = parseInt(team1RosterMapping.rosterId);
      const team2RosterId = parseInt(team2RosterMapping.rosterId);

      // Determine if we should use database override or Sleeper data
      const useManualOverride = dbMatchup.is_manual_override;

      let team1SleeperData: SleeperMatchup | undefined;
      let team2SleeperData: SleeperMatchup | undefined;
      let team1Roster: SleeperRoster | undefined;
      let team2Roster: SleeperRoster | undefined;

      if (useManualOverride) {
        // For manual overrides, fetch team-specific data to ensure we get the correct rosters and scoring
        console.log(`🔄 Manual override detected - fetching team-specific data for rosters ${team1RosterId}, ${team2RosterId}`);
        
        try {
          const teamBasedData = await SleeperApiService.fetchTeamsMatchupData(
            conference.league_id,
            week,
            [team1RosterId, team2RosterId]
          );
          
          team1SleeperData = teamBasedData.matchups.find((m) => m.roster_id === team1RosterId);
          team2SleeperData = teamBasedData.matchups.find((m) => m.roster_id === team2RosterId);
          team1Roster = teamBasedData.rosters.find((r) => r.roster_id === team1RosterId);
          team2Roster = teamBasedData.rosters.find((r) => r.roster_id === team2RosterId);
          
          console.log(`✅ Team-specific data fetched:`, {
            team1HasData: !!team1SleeperData,
            team2HasData: !!team2SleeperData,
            team1Points: team1SleeperData?.points || 0,
            team2Points: team2SleeperData?.points || 0
          });
        } catch (error) {
          console.warn(`⚠️ Failed to fetch team-specific data, falling back to original data:`, error);
          // Fallback to original data if team-specific fetch fails
          team1SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team1RosterId);
          team2SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team2RosterId);
          team1Roster = rostersData.find((r) => r.roster_id === team1RosterId);
          team2Roster = rostersData.find((r) => r.roster_id === team2RosterId);
        }
      } else {
        // For non-manual overrides, use the original matchup data
        team1SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team1RosterId);
        team2SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team2RosterId);
        team1Roster = rostersData.find((r) => r.roster_id === team1RosterId);
        team2Roster = rostersData.find((r) => r.roster_id === team2RosterId);
      }

      const team1User = usersData.find((u) => u.user_id === team1Roster?.owner_id);
      const team2User = usersData.find((u) => u.user_id === team2Roster?.owner_id);

      const hybridTeam1: HybridMatchupTeam = {
        roster_id: team1RosterId,
        points: useManualOverride ? dbMatchup.team_1_score : team1SleeperData?.points ?? 0,
        projected_points: team1SleeperData?.projected_points,
        owner: team1User || null,
        roster: team1Roster || null,
        team: team1,
        players_points: team1SleeperData?.players_points || {},
        starters_points: team1SleeperData?.starters_points || [],
        matchup_starters: team1SleeperData?.starters || [],
        database_team_id: team1.id
      };

      const hybridTeam2: HybridMatchupTeam = {
        roster_id: team2RosterId,
        points: useManualOverride ? dbMatchup.team_2_score : team2SleeperData?.points ?? 0,
        projected_points: team2SleeperData?.projected_points,
        owner: team2User || null,
        roster: team2Roster || null,
        team: team2,
        players_points: team2SleeperData?.players_points || {},
        starters_points: team2SleeperData?.starters_points || [],
        matchup_starters: team2SleeperData?.starters || [],
        database_team_id: team2.id
      };

      const status = this.determineMatchupStatus(week, currentWeek, selectedSeason, [hybridTeam1, hybridTeam2]);

      const hybridMatchup: HybridMatchup = {
        matchup_id: dbMatchup.id,
        conference,
        teams: [hybridTeam1, hybridTeam2],
        status,
        isManualOverride: useManualOverride,
        databaseMatchupId: dbMatchup.id,
        overrideNotes: dbMatchup.notes,
        dataSource: useManualOverride ? 'database' : 'hybrid',
        week,
        rawData: {
          databaseMatchup: dbMatchup,
          sleeperData: {
            team1: team1SleeperData,
            team2: team2SleeperData
          }
        }
      };

      console.log(`✅ Created hybrid matchup: ${team1.team_name} vs ${team2.team_name} (Manual Override: ${useManualOverride})`);
      return hybridMatchup;

    } catch (error) {
      console.error('❌ Error creating hybrid matchup:', error);
      return null;
    }
  }

  /**
   * Fallback to pure Sleeper API matchups when no database assignments exist
   */
  private async getSleeperMatchups(
  conference: Conference,
  teams: Team[],
  week: number,
  currentWeek: number,
  selectedSeason: number,
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<HybridMatchup[]> {
    try {
      const [matchupsData, rostersData, usersData] = await Promise.all([
      SleeperApiService.fetchMatchups(conference.league_id, week),
      SleeperApiService.fetchLeagueRosters(conference.league_id),
      SleeperApiService.fetchLeagueUsers(conference.league_id)]
      );

      const organizedMatchups = SleeperApiService.organizeMatchups(
        matchupsData,
        rostersData,
        usersData
      );

      return organizedMatchups.map((matchup) => ({
        matchup_id: matchup.matchup_id,
        conference,
        teams: matchup.teams.map((team) => {
          const dbTeam = teams.find((t) => t.owner_id === team.owner?.user_id);
          const matchupTeam = matchupsData.find((m) => m.roster_id === team.roster_id);

          return {
            ...team,
            team: dbTeam || null,
            players_points: matchupTeam?.players_points || {},
            starters_points: matchupTeam?.starters_points || [],
            matchup_starters: matchupTeam?.starters || [],
            database_team_id: dbTeam?.id
          };
        }),
        status: this.determineMatchupStatus(week, currentWeek, selectedSeason, matchup.teams),
        isManualOverride: false,
        dataSource: 'sleeper' as const,
        week
      }));
    } catch (error) {
      console.error('❌ Error getting Sleeper matchups:', error);
      return [];
    }
  }

  /**
   * Determine matchup status based on week and scoring data
   */
  private determineMatchupStatus(
  week: number,
  currentWeek: number,
  selectedSeason: number,
  teams: any[])
  : 'live' | 'completed' | 'upcoming' {
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    if (isHistoricalSeason) {
      return 'completed';
    }

    if (week > currentWeek) {
      return 'upcoming';
    }

    const hasPoints = teams.some((team) => (team.points ?? 0) > 0);

    if (week < currentWeek) {
      return 'completed';
    }

    return hasPoints ? 'live' : 'upcoming';
  }
}

export default new MatchupService();