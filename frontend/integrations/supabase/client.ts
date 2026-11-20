import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type AuthSettings = {
  external?: Record<string, boolean | undefined>;
};

/**
 * Supabase redirects the browser directly to its authorize endpoint for OAuth.
 * Check the public Auth settings first so a disabled provider cannot strand the
 * user on Supabase's raw JSON error page.
 */
export const isGoogleAuthEnabled = async () => {
  if (import.meta.env.VITE_GOOGLE_AUTH_ENABLED !== 'true') {
    return false;
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/settings`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to check Google sign-in availability.');
  }

  const settings = (await response.json()) as AuthSettings;
  return settings.external?.google === true;
};
