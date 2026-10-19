import { Point2 } from '#math/point2.js';
import { containsConvexPolygon } from '#math/polygon.js';

import type { PolygonGeometry } from './geometry.js';

interface CellArea {
  readonly position: Point2;
  readonly area: number;
  readonly exponent: number;
}

/** Area centroid of the displayed cell union, with the first largest cell as fallback. */
export function polygonLabelPosition(geometry: PolygonGeometry): Point2 | undefined {
  const areas = geometry.cells.reduce<CellArea[]>((result, cell) => {
    const area = cellArea(cell);

    if (area) {
      result.push(area);
    }

    return result;
  }, []);
  const largest = areas.reduce<CellArea | undefined>(
    (best, area) =>
      !best ||
      area.exponent > best.exponent ||
      (area.exponent === best.exponent && area.area > best.area)
        ? area
        : best,
    undefined,
  );

  if (!largest) {
    return undefined;
  }

  let total = 0;
  let position = largest.position;

  for (const area of areas) {
    // Relative areas avoid overflowing/underflowing the actual square-coordinate area.
    const weight = (area.area / largest.area) * 2 ** (area.exponent - largest.exponent);

    if (weight === 0) {
      continue;
    }

    total += weight;
    const fraction = weight / total;
    position = new Point2(
      interpolate(position.x, area.position.x, fraction),
      interpolate(position.y, area.position.y, fraction),
    );
  }

  return geometry.cells.some(cell => containsConvexPolygon(cell, position))
    ? position
    : largest.position;
}

/** Shift before taking moments; scale each axis independently for very thin/large cells. */
function cellArea(cell: readonly Point2[]): CellArea | undefined {
  const first = cell[0];

  if (cell.length < 3 || !first) {
    return undefined;
  }

  const x = coordinateFrame(cell.map(point => point.x));
  const y = coordinateFrame(cell.map(point => point.y));
  let area = 0;
  let momentX = 0;
  let momentY = 0;

  // Shoelace moments on an existing convex cell, without new geometry or triangulation.
  for (let index = 1; index < cell.length - 1; index++) {
    const ax = x.values.at(index)!;
    const ay = y.values.at(index)!;
    const bx = x.values.at(index + 1)!;
    const by = y.values.at(index + 1)!;
    const cross = ax * by - bx * ay;
    area += cross;
    momentX += (ax + bx) * cross;
    momentY += (ay + by) * cross;
  }

  if (area === 0) {
    return undefined;
  }

  const exponent = Math.floor(Math.log2(Math.abs(area)));

  return {
    position: new Point2(x.restore(momentX / area / 3), y.restore(momentY / area / 3)),
    area: Math.abs(area) / 2 ** exponent,
    exponent: exponent + x.exponent + y.exponent,
  };
}

function coordinateFrame(values: readonly number[]): {
  values: readonly number[];
  exponent: number;
  restore(value: number): number;
} {
  const origin = values[0]!;
  const differences = values.map(value => value - origin);
  const finite = differences.every(Number.isFinite);
  const maximum = (finite ? differences : values).reduce(
    (best, value) => Math.max(best, Math.abs(value)),
    0,
  );
  const exponent = maximum === 0 ? 0 : Math.min(1023, Math.floor(Math.log2(maximum)));
  const scale = 2 ** exponent;

  return {
    values: finite
      ? differences.map(value => value / scale)
      : values.map(value => value / scale - origin / scale),
    exponent,
    restore: value => (finite ? origin + value * scale : (origin / scale + value) * scale),
  };
}

function interpolate(start: number, end: number, fraction: number): number {
  const difference = end - start;

  return Number.isFinite(difference)
    ? start + difference * fraction
    : (1 - fraction) * start + fraction * end;
}
