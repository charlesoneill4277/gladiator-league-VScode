import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseService } from '@/services/databaseService';
import { supabase } from '@/lib/supabase';

const DatabaseTestComponent: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testDatabaseConnection = async () => {
    setLoading(true);
    setTestResult('Testing database connection...\n');
    
    try {
      // Test 1: Basic connection
      setTestResult(prev => prev + '1. Testing basic connection...\n');
      const { data: user } = await supabase.auth.getUser();
      setTestResult(prev => prev + `   User: ${user?.user?.id || 'Anonymous'}\n`);
      
      // Test 2: Read matchups
      setTestResult(prev => prev + '2. Testing SELECT on matchups...\n');
      const matchupsResult = await DatabaseService.getMatchups({ limit: 1 });
      if (matchupsResult.error) {
        setTestResult(prev => prev + `   ❌ SELECT failed: ${matchupsResult.error.message}\n`);
        return;
      }
      setTestResult(prev => prev + `   ✅ SELECT successful: ${matchupsResult.data?.length || 0} records\n`);
      
      if (!matchupsResult.data || matchupsResult.data.length === 0) {
        setTestResult(prev => prev + '   No matchups found to test update\n');
        return;
      }
      
      // Test 3: Update a matchup
      const testMatchup = matchupsResult.data[0];
      setTestResult(prev => prev + `3. Testing UPDATE on matchup ${testMatchup.id}...\n`);
      
      const updateData = {
        manual_override: !testMatchup.manual_override, // Toggle the value
        notes: `Test update at ${new Date().toISOString()}`
      };
      
      setTestResult(prev => prev + `   Updating with: ${JSON.stringify(updateData)}\n`);
      
      const updateResult = await DatabaseService.updateMatchup(testMatchup.id, updateData);
      
      if (updateResult.error) {
        setTestResult(prev => prev + `   ❌ UPDATE failed: ${updateResult.error.message}\n`);
        setTestResult(prev => prev + `   Error code: ${updateResult.error.code}\n`);
        setTestResult(prev => prev + `   Error details: ${updateResult.error.details || 'None'}\n`);
        setTestResult(prev => prev + `   Error hint: ${updateResult.error.hint || 'None'}\n`);
      } else {
        setTestResult(prev => prev + `   ✅ UPDATE successful\n`);
        setTestResult(prev => prev + `   Updated record: ${JSON.stringify(updateResult.data)}\n`);
      }
      
      // Test 4: Check RLS policies
      setTestResult(prev => prev + '4. Checking RLS policies...\n');
      const { data: rlsInfo, error: rlsError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'matchups');
        
      if (rlsError) {
        setTestResult(prev => prev + `   Cannot check RLS policies (this is normal): ${rlsError.message}\n`);
      } else {
        setTestResult(prev => prev + `   Found ${rlsInfo?.length || 0} RLS policies\n`);
      }
      
    } catch (error: any) {
      setTestResult(prev => prev + `💥 Exception: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Database Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testDatabaseConnection} disabled={loading}>
          {loading ? 'Testing...' : 'Test Database Update'}
        </Button>
        
        {testResult && (
          <div className="bg-gray-100 p-4 rounded font-mono text-sm whitespace-pre-wrap">
            {testResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseTestComponent;
