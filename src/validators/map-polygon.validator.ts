import { AtlasError } from '#errors/atlas-error.js';
import { Point2 } from '#math/point2.js';
import {
  liesOnSegment,
  orientation,
  segmentsIntersect,
  triangulatePolygon,
} from '#math/polygon.js';
import { createId } from '#objects/create-id.js';

import { validateNumber } from './number.validator.js';
import { validateObjectId } from './object-id.validator.js';
import { validatePoint } from './point.validator.js';

import type {
  MapPolygonDefinition,
  ResolvedMapPolygonDefinition,
} from '#definitions/map-polygon-definition.js';

export function copyPolygonVertex(point: Point2, field: string): Point2 {
  if (!point || typeof point !== 'object' || Array.isArray(point) || 'z' in point) {
    throw new AtlasError('Polygon vertex must contain planar coordinates.', {
      code: 'INVALID_POLYGON_VERTEX',
      details: { field, value: point },
    });
  }

  validatePoint(field, point);

  return new Point2(point.x, point.y);
}

function intersectingEdge(contour: readonly Point2[], index: number): number | undefined {
  const start = contour.at(index)!;
  const end = contour.at((index + 1) % contour.length)!;

  for (let other = index + 2; other < contour.length; other++) {
    if (index === 0 && other === contour.length - 1) {
      continue;
    }

    if (
      segmentsIntersect(start, end, contour.at(other)!, contour.at((other + 1) % contour.length)!)
    ) {
      return other;
    }
  }

  return undefined;
}

/** The coordinates have already been validated and copied at the public input boundary. */
export function validatePolygonShape(contour: readonly Point2[], field: string): void {
  const fail = (reason: string, indices?: readonly number[]): never => {
    throw new AtlasError('Invalid polygon contour.', {
      code: 'INVALID_POLYGON_CONTOUR',
      details: { field, reason, indices },
    });
  };

  if (contour.length < 3) {
    fail('vertex-count');
  }

  const seen = new Set<string>();

  for (const [index, point] of contour.entries()) {
    const key = `${point.x},${point.y}`;

    if (seen.has(key)) {
      fail('repeated-vertex', [index]);
    }

    seen.add(key);
    const previous = contour.at((index + contour.length - 1) % contour.length)!;
    const next = contour.at((index + 1) % contour.length)!;

    if (orientation(previous, point, next) === 0 && !liesOnSegment(point, previous, next)) {
      fail('backtracking', [index]);
    }

    const other = intersectingEdge(contour, index);

    if (other !== undefined) {
      fail('self-intersection', [index, other]);
    }
  }

  // Prepare before mutation: an untriangulable candidate must not become live state.
  triangulatePolygon(contour);
}

export function resolvePolygonContour(
  contour: readonly Point2[],
  field: string,
): readonly Point2[] {
  if (!Array.isArray(contour)) {
    throw new AtlasError('Polygon contour must be an array.', {
      code: 'INVALID_POLYGON_CONTOUR',
      details: { field, value: contour },
    });
  }

  const result = Object.freeze(
    Array.from(contour, (point: Point2, index) => copyPolygonVertex(point, `${field}[${index}]`)),
  );
  validatePolygonShape(result, field);

  return result;
}

export function validatePolygonVerticalState(
  baseZ: number,
  height: number,
  field = 'polygon',
): void {
  validateNumber(`${field}.baseZ`, baseZ);
  validateNumber(`${field}.height`, height);

  if (height < 0 || !Number.isFinite(baseZ + height) || (height > 0 && baseZ + height <= baseZ)) {
    throw new AtlasError('Invalid polygon vertical range.', {
      code: 'INVALID_POLYGON_VERTICAL_RANGE',
      details: { field, baseZ, height },
    });
  }
}

export function resolveMapPolygon(
  definition: MapPolygonDefinition,
  field: string,
): ResolvedMapPolygonDefinition {
  if (definition?.kind !== 'polygon') {
    throw new AtlasError('Polygon object is required.', {
      code: 'INVALID_OBJECT_KIND',
      details: { field: `${field}.kind`, kind: definition?.kind },
    });
  }

  validateObjectId(`${field}.id`, definition.id);
  const baseZ = definition.baseZ === undefined ? 0 : definition.baseZ;
  const height = definition.height === undefined ? 0 : definition.height;
  validatePolygonVerticalState(baseZ, height, field);
  const contour = resolvePolygonContour(definition.contour, `${field}.contour`);

  return Object.freeze({
    id: definition.id ?? createId(),
    kind: 'polygon',
    contour,
    baseZ,
    height,
  });
}
