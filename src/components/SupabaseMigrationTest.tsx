import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatabaseService } from '@/services/databaseService';
import { DataSeeder } from '@/utils/dataSeeder';
import { supabase } from '@/lib/supabase';

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'pending';
  message: string;
}

export const SupabaseMigrationTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([]);

  const addTestResult = (test: string, status: TestResult['status'], message: string) => {
    setTestResults(prev => [...prev, { test, status, message }]);
  };

  const runDatabaseDiagnostics = async () => {
    setDiagnosticResults(['🔍 Running database diagnostics...']);
    
    try {
      // Test 1: Raw Supabase table inspection
      const { data: seasonsRaw, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .limit(5);
      
      setDiagnosticResults(prev => [...prev, `📊 Raw seasons query - Error: ${seasonsError ? seasonsError.message : 'None'}`]);
      setDiagnosticResults(prev => [...prev, `📊 Raw seasons data count: ${seasonsRaw ? seasonsRaw.length : 0}`]);
      
      if (seasonsRaw && seasonsRaw.length > 0) {
        setDiagnosticResults(prev => [...prev, `📊 First season structure: ${JSON.stringify(seasonsRaw[0], null, 2)}`]);
      }

      const { data: conferencesRaw, error: conferencesError } = await supabase
        .from('conferences')
        .select('*')
        .limit(5);
      
      setDiagnosticResults(prev => [...prev, `📊 Raw conferences query - Error: ${conferencesError ? conferencesError.message : 'None'}`]);
      setDiagnosticResults(prev => [...prev, `📊 Raw conferences data count: ${conferencesRaw ? conferencesRaw.length : 0}`]);
      
      if (conferencesRaw && conferencesRaw.length > 0) {
        setDiagnosticResults(prev => [...prev, `📊 First conference structure: ${JSON.stringify(conferencesRaw[0], null, 2)}`]);
      }

      // Test 2: Check what our DatabaseService is actually calling
      setDiagnosticResults(prev => [...prev, '🔍 Testing DatabaseService methods...']);
      
      console.log('🔍 About to call DatabaseService.getSeasons()');
      const seasonsResult = await DatabaseService.getSeasons();
      console.log('🔍 DatabaseService.getSeasons() result:', seasonsResult);
      setDiagnosticResults(prev => [...prev, `📊 DatabaseService.getSeasons() returned: ${seasonsResult.data?.length || 0} items, error: ${seasonsResult.error || 'none'}`]);
      
      console.log('🔍 About to call DatabaseService.getConferences()');
      const conferencesResult = await DatabaseService.getConferences();
      console.log('🔍 DatabaseService.getConferences() result:', conferencesResult);
      setDiagnosticResults(prev => [...prev, `📊 DatabaseService.getConferences() returned: ${conferencesResult.data?.length || 0} items, error: ${conferencesResult.error || 'none'}`]);

      // Test 3: Check if it's a casing issue
      const { data: seasonsCase, error: seasonsCaseError } = await supabase
        .from('Seasons')  // Capital S
        .select('*')
        .limit(1);
      
      if (!seasonsCaseError) {
        setDiagnosticResults(prev => [...prev, `📊 Table 'Seasons' (capital S) exists and has data`]);
      } else {
        setDiagnosticResults(prev => [...prev, `📊 Table 'Seasons' (capital S) error: ${seasonsCaseError.message}`]);
      }

    } catch (error) {
      setDiagnosticResults(prev => [...prev, `❌ Diagnostics error: ${error}`]);
      console.error('Diagnostics error:', error);
    }
  };

  const runAdvancedDiagnostics = async () => {
    setDiagnosticResults(['🔍 Running ADVANCED database diagnostics...']);
    
    try {
      // Test 1: Check table schema and permissions
      const { data: tablesInfo, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_schema', 'public')
        .in('table_name', ['seasons', 'conferences']);
      
      setDiagnosticResults(prev => [...prev, `📋 Table schema info: ${tablesInfo ? JSON.stringify(tablesInfo, null, 2) : 'None'}`]);
      setDiagnosticResults(prev => [...prev, `📋 Schema error: ${tablesError ? tablesError.message : 'None'}`]);

      // Test 2: Check columns in seasons table
      const { data: seasonsColumns, error: seasonsColError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'seasons');
      
      setDiagnosticResults(prev => [...prev, `📋 Seasons columns: ${seasonsColumns ? JSON.stringify(seasonsColumns, null, 2) : 'None'}`]);

      // Test 3: Raw count queries
      const { count: seasonsCount, error: seasonsCountError } = await supabase
        .from('seasons')
        .select('*', { count: 'exact', head: true });
      
      setDiagnosticResults(prev => [...prev, `🔢 Seasons COUNT query: ${seasonsCount}, error: ${seasonsCountError ? seasonsCountError.message : 'None'}`]);

      const { count: conferencesCount, error: conferencesCountError } = await supabase
        .from('conferences')
        .select('*', { count: 'exact', head: true });
      
      setDiagnosticResults(prev => [...prev, `🔢 Conferences COUNT query: ${conferencesCount}, error: ${conferencesCountError ? conferencesCountError.message : 'None'}`]);

      // Test 4: Try with different select approaches
      const { data: seasonsAll, error: seasonsAllError } = await supabase
        .from('seasons')
        .select();  // No specific columns
      
      setDiagnosticResults(prev => [...prev, `📊 Seasons SELECT all: ${seasonsAll ? seasonsAll.length : 0} records, error: ${seasonsAllError ? seasonsAllError.message : 'None'}`]);

      // Test 5: Try select with specific columns we expect
      const { data: seasonsSpecific, error: seasonsSpecificError } = await supabase
        .from('seasons')
        .select('id, season_name, season_year, is_current');
      
      setDiagnosticResults(prev => [...prev, `📊 Seasons SELECT specific columns: ${seasonsSpecific ? seasonsSpecific.length : 0} records`]);
      setDiagnosticResults(prev => [...prev, `📊 Specific error: ${seasonsSpecificError ? seasonsSpecificError.message : 'None'}`]);

      if (seasonsSpecific && seasonsSpecific.length > 0) {
        setDiagnosticResults(prev => [...prev, `📊 First season record: ${JSON.stringify(seasonsSpecific[0], null, 2)}`]);
      }

      // Test 6: Check if we can access any data at all
      const { data: testQuery, error: testError } = await supabase
        .rpc('version');  // Simple function that should always work
      
      setDiagnosticResults(prev => [...prev, `🔒 Basic RPC test: ${testError ? testError.message : 'SUCCESS - Database connection works'}`]);

    } catch (error) {
      setDiagnosticResults(prev => [...prev, `❌ Advanced diagnostics error: ${error}`]);
      console.error('Advanced diagnostics error:', error);
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Database Connection
      addTestResult('Database Connection', 'pending', 'Testing Supabase connection...');
      try {
        await DatabaseService.getSeasons({ limit: 1 });
        addTestResult('Database Connection', 'success', 'Successfully connected to Supabase');
      } catch (error) {
        addTestResult('Database Connection', 'error', `Failed to connect: ${error}`);
      }

      // Test 2: Migration Adapter
      addTestResult('Migration Adapter', 'pending', 'Testing EzSite API compatibility...');
      try {
        const result = await (window as any).ezsite?.apis?.tablePage('seasons', { PageNo: 1, PageSize: 1 });
        if (result) {
          addTestResult('Migration Adapter', 'success', 'Migration adapter is working');
        } else {
          addTestResult('Migration Adapter', 'error', 'Migration adapter not initialized');
        }
      } catch (error) {
        addTestResult('Migration Adapter', 'error', `Migration adapter error: ${error}`);
      }

      // Test 3: Data Seeding
      addTestResult('Data Seeding', 'pending', 'Testing data seeding capabilities...');
      try {
        await DataSeeder.checkStatus();
        addTestResult('Data Seeding', 'success', 'Data seeder is functional');
      } catch (error) {
        addTestResult('Data Seeding', 'error', `Data seeding error: ${error}`);
      }

      // Test 4: Environment Variables
      addTestResult('Environment Config', 'pending', 'Checking environment configuration...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        addTestResult('Environment Config', 'success', 'Environment variables are configured');
      } else {
        addTestResult('Environment Config', 'error', 'Missing environment variables');
      }

      // Test 4: Season Data Loading (Detailed)
      addTestResult('Season Data Loading', 'pending', 'Testing dynamic season loading...');
      try {
        // Test raw database access first
        addTestResult('Raw Database Test', 'pending', 'Testing direct Supabase access...');
        
        console.log('Testing Supabase connection...');
        const seasonsResult = await DatabaseService.getSeasons();
        console.log('Seasons result:', seasonsResult);
        
        const conferencesResult = await DatabaseService.getConferences();
        console.log('Conferences result:', conferencesResult);
        
        if (seasonsResult.error) {
          addTestResult('Raw Database Test', 'error', `Seasons query error: ${seasonsResult.error}`);
          throw new Error(seasonsResult.error);
        }
        
        if (conferencesResult.error) {
          addTestResult('Raw Database Test', 'error', `Conferences query error: ${conferencesResult.error}`);
          throw new Error(conferencesResult.error);
        }

        const seasonCount = seasonsResult.data?.length || 0;
        const conferenceCount = conferencesResult.data?.length || 0;
        
        addTestResult('Raw Database Test', 'success', 
          `Direct queries successful: ${seasonCount} seasons, ${conferenceCount} conferences`);
        
        if (seasonCount === 0) {
          addTestResult('Season Data Loading', 'error', 
            'No seasons found in database. You need to run the SQL schema in Supabase dashboard.');
        } else {
          addTestResult('Season Data Loading', 'success', 
            `Loaded ${seasonCount} seasons and ${conferenceCount} conferences from Supabase`);
        }

        // Log the actual data for debugging
        if (seasonsResult.data) {
          console.log('Season data:', seasonsResult.data);
        }
        if (conferencesResult.data) {
          console.log('Conference data:', conferencesResult.data);
        }

      } catch (error) {
        console.error('Season data loading error:', error);
        addTestResult('Season Data Loading', 'error', `Season data loading failed: ${error}`);
      }

      // Test 5: Table Accessibility
      addTestResult('Table Accessibility', 'pending', 'Testing if tables exist and are accessible...');
      try {
        // Test direct table access using the Supabase client
        const { supabase } = await import('@/lib/supabase');
        
        // Test seasons table
        const { data: seasonsTest, error: seasonsError } = await supabase
          .from('seasons')
          .select('*')
          .limit(1);
          
        if (seasonsError) {
          addTestResult('Table Accessibility', 'error', `Seasons table error: ${seasonsError.message}`);
          return;
        }

        // Test conferences table  
        const { data: conferencesTest, error: conferencesError } = await supabase
          .from('conferences')
          .select('*')
          .limit(1);
          
        if (conferencesError) {
          addTestResult('Table Accessibility', 'error', `Conferences table error: ${conferencesError.message}`);
          return;
        }

        addTestResult('Table Accessibility', 'success', 
          `Tables accessible. Found ${seasonsTest?.length || 0} seasons, ${conferencesTest?.length || 0} conferences`);

      } catch (error) {
        addTestResult('Table Accessibility', 'error', `Table access failed: ${error}`);
      }

    } catch (error) {
      addTestResult('General', 'error', `Unexpected error: ${error}`);
    }

    setIsRunning(false);
  };

  const seedDatabase = async () => {
    try {
      await DataSeeder.seedAll();
      addTestResult('Database Seeding', 'success', 'Database seeded successfully');
    } catch (error) {
      addTestResult('Database Seeding', 'error', `Seeding failed: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🚀 Supabase Migration Test</CardTitle>
          <CardDescription>
            Test the migration from EzSite to Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              variant="default"
            >
              {isRunning ? 'Running Tests...' : 'Run Migration Tests'}
            </Button>
            <Button 
              onClick={runDatabaseDiagnostics}
              variant="secondary"
            >
              Database Diagnostics
            </Button>
            <Button 
              onClick={runAdvancedDiagnostics}
              variant="outline"
            >
              Advanced Diagnostics
            </Button>
            <Button 
              onClick={seedDatabase}
              variant="outline"
            >
              Seed Database
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Test Results:</h3>
              {testResults.map((result, index) => (
                <Alert key={index} variant={result.status === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription>
                    <span className="font-medium">{result.test}:</span>{' '}
                    <span className={
                      result.status === 'success' ? 'text-green-600' :
                      result.status === 'error' ? 'text-red-600' :
                      'text-yellow-600'
                    }>
                      {result.status === 'success' ? '✅' : 
                       result.status === 'error' ? '❌' : '⏳'}
                    </span>{' '}
                    {result.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {diagnosticResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Database Diagnostics:</h3>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                {diagnosticResults.map((line, index) => (
                  <div key={index} className="text-sm font-mono mb-2 whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Migration Checklist</CardTitle>
          <CardDescription>
            Steps to complete the migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>Install Supabase dependencies</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>Create Supabase configuration</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>Set up migration adapter</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span>Run database schema in Supabase</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span>Seed initial data</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span>Test existing functionality</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span>Migrate data from EzSite (if needed)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>💡 Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            <li>Go to your Supabase dashboard</li>
            <li>Run the SQL schema from <code>supabase-schema.sql</code></li>
            <li>Come back and run the tests above</li>
            <li>Use the "Seed Database" button to add initial data</li>
            <li>Test your existing app functionality</li>
            <li>Gradually replace adapter calls with direct Supabase calls</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseMigrationTest;
