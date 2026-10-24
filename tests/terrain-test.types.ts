import type { ContourPoint } from '../src/types/contours';

export interface ContourSegmentFixture {
  a: ContourPoint;
  b: ContourPoint;
  level: number;
}
