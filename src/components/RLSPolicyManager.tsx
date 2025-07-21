import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Shield, Database, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const RLSPolicyManager: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);

  const testRLSPolicies = async () => {
    setLoading(true);
    setTestResult('Testing RLS policies...\n');
    
    try {
      // Test 1: Check if RLS is enabled on matchups table
      setTestResult(prev => prev + '1. Checking RLS status...\n');
      
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'matchups')
        .eq('table_schema', 'public');
        
      if (tableError) {
        setTestResult(prev => prev + `   ❌ Cannot check table info: ${tableError.message}\n`);
      } else {
        setTestResult(prev => prev + `   ✅ Table info retrieved\n`);
      }
      
      // Test 2: Try to list policies (this may fail for anon users)
      setTestResult(prev => prev + '2. Checking existing policies...\n');
      
      const { data: policyData, error: policyError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'matchups');
        
      if (policyError) {
        setTestResult(prev => prev + `   ⚠️ Cannot list policies (normal for anon): ${policyError.message}\n`);
      } else {
        setPolicies(policyData || []);
        setTestResult(prev => prev + `   ✅ Found ${policyData?.length || 0} policies\n`);
      }
      
      // Test 3: Test UPDATE with detailed error analysis
      setTestResult(prev => prev + '3. Testing UPDATE operation...\n');
      
      // First, get a matchup to update
      const { data: matchups, error: selectError } = await supabase
        .from('matchups')
        .select('*')
        .limit(1);
        
      if (selectError || !matchups?.length) {
        setTestResult(prev => prev + `   ❌ Cannot get test matchup: ${selectError?.message}\n`);
        return;
      }
      
      const testMatchup = matchups[0];
      setTestResult(prev => prev + `   📋 Testing with matchup ID: ${testMatchup.id}\n`);
      
      // Try the update
      const updateData = {
        notes: `RLS test update at ${new Date().toISOString()}`
      };
      
      const { data: updateResult, error: updateError } = await supabase
        .from('matchups')
        .update(updateData)
        .eq('id', testMatchup.id)
        .select();
        
      if (updateError) {
        setTestResult(prev => prev + `   ❌ UPDATE failed: ${updateError.message}\n`);
        setTestResult(prev => prev + `   Error code: ${updateError.code}\n`);
        setTestResult(prev => prev + `   Error details: ${updateError.details || 'None'}\n`);
        setTestResult(prev => prev + `   Error hint: ${updateError.hint || 'None'}\n`);
        
        // Analyze the error
        if (updateError.code === 'PGRST116') {
          setTestResult(prev => prev + '\n   🔍 ANALYSIS: This is an RLS policy issue!\n');
          setTestResult(prev => prev + '   The update is being blocked by Row Level Security.\n');
          setTestResult(prev => prev + '   Solution: Create/update RLS policies for anonymous access.\n');
        }
      } else {
        setTestResult(prev => prev + `   ✅ UPDATE successful: ${updateResult?.length || 0} rows affected\n`);
      }
      
      // Test 4: Check user context
      setTestResult(prev => prev + '4. Checking authentication context...\n');
      const { data: { user } } = await supabase.auth.getUser();
      setTestResult(prev => prev + `   User ID: ${user?.id || 'Anonymous'}\n`);
      setTestResult(prev => prev + `   User role: ${user?.role || 'anon'}\n`);
      
    } catch (error: any) {
      setTestResult(prev => prev + `💥 Exception: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  const suggestRLSFix = () => {
    return `
-- SQL to run in Supabase SQL Editor to fix RLS policies:

-- Enable RLS on matchups table
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous read access
CREATE POLICY "Allow anonymous read access to matchups" 
ON matchups FOR SELECT 
TO anon 
USING (true);

-- Create policy for anonymous update access
CREATE POLICY "Allow anonymous update access to matchups" 
ON matchups FOR UPDATE 
TO anon 
USING (true) 
WITH CHECK (true);

-- Create policy for anonymous insert access
CREATE POLICY "Allow anonymous insert access to matchups" 
ON matchups FOR INSERT 
TO anon 
WITH CHECK (true);

-- Verify policies were created
SELECT * FROM pg_policies WHERE tablename = 'matchups';
    `.trim();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            RLS Policy Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={testRLSPolicies} disabled={loading}>
              {loading ? 'Testing...' : 'Test RLS Policies'}
            </Button>
          </div>
          
          {testResult && (
            <div className="bg-gray-100 p-4 rounded font-mono text-sm whitespace-pre-wrap">
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            RLS Policy Fix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>To fix the RLS policy issue:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Go to your Supabase dashboard</li>
                <li>Navigate to SQL Editor</li>
                <li>Copy and paste the SQL code below</li>
                <li>Run the query</li>
                <li>Test the update functionality again</li>
              </ol>
            </AlertDescription>
          </Alert>
          
          <div className="mt-4">
            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm whitespace-pre-wrap overflow-x-auto">
              {suggestRLSFix()}
            </div>
          </div>
        </CardContent>
      </Card>

      {policies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {policies.map((policy, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <Badge variant="outline">{policy.policyname}</Badge>
                    <span className="ml-2 text-sm text-gray-600">
                      {policy.cmd} for {policy.roles}
                    </span>
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RLSPolicyManager;
