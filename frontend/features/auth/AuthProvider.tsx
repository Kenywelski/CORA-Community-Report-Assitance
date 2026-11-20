import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isGoogleAuthEnabled, supabase } from '@/integrations/supabase/client';
import { AuthContext } from './AuthContext';
import { getAuthEmail, normalizeAuthEmail } from './authEmail';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffDepartmentId, setStaffDepartmentId] = useState<string | null>(null);

  const ensureUserProfile = async (currentUser: User) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (existingProfile) return;

    const fullName =
      (currentUser.user_metadata?.full_name as string | undefined) ||
      (currentUser.user_metadata?.name as string | undefined) ||
      currentUser.email?.split('@')[0] ||
      null;

    const { error } = await supabase.from('profiles').insert({
      user_id: currentUser.id,
      full_name: fullName,
      avatar_url:
        (currentUser.user_metadata?.avatar_url as string | undefined) || null,
    });
    if (error && error.code !== '23505') {
      console.error('Profile initialization failed:', error);
    }
  };

  const checkAccess = useCallback(async (userId: string) => {
    const [{ data: roles, error: roleError }, { data: staff, error: staffError }] =
      await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('staff_accounts')
          .select('department_id, is_active')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
    if (roleError) throw roleError;
    if (staffError) throw staffError;
    const activeStaff = staff?.is_active === true;
    return {
      isAdmin: roles?.some((entry) => entry.role === 'admin') ?? false,
      isStaff: activeStaff,
      staffDepartmentId: activeStaff ? staff.department_id : null,
    };
  }, []);

  const recordLogin = async (currentSession: Session) => {
    const key = `cora-login:${currentSession.access_token.slice(-16)}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Continue without client-side deduplication when storage is unavailable.
    }
    const { error } = await supabase.from('user_login_activity').insert({
      user_id: currentSession.user.id,
      user_agent: navigator.userAgent,
    });
    if (error) console.error('Login activity recording failed:', error);
  };

  useEffect(() => {
    let mounted = true;
    let accessRequestId = 0;
    let accessUserId: string | null = null;
    let checkingUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, currentSession) => {
      if (!mounted) return;
      const currentUser = currentSession?.user ?? null;
      setSession(currentSession);
      setUser(currentUser);

      if (!currentUser) {
        accessRequestId += 1;
        accessUserId = null;
        checkingUserId = null;
        setIsAdmin(false);
        setIsStaff(false);
        setStaffDepartmentId(null);
        setAccessError(null);
        setIsAccessLoading(false);
        setIsLoading(false);
        return;
      }

      if (currentUser.id === accessUserId || currentUser.id === checkingUserId) {
        setIsLoading(false);
        return;
      }

      const requestId = ++accessRequestId;
      accessUserId = null;
      checkingUserId = currentUser.id;
      setIsAdmin(false);
      setIsStaff(false);
      setStaffDepartmentId(null);
      setAccessError(null);
      setIsAccessLoading(true);
      setIsLoading(false);
      setTimeout(() => {
        void (async () => {
          try {
            void ensureUserProfile(currentUser).catch((error) => {
              console.error('Profile initialization failed:', error);
            });
            const access = await checkAccess(currentUser.id);
            if (!mounted || requestId !== accessRequestId) return;
            accessUserId = currentUser.id;
            checkingUserId = null;
            setIsAdmin(access.isAdmin);
            setIsStaff(access.isStaff);
            setStaffDepartmentId(access.staffDepartmentId);
            void recordLogin(currentSession).catch((error) => {
              console.error('Login activity recording failed:', error);
            });
          } catch (error) {
            console.error('Post-login initialization failed:', error);
            if (mounted && requestId === accessRequestId) {
              accessUserId = currentUser.id;
              checkingUserId = null;
              setAccessError(
                'Unable to verify your account access. Refresh the page to try again.'
              );
            }
          } finally {
            if (mounted && requestId === accessRequestId) {
              setIsAccessLoading(false);
            }
          }
        })();
      }, 0);
    });

    return () => {
      mounted = false;
      accessRequestId += 1;
      subscription.unsubscribe();
    };
  }, [checkAccess]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    let refreshRequestId = 0;
    const refreshAccess = async () => {
      const requestId = ++refreshRequestId;
      setIsAccessLoading(true);
      setAccessError(null);
      try {
        const access = await checkAccess(user.id);
        if (!mounted || requestId !== refreshRequestId) return;
        setIsAdmin(access.isAdmin);
        setIsStaff(access.isStaff);
        setStaffDepartmentId(access.staffDepartmentId);
      } catch (error) {
        console.error('Realtime account access refresh failed:', error);
        if (!mounted || requestId !== refreshRequestId) return;
        setIsAdmin(false);
        setIsStaff(false);
        setStaffDepartmentId(null);
        setAccessError(
          'Unable to verify your account access. Refresh the page to try again.'
        );
      } finally {
        if (mounted && requestId === refreshRequestId) setIsAccessLoading(false);
      }
    };

    const channel = supabase
      .channel(`account-access-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
        },
        () => void refreshAccess(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_accounts',
          filter: `user_id=eq.${user.id}`,
        },
        () => void refreshAccess(),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [checkAccess, user?.id]);

  const signInWithGoogle = async () => {
    try {
      const googleEnabled = await isGoogleAuthEnabled();
      if (!googleEnabled) {
        return {
          error: new Error(
            'Google sign-in is not enabled yet. Please use your email and password.'
          ),
        };
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error('Google sign-in is currently unavailable.'),
      };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const normalizedEmail = normalizeAuthEmail(email);
    const authEmail = getAuthEmail(normalizedEmail);
    const firstAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    const shouldTryAlias =
      firstAttempt.error?.code === 'invalid_credentials' ||
      firstAttempt.error?.message.includes('Invalid login credentials');

    if (!firstAttempt.error || authEmail === normalizedEmail || !shouldTryAlias) {
      return { error: firstAttempt.error };
    }

    const aliasAttempt = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });
    return { error: aliasAttempt.error };
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    const normalizedEmail = normalizeAuthEmail(email);
    const { error } = await supabase.auth.signUp({
      email: getAuthEmail(normalizedEmail),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          contact_email: normalizedEmail,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAccessLoading(false);
    setAccessError(null);
    setIsAdmin(false);
    setIsStaff(false);
    setStaffDepartmentId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAccessLoading,
        accessError,
        isAdmin,
        isStaff,
        staffDepartmentId,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
