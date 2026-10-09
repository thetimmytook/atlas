import { Point3 } from '#math/point3.js';
import { triangulatePolygon } from '#math/polygon.js';

import { clipPolygonCells, clipPolygonVerticalRange } from './polygon-clipping.js';

import type { Point2 } from '#math/point2.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapPolygon } from '#objects/map-polygon.js';
import type { PolygonGeometry } from './geometry.js';
import type { SceneObject } from './scene-geometry.js';

function liftCells(
  cells: readonly (readonly Point2[])[],
  baseZ: number,
): readonly (readonly Point3[])[] {
  return Object.freeze(
    cells.map(cell => Object.freeze(cell.map(point => new Point3(point.x, point.y, baseZ)))),
  );
}

export function createPolygonGeometry(object: MapPolygon): PolygonGeometry {
  let contour: readonly Point2[] | undefined;
  let baseZ: number | undefined;
  let cells: readonly (readonly Point3[])[] = [];

  return Object.freeze({
    kind: 'polygon',
    get cells(): readonly (readonly Point3[])[] {
      if (contour !== object.contour || baseZ !== object.baseZ) {
        contour = object.contour;
        baseZ = object.baseZ;
        cells = liftCells(triangulatePolygon(contour), baseZ);
      }

      return cells;
    },
    get baseZ(): number {
      return object.baseZ;
    },
    get height(): number {
      return object.height;
    },
  });
}

export function createClippedPolygonAppearance(
  layer: MapLayer,
  object: MapPolygon,
): () => readonly SceneObject[] {
  const bounds = layer.intersectionBounds!;
  let contour: readonly Point2[] | undefined;
  let planarCells: readonly (readonly Point2[])[] = [];
  let cells: readonly (readonly Point3[])[] = [];
  let baseZ = NaN;
  let height = 0;
  const geometry: PolygonGeometry = Object.freeze({
    kind: 'polygon',
    bounds,
    get cells(): readonly (readonly Point3[])[] {
      return cells;
    },
    get baseZ(): number {
      return baseZ;
    },
    get height(): number {
      return height;
    },
  });
  const entry: SceneObject = Object.freeze({ layer, object, geometry });
  const appearance = Object.freeze([entry]);

  return () => {
    const range = clipPolygonVerticalRange(object.baseZ, object.height, bounds);

    if (!range) {
      return [];
    }

    const changed = contour !== object.contour;

    if (changed) {
      contour = object.contour;
      planarCells = clipPolygonCells(triangulatePolygon(contour), bounds);
    }

    height = range.height;

    if (changed || baseZ !== range.baseZ) {
      baseZ = range.baseZ;
      cells = liftCells(planarCells, baseZ);
    }

    return cells.length > 0 ? appearance : [];
  };
}
