import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Filter, Search, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TransactionCard from '@/components/transactions/TransactionCard';
import { ProcessedTransaction } from '@/services/transactionService';
import { DatabaseService } from '@/services/databaseService';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

interface ExtendedProcessedTransaction extends ProcessedTransaction {
  conference?: string;
  conferenceId?: string;
}

interface TransactionFilters {
  team: string;
  player: string;
  type: string;
  conference: string;
}

const TransactionsPage = () => {
  const { toast } = useToast();
  const { selectedConference, currentSeasonConfig, loading: appLoading, error: appError } = useApp();
  
  const [transactions, setTransactions] = useState<ExtendedProcessedTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ExtendedProcessedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    team: 'all',
    player: '',
    type: 'all',
    conference: 'all'
  });

  // Fetch transactions data - following HomePage pattern
  const fetchTransactions = async () => {
    if (!currentSeasonConfig) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
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
        setFilteredTransactions([]);
        return;
      }
      
      // Query transactions table directly (no limit for full transactions page)
      const transactionsResult = await DatabaseService.getTransactions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ],
        orderBy: { column: 'created_at', ascending: false }
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
      
      // Process transactions for display (using exact HomePage logic)
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
        
        // Process added players
        if (parsedData.adds) {
          for (const [sleeperId, rosterId] of Object.entries(parsedData.adds)) {
            const playerName = findPlayerName(sleeperId);
            const addingTeam = getTeamNameFromRosterId(rosterId as string | number);
            addedPlayers.push({ name: playerName, team: addingTeam });
          }
        }
        
        // Process dropped players
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
            added: addedPlayers.map(p => ({ id: '', name: p.name, team: p.team })),
            dropped: droppedPlayers.map(p => ({ id: '', name: p.name, team: p.team }))
          },
          week: (parsedData.leg || 0) as number,
          status: 'completed',
          rosterIds: parsedData.roster_ids || [],
          draftPicks: parsedData.draft_picks || [],
          waiverBudget: parsedData.waiver_budget || [],
          conference: conference?.name || 'Unknown Conference',
          conferenceId: tx.conference_id.toString()
        };
      }));
      
      setTransactions(processedTransactions);
      setFilteredTransactions(processedTransactions);
      
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again.');
      toast({
        title: "Error",
        description: "Failed to load transactions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to transactions
  const applyFilters = () => {
    let filtered = [...transactions];

    // Filter by team
    if (filters.team && filters.team !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.teams.some(team => 
          team.toLowerCase().includes(filters.team.toLowerCase())
        )
      );
    }

    // Filter by player
    if (filters.player) {
      filtered = filtered.filter(transaction => {
        const addedPlayers = transaction.players.added || [];
        const droppedPlayers = transaction.players.dropped || [];
        return [...addedPlayers, ...droppedPlayers].some(player => 
          player.name.toLowerCase().includes(filters.player.toLowerCase())
        );
      });
    }

    // Filter by type
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.type === filters.type
      );
    }

    // Filter by conference
    if (filters.conference && filters.conference !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.conferenceId === filters.conference
      );
    }

    setFilteredTransactions(filtered);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      team: 'all',
      player: '',
      type: 'all',
      conference: 'all'
    });
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Effects
  useEffect(() => {
    fetchTransactions();
  }, [currentSeasonConfig, selectedConference]);

  useEffect(() => {
    applyFilters();
  }, [filters, transactions]);

  // Get unique transaction types for filter
  const getTransactionTypes = () => {
    const types = new Set(transactions.map(t => t.type));
    return Array.from(types).filter(type => type && type.trim() !== '');
  };

  // Get unique teams for filter
  const getTeams = () => {
    const teams = new Set<string>();
    transactions.forEach(t => {
      t.teams.forEach(team => {
        if (team && team.trim() !== '') {
          teams.add(team);
        }
      });
    });
    return Array.from(teams).sort();
  };

  // Show loading if app context is still loading
  if (appLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              All roster moves and trades across conferences
            </p>
          </div>
        </div>
        
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error if app context has an error
  if (appError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              All roster moves and trades across conferences
            </p>
          </div>
        </div>
        
        <Alert variant="destructive">
          <AlertDescription>App Error: {appError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading if currentSeasonConfig is not available
  if (!currentSeasonConfig) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              All roster moves and trades across conferences
            </p>
          </div>
        </div>
        
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              All roster moves and trades across conferences
            </p>
          </div>
        </div>
        
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              All roster moves and trades across conferences
            </p>
          </div>
        </div>
        
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        
        <Button onClick={fetchTransactions} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            All roster moves and trades across conferences
          </p>
        </div>
        <Button onClick={fetchTransactions} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
          <CardDescription>
            Filter transactions by team, player, type, or conference
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Team Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select value={filters.team} onValueChange={(value) => handleFilterChange('team', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {getTeams()
                    .filter(team => team && team.trim() !== '')
                    .map(team => (
                      <SelectItem key={team} value={team}>{team}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Player Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Player</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={filters.player}
                  onChange={(e) => handleFilterChange('player', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {getTransactionTypes()
                    .filter(type => type && type.trim() !== '')
                    .map(type => (
                      <SelectItem key={type} value={type}>
                        {type === 'trade' ? 'Trade' : 
                         type === 'free_agent' ? 'Free Agent' : 
                         type === 'waiver' ? 'Waiver' : 
                         type === 'commissioner' ? 'Commissioner' : type}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Conference Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conference</label>
              <Select value={filters.conference} onValueChange={(value) => handleFilterChange('conference', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All conferences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All conferences</SelectItem>
                  {currentSeasonConfig?.conferences
                    ?.filter(conf => {
                      const value = conf.dbConferenceId?.toString() || conf.id;
                      return value && value.trim() !== '';
                    })
                    .map(conf => {
                      const value = conf.dbConferenceId?.toString() || conf.id;
                      return (
                        <SelectItem 
                          key={value} 
                          value={value}
                        >
                          {conf.name}
                        </SelectItem>
                      );
                    })
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters & Reset */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              {(filters.team !== 'all' || filters.player !== '' || filters.type !== 'all' || filters.conference !== 'all') && (
                <>
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {filters.team !== 'all' && <Badge variant="secondary">Team: {filters.team}</Badge>}
                  {filters.player !== '' && <Badge variant="secondary">Player: {filters.player}</Badge>}
                  {filters.type !== 'all' && <Badge variant="secondary">Type: {filters.type}</Badge>}
                  {filters.conference !== 'all' && (
                    <Badge variant="secondary">
                      Conference: {currentSeasonConfig?.conferences
                        ?.filter(conf => {
                          const value = conf.dbConferenceId?.toString() || conf.id;
                          return value && value.trim() !== '';
                        })
                        .find(c => c.dbConferenceId?.toString() === filters.conference)?.name}
                    </Badge>
                  )}
                </>
              )}
            </div>
            {(filters.team !== 'all' || filters.player !== '' || filters.type !== 'all' || filters.conference !== 'all') && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction, index) => (
            <TransactionCard key={index} transaction={transaction} />
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground">
                {(filters.team !== 'all' || filters.player !== '' || filters.type !== 'all' || filters.conference !== 'all')
                  ? "No transactions match your current filters. Try adjusting your search criteria."
                  : "No transactions available at this time."
                }
              </p>
              {(filters.team !== 'all' || filters.player !== '' || filters.type !== 'all' || filters.conference !== 'all') && (
                <Button variant="outline" onClick={resetFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;
