import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import {
  Menu,
  Home,
  Trophy,
  Users,
  UserCheck,
  Swords,
  FileText,
  Moon,
  Sun,
  Shield,
  Settings,
  Cog } from
'lucide-react';

const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const {
    selectedSeason,
    selectedConference,
    theme,
    setSelectedSeason,
    setSelectedConference,
    toggleTheme,
    seasonConfigs,
    currentSeasonConfig
  } = useApp();

  const navigationItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/standings', label: 'Standings', icon: Trophy },
  { path: '/matchups', label: 'Matchups', icon: Swords },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/players', label: 'Players', icon: UserCheck },
  { path: '/draft', label: 'Draft Results', icon: Shield },
  { path: '/rules', label: 'League Rules', icon: FileText },
  { path: '/player-data', label: 'Player Data', icon: Settings },
  { path: '/admin', label: 'Admin', icon: Cog }];


  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const NavItems = ({ isMobile = false }) =>
  <>
      {navigationItems.map((item) => {
      const Icon = item.icon;
      const isActive = isActivePath(item.path);

      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => isMobile && setIsMobileMenuOpen(false)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md ${item.path === '/admin' ? 'text-xs opacity-75' : 'text-sm'} font-medium transition-colors ${
          isActive ?
          'bg-primary text-primary-foreground' :
          'text-muted-foreground hover:text-foreground hover:bg-accent'}`
          }>

            <Icon className={item.path === '/admin' ? 'h-3 w-3' : 'h-4 w-4'} />
            <span className={item.path === '/admin' ? 'text-xs' : ''}>{item.label}</span>
          </Link>);

    })}
    </>;


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold">Gladiator League</h1>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          <NavItems />
        </nav>

        {/* Filters and Controls */}
        <div className="flex items-center space-x-2">
          {/* Season Filter */}
          <Select value={selectedSeason.toString()} onValueChange={(value) => setSelectedSeason(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasonConfigs.map((config) =>
              <SelectItem key={config.year} value={config.year.toString()}>
                  {config.year}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Conference Filter */}
          <Select value={selectedConference || 'all'} onValueChange={(value) => setSelectedConference(value === 'all' ? null : value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conferences</SelectItem>
              {currentSeasonConfig.conferences.map((conference) =>
              <SelectItem key={conference.id} value={conference.id}>
                  {conference.name}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col space-y-4 mt-8">
                <div className="flex items-center space-x-2 pb-4 border-b">
                  <Shield className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="font-semibold">Gladiator League</h2>
                    <p className="text-xs text-muted-foreground">Fantasy Football</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Navigation</p>
                  <NavItems isMobile={true} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium mb-2">Season</p>
                    <Select value={selectedSeason.toString()} onValueChange={(value) => setSelectedSeason(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seasonConfigs.map((config) =>
                        <SelectItem key={config.year} value={config.year.toString()}>
                            {config.year}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Conference</p>
                    <Select value={selectedConference || 'all'} onValueChange={(value) => setSelectedConference(value === 'all' ? null : value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Conferences</SelectItem>
                        {currentSeasonConfig.conferences.map((conference) =>
                        <SelectItem key={conference.id} value={conference.id}>
                            {conference.name}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Active Filters Badge */}
      {(selectedConference || selectedSeason !== 2025) &&
      <div className="border-t bg-accent/50">
          <div className="container py-2">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-muted-foreground">Active filters:</span>
              {selectedSeason !== 2025 &&
            <Badge variant="secondary">{selectedSeason} Season</Badge>
            }
              {selectedConference &&
            <Badge variant="secondary">
                  {currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name}
                </Badge>
            }
            </div>
          </div>
        </div>
      }
    </header>);

};

export default Header;