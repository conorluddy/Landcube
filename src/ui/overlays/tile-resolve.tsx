import type { CSSProperties } from 'react';

export interface TileResolveProps {
  loadedTiles: number;
  /** 0 while the count is unknown; a 3 by 3 grid stands in. */
  totalTiles: number;
}

const unknownTotalGridSide = 3;

/** Tile resolve overlay (O-10): a tile grid that fills from the centre out, under a scan-line sweep. */
export function TileResolve({ loadedTiles, totalTiles }: TileResolveProps): React.JSX.Element {
  const { columns, rows } = getTileGrid(totalTiles);
  const cellCount = columns * rows;
  const resolvedCellCount =
    totalTiles > 0 ? Math.round((Math.min(loadedTiles, totalTiles) / totalTiles) * cellCount) : 0;
  const ranks = getCentreOutRanks(columns, rows);

  return (
    <div
      className="lc-tile-resolve"
      aria-hidden="true"
      style={{ '--lc-tile-columns': columns, '--lc-tile-rows': rows } as CSSProperties}
    >
      <div className="lc-tile-resolve__grid">
        {ranks.map((rank, cellIndex) => (
          <span
            key={cellIndex}
            className="lc-tile-resolve__cell"
            data-resolved={rank < resolvedCellCount ? 'true' : undefined}
          />
        ))}
      </div>
      <span className="lc-tile-resolve__sweep" />
    </div>
  );
}

// === HELPERS ===

/** Near-square grid for a tile count, row-major. */
export function getTileGrid(totalTiles: number): { columns: number; rows: number } {
  if (!Number.isFinite(totalTiles) || totalTiles < 1) {
    return { columns: unknownTotalGridSide, rows: unknownTotalGridSide };
  }

  const columns = Math.ceil(Math.sqrt(totalTiles));

  return { columns, rows: Math.ceil(totalTiles / columns) };
}

/** Per cell (row-major), its place in the fill order: 0 is the cell nearest the centre. */
export function getCentreOutRanks(columns: number, rows: number): number[] {
  const distances = Array.from({ length: columns * rows }, (_, cellIndex) => {
    const column = cellIndex % columns;
    const row = Math.floor(cellIndex / columns);

    return Math.hypot(column - (columns - 1) / 2, row - (rows - 1) / 2);
  });
  const cellsByDistance = distances
    .map((distance, cellIndex) => ({ distance, cellIndex }))
    .sort(
      (first, second) => first.distance - second.distance || first.cellIndex - second.cellIndex,
    );
  const ranks = new Array<number>(distances.length);

  cellsByDistance.forEach(({ cellIndex }, rank) => {
    ranks[cellIndex] = rank;
  });

  return ranks;
}
