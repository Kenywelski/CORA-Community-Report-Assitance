const AI_CLIENT_ID_KEY = 'cora-ai-client-id-v1';

export function getAiClientId(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    const savedId = window.localStorage.getItem(AI_CLIENT_ID_KEY);
    if (savedId) return savedId;
  } catch {
    // Continue with a temporary identifier if storage is unavailable.
  }

  const clientId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    window.localStorage.setItem(AI_CLIENT_ID_KEY, clientId);
  } catch {
    // The current request can still use the temporary identifier.
  }

  return clientId;
}
