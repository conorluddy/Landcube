const terrainTileTimeoutMs = 20_000;

/** Downloads public elevation tiles with actionable errors shared by both platforms. */
export async function downloadTerrainTile(tileUrl: string): Promise<Response> {
  try {
    const response = await fetch(tileUrl, { signal: AbortSignal.timeout(terrainTileTimeoutMs) });

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

    throw new Error(
      `Terrain tile download failed (${tileUrl}): ${details.join(' — ') || 'Unknown network error'}. Check your connection and retry.`,
      { cause: error },
    );
  }
}
