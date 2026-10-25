interface Point {
  x: number;
  y: number;
  z: number;
}

/** Clips the actual model triangles, retaining its exact rectangular or circular cut edge. */
export function createWaterVolume(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  level: number,
): { top: number[]; sides: number[] } {
  const top: number[] = [];
  const sides: number[] = [];
  const edges = new Map<string, [number, number]>();
  const point = (index: number): Point => ({
    x: positions[index * 3],
    y: positions[index * 3 + 1],
    z: positions[index * 3 + 2],
  });

  const intersection = (a: Point, b: Point): Point => {
    const t = (level - a.y) / (b.y - a.y);

    return { x: a.x + (b.x - a.x) * t, y: level, z: a.z + (b.z - a.z) * t };
  };

  const emit = (target: number[], ...points: Point[]) => {
    for (const p of points) {
      target.push(p.x, p.y, p.z);
    }
  };

  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const polygon: Point[] = [];

    for (let i = 0; i < 3; i++) {
      const aIndex = triangle[i];
      const bIndex = triangle[(i + 1) % 3];
      const key = `${Math.min(aIndex, bIndex)}:${Math.max(aIndex, bIndex)}`;

      if (edges.has(key)) {
        edges.delete(key);
      } else {
        edges.set(key, [aIndex, bIndex]);
      }

      const a = point(aIndex);
      const b = point(bIndex);

      if (a.y <= level) {
        polygon.push({ ...a, y: level });
      }

      if ((a.y < level && b.y > level) || (a.y > level && b.y < level)) {
        polygon.push(intersection(a, b));
      }
    }

    for (let i = 1; i < polygon.length - 1; i++) {
      emit(top, polygon[0], polygon[i], polygon[i + 1]);
    }
  }

  for (const [aIndex, bIndex] of edges.values()) {
    let a = point(aIndex);
    let b = point(bIndex);

    if (a.y >= level && b.y >= level) {
      continue;
    }

    if (a.y > level) {
      a = intersection(a, b);
    }

    if (b.y > level) {
      b = intersection(a, b);
    }

    const upperA = { ...a, y: level };
    const upperB = { ...b, y: level };

    emit(sides, a, b, upperB, a, upperB, upperA);
  }

  return { top, sides };
}
