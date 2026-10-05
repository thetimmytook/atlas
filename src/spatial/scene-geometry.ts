import type { Point } from '#math/point.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';
import type { Geometry } from './geometry.js';

/** Circle dimensions in viewport CSS pixels, shared by rendering and spatial queries. */
export interface PointSymbol {
  readonly radius: number;
  readonly strokeWidth: number;
}

/** Screen-sized stroke; round caps also define the segment's picking boundary. */
export interface LineSymbol {
  readonly strokeWidth: number;
  readonly lineCap: 'round';
}

export interface SceneSymbols {
  readonly point: PointSymbol;
  readonly line: LineSymbol;
}

export interface SceneObject {
  readonly object: MapEntry;
  readonly geometry: Geometry;
  readonly route?: MapRoute;
}

export interface SceneGeometry {
  readonly objects: readonly SceneObject[];
  readonly symbols: SceneSymbols;
}

// Temporary shared defaults; replace with per-object symbols derived from resolved materials.
const defaultSymbols: SceneSymbols = Object.freeze({
  point: Object.freeze({ radius: 11, strokeWidth: 2 }),
  line: Object.freeze({ strokeWidth: 4, lineCap: 'round' }),
});

/** Prepare shared geometry descriptions once; positions remain owned by runtime objects. */
export function prepareSceneGeometry(objects: Iterable<MapEntry>): SceneGeometry {
  const entries: SceneObject[] = [];

  for (const object of objects) {
    entries.push(
      Object.freeze({
        object,
        geometry: createGeometry(object),
      }),
    );

    // Temporary: line endpoints only drive the stroke; endpoint symbols and
    // interaction will follow their material/property configuration.
    if (object.kind !== 'route') {
      continue;
    }

    // Temporary point symbols at every route vertex; resolved point materials and
    // interaction properties will select their presentation independently of IDs.
    for (const point of object.points) {
      entries.push(
        Object.freeze({
          object: point,
          route: object,
          geometry: createGeometry(point),
        }),
      );
    }
  }

  return Object.freeze({
    objects: Object.freeze(entries),
    symbols: defaultSymbols,
  });
}

function createGeometry(object: MapEntry): Geometry {
  if (object.kind === 'point') {
    return Object.freeze({
      kind: 'point',
      get position(): Point {
        return object.position;
      },
    });
  }

  if (object.kind === 'line') {
    return Object.freeze({
      kind: 'line',
      get start(): Point {
        return object.points[0].position;
      },
      get end(): Point {
        return object.points[1].position;
      },
    });
  }

  return Object.freeze({
    kind: 'polyline',
    points: Object.freeze(object.points.map(createPositionView)),
  });
}

/** Stable coordinate views keep the route array live without copying it on edits or reads. */
function createPositionView(point: MapPoint): Point {
  return Object.freeze({
    get x(): number {
      return point.position.x;
    },
    get y(): number {
      return point.position.y;
    },
  });
}
