import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Database,
  Trash2,
  RefreshCw,
  Shield,
  AlertCircle,
  Play,
  FileText } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dataIntegrityService, DataIntegrityReport, CleanupResult } from '@/services/dataIntegrityService';

const DataIntegrityManager: React.FC = () => {
  const [report, setReport] = useState<DataIntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    try {
      setLoading(true);
      const auditReport = await dataIntegrityService.auditDataIntegrity();
      setReport(auditReport);
    } catch (error) {
      console.error('Error running data integrity audit:', error);
      toast({
        title: 'Error',
        description: 'Failed to run data integrity audit',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async () => {
    try {
      setCleaning(true);

      // Run all cleanup operations
      const [
      integrityResult,
      relationshipResult,
      missingRecordsResult] =
      await Promise.all([
      dataIntegrityService.cleanupDataIntegrity(),
      dataIntegrityService.validateSeasonConferenceRelationships(),
      dataIntegrityService.createMissingTeamRecords()]
      );

      // Combine results
      const combinedResult: CleanupResult = {
        records_deleted: integrityResult.records_deleted,
        records_updated: integrityResult.records_updated + relationshipResult.records_updated,
        records_created: integrityResult.records_created + missingRecordsResult.records_created,
        errors: [
        ...integrityResult.errors,
        ...relationshipResult.errors,
        ...missingRecordsResult.errors],

        success: integrityResult.success && relationshipResult.success && missingRecordsResult.success
      };

      setCleanupResults(combinedResult);

      if (combinedResult.success) {
        toast({
          title: 'Success',
          description: 'Data integrity cleanup completed successfully'
        });
      } else {
        toast({
          title: 'Partial Success',
          description: 'Cleanup completed with some errors',
          variant: 'destructive'
        });
      }

      // Refresh the audit report
      await runAudit();
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast({
        title: 'Error',
        description: 'Failed to run data integrity cleanup',
        variant: 'destructive'
      });
    } finally {
      setCleaning(false);
    }
  };

  const getSeverityColor = (value: number): string => {
    if (value === 0) return 'text-green-600';
    if (value <= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityBadge = (value: number) => {
    if (value === 0) return <Badge variant="outline" className="text-green-600 border-green-600">Good</Badge>;
    if (value <= 5) return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Integrity Manager
          </CardTitle>
          <CardDescription>Running data integrity audit...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Analyzing data integrity...</span>
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Integrity Manager
          </CardTitle>
          <CardDescription>
            Monitor and maintain data integrity across team records, seasons, and conferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={runAudit} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Audit
            </Button>
            <Button
              onClick={runCleanup}
              disabled={cleaning || !report}
              variant="outline">

              {cleaning ?
              <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cleaning...
                </> :

              <>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Cleanup
                </>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {report &&
      <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            {cleanupResults && <TabsTrigger value="cleanup">Cleanup Results</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Team Records</CardDescription>
                  <CardTitle className="text-2xl">{report.total_team_records}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Expected: {report.seasons_affected.length * 36} records
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Duplicate Records</CardDescription>
                  <CardTitle className={`text-2xl ${getSeverityColor(report.duplicate_records)}`}>
                    {report.duplicate_records}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getSeverityBadge(report.duplicate_records)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Orphaned Records</CardDescription>
                  <CardTitle className={`text-2xl ${getSeverityColor(report.orphaned_records)}`}>
                    {report.orphaned_records}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getSeverityBadge(report.orphaned_records)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Invalid Relationships</CardDescription>
                  <CardTitle className={`text-2xl ${getSeverityColor(report.invalid_relationships)}`}>
                    {report.invalid_relationships}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getSeverityBadge(report.invalid_relationships)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Missing Junction Records</CardDescription>
                  <CardTitle className={`text-2xl ${getSeverityColor(report.missing_junction_records)}`}>
                    {report.missing_junction_records}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getSeverityBadge(report.missing_junction_records)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Seasons Affected</CardDescription>
                  <CardTitle className="text-2xl">{report.seasons_affected.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Seasons: {report.seasons_affected.join(', ')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {(report.duplicate_records > 0 || report.orphaned_records > 0 || report.invalid_relationships > 0 || report.missing_junction_records > 0) &&
          <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Data integrity issues detected. Run cleanup to fix these issues automatically.
                </AlertDescription>
              </Alert>
          }

            {report.duplicate_records === 0 && report.orphaned_records === 0 && report.invalid_relationships === 0 && report.missing_junction_records === 0 &&
          <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Data integrity is good! No issues detected.
                </AlertDescription>
              </Alert>
          }
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analysis</CardTitle>
                <CardDescription>
                  Breakdown of data integrity issues by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue Type</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Duplicate Records</TableCell>
                      <TableCell>{report.duplicate_records}</TableCell>
                      <TableCell>{getSeverityBadge(report.duplicate_records)}</TableCell>
                      <TableCell>Records with identical team-conference-season combinations</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Orphaned Records</TableCell>
                      <TableCell>{report.orphaned_records}</TableCell>
                      <TableCell>{getSeverityBadge(report.orphaned_records)}</TableCell>
                      <TableCell>Records referencing non-existent teams, conferences, or seasons</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Invalid Relationships</TableCell>
                      <TableCell>{report.invalid_relationships}</TableCell>
                      <TableCell>{getSeverityBadge(report.invalid_relationships)}</TableCell>
                      <TableCell>Team records for teams not in the specified conference</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Missing Junction Records</TableCell>
                      <TableCell>{report.missing_junction_records}</TableCell>
                      <TableCell>{getSeverityBadge(report.missing_junction_records)}</TableCell>
                      <TableCell>Missing team-conference junction table entries</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Affected Seasons and Conferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Seasons with Records</h4>
                    <div className="space-y-1">
                      {report.seasons_affected.map((seasonId) =>
                    <Badge key={seasonId} variant="outline">
                          Season {seasonId}
                        </Badge>
                    )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Conferences with Records</h4>
                    <div className="space-y-1">
                      {report.conferences_affected.map((conferenceId) =>
                    <Badge key={conferenceId} variant="outline">
                          Conference {conferenceId}
                        </Badge>
                    )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Cleanup Recommendations
                </CardTitle>
                <CardDescription>
                  Recommended actions to fix data integrity issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.cleanup_recommendations.length === 0 ?
              <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No cleanup recommendations. Your data integrity is good!
                    </AlertDescription>
                  </Alert> :

              <div className="space-y-3">
                    {report.cleanup_recommendations.map((recommendation, index) =>
                <Alert key={index}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{recommendation}</AlertDescription>
                      </Alert>
                )}
                  </div>
              }
              </CardContent>
            </Card>
          </TabsContent>

          {cleanupResults &&
        <TabsContent value="cleanup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {cleanupResults.success ?
                <CheckCircle className="h-5 w-5 text-green-600" /> :

                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                }
                    Cleanup Results
                  </CardTitle>
                  <CardDescription>
                    Results from the most recent data integrity cleanup operation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Records Deleted</CardDescription>
                        <CardTitle className="text-2xl text-red-600">
                          {cleanupResults.records_deleted}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Records Updated</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">
                          {cleanupResults.records_updated}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Records Created</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                          {cleanupResults.records_created}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  {cleanupResults.errors.length > 0 &&
              <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium mb-2">Errors encountered during cleanup:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {cleanupResults.errors.map((error, index) =>
                    <li key={index} className="text-sm">{error}</li>
                    )}
                        </ul>
                      </AlertDescription>
                    </Alert>
              }

                  {cleanupResults.success &&
              <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Cleanup completed successfully! Data integrity has been restored.
                      </AlertDescription>
                    </Alert>
              }
                </CardContent>
              </Card>
            </TabsContent>
        }
        </Tabs>
      }
    </div>);

};

export default DataIntegrityManager;