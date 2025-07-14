
import { SleeperApiService } from './sleeperApi';
import { matchupService } from './matchupService';
import { teamRecordsService } from './teamRecordsService';
import { toast } from '@/hooks/use-toast';

export interface SyncSchedule {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string;
}

export interface SyncStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  currentStep: string;
  processedMatchups: number;
  totalMatchups: number;
  errors: string[];
  lastRunTime?: Date;
  nextRunTime?: Date;
}

export interface SyncHistory {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'partial';
  duration: number;
  matchupsProcessed: number;
  recordsUpdated: number;
  errors: string[];
  details: string;
}

class WeeklyAutoSyncService {
  private schedule: SyncSchedule = {
    enabled: false,
    dayOfWeek: 2, // Tuesday
    hour: 9, // 9 AM
    minute: 0,
    timezone: 'America/New_York'
  };

  private syncStatus: SyncStatus = {
    id: '',
    status: 'idle',
    progress: 0,
    currentStep: 'Waiting for next sync',
    processedMatchups: 0,
    totalMatchups: 0,
    errors: []
  };

  private syncHistory: SyncHistory[] = [];
  private scheduleTimer: NodeJS.Timeout | null = null;
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private historyListeners: ((history: SyncHistory[]) => void)[] = [];

  constructor() {
    this.loadSettings();
    this.scheduleNextSync();
  }

  // Public API
  public getSchedule(): SyncSchedule {
    return { ...this.schedule };
  }

  public updateSchedule(newSchedule: Partial<SyncSchedule>): void {
    this.schedule = { ...this.schedule, ...newSchedule };
    this.saveSettings();
    this.scheduleNextSync();
    this.notifyStatusListeners();
  }

  public getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public getHistory(): SyncHistory[] {
    return [...this.syncHistory];
  }

  public async runManualSync(): Promise<void> {
    if (this.syncStatus.status === 'running') {
      throw new Error('Sync is already running');
    }

    await this.executeSync(true);
  }

  public onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public onHistoryChange(listener: (history: SyncHistory[]) => void): () => void {
    this.historyListeners.push(listener);
    return () => {
      this.historyListeners = this.historyListeners.filter((l) => l !== listener);
    };
  }

  // Private methods
  private loadSettings(): void {
    try {
      const savedSchedule = localStorage.getItem('weeklyAutoSyncSchedule');
      if (savedSchedule) {
        this.schedule = { ...this.schedule, ...JSON.parse(savedSchedule) };
      }

      const savedHistory = localStorage.getItem('weeklyAutoSyncHistory');
      if (savedHistory) {
        this.syncHistory = JSON.parse(savedHistory).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load sync settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('weeklyAutoSyncSchedule', JSON.stringify(this.schedule));
      localStorage.setItem('weeklyAutoSyncHistory', JSON.stringify(this.syncHistory));
    } catch (error) {
      console.error('Failed to save sync settings:', error);
    }
  }

  private scheduleNextSync(): void {
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    if (!this.schedule.enabled) {
      this.updateSyncStatus({
        status: 'idle',
        currentStep: 'Automatic sync disabled',
        nextRunTime: undefined
      });
      return;
    }

    const nextRun = this.calculateNextRunTime();
    const now = new Date();
    const delay = nextRun.getTime() - now.getTime();

    if (delay > 0) {
      this.scheduleTimer = setTimeout(() => {
        this.executeSync(false);
      }, delay);

      this.updateSyncStatus({
        status: 'scheduled',
        currentStep: 'Scheduled for next run',
        nextRunTime: nextRun
      });
    }
  }

  private calculateNextRunTime(): Date {
    const now = new Date();
    const next = new Date(now);

    // Set to the scheduled time today
    next.setHours(this.schedule.hour, this.schedule.minute, 0, 0);

    // Calculate days until next scheduled day
    const currentDay = now.getDay();
    const targetDay = this.schedule.dayOfWeek;
    let daysUntil = targetDay - currentDay;

    // If the target day is today but the time has passed, or if target day is in the past
    if (daysUntil < 0 || daysUntil === 0 && now.getTime() >= next.getTime()) {
      daysUntil += 7; // Next week
    }

    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  private async executeSync(isManual: boolean): Promise<void> {
    const syncId = `sync_${Date.now()}`;
    const startTime = new Date();

    this.updateSyncStatus({
      id: syncId,
      status: 'running',
      startTime,
      progress: 0,
      currentStep: 'Initializing sync...',
      processedMatchups: 0,
      totalMatchups: 0,
      errors: []
    });

    const errors: string[] = [];
    let processedMatchups = 0;
    let updatedRecords = 0;

    try {
      // Step 1: Get active conferences and current season
      this.updateSyncStatus({
        currentStep: 'Fetching active conferences...',
        progress: 10
      });

      const { data: conferences } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        Filters: [{ name: 'is_active', op: 'Equal', value: true }]
      });

      if (!conferences?.List?.length) {
        throw new Error('No active conferences found');
      }

      const { data: seasons } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'is_current_season', op: 'Equal', value: true }]
      });

      if (!seasons?.List?.length) {
        throw new Error('No current season found');
      }

      const currentSeason = seasons.List[0];

      // Step 2: Get pending matchups for current week
      this.updateSyncStatus({
        currentStep: 'Fetching pending matchups...',
        progress: 20
      });

      const { data: matchups } = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
        { name: 'status', op: 'Equal', value: 'pending' },
        { name: 'week', op: 'Equal', value: currentSeason.current_week }]

      });

      const pendingMatchups = matchups?.List || [];
      this.updateSyncStatus({
        totalMatchups: pendingMatchups.length,
        progress: 30
      });

      // Step 3: Process each conference
      for (const conference of conferences.List) {
        this.updateSyncStatus({
          currentStep: `Processing ${conference.conference_name}...`,
          progress: 30 + processedMatchups / pendingMatchups.length * 40
        });

        try {
          const conferenceMatchups = pendingMatchups.filter((m) => m.conference_id === conference.id);

          for (const matchup of conferenceMatchups) {
            await this.processMatchup(matchup, conference, currentSeason);
            processedMatchups++;

            this.updateSyncStatus({
              processedMatchups,
              progress: 30 + processedMatchups / pendingMatchups.length * 40
            });
          }

          // Update team records for this conference
          await this.updateTeamRecords(conference.id, currentSeason.id);
          updatedRecords++;

        } catch (error) {
          const errorMsg = `Error processing ${conference.conference_name}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Step 4: Final cleanup and status update
      this.updateSyncStatus({
        currentStep: 'Finalizing sync...',
        progress: 90
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Add to history
      const historyEntry: SyncHistory = {
        id: syncId,
        timestamp: startTime,
        status: errors.length > 0 ? processedMatchups > 0 ? 'partial' : 'failed' : 'success',
        duration,
        matchupsProcessed: processedMatchups,
        recordsUpdated: updatedRecords,
        errors: [...errors],
        details: isManual ? 'Manual sync' : 'Scheduled sync'
      };

      this.syncHistory.unshift(historyEntry);
      this.syncHistory = this.syncHistory.slice(0, 100); // Keep last 100 entries
      this.saveSettings();
      this.notifyHistoryListeners();

      this.updateSyncStatus({
        status: errors.length > 0 ? 'failed' : 'completed',
        endTime,
        progress: 100,
        currentStep: `Sync completed ${errors.length > 0 ? 'with errors' : 'successfully'}`,
        errors: [...errors],
        lastRunTime: startTime
      });

      // Schedule next sync if this was automatic
      if (!isManual) {
        setTimeout(() => this.scheduleNextSync(), 5000);
      }

      // Show toast notification
      if (errors.length === 0) {
        toast({
          title: 'Sync Completed',
          description: `Processed ${processedMatchups} matchups successfully`
        });
      } else {
        toast({
          title: 'Sync Completed with Errors',
          description: `Processed ${processedMatchups} matchups with ${errors.length} errors`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      const errorMsg = `Sync failed: ${error}`;
      errors.push(errorMsg);

      this.updateSyncStatus({
        status: 'failed',
        endTime: new Date(),
        progress: 0,
        currentStep: 'Sync failed',
        errors: [...errors]
      });

      console.error('Sync execution failed:', error);

      toast({
        title: 'Sync Failed',
        description: errorMsg,
        variant: 'destructive'
      });

      // Schedule next sync if this was automatic
      if (!isManual) {
        setTimeout(() => this.scheduleNextSync(), 60000); // Retry in 1 minute
      }
    }
  }

  private async processMatchup(matchup: any, conference: any, season: any): Promise<void> {
    try {
      // Get Sleeper matchup data
      const sleeperMatchups = await SleeperApiService.getMatchups(
        conference.league_id,
        matchup.week
      );

      if (!sleeperMatchups?.length) {
        throw new Error(`No Sleeper matchups found for week ${matchup.week}`);
      }

      // Find the corresponding Sleeper matchup
      const sleeperMatchup = sleeperMatchups.find((sm) =>
      sm.matchup_id === parseInt(matchup.sleeper_matchup_id)
      );

      if (!sleeperMatchup) {
        throw new Error(`Sleeper matchup not found for ID ${matchup.sleeper_matchup_id}`);
      }

      // Get team roster IDs to match scores
      const { data: team1Junction } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'team_id', op: 'Equal', value: matchup.team_1_id },
        { name: 'conference_id', op: 'Equal', value: conference.id }]

      });

      const { data: team2Junction } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'team_id', op: 'Equal', value: matchup.team_2_id },
        { name: 'conference_id', op: 'Equal', value: conference.id }]

      });

      if (!team1Junction?.List?.length || !team2Junction?.List?.length) {
        throw new Error('Could not find team junction records');
      }

      const team1RosterId = team1Junction.List[0].roster_id;
      const team2RosterId = team2Junction.List[0].roster_id;

      // Get scores from Sleeper matchup
      const team1Score = sleeperMatchups.find((sm) =>
      sm.roster_id === parseInt(team1RosterId)
      )?.points || 0;

      const team2Score = sleeperMatchups.find((sm) =>
      sm.roster_id === parseInt(team2RosterId)
      )?.points || 0;

      // Determine winner
      let winnerId = null;
      if (team1Score > team2Score) {
        winnerId = matchup.team_1_id;
      } else if (team2Score > team1Score) {
        winnerId = matchup.team_2_id;
      }

      // Update matchup with final scores
      await window.ezsite.apis.tableUpdate(13329, {
        id: matchup.id,
        team_1_score: team1Score,
        team_2_score: team2Score,
        winner_id: winnerId,
        status: 'complete',
        is_manual_override: false
      });

    } catch (error) {
      throw new Error(`Failed to process matchup ${matchup.id}: ${error}`);
    }
  }

  private async updateTeamRecords(conferenceId: number, seasonId: number): Promise<void> {
    try {
      // Get all completed matchups for this conference and season
      const { data: matchups } = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
        { name: 'conference_id', op: 'Equal', value: conferenceId },
        { name: 'status', op: 'Equal', value: 'complete' }]

      });

      if (!matchups?.List?.length) return;

      // Get all teams in this conference
      const { data: teamJunctions } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 100,
        Filters: [{ name: 'conference_id', op: 'Equal', value: conferenceId }]
      });

      if (!teamJunctions?.List?.length) return;

      // Calculate records for each team
      for (const junction of teamJunctions.List) {
        const teamId = junction.team_id;
        const teamMatchups = matchups.List.filter((m) =>
        m.team_1_id === teamId || m.team_2_id === teamId
        );

        let wins = 0;
        let losses = 0;
        let ties = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;

        for (const matchup of teamMatchups) {
          const isTeam1 = matchup.team_1_id === teamId;
          const teamScore = isTeam1 ? matchup.team_1_score : matchup.team_2_score;
          const opponentScore = isTeam1 ? matchup.team_2_score : matchup.team_1_score;

          pointsFor += teamScore;
          pointsAgainst += opponentScore;

          if (matchup.winner_id === teamId) {
            wins++;
          } else if (matchup.winner_id === null) {
            ties++;
          } else {
            losses++;
          }
        }

        const totalGames = wins + losses + ties;
        const winPercentage = totalGames > 0 ? wins / totalGames : 0;

        // Update or create team record
        const { data: existingRecord } = await window.ezsite.apis.tablePage(13768, {
          PageNo: 1,
          PageSize: 1,
          Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'conference_id', op: 'Equal', value: conferenceId },
          { name: 'season_id', op: 'Equal', value: seasonId }]

        });

        const recordData = {
          team_id: teamId,
          conference_id: conferenceId,
          season_id: seasonId,
          wins,
          losses,
          ties,
          points_for: pointsFor,
          points_against: pointsAgainst,
          win_percentage: winPercentage,
          last_updated: new Date().toISOString()
        };

        if (existingRecord?.List?.length) {
          await window.ezsite.apis.tableUpdate(13768, {
            id: existingRecord.List[0].id,
            ...recordData
          });
        } else {
          await window.ezsite.apis.tableCreate(13768, recordData);
        }
      }

    } catch (error) {
      throw new Error(`Failed to update team records: ${error}`);
    }
  }

  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.notifyStatusListeners();
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.getStatus());
      } catch (error) {
        console.error('Error notifying status listener:', error);
      }
    });
  }

  private notifyHistoryListeners(): void {
    this.historyListeners.forEach((listener) => {
      try {
        listener(this.getHistory());
      } catch (error) {
        console.error('Error notifying history listener:', error);
      }
    });
  }
}

export const weeklyAutoSyncService = new WeeklyAutoSyncService();
export default weeklyAutoSyncService;