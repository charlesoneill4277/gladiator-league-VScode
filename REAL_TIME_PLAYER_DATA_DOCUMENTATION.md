
# Real-Time Player Data Service Documentation

## Overview
This implementation provides a comprehensive real-time player data service for the Gladiator League fantasy football application. The system includes centralized data management, automated synchronization, real-time availability calculation, and optimistic UI updates.

## Architecture Components

### 1. PlayerDataService (`src/services/playerDataService.ts`)
**Purpose**: Centralized service for all player-related CRUD operations

**Key Features**:
- Player data caching with TTL (Time To Live)
- Rate limiting for API calls
- Batch operations for bulk updates
- Search functionality with multiple filters
- Data validation and sanitization

**Main Methods**:
- `getAllPlayers()`: Fetch all players with caching
- `getPlayerBySleeperID()`: Get player by Sleeper API ID
- `syncPlayerFromSleeper()`: Sync player data from Sleeper API
- `searchPlayers()`: Search players with filters
- `batchUpdatePlayers()`: Bulk update operations

### 2. RosterSyncEngine (`src/services/rosterSyncEngine.ts`)
**Purpose**: Automated data synchronization from Sleeper API

**Key Features**:
- Background sync with progress tracking
- Retry mechanisms with exponential backoff
- Conflict resolution strategies
- Automatic and manual sync modes
- Error handling and logging

**Main Methods**:
- `fullSync()`: Complete synchronization process
- `startAutomaticSync()`: Enable automatic sync
- `stopAutomaticSync()`: Disable automatic sync
- `onProgress()`: Subscribe to sync progress updates

### 3. PlayerAvailabilityCalculator (`src/services/playerAvailabilityCalculator.ts`)
**Purpose**: Real-time availability status computation

**Key Features**:
- Real-time availability calculation
- Multi-conference ownership conflict detection
- Availability statistics by position and team
- Bulk availability refresh
- Waiver and free agent status tracking

**Main Methods**:
- `calculatePlayerAvailability()`: Calculate real-time availability
- `getAvailabilityStats()`: Get availability statistics
- `findConflictingOwnership()`: Find ownership conflicts
- `bulkRefreshAvailability()`: Bulk refresh availability data

### 4. Real-Time React Hooks (`src/hooks/useRealTimePlayerData.ts`)
**Purpose**: React Query integration for real-time UI updates

**Key Features**:
- Optimistic updates for immediate UI feedback
- Automatic cache invalidation
- Background refetching
- Error handling and recovery
- Batch operations

**Main Hooks**:
- `usePlayersData()`: Fetch and cache player data
- `usePlayerSearch()`: Search players with filters
- `usePlayerAvailability()`: Real-time availability data
- `useRosterSync()`: Sync management with progress
- `useOptimisticRosterUpdate()`: Optimistic roster updates

## Database Schema

### Players Table (`players`)
- Stores complete player information from Sleeper API
- Includes injury status, position, NFL team, etc.
- Versioned data with `data_version` field

### Team Rosters Table (`team_rosters`)
- Tracks current roster assignments
- Includes roster status (active, bench, IR, taxi)
- Temporal tracking with week-by-week data

### Player Availability Cache (`player_availability_cache`)
- Cached availability calculations
- Updated in real-time
- Includes ownership and waiver status

### Sync Status Table (`sync_status`)
- Tracks synchronization operations
- Includes performance metrics
- Error logging and recovery information

## Key Features Implemented

### 1. Real-Time Data Synchronization
- **Automatic Sync**: Configurable intervals (default: 30 minutes)
- **Manual Sync**: On-demand synchronization
- **Progress Tracking**: Real-time sync progress updates
- **Error Recovery**: Retry mechanisms with exponential backoff

### 2. Caching Strategy
- **Multi-Layer Caching**: Service-level and React Query caching
- **TTL-Based Expiry**: Different cache durations for different data types
- **Cache Invalidation**: Automatic invalidation on data updates
- **Background Refresh**: Stale-while-revalidate pattern

### 3. Optimistic Updates
- **Immediate Feedback**: UI updates before server confirmation
- **Rollback Capability**: Automatic rollback on errors
- **Conflict Resolution**: Handles simultaneous updates
- **Progress Indicators**: Loading states and progress bars

### 4. Rate Limiting
- **API Quotas**: Respects Sleeper API rate limits
- **Batch Processing**: Efficient bulk operations
- **Request Throttling**: Prevents API overload
- **Error Handling**: Graceful degradation on rate limit hits

### 5. Error Handling
- **Retry Mechanisms**: Exponential backoff for failed requests
- **User Feedback**: Toast notifications for errors
- **Logging**: Comprehensive error logging
- **Graceful Degradation**: Fallback to cached data

## Usage Examples

### Basic Player Search
```typescript
const { data: players, isLoading } = usePlayersData();
const { data: searchResults } = usePlayerSearch({
  name: 'mahomes',
  position: 'QB',
  team: 'KC'
});
```

### Roster Management
```typescript
const { addPlayer, removePlayer } = useOptimisticRosterUpdate();

// Add player to roster with optimistic update
addPlayer({
  teamId: 1,
  playerId: 123,
  seasonId: 2025,
  week: 14,
  rosterStatus: 'bench'
});
```

### Data Synchronization
```typescript
const { sync, isSyncing, syncProgress } = useRosterSync();

// Manual sync
sync({
  conferences: [...],
  seasonId: 2025,
  week: 14,
  conflictResolution: { strategy: 'latest_wins' }
});
```

## Performance Optimizations

### 1. Efficient Data Loading
- **Pagination**: Large datasets loaded in chunks
- **Lazy Loading**: Data loaded only when needed
- **Background Prefetching**: Anticipated data preloaded

### 2. Memory Management
- **Cache Limits**: Automatic cache cleanup
- **Garbage Collection**: Unused data removal
- **Memory Monitoring**: Cache size tracking

### 3. Network Optimization
- **Request Batching**: Multiple requests combined
- **Response Compression**: Reduced payload sizes
- **Connection Pooling**: Efficient HTTP connections

## Security Features

### 1. Data Validation
- **Input Sanitization**: All user inputs validated
- **Type Safety**: TypeScript for compile-time safety
- **Schema Validation**: Database schema enforcement

### 2. Error Prevention
- **Defensive Programming**: Null checks and fallbacks
- **Boundary Conditions**: Edge case handling
- **Data Integrity**: Consistency checks

## Monitoring and Debugging

### 1. Cache Statistics
- **Hit Rates**: Cache performance metrics
- **Memory Usage**: Cache size tracking
- **Performance Metrics**: Response times and throughput

### 2. Sync Monitoring
- **Success Rates**: Sync operation statistics
- **Error Tracking**: Failed operation logging
- **Performance Analysis**: Sync duration and throughput

### 3. Debug Tools
- **Console Logging**: Detailed operation logs
- **State Inspection**: Cache and sync state visibility
- **Performance Profiling**: Bottleneck identification

## Future Enhancements

### 1. Advanced Features
- **WebSocket Integration**: Real-time push notifications
- **Offline Support**: Service worker caching
- **Predictive Prefetching**: Machine learning-based prefetching

### 2. Performance Improvements
- **Database Indexing**: Optimized query performance
- **CDN Integration**: Static asset optimization
- **Compression**: Response payload optimization

### 3. Monitoring Enhancements
- **Real-time Dashboards**: Live performance monitoring
- **Alert Systems**: Automated error notifications
- **Analytics Integration**: Usage pattern analysis

## Navigation

The Real-Time Player Data Service is accessible through the main navigation:
- **Desktop**: Click "Player Data" in the top navigation
- **Mobile**: Access through the mobile menu
- **Direct URL**: `/player-data`

## Technical Requirements

### Dependencies
- `@tanstack/react-query`: Data fetching and caching
- `lucide-react`: Icons and UI components
- `tailwindcss`: Styling framework
- React 18.3.1 with TypeScript

### Browser Support
- Modern browsers with ES2020 support
- React 18 compatible environments
- TypeScript 4.9+ for development

## Support and Maintenance

### Regular Tasks
- **Data Cleanup**: Remove outdated cache entries
- **Performance Monitoring**: Track response times
- **Error Review**: Analyze failed operations
- **Capacity Planning**: Monitor resource usage

### Troubleshooting
- **Cache Issues**: Clear cache and restart
- **Sync Problems**: Check API connectivity
- **Performance Issues**: Review cache hit rates
- **Error Patterns**: Analyze error logs

This implementation provides a robust foundation for real-time player data management with comprehensive error handling, performance optimization, and user experience enhancements.
