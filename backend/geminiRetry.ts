const RETRY_DELAYS_MS = [500, 1500] as const;

export async function fetchGeminiWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const requestInit = { ...init };
  delete requestInit.signal;

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...requestInit,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error('Gemini request timed out.');
      }
      throw error;
    }
    const retryDelay = RETRY_DELAYS_MS[attempt];
    if (response.status !== 503 || retryDelay === undefined) return response;

    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
}
