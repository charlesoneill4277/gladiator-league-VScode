import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { dataIntegrityService } from '@/services/dataIntegrityService';
import { teamRecordsService } from '@/services/teamRecordsService';
import { CheckCircle, AlertTriangle, Play, Database } from 'lucide-react';

const DataIntegrityDemo: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDemo = async () => {
    try {
      setLoading(true);
      setResults(null);

      const demoResults = {
        auditBefore: null as any,
        cleanupResult: null as any,
        auditAfter: null as any,
        standingsTest: null as any
      };

      // Step 1: Run initial audit
      console.log('Running initial audit...');
      demoResults.auditBefore = await dataIntegrityService.auditDataIntegrity();
      console.log('Initial audit completed:', demoResults.auditBefore);

      // Step 2: Run cleanup if needed
      if (demoResults.auditBefore.duplicate_records > 0 || 
          demoResults.auditBefore.orphaned_records > 0 || 
          demoResults.auditBefore.invalid_relationships > 0) {
        console.log('Running cleanup...');
        demoResults.cleanupResult = await dataIntegrityService.cleanupDataIntegrity();
        console.log('Cleanup completed:', demoResults.cleanupResult);
      }

      // Step 3: Run final audit
      console.log('Running final audit...');
      demoResults.auditAfter = await dataIntegrityService.auditDataIntegrity();
      console.log('Final audit completed:', demoResults.auditAfter);

      // Step 4: Test standings for different seasons
      console.log('Testing standings data...');
      const standingsTest = {
        season2024: { count: 0, error: null },
        season2025: { count: 0, error: null }
      };

      try {
        const standings2024 = await teamRecordsService.getStandingsData(1); // Season ID 1
        standingsTest.season2024.count = standings2024.length;
      } catch (error) {
        standingsTest.season2024.error = error;
      }

      try {
        const standings2025 = await teamRecordsService.getStandingsData(2); // Season ID 2
        standingsTest.season2025.count = standings2025.length;
      } catch (error) {
        standingsTest.season2025.error = error;
      }

      demoResults.standingsTest = standingsTest;
      console.log('Standings test completed:', standingsTest);

      setResults(demoResults);
    } catch (error) {
      console.error('Demo failed:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Integrity Demonstration
        </CardTitle>
        <CardDescription>
          This demonstration shows how the data integrity fixes resolve the 77 teams issue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDemo} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running Demo...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Data Integrity Demo
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-4">
            {results.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{results.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Before Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Before Cleanup</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Records:</span>
                          <Badge variant="outline">{results.auditBefore?.total_team_records || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Duplicates:</span>
                          <Badge variant={results.auditBefore?.duplicate_records > 0 ? "destructive" : "outline"}>
                            {results.auditBefore?.duplicate_records || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Orphaned:</span>
                          <Badge variant={results.auditBefore?.orphaned_records > 0 ? "destructive" : "outline"}>
                            {results.auditBefore?.orphaned_records || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Invalid Relations:</span>
                          <Badge variant={results.auditBefore?.invalid_relationships > 0 ? "destructive" : "outline"}>
                            {results.auditBefore?.invalid_relationships || 0}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">After Cleanup</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Records:</span>
                          <Badge variant="outline">{results.auditAfter?.total_team_records || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Duplicates:</span>
                          <Badge variant={results.auditAfter?.duplicate_records > 0 ? "destructive" : "outline"}>
                            {results.auditAfter?.duplicate_records || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Orphaned:</span>
                          <Badge variant={results.auditAfter?.orphaned_records > 0 ? "destructive" : "outline"}>
                            {results.auditAfter?.orphaned_records || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Invalid Relations:</span>
                          <Badge variant={results.auditAfter?.invalid_relationships > 0 ? "destructive" : "outline"}>
                            {results.auditAfter?.invalid_relationships || 0}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Cleanup Results */}
                {results.cleanupResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cleanup Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {results.cleanupResult.records_deleted}
                          </div>
                          <div className="text-sm text-muted-foreground">Deleted</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {results.cleanupResult.records_updated}
                          </div>
                          <div className="text-sm text-muted-foreground">Updated</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {results.cleanupResult.records_created}
                          </div>
                          <div className="text-sm text-muted-foreground">Created</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Standings Test Results */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Standings Test Results</CardTitle>
                    <CardDescription>
                      Expected: 36 teams per season (12 teams × 3 conferences)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>2024 Season Teams:</span>
                        <Badge variant={results.standingsTest?.season2024?.count === 36 ? "default" : "destructive"}>
                          {results.standingsTest?.season2024?.count || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>2025 Season Teams:</span>
                        <Badge variant={results.standingsTest?.season2025?.count === 36 ? "default" : "destructive"}>
                          {results.standingsTest?.season2025?.count || 0}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Success Message */}
                {results.auditAfter?.duplicate_records === 0 && 
                 results.auditAfter?.orphaned_records === 0 && 
                 results.auditAfter?.invalid_relationships === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Data integrity issues have been resolved! The system now properly filters team records by season-conference relationships.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataIntegrityDemo;
