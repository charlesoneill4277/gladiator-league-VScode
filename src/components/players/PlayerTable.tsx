import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePlayerFilters } from '@/contexts/PlayerFilterContext';
import { FixedSizeList as List } from 'react-window';
import { useVirtual } from '@tanstack/react-virtual';

interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  avgPoints: number;
  projectedPoints: number;
  status: string;
  rosteredBy: string | null;
  rosteredByOwner: string | null;
  injuryStatus: string | null;
  gamesPlayed: number;
  age?: number;
  draftPosition?: number;
  experience?: number;
  conference?: string;
  isOwnedByMultipleTeams?: boolean;
}

interface PlayerTableProps {
  players: Player[];
  isLoading?: boolean;
  error?: string;
  enableVirtualization?: boolean;
  onPlayerSelect?: (player: Player) => void;
  className?: string;
}

const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  isLoading = false,
  error,
  enableVirtualization = false,
  onPlayerSelect,
  className = ''
}) => {
  const { filters, updateFilter } = usePlayerFilters();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);

  // Sort players based on current filters
  const sortedPlayers = useMemo(() => {
    if (!players) return [];
    
    const sortedArray = [...players].sort((a, b) => {
      const { sortBy, sortDirection } = filters;
      let aValue: any = a[sortBy as keyof Player];
      let bValue: any = b[sortBy as keyof Player];
      
      // Handle null/undefined values
      if (aValue == null) aValue = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bValue == null) bValue = sortDirection === 'asc' ? Infinity : -Infinity;
      
      // Handle string vs number comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortedArray;
  }, [players, filters.sortBy, filters.sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedPlayers.length / filters.pageSize);
  const startIndex = (filters.page - 1) * filters.pageSize;
  const endIndex = startIndex + filters.pageSize;
  const currentPagePlayers = sortedPlayers.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (column: string) => {
    if (filters.sortBy === column) {
      updateFilter('sortDirection', filters.sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      updateFilter('sortBy', column);
      updateFilter('sortDirection', 'desc');
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    updateFilter('page', newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: string) => {
    updateFilter('pageSize', parseInt(newSize));
    updateFilter('page', 1); // Reset to first page
  };

  // Handle row selection
  const handleRowSelect = (playerId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedRows);
    if (isSelected) {
      newSelected.add(playerId);
    } else {
      newSelected.delete(playerId);
    }
    setSelectedRows(newSelected);
  };

  // Get position color
  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'K': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'DEF': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'DL': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'LB': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'DB': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Get status badge
  const getStatusBadge = (status: string, injuryStatus: string | null) => {
    if (injuryStatus) {
      const variants: {[key: string]: string} = {
        'IR': 'destructive',
        'O': 'destructive',
        'D': 'destructive',
        'Q': 'secondary',
        'P': 'outline'
      };
      return <Badge variant={variants[injuryStatus] || 'outline'} className="text-xs">{injuryStatus}</Badge>;
    }

    return status === 'free_agent' ?
      <Badge variant="outline" className="text-xs">FA</Badge> :
      <Badge variant="secondary" className="text-xs">Rostered</Badge>;
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (filters.sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />;
    }
    return filters.sortDirection === 'asc' ?
      <ArrowUp className="ml-1 h-3 w-3" /> :
      <ArrowDown className="ml-1 h-3 w-3" />;
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Player Database</CardTitle>
            <CardDescription>
              {isLoading ? 'Loading...' : `${sortedPlayers.length} players found`}
              {selectedRows.size > 0 && ` • ${selectedRows.size} selected`}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : sortedPlayers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-lg font-semibold mb-2">No players found</div>
            <p className="text-muted-foreground">
              Try adjusting your filters or search criteria.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border" ref={tableRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === currentPagePlayers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(new Set(currentPagePlayers.map(p => p.id)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                        Player {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('position')}>
                        Pos {getSortIcon('position')}
                      </Button>
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('points')}>
                        Points {getSortIcon('points')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('avgPoints')}>
                        Avg {getSortIcon('avgPoints')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('projectedPoints')}>
                        Proj {getSortIcon('projectedPoints')}
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Rostered By</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPagePlayers.map((player) => (
                    <TableRow 
                      key={player.id} 
                      className={`hover:bg-muted/50 ${selectedRows.has(player.id) ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(player.id)}
                          onChange={(e) => handleRowSelect(player.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground sm:hidden">
                          {player.nflTeam}
                        </div>
                        {player.isOwnedByMultipleTeams && (
                          <Badge variant="outline" className="text-xs mt-1">Multi-owned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPositionColor(player.position)}>
                          {player.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{player.nflTeam}</TableCell>
                      <TableCell className="text-right font-mono">
                        {player.points?.toFixed(1) || '0.0'}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell">
                        {player.avgPoints?.toFixed(1) || '0.0'}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden lg:table-cell">
                        {player.projectedPoints?.toFixed(1) || '0.0'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(player.status, player.injuryStatus)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {player.rosteredBy ? (
                          <div>
                            <div className="text-sm font-medium">{player.rosteredBy}</div>
                            <div className="text-xs text-muted-foreground">{player.rosteredByOwner}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Free Agent</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link to={`/players/${player.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedPlayers.length)} of {sortedPlayers.length} players
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page === 1}
                    onClick={() => handlePageChange(filters.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      const isCurrentPage = page === filters.page;
                      return (
                        <Button
                          key={page}
                          variant={isCurrentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className="w-8"
                        >
                          {page}
                        </Button>
                      );
                    })}
                    {totalPages > 5 && (
                      <>
                        <span className="text-muted-foreground">...</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(totalPages)}
                          className="w-8"
                        >
                          {totalPages}
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page === totalPages}
                    onClick={() => handlePageChange(filters.page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerTable;
