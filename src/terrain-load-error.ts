import type { StudioFaultKind } from './constants/faults';

export type TerrainLoadErrorKind = Extract<
  StudioFaultKind,
  'tileDownloadFailed' | 'tileDecodeFailed' | 'locationOutOfRange'
>;

/** A terrain failure the studio maps to a fault code; the message stays the user-facing text. */
export class TerrainLoadError extends Error {
  readonly kind: TerrainLoadErrorKind;

  constructor(kind: TerrainLoadErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TerrainLoadError';
    this.kind = kind;
  }
}
