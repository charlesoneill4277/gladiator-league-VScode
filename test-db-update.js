// Test script to check database update functionality and RLS policies
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMatchupUpdate() {
  console.log('🔍 Testing matchup update functionality...');
  
  // First, let's check if we can read from the matchups table
  console.log('1. Testing SELECT permission...');
  const { data: matchups, error: selectError } = await supabase
    .from('matchups')
    .select('*')
    .limit(1);
    
  if (selectError) {
    console.error('❌ SELECT failed:', selectError);
    return;
  }
  
  console.log('✅ SELECT successful, found', matchups?.length || 0, 'matchups');
  
  if (!matchups || matchups.length === 0) {
    console.log('No matchups found to test update');
    return;
  }
  
  const testMatchup = matchups[0];
  console.log('📋 Test matchup:', testMatchup);
  
  // Test UPDATE permission
  console.log('2. Testing UPDATE permission...');
  const updateData = {
    manual_override: true,
    team1_score: 100.5,
    team2_score: 95.2,
    matchup_status: 'complete'
  };
  
  const { data: updatedMatchup, error: updateError } = await supabase
    .from('matchups')
    .update(updateData)
    .eq('id', testMatchup.id)
    .select()
    .single();
    
  if (updateError) {
    console.error('❌ UPDATE failed:', updateError);
    console.error('Error details:', {
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code
    });
    return;
  }
  
  console.log('✅ UPDATE successful:', updatedMatchup);
  
  // Test RLS policies by checking user context
  console.log('3. Testing RLS context...');
  const { data: user } = await supabase.auth.getUser();
  console.log('Current user:', user?.user?.id || 'Anonymous');
  
  // Check table policies
  const { data: policies, error: policyError } = await supabase
    .from('information_schema.row_security')
    .select('*');
    
  if (policyError) {
    console.log('Cannot check policies (expected for anon user)');
  } else {
    console.log('RLS policies:', policies);
  }
}

testMatchupUpdate().catch(console.error);
