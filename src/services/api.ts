import { supabase } from '@/lib/supabase';

interface PlayerFilters {
  search?: string;
  position?: string;
  is_rostered?: boolean | string;
}

export async function fetchPlayersFromApi(filters: PlayerFilters = {}, page = 1, pageSize = 25) {
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

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    query = query
      .range(from, to)
      .order('total_points', { ascending: false });

    // Execute the query
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Database query error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Fetched ${data?.length || 0} players (total: ${count})`);
    
    return {
      data: data || [],
      count: count || 0
    };

  } catch (error) {
    console.error('fetchPlayersFromApi error:', error);
    throw error;
  }
}
