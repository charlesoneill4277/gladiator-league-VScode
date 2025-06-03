import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { MatchupService, TeamRosterData } from '@/services/matchupService';
import TeamRosterCard from './TeamRosterCard';

interface MatchupRosterDisplayProps {
  leagueId: string;
  week: number;
  matchupId?: number;
  conferenceId?: number;
}

const MatchupRosterDisplay: React.FC<MatchupRosterDisplayProps> = ({
  leagueId,
  week,
  matchupId,
  conferenceId
}) => {
  const [teamRosters, setTeamRosters] = useState<TeamRosterData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRosterData = async () => {
    if (!leagueId || !week) {
      setError('League ID and week are required');
      return;
    }

    if (!leagueId.trim()) {
      setError('No league ID found for this conference');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching roster data for:', { leagueId, week, matchupId, conferenceId });

      const rosterData = await MatchupService.processMatchupData(leagueId, week, matchupId);

      console.log('Fetched roster data:', rosterData);
      setTeamRosters(rosterData);

      if (rosterData.length === 0) {
        setError('No roster data found for this matchup. Teams may not be properly configured.');
      }
    } catch (error) {
      console.error('Error fetching roster data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load roster data';
      setError(errorMessage);
      toast({
        title: "Error Loading Roster Data",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterData();
  }, [leagueId, week, matchupId]);

  const handleRetry = () => {
    fetchRosterData();
  };

  if (loading && teamRosters.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamRosterCard
          teamData={{
            teamId: 0,
            teamName: 'Loading...',
            ownerName: 'Loading...',
            totalPoints: 0,
            starters: [],
            bench: []
          }}
          isLoading={true} />

        <TeamRosterCard
          teamData={{
            teamId: 0,
            teamName: 'Loading...',
            ownerName: 'Loading...',
            totalPoints: 0,
            starters: [],
            bench: []
          }}
          isLoading={true} />

      </div>);

  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={loading}
            className="ml-4">

            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </AlertDescription>
      </Alert>);

  }

  if (teamRosters.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No roster data available for this matchup. The teams may not be set up correctly or the Sleeper API data may not be available.
        </AlertDescription>
      </Alert>);

  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={loading}>

          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh Rosters
        </Button>
      </div>

      {/* Team Rosters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teamRosters.map((teamData) =>
        <TeamRosterCard
          key={teamData.teamId}
          teamData={teamData}
          isLoading={loading} />

        )}
      </div>

      {/* Points Comparison */}
      {teamRosters.length === 2 &&
      <div className="mt-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <h4 className="font-medium mb-2">Matchup Summary</h4>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-right">
                <div className="font-bold text-lg">{teamRosters[0].totalPoints.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{teamRosters[0].teamName}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-muted-foreground">VS</div>
                <div className="text-xs text-muted-foreground">
                  {Math.abs(teamRosters[0].totalPoints - teamRosters[1].totalPoints).toFixed(1)} pt spread
                </div>
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">{teamRosters[1].totalPoints.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{teamRosters[1].teamName}</div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default MatchupRosterDisplay;