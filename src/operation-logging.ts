import type { OperationError } from './types/operations';

/** Emits one structured event for a handled operation failure. */
export function logOperationError(error: OperationError): void {
  console.warn(JSON.stringify({ event: 'operation_failed', ...error }));
}
