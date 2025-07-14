import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, X, Clock, User } from 'lucide-react';
import { usePlayerFilters } from '@/contexts/PlayerFilterContext';

interface SearchSuggestion {
  type: 'player' | 'team' | 'owner' | 'recent';
  value: string;
  label: string;
  meta?: string;
}

interface PlayerSearchBarProps {
  onFocus?: () => void;
  autoFocus?: boolean;
  suggestions?: SearchSuggestion[];
  className?: string;
}

const PlayerSearchBar = React.forwardRef<HTMLInputElement, PlayerSearchBarProps>(({
  onFocus,
  autoFocus = false,
  suggestions = [],
  className = ''
}, ref) => {
  const { filters, updateFilter, debouncedSearch } = usePlayerFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine refs
  const combinedRef = useCallback((node: HTMLInputElement) => {
    inputRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('playerSearchHistory');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse search history:', error);
      }
    }
  }, []);

  // Save to recent searches when search changes
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.trim() && debouncedSearch.length > 2) {
      const newRecent = [debouncedSearch, ...recentSearches.filter((s) => s !== debouncedSearch)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('playerSearchHistory', JSON.stringify(newRecent));
    }
  }, [debouncedSearch, recentSearches]);

  // Auto focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
    onFocus?.();
  };

  // Handle search input change
  const handleInputChange = (value: string) => {
    updateFilter('search', value);
    setIsOpen(value.length > 0);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    updateFilter('search', suggestion.value);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Clear search
  const clearSearch = () => {
    updateFilter('search', '');
    inputRef.current?.focus();
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('playerSearchHistory');
  };

  // Generate combined suggestions
  const combinedSuggestions: SearchSuggestion[] = [
  // Recent searches
  ...recentSearches.map((search) => ({
    type: 'recent' as const,
    value: search,
    label: search,
    meta: 'Recent'
  })),
  // Provided suggestions
  ...suggestions.filter((s) =>
  s.label.toLowerCase().includes(filters.search.toLowerCase()) ||
  s.value.toLowerCase().includes(filters.search.toLowerCase())
  )];


  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={ref || inputRef}
              placeholder="Search players, teams, owners..."
              value={filters.search}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleFocus}
              className="pl-10 pr-8" />

            {filters.search &&
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}>

                <X className="h-3 w-3" />
              </Button>
            }
          </div>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandList>
              {combinedSuggestions.length === 0 ?
              <CommandEmpty>
                  {filters.search ? 'No suggestions found' : 'Start typing to search...'}
                </CommandEmpty> :

              <>
                  {/* Recent searches */}
                  {recentSearches.length > 0 &&
                <CommandGroup heading="Recent Searches">
                      {recentSearches.map((search, index) =>
                  <CommandItem
                    key={`recent-${index}`}
                    value={search}
                    onSelect={() => handleSuggestionSelect({
                      type: 'recent',
                      value: search,
                      label: search
                    })}>

                          <Clock className="mr-2 h-4 w-4" />
                          <span>{search}</span>
                        </CommandItem>
                  )}
                      <CommandItem onSelect={clearRecentSearches}>
                        <X className="mr-2 h-4 w-4" />
                        <span className="text-muted-foreground">Clear recent searches</span>
                      </CommandItem>
                    </CommandGroup>
                }

                  {/* Player suggestions */}
                  {suggestions.filter((s) => s.type === 'player').length > 0 &&
                <CommandGroup heading="Players">
                      {suggestions.
                  filter((s) => s.type === 'player').
                  slice(0, 5).
                  map((suggestion, index) =>
                  <CommandItem
                    key={`player-${index}`}
                    value={suggestion.value}
                    onSelect={() => handleSuggestionSelect(suggestion)}>

                            <User className="mr-2 h-4 w-4" />
                            <div className="flex flex-col">
                              <span>{suggestion.label}</span>
                              {suggestion.meta &&
                      <span className="text-xs text-muted-foreground">
                                  {suggestion.meta}
                                </span>
                      }
                            </div>
                          </CommandItem>
                  )}
                    </CommandGroup>
                }

                  {/* Team suggestions */}
                  {suggestions.filter((s) => s.type === 'team').length > 0 &&
                <CommandGroup heading="Teams">
                      {suggestions.
                  filter((s) => s.type === 'team').
                  slice(0, 3).
                  map((suggestion, index) =>
                  <CommandItem
                    key={`team-${index}`}
                    value={suggestion.value}
                    onSelect={() => handleSuggestionSelect(suggestion)}>

                            <div className="flex flex-col">
                              <span>{suggestion.label}</span>
                              {suggestion.meta &&
                      <span className="text-xs text-muted-foreground">
                                  {suggestion.meta}
                                </span>
                      }
                            </div>
                          </CommandItem>
                  )}
                    </CommandGroup>
                }

                  {/* Owner suggestions */}
                  {suggestions.filter((s) => s.type === 'owner').length > 0 &&
                <CommandGroup heading="Owners">
                      {suggestions.
                  filter((s) => s.type === 'owner').
                  slice(0, 3).
                  map((suggestion, index) =>
                  <CommandItem
                    key={`owner-${index}`}
                    value={suggestion.value}
                    onSelect={() => handleSuggestionSelect(suggestion)}>

                            <User className="mr-2 h-4 w-4" />
                            <div className="flex flex-col">
                              <span>{suggestion.label}</span>
                              {suggestion.meta &&
                      <span className="text-xs text-muted-foreground">
                                  {suggestion.meta}
                                </span>
                      }
                            </div>
                          </CommandItem>
                  )}
                    </CommandGroup>
                }
                </>
              }
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Search tips */}
      {filters.search &&
      <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            Press Enter to search
          </Badge>
          <Badge variant="outline" className="text-xs">
            Ctrl+F to focus
          </Badge>
        </div>
      }
    </div>);

});

export default PlayerSearchBar;