import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/AppContext';
import { Users, Search, ExternalLink, Trophy, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { ConferenceBadge } from '@/components/ui/conference-badge';

// Interface for team data from database tables
interface TeamData {
  id: string;
  teamName: string;
  ownerName: string;
  coOwnerName?: string;
  ownerAvatar: string | null;
  conference: string;
  record: {wins: number;losses: number;ties: number;};
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  streak: string;
}


const TeamsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [teamsData, setTeamsData] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch team data from database tables
  const fetchTeamsData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching teams data for season:', selectedSeason);

      // Get season ID
      const seasonResult = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason.toString() }]
      });

      if (seasonResult.error || !seasonResult.data || seasonResult.data.length === 0) {
        throw new Error('Season not found');
      }

      const seasonId = seasonResult.data[0].id;

      // Get conferences for current season
      let conferencesToFetch = currentSeasonConfig.conferences.filter(conf => conf.dbConferenceId);
      
      if (selectedConference) {
        conferencesToFetch = conferencesToFetch.filter(c => c.id === selectedConference);
      }

      if (conferencesToFetch.length === 0) {
        console.log('No conferences found for selected season');
        setTeamsData([]);
        return;
      }

      const conferenceIds = conferencesToFetch.map(c => c.dbConferenceId);

      // Fetch teams from database
      const teamsResult = await DatabaseService.getTeams({});

      if (teamsResult.error || !teamsResult.data) {
        throw new Error('Failed to fetch teams');
      }

      // Fetch team-conference junctions to find teams in selected conferences
      const junctionsResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ]
      });

      if (junctionsResult.error || !junctionsResult.data) {
        throw new Error('Failed to fetch team conference mappings');
      }

      // Get team IDs that are in the selected conferences
      const teamIdsInConferences = junctionsResult.data.map(junction => junction.team_id);

      // Filter teams to only those in selected conferences
      const teamsInConferences = teamsResult.data.filter(team => 
        teamIdsInConferences.includes(team.id)
      );

      // Fetch team records for these teams
      const teamRecordsResult = await DatabaseService.getTeamRecords({
        filters: [
          { column: 'season_id', operator: 'eq', value: seasonId },
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ]
      });

      if (teamRecordsResult.error || !teamRecordsResult.data) {
        throw new Error('Failed to fetch team records');
      }

      // Get conferences for name mapping
      const conferencesResult = await DatabaseService.getConferences({
        filters: [{ column: 'id', operator: 'in', value: conferenceIds }]
      });

      const conferenceMap = new Map();
      if (conferencesResult.data) {
        conferencesResult.data.forEach(conf => {
          conferenceMap.set(conf.id, conf.conference_name);
        });
      }

      // Combine team data with records
      const combinedTeams: TeamData[] = [];

      for (const team of teamsInConferences) {
        // Find the team's record
        const teamRecord = teamRecordsResult.data.find(record => record.team_id === team.id);
        
        if (teamRecord) {
          // Find the team's conference
          const teamJunction = junctionsResult.data.find(junction => junction.team_id === team.id);
          const conferenceName = teamJunction ? conferenceMap.get(teamJunction.conference_id) : 'Unknown';

          // Calculate streak (simplified - would need match history for accuracy)
          const streak = calculateStreak(teamRecord.wins, teamRecord.losses);

          // Format avatar URL
          const avatarUrl = team.team_logourl ? `https://sleepercdn.com/avatars/thumbs/${team.team_logourl}` : null;

          combinedTeams.push({
            id: team.id.toString(),
            teamName: team.team_name,
            ownerName: team.owner_name,
            coOwnerName: team.co_owner_name || undefined,
            ownerAvatar: avatarUrl,
            conference: conferenceName,
            record: {
              wins: teamRecord.wins,
              losses: teamRecord.losses,
              ties: 0 // Ties not currently tracked in team_records
            },
            pointsFor: teamRecord.points_for,
            pointsAgainst: teamRecord.points_against,
            rank: 0, // Will be calculated after sorting
            streak
          });
        }
      }

      // Sort teams by wins (descending), then by points for (descending)
      combinedTeams.sort((a, b) => {
        if (a.record.wins !== b.record.wins) {
          return b.record.wins - a.record.wins;
        }
        return b.pointsFor - a.pointsFor;
      });

      // Assign ranks
      combinedTeams.forEach((team, index) => {
        team.rank = index + 1;
      });

      console.log('Final combined teams data:', combinedTeams);
      setTeamsData(combinedTeams);

    } catch (err) {
      console.error('Error fetching teams data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load teams data');
      toast({
        title: "Error Loading Teams",
        description: "Failed to load team data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate win/loss streak (simplified - would need game-by-game data for accuracy)
  const calculateStreak = (wins: number, losses: number): string => {
    // This is a simplified calculation - ideally we'd have game history
    if (wins > losses) {
      return `W${Math.min(wins - losses, 5)}`; // Cap at 5 for display
    } else if (losses > wins) {
      return `L${Math.min(losses - wins, 5)}`; // Cap at 5 for display
    }
    return 'T1';
  };

  // Load data when component mounts or when season/conference changes
  useEffect(() => {
    fetchTeamsData();
  }, [selectedSeason, selectedConference]);

  // Filter teams based on search term
  const filteredTeams = teamsData.filter((team) => {
    const searchMatch = searchTerm === '' ||
    team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.coOwnerName && team.coOwnerName.toLowerCase().includes(searchTerm.toLowerCase());

    return searchMatch;
  });

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const winPercentage = wins / (wins + losses);
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return 'text-green-600';
    if (streak.startsWith('L')) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Teams</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          } • {filteredTeams.length} teams
        </p>
      </div>

      {/* Search Bar and Refresh */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => setSearchTerm('')}>
          Clear
        </Button>
        <Button
          variant="outline"
          onClick={fetchTeamsData}
          disabled={loading}>


          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {loading &&
      <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Loading Teams</h3>
            <p className="text-muted-foreground">Fetching team data from database...</p>
          </CardContent>
        </Card>
      }
      
      {/* Error State */}
      {error && !loading &&
      <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Teams</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchTeamsData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      }
      
      {/* Teams Grid */}
      {!loading && !error &&
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) =>
        <Card key={team.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={team.ownerAvatar || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {team.ownerName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base leading-tight">{team.teamName}</CardTitle>
                    <CardDescription className="text-sm">
                      {team.ownerName}
                      {team.coOwnerName && ` & ${team.coOwnerName}`}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {team.rank <= 3 && <Trophy className="h-4 w-4 text-yellow-500" />}
                  <span className="text-sm font-semibold">#{team.rank}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Conference Badge */}
              <ConferenceBadge conferenceName={team.conference} size="sm" />

              {/* Record and Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Record</p>
                  <Badge variant={getRecordBadgeVariant(team.record.wins, team.record.losses)}>
                    {team.record.wins}-{team.record.losses}
                    {team.record.ties > 0 && `-${team.record.ties}`}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Streak</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className={`h-3 w-3 ${getStreakColor(team.streak)}`} />
                    <span className={`text-sm font-semibold ${getStreakColor(team.streak)}`}>
                      {team.streak}
                    </span>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Points For</p>
                  <p className="font-semibold">{team.pointsFor.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Points Against</p>
                  <p className="font-semibold">{team.pointsAgainst.toFixed(1)}</p>
                </div>
              </div>

              {/* View Team Button */}
              <Link to={`/teams/${team.id}`} className="w-full">
                <Button variant="outline" className="w-full text-sm py-1.5">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Team Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </div>
      }

      {/* No Results */}
      {!loading && !error && filteredTeams.length === 0 &&
      <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams found</h3>
            <p className="text-muted-foreground mb-4">
              No teams match your current search criteria.
            </p>
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      }

      {/* Summary Stats */}
      {!loading && !error && filteredTeams.length > 0 &&
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Points For</CardDescription>
              <CardTitle className="text-2xl">
                {(filteredTeams.reduce((sum, team) => sum + team.pointsFor, 0) / filteredTeams.length).toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Highest Scoring Team</CardDescription>
              <CardTitle className="text-lg">
                {filteredTeams.reduce((prev, current) =>
              prev.pointsFor > current.pointsFor ? prev : current
              ).teamName}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    </div>);


};

export default TeamsPage;