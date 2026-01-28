import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Users, Clock, Shield, UserCheck, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type UserRole = Tables<'user_roles'>;
type LoginActivity = Tables<'user_login_activity'>;

interface UserWithRole extends Profile {
  role?: string;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('Access denied');
    } else if (isAdmin) {
      fetchData();
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchData = async () => {
    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('*');

    // Merge profiles with roles
    const usersWithRoles = profiles?.map(profile => ({
      ...profile,
      role: roles?.find(r => r.user_id === profile.user_id)?.role || 'user',
    })) || [];

    setUsers(usersWithRoles);

    // Fetch login activity
    const { data: activity } = await supabase
      .from('user_login_activity')
      .select('*')
      .order('login_at', { ascending: false })
      .limit(50);

    setLoginActivity(activity || []);
    setIsLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      fetchData();
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="app-container">
        {/* Header */}
        <div className="hero-gradient px-4 pt-12 pb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Admin</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">User Management</h1>
              <p className="text-white/70 text-sm">{users.length} registered users</p>
            </div>
          </div>
        </div>

        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        <div className="px-4 -mt-2">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="users">
                <UserCheck className="h-4 w-4 mr-1" />
                Users
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Clock className="h-4 w-4 mr-1" />
                Login Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-3">
              {users.map((u) => (
                <Card key={u.id} variant="elevated">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{u.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{u.phone || 'No phone'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {format(new Date(u.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {u.role}
                        </Badge>
                        {u.user_id !== user?.id && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={u.role === 'admin' ? 'default' : 'outline'}
                              className="text-xs h-7 px-2"
                              onClick={() => updateUserRole(u.user_id, 'admin')}
                            >
                              Admin
                            </Button>
                            <Button
                              size="sm"
                              variant={u.role === 'user' ? 'default' : 'outline'}
                              className="text-xs h-7 px-2"
                              onClick={() => updateUserRole(u.user_id, 'user')}
                            >
                              User
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="activity" className="space-y-3">
              {loginActivity.length === 0 ? (
                <Card variant="elevated">
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No login activity recorded yet</p>
                  </CardContent>
                </Card>
              ) : (
                loginActivity.map((activity) => {
                  const userProfile = users.find(u => u.user_id === activity.user_id);
                  return (
                    <Card key={activity.id} variant="elevated">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">
                              {userProfile?.full_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.ip_address || 'Unknown IP'}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {activity.login_at 
                              ? format(new Date(activity.login_at), 'MMM d, h:mm a')
                              : 'Unknown time'}
                          </span>
                        </div>
                        {activity.user_agent && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {activity.user_agent}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
