import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AppProvider } from './contexts/AppContext';
import Header from './components/layout/Header';
import HomePage from "./pages/HomePage";
import StandingsPage from './pages/StandingsPage';
import MatchupsPage from './pages/MatchupsPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import PlayersPage from './pages/PlayersPage';
import PlayerDetailPage from './pages/PlayerDetailPage';
import DraftResultsPage from './pages/DraftResultsPage';
import LeagueRulesPage from './pages/LeagueRulesPage';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () =>
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
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:teamId" element={<TeamDetailPage />} />
                <Route path="/players" element={<PlayersPage />} />
                <Route path="/players/:playerId" element={<PlayerDetailPage />} />
                <Route path="/draft" element={<DraftResultsPage />} />
                <Route path="/rules" element={<LeagueRulesPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
          <Toaster />
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>;


export default App;