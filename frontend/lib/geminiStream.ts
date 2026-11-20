const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getTextDelta = (value: unknown): string => {
  if (!isRecord(value)) return '';

  const delta = value.delta;
  if (
    value.event_type === 'step.delta' &&
    isRecord(delta) &&
    delta.type === 'text' &&
    typeof delta.text === 'string'
  ) {
    return delta.text;
  }

  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const firstCandidate = candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) return '';

  const parts = firstCandidate.content.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
};

export async function readGeminiTextStream(
  response: Response,
  onDelta: (delta: string) => void,
): Promise<string> {
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  const handleLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) return;

    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      return;
    }

    const delta = getTextDelta(value);
    if (!delta) return;

    answer += delta;
    onDelta(delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      handleLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);

  return answer;
}
