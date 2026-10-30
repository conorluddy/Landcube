import { operationErrorCodes } from './constants/operations';
import { logOperationError } from './operation-logging';

// `?mode=system&part=<id>` opens the studio straight into design-system mode on one part. These
// keys share the address bar with design parameters but never travel in a style link.

const modeKey = 'mode';
const partKey = 'part';
const systemModeValue = 'system';

export interface SystemLink {
  /** A part id (`ruler-slider`) or code (`PRIM.08`) as typed; resolved by the registry. */
  partReference: string | undefined;
}

// === PUBLIC API ===

/** The system link in `parameters`, or undefined when they don't open system mode. */
export function readSystemLink(parameters: URLSearchParams): SystemLink | undefined {
  if (parameters.get(modeKey) !== systemModeValue) {
    return undefined;
  }

  const part = parameters.get(partKey)?.trim();

  return { partReference: part === undefined || part === '' ? undefined : part };
}

/** `href` with the system link set to `partId`, or removed when `partId` is undefined. */
export function writeSystemLink(href: string, partId: string | undefined): string {
  const url = new URL(href);

  if (partId === undefined) {
    url.searchParams.delete(modeKey);
    url.searchParams.delete(partKey);
  } else {
    url.searchParams.set(modeKey, systemModeValue);
    url.searchParams.set(partKey, partId);
  }

  return url.href;
}

/** `targetHref` carrying over any system link in `sourceHref`, e.g. when design sync rewrites the query. */
export function keepSystemLink(sourceHref: string, targetHref: string): string {
  const source = new URL(sourceHref).searchParams;
  const target = new URL(targetHref);

  if (readSystemLink(source) === undefined) {
    return targetHref;
  }

  for (const key of [modeKey, partKey]) {
    const value = source.get(key);

    if (value !== null) {
      target.searchParams.set(key, value);
    }
  }

  return target.href;
}

/** Points the address bar at `partId` (or clears the link) without adding a history entry. */
export function replaceSystemLink(
  href: string,
  partId: string | undefined,
  history: Pick<History, 'replaceState' | 'state'>,
): void {
  try {
    history.replaceState(history.state, '', writeSystemLink(href, partId));
  } catch {
    logOperationError({
      code: operationErrorCodes.urlFailed,
      message: 'Could not update the address bar with the design-system part.',
      retryable: true,
    });
  }
}
