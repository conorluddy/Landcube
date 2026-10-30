/*
 * The route in the 3D preview: a bone ribbon draped over the displayed surface (own layer, own
 * colour, so the Roads toggle never touches it), diamond waypoints, and a profile-inspection
 * marker. Preview-only: it joins the scene graph, never `model.solid`, so the STL is unchanged.
 */
import * as THREE from 'three';
import type { GpxRoute } from './types/route';
import type { GeoPoint } from './types/terrain-analysis';
import { projectToRealTerrainFrame, type FramePoint } from './real-terrain-projection';
import type { RealTerrain } from './real-terrain';
import { clipRoadsToCrop } from './road-ribbons';
import { createTerrainRoadMaterial } from './terrain-road-material';
import { createRouteRibbonBuffers, type DisplayedSurface } from './terrain-3d-route-drape';
import type { RoadPath } from './types/roads';

/** The route in model-crop units, as the ribbon and markers need it. */
export interface TerrainRouteOverlay {
  paths: readonly RoadPath[];
  waypoints: readonly FramePoint[];
}

export interface TerrainRouteInputs extends TerrainRouteOverlay {
  /** Recreated only when the model is, so an unchanged surface keeps the built ribbon. */
  surface: DisplayedSurface;
}

export interface TerrainRouteLayer {
  object: THREE.Group;
  update(inputs: TerrainRouteInputs): void;
  /** Morphs cannot carry draped lines, so they hide them. */
  setSuppressed(value: boolean): void;
  /** Moves the profile-inspection marker to a crop-unit point; never rebuilds the ribbon. */
  setInspectedPoint(point: FramePoint | undefined): void;
  /** What is currently drawn, plus ribbon rebuilds so far, for the `data-route-*` test hooks. */
  getCounts(): { points: number; waypoints: number; markers: number; builds: number };
}

type RoutePlacement = Required<Pick<RealTerrain, 'location' | 'spanKm'>>;
interface SourceFrame {
  width: number;
  height: number;
}
interface SourceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shared so updates without a route keep one identity and never rebuild empty geometry. */
export const noRouteOverlay: TerrainRouteOverlay = Object.freeze({
  paths: Object.freeze([]),
  waypoints: Object.freeze([]),
});

/** Printed width of the route ribbon; a secondary road reads about the same at city scale. */
const routeWidthMm = 1.2;
const routeColor = '#f2f2f0';
/** Signal orange, so the inspected point stands out from the bone ribbon on any material. */
const inspectionColor = '#ff6a2b';
/** Above road lift (0.0006), so a route over a road never z-fights it. */
const routeLiftUnits = 0.0012;
const waypointRadiusUnits = 0.022;
const inspectionRadiusUnits = 0.016;

// === PUBLIC API ===

/** Projects the route into crop units, split wherever it leaves the model. */
export function clipRouteToCrop(
  route: Pick<GpxRoute, 'points' | 'waypoints'>,
  placement: RoutePlacement,
  sourceFrame: SourceFrame,
  crop: SourceCrop,
  shape: 'rectangle' | 'circle',
): TerrainRouteOverlay {
  const paths = clipRoadsToCrop(
    [{ id: 0, roadClass: 'secondary', points: route.points }],
    placement,
    sourceFrame,
    crop,
    shape,
  );
  const waypoints = route.waypoints.flatMap(
    (waypoint) => projectRoutePointToCrop(waypoint, placement, sourceFrame, crop, shape) ?? [],
  );

  return { paths, waypoints };
}

/** A route point in crop units, or undefined when it falls outside the model. */
export function projectRoutePointToCrop(
  { latitude, longitude }: GeoPoint,
  placement: RoutePlacement,
  sourceFrame: SourceFrame,
  crop: SourceCrop,
  shape: 'rectangle' | 'circle',
): FramePoint | undefined {
  const projected = projectToRealTerrainFrame(placement, latitude, longitude, sourceFrame);
  const point = { x: projected.x - crop.x, y: projected.y - crop.y };

  return isInsideCrop(point, crop, shape) ? point : undefined;
}

export function createTerrainRouteLayer(): TerrainRouteLayer {
  const ribbonMaterial = createTerrainRoadMaterial(routeColor);
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMaterial.material);
  const markers = new THREE.Group();
  const markerGeometry = new THREE.OctahedronGeometry(waypointRadiusUnits);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: routeColor,
    roughness: 0.6,
    metalness: 0,
  });
  const inspection = new THREE.Mesh(
    new THREE.SphereGeometry(inspectionRadiusUnits, 16, 12),
    new THREE.MeshStandardMaterial({ color: inspectionColor, roughness: 0.5, metalness: 0 }),
  );
  const object = new THREE.Group();
  let inputs: TerrainRouteInputs | undefined;
  let builtKey: readonly unknown[] = [];
  let pointCount = 0;
  let builds = 0;
  let inspectedPoint: FramePoint | undefined;
  let isSuppressed = false;

  ribbonMaterial.setTexture(0);
  ribbon.receiveShadow = true;
  object.add(ribbon, markers, inspection);

  /** Rests a marker's lowest tip on the displayed surface; false when it is off the model. */
  const place = (marker: THREE.Object3D, point: FramePoint, radius: number) => {
    const surfaceHeight = inputs?.surface.heightAt(point);

    if (!inputs || surfaceHeight === undefined) {
      return false;
    }

    const { width, height } = inputs.surface;
    const scale = 2 / Math.max(width, height);

    marker.position.set(
      (point.x - width / 2) * scale,
      surfaceHeight + radius * 0.6,
      (point.y - height / 2) * scale,
    );

    return true;
  };

  const syncInspection = () => {
    inspection.visible =
      !isSuppressed &&
      pointCount > 0 &&
      inspectedPoint !== undefined &&
      place(inspection, inspectedPoint, inspectionRadiusUnits);
  };

  const syncVisibility = () => {
    ribbon.visible = !isSuppressed && pointCount > 0;
    markers.visible = !isSuppressed;
    syncInspection();
  };

  const rebuild = (value: TerrainRouteInputs) => {
    const { paths, waypoints, surface } = value;
    const buffers = createRouteRibbonBuffers(paths, surface, routeWidthMm, routeLiftUnits);
    const indexed = new THREE.BufferGeometry();

    indexed.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    indexed.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    // Shared normals would bend shelf faces toward the risers, so terraces shade flat.
    const geometry = surface.isTerraced ? indexed.toNonIndexed() : indexed;

    geometry.computeVertexNormals();
    ribbon.geometry.dispose();
    ribbon.geometry = geometry;
    pointCount = buffers.pointCount;
    builds++;
    markers.clear();

    for (const waypoint of waypoints) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      if (place(marker, waypoint, waypointRadiusUnits)) {
        markers.add(marker);
      }
    }
  };

  return {
    object,
    update(value) {
      inputs = value;
      const key = [value.paths, value.waypoints, value.surface];

      if (key.some((part, index) => part !== builtKey[index])) {
        rebuild(value);
        builtKey = key;
      }

      syncVisibility();
    },
    setSuppressed(value) {
      isSuppressed = value;
      syncVisibility();
    },
    setInspectedPoint(point) {
      inspectedPoint = point;
      syncInspection();
    },
    getCounts() {
      return {
        points: ribbon.visible ? pointCount : 0,
        waypoints: markers.visible ? markers.children.length : 0,
        markers: inspection.visible ? 1 : 0,
        builds,
      };
    },
  };
}

// === HELPERS ===

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
