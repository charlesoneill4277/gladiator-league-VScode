import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Save, RefreshCw } from 'lucide-react';
import { DatabaseService, DbSeason, DbPlayoffFormat } from '@/services/databaseService';

const PlayoffFormatManager: React.FC = () => {
  const [seasons, setSeasons] = useState<DbSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [playoffFormat, setPlayoffFormat] = useState<DbPlayoffFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    playoff_teams: 10,
    first_round_byes: 6,
    playoff_start_week: 14,
    reseed: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadPlayoffFormat();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const response = await DatabaseService.getSeasons({
        orderBy: { column: 'season_year', ascending: false }
      });

      if (response.error) {
        throw new Error('Failed to load seasons');
      }

      setSeasons(response.data);
      
      // Auto-select current season if available
      const currentSeason = response.data.find(s => s.is_current);
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: "Error",
        description: "Failed to load seasons",
        variant: "destructive"
      });
    }
  };

  const loadPlayoffFormat = async () => {
    if (!selectedSeasonId) return;

    setLoading(true);
    try {
      const response = await DatabaseService.getPlayoffFormats({
        filters: [
          { column: 'season_id', operator: 'eq', value: selectedSeasonId },
          { column: 'is_active', operator: 'eq', value: true }
        ]
      });

      if (response.error) {
        throw new Error('Failed to load playoff format');
      }

      if (response.data.length > 0) {
        const format = response.data[0];
        setPlayoffFormat(format);
        setFormData({
          playoff_teams: format.playoff_teams,
          first_round_byes: format.week_14_byes, // Map week_14_byes to first_round_byes
          playoff_start_week: format.playoff_start_week,
          reseed: format.reseed
        });
      } else {
        // No playoff format exists, use defaults
        setPlayoffFormat(null);
        setFormData({
          playoff_teams: 10,
          first_round_byes: 6,
          playoff_start_week: 14,
          reseed: true
        });
      }
    } catch (error) {
      console.error('Error loading playoff format:', error);
      toast({
        title: "Error",
        description: "Failed to load playoff format",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSeasonId) {
      toast({
        title: "Error",
        description: "Please select a season",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const playoffFormatData = {
        season_id: selectedSeasonId,
        playoff_teams: formData.playoff_teams,
        week_14_byes: formData.first_round_byes, // Map first_round_byes to week_14_byes
        playoff_start_week: formData.playoff_start_week,
        reseed: formData.reseed,
        championship_week: 17, // Default value
        is_active: true
      };

      let response;
      if (playoffFormat) {
        // Update existing format
        response = await DatabaseService.updatePlayoffFormat(playoffFormat.id, playoffFormatData);
      } else {
        // Create new format
        response = await DatabaseService.createPlayoffFormat(playoffFormatData);
      }

      if (response.error) {
        throw new Error('Failed to save playoff format');
      }

      setPlayoffFormat(response.data);
      toast({
        title: "Success",
        description: "Playoff format saved successfully",
      });

      // Reload the data to ensure consistency
      await loadPlayoffFormat();
    } catch (error) {
      console.error('Error saving playoff format:', error);
      toast({
        title: "Error",
        description: "Failed to save playoff format",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Playoff Format Management
          </CardTitle>
          <CardDescription>
            Configure playoff settings for each season including teams, byes, and format rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Season Filter */}
          <div className="space-y-2">
            <Label htmlFor="season-select">Season</Label>
            <Select
              value={selectedSeasonId?.toString() || ""}
              onValueChange={(value) => setSelectedSeasonId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id.toString()}>
                    {season.season_name} ({season.season_year})
                    {season.is_current && " - Current"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSeasonId && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading playoff format...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Playoff Teams */}
                  <div className="space-y-2">
                    <Label htmlFor="playoff-teams">Playoff Teams</Label>
                    <Input
                      id="playoff-teams"
                      type="number"
                      min="4"
                      max="16"
                      value={formData.playoff_teams}
                      onChange={(e) => handleInputChange('playoff_teams', parseInt(e.target.value))}
                      placeholder="Number of teams in playoffs"
                    />
                    <p className="text-sm text-muted-foreground">
                      Total number of teams that make the playoffs
                    </p>
                  </div>

                  {/* First Round Byes */}
                  <div className="space-y-2">
                    <Label htmlFor="first-round-byes">First Round Byes</Label>
                    <Input
                      id="first-round-byes"
                      type="number"
                      min="0"
                      max="8"
                      value={formData.first_round_byes}
                      onChange={(e) => handleInputChange('first_round_byes', parseInt(e.target.value))}
                      placeholder="Number of teams with first round byes"
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of top-seeded teams that skip the first round
                    </p>
                  </div>

                  {/* Playoff Start Week */}
                  <div className="space-y-2">
                    <Label htmlFor="playoff-start-week">Playoff Start Week</Label>
                    <Input
                      id="playoff-start-week"
                      type="number"
                      min="1"
                      max="18"
                      value={formData.playoff_start_week}
                      onChange={(e) => handleInputChange('playoff_start_week', parseInt(e.target.value))}
                      placeholder="Week when playoffs begin"
                    />
                    <p className="text-sm text-muted-foreground">
                      NFL week when playoff games start
                    </p>
                  </div>

                  {/* Reseed Checkbox */}
                  <div className="space-y-2">
                    <Label>Playoff Reseeding</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reseed"
                        checked={formData.reseed}
                        onCheckedChange={(checked) => handleInputChange('reseed', checked)}
                      />
                      <Label htmlFor="reseed" className="text-sm font-normal">
                        Reseed teams after each playoff round
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If checked, teams are reseeded after each round (highest seed plays lowest seed)
                    </p>
                  </div>
                </div>
              )}

              {/* Current Values Display */}
              {playoffFormat && !loading && (
                <Alert>
                  <AlertDescription>
                    <strong>Current Settings for {selectedSeason?.season_name}:</strong>
                    <br />
                    Playoff Teams: {playoffFormat.playoff_teams} | 
                    First Round Byes: {playoffFormat.week_14_byes} | 
                    Start Week: {playoffFormat.playoff_start_week} | 
                    Reseed: {playoffFormat.reseed ? 'Yes' : 'No'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={saving || loading}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Playoff Format'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayoffFormatManager;