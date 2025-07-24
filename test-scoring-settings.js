// Test script to verify scoring settings functionality
// Run this after applying the database migration

const testScoringSettings = async () => {
  console.log('Testing scoring settings functionality...');
  
  // This would be run in the browser console or as part of the app
  try {
    // Test the database service
    const { DatabaseService } = await import('./src/services/databaseService.js');
    
    // Get current season
    const { data: seasons } = await DatabaseService.getSeasons({
      filters: [{ column: 'is_current', operator: 'eq', value: true }]
    });
    
    if (seasons && seasons.length > 0) {
      const currentSeason = seasons[0];
      console.log('Current season:', currentSeason);
      
      if (!currentSeason.scoring_settings) {
        console.log('No scoring settings found, attempting to fetch from Sleeper API...');
        const result = await DatabaseService.updateSeasonScoringSettings(currentSeason.id);
        console.log('Update result:', result);
      } else {
        console.log('Scoring settings found:', currentSeason.scoring_settings);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.testScoringSettings = testScoringSettings;
}

export { testScoringSettings };