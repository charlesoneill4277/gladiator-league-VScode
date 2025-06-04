import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlayerStatus, PlayerStatusData } from '@/hooks/usePlayerStatus';
import { cn } from '@/lib/utils';
import { User, Users, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface PlayerRosterBadgeProps {
  playerId: string;
  className?: string;
  showTeamName?: boolean;
  showFreshnessIndicator?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

// Skeleton loading component
const SkeletonBadge = React.memo(({ size = 'md' }: {size?: 'sm' | 'md' | 'lg';}) => {
  const sizeClasses = {
    sm: 'h-5 w-16',
    md: 'h-6 w-20',
    lg: 'h-7 w-24'
  };

  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size])} />);

});

SkeletonBadge.displayName = 'SkeletonBadge';

// Status indicator dot component
const StatusIndicator = React.memo(({
  freshness,
  isStale



}: {freshness: 'live' | 'recent' | 'cached';isStale: boolean;}) => {
  const getIndicatorColor = () => {
    if (isStale) return 'bg-red-500';
    switch (freshness) {
      case 'live':return 'bg-green-500';
      case 'recent':return 'bg-yellow-500';
      case 'cached':return 'bg-gray-400';
      default:return 'bg-gray-400';
    }
  };

  const getTooltipText = () => {
    if (isStale) return 'Data is stale and needs refresh';
    switch (freshness) {
      case 'live':return 'Live data (updated within 2 minutes)';
      case 'recent':return 'Recent data (updated 2-5 minutes ago)';
      case 'cached':return 'Cached data (older than 5 minutes)';
      default:return 'Data status unknown';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-2 h-2 rounded-full transition-colors duration-200',
              getIndicatorColor(),
              isStale && 'animate-pulse'
            )}
            aria-label={getTooltipText()} />

        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>);

});

StatusIndicator.displayName = 'StatusIndicator';

// Main roster status display component
const RosterStatusDisplay = React.memo(({
  status,
  showTeamName,
  showFreshnessIndicator,
  size,
  onClick






}: {status: PlayerStatusData;showTeamName?: boolean;showFreshnessIndicator?: boolean;size?: 'sm' | 'md' | 'lg';onClick?: () => void;}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const getBadgeVariant = () => {
    if (!status.isRostered) return 'outline';
    return 'default';
  };

  const getBadgeText = () => {
    if (!status.isRostered) return 'Available';
    if (showTeamName && status.teamName) {
      return status.teamName;
    }
    return 'Rostered';
  };

  const getIcon = () => {
    const iconClass = iconSizes[size || 'md'];
    if (!status.isRostered) {
      return <User className={iconClass} />;
    }
    return <Users className={iconClass} />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={getBadgeVariant()}
            className={cn(
              'flex items-center gap-1.5 transition-all duration-200 hover:scale-105',
              sizeClasses[size || 'md'],
              onClick && 'cursor-pointer hover:shadow-md',
              !status.isRostered && 'border-dashed'
            )}
            onClick={onClick}>

            {getIcon()}
            <span className="font-medium">{getBadgeText()}</span>
            {showFreshnessIndicator &&
            <StatusIndicator
              freshness={status.freshness}
              isStale={status.isStale} />

            }
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">
              {status.isRostered ? 'Rostered Player' : 'Available Player'}
            </p>
            {status.teamName &&
            <p className="text-xs text-muted-foreground">
                Team: {status.teamName}
              </p>
            }
            {status.rosterPosition &&
            <p className="text-xs text-muted-foreground">
                Position: {status.rosterPosition}
              </p>
            }
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Updated: {status.lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>);

});

RosterStatusDisplay.displayName = 'RosterStatusDisplay';

// Error state component
const ErrorBadge = React.memo(({
  error,
  onRetry,
  size = 'md'




}: {error: string;onRetry?: () => void;size?: 'sm' | 'md' | 'lg';}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="destructive"
            className={cn(
              'flex items-center gap-1.5',
              sizeClasses[size],
              onRetry && 'cursor-pointer hover:bg-destructive/90'
            )}
            onClick={onRetry}>

            <AlertCircle className={iconSizes[size]} />
            <span>Error</span>
            {onRetry && <RefreshCw className={iconSizes[size]} />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs max-w-xs">{error}</p>
          {onRetry &&
          <p className="text-xs text-muted-foreground mt-1">
              Click to retry
            </p>
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>);

});

ErrorBadge.displayName = 'ErrorBadge';

// Main PlayerRosterBadge component
const PlayerRosterBadge = React.memo<PlayerRosterBadgeProps>(({
  playerId,
  className,
  showTeamName = false,
  showFreshnessIndicator = true,
  size = 'md',
  onClick
}) => {
  const {
    data: rosterStatus,
    isLoading,
    error,
    refreshStatus
  } = usePlayerStatus(playerId, {
    enableAutoRefresh: true,
    staleTolerance: 5
  });

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('inline-flex', className)}>
        <SkeletonBadge size={size} />
      </div>);

  }

  // Handle error state
  if (error) {
    return (
      <div className={cn('inline-flex', className)}>
        <ErrorBadge
          error={typeof error === 'string' ? error : 'Failed to load player status'}
          onRetry={refreshStatus}
          size={size} />

      </div>);

  }

  // Handle success state
  if (rosterStatus) {
    return (
      <div className={cn('inline-flex', className)}>
        <RosterStatusDisplay
          status={rosterStatus}
          showTeamName={showTeamName}
          showFreshnessIndicator={showFreshnessIndicator}
          size={size}
          onClick={onClick} />

      </div>);

  }

  // Fallback state
  return (
    <div className={cn('inline-flex', className)}>
      <Badge variant="outline" className="text-muted-foreground">
        <User className="w-4 h-4 mr-1" />
        Unknown
      </Badge>
    </div>);

});

PlayerRosterBadge.displayName = 'PlayerRosterBadge';

export default PlayerRosterBadge;

// Additional utility components for batch operations
export const PlayerRosterBadgeList = React.memo<{
  playerIds: string[];
  className?: string;
  showTeamNames?: boolean;
  onPlayerClick?: (playerId: string) => void;
}>(({ playerIds, className, showTeamNames, onPlayerClick }) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {playerIds.map((playerId) =>
      <PlayerRosterBadge
        key={playerId}
        playerId={playerId}
        showTeamName={showTeamNames}
        onClick={() => onPlayerClick?.(playerId)} />

      )}
    </div>);

});

PlayerRosterBadgeList.displayName = 'PlayerRosterBadgeList';