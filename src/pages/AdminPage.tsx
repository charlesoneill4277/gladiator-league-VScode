import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Settings, Database, Clock, Activity, Calendar, Bot } from 'lucide-react';
import LeagueManager from '@/components/admin/LeagueManager';
import DataSync from '@/components/admin/DataSync';
import MatchupsManagement from '@/components/admin/MatchupsManagement';

import AutoSyncManager from '@/components/admin/AutoSyncManager';


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
      <div className="container mx-auto px-4 py-8" data-id="ao89vvru5">
        <div className="flex items-center justify-center min-h-[400px]" data-id="pml7mynqn">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" data-id="10jeltn5k"></div>
        </div>
      </div>);

  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8" data-id="sep77enuq">
        <div className="max-w-md mx-auto" data-id="qkcxfcevx">
          <Card data-id="7bka3yyd5">
            <CardHeader className="text-center" data-id="alhddkb9x">
              <div className="flex justify-center mb-4" data-id="20czuz7s8">
                <Shield className="h-12 w-12 text-blue-600" data-id="uj6wfwcyd" />
              </div>
              <CardTitle className="flex items-center gap-2 justify-center" data-id="easa7srw9">
                <Lock className="h-5 w-5" data-id="srgo1x52n" />
                Admin Access Required
              </CardTitle>
              <CardDescription data-id="dw6h33z8z">
                Enter the admin password to access the admin panel
              </CardDescription>
            </CardHeader>
            <CardContent data-id="p54cgo0pa">
              <form onSubmit={handleLogin} className="space-y-4" data-id="nu7k5xnra">
                <div className="space-y-2" data-id="rtr62f4xb">
                  <Label htmlFor="password" data-id="nell7jvlm">Admin Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full" data-id="hjlpnn2yv" />

                </div>
                
                {loginError &&
                <Alert variant="destructive" data-id="4zu7gxwp4">
                    <AlertDescription data-id="js05q0hn6">{loginError}</AlertDescription>
                  </Alert>
                }
                
                <Button type="submit" className="w-full" data-id="tthln8jfy">
                  Access Admin Panel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>);

  }

  return (
    <div className="container mx-auto px-4 py-8" data-id="zucmgzvwq">
      <div className="flex items-center justify-between mb-8" data-id="lro5ngqd4">
        <div data-id="noo7qh20h">
          <h1 className="text-3xl font-bold flex items-center gap-3" data-id="fmj1jcz8o">
            <Settings className="h-8 w-8 text-blue-600" data-id="bdjtdbfnt" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2" data-id="amn1082i4">
            Manage leagues, sync data, and perform administrative tasks
          </p>
        </div>
        
        <div className="flex items-center gap-4" data-id="nw6oaovvh">
          {lastLogin &&
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-id="1kqkbfoj2">
              <Clock className="h-4 w-4" data-id="u85cv9ybo" />
              Last login: {lastLogin}
            </div>
          }
          <Badge variant="secondary" className="flex items-center gap-1" data-id="u49kieuap">
            <Activity className="h-3 w-3" data-id="fzemdjhv1" />
            Admin Active
          </Badge>
          <Button variant="outline" onClick={handleLogout} data-id="ssqzxi57s">
            Logout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="league-manager" className="space-y-6" data-id="ojttqdptv">
        <TabsList className="grid w-full grid-cols-4" data-id="55g8xnp5m">
          <TabsTrigger value="league-manager" className="flex items-center gap-2" data-id="mudt4s949">
            <Settings className="h-4 w-4" data-id="vq59l6i0o" />
            League Manager
          </TabsTrigger>
          <TabsTrigger value="data-sync" className="flex items-center gap-2" data-id="x1ln07h9l">
            <Database className="h-4 w-4" data-id="gwzxvoplp" />
            Data Sync
          </TabsTrigger>
          <TabsTrigger value="matchups-management" className="flex items-center gap-2" data-id="kq8s7gvio">
            <Calendar className="h-4 w-4" data-id="930hxto7y" />
            Matchups & Overrides
          </TabsTrigger>
          <TabsTrigger value="auto-sync" className="flex items-center gap-2" data-id="ufa49dbo7">
            <Bot className="h-4 w-4" data-id="xv3rcuk8d" />
            Auto-Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="league-manager" data-id="9y7vx68ag">
          <LeagueManager data-id="jqk7s5yut" />
        </TabsContent>

        <TabsContent value="data-sync" data-id="mbmsyjmjw">
          <DataSync data-id="r02lgxd37" />
        </TabsContent>

        <TabsContent value="matchups-management" data-id="2im6bg2ok">
          <MatchupsManagement data-id="ddqsho0df" />
        </TabsContent>

        <TabsContent value="auto-sync" data-id="cr5xmlzdc">
          <AutoSyncManager data-id="5st9c4lq3" />
        </TabsContent>


      </Tabs>
    </div>);

};

export default AdminPage;