import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Settings, Database, Clock, Activity, Calendar } from 'lucide-react';
import LeagueManager from '@/components/admin/LeagueManager';
import DataSync from '@/components/admin/DataSync';
import MatchupsManagement from '@/components/admin/MatchupsManagement';

const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const ADMIN_PASSWORD = 'gladleague2025';

  useEffect(() => {
    // Check if admin is already authenticated
    const adminAuth = sessionStorage.getItem('admin_authenticated');
    const adminLoginTime = sessionStorage.getItem('admin_login_time');

    if (adminAuth === 'true' && adminLoginTime) {
      const loginTime = new Date(adminLoginTime);
      const now = new Date();
      const hoursDiff = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

      // Session expires after 8 hours
      if (hoursDiff < 8) {
        setIsAuthenticated(true);
        setLastLogin(localStorage.getItem('admin_last_login'));
      } else {
        sessionStorage.removeItem('admin_authenticated');
        sessionStorage.removeItem('admin_login_time');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (password === ADMIN_PASSWORD) {
      const now = new Date();
      setIsAuthenticated(true);
      setLoginError('');
      sessionStorage.setItem('admin_authenticated', 'true');
      sessionStorage.setItem('admin_login_time', now.toISOString());
      localStorage.setItem('admin_last_login', now.toLocaleString());
      setLastLogin(now.toLocaleString());

      toast({
        title: "Admin Access Granted",
        description: "Welcome to the admin panel"
      });
    } else {
      setLoginError('Invalid password');
      toast({
        title: "Access Denied",
        description: "Invalid admin password",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('admin_login_time');

    toast({
      title: "Logged Out",
      description: "Admin session ended"
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
        </div>
      </div>);

  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Lock className="h-5 w-5" />
                Admin Access Required
              </CardTitle>
              <CardDescription>
                Enter the admin password to access the admin panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Admin Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full" />

                </div>
                
                {loginError &&
                <Alert variant="destructive">
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                }
                
                <Button type="submit" className="w-full">
                  Access Admin Panel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>);

  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage leagues, sync data, and perform administrative tasks
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {lastLogin &&
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last login: {lastLogin}
            </div>
          }
          <Badge variant="secondary" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Admin Active
          </Badge>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="league-manager" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="league-manager" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            League Manager
          </TabsTrigger>
          <TabsTrigger value="data-sync" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Sync
          </TabsTrigger>
          <TabsTrigger value="matchups-management" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Matchups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="league-manager">
          <LeagueManager />
        </TabsContent>

        <TabsContent value="data-sync">
          <DataSync />
        </TabsContent>

        <TabsContent value="matchups-management">
          <MatchupsManagement />
        </TabsContent>
      </Tabs>
    </div>);

};

export default AdminPage;