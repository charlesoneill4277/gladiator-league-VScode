import { supabase } from '@/lib/supabase';

interface PlayerFilters {
  search?: string;
  position?: string;
  is_rostered?: boolean | string;
  nfl_team?: string;
  season?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

export async function fetchPlayersFromApi(filters: PlayerFilters = {}, page = 1, pageSize = 25, fetchAll = false) {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }

    // For now, let's bypass the Edge Function and use direct database queries
    // since we're having authentication issues with the Edge Function
    console.log('Fetching players directly from database...');

    // Build the query - use the VIEW instead of the base players table
    let query = supabase
      .from('players_with_roster_status')
      .select(`
        id,
        player_name,
        position,
        nfl_team,
        sleeper_id,
        injury_status,
        total_points,
        avg_points,
        is_rostered,
        rostered_by_teams,
        playing_status
      `, { count: 'exact' });

    // Apply filters
    if (filters.search) {
      query = query.or(`player_name.ilike.%${filters.search}%,nfl_team.ilike.%${filters.search}%`);
    }

    if (filters.position && filters.position !== 'all') {
      query = query.eq('position', filters.position);
    }

    if (filters.is_rostered !== '') {
      query = query.eq('is_rostered', filters.is_rostered);
    }

    if (filters.nfl_team && filters.nfl_team !== '') {
      query = query.eq('nfl_team', filters.nfl_team);
    }

    // TODO: Season filtering will be implemented later when we have season-specific data
    // For now, season filter is just a placeholder and doesn't affect the query

    // Apply sorting
    let sortField = 'total_points'; // default sort field
    let sortAscending = false; // default to descending

    if (filters.sort_field && filters.sort_field !== '') {
      sortField = filters.sort_field;
      sortAscending = filters.sort_direction === 'asc';
    }

    // Handle special case for ownership sorting (this will be handled client-side for now)
    if (sortField === 'ownership') {
      // For ownership, we'll sort by total_points as fallback since ownership data comes from Sleeper API
      sortField = 'total_points';
    }

    query = query.order(sortField, { ascending: sortAscending });

    // Apply pagination (unless fetching all data)
    if (!fetchAll) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    } else {
      // When fetching all data, set a very high limit to ensure we get all records
      // Supabase has a default limit of 1000 rows when no range is specified
      // Setting range to 0-49999 should cover any reasonable number of players
      query = query.range(0, 49999);
    }

    // Execute the query
    const { data, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Fetched ${data?.length || 0} players (total: ${count})`);

    return {
      data: data || [],
      count: fetchAll ? (data?.length || 0) : (count || 0)
    };

  } catch (error) {
    console.error('fetchPlayersFromApi error:', error);
    throw error;
  }
}
