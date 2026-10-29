import { TerrainLoadError } from './terrain-load-error';

const terrainTileTimeoutMs = 20_000;

/** Downloads public elevation tiles with actionable errors shared by both platforms. */
export async function downloadTerrainTile(
  tileUrl: string,
  cancelSignal?: AbortSignal,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(terrainTileTimeoutMs);

  try {
    const response = await fetch(tileUrl, {
      signal:
        cancelSignal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, cancelSignal]),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    return response;
  } catch (error) {
    const details: string[] = [];
    const visited = new Set<unknown>();
    let cause: unknown = error;

    while (cause instanceof Error && !visited.has(cause)) {
      visited.add(cause);
      details.push(cause.message);

      if ('code' in cause) {
        details.push(String(cause.code));
      }

      cause = cause.cause;
    }

    throw new TerrainLoadError(
      'tileDownloadFailed',
      `Terrain tile download failed (${tileUrl}): ${details.join(' — ') || 'Unknown network error'}. Check your connection and retry.`,
      { cause: error },
    );
  }
}
