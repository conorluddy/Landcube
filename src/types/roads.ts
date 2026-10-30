import type { roadClasses, roadDetails } from '../constants/roads';

/** Mapped OSM `highway` values landcube draws; anything else is ignored. */
export type RoadClass = (typeof roadClasses)[number];

/** How much of the network to draw, from major routes down to unpaved tracks. */
export type RoadDetail = (typeof roadDetails)[number];

/** One mapped way in geographic coordinates; points stay unprojected so crops never refetch. */
export interface MappedRoad {
  id: number;
  roadClass: RoadClass;
  points: { latitude: number; longitude: number }[];
}

/** A fetched road network plus what was left out and where it came from. */
export interface RoadNetwork {
  roads: MappedRoad[];
  /** Tunnels and bridges are hidden until they have their own geometry; one entry per way. */
  omitted: { roadClass: RoadClass; kind: 'tunnel' | 'bridge' }[];
  /** The finest detail this network was fetched with. */
  detail: RoadDetail;
  fetchedAt: string;
  attribution: string;
}

/** Road appearance in the 3D preview; changing it never refetches. */
export interface RoadStyle {
  enabled: boolean;
  detail: RoadDetail;
  color: string;
  /** Width of a secondary road on the printed model; other classes scale from it. */
  widthMm: number;
  /** Follows the model's geographic size until the width is edited. */
  autoWidth: boolean;
  /** Asphalt grit and wear, 0 (flat) to 1. */
  texture: number;
}

/** A road run in source-frame units, already clipped to the model crop. */
export interface RoadPath {
  roadClass: RoadClass;
  points: { x: number; y: number }[];
}
