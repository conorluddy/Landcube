import type { ValidatedDesignSettings } from './design';

export interface ExportFile {
  blob: Blob;
  filename: string;
}

export interface OutputRenderer {
  getSvg: (settings: ValidatedDesignSettings) => string;
}
