import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Trophy, TrendingUp, Calendar, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { useApp } from '@/contexts/AppContext';
import { getConferenceBadgeClasses } from '@/utils/conferenceColors';
import SleeperApiService, { type SleeperRoster, type SleeperPlayer, type OrganizedRoster } from '../services/sleeperApi';
import { type ProcessedTransaction } from '../services/transactionService';
import TransactionCard from '../components/transactions/TransactionCard';

interface TeamData {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name?: string;
  co_owner_id?: string;
  team_logo_url?: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface ConferenceData {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url?: string;
}

interface ScheduleMatchup {
  week: string;
  opponent: string;
  isHome: boolean;
  result: 'W' | 'L' | 'T' | 'TBD';
  teamScore: number | null;
  opponentScore: number | null;
  isPlayoff: boolean;
  isOverridden: boolean;
  overrideReason: string | null;
  matchupStatus: string;
  playoffRoundName: string | null;
}

interface TeamRosterData {
  roster: SleeperRoster;
  organizedRoster: OrganizedRoster;
  allPlayers: Record<string, SleeperPlayer>;
  teamData: TeamData;
  conferenceData: ConferenceData;
}

interface TeamRecord {
  id: number;
  team_id: number;
  conference_id: number;
  season_id: number;
  wins: number;
  losses: number;
  ties?: number; // May not be in all records
  points_for: number;
  points_against: number;
  point_diff: number;
  streak?: string;
  rank?: number; // Conference rank
  leagueRankPointsFor?: number; // League-wide rank for points for
  leagueRankPointsAgainst?: number; // League-wide rank for points against
  leagueRankPointDiff?: number; // League-wide rank for point differential
}

const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string; }>();
  const { selectedSeason, currentSeasonConfig } = useApp();
  const [activeTab, setActiveTab] = useState('roster');
  const [teamRosterData, setTeamRosterData] = useState<TeamRosterData | null>(null);
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleMatchup[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [teamRecord, setTeamRecord] = useState<TeamRecord | null>(null);
  const [seasonWaiverData, setSeasonWaiverData] = useState<{ position: number; budget: number } | null>(null);
  const [seasonTransactionCount, setSeasonTransactionCount] = useState<number>(0);
  const [headerStats, setHeaderStats] = useState<{
    wins: number;
    losses: number;
    pointsFor: number;
    gamesPlayed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (teamId && currentSeasonConfig) {
      fetchTeamData(parseInt(teamId));
    }
  }, [teamId, currentSeasonConfig]);

  useEffect(() => {
    if (activeTab === 'transactions' && teamRosterData && transactions.length === 0) {
      fetchTransactions();
    }
  }, [activeTab, teamRosterData]);

  useEffect(() => {
    if (activeTab === 'schedule' && teamRosterData && schedule.length === 0) {
      fetchSchedule();
    }
  }, [activeTab, teamRosterData, selectedSeason]);

  useEffect(() => {
    if ((activeTab === 'schedule' || activeTab === 'performance') && teamRosterData && !teamRecord) {
      fetchTeamRecord();
    }
  }, [activeTab, teamRosterData, selectedSeason]);

  useEffect(() => {
    if (activeTab === 'performance' && teamRosterData && !seasonWaiverData) {
      fetchSeasonWaiverData();
    }
  }, [activeTab, teamRosterData, selectedSeason]);

  useEffect(() => {
    if (activeTab === 'performance' && teamRosterData && seasonTransactionCount === 0) {
      fetchSeasonTransactionCount();
    }
  }, [activeTab, teamRosterData, selectedSeason]);

  useEffect(() => {
    if (teamRosterData && !headerStats) {
      fetchHeaderStats();
    }
  }, [teamRosterData, selectedSeason]);

  // Clear schedule and team record when season changes
  useEffect(() => {
    if (schedule.length > 0) {
      setSchedule([]);
    }
    if (teamRecord) {
      setTeamRecord(null);
    }
  }, [selectedSeason]);

  // Clear season-specific data when season changes
  useEffect(() => {
    setSeasonWaiverData(null);
    setSeasonTransactionCount(0);
    setHeaderStats(null);
  }, [selectedSeason]);

  const fetchTeamData = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching data for team ID: ${id}`);

      // Fetch team data from Supabase
      const teamsResult = await DatabaseService.getTeams({
        filters: [{ column: 'id', operator: 'eq', value: id }]
      });

      if (teamsResult.error || !teamsResult.data || teamsResult.data.length === 0) {
        throw new Error('Team not found');
      }

      const teamData = teamsResult.data[0] as TeamData;
      console.log('Team data:', teamData);

      // Find ALL conferences this team belongs to (across all seasons)
      const junctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [{ column: 'team_id', operator: 'eq', value: id }]
      });

      if (junctionResult.error || !junctionResult.data || junctionResult.data.length === 0) {
        throw new Error('Team conference mapping not found');
      }

      // For now, use the first junction for display purposes (current season)
      // But we'll use all junctions for transaction fetching
      const junction = junctionResult.data[0];
      const rosterId = junction.roster_id;
      console.log('Junction data:', junction, 'Roster ID:', rosterId);
      console.log('All junctions for this team:', junctionResult.data);

      // Get conference data for display (use first conference)
      const conferencesResult = await DatabaseService.getConferences({
        filters: [{ column: 'id', operator: 'eq', value: junction.conference_id }]
      });

      if (conferencesResult.error || !conferencesResult.data || conferencesResult.data.length === 0) {
        throw new Error('Conference not found');
      }

      const conferenceData = conferencesResult.data[0] as ConferenceData;
      console.log('Conference data:', conferenceData);

      // Fetch roster data from Sleeper API
      console.log(`Fetching Sleeper data for league ${conferenceData.league_id}, roster ${rosterId}`);
      const sleeperData = await SleeperApiService.getTeamRosterData(
        conferenceData.league_id,
        rosterId
      );

      setTeamRosterData({
        ...sleeperData,
        teamData,
        conferenceData
      });

      console.log('Successfully loaded team roster data');

    } catch (error) {
      console.error('Error fetching team data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load team data';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!teamRosterData) return;

    try {
      setTransactionsLoading(true);
      console.log(`Fetching transactions for team ${teamRosterData.teamData.team_name} across all conferences`);

      // Get ALL conferences this team belongs to across all seasons
      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [{ column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data || teamJunctionResult.data.length === 0) {
        throw new Error('Team conference mappings not found');
      }

      // Get all conference IDs this team participates in
      const teamConferenceIds = teamJunctionResult.data.map(junction => junction.conference_id);
      console.log(`Team participates in conferences: ${teamConferenceIds.join(', ')}`);

      // Query transactions table for ALL conferences this team participates in
      const transactionsResult = await DatabaseService.getTransactions({
        filters: [
          { column: 'conference_id', operator: 'in', value: teamConferenceIds }
        ],
        orderBy: { column: 'created_at', ascending: false }
      });

      if (transactionsResult.error || !transactionsResult.data) {
        throw new Error(transactionsResult.error || 'Failed to fetch transactions');
      }

      // Get all teams for team lookup
      const teamsResult = await DatabaseService.getTeams({});

      // Get ALL team-conference junctions for roster_id to team mapping across all conferences
      const allJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'conference_id', operator: 'in', value: teamConferenceIds }
        ]
      });

      // Fetch ALL players for transaction mapping
      const allPlayers = await DatabaseService.getAllPlayersForMapping();

      // Create player lookup map
      const playerLookup = new Map<string, string>();
      allPlayers.forEach(player => {
        if (player.sleeper_id) {
          playerLookup.set(String(player.sleeper_id), player.player_name);
        }
      });

      // Process transactions and filter for this team across all conferences
      const processedTransactions = await Promise.all(
        transactionsResult.data
          .map(async (tx) => {
            let parsedData: any = {};
            try {
              parsedData = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data || {};
            } catch (e) {
              console.warn('Failed to parse transaction data:', e);
            }

            // FIXED: Check if this transaction involves our team using BOTH roster_id AND conference_id
            const ourTeamId = teamRosterData.teamData.id;
            const transactionConferenceId = tx.conference_id;
            const transactionRosterIds = parsedData.roster_ids || [];

            // Find our team's roster_id in the specific conference of this transaction
            const ourJunctionInThisConference = teamJunctionResult.data?.find(j =>
              j.team_id === ourTeamId &&
              j.conference_id === transactionConferenceId
            );

            // If we don't have a junction record for this team in this conference, skip
            if (!ourJunctionInThisConference) {
              return null;
            }

            // Only process transactions that involve our team's roster_id in this specific conference
            if (!transactionRosterIds.includes(ourJunctionInThisConference.roster_id)) {
              return null;
            }

            // Create a helper function to get team name from roster_id and conference_id
            const getTeamNameFromRosterId = (rosterId: number | string): string => {
              const junction = allJunctionResult.data?.find(j =>
                j.roster_id.toString() === rosterId.toString() &&
                j.conference_id === tx.conference_id
              );

              if (junction && teamsResult.data) {
                const team = teamsResult.data.find(t => t.id === junction.team_id);
                return team?.team_name || 'Unknown Team';
              }

              return 'Unknown Team';
            };

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
                addedPlayers.push({ name: playerName, team: addingTeam });
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

            // Get the primary team name (our team)
            const primaryTeamName = teamRosterData.teamData.team_name;

            // Get conference name for context
            const conferenceInfo = await DatabaseService.getConferences({
              filters: [{ column: 'id', operator: 'eq', value: tx.conference_id }]
            });
            const conferenceName = conferenceInfo.data?.[0]?.conference_name || 'Unknown Conference';

            switch (transactionType) {
              case 'trade':
                if (addedPlayers.length > 0 || droppedPlayers.length > 0) {
                  const playerMoves = [];
                  addedPlayers.forEach(p => playerMoves.push(`${p.name} to ${p.team}`));
                  droppedPlayers.forEach(p => playerMoves.push(`${p.name} from ${p.team}`));

                  if (involvedTeams.size > 1) {
                    transactionDescription = `[${conferenceName}] Trade between ${Array.from(involvedTeams).join(' and ')}: ${playerMoves.join(', ')}`;
                  } else {
                    transactionDescription = `[${conferenceName}] ${primaryTeamName} trade: ${playerMoves.join(', ')}`;
                  }
                } else if (parsedData.draft_picks && parsedData.draft_picks.length > 0) {
                  const picks = parsedData.draft_picks.map(pick =>
                    `${pick.season} Round ${pick.round} pick`
                  );
                  transactionDescription = `[${conferenceName}] Trade involving ${picks.join(', ')}`;
                } else {
                  transactionDescription = `[${conferenceName}] Trade between ${Array.from(involvedTeams).join(' and ')}`;
                }
                break;

              case 'waiver':
                if (addedPlayers.length > 0 && droppedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} claimed ${addedPlayers.map(p => p.name).join(', ')} from waivers, dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
                } else if (addedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} claimed ${addedPlayers.map(p => p.name).join(', ')} from waivers`;
                } else if (droppedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} dropped ${droppedPlayers.map(p => p.name).join(', ')} to waivers`;
                } else {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} made a waiver claim`;
                }
                break;

              case 'free_agent':
                if (addedPlayers.length > 0 && droppedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} added ${addedPlayers.map(p => p.name).join(', ')}, dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
                } else if (addedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} added ${addedPlayers.map(p => p.name).join(', ')} from free agency`;
                } else if (droppedPlayers.length > 0) {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} dropped ${droppedPlayers.map(p => p.name).join(', ')}`;
                } else {
                  transactionDescription = `[${conferenceName}] ${primaryTeamName} made a free agent transaction`;
                }
                break;

              default:
                transactionDescription = `[${conferenceName}] ${primaryTeamName} completed a ${transactionType || 'transaction'}`;
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
              waiverBudget: parsedData.waiver_budget || []
            };
          })
      );

      // Filter out null transactions (ones that don't involve our team)
      const teamTransactions = processedTransactions.filter(tx => tx !== null);

      setTransactions(teamTransactions);
      console.log(`Loaded ${teamTransactions.length} transactions for this team across all conferences`);

      toast({
        title: 'Transactions Loaded',
        description: `Found ${teamTransactions.length} transactions for this team across all seasons`
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      toast({
        title: 'Error Loading Transactions',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchSchedule = async () => {
    if (!teamRosterData || !currentSeasonConfig) return;

    try {
      setScheduleLoading(true);
      console.log(`Fetching schedule for team ${teamRosterData.teamData.team_name} for season ${selectedSeason}`);

      // Get the conference ID for the selected season
      const seasonConferences = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      if (seasonConferences.length === 0) {
        console.log('No conferences found for selected season');
        setSchedule([]);
        return;
      }

      // Find the team's conference for the selected season
      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }
        ]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data) {
        throw new Error('Failed to get team conference mappings');
      }

      // Find the junction for the selected season
      const seasonConferenceIds = seasonConferences.map(conf => conf.dbConferenceId);
      const teamJunctionForSeason = teamJunctionResult.data.find(junction =>
        seasonConferenceIds.includes(junction.conference_id)
      );

      if (!teamJunctionForSeason) {
        console.log(`Team not found in any conference for season ${selectedSeason}`);
        setSchedule([]);
        return;
      }

      // Get all teams for opponent name lookup
      const teamsResult = await DatabaseService.getTeams({});
      const teamLookup = new Map();
      if (teamsResult.data) {
        teamsResult.data.forEach(team => {
          teamLookup.set(team.id, team.team_name);
        });
      }

      // Get season ID for playoff bracket lookup
      const seasonResult = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (seasonResult.error || !seasonResult.data || seasonResult.data.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasonResult.data[0].id;

      // Get all conferences for this season to handle cross-conference manual overrides
      const allSeasonConferences = await DatabaseService.getConferences({
        filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
      });

      const allConferenceIds = allSeasonConferences.data?.map(conf => conf.id) || [];

      // REGULAR SEASON: First get matchups from team's own conference
      const regularSeasonMatchupsResult = await DatabaseService.getMatchups({
        filters: [
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'week', operator: 'lte', value: 12 }
        ],
        orderBy: { column: 'week', ascending: true }
      });

      // Find weeks with manual overrides in the team's conference
      const manualOverrideWeeks = new Set();
      regularSeasonMatchupsResult.data?.forEach(matchup => {
        if (matchup.manual_override) {
          manualOverrideWeeks.add(matchup.week);
        }
      });

      // For manual override weeks, get ALL matchups across ALL conferences in the season
      let crossConferenceMatchups = [];
      if (manualOverrideWeeks.size > 0) {
        console.log(`Found manual override weeks: ${Array.from(manualOverrideWeeks).join(', ')}`);

        const crossConferenceResult = await DatabaseService.getMatchups({
          filters: [
            { column: 'conference_id', operator: 'in', value: allConferenceIds },
            { column: 'week', operator: 'in', value: Array.from(manualOverrideWeeks) }
          ],
          orderBy: { column: 'week', ascending: true }
        });

        crossConferenceMatchups = crossConferenceResult.data || [];
        console.log(`Found ${crossConferenceMatchups.length} cross-conference matchups for manual override weeks`);
      }

      // Get admin overrides for regular season
      const overridesResult = await DatabaseService.getMatchupAdminOverrides({
        filters: [
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'is_active', operator: 'eq', value: true }
        ]
      });

      // Process regular season matchups
      const regularSeasonSchedule = [];

      // Process normal conference matchups (non-manual override weeks)
      const normalMatchups = (regularSeasonMatchupsResult.data || []).filter(matchup =>
        !matchup.manual_override
      );

      normalMatchups.forEach(matchup => {
        // Check if there's an admin override for this matchup
        const override = overridesResult.data?.find(override =>
          override.conference_id === matchup.conference_id &&
          override.week === parseInt(matchup.week) &&
          override.is_active
        );

        let team1Id, team2Id;
        let isOverridden = false;
        let overrideReason = null;

        if (override) {
          // Use overridden teams from admin override table
          team1Id = override.override_team1_id;
          team2Id = override.override_team2_id;
          isOverridden = true;
          overrideReason = override.override_reason;
          console.log(`Week ${matchup.week}: Using admin override - teams ${team1Id} vs ${team2Id}`);
        } else {
          // Use original teams
          team1Id = matchup.team1_id;
          team2Id = matchup.team2_id;
        }

        // Only include if our team is involved
        if (team1Id === teamRosterData.teamData.id || team2Id === teamRosterData.teamData.id) {
          // Determine opponent
          const isTeam1 = team1Id === teamRosterData.teamData.id;
          const opponentId = isTeam1 ? team2Id : team1Id;
          const opponentName = teamLookup.get(opponentId) || 'Unknown Team';

          // Determine result
          let result: 'W' | 'L' | 'T' | 'TBD' = 'TBD';
          let teamScore = null;
          let opponentScore = null;

          if (matchup.team1_score !== null && matchup.team2_score !== null) {
            if (isTeam1) {
              teamScore = matchup.team1_score;
              opponentScore = matchup.team2_score;
            } else {
              teamScore = matchup.team2_score;
              opponentScore = matchup.team1_score;
            }

            if (teamScore > opponentScore) {
              result = 'W';
            } else if (teamScore < opponentScore) {
              result = 'L';
            } else {
              result = 'T';
            }
          }

          regularSeasonSchedule.push({
            week: matchup.week,
            opponent: opponentName,
            isHome: isTeam1,
            result,
            teamScore,
            opponentScore,
            isPlayoff: false,
            isOverridden,
            overrideReason,
            matchupStatus: matchup.matchup_status || 'scheduled',
            playoffRoundName: null
          });
        }
      });

      // Process cross-conference matchups for manual override weeks
      crossConferenceMatchups.forEach(matchup => {
        // For manual overrides, the teams in the matchup are already correct
        const team1Id = matchup.team1_id;
        const team2Id = matchup.team2_id;

        // Only include if our team is involved
        if (team1Id === teamRosterData.teamData.id || team2Id === teamRosterData.teamData.id) {
          console.log(`Week ${matchup.week}: Found cross-conference manual override matchup - teams ${team1Id} vs ${team2Id}`);

          // Determine opponent
          const isTeam1 = team1Id === teamRosterData.teamData.id;
          const opponentId = isTeam1 ? team2Id : team1Id;
          const opponentName = teamLookup.get(opponentId) || 'Unknown Team';

          // Determine result
          let result: 'W' | 'L' | 'T' | 'TBD' = 'TBD';
          let teamScore = null;
          let opponentScore = null;

          if (matchup.team1_score !== null && matchup.team2_score !== null) {
            if (isTeam1) {
              teamScore = matchup.team1_score;
              opponentScore = matchup.team2_score;
            } else {
              teamScore = matchup.team2_score;
              opponentScore = matchup.team1_score;
            }

            if (teamScore > opponentScore) {
              result = 'W';
            } else if (teamScore < opponentScore) {
              result = 'L';
            } else {
              result = 'T';
            }
          }

          regularSeasonSchedule.push({
            week: matchup.week,
            opponent: opponentName,
            isHome: isTeam1,
            result,
            teamScore,
            opponentScore,
            isPlayoff: false,
            isOverridden: true,
            overrideReason: 'Interconference',
            matchupStatus: matchup.matchup_status || 'scheduled',
            playoffRoundName: null
          });
        }
      });

      // PLAYOFFS: Query playoff brackets for weeks 13+
      const playoffBracketsResult = await DatabaseService.getPlayoffBrackets({
        filters: [
          { column: 'season_id', operator: 'eq', value: seasonId }
        ],
        orderBy: { column: 'week', ascending: true }
      });

      // Filter playoff brackets to only include those where this team is involved
      const teamPlayoffMatchups = playoffBracketsResult.data?.filter(bracket =>
        bracket.team1_id === teamRosterData.teamData.id ||
        bracket.team2_id === teamRosterData.teamData.id
      ) || [];

      // Define playoff round names based on week
      const getPlayoffRoundName = (week: number): string => {
        switch (week) {
          case 13: return 'Conference Championship';
          case 14: return 'Wildcard';
          case 15: return 'Quarterfinals';
          case 16: return 'Semifinals';
          case 17: return 'Colosseum Championship';
          default: return `Playoff Week ${week}`;
        }
      };

      // Process playoff matchups
      const playoffSchedule = teamPlayoffMatchups.map(bracket => {
        // Check if this is a bye week (Week 14 only)
        let opponentName = 'Unknown Team';
        let isTeam1 = true;

        if (bracket.is_bye && bracket.week === 14) {
          // This is a bye week
          opponentName = 'BYE';
          isTeam1 = bracket.team1_id === teamRosterData.teamData.id;
        } else {
          // Regular playoff matchup
          isTeam1 = bracket.team1_id === teamRosterData.teamData.id;
          const opponentId = isTeam1 ? bracket.team2_id : bracket.team1_id;
          opponentName = teamLookup.get(opponentId) || 'Unknown Team';
        }

        // Determine result
        let result: 'W' | 'L' | 'T' | 'TBD' = 'TBD';
        let teamScore = null;
        let opponentScore = null;

        if (bracket.is_bye && bracket.week === 14) {
          // Bye weeks are automatic wins
          result = 'W';
          teamScore = null; // No score for bye weeks
          opponentScore = null;
        } else if (bracket.team1_score !== null && bracket.team2_score !== null) {
          if (isTeam1) {
            teamScore = bracket.team1_score;
            opponentScore = bracket.team2_score;
          } else {
            teamScore = bracket.team2_score;
            opponentScore = bracket.team1_score;
          }

          if (teamScore > opponentScore) {
            result = 'W';
          } else if (teamScore < opponentScore) {
            result = 'L';
          } else {
            result = 'T';
          }
        }

        return {
          week: bracket.week.toString(),
          opponent: opponentName,
          isHome: isTeam1, // For playoffs, this might not be as meaningful
          result,
          teamScore,
          opponentScore,
          isPlayoff: true,
          isOverridden: false,
          overrideReason: null,
          matchupStatus: bracket.winning_team_id ? 'completed' : 'scheduled',
          playoffRoundName: getPlayoffRoundName(bracket.week)
        };
      });

      // Sort regular season schedule by week
      regularSeasonSchedule.sort((a, b) => parseInt(a.week) - parseInt(b.week));

      // Combine regular season and playoff schedules
      const combinedSchedule = [...regularSeasonSchedule, ...playoffSchedule];

      setSchedule(combinedSchedule);
      console.log(`Loaded ${combinedSchedule.length} matchups for ${selectedSeason} season (${regularSeasonSchedule.length} regular season, ${playoffSchedule.length} playoff)`);

      toast({
        title: 'Schedule Loaded',
        description: `Found ${combinedSchedule.length} matchups for ${selectedSeason} season`
      });

    } catch (error) {
      console.error('Error fetching schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load schedule';
      toast({
        title: 'Error Loading Schedule',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const fetchTeamRecord = async () => {
    if (!teamRosterData || !currentSeasonConfig) return;

    try {
      console.log(`Fetching team record for team ${teamRosterData.teamData.team_name} for season ${selectedSeason}`);

      // Get season ID
      const seasonResult = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (seasonResult.error || !seasonResult.data || seasonResult.data.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasonResult.data[0].id;

      // Find the team's conference for the selected season
      const seasonConferences = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      if (seasonConferences.length === 0) {
        console.log('No conferences found for selected season');
        return;
      }

      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }
        ]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data) {
        throw new Error('Failed to get team conference mappings');
      }

      const seasonConferenceIds = seasonConferences.map(conf => conf.dbConferenceId);
      const teamJunctionForSeason = teamJunctionResult.data.find(junction =>
        seasonConferenceIds.includes(junction.conference_id)
      );

      if (!teamJunctionForSeason) {
        console.log(`Team not found in any conference for season ${selectedSeason}`);
        return;
      }

      // Fetch team record
      const teamRecordResult = await DatabaseService.getTeamRecords({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id },
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'season_id', operator: 'eq', value: seasonId }
        ]
      });

      if (teamRecordResult.error || !teamRecordResult.data || teamRecordResult.data.length === 0) {
        console.log('No team record found for this season');
        return;
      }

      const record = teamRecordResult.data[0] as TeamRecord;

      // Fetch all team records in the same conference for conference ranking
      const conferenceRecordsResult = await DatabaseService.getTeamRecords({
        filters: [
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'season_id', operator: 'eq', value: seasonId }
        ]
      });

      if (conferenceRecordsResult.data) {
        // Sort teams by wins (desc), then by points_for (desc) to calculate conference rank
        const sortedRecords = conferenceRecordsResult.data.sort((a, b) => {
          if (b.wins !== a.wins) {
            return b.wins - a.wins; // More wins = better rank
          }
          return b.points_for - a.points_for; // More points = better rank
        });

        // Find the conference rank of our team
        const rank = sortedRecords.findIndex(r => r.team_id === teamRosterData.teamData.id) + 1;
        record.rank = rank;
      }

      // Fetch ALL team records across ALL conferences for league-wide rankings
      const allLeagueRecordsResult = await DatabaseService.getTeamRecords({
        filters: [
          { column: 'season_id', operator: 'eq', value: seasonId }
        ]
      });

      if (allLeagueRecordsResult.data) {
        // Calculate league-wide ranking for Points For (highest = rank 1)
        const sortedByPointsFor = allLeagueRecordsResult.data
          .slice()
          .sort((a, b) => b.points_for - a.points_for);
        const pointsForRank = sortedByPointsFor.findIndex(r => r.team_id === teamRosterData.teamData.id) + 1;
        record.leagueRankPointsFor = pointsForRank;

        // Calculate league-wide ranking for Points Against (lowest = rank 1)
        const sortedByPointsAgainst = allLeagueRecordsResult.data
          .slice()
          .sort((a, b) => a.points_against - b.points_against);
        const pointsAgainstRank = sortedByPointsAgainst.findIndex(r => r.team_id === teamRosterData.teamData.id) + 1;
        record.leagueRankPointsAgainst = pointsAgainstRank;

        // Calculate league-wide ranking for Point Differential (highest = rank 1)
        const sortedByPointDiff = allLeagueRecordsResult.data
          .slice()
          .sort((a, b) => b.point_diff - a.point_diff);
        const pointDiffRank = sortedByPointDiff.findIndex(r => r.team_id === teamRosterData.teamData.id) + 1;
        record.leagueRankPointDiff = pointDiffRank;

        console.log(`League rankings - Points For: #${pointsForRank}, Points Against: #${pointsAgainstRank}, Point Diff: #${pointDiffRank}`);
      }

      setTeamRecord(record);
      console.log(`Loaded team record:`, record);

    } catch (error) {
      console.error('Error fetching team record:', error);
      // Don't show toast for team record errors as it's not critical
    }
  };

  const fetchSeasonWaiverData = async () => {
    if (!teamRosterData || !currentSeasonConfig) return;

    try {
      console.log(`Fetching season waiver data for team ${teamRosterData.teamData.team_name} for season ${selectedSeason}`);

      // Find the team's conference for the selected season
      const seasonConferences = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      if (seasonConferences.length === 0) {
        console.log('No conferences found for selected season');
        return;
      }

      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }
        ]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data) {
        throw new Error('Failed to get team conference mappings');
      }

      const seasonConferenceIds = seasonConferences.map(conf => conf.dbConferenceId);
      const teamJunctionForSeason = teamJunctionResult.data.find(junction =>
        seasonConferenceIds.includes(junction.conference_id)
      );

      if (!teamJunctionForSeason) {
        console.log(`Team not found in any conference for season ${selectedSeason}`);
        return;
      }

      // Get conference data to find the league_id for Sleeper API call
      const conferenceResult = await DatabaseService.getConferences({
        filters: [{ column: 'id', operator: 'eq', value: teamJunctionForSeason.conference_id }]
      });

      if (conferenceResult.error || !conferenceResult.data || conferenceResult.data.length === 0) {
        throw new Error('Conference not found');
      }

      const conferenceData = conferenceResult.data[0];
      const leagueId = conferenceData.league_id;
      const rosterId = teamJunctionForSeason.roster_id;

      // Fetch roster data from Sleeper API for the specific season
      console.log(`Fetching Sleeper roster data for league ${leagueId}, roster ${rosterId}`);
      const rosterData = await SleeperApiService.getTeamRosterData(leagueId, rosterId);

      // Calculate waiver budget remaining (100 - waiver_budget_used)
      const waiverBudgetRemaining = 100 - rosterData.roster.settings.waiver_budget_used;

      setSeasonWaiverData({
        position: rosterData.roster.settings.waiver_position,
        budget: waiverBudgetRemaining
      });

      console.log(`Loaded season waiver data: position ${rosterData.roster.settings.waiver_position}, budget remaining $${waiverBudgetRemaining}`);

    } catch (error) {
      console.error('Error fetching season waiver data:', error);
      // Don't show toast for waiver data errors as it's not critical
    }
  };

  const fetchSeasonTransactionCount = async () => {
    if (!teamRosterData || !currentSeasonConfig) return;

    try {
      console.log(`Fetching season transaction count for team ${teamRosterData.teamData.team_name} for season ${selectedSeason}`);

      // Get season ID
      const seasonResult = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (seasonResult.error || !seasonResult.data || seasonResult.data.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasonResult.data[0].id;

      // Find the team's conference for the selected season
      const seasonConferences = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      if (seasonConferences.length === 0) {
        console.log('No conferences found for selected season');
        return;
      }

      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }
        ]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data) {
        throw new Error('Failed to get team conference mappings');
      }

      const seasonConferenceIds = seasonConferences.map(conf => conf.dbConferenceId);
      const teamJunctionForSeason = teamJunctionResult.data.find(junction =>
        seasonConferenceIds.includes(junction.conference_id)
      );

      if (!teamJunctionForSeason) {
        console.log(`Team not found in any conference for season ${selectedSeason}`);
        setSeasonTransactionCount(0);
        return;
      }

      // Query transactions table for this team in this season
      const transactionsResult = await DatabaseService.getTransactions({
        filters: [
          { column: 'season_id', operator: 'eq', value: seasonId },
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id }
        ]
      });

      if (transactionsResult.error || !transactionsResult.data) {
        throw new Error('Failed to fetch transactions');
      }

      // Count transactions that involve this team
      let transactionCount = 0;
      for (const transaction of transactionsResult.data) {
        let parsedData: any = {};
        try {
          parsedData = typeof transaction.data === 'string' ? JSON.parse(transaction.data) : transaction.data || {};
        } catch (e) {
          console.warn('Failed to parse transaction data:', e);
          continue;
        }

        // Check if this transaction involves our team's roster_id
        const transactionRosterIds = parsedData.roster_ids || [];
        if (transactionRosterIds.includes(teamJunctionForSeason.roster_id)) {
          transactionCount++;
        }
      }

      setSeasonTransactionCount(transactionCount);
      console.log(`Loaded season transaction count: ${transactionCount} for season ${selectedSeason}`);

    } catch (error) {
      console.error('Error fetching season transaction count:', error);
      // Don't show toast for transaction count errors as it's not critical
      setSeasonTransactionCount(0);
    }
  };

  const fetchHeaderStats = async () => {
    if (!teamRosterData || !currentSeasonConfig) return;

    try {
      console.log(`Fetching header stats for team ${teamRosterData.teamData.team_name} for season ${selectedSeason}`);

      // Get season ID
      const seasonResult = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason.toString() }]
      });

      if (seasonResult.error || !seasonResult.data || seasonResult.data.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasonResult.data[0].id;

      // Find the team's conference for the selected season
      const seasonConferences = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      if (seasonConferences.length === 0) {
        console.log('No conferences found for selected season');
        return;
      }

      const teamJunctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id }
        ]
      });

      if (teamJunctionResult.error || !teamJunctionResult.data) {
        throw new Error('Failed to get team conference mappings');
      }

      const seasonConferenceIds = seasonConferences.map(conf => conf.dbConferenceId);
      const teamJunctionForSeason = teamJunctionResult.data.find(junction =>
        seasonConferenceIds.includes(junction.conference_id)
      );

      if (!teamJunctionForSeason) {
        console.log(`Team not found in any conference for season ${selectedSeason}`);
        // Set default values if team not found in season
        setHeaderStats({
          wins: 0,
          losses: 0,
          pointsFor: 0,
          gamesPlayed: 0
        });
        return;
      }

      // Get team record from team_records table
      const teamRecordResult = await DatabaseService.getTeamRecords({
        filters: [
          { column: 'team_id', operator: 'eq', value: teamRosterData.teamData.id },
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'season_id', operator: 'eq', value: seasonId }
        ]
      });

      let wins = 0;
      let losses = 0;
      let pointsFor = 0;

      if (teamRecordResult.data && teamRecordResult.data.length > 0) {
        const record = teamRecordResult.data[0];
        wins = record.wins;
        losses = record.losses;
        pointsFor = record.points_for;
        console.log(`Found team record: ${wins}-${losses}, Points For: ${pointsFor}`);
      } else {
        console.log('No team record found, using default values');
      }

      // Calculate games played from completed matchups (regular season only, weeks 1-12)
      const matchupsResult = await DatabaseService.getMatchups({
        filters: [
          { column: 'conference_id', operator: 'eq', value: teamJunctionForSeason.conference_id },
          { column: 'week', operator: 'lte', value: 12 } // Regular season only
        ]
      });

      let gamesPlayed = 0;
      if (matchupsResult.data) {
        // Count completed games where this team was involved
        const completedGames = matchupsResult.data.filter(matchup => {
          const isTeamInvolved = matchup.team1_id === teamRosterData.teamData.id || 
                                matchup.team2_id === teamRosterData.teamData.id;
          const isCompleted = matchup.team1_score !== null && matchup.team2_score !== null;
          return isTeamInvolved && isCompleted;
        });
        gamesPlayed = completedGames.length;

        // Also check for cross-conference manual overrides (similar to schedule logic)
        const manualOverrideWeeks = new Set();
        matchupsResult.data.forEach(matchup => {
          if (matchup.manual_override) {
            manualOverrideWeeks.add(matchup.week);
          }
        });

        // For manual override weeks, get ALL matchups across ALL conferences in the season
        if (manualOverrideWeeks.size > 0) {
          const allSeasonConferences = await DatabaseService.getConferences({
            filters: [{ column: 'season_id', operator: 'eq', value: seasonId }]
          });

          const allConferenceIds = allSeasonConferences.data?.map(conf => conf.id) || [];

          const crossConferenceResult = await DatabaseService.getMatchups({
            filters: [
              { column: 'conference_id', operator: 'in', value: allConferenceIds },
              { column: 'week', operator: 'in', value: Array.from(manualOverrideWeeks) },
              { column: 'week', operator: 'lte', value: 12 } // Still regular season only
            ]
          });

          if (crossConferenceResult.data) {
            const crossConferenceCompleted = crossConferenceResult.data.filter(matchup => {
              const isTeamInvolved = matchup.team1_id === teamRosterData.teamData.id || 
                                    matchup.team2_id === teamRosterData.teamData.id;
              const isCompleted = matchup.team1_score !== null && matchup.team2_score !== null;
              // Make sure it's not already counted in the conference matchups
              const isNotAlreadyCounted = matchup.conference_id !== teamJunctionForSeason.conference_id;
              return isTeamInvolved && isCompleted && isNotAlreadyCounted;
            });
            gamesPlayed += crossConferenceCompleted.length;
          }
        }

        console.log(`Games played from completed matchups: ${gamesPlayed}`);
      }

      // For ended seasons, ensure we have 12 games (full regular season)
      // Check if season has ended by looking at current season config
      const currentYear = new Date().getFullYear();
      const isCurrentSeason = selectedSeason === currentYear;
      if (!isCurrentSeason && gamesPlayed === 0) {
        // If it's a past season and no completed games found, assume full 12-game season
        gamesPlayed = 12;
        console.log(`Past season detected, setting games played to 12`);
      }

      setHeaderStats({
        wins,
        losses,
        pointsFor,
        gamesPlayed
      });

      console.log(`Loaded header stats: ${wins}-${losses}, Points For: ${pointsFor}, Games Played: ${gamesPlayed}`);

    } catch (error) {
      console.error('Error fetching header stats:', error);
      // Set fallback values on error
      setHeaderStats({
        wins: 0,
        losses: 0,
        pointsFor: 0,
        gamesPlayed: 0
      });
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-yellow-100 text-yellow-800';
      case 'K': return 'bg-purple-100 text-purple-800';
      case 'DEF': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSlotPositionColor = (position: string) => {
    switch (position) {
      case 'FLEX': return 'bg-orange-100 text-orange-800';
      case 'SUPER_FLEX': return 'bg-pink-100 text-pink-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status || status === 'Active') return null;

    const variants: { [key: string]: "default" | "destructive" | "secondary" | "outline" } = {
      'IR': 'destructive',
      'Out': 'destructive',
      'Doubtful': 'destructive',
      'Questionable': 'secondary',
      'Probable': 'outline'
    };

    return <Badge variant={variants[status] || 'outline'} className="text-xs">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading team data...</span>
        </div>
      </div>);

  }

  if (error || !teamRosterData) {
    return (
      <div className="space-y-6">
        <Link to="/teams">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teams
          </Button>
        </Link>
        <Card>
          <CardContent className="flex items-center justify-center min-h-64">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h3 className="text-lg font-semibold">Error Loading Team</h3>
              <p className="text-muted-foreground">{error || 'Team data not available'}</p>
              <Button onClick={() => teamId && fetchTeamData(parseInt(teamId))}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  const { roster, organizedRoster, allPlayers, teamData, conferenceData } = teamRosterData;

  // Calculate additional stats - use team_records data if available, fallback to Sleeper data
  const totalPoints = teamRecord?.points_for ?? SleeperApiService.formatPoints(roster.settings.fpts, roster.settings.fpts_decimal);
  const totalPointsAgainst = teamRecord?.points_against ?? SleeperApiService.formatPoints(roster.settings.fpts_against, roster.settings.fpts_against_decimal);
  const gamesPlayed = teamRecord ? (teamRecord.wins + teamRecord.losses + (teamRecord.ties || 0)) : (roster.settings.wins + roster.settings.losses + roster.settings.ties);
  const avgPointsPerGame = SleeperApiService.calculatePointsPerGame(totalPoints, gamesPlayed);
  const winPercentage = gamesPlayed > 0 ? ((teamRecord?.wins ?? roster.settings.wins) / gamesPlayed * 100) : 0;

  // Header statistics - use database data when available, fallback to Sleeper data
  const headerWins = headerStats?.wins ?? roster.settings.wins;
  const headerLosses = headerStats?.losses ?? roster.settings.losses;
  const headerPointsFor = headerStats?.pointsFor ?? SleeperApiService.formatPoints(roster.settings.fpts, roster.settings.fpts_decimal);
  const headerGamesPlayed = headerStats?.gamesPlayed ?? (roster.settings.wins + roster.settings.losses + roster.settings.ties);
  const headerAvgPointsPerGame = headerGamesPlayed > 0 ? (headerPointsFor / headerGamesPlayed) : 0;
  const headerWinPercentage = headerGamesPlayed > 0 ? (headerWins / headerGamesPlayed * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/teams">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Teams
        </Button>
      </Link>

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={teamData.team_logo_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg" style={{ backgroundColor: teamData.team_primary_color + '20' }}>
              {teamData.team_name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{teamData.team_name}</h1>
            <p className="text-muted-foreground">Owned by {teamData.owner_name}</p>
            {teamData.co_owner_name &&
              <p className="text-sm text-muted-foreground">Co-owner: {teamData.co_owner_name}</p>
            }
            <div className="flex items-center space-x-2 mt-2">
              <Badge 
                variant="secondary" 
                className={getConferenceBadgeClasses(conferenceData.conference_name)}
              >
                {conferenceData.conference_name}
              </Badge>
              <Badge variant="secondary">Roster #{roster.roster_id}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">
              {headerStats ? `${headerWins}-${headerLosses}` : `${roster.settings.wins}-${roster.settings.losses}`}
            </div>
            <div className="text-sm text-muted-foreground">Record</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {headerStats ? headerPointsFor.toFixed(1) : totalPoints.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Points For</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {headerStats ? headerAvgPointsPerGame.toFixed(1) : avgPointsPerGame.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Avg/Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {headerStats ? headerWinPercentage.toFixed(1) : winPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Win %</div>
          </div>
        </div>
      </div>

      {/* Team Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Roster Tab */}
        <TabsContent value="roster" className="space-y-4">
          {/* Starting Lineup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5" />
                <span>Starting Lineup</span>
              </CardTitle>
              <CardDescription>
                Current starting players for this roster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>NFL Team</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizedRoster.starters.map((starter, index) => {
                      const player = allPlayers[starter.playerId];
                      return (
                        <TableRow key={`starter-${index}`}>
                          <TableCell>
                            <Badge className={getSlotPositionColor(starter.slotPosition)}>
                              {starter.slotPosition}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                              </span>
                              {player &&
                                <Badge className={getPositionColor(player.position)}>
                                  {player.position}
                                </Badge>
                              }
                            </div>
                          </TableCell>
                          <TableCell>{player?.team || 'N/A'}</TableCell>
                          <TableCell>
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>);

                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Bench Players */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Bench ({organizedRoster.bench.length})</span>
              </CardTitle>
              <CardDescription>
                Players available as substitutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>NFL Team</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizedRoster.bench.map((playerId) => {
                      const player = allPlayers[playerId];
                      return (
                        <TableRow key={`bench-${playerId}`}>
                          <TableCell className="font-medium">
                            {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                          </TableCell>
                          <TableCell>
                            {player &&
                              <Badge className={getPositionColor(player.position)}>
                                {player.position}
                              </Badge>
                            }
                          </TableCell>
                          <TableCell>{player?.team || 'N/A'}</TableCell>
                          <TableCell>
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>);

                    })}
                    {organizedRoster.bench.length === 0 &&
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          No bench players
                        </TableCell>
                      </TableRow>
                    }
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Injured Reserve */}
          {organizedRoster.ir.length > 0 &&
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Injured Reserve ({organizedRoster.ir.length})</span>
                </CardTitle>
                <CardDescription>
                  Players on injured reserve
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>NFL Team</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizedRoster.ir.map((playerId) => {
                        const player = allPlayers[playerId];
                        return (
                          <TableRow key={`ir-${playerId}`}>
                            <TableCell className="font-medium">
                              {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                            </TableCell>
                            <TableCell>
                              {player &&
                                <Badge className={getPositionColor(player.position)}>
                                  {player.position}
                                </Badge>
                              }
                            </TableCell>
                            <TableCell>{player?.team || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">IR</Badge>
                            </TableCell>
                          </TableRow>);

                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          }
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>{selectedSeason} Season Stats</span>
                </CardTitle>
                <CardDescription>
                  {teamRecord ? 'Official season statistics from team records' : 'Statistics from current roster data'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points For</p>
                    <p className="text-2xl font-bold">{totalPoints.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points Against</p>
                    <p className="text-2xl font-bold">{totalPointsAgainst.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Point Differential</p>
                    <p className={`text-2xl font-bold ${totalPoints - totalPointsAgainst > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalPoints - totalPointsAgainst > 0 ? '+' : ''}{(totalPoints - totalPointsAgainst).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Percentage</p>
                    <p className="text-2xl font-bold">{winPercentage.toFixed(1)}%</p>
                  </div>
                  {teamRecord && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Conference Rank</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {teamRecord.rank ? `#${teamRecord.rank}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Streak</p>
                        <p className="text-2xl font-bold">
                          {teamRecord.streak || '-'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Team Management</span>
                </CardTitle>
                <CardDescription>
                  Waiver and transaction data for {selectedSeason} season
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Waiver Position</p>
                    <p className="text-2xl font-bold">
                      {seasonWaiverData ? seasonWaiverData.position : roster.settings.waiver_position}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Waiver Budget</p>
                    <p className="text-2xl font-bold">
                      ${seasonWaiverData ? seasonWaiverData.budget : (100 - roster.settings.waiver_budget_used)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Moves</p>
                    <p className="text-2xl font-bold">{seasonTransactionCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Games Played</p>
                    <p className="text-2xl font-bold">{gamesPlayed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Transaction History</h3>
              <p className="text-sm text-muted-foreground">
                All trades, waivers, and roster moves for this team across all seasons
              </p>
            </div>
            <Button
              onClick={fetchTransactions}
              disabled={transactionsLoading}
              variant="outline"
              size="sm">

              {transactionsLoading ?
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </> :

                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              }
            </Button>
          </div>

          {transactionsLoading && transactions.length === 0 ?
            <Card>
              <CardContent className="flex items-center justify-center min-h-32">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading transactions...</span>
                </div>
              </CardContent>
            </Card> :
            transactions.length === 0 ?
              <Card>
                <CardContent className="flex items-center justify-center min-h-32">
                  <div className="text-center space-y-2">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h3 className="text-lg font-semibold">No Transactions Found</h3>
                    <p className="text-muted-foreground">
                      This team hasn't made any trades, waiver claims, or free agent pickups this season.
                    </p>
                    <div className="mt-4">
                      <Badge variant="secondary">
                        Total moves: {roster.settings.total_moves} (all seasons)
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card> :

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                  </p>
                  <Badge variant="secondary">
                    Total moves: {roster.settings.total_moves} (all seasons)
                  </Badge>
                </div>

                <div className="space-y-3">
                  {transactions.map((transaction) =>
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction} />

                  )}
                </div>
              </div>
          }
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Season Schedule</h3>
              <p className="text-sm text-muted-foreground">
                Complete schedule and results for {selectedSeason} season
              </p>
            </div>
            <Button
              onClick={fetchSchedule}
              disabled={scheduleLoading}
              variant="outline"
              size="sm">
              {scheduleLoading ?
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </> :
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              }
            </Button>
          </div>

          {scheduleLoading && schedule.length === 0 ?
            <Card>
              <CardContent className="flex items-center justify-center min-h-32">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading schedule...</span>
                </div>
              </CardContent>
            </Card> :
            schedule.length === 0 ?
              <Card>
                <CardContent className="flex items-center justify-center min-h-32">
                  <div className="text-center space-y-2">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h3 className="text-lg font-semibold">No Schedule Found</h3>
                    <p className="text-muted-foreground">
                      No matchups found for this team in the {selectedSeason} season.
                    </p>
                  </div>
                </CardContent>
              </Card> :

              <div className="space-y-4">
                {/* Schedule Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>{selectedSeason} Season Schedule</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">
                          {teamRecord?.wins ?? schedule.filter(m => m.result === 'W').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Wins</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {teamRecord?.losses ?? schedule.filter(m => m.result === 'L').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Losses</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {teamRecord?.ties ?? schedule.filter(m => m.result === 'T').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Ties</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {schedule.filter(m => m.result === 'TBD').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Remaining</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {teamRecord?.rank ? `#${teamRecord.rank}` : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">Rank</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Matchup Results</CardTitle>
                    <CardDescription>
                      Week-by-week schedule and results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Week</TableHead>
                            <TableHead>Opponent</TableHead>
                            <TableHead className="w-16">@/vs</TableHead>
                            <TableHead className="w-20">Result</TableHead>
                            <TableHead className="w-24">Score</TableHead>
                            <TableHead className="w-16">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedule.map((matchup, index) => (
                            <TableRow key={`matchup-${index}`}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{matchup.week}</span>
                                  {matchup.isPlayoff && matchup.playoffRoundName && (
                                    <Badge variant="secondary" className="text-xs mt-1 w-fit bg-purple-100 text-purple-800">
                                      {matchup.playoffRoundName}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <span>{matchup.opponent}</span>
                                  {matchup.isOverridden && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${matchup.overrideReason === 'Interconference'
                                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                                          : 'bg-blue-100 text-blue-800 border-blue-300'
                                        }`}
                                      title={matchup.overrideReason || 'Matchup Override'}
                                    >
                                      {matchup.overrideReason === 'Interconference' ? 'Interconference' : 'Override'}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {matchup.isHome ? 'vs' : '@'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    matchup.result === 'W' ? 'default' :
                                      matchup.result === 'L' ? 'destructive' :
                                        matchup.result === 'T' ? 'secondary' :
                                          'outline'
                                  }
                                  className="w-8 justify-center"
                                >
                                  {matchup.result}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {matchup.teamScore !== null && matchup.opponentScore !== null ? (
                                  <div className="text-sm">
                                    <span className={matchup.result === 'W' ? 'font-bold' : ''}>
                                      {matchup.teamScore}
                                    </span>
                                    <span className="text-muted-foreground mx-1">-</span>
                                    <span className={matchup.result === 'L' ? 'font-bold' : ''}>
                                      {matchup.opponentScore}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {matchup.matchupStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
          }
        </TabsContent>
      </Tabs>
    </div>);

};

export default TeamDetailPage;