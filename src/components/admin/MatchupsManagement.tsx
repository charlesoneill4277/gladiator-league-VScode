import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trophy } from 'lucide-react';
import RegularSeasonMatchups from './RegularSeasonMatchups';
import PlayoffMatchups from './PlayoffMatchups';

const MatchupsManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Matchups & Overrides Management
          </CardTitle>
          <CardDescription>
            Manage regular season and playoff matchups, scores, and overrides across all conferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="regular-season" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="regular-season" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Regular Season
              </TabsTrigger>
              <TabsTrigger value="playoffs" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Playoffs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="regular-season">
              <RegularSeasonMatchups />
            </TabsContent>

            <TabsContent value="playoffs">
              <PlayoffMatchups />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchupsManagement;