import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import { AppProvider } from './contexts/AppContext';
import Header from './components/layout/Header';
import HomePage from "./pages/HomePage";
import StandingsPage from './pages/StandingsPage';
import MatchupsPage from './pages/MatchupsPage';
import MatchupDetailPage from './pages/MatchupDetailPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import PlayersPage from './pages/PlayersPage';
import PlayerDetailPage from './pages/PlayerDetailPage';
import TransactionsPage from './pages/TransactionsPage';
import DraftResultsPage from './pages/DraftResultsPage';
import LeagueRulesPage from './pages/LeagueRulesPage';
import ConferencesPage from './pages/ConferencesPage';
import AdminPage from './pages/AdminPage';
import NotFound from "./pages/NotFound";
import { ezsiteApiReplacement } from '@/services/migrationAdapter';

const queryClient = new QueryClient();

const App = () => {
  // Initialize EzSite API replacement for backward compatibility
  useEffect(() => {
    if (!(window as any).ezsite) {
      (window as any).ezsite = {
        apis: ezsiteApiReplacement
      };
    }

    // Load chatbot script
    const script = document.createElement('script');
    script.src = 'https://studio.pickaxe.co/api/embed/bundle.js';
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://studio.pickaxe.co/api/embed/bundle.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Header />
              <main className="container mx-auto px-4 py-6">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/standings" element={<StandingsPage />} />
                  <Route path="/matchups" element={<MatchupsPage />} />
                  <Route path="/matchups/:matchupId" element={<MatchupDetailPage />} />
                  <Route path="/teams" element={<TeamsPage />} />
                  <Route path="/teams/:teamId" element={<TeamDetailPage />} />
                  <Route path="/players" element={<PlayersPage />} />
                  <Route path="/players/:playerId" element={<PlayerDetailPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/draft" element={<DraftResultsPage />} />
                  <Route path="/rules" element={<LeagueRulesPage />} />
                  <Route path="/conferences" element={<ConferencesPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>

            {/* Chatbot - Fixed position in bottom right corner */}
            <div className="fixed bottom-4 right-4 z-50">
              <div id="deployment-f277b3b5-018e-4ef6-a37c-d2fd421a7ba5"></div>
            </div>

            <Toaster />
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};


export default App;