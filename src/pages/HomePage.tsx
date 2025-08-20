import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from "@/components/ui/separator";
import { useApp } from '@/contexts/AppContext';
import { useStandingsData } from '@/hooks/useStandingsData';
import { StandingsService } from '@/services/standingsService';
import { SleeperApiService } from '@/services/sleeperApi';
import { MatchupService, OrganizedMatchup } from '@/services/matchupService';
import { ProcessedTransaction } from '@/services/transactionService';
import { DatabaseService } from '@/services/databaseService';
import { ConferenceBadge } from '@/components/ui/conference-badge';
import {
  Shield,
  Trophy,
  Swords,
  Users,
  TrendingUp,
  Calendar,
  ArrowRight,
  Activity,
  Star,
  Loader2,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';

const HomePage: React.FC = () => {
  // --- ALL HOOKS AT THE TOP LEVEL ---
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [matchups, setMatchups] = useState<OrganizedMatchup[]>([]);
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [matchupsLoading, setMatchupsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [matchupsError, setMatchupsError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  
  const { 
    selectedSeason,
    selectedConference, 
    currentSeasonConfig, 
    seasonConfigs, 
    loading: appLoading, 
    error: appError,
    refreshSeasonData 
  } = useApp();

  // Get the current season year from the season configuration (may be undefined initially)
  const currentSeasonYear = currentSeasonConfig?.year;

  // Fetch live standings data - MOVED TO TOP LEVEL
  const {
    standings,
    loading: standingsLoading,
    error: standingsError,
    refetch: refetchStandings
  } = useStandingsData({
    seasonYear: currentSeasonConfig?.seasonId ? 
      (typeof currentSeasonConfig.seasonId === 'string' ? parseInt(currentSeasonConfig.seasonId) : currentSeasonConfig.seasonId) : 
      undefined, // Convert seasonId to number
    conferenceId: (selectedConference === 'all' || selectedConference === null) ? undefined : currentSeasonConfig?.conferences.find(c => c.id === selectedConference)?.dbConferenceId,
    limit: 12,
    autoRefresh: true,
    refreshInterval: 60000 // Refresh every minute
  });

  // Load current week from Sleeper API
  useEffect(() => {
    const loadCurrentWeek = async () => {
      try {
        const week = await SleeperApiService.getCurrentNFLWeek();
        setCurrentWeek(week); // getCurrentNFLWeek now handles all edge cases including preseason
      } catch (error) {
        console.error('Error loading current week:', error);
        // Keep default week 1 if API fails
        setCurrentWeek(1);
      }
    };
    
    loadCurrentWeek();
  }, []);

  // Simplified matchups loading for homepage
  const loadSimpleMatchups = async (conferences: any[], week: number) => {
    const allMatchups = [];
    
    for (const conference of conferences) {
      if (!conference.dbConferenceId) continue;
      
      // Get matchups for this conference and week
      const matchupsResult = await DatabaseService.getMatchups({
        filters: [
          { column: 'conference_id', operator: 'eq', value: conference.dbConferenceId },
          { column: 'week', operator: 'eq', value: week }
        ]
      });
      
      if (matchupsResult.error || !matchupsResult.data) continue;
      
      // Get all teams to create a lookup map
      const teamsResult = await DatabaseService.getTeams({});
      
      if (teamsResult.error || !teamsResult.data) continue;
      
      // Create team lookup map
      const teamLookup = new Map();
      teamsResult.data.forEach(team => {
        teamLookup.set(team.id, team.team_name);
      });
      
      // Process matchups
      for (const matchup of matchupsResult.data) {
        const team1Name = teamLookup.get(matchup.team1_id) || 'Unknown Team';
        const team2Name = teamLookup.get(matchup.team2_id) || 'Unknown Team';
        
        allMatchups.push({
          matchup_id: matchup.id,
          conference: {
            conference_name: conference.name,
            league_id: conference.leagueId
          },
          teams: [
            {
              team: { team_name: team1Name },
              points: matchup.team1_score || 0
            },
            {
              team: { team_name: team2Name },
              points: matchup.team2_score || 0
            }
          ],
          status: matchup.team1_score && matchup.team2_score ? 'completed' : 'upcoming'
        });
      }
    }
    
    return allMatchups;
  };

  // Load matchups for current week
  const loadMatchups = async () => {
    if (!currentSeasonConfig || currentWeek === 0) return;
    
    setMatchupsLoading(true);
    setMatchupsError(null);
    
    try {
      // Get conferences based on filter
      const conferences = (selectedConference === 'all' || selectedConference === null) 
        ? currentSeasonConfig.conferences 
        : currentSeasonConfig.conferences.filter(c => c.id === selectedConference);
      
      // Use simplified matchups loading for homepage
      const matchups = await loadSimpleMatchups(conferences, currentWeek);
      setMatchups(matchups);
    } catch (error) {
      console.error('Error loading matchups:', error);
      setMatchupsError(error instanceof Error ? error.message : 'Failed to load matchups');
    } finally {
      setMatchupsLoading(false);
    }
  };

  useEffect(() => {
    loadMatchups();
  }, [currentWeek, selectedConference, currentSeasonConfig]);

  // Load recent transactions with enhanced data
  const loadTransactions = async () => {
    if (!currentSeasonConfig) return;
    
    setTransactionsLoading(true);
    setTransactionsError(null);
    
    try {
      // Get conferences based on filter
      const conferences = (selectedConference === 'all' || selectedConference === null) 
        ? currentSeasonConfig.conferences 
        : currentSeasonConfig.conferences.filter(c => c.id === selectedConference);
      
      // Get conference IDs for filtering
      const conferenceIds = conferences
        .filter(conf => conf.dbConferenceId)
        .map(conf => conf.dbConferenceId);
      
      if (conferenceIds.length === 0) {
        setTransactions([]);
        return;
      }
      
      // Query transactions table directly
      const transactionsResult = await DatabaseService.getTransactions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ],
        orderBy: { column: 'created_at', ascending: false },
        limit: 10 // Get top 10 most recent
      });
      
      if (transactionsResult.error || !transactionsResult.data) {
        throw new Error(transactionsResult.error || 'Failed to fetch transactions');
      }
      
      // Get all teams for team lookup
      const teamsResult = await DatabaseService.getTeams({});
      
      // Get team-conference junctions for roster_id to team mapping
      const junctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ]
      });
      
      // Fetch ALL players for transaction mapping
      const allPlayers = await DatabaseService.getAllPlayersForMapping([
        { column: 'playing_status', operator: 'eq', value: 'Active' },
        { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE'] }
      ]);

      // Create player lookup map
      const playerLookup = new Map<string, string>();
      allPlayers.forEach(player => {
        if (player.sleeper_id) {
          playerLookup.set(String(player.sleeper_id), player.player_name);
        }
      });
      
      // Process transactions for display
      const processedTransactions = await Promise.all(transactionsResult.data.map(async (tx) => {
        let parsedData: any = {};
        try {
          parsedData = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data || {};
        } catch (e) {
          console.warn('Failed to parse transaction data:', e);
        }
        
        // Find the conference name
        const conference = conferences.find(c => c.dbConferenceId === tx.conference_id);
        
        // Create a helper function to get team name from roster_id and conference_id
        const getTeamNameFromRosterId = (rosterId: number | string): string => {
          // Find the team_conference_junction record for this roster_id and conference_id
          const junction = junctionResult.data?.find(j => 
            j.roster_id.toString() === rosterId.toString() && 
            j.conference_id === tx.conference_id
          );
          
          if (junction && teamsResult.data) {
            const team = teamsResult.data.find(t => t.id === junction.team_id);
            return team?.team_name || 'Unknown Team';
          }
          
          return 'Unknown Team';
        };
        
        // Get the primary team name from the first roster_id involved
        let primaryTeamName = 'Unknown Team';
        if (parsedData.roster_ids && parsedData.roster_ids.length > 0) {
          primaryTeamName = getTeamNameFromRosterId(parsedData.roster_ids[0]);
        }
        
        // Process added and dropped players with their respective teams
        const addedPlayers = [];
        const droppedPlayers = [];
        
        // Player lookup function
        const findPlayerName = (sleeperId: string | number): string => {
          const idAsString = String(sleeperId);
          return playerLookup.get(idAsString) || `Player ${idAsString}`;
        };
        
        // Process added players - adds: { "sleeper_id": roster_id, ... }
        if (parsedData.adds) {
          for (const [sleeperId, rosterId] of Object.entries(parsedData.adds)) {
            const playerName = findPlayerName(sleeperId);
            const addingTeam = getTeamNameFromRosterId(rosterId as string | number);
            // Extract waiver bid amount for this player if it's a waiver transaction
            const bidAmount = parsedData.settings && parsedData.settings.waiver_bid && parsedData.settings.waiver_bid[sleeperId];
            addedPlayers.push({ 
              name: playerName, 
              team: addingTeam,
              bidAmount: bidAmount || null
            });
          }
        }
        
        // Process dropped players - drops: { "sleeper_id": roster_id, ... }
        if (parsedData.drops) {
          for (const [sleeperId, rosterId] of Object.entries(parsedData.drops)) {
            const playerName = findPlayerName(sleeperId);
            const droppingTeam = getTeamNameFromRosterId(rosterId as string | number);
            droppedPlayers.push({ name: playerName, team: droppingTeam });
          }
        }
        
        // Generate transaction description based on type and involved teams
        let transactionDescription = '';
        const transactionType = parsedData.type || tx.type;
        
        // Get all teams involved in the transaction
        const involvedTeams = new Set();
        if (parsedData.roster_ids) {
          parsedData.roster_ids.forEach(rosterId => {
            const teamName = getTeamNameFromRosterId(rosterId);
            if (teamName !== 'Unknown Team') {
              involvedTeams.add(teamName);
            }
          });
        }
        
        switch (transactionType) {
          case 'trade':
            if (addedPlayers.length > 0 || droppedPlayers.length > 0) {
              const playerMoves = [];
              addedPlayers.forEach(p => playerMoves.push(`${p.name} to ${p.team}`));
              droppedPlayers.forEach(p => playerMoves.push(`${p.name} from ${p.team}`));
              
              if (involvedTeams.size > 1) {
                transactionDescription = `Trade between ${Array.from(involvedTeams).join(' and ')}: ${playerMoves.join(', ')}`;
              } else {
                transactionDescription = `${primaryTeamName} trade: ${playerMoves.join(', ')}`;
              }
            } else if (parsedData.draft_picks && parsedData.draft_picks.length > 0) {
              const picks = parsedData.draft_picks.map(pick => 
                `${pick.season} Round ${pick.round} pick`
              );
              transactionDescription = `Trade involving ${picks.join(', ')}`;
            } else {
              transactionDescription = `Trade between ${Array.from(involvedTeams).join(' and ')}`;
            }
            break;
          
          case 'waiver':
            if (addedPlayers.length > 0 && droppedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} claimed ${addedPlayers.map(p => p.name).join(', ')} from waivers, dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
            } else if (addedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} claimed ${addedPlayers.map(p => p.name).join(', ')} from waivers`;
            } else if (droppedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} dropped ${droppedPlayers.map(p => p.name).join(', ')} to waivers`;
            } else {
              transactionDescription = `${primaryTeamName} made a waiver claim`;
            }
            break;
          
          case 'free_agent':
            if (addedPlayers.length > 0 && droppedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} added ${addedPlayers.map(p => p.name).join(', ')}, dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
            } else if (addedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} added ${addedPlayers.map(p => p.name).join(', ')} from free agency`;
            } else if (droppedPlayers.length > 0) {
              transactionDescription = `${primaryTeamName} dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
            } else {
              transactionDescription = `${primaryTeamName} made a free agent transaction`;
            }
            break;
          
          default:
            transactionDescription = `${primaryTeamName} completed a ${transactionType || 'transaction'}`;
        }
        
        // Map database transaction type to ProcessedTransaction type
        const mappedType = parsedData.type === 'trade' ? 'trade' : 
                          parsedData.type === 'waiver' ? 'waiver' : 
                          parsedData.type === 'free_agent' ? 'free_agent' : 
                          'commissioner';
        
        return {
          id: tx.id.toString(),
          type: mappedType as 'trade' | 'free_agent' | 'waiver' | 'commissioner',
          date: new Date(tx.created_at || new Date()),
          details: transactionDescription,
          teams: [primaryTeamName],
          players: {
            added: addedPlayers.map(p => ({ id: '', name: p.name, team: p.team, bidAmount: p.bidAmount })),
            dropped: droppedPlayers.map(p => ({ id: '', name: p.name, team: p.team }))
          },
          week: (parsedData.leg || 0) as number,
          status: 'completed',
          rosterIds: parsedData.roster_ids || [],
          draftPicks: parsedData.draft_picks || [],
          waiverBudget: parsedData.waiver_budget || []
        };
      }));
      
      setTransactions(processedTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactionsError(error instanceof Error ? error.message : 'Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedConference, currentSeasonConfig]);



  // --- CONDITIONAL RETURNS AFTER ALL HOOKS ---
  // Show loading state while app context loads
  if (appLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Gladiator League</h2>
          <p className="text-muted-foreground">Connecting to Supabase database...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (appError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{appError}</AlertDescription>
            </Alert>
            <Button onClick={refreshSeasonData} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render if seasonConfigs is not loaded yet or is empty
  if (!seasonConfigs || seasonConfigs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Season Configuration</h2>
          <p className="text-muted-foreground">Setting up league data...</p>
        </div>
      </div>
    );
  }

  // Don't render if currentSeasonConfig has no conferences
  if (!currentSeasonConfig || !currentSeasonConfig.conferences || currentSeasonConfig.conferences.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Conferences</h2>
          <p className="text-muted-foreground">Setting up conference data...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600 text-xs">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-xs">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" className="text-xs">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'trade': return '🔄';
      case 'waiver': return '⚡';
      case 'free_agent': return '🆓';
      case 'commissioner': return '⚖️';
      default: return '📝';
    }
  };

  const renderStandings = () => {
    if (standingsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading standings...</span>
        </div>
      );
    }

    if (standingsError) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-red-600 mb-4">Error loading standings: {standingsError}</p>
          <Button variant="outline" size="sm" onClick={refetchStandings}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!standings || standings.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-muted-foreground">No standings data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {standings.map((team) => (
          <div key={team.team_id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center space-x-1 w-8">
                {team.overall_rank === 1 && <Star className="h-4 w-4 text-yellow-500" />}
                <span className="font-semibold">#{team.overall_rank}</span>
              </div>
              <div>
                <p className="font-medium">{team.team_name}</p>
                <p className="text-xs text-muted-foreground">{team.owner_name} • {team.conference_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">{StandingsService.formatRecord(team.wins, team.losses, team.ties)}</p>
              <p className="text-xs text-muted-foreground">{StandingsService.formatPoints(team.points_for)} pts</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMatchups = () => {
    if (matchupsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading matchups...</span>
        </div>
      );
    }

    if (matchupsError) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-red-600 mb-4">Error loading matchups: {matchupsError}</p>
          <Button variant="outline" size="sm" onClick={loadMatchups}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!matchups || matchups.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-muted-foreground">No matchups found for week {currentWeek}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {matchups.map((matchup) => {
          // Determine winning team (same logic as MatchupsPage)
          const team1 = matchup.teams[0];
          const team2 = matchup.teams[1];
          const winningTeam = matchup.status === 'completed' 
            ? (team1?.points > (team2?.points || 0) ? team1 : team2)
            : null;

          return (
            <Link key={matchup.matchup_id} to={`/matchups/${matchup.matchup_id}`}>
              <div className="p-2 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <ConferenceBadge conferenceName={matchup.conference.conference_name} variant="outline" size="sm" />
                  {getStatusBadge(matchup.status)}
                </div>
                <div className="grid grid-cols-5 gap-2 items-center text-sm">
                  {/* Team 1 Name */}
                  <div className="text-right">
                    <p className="font-medium truncate text-xs">{team1?.team?.team_name || 'Team 1'}</p>
                  </div>
                  
                  {/* Team 1 Score */}
                  <div className="text-right">
                    <p className={`text-sm font-bold ${winningTeam === team1 ? 'text-green-600' : ''}`}>
                      {matchup.status === 'upcoming' ? '--' : team1?.points.toFixed(1)}
                    </p>
                  </div>

                  {/* VS Divider */}
                  <div className="text-center text-muted-foreground font-semibold text-xs">
                    VS
                  </div>

                  {/* Team 2 Score */}
                  <div className="text-left">
                    <p className={`text-sm font-bold ${winningTeam === team2 ? 'text-green-600' : ''}`}>
                      {matchup.status === 'upcoming' ? '--' : team2?.points.toFixed(1)}
                    </p>
                  </div>

                  {/* Team 2 Name */}
                  <div className="text-left">
                    <p className="font-medium truncate text-xs">{team2?.team?.team_name || 'Team 2'}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderTransactions = () => {
    if (transactionsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading transactions...</span>
        </div>
      );
    }

    if (transactionsError) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-red-600 mb-4">Error loading transactions: {transactionsError}</p>
          <Button variant="outline" size="sm" onClick={loadTransactions}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!transactions || transactions.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-muted-foreground">No recent transactions found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="text-base">{getTransactionIcon(transaction.type)}</div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {transaction.type.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Week {transaction.week}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {transaction.date.toLocaleDateString()}
              </span>
            </div>
            
            <div className="space-y-2">
              {(transaction.players.added.length > 0 || transaction.players.dropped.length > 0) && (
                <div className="space-y-2">
                  {transaction.players.added.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          +{transaction.players.added.length}
                        </Badge>
                        <span className="text-xs font-medium text-green-700">Added</span>
                      </div>
                      <div className="ml-1 space-y-1">
                        {transaction.players.added.map((player, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{player.name}</span>
                            <div className="flex items-center space-x-1">
                              {player.bidAmount && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                  ${player.bidAmount}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {player.team}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {transaction.players.dropped.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                          -{transaction.players.dropped.length}
                        </Badge>
                        <span className="text-xs font-medium text-red-700">Dropped</span>
                      </div>
                      <div className="ml-1 space-y-1">
                        {transaction.players.dropped.map((player, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{player.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {player.team}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative px-6 py-12 sm:px-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/gladiator-logo.png" 
                alt="Gladiator League Logo" 
                className="h-12 w-12" 
              />
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Gladiator League</h1>
                <p className="text-lg text-muted-foreground">Fantasy Football Championship</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Welcome to the ultimate fantasy football experience. Track your teams across three 
              competitive conferences in real-time.
            </p>
            <div className="flex items-center space-x-2 mt-4">
              <Badge variant="outline">{selectedSeason} Season</Badge>
              <Badge variant="outline">Week {currentWeek}</Badge>
              {selectedConference !== 'all' && currentSeasonConfig && (
                <Badge variant="secondary">
                  {currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard - Two Column Flexbox Layout */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* === Left Column (2/3 width) === */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          
          {/* Current Matchups */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Swords className="h-5 w-5 text-primary" />
                  <CardTitle>Week {currentWeek}</CardTitle>
                </div>
                <Link to="/matchups">
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription>Current matchups</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMatchups()}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle>Recent Transactions</CardTitle>
                </div>
                <Link to="/transactions">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Latest roster moves across all conferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderTransactions()}
            </CardContent>
          </Card>

        </div>

        {/* === Right Column (1/3 width) === */}
        <div className="lg:w-1/3 flex flex-col gap-6">

          {/* Current Standings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <CardTitle>League Standings</CardTitle>
                </div>
                <Link to="/standings">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Top 12 teams across all conferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderStandings()}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Quick Actions</span>
              </CardTitle>
              <CardDescription>
                Navigate to key sections of the league
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/standings">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Trophy className="h-5 w-5" />
                    <span className="text-xs">Standings</span>
                  </Button>
                </Link>
                
                <Link to="/matchups">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Swords className="h-5 w-5" />
                    <span className="text-xs">Matchups</span>
                  </Button>
                </Link>
                
                <Link to="/teams">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Users className="h-5 w-5" />
                    <span className="text-xs">Teams</span>
                  </Button>
                </Link>
                
                <Link to="/players">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Activity className="h-5 w-5" />
                    <span className="text-xs">Players</span>
                  </Button>
                </Link>
                
                <Link to="/draft">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Shield className="h-5 w-5" />
                    <span className="text-xs">Draft Results</span>
                  </Button>
                </Link>
                
                <Link to="/rules">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                    <Calendar className="h-5 w-5" />
                    <span className="text-xs">League Rules</span>
                  </Button>
                </Link>
              </div>

              {/* ======== START: NEW LEAGUE PAGES SECTION ======== */}
              {currentSeasonConfig?.conferences && currentSeasonConfig.conferences.length > 0 && (
                <div className="mt-4">
                  <Separator className="my-3" />
                  <div className="flex items-center space-x-2 mb-3">
                    <LinkIcon className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-semibold">League Pages</h3>
                  </div>
                  <div className="flex flex-col space-y-2">
                    {currentSeasonConfig.conferences.map((conf) => (
                      <a
                        key={conf.leagueId}
                        href={`https://sleeper.com/leagues/${conf.leagueId}/league`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" className="w-full justify-start">
                          {conf.name}
                        </Button>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {/* ======== END: NEW LEAGUE PAGES SECTION ======== */}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* League Information */}
      <Card>
        <CardHeader>
          <CardTitle>League Information</CardTitle>
          <CardDescription>
            Current season details and conference structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {currentSeasonConfig?.conferences.map((conference) => (
              <div key={conference.id} className="text-center p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{conference.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  12 teams • 12-week season
                </p>
                <Badge variant="outline" className="text-xs">
                  {conference.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;