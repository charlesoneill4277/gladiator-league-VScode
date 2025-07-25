import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const MatchupsDebug: React.FC = () => {
  const renderCountRef = useRef(0);
  const [displayCount, setDisplayCount] = useState(0);
  const [mountTime, setMountTime] = useState<number>(Date.now());

  // Increment render count on every render (using ref to avoid infinite loop)
  renderCountRef.current += 1;

  // Update display count periodically to show current render count
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayCount(renderCountRef.current);
    }, 1000); // Update display every second

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMountTime(Date.now());
    console.log('🐛 MatchupsDebug mounted at:', new Date().toISOString());
  }, []);

  const timeSinceMount = Date.now() - mountTime;

  return (
    <Card className="fixed top-4 left-4 z-50 w-64 border-l-4 border-l-red-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>Renders:</span>
          <Badge variant={displayCount > 10 ? "destructive" : "secondary"}>
            {displayCount}
          </Badge>
        </div>
        <div className="flex justify-between text-xs">
          <span>Uptime:</span>
          <span>{(timeSinceMount / 1000).toFixed(1)}s</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {displayCount > 10 && "⚠️ High render count detected!"}
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchupsDebug;