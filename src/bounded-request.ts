// Helpers for one-shot downloads: a timeout that respects the caller's abort,
// and a body read that stops at a byte limit.

/**
 * Aborts on the caller's signal or after `timeoutMs`, whichever comes first.
 * Combined by hand because `AbortSignal.any` needs Safari 17.4 and Chrome 116.
 */
export function createRequestSignal(
  timeoutMs: number,
  signal: AbortSignal | undefined,
  timeoutMessage = 'The download timed out.',
): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();

  const forwardAbort = () => {
    controller.abort(signal?.reason);
  };

  const timer = setTimeout(() => {
    controller.abort(new DOMException(timeoutMessage, 'TimeoutError'));
  }, timeoutMs);

  if (signal?.aborted === true) {
    forwardAbort();
  } else {
    signal?.addEventListener('abort', forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    release() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    },
  };
}

/** Undefined once the body passes `maximumBytes`, without buffering the rest of it. */
export async function readLimitedText(
  response: Response,
  maximumBytes: number,
): Promise<string | undefined> {
  if (Number(response.headers.get('content-length') ?? 0) > maximumBytes) {
    await response.body?.cancel();

    return undefined;
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    totalBytes += chunk.value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();

      return undefined;
    }

    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}
