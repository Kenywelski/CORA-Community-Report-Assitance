export const normalizeAuthEmail = (email: string) => email.trim().toLowerCase();

/**
 * Supabase's hosted mail validator rejects legacy Gmail usernames shorter than
 * six characters. Gmail plus aliases deliver to the same inbox, so CORA uses a
 * stable alias for those addresses throughout sign-up, sign-in, and recovery.
 */
export const getAuthEmail = (email: string) => {
  const normalizedEmail = normalizeAuthEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex < 1) return normalizedEmail;

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);

  if (domain === 'gmail.com' && localPart.length < 6 && !localPart.includes('+')) {
    return `${localPart}+cora@gmail.com`;
  }

  return normalizedEmail;
};
