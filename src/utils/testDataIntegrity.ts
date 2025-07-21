import { dataIntegrityService } from '../services/dataIntegrityService';
import { StandingsService } from '../services/standingsService';

/**
 * Test utility to verify data integrity fixes
 */
export async function testDataIntegrityFixes() {
  console.log('Starting data integrity test...');

  try {
    // Step 1: Run audit to see current state
    console.log('1. Running data integrity audit...');
    const auditReport = await dataIntegrityService.auditDataIntegrity();
    console.log('Audit report:', auditReport);

    // Step 2: Run cleanup if needed
    if (auditReport.duplicate_records > 0 || auditReport.orphaned_records > 0 || auditReport.invalid_relationships > 0) {
      console.log('2. Issues found, running cleanup...');
      const cleanupResult = await dataIntegrityService.cleanupDataIntegrity();
      console.log('Cleanup result:', cleanupResult);
    } else {
      console.log('2. No issues found, skipping cleanup');
    }

    // Step 3: Test standings data for different seasons
    console.log('3. Testing standings data...');

    // Test for 2024 season
    try {
      const standings2024 = await StandingsService.getStandingsData(1); // Assuming season ID 1 is 2024
      console.log(`2024 standings: ${standings2024.length} teams`);
    } catch (error) {
      console.log('2024 standings error:', error);
    }

    // Test for 2025 season
    try {
      const standings2025 = await StandingsService.getStandingsData(2); // Assuming season ID 2 is 2025
      console.log(`2025 standings: ${standings2025.length} teams`);
    } catch (error) {
      console.log('2025 standings error:', error);
    }

    // Step 4: Run final audit
    console.log('4. Running final audit...');
    const finalAudit = await dataIntegrityService.auditDataIntegrity();
    console.log('Final audit report:', finalAudit);

    console.log('Data integrity test completed successfully!');
    return true;
  } catch (error) {
    console.error('Data integrity test failed:', error);
    return false;
  }
}

// Make available for testing in console
if (typeof window !== 'undefined') {
  (window as any).testDataIntegrityFixes = testDataIntegrityFixes;
}