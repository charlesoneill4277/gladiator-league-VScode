import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  TrendingUp, 
  Users, 
  Trophy, 
  Calendar,
  BarChart3,
  Target,
  Database
} from 'lucide-react';
import HistoricalRosterTracker from '@/components/historical/HistoricalRosterTracker';
import PlayerJourneyTimeline from '@/components/historical/PlayerJourneyTimeline';
import HistoricalPerformanceMetrics from '@/components/historical/HistoricalPerformanceMetrics';
import DraftHistoryAnalyzer from '@/components/historical/DraftHistoryAnalyzer';

const HistoricalAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('roster');

  const analyticsCards = [
    {
      title: 'Roster Tracking',
      description: 'Track all roster changes across seasons',
      icon: <Users className="w-5 h-5" />,
      color: 'bg-blue-500',
      count: 'All Seasons'
    },
    {
      title: 'Player Journeys',
      description: 'Follow player movement between teams',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-green-500',
      count: 'Timeline View'
    },
    {
      title: 'Performance Metrics',
      description: 'Historical team performance analysis',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'bg-purple-500',
      count: 'Multi-Season'
    },
    {
      title: 'Draft History',
      description: 'Analyze draft picks and retention rates',
      icon: <Trophy className="w-5 h-5" />,
      color: 'bg-yellow-500',
      count: 'Success Rate'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Historical Analytics</h1>
              <p className="text-gray-600">Dynasty league data analysis and insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Database className="w-4 h-4" />
            <span>Multi-season data tracking and analysis</span>
          </div>
        </div>

        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {analyticsCards.map((card, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <div className="text-white">{card.icon}</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{card.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{card.description}</p>
                    <Badge variant="outline" className="text-xs">
                      {card.count}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="roster" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Roster Tracking
            </TabsTrigger>
            <TabsTrigger value="journeys" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Player Journeys
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="draft" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Draft History
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="roster" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Historical Roster Changes
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Track all roster moves across seasons including trades, waivers, and free agent pickups
                  </p>
                </CardHeader>
                <CardContent>
                  <HistoricalRosterTracker />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="journeys" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Player Journey Timeline
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Follow individual player movements between teams and track their dynasty journey
                  </p>
                </CardHeader>
                <CardContent>
                  <PlayerJourneyTimeline />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Historical Performance Analysis
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Analyze team performance trends across multiple seasons with detailed metrics
                  </p>
                </CardHeader>
                <CardContent>
                  <HistoricalPerformanceMetrics />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="draft" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Draft History Analysis
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Analyze draft picks, retention rates, and draft success across all seasons
                  </p>
                </CardHeader>
                <CardContent>
                  <DraftHistoryAnalyzer />
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Data Management Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </CardTitle>
            <p className="text-sm text-gray-600">
              Tools for managing historical data archiving and migration
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Data Archiving</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Archive old season data for storage optimization
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    Archive Data
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Data Migration</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Migrate data between seasons and formats
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    Migrate Data
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Backup & Restore</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Create backups and restore historical data
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    Backup Data
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistoricalAnalyticsPage;
