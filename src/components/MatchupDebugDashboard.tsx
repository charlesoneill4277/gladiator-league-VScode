import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Bug, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Zap, 
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  Network,
  FileText
} from 'lucide-react';
import { matchupDataFlowDebugger } from '@/services/matchupDataFlowDebugger';

interface DebugDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

const MatchupDebugDashboard: React.FC<DebugDashboardProps> = ({ isVisible, onClose }) => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2 seconds

  useEffect(() => {
    if (!isVisible) return;

    const updateDashboard = () => {
      const data = matchupDataFlowDebugger.getDebugDashboard();
      setDashboardData(data);
    };

    // Initial load
    updateDashboard();

    // Set up auto-refresh
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(updateDashboard, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, autoRefresh, refreshInterval]);

  const handleExportTrace = (traceId?: string) => {
    const data = matchupDataFlowDebugger.exportTraceData(traceId);
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matchup-debug-${traceId || 'all'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleClearTraces = () => {
    matchupDataFlowDebugger.clearTraces();
    setSelectedTrace(null);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    return `${duration.toFixed(2)}ms`;
  };

  if (!isVisible || !dashboardData) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Matchup Data Flow Debugger</h2>
            <Badge variant={dashboardData.isEnabled ? "default" : "secondary"}>
              {dashboardData.isEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportTrace()}>
              <Download className="h-4 w-4" />
              Export All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearTraces}>
              Clear Traces
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="p-4 max-h-[calc(90vh-4rem)] overflow-y-auto">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="traces">Active Traces</TabsTrigger>
              <TabsTrigger value="steps">Recent Steps</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="consistency">Consistency</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Traces</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {dashboardData.summary.activeTraces}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Activity className="h-3 w-3 mr-1" />
                      Currently tracking
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Steps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {dashboardData.summary.totalSteps}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Operations logged
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {dashboardData.summary.errorRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      {dashboardData.summary.errorRate > 10 ? (
                        <TrendingUp className="h-3 w-3 mr-1 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                      )}
                      {dashboardData.summary.errorRate > 10 ? 'High' : 'Normal'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatDuration(dashboardData.summary.averageStepDuration)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Per operation
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {dashboardData.recommendations && dashboardData.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.recommendations.map((rec: string, index: number) => (
                        <Alert key={index}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{rec}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <Network className="h-4 w-4 mr-2 text-blue-500" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Data Flow Health</div>
                      <Progress 
                        value={Math.max(0, 100 - dashboardData.summary.errorRate)} 
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {100 - dashboardData.summary.errorRate}% healthy
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Performance Score</div>
                      <Progress 
                        value={Math.min(100, Math.max(0, 100 - (dashboardData.summary.averageStepDuration / 10)))} 
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {dashboardData.summary.averageStepDuration < 100 ? 'Excellent' : 
                         dashboardData.summary.averageStepDuration < 500 ? 'Good' : 'Needs attention'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Active Traces Tab */}
            <TabsContent value="traces" className="space-y-4">
              <div className="grid gap-4">
                {dashboardData.activeTraces.map((trace: any) => (
                  <Card key={trace.traceId} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Matchup {trace.matchupId} - {trace.traceId}
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{trace.stepCount} steps</Badge>
                          <Badge variant="outline">{trace.transformationCount} transforms</Badge>
                          {trace.errorCount > 0 && (
                            <Badge variant="destructive">{trace.errorCount} errors</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Last activity: {formatTimestamp(trace.lastActivity)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportTrace(trace.traceId)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Export
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {dashboardData.activeTraces.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Activity className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No active traces</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Recent Steps Tab */}
            <TabsContent value="steps" className="space-y-4">
              <div className="space-y-2">
                {dashboardData.recentSteps.map((step: any) => (
                  <Card key={step.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${step.isValid ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="text-sm font-medium">{step.stage}/{step.operation}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTimestamp(step.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {step.duration && (
                            <Badge variant="outline" className="text-xs">
                              {formatDuration(step.duration)}
                            </Badge>
                          )}
                          {step.issues > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {step.issues} issues
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Operations:</span>
                        <span className="text-sm font-medium">{dashboardData.performanceMetrics.totalOperations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Average Response:</span>
                        <span className="text-sm font-medium">{formatDuration(dashboardData.performanceMetrics.averageResponseTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Error Rate:</span>
                        <span className="text-sm font-medium">{dashboardData.performanceMetrics.errorRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Slowest Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.performanceMetrics.slowestOperations.slice(0, 5).map((op: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate">{op.stage}/{op.operation}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatDuration(op.performance?.duration)}
                          </Badge>
                        </div>
                      ))}
                      {dashboardData.performanceMetrics.slowestOperations.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No slow operations detected
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Consistency Tab */}
            <TabsContent value="consistency" className="space-y-4">
              <div className="space-y-4">
                {dashboardData.consistencyIssues.map((issue: any, index: number) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                        Consistency Issue - Matchup {issue.matchupId}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Check Type:</span>
                          <Badge variant="outline">{issue.checkType}</Badge>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Issues:</span>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {issue.discrepancies.map((disc: string, discIndex: number) => (
                              <li key={discIndex} className="text-xs text-red-600">{disc}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {dashboardData.consistencyIssues.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <CheckCircle className="h-8 w-8 mx-auto mb-4 text-green-500" />
                      <p className="text-muted-foreground">No consistency issues detected</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Errors Tab */}
            <TabsContent value="errors" className="space-y-4">
              <div className="space-y-4">
                {/* Error summary would go here */}
                <Card>
                  <CardContent className="py-8 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Error details will be populated from trace data</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MatchupDebugDashboard;