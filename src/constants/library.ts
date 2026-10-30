export const savedDesignsStorageKey = 'landcube-saved-designs';
/** Designs kept in the Library, newest first. */
export const savedDesignLimit = 24;
/** A thumbnail SVG larger than this is dropped so the Library stays well inside the storage quota. */
export const savedDesignThumbnailMaxBytes = 8 * 1024;

/** Phone splash is shown once per browser session; this sessionStorage key records it. */
export const splashSeenStorageKey = 'landcube-splash-seen';
export const signalAccentStorageKey = 'landcube-signal-accent';
/** Account > Clear local storage removes every localStorage key with one of these prefixes. */
// Legacy prefix kept across the landcube rename so existing data survives.
export const clearableStoragePrefixes = ['landcube-', 'topogra-'] as const;
