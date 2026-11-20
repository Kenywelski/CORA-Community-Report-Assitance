import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Loader2,
  LayoutGrid,
  Monitor,
  Pencil,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type LoginActivity = Tables<'user_login_activity'>;
type EditableRole = 'admin' | 'user';
type RoleFilter = 'all' | 'admin' | 'user';

interface UserWithRole extends Profile {
  role?: string;
  email?: string | null;
}

interface AuthUserEmail {
  user_id: string;
  email: string | null;
}

const USERS_PER_PAGE = 6;

const avatarColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
];

const getInitials = (name: string | null) => {
  const parts = (name || 'Unknown User').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const getAvatarColor = (value: string) => {
  const colorIndex = Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  return avatarColors[colorIndex % avatarColors.length];
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<EditableRole>('user');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isUpdatingTestAccount, setIsUpdatingTestAccount] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const getCurrentUser = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      toast.error('Failed to identify the current account');
      return;
    }
    setCurrentUserId(user?.id || null);
  }, []);

  const fetchData = useCallback(async () => {
    const [
      { data: profiles, error: profilesError },
      { data: roles, error: rolesError },
      { data: accountData, error: accountError },
      { data: activity, error: activityError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
      supabase.functions.invoke<{ emails: AuthUserEmail[] }>('admin-user-management', {
        body: { action: 'list-emails' },
      }),
      supabase
        .from('user_login_activity')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(50),
    ]);

    if (profilesError) {
      toast.error('Failed to load user profiles');
      setIsLoading(false);
      return;
    }

    if (rolesError) {
      toast.error('Failed to load user roles');
      setIsLoading(false);
      return;
    }

    if (accountError) {
      toast.error('Failed to load account email addresses');
    }
    const emailsByUserId = new Map(
      (accountData?.emails ?? []).map(({ user_id, email }) => [user_id, email]),
    );

    const rolePriority = ['admin', 'user'];
    const usersWithRoles =
      profiles?.map((profile) => ({
        ...profile,
        email: emailsByUserId.get(profile.user_id) ?? null,
        role:
          rolePriority.find((role) =>
            roles?.some(
              (entry) => entry.user_id === profile.user_id && entry.role === role
            )
          ) || 'user',
      })) || [];

    setUsers(usersWithRoles);

    if (activityError) {
      toast.error('Failed to load login activity');
      setIsLoading(false);
      return;
    }

    setLoginActivity(activity ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
    void getCurrentUser();
    const channel = supabase
      .channel('admin-users-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => void fetchData())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_login_activity' },
        () => void fetchData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData, getCurrentUser]);

  const updateUserRole = async (userId: string, newRole: EditableRole) => {
    setIsUpdatingRole(true);
    const { error } = await supabase.rpc('set_user_primary_role', {
      _user_id: userId,
      _role: newRole,
    });

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      setEditingUser(null);
      await fetchData();
    }
    setIsUpdatingRole(false);
  };

  const updateTestAccountAccess = async (userId: string, enabled: boolean) => {
    setIsUpdatingTestAccount(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_test_account: enabled })
      .eq('user_id', userId);

    if (error) {
      console.error('Test Resident access update failed:', error);
      toast.error('Failed to update Test Resident access');
    } else {
      setEditingUser((current) =>
        current ? { ...current, is_test_account: enabled } : current,
      );
      toast.success(enabled ? 'Test Resident uploads enabled' : 'Test Resident uploads disabled');
      await fetchData();
    }
    setIsUpdatingTestAccount(false);
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.functions.invoke('admin-user-management', {
      body: { action: 'delete', userId },
    });
    if (error) {
      let message = error.message;
      if ('context' in error && error.context instanceof Response) {
        const responseBody: unknown = await error.context.clone().json().catch(() => null);
        if (
          typeof responseBody === 'object' &&
          responseBody !== null &&
          'error' in responseBody &&
          typeof responseBody.error === 'string'
        ) {
          message = responseBody.error;
        }
      }
      toast.error(message);
    } else {
      toast.success('User account deleted');
      await fetchData();
    }
  };

  const handleOpenEdit = (user: UserWithRole) => {
    if (user.user_id === currentUserId) {
      toast.info('You cannot change the role of your current account.');
      return;
    }
    setEditingUser(user);
    setEditRole(user.role === 'admin' ? 'admin' : 'user');
  };

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;

    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      (user.full_name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.phone || '').toLowerCase().includes(query) ||
      (user.barangay || '').toLowerCase().includes(query) ||
      (user.role || '').toLowerCase().includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + USERS_PER_PAGE
  );
  const firstShown = filteredUsers.length === 0 ? 0 : startIndex + 1;
  const lastShown = Math.min(startIndex + USERS_PER_PAGE, filteredUsers.length);

  const renderRoleBadge = (role = 'user') => {
    if (role === 'admin') {
      return (
        <Badge className="min-w-[96px] justify-center gap-1.5 rounded-full border-0 bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </Badge>
      );
    }

    return (
      <Badge className="min-w-[96px] justify-center gap-1.5 rounded-full border-0 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
        <Users className="h-3.5 w-3.5" />
        User
      </Badge>
    );
  };

  const renderUserActions = (
    user: UserWithRole,
    displayName: string,
    isCurrentUser: boolean,
  ) => (
    <div className="flex items-center justify-end gap-2">
      <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
        Actions
      </span>
      <AdminActionButton
        action="edit"
        icon={Pencil}
        onClick={() => handleOpenEdit(user)}
        aria-label={`Edit ${displayName}`}
      />

      {isCurrentUser ? (
        <AdminActionButton
          action="delete"
          icon={Trash2}
          onClick={() => toast.info('You cannot delete your current account.')}
          aria-label={`Delete ${displayName}`}
        />
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <AdminActionButton
              action="delete"
              icon={Trash2}
              aria-label={`Delete ${displayName}`}
            />
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes {displayName}&apos;s authentication account,
                profile, and role assignments. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteUser(user.user_id)}
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <AdminLayout
        title="User Management"
        subtitle="Manage system users and their roles."
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="User Management"
      subtitle="Manage system users and their roles."
    >
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="flex h-10 w-full max-w-[330px] rounded-xl border border-border bg-card p-0 shadow-sm">
          <TabsTrigger
            value="users"
            className="h-full min-w-0 flex-1 gap-1.5 rounded-xl px-2 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_6px_14px_rgba(15,128,111,0.22)] sm:text-sm"
          >
            <Users className="h-4 w-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="h-full flex-1 gap-1.5 rounded-xl text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Clock className="h-4 w-4" />
            Login Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative col-span-2 min-w-0 lg:col-span-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 rounded-xl border-border bg-card pl-10 text-xs shadow-sm placeholder:text-muted-foreground"
              />
            </div>

            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as RoleFilter)}
            >
              <SelectTrigger className="h-10 min-w-0 rounded-xl border-border bg-card px-3 text-xs font-semibold shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <LayoutGrid className="h-4 w-4 shrink-0 text-foreground" />
                  <SelectValue className="truncate" />
                </div>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>

          </div>

          <section aria-label="Users">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_140px_180px_88px] items-center gap-3 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>User</span>
              <span>Role</span>
              <span>Date Added</span>
              <span className="text-center">Actions</span>
            </div>
            {paginatedUsers.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-sm text-muted-foreground">
                <Users className="mb-3 h-10 w-10 opacity-40" />
                No users match the current search or role filter.
              </div>
            ) : (
              <div className="divide-y divide-border/70 border-b border-border/70">
                {paginatedUsers.map((user) => {
                  const displayName = user.full_name || 'Unknown User';
                  const isCurrentUser = user.user_id === currentUserId;
                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-2 gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.2fr)_140px_180px_88px] lg:items-center"
                    >
                      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold ${getAvatarColor(user.user_id)}`}
                        >
                          {getInitials(displayName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-foreground">
                            {displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {user.email || user.phone || user.barangay || 'No email available'}
                          </p>
                          {user.is_test_account && (
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              Test Resident
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 lg:justify-start">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Role
                        </span>
                        {renderRoleBadge(user.role)}
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground lg:justify-start">
                        <span className="text-[11px] font-semibold uppercase tracking-wide lg:hidden">
                          Date Added
                        </span>
                        <p className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(user.created_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                      <div className="col-span-2 lg:col-span-1">
                        {renderUserActions(user, displayName, isCurrentUser)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-xs font-medium text-muted-foreground">
                <p>
                  Showing {firstShown}–{lastShown} of {filteredUsers.length} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-primary px-3 font-bold text-primary-foreground">
                    {safeCurrentPage}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    aria-label="Next page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          {loginActivity.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-sm text-muted-foreground">
              <Clock className="mb-3 h-10 w-10 opacity-40" />
              No login activity recorded yet.
            </div>
          ) : (
            <section aria-label="Login activity">
              <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(100px,0.8fr)_minmax(0,1.1fr)_minmax(120px,1fr)] items-center gap-3 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>User</span>
                <span>IP Address</span>
                <span>Login Time</span>
                <span>Device</span>
              </div>
              <div className="divide-y divide-border/70 border-b border-border/70">
                {loginActivity.map((activity) => {
                  const userProfile = users.find(
                    (user) => user.user_id === activity.user_id,
                  );
                  const displayName = userProfile?.full_name || 'Unknown User';
                  return (
                    <div
                      key={activity.id}
                      className="grid grid-cols-2 gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.2fr)_minmax(100px,0.8fr)_minmax(0,1.1fr)_minmax(120px,1fr)] lg:items-center"
                    >
                      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold ${getAvatarColor(activity.user_id)}`}>
                          {getInitials(displayName)}
                        </div>
                        <span className="truncate text-sm font-bold text-foreground">
                          {displayName}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs lg:justify-start">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          IP Address
                        </span>
                        <span className="min-w-0 break-all text-right text-muted-foreground lg:text-left">
                          {activity.ip_address || 'Unknown IP'}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs lg:justify-start">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Login Time
                        </span>
                        <span className="text-right text-muted-foreground lg:text-left">
                          {activity.login_at
                            ? format(new Date(activity.login_at), 'MMM d, yyyy · h:mm a')
                            : 'Unknown time'}
                        </span>
                      </div>
                      <div className="col-span-2 flex min-w-0 items-start justify-between gap-3 text-xs lg:col-span-1 lg:justify-start">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Device
                        </span>
                        <span className="flex min-w-0 items-start gap-2 text-right text-muted-foreground lg:text-left">
                          <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 break-all leading-5">
                            {activity.user_agent || 'Unknown device'}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="font-extrabold text-foreground">
                {editingUser?.full_name || 'Unknown User'}
              </p>
              <p className="text-sm text-muted-foreground">
                {editingUser?.email || editingUser?.phone || editingUser?.barangay || 'No email available'}
              </p>
            </div>
            <Select
              value={editRole}
              onValueChange={(value) => setEditRole(value as EditableRole)}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <label
              htmlFor="test-resident-access"
              className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
            >
              <span>
                <span className="block text-sm font-bold">Test Resident</span>
                <span className="block text-xs text-muted-foreground">
                  Allow the additional image upload option.
                </span>
              </span>
              <Switch
                id="test-resident-access"
                checked={editingUser?.is_test_account ?? false}
                onCheckedChange={(enabled) =>
                  editingUser &&
                  void updateTestAccountAccess(editingUser.user_id, enabled)
                }
                disabled={isUpdatingTestAccount}
                aria-label="Test Resident upload access"
              />
            </label>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:space-x-0">
            <Button variant="ghost" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editingUser || isUpdatingRole}
              onClick={() =>
                editingUser && void updateUserRole(editingUser.user_id, editRole)
              }
            >
              {isUpdatingRole ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
