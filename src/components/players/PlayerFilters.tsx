import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Filter, X, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react';
import { usePlayerFilters, filterOptions } from '@/contexts/PlayerFilterContext';

interface PlayerFiltersProps {
  className?: string;
  showAdvanced?: boolean;
  onExport?: () => void;
  onImport?: () => void;
}

const PlayerFilters: React.FC<PlayerFiltersProps> = ({
  className = '',
  showAdvanced = true,
  onExport,
  onImport
}) => {
  const {
    filters,
    updateFilter,
    clearFilters,
    exportFilters,
    importFilters,
    getFilterCount
  } = usePlayerFilters();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const filterCount = getFilterCount();

  // Handle filter export
  const handleExport = () => {
    const filterString = exportFilters();
    navigator.clipboard.writeText(filterString);
    onExport?.();
  };

  // Handle filter import
  const handleImport = () => {
    navigator.clipboard.readText().then((text) => {
      importFilters(text);
      onImport?.();
    }).catch((err) => {
      console.error('Failed to read clipboard:', err);
    });
  };

  // Get position label
  const getPositionLabel = (position: string) => {
    switch (position) {
      case 'all':return 'All Positions';
      default:return position;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-base">Filters</CardTitle>
            {filterCount > 0 &&
            <Badge variant="secondary">{filterCount}</Badge>
            }
          </div>
          <div className="flex items-center space-x-2">
            {showAdvanced &&
            <>
                <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                className="text-xs">

                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button
                variant="ghost"
                size="sm"
                onClick={handleImport}
                className="text-xs">

                  <Upload className="h-3 w-3 mr-1" />
                  Import
                </Button>
              </>
            }
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={filterCount === 0}>

              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Position Filter */}
          <div className="space-y-2">
            <Label>Position</Label>
            <Select value={filters.position} onValueChange={(value) => updateFilter('position', value)}>
              <SelectTrigger>
                <SelectValue>{getPositionLabel(filters.position)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filterOptions.positions.map((position) =>
                <SelectItem key={position} value={position}>
                    {getPositionLabel(position)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* NFL Team Filter */}
          <div className="space-y-2">
            <Label>NFL Team</Label>
            <Select value={filters.nflTeam} onValueChange={(value) => updateFilter('nflTeam', value)}>
              <SelectTrigger>
                <SelectValue>{filters.nflTeam === 'all' ? 'All Teams' : filters.nflTeam}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filterOptions.nflTeams.map((team) =>
                <SelectItem key={team} value={team}>
                    {team === 'all' ? 'All Teams' : team}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Conference Filter */}
          <div className="space-y-2">
            <Label>Conference</Label>
            <Select value={filters.conference} onValueChange={(value) => updateFilter('conference', value)}>
              <SelectTrigger>
                <SelectValue>
                  {filters.conference === 'all' ? 'All Conferences' :
                  filters.conference === 'mars' ? 'Legions of Mars' :
                  filters.conference === 'jupiter' ? 'Guardians of Jupiter' :
                  filters.conference === 'vulcan' ? 'Vulcan\'s Oathsworn' :
                  filters.conference}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conferences</SelectItem>
                <SelectItem value="mars">Legions of Mars</SelectItem>
                <SelectItem value="jupiter">Guardians of Jupiter</SelectItem>
                <SelectItem value="vulcan">Vulcan's Oathsworn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced &&
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>Advanced Filters</span>
                {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 mt-4">
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Availability Status */}
                <div className="space-y-2">
                  <Label>Availability</Label>
                  <Select value={filters.availabilityStatus} onValueChange={(value) => updateFilter('availabilityStatus', value)}>
                    <SelectTrigger>
                      <SelectValue>
                        {filters.availabilityStatus === 'all' ? 'All Players' :
                      filters.availabilityStatus === 'available' ? 'Available' :
                      filters.availabilityStatus === 'owned' ? 'Owned' :
                      filters.availabilityStatus === 'waivers' ? 'On Waivers' :
                      filters.availabilityStatus}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Players</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="owned">Owned</SelectItem>
                      <SelectItem value="waivers">On Waivers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Injury Status */}
                <div className="space-y-2">
                  <Label>Injury Status</Label>
                  <Select value={filters.injuryStatus} onValueChange={(value) => updateFilter('injuryStatus', value)}>
                    <SelectTrigger>
                      <SelectValue>
                        {filters.injuryStatus === 'all' ? 'All' :
                      filters.injuryStatus === 'healthy' ? 'Healthy' :
                      filters.injuryStatus}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.injuryStatuses.map((status) =>
                    <SelectItem key={status} value={status}>
                          {status === 'all' ? 'All' :
                      status === 'healthy' ? 'Healthy' :
                      status}
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Roster Status */}
                <div className="space-y-2">
                  <Label>Roster Status</Label>
                  <Select value={filters.rosterStatus} onValueChange={(value) => updateFilter('rosterStatus', value)}>
                    <SelectTrigger>
                      <SelectValue>
                        {filters.rosterStatus === 'all' ? 'All' :
                      filters.rosterStatus === 'active' ? 'Active' :
                      filters.rosterStatus === 'bench' ? 'Bench' :
                      filters.rosterStatus === 'ir' ? 'IR' :
                      filters.rosterStatus === 'taxi' ? 'Taxi Squad' :
                      filters.rosterStatus === 'free_agent' ? 'Free Agent' :
                      filters.rosterStatus}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.rosterStatuses.map((status) =>
                    <SelectItem key={status} value={status}>
                          {status === 'all' ? 'All' :
                      status === 'active' ? 'Active' :
                      status === 'bench' ? 'Bench' :
                      status === 'ir' ? 'IR' :
                      status === 'taxi' ? 'Taxi Squad' :
                      status === 'free_agent' ? 'Free Agent' :
                      status}
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Special Filters */}
              <div className="space-y-4">
                <Label>Special Filters</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                  id="multiple-teams"
                  checked={filters.ownedByMultipleTeams}
                  onCheckedChange={(checked) => updateFilter('ownedByMultipleTeams', checked)} />

                  <Label htmlFor="multiple-teams">
                    Show players owned by multiple teams
                  </Label>
                </div>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <Label>Sort By</Label>
                <div className="flex space-x-2">
                  <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.sortOptions.map((option) =>
                    <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                  <Select value={filters.sortDirection} onValueChange={(value) => updateFilter('sortDirection', value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">High to Low</SelectItem>
                      <SelectItem value="asc">Low to High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        }

        {/* Active Filters Summary */}
        {filterCount > 0 &&
        <div className="space-y-2">
            <Label>Active Filters ({filterCount})</Label>
            <div className="flex flex-wrap gap-2">
              {filters.search &&
            <Badge variant="secondary">
                  Search: {filters.search}
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('search', '')}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
              {filters.position !== 'all' &&
            <Badge variant="secondary">
                  Position: {getPositionLabel(filters.position)}
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('position', 'all')}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
              {filters.nflTeam !== 'all' &&
            <Badge variant="secondary">
                  NFL Team: {filters.nflTeam}
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('nflTeam', 'all')}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
              {filters.conference !== 'all' &&
            <Badge variant="secondary">
                  Conference: {filters.conference}
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('conference', 'all')}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
              {filters.availabilityStatus !== 'all' &&
            <Badge variant="secondary">
                  Availability: {filters.availabilityStatus}
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('availabilityStatus', 'all')}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
              {filters.ownedByMultipleTeams &&
            <Badge variant="secondary">
                  Multi-owned
                  <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => updateFilter('ownedByMultipleTeams', false)}>

                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
            }
            </div>
          </div>
        }
      </CardContent>
    </Card>);

};

export default PlayerFilters;