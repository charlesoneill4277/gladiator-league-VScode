# Conference Service Implementation Guide

## Overview

The Conference Service provides a centralized solution for managing conference data, league IDs, and conference-related operations across the application. This implementation addresses the critical issues of hardcoded league mappings and provides a scalable, maintainable solution.

## Key Components

### 1. ConferenceService (`src/services/conferenceService.ts`)

A singleton service class that handles all conference-related data operations:

```typescript
import { conferenceService } from '@/services/conferenceService';

// Get all conferences for a season
const result = await conferenceService.getConferencesForSeason(2024);
if (result.data) {
  console.log('Conferences:', result.data);
}

// Get specific conference by ID
const conference = await conferenceService.getConferenceById('mars', 2024);

// Get league ID for a conference
const leagueId = await conferenceService.getLeagueIdForConference('mars', 2024);

// Validate league ID exists
const isValid = await conferenceService.validateLeagueId('1072580179844857856', 2024);
```

### 2. React Query Hooks (`src/hooks/useConferences.ts`)

React hooks that provide caching, loading states, and error handling:

```typescript
import { useConferences, useConference, useLeagueId } from '@/hooks/useConferences';

// Get all conferences with caching
const { conferences, loading, error, getConferenceById } = useConferences({ 
  seasonYear: 2024 
});

// Get specific conference
const { data: conference, isLoading } = useConference('mars', 2024);

// Get league ID with validation
const { data: leagueId, isLoading, error } = useLeagueId('mars', 2024);
```

### 3. Utility Functions (`src/utils/conferenceUtils.ts`)

Helper functions for common conference operations:

```typescript
import { 
  findConferenceByName, 
  getConferenceDisplayInfo, 
  isValidLeagueId 
} from '@/utils/conferenceUtils';

// Find conference by name with fuzzy matching
const conference = findConferenceByName(conferences, 'Legions of Mars');

// Get display info with fallbacks
const displayInfo = getConferenceDisplayInfo(conferences, conferenceId);

// Validate league ID format
const isValid = isValidLeagueId(leagueId);
```

### 4. Validated Components

Components that handle league ID validation automatically:

```typescript
import ValidatedMatchupRosterDisplay from '@/components/matchups/ValidatedMatchupRosterDisplay';

<ValidatedMatchupRosterDisplay
  conferenceId="mars"
  conferenceName="Legions of Mars"
  week={14}
  matchupId={123}
  seasonYear={2024}
/>
```

## Migration from Hardcoded Mappings

### Before (Problematic):
```typescript
// ❌ Hardcoded mapping - not scalable
const conferenceMapping: {[key: string]: string;} = {
  'Legions of Mars': 'mars',
  'Guardians of Jupiter': 'jupiter',
  "Vulcan's Oathsworn": 'vulcan'
};
const conferenceKey = conferenceMapping[matchup.conference];
const leagueId = currentSeasonConfig.conferences.find((c) => c.id === conferenceKey)?.leagueId || '';
```

### After (Centralized):
```typescript
// ✅ Using conference service - scalable and maintainable
const { conferences } = useConferences({ seasonYear: selectedSeason });
const conference = findConferenceByName(conferences, matchup.conference);
const leagueId = conference?.leagueId || '';
```

## Features

### ✅ Implemented Features

1. **Dynamic League ID Resolution**: Fetches league IDs from database instead of hardcoded mappings
2. **Centralized Conference Management**: Single source of truth for conference data
3. **League ID Validation**: Validates league IDs before API calls
4. **Caching**: 5-minute cache to reduce database calls
5. **Error Handling**: Comprehensive error handling with user-friendly messages
6. **Loading States**: Proper loading indicators during data fetching
7. **Fuzzy Name Matching**: Handles variations in conference names
8. **React Query Integration**: Built-in caching, refetching, and state management

### 🔧 Database Integration

The service integrates with the following database tables:
- `conferences`: Stores conference data including league_id
- `seasons`: Manages season information

### 🎯 Best Practices

1. **Always validate league IDs** before making API calls
2. **Use React Query hooks** for automatic caching and error handling
3. **Handle loading and error states** appropriately in components
4. **Use utility functions** for common operations
5. **Clear cache when needed** for data synchronization

### 📊 Performance Optimizations

- **Caching**: 5-minute cache for conference data
- **Single Queries**: Avoid multiple API calls for the same data
- **Error Boundaries**: Graceful error handling prevents app crashes
- **Loading States**: Prevents UI flicker during data loading

## Example Usage in Components

```typescript
import React from 'react';
import { useConferences } from '@/hooks/useConferences';
import { findConferenceByName } from '@/utils/conferenceUtils';

const MyComponent: React.FC = () => {
  const { conferences, loading, error } = useConferences({ seasonYear: 2024 });
  
  if (loading) return <div>Loading conferences...</div>;
  if (error) return <div>Error: {error}</div>;
  
  const handleConferenceSelect = (conferenceName: string) => {
    const conference = findConferenceByName(conferences, conferenceName);
    if (conference && conference.leagueId) {
      // Safe to use league ID
      console.log('League ID:', conference.leagueId);
    } else {
      console.error('Conference not found or missing league ID');
    }
  };
  
  return (
    <div>
      {conferences.map(conf => (
        <button 
          key={conf.id} 
          onClick={() => handleConferenceSelect(conf.name)}
        >
          {conf.name}
        </button>
      ))}
    </div>
  );
};
```

## Error Handling Examples

```typescript
// Service level error handling
const result = await conferenceService.getLeagueIdForConference('invalid-id');
if (result.error) {
  console.error('Service error:', result.error);
  // Handle error appropriately
}

// Hook level error handling
const { data, error } = useLeagueId('mars');
if (error) {
  // Error is automatically shown via toast
  // Component can show fallback UI
}
```

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live conference updates
2. **Advanced Caching**: Redis or IndexedDB for persistent caching
3. **Conference Analytics**: Usage tracking and performance metrics
4. **Bulk Operations**: Batch conference operations for admin functions
5. **Conference Validation**: Advanced validation rules for conference data

This implementation provides a robust, scalable foundation for conference management that eliminates hardcoded dependencies and provides excellent developer experience.