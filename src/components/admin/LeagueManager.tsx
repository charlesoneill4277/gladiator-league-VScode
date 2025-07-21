import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Plus, Save, TestTube, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { DatabaseService } from '@/services/databaseService';

interface Season {
  id: number;
  season_year: number;
  season_name: string;
  is_current_season: boolean;
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

const LeagueManager: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [editingConference, setEditingConference] = useState<Conference | null>(null);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  // New season form
  const [newSeasonYear, setNewSeasonYear] = useState('');
  const [newSeasonName, setNewSeasonName] = useState('');

  // New league form
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueId, setNewLeagueId] = useState('');

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadConferences();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const seasonsData = await DatabaseService.getSeasons();
      const seasonsList = Array.isArray(seasonsData) ? seasonsData : seasonsData?.data || [];
      // Convert DbSeason to Season interface for compatibility
      const compatibleSeasons = seasonsList.map((s: any) => ({
        ...s,
        is_current_season: s.is_current_season ?? false
      }));
      setSeasons(compatibleSeasons);

      // Auto-select current season or most recent
      const currentSeason = seasonsList.find((s: Season) => s.is_current_season);
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id);
      } else if (seasonsList.length > 0) {
        setSelectedSeasonId(seasonsList[0].id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: "Error",
        description: `Failed to load seasons: ${error}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConferences = async () => {
    if (!selectedSeasonId) return;

    try {
      const conferences = await placeholderApiCall('load conferences');
      setConferences(conferences?.data?.List || []);
    } catch (error) {
      console.error('Error loading conferences:', error);
      toast({
        title: "Error",
        description: `Failed to load conferences: ${error}`,
        variant: "destructive"
      });
    }
  };

  const handleAddSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonYear || !newSeasonName) return;

    try {
      setSaving(true);

      const result = await DatabaseService.createSeason({
        season_year: newSeasonYear,
        season_name: newSeasonName,
        is_current: false
      });

      if (result.error) throw result.error;

      toast({
        title: "Season Added",
        description: `${newSeasonName} has been created successfully`
      });

      setNewSeasonYear('');
      setNewSeasonName('');
      setShowAddSeason(false);
      loadSeasons();
    } catch (error) {
      console.error('Error adding season:', error);
      toast({
        title: "Error",
        description: `Failed to add season: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName || !newLeagueId || !selectedSeasonId) return;

    try {
      setSaving(true);

      const result = await DatabaseService.createConference({
        conference_name: newLeagueName,
        league_id: newLeagueId,
        season_id: selectedSeasonId,
        draft_id: '',
        status: 'draft',
        league_logo_url: ''
      });

      if (result.error) throw result.error;

      toast({
        title: "League Added",
        description: `${newLeagueName} has been created successfully`
      });

      setNewLeagueName('');
      setNewLeagueId('');
      setShowAddLeague(false);
      loadConferences();
    } catch (error) {
      console.error('Error adding league:', error);
      toast({
        title: "Error",
        description: `Failed to add league: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConference = async (conference: Conference) => {
    try {
      setSaving(true);

      const result = await DatabaseService.updateConference(conference.id, {
        conference_name: conference.conference_name,
        league_id: conference.league_id,
        season_id: conference.season_id,
        draft_id: conference.draft_id,
        status: conference.status,
        league_logo_url: conference.league_logo_url
      });

      if (result.error) throw result.error;

      toast({
        title: "Conference Updated",
        description: "Conference details have been saved successfully"
      });

      setEditingConference(null);
      loadConferences();
    } catch (error) {
      console.error('Error saving conference:', error);
      toast({
        title: "Error",
        description: `Failed to save conference: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testSleeperConnection = async (leagueId: string) => {
    if (!leagueId) return;

    try {
      setTesting(leagueId);

      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Connection Successful",
          description: `League "${data.name}" found on Sleeper API`
        });
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Connection Failed",
        description: `Unable to connect to Sleeper API for league ID: ${leagueId}`,
        variant: "destructive"
      });
    } finally {
      setTesting(null);
    }
  };

  // TODO: Placeholder functions for Supabase migration
  const placeholderApiCall = async (operation: string) => {
    console.log(`Placeholder: ${operation}`);
    return { data: { List: [] }, error: null };
  };

  const placeholderCreate = async (operation: string, data: any) => {
    console.log(`Placeholder Create: ${operation}`, data);
    return { error: null };
  };

  const placeholderUpdate = async (operation: string, data: any) => {
    console.log(`Placeholder Update: ${operation}`, data);
    return { error: null };
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>);

  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Season Management</CardTitle>
          <CardDescription>
            Select and manage fantasy football seasons
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="season-select">Select Season</Label>
              <Select
                value={selectedSeasonId?.toString() || ''}
                onValueChange={(value) => setSelectedSeasonId(parseInt(value))}>

                <SelectTrigger>
                  <SelectValue placeholder="Select a season" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) =>
                  <SelectItem key={season.id} value={season.id.toString()}>
                      <div className="flex items-center gap-2">
                        {season.season_name}
                        {season.is_current_season &&
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                      }
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={showAddSeason} onOpenChange={setShowAddSeason}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Season</DialogTitle>
                  <DialogDescription>
                    Create a new fantasy football season
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddSeason} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="season-year">Season Year</Label>
                    <Input
                      id="season-year"
                      type="number"
                      value={newSeasonYear}
                      onChange={(e) => setNewSeasonYear(e.target.value)}
                      placeholder="2025"
                      min="2020"
                      max="2030" />

                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="season-name">Season Name</Label>
                    <Input
                      id="season-name"
                      value={newSeasonName}
                      onChange={(e) => setNewSeasonName(e.target.value)}
                      placeholder="2025 Season" />

                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddSeason(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Adding...' : 'Add Season'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {selectedSeason &&
      <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conferences - {selectedSeason.season_name}</CardTitle>
                <CardDescription>
                  Manage league IDs and conference settings for {selectedSeason.season_name}
                </CardDescription>
              </div>
              
              <Dialog open={showAddLeague} onOpenChange={setShowAddLeague}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New League
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New League</DialogTitle>
                    <DialogDescription>
                      Add a new conference/league to {selectedSeason.season_name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddLeague} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="league-name">League Name</Label>
                      <Input
                      id="league-name"
                      value={newLeagueName}
                      onChange={(e) => setNewLeagueName(e.target.value)}
                      placeholder="Conference Name" />

                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="league-id">Sleeper League ID</Label>
                      <Input
                      id="league-id"
                      value={newLeagueId}
                      onChange={(e) => setNewLeagueId(e.target.value)}
                      placeholder="123456789012345678" />

                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowAddLeague(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Adding...' : 'Add League'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {conferences.length === 0 ?
          <Alert>
                <AlertDescription>
                  No conferences found for {selectedSeason.season_name}. Add a new league to get started.
                </AlertDescription>
              </Alert> :

          <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conference Name</TableHead>
                    <TableHead>League ID</TableHead>
                    <TableHead>Draft ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferences.map((conference) =>
              <TableRow key={conference.id}>
                      <TableCell>
                        {editingConference?.id === conference.id ?
                  <Input
                    value={editingConference.conference_name}
                    onChange={(e) => setEditingConference({
                      ...editingConference,
                      conference_name: e.target.value
                    })} /> :


                  <span className="font-medium">{conference.conference_name}</span>
                  }
                      </TableCell>
                      <TableCell>
                        {editingConference?.id === conference.id ?
                  <Input
                    value={editingConference.league_id}
                    onChange={(e) => setEditingConference({
                      ...editingConference,
                      league_id: e.target.value
                    })} /> :


                  <code className="text-sm bg-muted px-2 py-1 rounded">
                            {conference.league_id}
                          </code>
                  }
                      </TableCell>
                      <TableCell>
                        {editingConference?.id === conference.id ?
                  <Input
                    value={editingConference.draft_id}
                    onChange={(e) => setEditingConference({
                      ...editingConference,
                      draft_id: e.target.value
                    })} /> :


                  <code className="text-sm bg-muted px-2 py-1 rounded">
                            {conference.draft_id || 'Not set'}
                          </code>
                  }
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                  conference.status === 'in_season' ? 'default' :
                  conference.status === 'complete' ? 'secondary' :
                  'outline'
                  }>
                          {conference.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {editingConference?.id === conference.id ?
                    <>
                              <Button
                        size="sm"
                        onClick={() => handleSaveConference(editingConference)}
                        disabled={saving}>

                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingConference(null)}>

                                Cancel
                              </Button>
                            </> :

                    <>
                              <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingConference(conference)}>

                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testSleeperConnection(conference.league_id)}
                        disabled={testing === conference.league_id}>

                                {testing === conference.league_id ?
                        <div className="animate-spin h-4 w-4 border-b-2 border-blue-600 rounded-full" /> :

                        <TestTube className="h-4 w-4" />
                        }
                              </Button>
                            </>
                    }
                        </div>
                      </TableCell>
                    </TableRow>
              )}
                </TableBody>
              </Table>
          }
          </CardContent>
        </Card>
      }
    </div>);

};

/*
 * SUPABASE MIGRATION STATUS: PHASE 3 - PARTIAL MIGRATION
 * 
 * ✅ COMPLETED:
 * - Updated imports to use DatabaseService
 * - Converted loadSeasons() function
 * - Added placeholder functions for remaining operations
 * 
 * ❌ REMAINING WORK:
 * - Convert loadConferences() EzSite call
 * - Convert createSeason() EzSite call  
 * - Convert createConference() EzSite call
 * - Convert updateConference() EzSite call
 * - Fix interface compatibility issues
 * 
 * PRIORITY: MEDIUM (Admin configuration - important but not core user functionality)
 */

export default LeagueManager;