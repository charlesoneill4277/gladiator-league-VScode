/**
 * Comprehensive Data Flow Debugging System for Matchup Management
 * 
 * This service provides detailed logging, validation, and debugging capabilities
 * to track exactly where modified matchups lose their routing between database
 * and Sleeper API integration.
 */

interface DebugStep {
  id: string;
  timestamp: number;
  stage: string;
  operation: string;
  data: any;
  validation: ValidationResult;
  performance: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  criticalErrors: string[];
}

interface DataFlowTrace {
  matchupId: number | string;
  traceId: string;
  steps: DebugStep[];
  dataTransformations: DataTransformation[];
  consistencyChecks: ConsistencyCheck[];
  errors: DebugError[];
}

interface DataTransformation {
  from: 'database' | 'sleeper' | 'hybrid' | 'ui';
  to: 'database' | 'sleeper' | 'hybrid' | 'ui';
  timestamp: number;
  data: {
    before: any;
    after: any;
    changed: string[];
  };
  validation: ValidationResult;
}

interface ConsistencyCheck {
  timestamp: number;
  checkType: 'team_assignment' | 'scoring_data' | 'roster_mapping' | 'data_integrity';
  result: 'pass' | 'fail' | 'warning';
  details: {
    expected: any;
    actual: any;
    discrepancies: string[];
  };
}

interface DebugError {
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stage: string;
  operation: string;
  error: string;
  context: any;
  stackTrace?: string;
}

class MatchupDataFlowDebugger {
  private isEnabled = false;
  private traces = new Map<string, DataFlowTrace>();
  private globalSteps: DebugStep[] = [];
  private performanceMetrics = {
    totalOperations: 0,
    averageResponseTime: 0,
    slowestOperations: [] as DebugStep[],
    errorRate: 0
  };

  /**
   * Enable/disable debugging mode
   */
  setDebugMode(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🐛 Matchup Data Flow Debugger: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (enabled) {
      console.log('🔍 Debug mode activated - All data transformations will be traced');
      this.logSystemInfo();
    }
  }

  /**
   * Log system information for debugging context
   */
  private logSystemInfo(): void {
    const info = {
      timestamp: Date.now(),
      browser: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      memory: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      } : 'unavailable',
      activeTraces: this.traces.size
    };
    
    console.log('🖥️ System Info:', info);
  }

  /**
   * Start tracing a matchup through the data flow
   */
  startTrace(matchupId: number | string, operation: string): string {
    if (!this.isEnabled) return '';
    
    const traceId = `trace_${matchupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trace: DataFlowTrace = {
      matchupId,
      traceId,
      steps: [],
      dataTransformations: [],
      consistencyChecks: [],
      errors: []
    };
    
    this.traces.set(traceId, trace);
    
    console.log(`🚀 Starting trace for matchup ${matchupId}:`, {
      traceId,
      operation,
      timestamp: new Date().toISOString()
    });
    
    return traceId;
  }

  /**
   * Log a step in the data flow process
   */
  logStep(traceId: string, stage: string, operation: string, data: any): DebugStep {
    if (!this.isEnabled || !traceId) return {} as DebugStep;
    
    const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const validation = this.validateStepData(stage, operation, data);
    
    const step: DebugStep = {
      id: stepId,
      timestamp: Date.now(),
      stage,
      operation,
      data: this.sanitizeDataForLogging(data),
      validation,
      performance: {
        startTime: performance.now()
      }
    };
    
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.steps.push(step);
    }
    
    this.globalSteps.push(step);
    this.performanceMetrics.totalOperations++;
    
    console.log(`📝 Step logged [${stage}/${operation}]:`, {
      stepId,
      traceId,
      stage,
      operation,
      dataSize: JSON.stringify(step.data).length,
      validation: validation.isValid ? '✅ Valid' : '❌ Invalid',
      issues: validation.issues.length,
      warnings: validation.warnings.length
    });
    
    if (!validation.isValid) {
      console.warn(`⚠️ Validation issues in step ${stepId}:`, validation);
    }
    
    return step;
  }

  /**
   * Complete a step and record performance metrics
   */
  completeStep(traceId: string, stepId: string): void {
    if (!this.isEnabled || !traceId || !stepId) return;
    
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    const step = trace.steps.find(s => s.id === stepId);
    if (!step) return;
    
    step.performance.endTime = performance.now();
    step.performance.duration = step.performance.endTime - step.performance.startTime;
    
    // Track slow operations
    if (step.performance.duration > 1000) { // > 1 second
      this.performanceMetrics.slowestOperations.push(step);
      console.warn(`🐌 Slow operation detected:`, {
        stepId,
        duration: `${step.performance.duration.toFixed(2)}ms`,
        operation: `${step.stage}/${step.operation}`
      });
    }
    
    console.log(`⏱️ Step completed [${step.stage}/${step.operation}]: ${step.performance.duration?.toFixed(2)}ms`);
  }

  /**
   * Log a data transformation
   */
  logDataTransformation(
    traceId: string,
    from: DataTransformation['from'],
    to: DataTransformation['to'],
    beforeData: any,
    afterData: any
  ): void {
    if (!this.isEnabled || !traceId) return;
    
    const trace = this.traces.get(traceId);
    if (!trace) return;
    
    const changed = this.detectChanges(beforeData, afterData);
    const validation = this.validateTransformation(from, to, beforeData, afterData);
    
    const transformation: DataTransformation = {
      from,
      to,
      timestamp: Date.now(),
      data: {
        before: this.sanitizeDataForLogging(beforeData),
        after: this.sanitizeDataForLogging(afterData),
        changed
      },
      validation
    };
    
    trace.dataTransformations.push(transformation);
    
    console.log(`🔄 Data transformation [${from} → ${to}]:`, {
      traceId,
      fieldsChanged: changed.length,
      changedFields: changed,
      validation: validation.isValid ? '✅ Valid' : '❌ Invalid'
    });
    
    if (changed.length > 0) {
      console.log(`📊 Changed fields:`, changed.map(field => ({
        field,
        before: beforeData?.[field],
        after: afterData?.[field]
      })));
    }
    
    if (!validation.isValid) {
      console.error(`❌ Transformation validation failed [${from} → ${to}]:`, validation);
    }
  }

  /**
   * Perform consistency check
   */
  performConsistencyCheck(
    traceId: string,
    checkType: ConsistencyCheck['checkType'],
    expected: any,
    actual: any
  ): ConsistencyCheck {
    if (!this.isEnabled || !traceId) return {} as ConsistencyCheck;
    
    const trace = this.traces.get(traceId);
    if (!trace) return {} as ConsistencyCheck;
    
    const discrepancies = this.findDiscrepancies(expected, actual, checkType);
    const result: ConsistencyCheck['result'] = 
      discrepancies.length === 0 ? 'pass' : 
      discrepancies.some(d => d.includes('CRITICAL')) ? 'fail' : 'warning';
    
    const check: ConsistencyCheck = {
      timestamp: Date.now(),
      checkType,
      result,
      details: {
        expected: this.sanitizeDataForLogging(expected),
        actual: this.sanitizeDataForLogging(actual),
        discrepancies
      }
    };
    
    trace.consistencyChecks.push(check);
    
    const resultIcon = result === 'pass' ? '✅' : result === 'warning' ? '⚠️' : '❌';
    console.log(`${resultIcon} Consistency check [${checkType}]:`, {
      traceId,
      result,
      discrepancies: discrepancies.length,
      details: discrepancies
    });
    
    if (result === 'fail') {
      console.error(`🚨 CRITICAL consistency failure [${checkType}]:`, {
        expected,
        actual,
        discrepancies
      });
    }
    
    return check;
  }

  /**
   * Log an error in the data flow
   */
  logError(
    traceId: string,
    severity: DebugError['severity'],
    stage: string,
    operation: string,
    error: string | Error,
    context?: any
  ): void {
    if (!this.isEnabled) return;
    
    const errorObj: DebugError = {
      timestamp: Date.now(),
      severity,
      stage,
      operation,
      error: error instanceof Error ? error.message : error,
      context: this.sanitizeDataForLogging(context),
      stackTrace: error instanceof Error ? error.stack : undefined
    };
    
    if (traceId) {
      const trace = this.traces.get(traceId);
      if (trace) {
        trace.errors.push(errorObj);
      }
    }
    
    const severityIcon = {
      low: '💡',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥'
    }[severity];
    
    console.error(`${severityIcon} ${severity.toUpperCase()} Error [${stage}/${operation}]:`, {
      traceId,
      error: errorObj.error,
      context: errorObj.context,
      timestamp: new Date(errorObj.timestamp).toISOString()
    });
    
    if (errorObj.stackTrace && severity === 'critical') {
      console.error('Stack trace:', errorObj.stackTrace);
    }
  }

  /**
   * Complete a trace and generate summary
   */
  completeTrace(traceId: string): DataFlowTrace | null {
    if (!this.isEnabled || !traceId) return null;
    
    const trace = this.traces.get(traceId);
    if (!trace) return null;
    
    const summary = this.generateTraceSummary(trace);
    
    console.log(`🏁 Trace completed for matchup ${trace.matchupId}:`, summary);
    
    if (summary.hasErrors) {
      console.error(`❌ Trace completed with errors:`, {
        traceId,
        errorCount: summary.errorCount,
        criticalErrors: summary.criticalErrors,
        warnings: summary.warnings
      });
    }
    
    return trace;
  }

  /**
   * Get debugging dashboard data
   */
  getDebugDashboard(): any {
    if (!this.isEnabled) return null;
    
    const activeTraces = Array.from(this.traces.values());
    const recentSteps = this.globalSteps.slice(-50); // Last 50 steps
    
    return {
      isEnabled: this.isEnabled,
      summary: {
        activeTraces: activeTraces.length,
        totalSteps: this.globalSteps.length,
        recentActivity: recentSteps.length,
        errorRate: this.calculateErrorRate(),
        averageStepDuration: this.calculateAverageStepDuration()
      },
      activeTraces: activeTraces.map(trace => ({
        traceId: trace.traceId,
        matchupId: trace.matchupId,
        stepCount: trace.steps.length,
        transformationCount: trace.dataTransformations.length,
        errorCount: trace.errors.length,
        lastActivity: Math.max(
          ...trace.steps.map(s => s.timestamp),
          ...trace.dataTransformations.map(t => t.timestamp),
          0
        )
      })),
      recentSteps: recentSteps.map(step => ({
        id: step.id,
        timestamp: step.timestamp,
        stage: step.stage,
        operation: step.operation,
        duration: step.performance.duration,
        isValid: step.validation.isValid,
        issues: step.validation.issues.length
      })),
      performanceMetrics: this.performanceMetrics,
      consistencyIssues: this.getConsistencyIssues(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Clear all traces and reset debugging state
   */
  clearTraces(): void {
    this.traces.clear();
    this.globalSteps.length = 0;
    this.performanceMetrics = {
      totalOperations: 0,
      averageResponseTime: 0,
      slowestOperations: [],
      errorRate: 0
    };
    
    console.log('🧹 All traces cleared');
  }

  /**
   * Export trace data for analysis
   */
  exportTraceData(traceId?: string): any {
    if (!this.isEnabled) return null;
    
    if (traceId) {
      const trace = this.traces.get(traceId);
      return trace ? this.sanitizeTraceForExport(trace) : null;
    }
    
    return {
      exportTimestamp: Date.now(),
      debuggerState: {
        isEnabled: this.isEnabled,
        totalTraces: this.traces.size,
        totalSteps: this.globalSteps.length
      },
      traces: Array.from(this.traces.values()).map(trace => 
        this.sanitizeTraceForExport(trace)
      ),
      performanceMetrics: this.performanceMetrics
    };
  }

  // Private helper methods

  private validateStepData(stage: string, operation: string, data: any): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const criticalErrors: string[] = [];
    
    // Basic validation
    if (!stage || typeof stage !== 'string') {
      criticalErrors.push('Invalid or missing stage');
    }
    
    if (!operation || typeof operation !== 'string') {
      criticalErrors.push('Invalid or missing operation');
    }
    
    // Stage-specific validation
    switch (stage) {
      case 'database':
        this.validateDatabaseData(data, issues, warnings, criticalErrors);
        break;
      case 'sleeper_api':
        this.validateSleeperApiData(data, issues, warnings, criticalErrors);
        break;
      case 'hybrid_service':
        this.validateHybridServiceData(data, issues, warnings, criticalErrors);
        break;
      case 'ui_component':
        this.validateUIComponentData(data, issues, warnings, criticalErrors);
        break;
    }
    
    return {
      isValid: criticalErrors.length === 0,
      issues,
      warnings,
      criticalErrors
    };
  }

  private validateDatabaseData(data: any, issues: string[], warnings: string[], criticalErrors: string[]): void {
    if (data && typeof data === 'object') {
      // Check for required database fields
      if (data.id !== undefined && (typeof data.id !== 'number' || data.id <= 0)) {
        criticalErrors.push('Invalid database ID');
      }
      
      if (data.team_1_id !== undefined && (typeof data.team_1_id !== 'number' || data.team_1_id <= 0)) {
        criticalErrors.push('Invalid team_1_id');
      }
      
      if (data.team_2_id !== undefined && (typeof data.team_2_id !== 'number' || data.team_2_id <= 0)) {
        criticalErrors.push('Invalid team_2_id');
      }
      
      if (data.team_1_id === data.team_2_id && data.team_1_id !== undefined) {
        criticalErrors.push('Teams cannot play themselves');
      }
      
      if (data.conference_id !== undefined && (typeof data.conference_id !== 'number' || data.conference_id <= 0)) {
        criticalErrors.push('Invalid conference_id');
      }
    }
  }

  private validateSleeperApiData(data: any, issues: string[], warnings: string[], criticalErrors: string[]): void {
    if (data && typeof data === 'object') {
      // Check for Sleeper API data structure
      if (data.roster_id !== undefined && (typeof data.roster_id !== 'number' || data.roster_id <= 0)) {
        criticalErrors.push('Invalid Sleeper roster_id');
      }
      
      if (data.points !== undefined && typeof data.points !== 'number') {
        warnings.push('Points data is not numeric');
      }
      
      if (data.players_points && typeof data.players_points !== 'object') {
        warnings.push('Player points data is not an object');
      }
      
      if (data.starters && !Array.isArray(data.starters)) {
        warnings.push('Starters data is not an array');
      }
    }
  }

  private validateHybridServiceData(data: any, issues: string[], warnings: string[], criticalErrors: string[]): void {
    if (data && typeof data === 'object') {
      // Check hybrid service data integrity
      if (data.dataSource && !['database', 'sleeper', 'hybrid'].includes(data.dataSource)) {
        issues.push('Invalid data source specified');
      }
      
      if (data.teams && Array.isArray(data.teams)) {
        data.teams.forEach((team: any, index: number) => {
          if (!team.roster_id || !team.database_team_id) {
            criticalErrors.push(`Team ${index + 1} missing roster or database ID mapping`);
          }
        });
      }
    }
  }

  private validateUIComponentData(data: any, issues: string[], warnings: string[], criticalErrors: string[]): void {
    if (data && typeof data === 'object') {
      // Check UI component data
      if (data.matchupId && (typeof data.matchupId !== 'number' && typeof data.matchupId !== 'string')) {
        issues.push('Invalid matchup ID for UI display');
      }
    }
  }

  private sanitizeDataForLogging(data: any): any {
    if (!data) return data;
    
    try {
      // Deep clone and sanitize sensitive data
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // Remove or mask sensitive fields
      if (sanitized.password) sanitized.password = '[REDACTED]';
      if (sanitized.token) sanitized.token = '[REDACTED]';
      if (sanitized.api_key) sanitized.api_key = '[REDACTED]';
      
      return sanitized;
    } catch (error) {
      return '[UNABLE_TO_SANITIZE]';
    }
  }

  private detectChanges(before: any, after: any): string[] {
    const changed: string[] = [];
    
    if (!before || !after) return changed;
    
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key);
      }
    }
    
    return changed;
  }

  private validateTransformation(
    from: DataTransformation['from'],
    to: DataTransformation['to'],
    beforeData: any,
    afterData: any
  ): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const criticalErrors: string[] = [];
    
    // Validate transformation logic
    if (from === to) {
      warnings.push('Transformation from and to the same source');
    }
    
    // Check for data loss during transformation
    if (beforeData && afterData) {
      const beforeKeys = Object.keys(beforeData);
      const afterKeys = Object.keys(afterData);
      
      const lostKeys = beforeKeys.filter(key => !afterKeys.includes(key));
      if (lostKeys.length > 0) {
        warnings.push(`Data loss detected: ${lostKeys.join(', ')}`);
      }
    }
    
    return {
      isValid: criticalErrors.length === 0,
      issues,
      warnings,
      criticalErrors
    };
  }

  private findDiscrepancies(expected: any, actual: any, checkType: string): string[] {
    const discrepancies: string[] = [];
    
    if (!expected || !actual) {
      discrepancies.push('CRITICAL: Missing data for comparison');
      return discrepancies;
    }
    
    switch (checkType) {
      case 'team_assignment':
        this.checkTeamAssignmentConsistency(expected, actual, discrepancies);
        break;
      case 'scoring_data':
        this.checkScoringDataConsistency(expected, actual, discrepancies);
        break;
      case 'roster_mapping':
        this.checkRosterMappingConsistency(expected, actual, discrepancies);
        break;
      case 'data_integrity':
        this.checkDataIntegrityConsistency(expected, actual, discrepancies);
        break;
    }
    
    return discrepancies;
  }

  private checkTeamAssignmentConsistency(expected: any, actual: any, discrepancies: string[]): void {
    if (expected.team_1_id !== actual.team_1_id) {
      discrepancies.push(`Team 1 mismatch: expected ${expected.team_1_id}, got ${actual.team_1_id}`);
    }
    
    if (expected.team_2_id !== actual.team_2_id) {
      discrepancies.push(`Team 2 mismatch: expected ${expected.team_2_id}, got ${actual.team_2_id}`);
    }
  }

  private checkScoringDataConsistency(expected: any, actual: any, discrepancies: string[]): void {
    if (Math.abs(expected.points - actual.points) > 0.1) {
      discrepancies.push(`Score mismatch: expected ${expected.points}, got ${actual.points}`);
    }
  }

  private checkRosterMappingConsistency(expected: any, actual: any, discrepancies: string[]): void {
    if (expected.roster_id !== actual.roster_id) {
      discrepancies.push(`CRITICAL: Roster ID mismatch: expected ${expected.roster_id}, got ${actual.roster_id}`);
    }
  }

  private checkDataIntegrityConsistency(expected: any, actual: any, discrepancies: string[]): void {
    // Check general data integrity
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    
    const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
    if (missingKeys.length > 0) {
      discrepancies.push(`Missing keys: ${missingKeys.join(', ')}`);
    }
  }

  private generateTraceSummary(trace: DataFlowTrace): any {
    const errorCount = trace.errors.length;
    const criticalErrors = trace.errors.filter(e => e.severity === 'critical').length;
    const warnings = trace.errors.filter(e => e.severity === 'low' || e.severity === 'medium').length;
    const failedChecks = trace.consistencyChecks.filter(c => c.result === 'fail').length;
    
    return {
      traceId: trace.traceId,
      matchupId: trace.matchupId,
      stepCount: trace.steps.length,
      transformationCount: trace.dataTransformations.length,
      consistencyCheckCount: trace.consistencyChecks.length,
      errorCount,
      criticalErrors,
      warnings,
      failedChecks,
      hasErrors: errorCount > 0 || failedChecks > 0,
      duration: this.calculateTraceDuration(trace)
    };
  }

  private calculateTraceDuration(trace: DataFlowTrace): number {
    if (trace.steps.length === 0) return 0;
    
    const firstStep = Math.min(...trace.steps.map(s => s.timestamp));
    const lastStep = Math.max(...trace.steps.map(s => s.timestamp));
    
    return lastStep - firstStep;
  }

  private calculateErrorRate(): number {
    if (this.globalSteps.length === 0) return 0;
    
    const errorSteps = this.globalSteps.filter(step => !step.validation.isValid);
    return (errorSteps.length / this.globalSteps.length) * 100;
  }

  private calculateAverageStepDuration(): number {
    const stepsWithDuration = this.globalSteps.filter(step => step.performance.duration);
    if (stepsWithDuration.length === 0) return 0;
    
    const totalDuration = stepsWithDuration.reduce((sum, step) => sum + (step.performance.duration || 0), 0);
    return totalDuration / stepsWithDuration.length;
  }

  private getConsistencyIssues(): any[] {
    const issues: any[] = [];
    
    for (const trace of this.traces.values()) {
      const failedChecks = trace.consistencyChecks.filter(c => c.result === 'fail');
      issues.push(...failedChecks.map(check => ({
        traceId: trace.traceId,
        matchupId: trace.matchupId,
        checkType: check.checkType,
        discrepancies: check.details.discrepancies
      })));
    }
    
    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const errorRate = this.calculateErrorRate();
    if (errorRate > 10) {
      recommendations.push('High error rate detected - review data validation logic');
    }
    
    const avgDuration = this.calculateAverageStepDuration();
    if (avgDuration > 500) {
      recommendations.push('Slow operations detected - consider optimizing API calls');
    }
    
    const consistencyIssues = this.getConsistencyIssues();
    if (consistencyIssues.length > 0) {
      recommendations.push('Data consistency issues found - review data flow integrity');
    }
    
    return recommendations;
  }

  private sanitizeTraceForExport(trace: DataFlowTrace): any {
    return {
      traceId: trace.traceId,
      matchupId: trace.matchupId,
      summary: this.generateTraceSummary(trace),
      steps: trace.steps.map(step => ({
        id: step.id,
        timestamp: step.timestamp,
        stage: step.stage,
        operation: step.operation,
        validation: step.validation,
        performance: step.performance
      })),
      transformations: trace.dataTransformations.map(t => ({
        from: t.from,
        to: t.to,
        timestamp: t.timestamp,
        changedFields: t.data.changed,
        validation: t.validation
      })),
      consistencyChecks: trace.consistencyChecks,
      errors: trace.errors
    };
  }
}

// Export singleton instance
export const matchupDataFlowDebugger = new MatchupDataFlowDebugger();
export default matchupDataFlowDebugger;