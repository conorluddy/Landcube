/** Ordered from widest to narrowest; detail levels include a prefix of this list. */
export const roadClasses = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'track',
] as const;

export const roadDetails = ['major', 'all', 'tracks'] as const;

/** Classes each detail level draws. */
export const roadDetailClasses = {
  major: roadClasses.slice(0, 8),
  all: roadClasses.slice(0, 13),
  tracks: roadClasses,
} as const;

/** Relative to the secondary-road width the user picks. */
export const roadClassWidthFactors: Readonly<Record<(typeof roadClasses)[number], number>> = {
  motorway: 1.6,
  trunk: 1.4,
  primary: 1.2,
  secondary: 1,
  motorway_link: 0.8,
  trunk_link: 0.8,
  primary_link: 0.7,
  secondary_link: 0.7,
  tertiary: 0.8,
  tertiary_link: 0.6,
  unclassified: 0.6,
  residential: 0.5,
  living_street: 0.45,
  track: 0.4,
};

/**
 * Larger areas only fetch major roads: a 25 km Overpass response is a few megabytes in dense
 * places, and minor roads are sub-pixel on a whole-region model anyway.
 */
export const roadSpanLimitsKm = { allRoads: 25, majorRoads: 100 } as const;

export const overpassEndpoint = 'https://overpass-api.de/api/interpreter';
export const overpassTimeoutSeconds = 30;
/** Parsing and draping more than this on the main thread stalls the studio. */
export const overpassMaximumResponseBytes = 20 * 1024 * 1024;
/** Places whose road networks stay cached; autoplay tours would otherwise keep every one. */
export const cachedRoadNetworkLimit = 5;
export const roadAttribution = 'Roads © OpenStreetMap contributors';

export const defaultRoadStyle = {
  enabled: false,
  detail: 'all',
  color: '#8a8a8a',
  widthMm: 0.6,
  autoWidth: true,
  texture: 0.5,
} as const;

export const roadWidthMmLimits = { minimum: 0.1, maximum: 3, step: 0.05 } as const;

/** Auto width: 0.5 mm reads well on a 5 km model, so wider areas get proportionally bolder roads. */
export const roadWidthMmPerModelKm = 0.1;
