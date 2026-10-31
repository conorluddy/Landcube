/** Typed Google Analytics events for the hosted site; every call is a no-op where gtag is absent. */

type NoParameters = Record<string, never>;

/** Every event the app reports. Parameters are enums and counts only: never locations, seeds, names or route data. */
export interface AnalyticsEvents {
  export: { format: 'svg' | 'png' | 'stl' | 'frame_stl' | 'still' };
  share_link: { ok: boolean };
  terrain_load: { source: 'real' | 'generated'; span_km?: number };
  terrain_load_failed: { fault: string };
  view_change: { view: '2d' | '3d' };
  preset_apply: { name: string };
  route_import: NoParameters;
  route_export: NoParameters;
  walk_start: NoParameters;
  camera_tour_play: { shots: number };
  design_save: NoParameters;
  operation_failed: { code: string; retryable: boolean };
}

type GtagFunction = (command: 'event', name: string, parameters: object) => void;

// === PUBLIC API ===

/** Reports one event. `index.html` defines `gtag` on the hosted site only, so dev, forks and the CLI stay silent. */
export function track<Name extends keyof AnalyticsEvents>(
  name: Name,
  parameters: AnalyticsEvents[Name],
  gtag: GtagFunction | undefined = (globalThis as { gtag?: GtagFunction }).gtag,
): void {
  try {
    gtag?.('event', name, parameters);
  } catch {
    // Analytics must never break the editor.
  }
}
