# Schedule Tab Update

## Changes Made

### 1. Database Integration
- **Added DbPlayoffFormat interface** to database types
- **Added playoff_formats table** to TABLES constant
- **Added database service methods** for playoff format operations
- **Created usePlayoffFormat hook** to fetch playoff format data from database

### 2. Updated Season Structure Card
- **Regular Season**: Fixed to 12 weeks
- **Playoffs**: Updated to 5 weeks (13-17)
- **Playoff Teams**: Now displays dynamic value from database (default: 10/36)
- **First Round Byes**: New field showing teams that get byes (default: 6)

### 3. Updated Important Dates Card
- **Regular Season**: Weeks 1-12
- **Conference Championships**: Week 13
- **Playoffs Begin**: Dynamic from database (default: Week 14)
- **Coliseum Championship**: Dynamic from database (default: Week 17)

### 4. Completely Rewritten Playoff Format Card
Updated with the correct playoff structure:

#### Week 13: Conference Championships
- Top 2 teams from each conference compete to become Conference Champion

#### Playoff Seeding
- Top 3 seeds go to Conference Champions
- Seeds 4-6 go to losing teams of Conference Championship
- Seeds 7-{playoff_teams} go to next highest ranked teams, across all Conferences

#### Week 14: Wildcard Round
- Top {week_14_byes} teams get byes
- Remaining teams matched up based on seeding

#### Week 15: Quarterfinals Round
- Teams are reseeded
- Includes winners of Wildcard round matchups and teams on bye

#### Week 16: Semifinals Round
- Teams are reseeded
- Includes winners of Quarterfinals

#### Week 17: Coliseum Championship
- Winners of Semifinals compete to become the Coliseum Champion

### 5. Dynamic Data Integration
- **Season Filter Responsive**: Updates when selectedSeason changes
- **Database Values**: Uses actual playoff_teams and week_14_byes from database
- **Fallback Support**: Graceful fallback to default values if database unavailable
- **Loading States**: Shows loading indicator while fetching data
- **Error Handling**: Displays error messages with fallback to defaults

### 6. Database Schema Support
The hook queries the `playoff_formats` table with these key fields:
- `playoff_teams`: Total number of teams in playoffs
- `week_14_byes`: Number of teams that get first round byes
- `playoff_start_week`: Week when playoffs begin
- `championship_week`: Week of championship game
- `reseed`: Whether teams are reseeded after each round

## Technical Implementation

### Database Types
```typescript
export interface DbPlayoffFormat {
  id: number;
  season_id: number;
  playoff_teams: number;
  week_14_byes: number; // This is first_round_byes
  reseed: boolean;
  playoff_start_week: number;
  championship_week: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

### Hook Usage
```typescript
const { playoffFormat, loading: playoffLoading, error: playoffError } = usePlayoffFormat();
```

### Dynamic Display
- Playoff teams: `{playoffFormat?.playoff_teams || 10}/36`
- First round byes: `{playoffFormat?.week_14_byes || 6}`
- Championship week: `Week {playoffFormat?.championship_week || 17}`

## Benefits

1. **Real Data**: Uses actual playoff configuration from database
2. **Season Responsive**: Updates automatically when season filter changes
3. **Accurate Information**: Reflects the actual league playoff structure
4. **Maintainable**: Easy to update playoff format through database
5. **Robust**: Handles loading states and errors gracefully
6. **Scalable**: Can easily add more playoff configuration options