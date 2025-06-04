import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { User, Calendar, Trophy, Target, Heart, Activity } from 'lucide-react';

interface Player {
  id: number;
  player_name: string;
  position: string;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
  age: number;
  height: string;
  weight: number;
  years_experience: number;
  depth_chart_position: number;
  college: string;
  team_id: number;
  sleeper_player_id: string;
}

interface PlayerDetailModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({ player, isOpen, onClose }) => {
  if (!player) return null;

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Questionable': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Doubtful': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Out': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'IR': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const isRookie = player.years_experience <= 1;
  const isFreeAgent = player.team_id === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <User className="h-6 w-6 text-primary" />
              <span className="text-2xl font-bold">{player.player_name}</span>
              <Badge className={getPositionColor(player.position)}>
                {player.position}
              </Badge>
              {isRookie && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800">
                  ROOKIE
                </Badge>
              )}
              {isFreeAgent && (
                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                  FREE AGENT
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NFL Team:</span>
                    <span className="font-semibold">{player.nfl_team}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jersey #:</span>
                    <span className="font-semibold">#{player.jersey_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age:</span>
                    <span className="font-semibold">{player.age} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Height:</span>
                    <span className="font-semibold">{player.height}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight:</span>
                    <span className="font-semibold">{player.weight} lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">College:</span>
                    <span className="font-semibold">{player.college}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Heart className="h-5 w-5" />
                    <span>Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Injury Status:</span>
                    <Badge className={getInjuryStatusColor(player.injury_status)}>
                      {player.injury_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Roster Status:</span>
                    <Badge variant={player.status === 'Active' ? 'default' : 'secondary'}>
                      {player.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Experience:</span>
                    <span className="font-semibold">
                      {player.years_experience} {player.years_experience === 1 ? 'year' : 'years'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Depth Chart:</span>
                    <span className="font-semibold">#{player.depth_chart_position}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Season Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="h-5 w-5" />
                    <span>Season Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Stats Coming Soon</h3>
                    <p className="text-muted-foreground">
                      Detailed scoring and performance stats will be available once integrated with Sleeper API.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Projections Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Projections</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Projections Coming Soon</h3>
                    <p className="text-muted-foreground">
                      Weekly projections and matchup analysis will be available soon.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Player Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Physical Attributes</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Height:</span>
                        <span>{player.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight:</span>
                        <span>{player.weight} lbs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age:</span>
                        <span>{player.age} years old</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">Career Info</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">College:</span>
                        <span>{player.college}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NFL Experience:</span>
                        <span>{player.years_experience} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sleeper ID:</span>
                        <span className="font-mono text-sm">{player.sleeper_player_id}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Experience Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>NFL Experience</span>
                    <span>{player.years_experience} / 15+ years</span>
                  </div>
                  <Progress 
                    value={Math.min((player.years_experience / 15) * 100, 100)} 
                    className="w-full" 
                  />
                </div>

                {/* Special Badges */}
                <div className="flex flex-wrap gap-2 pt-4">
                  {isRookie && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      🏅 Rookie
                    </Badge>
                  )}
                  {isFreeAgent && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      🆓 Free Agent
                    </Badge>
                  )}
                  {player.years_experience >= 10 && (
                    <Badge variant="outline" className="bg-gold-100 text-gold-800">
                      🏆 Veteran
                    </Badge>
                  )}
                  {player.depth_chart_position === 1 && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      ⭐ Starter
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerDetailModal;