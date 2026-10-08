import { trackScene, untrackScene } from './scene-invalidation.js';

import type { Point } from '#math/point.js';
import type { MapEntry, MapObjectCollection } from '#objects/map-object-collection.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';
import type { Geometry } from './geometry.js';
import type { SceneInvalidation } from './scene-invalidation.js';

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

  /** Drain display changes for the current single view; spatial reads never consume them. */
  takeChanges(): ReadonlySet<SceneObject>;
}

// Temporary shared defaults; replace with per-object symbols derived from resolved materials.
const defaultSymbols: SceneSymbols = Object.freeze({
  point: Object.freeze({ radius: 11, strokeWidth: 2 }),
  line: Object.freeze({ strokeWidth: 4, lineCap: 'round' }),
});

/** Reuse live views; explicit membership invalidation replaces the ordered entries. */
export function prepareSceneGeometry(objects: MapObjectCollection): SceneGeometry {
  const invalidation: SceneInvalidation = { membership: true, changed: new Set() };
  const reference = new WeakRef(invalidation);
  const tracked = new Set<object>();
  let dependencies = new Map<object, SceneObject[]>();
  let entries: readonly SceneObject[] = [];

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

  const syncMembership = (): void => {
    if (!invalidation.membership) {
      return;
    }

    invalidation.membership = false;
    const nextDependencies = new Map<object, SceneObject[]>();

    const dependOn = (source: object, entry: SceneObject): void => {
      let affected = nextDependencies.get(source);

      if (!affected) {
        affected = [];
        nextDependencies.set(source, affected);
      }

      affected.push(entry);
    };

    entries = Object.freeze(
      Array.from(objects).reduce<SceneObject[]>((result, object) => {
        const entry = entryFor(object);
        result.push(entry);
        dependOn(object, entry);

        if (object.kind === 'point') {
          return result;
        }

        for (const point of object.points) {
          dependOn(point, entry);

          // Temporary: only routes have vertex symbols; materials will select appearances.
          if (object.kind === 'route') {
            const vertex = entryFor(point, object);
            result.push(vertex);
            dependOn(point, vertex);
          }
        }

        return result;
      }, []),
    );
    dependencies = nextDependencies;

    for (const source of invalidation.changed) {
      if (!dependencies.has(source)) {
        invalidation.changed.delete(source);
      }
    }

    const sources = new Set<object>([objects, ...dependencies.keys()]);

    for (const source of tracked) {
      if (!sources.has(source)) {
        untrackScene(source, reference);
        tracked.delete(source);
      }
    }

    for (const source of sources) {
      if (!tracked.has(source)) {
        trackScene(source, reference);
        tracked.add(source);

        // Detached edits were not tracked; refresh every current appearance on reattachment.
        invalidation.changed.add(source);
      }
    }
  };

  syncMembership();

  return Object.freeze({
    get objects(): readonly SceneObject[] {
      syncMembership();

      return entries;
    },
    symbols: defaultSymbols,
    takeChanges(): ReadonlySet<SceneObject> {
      syncMembership();
      const affected = new Set<SceneObject>();

      for (const source of invalidation.changed) {
        for (const entry of dependencies.get(source) ?? []) {
          affected.add(entry);
        }
      }

      invalidation.changed.clear();

      return affected;
    },
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

  const invalidation: SceneInvalidation = { membership: false, changed: new Set() };
  trackScene(object, new WeakRef(invalidation));
  let positions = Object.freeze(object.points.map(positionFor));

  return Object.freeze({
    kind: 'polyline',
    get points(): readonly Point[] {
      if (invalidation.membership) {
        positions = Object.freeze(object.points.map(positionFor));
        invalidation.membership = false;
        invalidation.changed.clear();
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
