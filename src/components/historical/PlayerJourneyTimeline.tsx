import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Timeline, 
  TimelineItem, 
  TimelineConnector, 
  TimelineContent, 
  TimelineDescription, 
  TimelineIcon, 
  TimelineTime, 
  TimelineTitle 
} from '@/components/ui/timeline';
import { Search, User, Calendar, TrendingUp, TrendingDown, Shuffle, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import HistoricalDataService, { PlayerJourneyEntry } from '../../services/historicalDataService';

interface PlayerJourneyTimelineProps {
  playerId?: number;
  playerName?: string;
}

const PlayerJourneyTimeline: React.FC<PlayerJourneyTimelineProps> = ({
  playerId,
  playerName
}) => {
  const [journeyEntries, setJourneyEntries] = useState<PlayerJourneyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(playerId || null);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const { toast } = useToast();

  const historicalDataService = HistoricalDataService.getInstance();

  const actionTypeColors = {
    'add': 'bg-green-100 text-green-800 border-green-200',
    'drop': 'bg-red-100 text-red-800 border-red-200',
    'trade': 'bg-blue-100 text-blue-800 border-blue-200',
    'waiver_claim': 'bg-purple-100 text-purple-800 border-purple-200',
    'free_agent_pickup': 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  const actionTypeIcons = {
    'add': <TrendingUp className="w-4 h-4" />,
    'drop': <TrendingDown className="w-4 h-4" />,
    'trade': <Shuffle className="w-4 h-4" />,
    'waiver_claim': <DollarSign className="w-4 h-4" />,
    'free_agent_pickup': <Search className="w-4 h-4" />
  };

  useEffect(() => {
    loadPlayers();
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      loadPlayerJourney();
    }
  }, [selectedPlayer, selectedSeasons]);

  const loadPlayers = async () => {
    try {
      const response = await window.ezsite.apis.tablePage(12870, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) throw response.error;
      setPlayers(response.data.List);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: 'Error',
        description: 'Failed to load players',
        variant: 'destructive'
      });
    }
  };

  const loadSeasons = async () => {
    try {
      const response = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: []
      });

      if (response.error) throw response.error;
      setSeasons(response.data.List);
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load seasons',
        variant: 'destructive'
      });
    }
  };

  const loadPlayerJourney = async () => {
    if (!selectedPlayer) return;

    try {
      setLoading(true);
      const journey = await historicalDataService.getPlayerJourney(
        selectedPlayer,
        selectedSeasons.length > 0 ? selectedSeasons : undefined
      );
      setJourneyEntries(journey);
    } catch (error) {
      console.error('Error loading player journey:', error);
      toast({
        title: 'Error',
        description: 'Failed to load player journey',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.player_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActionDescription = (entry: PlayerJourneyEntry) => {
    switch (entry.action_type) {
      case 'trade':
        return `Traded from ${entry.from_team} to ${entry.to_team}`;
      case 'add':
        return `Added to ${entry.team_name}`;
      case 'drop':
        return `Dropped from ${entry.team_name}`;
      case 'waiver_claim':
        return `Claimed by ${entry.team_name}${entry.faab_cost ? ` for $${entry.faab_cost}` : ''}`;
      case 'free_agent_pickup':
        return `Picked up by ${entry.team_name}`;
      default:
        return entry.action_type;
    }
  };

  const selectedPlayerData = players.find(p => p.id === selectedPlayer);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Player Journey Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={selectedPlayer?.toString() || ''} onValueChange={(value) => setSelectedPlayer(parseInt(value))}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select a player" />
            </SelectTrigger>
            <SelectContent>
              {filteredPlayers.map((player) => (
                <SelectItem key={player.id} value={player.id.toString()}>
                  {player.player_name} ({player.position})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value="all" onValueChange={() => {}}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Seasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id.toString()}>
                  {season.season_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPlayerData && (
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <Avatar className="w-12 h-12">
              <AvatarFallback>
                {selectedPlayerData.player_name.split(' ').map((n: string) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{selectedPlayerData.player_name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="outline">{selectedPlayerData.position}</Badge>
                <span>{selectedPlayerData.nfl_team}</span>
                {selectedPlayerData.age && <span>Age: {selectedPlayerData.age}</span>}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading player journey...</p>
          </div>
        ) : !selectedPlayer ? (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Select a player to view their journey</p>
          </div>
        ) : journeyEntries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No journey entries found for this player</p>
          </div>
        ) : (
          <div className="space-y-4">
            {journeyEntries.map((entry, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  {actionTypeIcons[entry.action_type as keyof typeof actionTypeIcons] || <Calendar className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      className={actionTypeColors[entry.action_type as keyof typeof actionTypeColors] || 'bg-gray-100 text-gray-800'}
                    >
                      {entry.action_type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">{entry.season_year}</Badge>
                    <Badge variant="secondary">Week {entry.week}</Badge>
                  </div>
                  <p className="font-medium text-gray-900 mb-1">
                    {getActionDescription(entry)}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{formatDate(entry.transaction_date)}</span>
                    <span>{entry.season_name}</span>
                    {entry.faab_cost && (
                      <span className="text-green-600 font-medium">
                        ${entry.faab_cost} FAAB
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {journeyEntries.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Journey Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Total Moves:</span>
                <span className="font-medium ml-2">{journeyEntries.length}</span>
              </div>
              <div>
                <span className="text-blue-700">Seasons Active:</span>
                <span className="font-medium ml-2">
                  {new Set(journeyEntries.map(e => e.season_year)).size}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Teams Played For:</span>
                <span className="font-medium ml-2">
                  {new Set(journeyEntries.map(e => e.team_name)).size}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Total FAAB Cost:</span>
                <span className="font-medium ml-2">
                  ${journeyEntries.reduce((sum, e) => sum + (e.faab_cost || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerJourneyTimeline;
