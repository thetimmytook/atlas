import type { Point } from '#math/point.js';
import type { MapEntry, MapObjectCollection } from '#objects/map-object-collection.js';
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
export function prepareSceneGeometry(objects: MapObjectCollection): SceneGeometry {
  let roots = Array.from(objects);
  let routes = roots.filter(object => object.kind === 'route');
  const routePoints = new WeakMap<MapRoute, readonly MapPoint[]>();

  // A point may appear as a root and as a route vertex; each owner needs its own scene entry.
  const cache = new WeakMap<MapEntry, WeakMap<MapEntry, SceneObject>>();

  const entryFor = (object: MapEntry, route?: MapRoute): SceneObject => {
    const owner = route ?? object;
    let ownerEntries = cache.get(owner);
    const cached = ownerEntries?.get(object);

    if (cached) {
      return cached;
    }

    if (!ownerEntries) {
      ownerEntries = new WeakMap<MapEntry, SceneObject>();
      cache.set(owner, ownerEntries);
    }

    const entry: SceneObject = Object.freeze({
      object,
      geometry: createGeometry(object),
      ...(route ? { route } : {}),
    });
    ownerEntries.set(object, entry);

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
      // A removal followed by an addition can preserve size; compare the actual root instances.
      const current = objects[Symbol.iterator]();

      if (objects.size !== roots.length || roots.some(object => current.next().value !== object)) {
        roots = Array.from(objects);
        routes = roots.filter(object => object.kind === 'route');
        entries = prepareEntries();

        return entries;
      }

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

  const cache = new WeakMap<MapPoint, Point>();

  const positionFor = (point: MapPoint): Point => {
    const cached = cache.get(point);

    if (cached) {
      return cached;
    }

    const position = createPositionView(point);
    cache.set(point, position);

    return position;
  };

  let points = object.points;
  let positions = Object.freeze(points.map(positionFor));

  return Object.freeze({
    kind: 'polyline',
    get points(): readonly Point[] {
      if (points !== object.points) {
        positions = Object.freeze(object.points.map(positionFor));
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
