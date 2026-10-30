/*
 * The GPX route in the 3D preview: a bone ribbon draped through the road-ribbon path (own layer,
 * own colour, so the Roads toggle never touches it) plus diamond waypoints at surface height.
 * Preview-only: it joins the scene graph, never `model.solid`, so the STL is unchanged.
 */
import * as THREE from 'three';
import type { GpxRoute } from './types/route';
import { projectToRealTerrainFrame, type FramePoint } from './real-terrain-projection';
import type { RealTerrain } from './real-terrain';
import { clipRoadsToCrop } from './road-ribbons';
import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import { createTerrainRoadLayer, type TerrainRoadInputs } from './terrain-3d-roads';
import type { RoadPath, RoadStyle } from './types/roads';

/** The route in model-crop units, as the ribbon and markers need it. */
export interface TerrainRouteOverlay {
  paths: readonly RoadPath[];
  waypoints: readonly FramePoint[];
}

export type TerrainRouteInputs = Omit<TerrainRoadInputs, 'paths'> & TerrainRouteOverlay;

export interface TerrainRouteLayer {
  object: THREE.Group;
  update(inputs: TerrainRouteInputs): void;
  /** Morphs and terraced models cannot carry draped lines, so they hide them. */
  setSuppressed(value: boolean): void;
  /** Ribbon points and waypoint markers currently built, for the `data-route-*` test hooks. */
  getCounts(): { points: number; waypoints: number };
}

/** Shared so updates without a route keep one identity and never rebuild empty geometry. */
export const noRouteOverlay: TerrainRouteOverlay = Object.freeze({
  paths: Object.freeze([]),
  waypoints: Object.freeze([]),
});

/** Printed width of the route ribbon; a secondary road reads about the same at city scale. */
const routeWidthMm = 1.2;
const routeColor = '#f2f2f0';
/** Above road lift (0.0006), so a route over a road never z-fights it. */
const routeLiftUnits = 0.0012;
const waypointRadiusUnits = 0.022;

const routeRibbonStyle: RoadStyle = {
  enabled: true,
  detail: 'tracks',
  color: routeColor,
  widthMm: routeWidthMm,
  autoWidth: false,
  texture: 0,
};

// === PUBLIC API ===

/** Projects the route into crop units, split wherever it leaves the model. */
export function clipRouteToCrop(
  route: Pick<GpxRoute, 'points' | 'waypoints'>,
  placement: Required<Pick<RealTerrain, 'location' | 'spanKm'>>,
  sourceFrame: { width: number; height: number },
  crop: { x: number; y: number; width: number; height: number },
  shape: 'rectangle' | 'circle',
): TerrainRouteOverlay {
  const paths = clipRoadsToCrop(
    [{ id: 0, roadClass: 'secondary', points: route.points }],
    placement,
    sourceFrame,
    crop,
    shape,
  );
  const waypoints = route.waypoints
    .map(({ latitude, longitude }) => {
      const point = projectToRealTerrainFrame(placement, latitude, longitude, sourceFrame);

      return { x: point.x - crop.x, y: point.y - crop.y };
    })
    .filter((point) => isInsideCrop(point, crop, shape));

  return { paths, waypoints };
}

export function createTerrainRouteLayer(): TerrainRouteLayer {
  const ribbons = createTerrainRoadLayer({ color: routeColor, liftUnits: routeLiftUnits });
  const markers = new THREE.Group();
  const object = new THREE.Group();
  const markerGeometry = new THREE.OctahedronGeometry(waypointRadiusUnits);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: routeColor,
    roughness: 0.6,
    metalness: 0,
  });
  let isSuppressed = false;

  ribbons.setStyle(routeRibbonStyle);
  object.add(ribbons.mesh, markers);

  return {
    object,
    update(inputs) {
      const { paths, waypoints, field, width, height, exaggeration, elevationOffset } = inputs;

      ribbons.update({ ...inputs, paths });
      markers.clear();

      const scale = 2 / Math.max(width, height);

      for (const waypoint of waypoints) {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        const surfaceHeight =
          sampleHeightField(field, waypoint.x, waypoint.y) *
            terrain3dElevationScale *
            exaggeration +
          elevationOffset;

        marker.position.set(
          (waypoint.x - width / 2) * scale,
          surfaceHeight + waypointRadiusUnits * 0.6,
          (waypoint.y - height / 2) * scale,
        );
        markers.add(marker);
      }

      markers.visible = !isSuppressed;
    },
    setSuppressed(value) {
      isSuppressed = value;
      ribbons.setSuppressed(value);
      markers.visible = !value;
    },
    getCounts() {
      return {
        points: ribbons.mesh.visible ? countRibbonPoints(ribbons.mesh.geometry) : 0,
        waypoints: markers.visible ? markers.children.length : 0,
      };
    },
  };
}

// === HELPERS ===

/** Ribbon vertices come in left/right pairs per drawn point. */
function countRibbonPoints(geometry: THREE.BufferGeometry): number {
  return geometry.hasAttribute('position') ? geometry.getAttribute('position').count / 2 : 0;
}

function isInsideCrop(
  point: FramePoint,
  crop: { width: number; height: number },
  shape: 'rectangle' | 'circle',
): boolean {
  if (shape === 'circle') {
    const radius = crop.width / 2;

    return Math.hypot(point.x - radius, point.y - radius) <= radius;
  }

  return point.x >= 0 && point.x <= crop.width && point.y >= 0 && point.y <= crop.height;
}
