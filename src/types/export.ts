import type { DesignSettings, ValidatedDesignSettings } from './design';
import type { OperationError } from './operations';

export type ExportState = { phase: 'idle' } | { phase: 'generating' } | { phase: 'failed'; error: OperationError };

export interface ExportActions {
  getSettings: () => ValidatedDesignSettings;
  updateSettings: (settings: DesignSettings) => boolean;
  notify: (message: string) => void;
}

export interface ExportFile { blob: Blob; filename: string }

export interface OutputRenderer { getSvg: (settings: ValidatedDesignSettings) => string }
