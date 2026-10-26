import { createFrameAssembly } from '../frame/frame-assembly';
import { composeFrameProfiles } from '../frame/frame-composition';
import { getFrameFootprint } from '../frame/frame-outline';
import type { FrameProfilePoint } from '../types/frame';
import { createFrameLabDesigns, frameLabModel, frameLabOverallHeightMm } from './frame-lab-designs';
import type { FrameLabDesign } from './frame-lab-designs';

/**
 * Dev-only page (`/frame-lab.html`, not in the build): draws each design's half cross-section
 * beside the model edge and reports whether createFrameAssembly accepts it.
 */
const partColours = ['#c58f5a', '#6f8fa6', '#8aa66f'];
const sectionPaddingMm = 4;
const modelStubMm = 12;

const gallery = document.querySelector<HTMLElement>('#frame-lab');

if (gallery === null) {
  throw new Error('frame-lab.html is missing its #frame-lab container.');
}

for (const design of createFrameLabDesigns()) {
  gallery.append(renderDesignCard(design));
}

// === CARDS ===

function renderDesignCard(design: FrameLabDesign): HTMLElement {
  const card = document.createElement('article');
  const footprint = getFrameFootprint(frameLabModel);
  const profiles = composeFrameProfiles(
    footprint,
    frameLabModel,
    frameLabOverallHeightMm,
    design.frame,
  );
  const assembly = createFrameAssembly(frameLabModel, frameLabOverallHeightMm, design.frame);
  const heading = document.createElement('h2');
  const verdict = document.createElement('p');

  heading.textContent = design.name;
  verdict.className = assembly.ok ? 'verdict ok' : 'verdict fail';
  verdict.textContent = assembly.ok
    ? `✓ ${assembly.data.parts.length} part${assembly.data.parts.length === 1 ? '' : 's'}: ${assembly.data.parts.map(({ id }) => id).join(', ')}`
    : `✗ ${assembly.error.message}`;
  card.append(heading);

  if (profiles.ok) {
    card.append(renderSection(profiles.data.map(({ profile }) => profile.points)));
  }

  card.append(verdict);

  return card;
}

/** Offset runs right from the model edge; the model stub sits left of zero on the floor. */
function renderSection(parts: readonly (readonly FrameProfilePoint[])[]): SVGSVGElement {
  const points = parts.flat();
  const maxOffsetMm = Math.max(...points.map(({ offsetMm }) => offsetMm), 1);
  const floorTopMm = Math.max(
    0,
    ...parts
      .slice(0, -1)
      .flat()
      .map(({ heightMm }) => heightMm),
  );
  const lastPart = parts[parts.length - 1] ?? [];
  const modelFloorMm = lastPart.length > 0 ? lastPart[lastPart.length - 1].heightMm : floorTopMm;
  const topMm = Math.max(
    ...points.map(({ heightMm }) => heightMm),
    modelFloorMm + frameLabOverallHeightMm,
  );
  const minX = -modelStubMm - sectionPaddingMm;
  const width = maxOffsetMm - minX + sectionPaddingMm;
  const height = topMm + sectionPaddingMm * 2;
  const svg = createSvg('svg', {
    viewBox: `${minX} ${-topMm - sectionPaddingMm} ${width} ${height}`,
  });

  svg.append(
    createSvg('line', { x1: minX, x2: maxOffsetMm + sectionPaddingMm, y1: 0, y2: 0, class: 'bed' }),
    createSvg('path', { d: createModelPath(modelFloorMm), class: 'model' }),
  );

  for (const [index, part] of parts.entries()) {
    svg.append(
      createSvg('path', {
        d: createProfilePath(part),
        fill: partColours[index % partColours.length],
        class: 'part',
      }),
    );
  }

  return svg;
}

// === PATHS ===

/** The profile closed back to the offset axis at zero, as the sweep's caps close it. */
function createProfilePath(points: readonly FrameProfilePoint[]): string {
  const axisOffsetMm = Math.min(0, ...points.map(({ offsetMm }) => offsetMm)) - modelStubMm;
  const first = points[0];
  const last = points[points.length - 1];
  const outline = [
    { offsetMm: axisOffsetMm, heightMm: first.heightMm },
    ...points,
    { offsetMm: axisOffsetMm, heightMm: last.heightMm },
  ];

  return `M ${outline.map(({ offsetMm, heightMm }) => `${offsetMm} ${-heightMm}`).join(' L ')} Z`;
}

/** A base slab plus a rough terrain edge rising to the overall height. */
function createModelPath(floorMm: number): string {
  const baseTopMm = floorMm + frameLabModel.baseThicknessMm;
  const peakMm = floorMm + frameLabOverallHeightMm;

  return [
    `M ${-modelStubMm} ${-floorMm}`,
    `L 0 ${-floorMm}`,
    `L 0 ${-baseTopMm - 5}`,
    `L -3 ${-peakMm + 6}`,
    `L -7 ${-peakMm}`,
    `L ${-modelStubMm} ${-peakMm + 4}`,
    'Z',
  ].join(' ');
}

function createSvg(tag: string, attributes: Record<string, string | number>): SVGSVGElement {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGSVGElement;

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }

  return element;
}
