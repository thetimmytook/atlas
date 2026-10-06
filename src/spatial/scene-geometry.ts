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

/** Reuse live views; only membership changes replace the ordered scene-entry array. */
export function prepareSceneGeometry(objects: Iterable<MapEntry>): SceneGeometry {
  const roots = Array.from(objects);
  const routes = roots.filter(object => object.kind === 'route');
  const routePoints = new Map<MapRoute, readonly MapPoint[]>();
  const cache = new Map<MapEntry, SceneObject>();

  const entryFor = (object: MapEntry, route?: MapRoute): SceneObject => {
    const cached = cache.get(object);

    if (cached) {
      return cached;
    }

    const entry: SceneObject = Object.freeze({
      object,
      geometry: createGeometry(object),
      ...(route ? { route } : {}),
    });
    cache.set(object, entry);

    return entry;
  };

  const prepareEntries = (): readonly SceneObject[] =>
    Object.freeze(
      roots.reduce<SceneObject[]>((entries, object) => {
        entries.push(entryFor(object));

        // Temporary: line endpoints only drive the stroke; endpoint symbols and
        // interaction will follow their material/property configuration.
        if (object.kind !== 'route') {
          return entries;
        }

        routePoints.set(object, object.points);

        // Temporary point symbols at every route vertex; resolved point materials and
        // interaction properties will select their presentation independently of IDs.
        for (const point of object.points) {
          entries.push(entryFor(point, object));
        }

        return entries;
      }, []),
    );
  let entries = prepareEntries();

  return Object.freeze({
    get objects(): readonly SceneObject[] {
      if (routes.some(route => routePoints.get(route) !== route.points)) {
        entries = prepareEntries();
      }

      return entries;
    },
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

  let points = object.points;
  let positions = Object.freeze(points.map(createPositionView));

  return Object.freeze({
    kind: 'polyline',
    get points(): readonly Point[] {
      if (points !== object.points) {
        positions = Object.freeze([
          ...positions,
          ...object.points.slice(points.length).map(createPositionView),
        ]);
        points = object.points;
      }

      return positions;
    },
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
