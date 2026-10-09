import { AtlasError } from '#errors/atlas-error.js';

import type { Point2 } from './point2.js';

export type PolygonTriangle = readonly [Point2, Point2, Point2];

const TRIANGULATIONS = new WeakMap<readonly Point2[], readonly PolygonTriangle[]>();

/** A power-of-two divisor avoids introducing rounding into normal scaled coordinates. */
function binaryScale(...values: number[]): number {
  const maximum = Math.max(...values.map(Math.abs));

  // log2(MAX_VALUE) rounds to 1024; keep the divisor finite, including at that extreme.
  return 2 ** Math.min(1023, Math.floor(Math.log2(maximum)));
}

/** Orientation with binary scaling when products overflow or underflow. No snapping tolerance. */
export function orientation(start: Point2, end: Point2, point: Point2): number {
  let bx = end.x - start.x;
  let by = end.y - start.y;
  let cx = point.x - start.x;
  let cy = point.y - start.y;
  const determinant = bx * cy - by * cx;

  if (Number.isFinite(determinant) && determinant !== 0) {
    return Math.sign(determinant);
  }

  if (![bx, by, cx, cy].every(Number.isFinite)) {
    const scale = binaryScale(start.x, start.y, end.x, end.y, point.x, point.y);
    bx = end.x / scale - start.x / scale;
    by = end.y / scale - start.y / scale;
    cx = point.x / scale - start.x / scale;
    cy = point.y / scale - start.y / scale;
  }

  const scale = binaryScale(bx, by, cx, cy);

  return scale === 0 ? 0 : Math.sign((bx / scale) * (cy / scale) - (by / scale) * (cx / scale));
}

export function liesOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  return (
    orientation(start, end, point) === 0 &&
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}

export function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);

  return (
    (abc * abd < 0 && cda * cdb < 0) ||
    (abc === 0 && liesOnSegment(c, a, b)) ||
    (abd === 0 && liesOnSegment(d, a, b)) ||
    (cda === 0 && liesOnSegment(a, c, d)) ||
    (cdb === 0 && liesOnSegment(b, c, d))
  );
}

/** Convex cells include their boundary; layer max ownership is checked separately. */
export function containsConvexPolygon(points: readonly Point2[], point: Point2): boolean {
  let sign = 0;

  for (const [index, start] of points.entries()) {
    const side = orientation(start, points.at((index + 1) % points.length)!, point);

    if (side !== 0 && sign !== 0 && side !== sign) {
      return false;
    }

    sign = side || sign;
  }

  return points.length >= 3;
}

/** For a convex cell, any non-collinear fan triangle establishes positive absolute area. */
export function hasPolygonArea(points: readonly Point2[]): boolean {
  return (
    points.length >= 3 &&
    points.some(
      (point, index) => index > 1 && orientation(points[0]!, points.at(index - 1)!, point) !== 0,
    )
  );
}

interface Vertex {
  readonly point: Point2;
  readonly index: number;
  previous: number;
  next: number;
}

/** Cached O(n²) ear clipping: initial ear tests, then only the two changed neighbors. */
export function triangulatePolygon(contour: readonly Point2[]): readonly PolygonTriangle[] {
  const cached = TRIANGULATIONS.get(contour);

  if (cached) {
    return cached;
  }

  const points = contour.filter(
    (point, index) =>
      orientation(
        contour.at((index + contour.length - 1) % contour.length)!,
        point,
        contour.at((index + 1) % contour.length)!,
      ) !== 0,
  );

  if (points.length < 3) {
    throw new AtlasError('Polygon contour must enclose an area.', {
      code: 'INVALID_POLYGON_CONTOUR',
      details: { reason: 'zero-area' },
    });
  }

  const extreme = points.reduce(
    (best, point, index) =>
      point.x < points.at(best)!.x ||
      (point.x === points.at(best)!.x && point.y < points.at(best)!.y)
        ? index
        : best,
    0,
  );

  if (
    orientation(
      points.at((extreme + points.length - 1) % points.length)!,
      points.at(extreme)!,
      points.at((extreme + 1) % points.length)!,
    ) < 0
  ) {
    points.reverse();
  }

  const vertices: Vertex[] = points.map((point, index) => ({
    point,
    index,
    previous: (index + points.length - 1) % points.length,
    next: (index + 1) % points.length,
  }));
  const reflex = new Set<Vertex>();
  const ears = new Set<Vertex>();
  const triangleFor = (vertex: Vertex): PolygonTriangle => [
    vertices.at(vertex.previous)!.point,
    vertex.point,
    vertices.at(vertex.next)!.point,
  ];

  const classify = (vertex: Vertex): void => {
    const [a, b, c] = triangleFor(vertex);

    if (orientation(a, b, c) < 0) {
      reflex.add(vertex);
    } else {
      reflex.delete(vertex);
    }
  };

  const updateEar = (vertex: Vertex): void => {
    const triangle = triangleFor(vertex);
    const blocked =
      reflex.has(vertex) ||
      (orientation(...triangle) !== 0 &&
        [...reflex].some(
          candidate =>
            candidate !== vertex &&
            candidate.index !== vertex.previous &&
            candidate.index !== vertex.next &&
            containsConvexPolygon(triangle, candidate.point),
        ));

    if (blocked) {
      ears.delete(vertex);
    } else {
      ears.add(vertex);
    }
  };

  vertices.forEach(classify);
  vertices.forEach(updateEar);
  const triangles: PolygonTriangle[] = [];
  let remaining = points.length;
  let first = vertices[0]!;

  while (remaining > 3) {
    const ear = ears.values().next().value;

    if (!ear) {
      throw new AtlasError('Polygon contour cannot be triangulated.', {
        code: 'INVALID_POLYGON_CONTOUR',
        details: { reason: 'triangulation' },
      });
    }

    const triangle = triangleFor(ear);

    if (hasPolygonArea(triangle)) {
      triangles.push(Object.freeze(triangle));
    }

    ears.delete(ear);
    reflex.delete(ear);
    const previous = vertices.at(ear.previous)!;
    const next = vertices.at(ear.next)!;
    first = next;
    remaining--;
    previous.next = ear.next;
    next.previous = ear.previous;
    classify(previous);
    classify(next);
    updateEar(previous);
    updateEar(next);
  }

  const final = triangleFor(first);

  if (hasPolygonArea(final)) {
    triangles.push(Object.freeze(final));
  }

  const result = Object.freeze(triangles);
  TRIANGULATIONS.set(contour, result);

  return result;
}
