# League Rules Update - Scoring & Roster Settings

## Overview
Updated the League Rules page to fetch real scoring and roster settings from the database instead of using mock data. Both scoring settings and roster positions are now stored in the `seasons` table and automatically fetched from the Sleeper API when needed.

## Changes Made

### 1. Database Schema Updates
- **File**: `add-scoring-settings-column.sql`
  - Added `scoring_settings` JSONB column to the `seasons` table
  - Store fantasy football scoring configuration from Sleeper API
- **File**: `add-roster-positions-column.sql`
  - Added `roster_positions` JSONB column to the `seasons` table
  - Store roster position configuration from Sleeper API

### 2. Database Types Update
- **File**: `src/types/database.ts`
- **Actions**:
  - Added `scoring_settings?: Record<string, number>` to `DbSeason` interface
  - Added `roster_positions?: string[]` to `DbSeason` interface
- **Purpose**: TypeScript support for the new columns

### 3. Database Service Enhancement
- **File**: `src/services/databaseService.ts`
- **Actions**:
  - Added `updateSeasonScoringSettings()` method
  - Added `updateSeasonRosterPositions()` method
- **Purpose**: Fetch settings from Sleeper API and store in database

### 4. New Hooks for Settings
- **File**: `src/hooks/useScoringSettings.ts`
  - Fetches scoring settings from database
  - Automatically fetches from Sleeper API if not cached
  - Converts Sleeper API format to UI-friendly format
  - Handles loading states and errors
- **File**: `src/hooks/useRosterSettings.ts`
  - Fetches roster positions from database
  - Automatically fetches from Sleeper API if not cached
  - Converts Sleeper roster array to position counts
  - Calculates roster size and bench information

### 5. Updated League Rules Page
- **File**: `src/pages/LeagueRulesPage.tsx`
- **Changes**:
  - Removed mock scoring and roster data
  - Integrated `useScoringSettings` and `useRosterSettings` hooks
  - Removed kicking section (no kickers in league)
  - Added loading and error states for both tabs
  - Dynamic scoring and roster summaries based on real data
  - Enhanced roster tab with real position counts and sizes

## Key Features

### Automatic Data Fetching
- If scoring settings don't exist in database, automatically fetches from Sleeper API
- Caches results in database for future use
- Handles multiple conferences by using first conference's league data

### Sleeper API Mapping

#### Scoring Settings Mapping
The scoring hook maps Sleeper API scoring keys to UI-friendly format:
- `pass_yd` → Passing Yards
- `pass_td` → Passing Touchdowns  
- `pass_int` → Interceptions
- `rush_yd` → Rushing Yards
- `rush_td` → Rushing Touchdowns
- `rec_yd` → Receiving Yards
- `rec` → Receptions (PPR)
- `rec_td` → Receiving Touchdowns

#### Roster Positions Mapping
The roster hook converts Sleeper roster position arrays to position counts:
- Counts each position type (QB, RB, WR, TE, FLEX, SUPER_FLEX, DEF)
- Calculates starting lineup size from array length
- Determines bench size (total roster - starting lineup)
- Handles special positions like FLEX and SUPER_FLEX

### Error Handling
- Graceful fallback to mock data if API fails
- Clear error messages for users
- Loading states during data fetching

## Installation Steps

1. **Run Database Migrations**:
   ```sql
   -- Execute the contents of add-scoring-settings-column.sql
   ALTER TABLE seasons 
   ADD COLUMN IF NOT EXISTS scoring_settings JSONB DEFAULT NULL;
   
   -- Execute the contents of add-roster-positions-column.sql
   ALTER TABLE seasons 
   ADD COLUMN IF NOT EXISTS roster_positions JSONB DEFAULT NULL;
   ```

2. **No Code Changes Required**:
   - All changes are backward compatible
   - Existing functionality preserved with fallbacks

3. **Test the Implementation**:
   - Navigate to League Rules page
   - Verify scoring settings load from database on "Scoring" tab
   - Verify roster settings load from database on "Roster" tab
   - Check that fallbacks work if data unavailable

## Benefits

1. **Real Data**: Uses actual league scoring and roster settings instead of mock data
2. **Performance**: Caches both scoring and roster settings in database
3. **Flexibility**: Easy to update settings via Sleeper API
4. **User Experience**: Loading states and error handling for both tabs
5. **Maintainability**: Centralized logic in reusable hooks
6. **Accuracy**: Roster tab shows actual starting lineup requirements and bench size

## Future Enhancements

- Admin interface to manually update scoring and roster settings
- Historical settings tracking across seasons
- Conference-specific setting variations
- Settings comparison between seasons
- IR slot configuration from Sleeper API
- Waiver and trade settings from league configuration