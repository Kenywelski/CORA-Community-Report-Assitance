import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { getAuthEmail } from '@/features/auth/authEmail';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, User, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ROUTES } from '@/app/routePaths';
import heroImage from '@/features/residents/assets/hero-coastal.jpg';
import sunriseImage from '@/features/residents/assets/purisima-sunrise.jpg';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
  }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showResetEmailSent, setShowResetEmailSent] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
  });

  const {
    user,
    isAdmin,
    isAccessLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    isLoading,
  } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    const currentState: unknown = window.history.state?.usr;
    const existingState =
      typeof currentState === 'object' && currentState !== null ? currentState : {};
    const hasMobileBackTrap =
      'mobileAuthBackTrap' in existingState &&
      existingState.mobileAuthBackTrap === true;

    if (!hasMobileBackTrap) {
      navigateRef.current(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        { state: { ...existingState, mobileAuthBackTrap: true } },
      );
    }

    const handleMobileBack = () => {
      navigateRef.current(ROUTES.landing, { replace: true });
    };
    window.addEventListener('popstate', handleMobileBack);
    return () => window.removeEventListener('popstate', handleMobileBack);
  }, []);

  const authInputClassName =
    'h-14 rounded-[20px] border-[#d5dadd] bg-[#f8f9fa] pl-12 text-base shadow-none placeholder:text-[#6b7280] focus-visible:border-[#1f7f73] focus-visible:ring-[#1f7f73]/20 lg:h-11 lg:rounded-md lg:border-input lg:bg-background lg:pl-10 lg:text-sm';
  const primaryAuthButtonClassName =
    'h-14 w-full touch-manipulation rounded-[18px] bg-[#1f7f73] text-base font-bold text-white shadow-sm hover:bg-[#1f7f73] hover:opacity-90 lg:h-11 lg:rounded-xl lg:bg-primary lg:text-base lg:font-semibold lg:hover:bg-primary/90 lg:hover:opacity-100';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsForgotPassword(false);
        setPassword('');
        setConfirmPassword('');
        setErrors({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !isLoading && !isAccessLoading && !isPasswordRecovery) {
      navigate(isAdmin ? '/admin' : '/');
    }
  }, [user, isAdmin, isAccessLoading, isLoading, isPasswordRecovery, navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (!isLogin && !fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Please check your email and confirm your account first.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
        }
      } else {
        const { error } = await signUpWithEmail(email, password, fullName);
        if (error) {
          const errorCode = 'code' in error ? String(error.code) : '';
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in instead.');
          } else if (errorCode === 'email_address_invalid') {
            const message = 'This email provider rejected the address. Please check it or use Continue with Google.';
            setErrors((current) => ({ ...current, email: message }));
            toast.error(message);
          } else {
            toast.error(error.message);
          }
        } else {
          setShowConfirmation(true);
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const message = error.message || '';
        if (message.toLowerCase().includes('not enabled')) {
          toast.error(message);
        } else if (message.toLowerCase().includes('invalid_client') || message.toLowerCase().includes('oauth')) {
          toast.error('Google login is not configured correctly yet. Please use email/password for now.');
        } else {
          toast.error(message);
        }
      }
    } catch {
      toast.error('Google sign-in is currently unavailable.');
    }
    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = emailSchema.safeParse(email);

    if (!emailResult.success) {
      setErrors({ email: emailResult.error.errors[0].message });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(getAuthEmail(email), {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setShowResetEmailSent(true);
      }
    } catch {
      toast.error('Unable to send the password reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    const passwordResult = passwordSchema.safeParse(password);

    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }

      await supabase.auth.signOut();
      setIsPasswordRecovery(false);
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      toast.success('Password updated. You can now sign in with your new password.');
    } catch {
      toast.error('Unable to update your password. Please request a new reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || (user && isAccessLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Email confirmation screen
  if (showConfirmation || showResetEmailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card variant="elevated" className="max-w-md w-full animate-slide-up">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {showResetEmailSent ? (
                <>
                  If an account exists for <strong className="text-foreground">{email}</strong>,
                  a password reset link has been sent. Please check your inbox and spam folder.
                </>
              ) : (
                <>
                  We've sent a confirmation link to <strong className="text-foreground">{email}</strong>.
                  Please check your inbox and click the link to activate your account.
                </>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setShowResetEmailSent(false);
                  setIsForgotPassword(false);
                  setIsLogin(true);
                }}
                className="w-full"
              >
                Back to Sign In
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col">
        {/* Background photo */}
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Teal color overlay — lets photo show through like the design reference */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(14,105,95,0.82) 0%, rgba(22,138,124,0.72) 40%, rgba(32,160,142,0.60) 100%)' }} />
        {/* Subtle dark vignette at bottom for text legibility */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,60,54,0.55) 0%, transparent 50%)' }} />

        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          {/* Top: Branding */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
              <img
                src="/assets/branding/cora-logo.png"
                alt="CORA logo"
                className="h-full w-full scale-[1.18] object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">CORA</h1>
              <p className="text-sm font-medium text-white/80">Community Report System</p>
              <p className="text-xs text-white/60">Barangay Purisima, Tago, Surigao del Sur</p>
            </div>
          </div>

          {/* Center-bottom: Hero copy */}
          <div className="mb-10">
            <h2 className="mb-3 text-[2.6rem] font-extrabold leading-tight tracking-tight text-white drop-shadow">
              {isPasswordRecovery
                ? 'Create a New Password'
                : isForgotPassword
                  ? 'Recover Your Account'
                  : isLogin
                    ? 'Welcome Back!'
                    : 'Create Your Account'}
            </h2>
            <p className="max-w-xs text-base leading-relaxed text-white/75">
              {isPasswordRecovery
                ? 'Choose a new password to securely access your CORA account.'
                : isForgotPassword
                  ? 'Enter your email and we will send you a secure reset link.'
                  : isLogin
                    ? 'Sign in to track your community reports and stay informed.'
                    : 'Create an account to track your reports and receive community updates.'}
            </p>
          </div>

          {/* Bottom: Location tag */}
          <p className="text-xs text-white/55">Barangay Purisima, Tago, Surigao del Sur</p>
        </div>
      </aside>

      <div className="min-h-screen lg:bg-background">
      {/* Mobile header — sunrise photo background, hidden on desktop */}
      <header className="relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden px-5 pb-14 pt-6 text-center text-white sm:min-h-[270px] lg:hidden">
        {/* Background photo */}
        <img
          src={sunriseImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Teal overlay so branding stays legible */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(14,105,95,0.80) 0%, rgba(22,138,124,0.68) 50%, rgba(32,160,142,0.58) 100%)' }} />
        {/* Dark vignette at bottom for smooth bleed into the form card */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,60,54,0.60) 0%, transparent 55%)' }} />

        {/* Branding content */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md sm:h-[64px] sm:w-[64px] sm:rounded-[14px]">
            <img
              src="/assets/branding/cora-logo.png"
              alt="CORA logo"
              className="h-full w-full scale-[1.08] object-cover"
            />
          </div>
          <h1 className="mt-2.5 text-[34px] font-extrabold leading-none tracking-[-0.04em] drop-shadow sm:text-[38px]">CORA</h1>
          <p className="mt-1.5 text-sm font-semibold text-white/85 drop-shadow-sm sm:text-base">Community Report System</p>
          <p className="mt-0.5 text-xs text-white/65">Barangay Purisima, Tago, Surigao del Sur</p>
        </div>
      </header>

      <section className="relative -mt-9 min-h-[calc(100vh-184px)] rounded-t-[42px] bg-white px-5 pb-10 pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] sm:rounded-t-[50px] sm:px-8 sm:pt-9 lg:mt-0 lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:rounded-none lg:bg-background lg:px-12 lg:py-8 lg:shadow-none xl:px-16">
        <div className="mx-auto w-full max-w-[500px] lg:max-w-lg">
            <button
              type="button"
              onClick={() => navigate(ROUTES.landing)}
              className="mb-8 hidden items-center gap-2 text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Landing Page</span>
            </button>

            <Card variant="elevated" className="animate-slide-up border-0 bg-transparent shadow-none lg:border lg:bg-card lg:shadow-elevated">
              <CardHeader className="pb-7 text-center lg:pb-4 lg:text-left">
                <CardTitle className="text-[38px] font-extrabold tracking-[-0.04em] text-[#1f7f73] sm:text-[44px] lg:text-2xl lg:font-semibold lg:tracking-normal lg:text-foreground">
                  {isPasswordRecovery
                    ? 'Create New Password'
                    : isForgotPassword
                      ? 'Forgot Password'
                      : isLogin
                        ? 'Sign In'
                        : 'Sign Up'}
                </CardTitle>
                <CardDescription className="mt-2 text-base text-[#616775] sm:text-lg lg:mt-0 lg:text-base lg:text-muted-foreground">
                  {isPasswordRecovery
                    ? 'Enter and confirm your new password'
                    : isForgotPassword
                      ? 'Enter the email connected to your CORA account'
                      : isLogin
                        ? 'Enter your credentials to continue'
                        : 'Fill in your details to create an account'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-0 lg:space-y-4 lg:p-5 lg:pt-0">
                {!isForgotPassword && !isPasswordRecovery && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-14 w-full touch-manipulation rounded-[18px] border-2 border-[#1f7f73] bg-white text-base font-bold text-[#1f7f73] shadow-none hover:bg-[#1f7f73] hover:!text-white hover:[&_svg]:!text-white lg:h-12 lg:rounded-xl lg:border-primary lg:bg-transparent lg:text-base lg:font-semibold lg:text-primary lg:hover:bg-primary lg:hover:!text-primary-foreground"
                      onClick={handleGoogleAuth}
                      disabled={isSubmitting}
                    >
                      <svg className="mr-3 h-6 w-6 lg:mr-2 lg:h-5 lg:w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-[#d7dade]" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-3 text-[#616775] lg:bg-card lg:px-2 lg:text-muted-foreground">Or continue with email</span>
                      </div>
                    </div>
                  </>
                )}

                {isPasswordRecovery ? (
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="New password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={authInputClassName}
                          autoComplete="new-password"
                        />
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={authInputClassName}
                          autoComplete="new-password"
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                      )}
                    </div>

                    <Button type="submit" size="lg" className={primaryAuthButtonClassName} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                    </Button>
                  </form>
                ) : isForgotPassword ? (
                  <>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={authInputClassName}
                            autoComplete="email"
                          />
                        </div>
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>

                      <Button type="submit" size="lg" className={primaryAuthButtonClassName} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                      </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                      Remembered your password?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(false);
                          setIsLogin(true);
                          setErrors({});
                        }}
                        className="touch-manipulation font-semibold text-[#1f7f73] hover:underline lg:font-medium lg:text-primary"
                      >
                        Back to Sign In
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                      {!isLogin && (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Full Name"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className={authInputClassName}
                              autoComplete="name"
                            />
                          </div>
                          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={authInputClassName}
                            autoComplete="email"
                          />
                        </div>
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69717f] lg:left-3 lg:h-4 lg:w-4 lg:text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={authInputClassName}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                          />
                        </div>
                        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                      </div>

                      {isLogin && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(true);
                              setErrors({});
                            }}
                            className="touch-manipulation text-sm font-semibold text-[#1f7f73] hover:underline lg:font-medium lg:text-primary"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      <Button type="submit" size="lg" className={primaryAuthButtonClassName} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isLogin ? (
                          'Sign In'
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </form>

                    {isLogin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-14 w-full touch-manipulation rounded-[18px] border-2 border-[#1f7f73] bg-white text-base font-bold text-[#1f7f73] shadow-none hover:bg-[#1f7f73] hover:!text-white hover:[&_svg]:!text-white lg:h-11 lg:rounded-xl lg:border-primary lg:bg-transparent lg:text-base lg:font-semibold lg:text-primary lg:hover:bg-primary lg:hover:!text-primary-foreground"
                        onClick={() => navigate('/guest')}
                        disabled={isSubmitting}
                      >
                        <User className="mr-2 h-6 w-6 lg:h-4 lg:w-4" />
                        Continue as Guest
                      </Button>
                    )}

                    <p className="text-center text-base text-[#616775] lg:text-sm lg:text-muted-foreground">
                      {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setErrors({});
                        }}
                        className="touch-manipulation font-bold text-[#1f7f73] hover:underline lg:font-medium lg:text-primary"
                      >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                      </button>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
        </div>
      </section>
      </div>
    </div>
  );
};

export default Auth;
