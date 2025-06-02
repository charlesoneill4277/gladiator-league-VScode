import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SleeperLeagueData {
  name: string;
  league_id: string;
  season: string;
  draft_id: string;
  status: string;
  avatar: string;
}

const ConferencesDataLoader: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState<SleeperLeagueData[]>([]);

  // League IDs for different seasons
  const leagueIds = {
    2024: ['1072580179844857856', '1072593839715667968', '1072593416955015168'],
    2025: ['1204854057169072128', '1204857692007440384', '1204857608989577216']
  };

  // Season ID mappings based on the seasons table
  const seasonIdMap = {
    '2024': 1,
    '2025': 2
  };

  const fetchSleeperData = async (leagueId: string): Promise<SleeperLeagueData | null> => {
    try {
      console.log(`Fetching data for league ID: ${leagueId}`);
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Data received for league ${leagueId}:`, data);
      
      return {
        name: data.name || '',
        league_id: data.league_id || leagueId,
        season: data.season || '',
        draft_id: data.draft_id || '',
        status: data.status || '',
        avatar: data.avatar || ''
      };
    } catch (error) {
      console.error(`Error fetching data for league ${leagueId}:`, error);
      return null;
    }
  };

  const loadConferencesData = async () => {
    setIsLoading(true);
    const allData: SleeperLeagueData[] = [];

    try {
      // Fetch data for all league IDs
      const allLeagueIds = [...leagueIds[2024], ...leagueIds[2025]];
      
      for (const leagueId of allLeagueIds) {
        const data = await fetchSleeperData(leagueId);
        if (data) {
          allData.push(data);
        }
      }

      console.log('All fetched data:', allData);
      setLoadedData(allData);

      // Now insert data into the conferences table
      const conferenceRecords = allData.map(data => {
        const seasonId = seasonIdMap[data.season as '2024' | '2025'] || 0;
        const logoUrl = data.avatar ? `https://sleepercdn.com/avatars/thumbs/${data.avatar}` : '';
        
        return {
          conference_name: data.name,
          league_id: data.league_id,
          season_id: seasonId,
          draft_id: data.draft_id,
          status: data.status,
          league_logo_url: logoUrl
        };
      });

      console.log('Conference records to insert:', conferenceRecords);

      // Insert records into the conferences table
      for (const record of conferenceRecords) {
        try {
          const { error } = await window.ezsite.apis.tableCreate('12820', record);
          if (error) {
            console.error('Error inserting conference record:', error);
            throw new Error(error);
          }
        } catch (insertError) {
          console.error('Failed to insert conference record:', insertError);
          toast({
            title: "Error",
            description: `Failed to insert conference: ${record.conference_name}`,
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Success",
        description: `Successfully loaded ${conferenceRecords.length} conferences from Sleeper API`,
      });

    } catch (error) {
      console.error('Error loading conferences data:', error);
      toast({
        title: "Error",
        description: "Failed to load conferences data from Sleeper API",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conferences Data Loader</h2>
        <button
          onClick={loadConferencesData}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {isLoading ? 'Loading...' : 'Load Conferences Data'}
        </button>
      </div>

      <div className="text-sm text-gray-600">
        <p>This will fetch data from Sleeper API for the following league IDs:</p>
        <div className="mt-2 space-y-1">
          <div><strong>2024 Season:</strong> {leagueIds[2024].join(', ')}</div>
          <div><strong>2025 Season:</strong> {leagueIds[2025].join(', ')}</div>
        </div>
      </div>

      {loadedData.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Loaded Data Preview:</h3>
          <div className="space-y-2">
            {loadedData.map((item, index) => (
              <div key={index} className="p-3 border rounded-lg bg-gray-50">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-600">
                  League ID: {item.league_id} | Season: {item.season} | Status: {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferencesDataLoader;