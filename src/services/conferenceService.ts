import { useToast } from '@/hooks/use-toast';

// Table IDs
const CONFERENCES_TABLE_ID = '12820';
const SEASONS_TABLE_ID = '12818';

// Types
export interface ConferenceData {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

export interface ConferenceMapping {
  id: string;
  name: string;
  leagueId: string;
  draftId: string;
  status: string;
  logoUrl: string;
}

export interface ConferenceServiceResult<T> {
  data?: T;
  error?: string;
}

class ConferenceService {
  private static instance: ConferenceService;
  private cache: Map<string, { data: ConferenceMapping[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): ConferenceService {
    if (!ConferenceService.instance) {
      ConferenceService.instance = new ConferenceService();
    }
    return ConferenceService.instance;
  }

  /**
   * Get all conferences for a specific season
   */
  async getConferencesForSeason(seasonYear?: number): Promise<ConferenceServiceResult<ConferenceMapping[]>> {
    try {
      const cacheKey = `season-${seasonYear || 'current'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return { data: cached.data };
      }

      // First, get the season
      const seasonResponse = await window.ezsite.apis.tablePage(SEASONS_TABLE_ID, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: seasonYear ? [{
          name: 'season_year',
          op: 'Equal',
          value: seasonYear
        }] : [{
          name: 'is_current_season',
          op: 'Equal',
          value: true
        }]
      });

      if (seasonResponse.error) {
        throw new Error(seasonResponse.error);
      }

      const season = seasonResponse.data?.List?.[0];
      if (!season) {
        throw new Error(`No season found for year ${seasonYear || 'current'}`);
      }

      // Get conferences for this season
      const conferencesResponse = await window.ezsite.apis.tablePage(CONFERENCES_TABLE_ID, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [{
          name: 'season_id',
          op: 'Equal',
          value: season.id
        }]
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferences = conferencesResponse.data?.List || [];
      const mappedConferences = conferences.map((conf: ConferenceData) => ({
        id: this.generateConferenceId(conf.conference_name),
        name: this.normalizeConferenceName(conf.conference_name),
        leagueId: conf.league_id,
        draftId: conf.draft_id,
        status: conf.status,
        logoUrl: conf.league_logo_url
      }));

      // Cache the result
      this.cache.set(cacheKey, {
        data: mappedConferences,
        timestamp: Date.now()
      });

      return { data: mappedConferences };
    } catch (error) {
      console.error('Error fetching conferences:', error);
      return { error: error instanceof Error ? error.message : 'Failed to fetch conferences' };
    }
  }

  /**
   * Get a specific conference by its frontend ID
   */
  async getConferenceById(conferenceId: string, seasonYear?: number): Promise<ConferenceServiceResult<ConferenceMapping>> {
    const result = await this.getConferencesForSeason(seasonYear);
    
    if (result.error) {
      return { error: result.error };
    }

    const conference = result.data?.find(conf => conf.id === conferenceId);
    if (!conference) {
      return { error: `Conference with ID '${conferenceId}' not found` };
    }

    return { data: conference };
  }

  /**
   * Get league ID for a specific conference
   */
  async getLeagueIdForConference(conferenceId: string, seasonYear?: number): Promise<ConferenceServiceResult<string>> {
    const result = await this.getConferenceById(conferenceId, seasonYear);
    
    if (result.error) {
      return { error: result.error };
    }

    if (!result.data?.leagueId) {
      return { error: `No league ID found for conference '${conferenceId}'` };
    }

    return { data: result.data.leagueId };
  }

  /**
   * Get conference mapping by name (for reverse lookup)
   */
  async getConferenceByName(conferenceName: string, seasonYear?: number): Promise<ConferenceServiceResult<ConferenceMapping>> {
    const result = await this.getConferencesForSeason(seasonYear);
    
    if (result.error) {
      return { error: result.error };
    }

    const normalizedSearchName = this.normalizeConferenceName(conferenceName);
    const conference = result.data?.find(conf => conf.name === normalizedSearchName);
    
    if (!conference) {
      return { error: `Conference with name '${conferenceName}' not found` };
    }

    return { data: conference };
  }

  /**
   * Validate if a league ID exists and is valid
   */
  async validateLeagueId(leagueId: string, seasonYear?: number): Promise<ConferenceServiceResult<boolean>> {
    const result = await this.getConferencesForSeason(seasonYear);
    
    if (result.error) {
      return { error: result.error };
    }

    const hasValidLeagueId = result.data?.some(conf => conf.leagueId === leagueId);
    return { data: !!hasValidLeagueId };
  }

  /**
   * Clear cache - useful for data synchronization
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate a consistent frontend ID from conference name
   */
  private generateConferenceId(conferenceName: string): string {
    const normalized = this.normalizeConferenceName(conferenceName);
    
    // Define mapping for consistent IDs
    const nameToIdMap: { [key: string]: string } = {
      'Legions of Mars': 'mars',
      'Guardians of Jupiter': 'jupiter',
      "Vulcan's Oathsworn": 'vulcan'
    };

    return nameToIdMap[normalized] || normalized.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Normalize conference name for consistent display
   */
  private normalizeConferenceName(conferenceName: string): string {
    // Remove "The " prefix if it exists
    if (conferenceName.startsWith('The ')) {
      return conferenceName.substring(4);
    }
    return conferenceName;
  }
}

// Export singleton instance
export const conferenceService = ConferenceService.getInstance();

// Export hook for React components
export const useConferenceService = () => {
  const { toast } = useToast();

  const showError = (message: string) => {
    toast({
      title: 'Conference Error',
      description: message,
      variant: 'destructive'
    });
  };

  return {
    conferenceService,
    showError
  };
};