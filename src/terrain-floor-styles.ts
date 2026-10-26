import type { FloorPlace } from './floor-geo';
import { createFloorPen, type FloorFrame, type FloorPen } from './terrain-floor-pen';
import {
  paintGraticuleLabels,
  paintGraticuleLines,
  paintSurveyLabels,
} from './terrain-floor-graticule-painters';
import {
  paintCropMarkLabels,
  paintPlinthLabels,
  paintRoseLabels,
  paintRoseRhumbLines,
} from './terrain-floor-mark-painters';

export type FloorStyle = 'grid' | 'survey' | 'plinth' | 'rose' | 'graticule' | 'crop';

export const floorStyles: Record<FloorStyle, { label: string }> = {
  grid: { label: 'Grid' },
  survey: { label: 'Survey sheet' },
  plinth: { label: 'Plinth label' },
  rose: { label: 'Compass rose' },
  graticule: { label: 'Graticule' },
  crop: { label: 'Crop marks' },
};

// === PUBLIC API ===

/** Lines that run beneath the model; painted before the footprint erase and radial fade. */
export function paintFloorStyleLines(
  style: FloorStyle,
  frame: FloorFrame,
  place: FloorPlace,
): void {
  const pen = createFloorPen(frame);

  if (style === 'rose') {
    paintRoseRhumbLines(pen);
  }

  if (style === 'graticule') {
    paintGraticuleLines(pen, place);
  }
}

/** Frames and labels sit on top of the fade, outside the model footprint. */
export function paintFloorStyleLabels(
  style: Exclude<FloorStyle, 'grid'>,
  frame: FloorFrame,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
): void {
  floorLabelPainters[style](createFloorPen(frame), place, contourIntervalMeters);
}

// === HELPERS ===

type FloorLabelPainter = (
  pen: FloorPen,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
) => void;

const floorLabelPainters: Record<Exclude<FloorStyle, 'grid'>, FloorLabelPainter> = {
  survey: paintSurveyLabels,
  plinth: paintPlinthLabels,
  rose: paintRoseLabels,
  graticule: paintGraticuleLabels,
  crop: paintCropMarkLabels,
};
