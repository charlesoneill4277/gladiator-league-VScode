import React from 'react';
import MatchupsDebugger from '@/components/debug/MatchupsDebugger';

const DebugPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <h1 className="text-3xl font-bold">Debug Dashboard</h1>
      </div>
      <MatchupsDebugger />
    </div>
  );
};

export default DebugPage;