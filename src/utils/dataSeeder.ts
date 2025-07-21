import { DatabaseService } from '@/services/databaseService';

/**
 * Data seeding utilities for Supabase database
 * Run these functions from browser console or create admin UI
 */
export class DataSeeder {
  
  /**
   * Seed basic seasons data
   */
  static async seedSeasons() {
    console.log('Seeding seasons...');
    
    const seasons = [
      { season_year: 2024, status: 'completed' },
      { season_year: 2025, status: 'active' }
    ];

    for (const season of seasons) {
      try {
        const { data, error } = await DatabaseService.createSeason(season);
        if (error) {
          console.warn(`Season ${season.season_year} might already exist:`, error);
        } else {
          console.log(`✅ Created season ${season.season_year}:`, data);
        }
      } catch (err) {
        console.error(`Error creating season ${season.season_year}:`, err);
      }
    }
  }

  /**
   * Seed conferences data
   */
  static async seedConferences() {
    console.log('Seeding conferences...');
    
    // Get seasons first
    const { data: seasons } = await DatabaseService.getSeasons();
    const season2024 = seasons.find(s => s.season_year === 2024);
    const season2025 = seasons.find(s => s.season_year === 2025);

    if (!season2024 || !season2025) {
      console.error('Seasons not found. Run seedSeasons() first.');
      return;
    }

    const conferences = [
      // 2024 Conferences
      {
        conference_name: 'The Legions of Mars',
        league_id: '1072580179844857856',
        season_id: season2024.id,
        status: 'completed'
      },
      {
        conference_name: 'The Guardians of Jupiter',
        league_id: '1072593839715667968',
        season_id: season2024.id,
        status: 'completed'
      },
      {
        conference_name: "Vulcan's Oathsworn",
        league_id: '1072593416955015168',
        season_id: season2024.id,
        status: 'completed'
      },
      // 2025 Conferences
      {
        conference_name: 'The Legions of Mars',
        league_id: '1204854057169072128',
        season_id: season2025.id,
        status: 'active'
      },
      {
        conference_name: 'The Guardians of Jupiter',
        league_id: '1204857692007440384',
        season_id: season2025.id,
        status: 'active'
      },
      {
        conference_name: "Vulcan's Oathsworn",
        league_id: '1204857608989577216',
        season_id: season2025.id,
        status: 'active'
      }
    ];

    for (const conference of conferences) {
      try {
        const { data, error } = await DatabaseService.createConference(conference);
        if (error) {
          console.warn(`Conference ${conference.conference_name} might already exist:`, error);
        } else {
          console.log(`✅ Created conference ${conference.conference_name}:`, data);
        }
      } catch (err) {
        console.error(`Error creating conference ${conference.conference_name}:`, err);
      }
    }
  }

  /**
   * Run complete seeding process
   */
  static async seedAll() {
    console.log('🌱 Starting database seeding...');
    
    try {
      await this.seedSeasons();
      await this.seedConferences();
      
      console.log('✅ Database seeding completed!');
      console.log('📝 You can now sync data from Sleeper API using the admin panel.');
    } catch (error) {
      console.error('❌ Error during seeding:', error);
    }
  }

  /**
   * Clear all data (use with caution!)
   */
  static async clearAllData() {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
      return;
    }

    console.log('🗑️ Clearing all data...');
    
    // Note: Due to foreign key constraints, we need to delete in the right order
    // This is a simplified version - in production you'd want proper cascading deletes
    
    console.warn('⚠️ Manual data clearing not implemented. Use Supabase dashboard or SQL commands.');
    console.warn('⚠️ Recommended: Drop and recreate tables using the schema file.');
  }

  /**
   * Check database status
   */
  static async checkStatus() {
    console.log('🔍 Checking database status...');
    
    try {
      const [seasons, conferences, teams, players] = await Promise.all([
        DatabaseService.getSeasons(),
        DatabaseService.getConferences(),
        DatabaseService.getTeams(),
        DatabaseService.getPlayers()
      ]);

      console.log('📊 Database Status:');
      console.log(`  Seasons: ${seasons.data.length}`);
      console.log(`  Conferences: ${conferences.data.length}`);
      console.log(`  Teams: ${teams.data.length}`);
      console.log(`  Players: ${players.data.length}`);

      if (seasons.data.length === 0) {
        console.log('💡 Tip: Run DataSeeder.seedAll() to add basic data');
      }

    } catch (error) {
      console.error('❌ Error checking database status:', error);
    }
  }
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).DataSeeder = DataSeeder;
}

export default DataSeeder;
