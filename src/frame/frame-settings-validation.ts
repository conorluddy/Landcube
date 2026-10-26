import { maximumFrameDimensionMm } from '../constants/frame';
import type {
  FrameEdge,
  FrameFootEdge,
  FrameFootprint,
  FrameSettings,
  FrameSurround,
  FrameTier,
} from '../types/frame';
import { getOutlineHalfExtentMm } from './frame-outline';

const edgeShapes: readonly FrameEdge['shape'][] = [
  'square',
  'chamfer',
  'cove',
  'round',
  'ogee',
  'step',
];
const footEdgeShapes: readonly FrameFootEdge['shape'][] = ['square', 'undercut'];

// === PUBLIC API ===

/** Checks clearance and every tier before composition. Returns an actionable message. */
export function findFrameTiersError(frame: FrameSettings): string | undefined {
  if (!isMillimetres(frame.clearanceMm)) {
    return `clearanceMm must be a number of millimetres up to ${maximumFrameDimensionMm}; got ${frame.clearanceMm}.`;
  }

  if (frame.surround !== undefined && frame.tiers.length === 0) {
    return 'A surround needs a tier under it for the model to sit on. Add a tier.';
  }

  for (const [index, tier] of frame.tiers.entries()) {
    const tierError = findTierError(tier, index);

    if (tierError !== undefined) {
      return `Tier ${index + 1}: ${tierError}`;
    }
  }

  return undefined;
}

// === HELPERS ===

function findTierError(tier: FrameTier, index: number): string | undefined {
  if (!isMillimetres(tier.offsetMm)) {
    return `offsetMm must be a number of millimetres up to ${maximumFrameDimensionMm}; got ${tier.offsetMm}.`;
  }

  if (!isPositiveMillimetres(tier.heightMm)) {
    return `heightMm must be above 0 and at most ${maximumFrameDimensionMm} mm; got ${tier.heightMm}.`;
  }

  if (index === 0 && tier.part === 'join-below') {
    return 'the bottom tier has nothing below to join. Use part separate.';
  }

  if (
    tier.part === 'join-below' &&
    tier.footEdge !== undefined &&
    tier.footEdge.shape !== 'square'
  ) {
    return 'only a tier that starts a part can have a footEdge. Remove it or use part separate.';
  }

  return findEdgeError('edge', tier.edge, tier.heightMm) ?? findFootEdgeError(tier.footEdge);
}

/** Checks the surround once its rim height is resolved against the model. */
export function findFrameSurroundError(
  footprint: FrameFootprint,
  frame: FrameSettings,
  surround: FrameSurround,
  rimHeightMm: number,
): string | undefined {
  if (surround.lipMm !== undefined) {
    return 'Surround lips arrive with shadow boxes (#36). Omit lipMm.';
  }

  if (!isPositiveMillimetres(surround.borderWidthMm)) {
    return `Surround borderWidthMm must be above 0 and at most ${maximumFrameDimensionMm} mm; got ${surround.borderWidthMm}.`;
  }

  if (!isPositiveMillimetres(rimHeightMm)) {
    return `Surround rim resolves to ${rimHeightMm} mm above the floor; it must be above 0 and at most ${maximumFrameDimensionMm} mm. Change rimHeight.`;
  }

  const openingHalfExtentMm = getOutlineHalfExtentMm(footprint, frame.clearanceMm);

  if (openingHalfExtentMm <= 0) {
    return `clearanceMm ${frame.clearanceMm} collapses the surround opening to a half-extent of ${openingHalfExtentMm} mm. Use a clearance above ${-getOutlineHalfExtentMm(footprint, 0)} mm.`;
  }

  const rimEdgeError = findEdgeError('rimEdge', surround.rimEdge, rimHeightMm);
  const innerEdgeError = findEdgeError('innerEdge', surround.innerEdge, rimHeightMm);

  if (rimEdgeError !== undefined || innerEdgeError !== undefined) {
    return `Surround ${rimEdgeError ?? innerEdgeError}`;
  }

  return undefined;
}

function findEdgeError(name: string, edge: FrameEdge, spanMm: number): string | undefined {
  if (!edgeShapes.includes(edge.shape)) {
    return `${name} shape ${edge.shape} is unknown. Use one of ${edgeShapes.join(', ')}.`;
  }

  if (edge.shape === 'square') {
    return undefined;
  }

  if (!isPositiveMillimetres(edge.sizeMm)) {
    return `${name} sizeMm must be above 0 and at most ${maximumFrameDimensionMm} mm; got ${edge.sizeMm}.`;
  }

  if (edge.sizeMm > spanMm) {
    return `${name} sizeMm ${edge.sizeMm} is taller than the ${spanMm} mm face it cuts. Shrink sizeMm.`;
  }

  return undefined;
}

function findFootEdgeError(footEdge: FrameFootEdge | undefined): string | undefined {
  if (footEdge === undefined || footEdge.shape === 'square') {
    return undefined;
  }

  if (!footEdgeShapes.includes(footEdge.shape)) {
    return `footEdge shape ${footEdge.shape} is unknown. Use one of ${footEdgeShapes.join(', ')}.`;
  }

  if (!isPositiveMillimetres(footEdge.sizeMm)) {
    return `footEdge sizeMm must be above 0 and at most ${maximumFrameDimensionMm} mm; got ${footEdge.sizeMm}.`;
  }

  return undefined;
}

function isMillimetres(valueMm: number): boolean {
  return Number.isFinite(valueMm) && Math.abs(valueMm) <= maximumFrameDimensionMm;
}

function isPositiveMillimetres(valueMm: number): boolean {
  return Number.isFinite(valueMm) && valueMm > 0 && valueMm <= maximumFrameDimensionMm;
}
