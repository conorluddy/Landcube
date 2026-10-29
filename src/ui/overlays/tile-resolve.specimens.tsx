import { defineSpecimens } from '../specimens';
import { TileResolve } from './tile-resolve';

/** Overlays fill a positioned parent, so each specimen supplies a sized one. */
function Viewport({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ position: 'relative', width: 240, height: 160 }}>{children}</div>;
}

export default defineSpecimens('tile-resolve', [
  {
    variant: 'unknown',
    render: () => (
      <Viewport>
        <TileResolve loadedTiles={0} totalTiles={0} />
      </Viewport>
    ),
  },
  {
    variant: 'partial',
    render: () => (
      <Viewport>
        <TileResolve loadedTiles={4} totalTiles={9} />
      </Viewport>
    ),
  },
  {
    variant: 'complete',
    render: () => (
      <Viewport>
        <TileResolve loadedTiles={16} totalTiles={16} />
      </Viewport>
    ),
  },
]);
