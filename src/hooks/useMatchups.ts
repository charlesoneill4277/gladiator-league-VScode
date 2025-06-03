import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Table IDs from the database schema
const MATCHUPS_TABLE_ID = '13329';
const TEAMS_TABLE_ID = '12852';
const CONFERENCES_TABLE_ID = '12820';
const SEASONS_TABLE_ID = '12818';

// Types matching the frontend expectations
export interface Team {
  id: string;
  name: string;
  owner: string;
  score: number;
  projected: number;
}

export interface Matchup {
  id: string;
  week: number;
  conference: string;
  homeTeam: Team;
  awayTeam: Team;
  status: 'live' | 'completed' | 'upcoming';
  lastUpdate: string | null;
  isPlayoff: boolean;
}

export interface WeekInfo {
  week: number;
  status: 'completed' | 'current' | 'upcoming';
}

interface UseMatchupsReturn {
  matchups: Matchup[];
  weeks: WeekInfo[];
  currentWeek: number;
  loading: boolean;
  error: string | null;
  refreshMatchups: () => Promise<void>;
}

export const useMatchups = (seasonYear?: number, conferenceId?: string | null): UseMatchupsReturn => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMatchups = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching matchups data...');

      // First, get all seasons to find the correct season_id
      const seasonsResponse = await window.ezsite.apis.tablePage(SEASONS_TABLE_ID, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: seasonYear ? [
          {
            name: 'season_year',
            op: 'Equal',
            value: seasonYear
          }
        ] : []
      });

      if (seasonsResponse.error) throw seasonsResponse.error;

      console.log('Seasons data:', seasonsResponse.data);

      const currentSeason = seasonsResponse.data?.List?.find((season: any) => 
        seasonYear ? season.season_year === seasonYear : season.is_current_season
      ) || seasonsResponse.data?.List?.[0];

      if (!currentSeason) {
        throw new Error('No season found');
      }

      // Get conferences for this season
      const conferencesResponse = await window.ezsite.apis.tablePage(CONFERENCES_TABLE_ID, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          {
            name: 'season_id',
            op: 'Equal',
            value: currentSeason.id
          }
        ]
      });

      if (conferencesResponse.error) throw conferencesResponse.error;

      console.log('Conferences data:', conferencesResponse.data);

      // Get all teams
      const teamsResponse = await window.ezsite.apis.tablePage(TEAMS_TABLE_ID, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) throw teamsResponse.error;

      console.log('Teams data:', teamsResponse.data);

      // Build filters for matchups query
      const matchupFilters: any[] = [];
      
      if (conferenceId && conferencesResponse.data?.List) {
        // Find the conference by the frontend conference ID (not database ID)
        const targetConference = conferencesResponse.data.List.find((conf: any) => {
          // Match against the conference name or some identifier
          const conferenceMapping: { [key: string]: string[] } = {
            'mars': ['Legions of Mars', 'The Legions of Mars'],
            'jupiter': ['Guardians of Jupiter', 'The Guardians of Jupiter'], 
            'vulcan': ["Vulcan's Oathsworn"]
          };
          const possibleNames = conferenceMapping[conferenceId] || [];
          return possibleNames.some(name => name === conf.conference_name);
        });

        if (targetConference) {
          matchupFilters.push({
            name: 'conference_id',
            op: 'Equal',
            value: targetConference.id
          });
        }
      }

      // Get matchups data
      const matchupsResponse = await window.ezsite.apis.tablePage(MATCHUPS_TABLE_ID, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'week',
        IsAsc: true,
        Filters: matchupFilters
      });

      if (matchupsResponse.error) throw matchupsResponse.error;

      console.log('Matchups data:', matchupsResponse.data);

      // Transform the data to match frontend expectations
      const transformedMatchups: Matchup[] = [];
      const weekSet = new Set<number>();

      if (matchupsResponse.data?.List && teamsResponse.data?.List && conferencesResponse.data?.List) {
        const teams = teamsResponse.data.List;
        const conferences = conferencesResponse.data.List;

        matchupsResponse.data.List.forEach((matchup: any) => {
          weekSet.add(matchup.week);

          const homeTeam = teams.find((team: any) => team.id === matchup.team_1_id);
          const awayTeam = teams.find((team: any) => team.id === matchup.team_2_id);
          const conference = conferences.find((conf: any) => conf.id === matchup.conference_id);

          if (homeTeam && awayTeam && conference) {
            // Normalize conference name to match frontend expectations
            let normalizedConferenceName = conference.conference_name;
            if (normalizedConferenceName.startsWith('The ')) {
              normalizedConferenceName = normalizedConferenceName.substring(4);
            }
            
            transformedMatchups.push({
              id: matchup.id.toString(),
              week: matchup.week,
              conference: normalizedConferenceName,
              homeTeam: {
                id: homeTeam.id.toString(),
                name: homeTeam.team_name,
                owner: homeTeam.owner_name,
                score: 0, // Will be updated when scoring data is available
                projected: 0
              },
              awayTeam: {
                id: awayTeam.id.toString(),
                name: awayTeam.team_name,
                owner: awayTeam.owner_name,
                score: 0, // Will be updated when scoring data is available
                projected: 0
              },
              status: 'upcoming', // Will be updated based on actual game status
              lastUpdate: null,
              isPlayoff: matchup.is_playoff || false
            });
          }
        });
      }

      // Generate weeks array
      const weeksArray = Array.from(weekSet).sort((a, b) => a - b).map(weekNum => ({
        week: weekNum,
        status: weekNum <= 13 ? 'completed' : weekNum === 14 ? 'current' : 'upcoming'
      } as WeekInfo));

      setMatchups(transformedMatchups);
      setWeeks(weeksArray);
      setCurrentWeek(Math.max(...Array.from(weekSet).filter(w => w <= 14)) || 14);

      console.log('Transformed matchups:', transformedMatchups);
      console.log('Weeks:', weeksArray);

    } catch (err) {
      console.error('Error fetching matchups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matchups');
      toast({
        title: 'Error',
        description: 'Failed to load matchups data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchups();
  }, [seasonYear, conferenceId]);

  return {
    matchups,
    weeks,
    currentWeek,
    loading,
    error,
    refreshMatchups: fetchMatchups
  };
};