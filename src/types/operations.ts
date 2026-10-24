import type { operationErrorCodes } from '../constants/operations';

export interface OperationError {
  code: (typeof operationErrorCodes)[keyof typeof operationErrorCodes];
  message: string;
  retryable: boolean;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: OperationError };
