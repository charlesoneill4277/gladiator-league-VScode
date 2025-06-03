import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLeagueId } from '@/hooks/useConferences';
import MatchupRosterDisplay from './MatchupRosterDisplay';

interface ValidatedMatchupRosterDisplayProps {
  conferenceId: string;
  conferenceName: string;
  week: number;
  matchupId: number;
  seasonYear?: number;
}

/**
 * A wrapper component that validates league ID before rendering MatchupRosterDisplay
 */
const ValidatedMatchupRosterDisplay: React.FC<ValidatedMatchupRosterDisplayProps> = ({
  conferenceId,
  conferenceName,
  week,
  matchupId,
  seasonYear
}) => {
  const { data: leagueId, isLoading, error } = useLeagueId(conferenceId, seasonYear);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading roster data...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load roster data for {conferenceName}: {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Show validation error if no league ID
  if (!leagueId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No league ID found for conference '{conferenceName}' (ID: {conferenceId}). 
          Please check the conference configuration.
        </AlertDescription>
      </Alert>
    );
  }

  // Render the actual component with validated data
  return (
    <MatchupRosterDisplay
      leagueId={leagueId}
      week={week}
      matchupId={matchupId}
      conferenceId={conferenceId}
    />
  );
};

export default ValidatedMatchupRosterDisplay;