import { useSyncExternalStore } from 'react';
import type { HudStore } from './hud-store';

/** Re-renders the caller when the camera moves or the model rebuilds, so it can re-project places. */
export function useProjectionRevision(hud: HudStore): number {
  return useSyncExternalStore(hud.subscribeProjection, hud.getProjectionRevision);
}
