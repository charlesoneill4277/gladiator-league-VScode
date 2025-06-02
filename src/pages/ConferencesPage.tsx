import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import ConferencesDataLoader from '@/components/ConferencesDataLoader';
import { Trophy, Users, Calendar, ExternalLink } from 'lucide-react';

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

interface Season {
  id: number;
  season_year: number;
  season_name: string;
  is_current_season: boolean;
}

const ConferencesPage: React.FC = () => {
  const { toast } = useToast();
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDataLoader, setShowDataLoader] = useState(false);

  const fetchSeasons = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'season_year',
        IsAsc: true,
        Filters: []
      });

      if (error) throw new Error(error);
      setSeasons(data.List || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      toast({
        title: "Error",
        description: "Failed to load seasons data",
        variant: "destructive"
      });
    }
  };

  const fetchConferences = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      });

      if (error) throw new Error(error);
      setConferences(data.List || []);
    } catch (error) {
      console.error('Error fetching conferences:', error);
      toast({
        title: "Error",
        description: "Failed to load conferences data",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchSeasons(), fetchConferences()]);
      setIsLoading(false);
    };

    loadData();
  }, []);

  const getSeasonName = (seasonId: number): string => {
    const season = seasons.find(s => s.id === seasonId);
    return season ? season.season_name : `Season ${seasonId}`;
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'in_season':
        return 'bg-green-500';
      case 'complete':
        return 'bg-blue-500';
      case 'drafting':
        return 'bg-orange-500';
      case 'pre_draft':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading conferences...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-600" />
            Conferences
          </h1>
          <p className="text-gray-600 mt-1">
            Fantasy football conferences and leagues
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDataLoader(!showDataLoader)}
          >
            {showDataLoader ? 'Hide' : 'Show'} Data Loader
          </Button>
          
          <Button
            onClick={() => {
              fetchConferences();
              toast({
                title: "Refreshed",
                description: "Conferences data has been refreshed"
              });
            }}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Data Loader Component */}
      {showDataLoader && (
        <Card>
          <CardContent className="p-0">
            <ConferencesDataLoader />
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{conferences.length}</div>
                <div className="text-sm text-gray-600">Total Conferences</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {conferences.filter(c => c.status === 'in_season').length}
                </div>
                <div className="text-sm text-gray-600">Active Seasons</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold">
                  {seasons.length}
                </div>
                <div className="text-sm text-gray-600">Total Seasons</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conferences Table */}
      <Card>
        <CardHeader>
          <CardTitle>Conference Details</CardTitle>
        </CardHeader>
        <CardContent>
          {conferences.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No conferences found.</p>
              <Button 
                onClick={() => setShowDataLoader(true)}
                variant="outline"
              >
                Load Conferences Data
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Conference Name</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>League ID</TableHead>
                    <TableHead>Draft ID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferences.map((conference) => (
                    <TableRow key={conference.id}>
                      <TableCell>
                        {conference.league_logo_url ? (
                          <img
                            src={conference.league_logo_url}
                            alt={`${conference.conference_name} logo`}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {conference.conference_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getSeasonName(conference.season_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`text-white ${getStatusBadgeColor(conference.status)}`}
                        >
                          {formatStatus(conference.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {conference.league_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {conference.draft_id || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            window.open(
                              `https://sleeper.app/leagues/${conference.league_id}`,
                              '_blank'
                            );
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConferencesPage;