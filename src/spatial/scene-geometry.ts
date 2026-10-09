import { createClippedAppearance } from './clipped-appearance.js';
import { createPolygonGeometry } from './polygon-geometry.js';
import { trackScene, untrackScene } from './scene-invalidation.js';

import type { Point3 } from '#math/point3.js';
import type { MapLayer } from '#objects/map-layer.js';
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
  readonly layer: MapLayer;
  readonly object: MapEntry;
  readonly geometry: Geometry;
  readonly route?: MapRoute;
}

export interface SceneGeometry {
  /** Fixed bottom-to-top layer composition, shared by SVG and spatial queries. */
  readonly layers: readonly MapLayer[];
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

/** Shared direct views and cached derived appearances, reconciled before queries or painting. */
export function prepareSceneGeometry(
  objects: MapObjectCollection,
  layers: readonly MapLayer[],
): SceneGeometry {
  const orderedLayers = Object.freeze([...layers].sort((a, b) => a.stackIndex - b.stackIndex));
  const invalidation: SceneInvalidation = { membership: true, changed: new Set() };
  const reference = new WeakRef(invalidation);
  const tracked = new Set<object>();
  const pending = new Set<SceneObject>();
  let roots: readonly MapEntry[] = [];
  let entries: readonly SceneObject[] = [];
  let entryDependencies = new Map<object, SceneObject[]>();
  let rootDependencies = new Map<object, Set<MapEntry>>();
  const appearances = new Map<MapLayer, Map<MapEntry, readonly SceneObject[]>>(
    orderedLayers.map(layer => [layer, new Map()]),
  );
  const automatic = new WeakMap<MapLayer, WeakMap<MapEntry, () => readonly SceneObject[]>>();
  const cache = new WeakMap<MapLayer, WeakMap<MapEntry, WeakMap<MapEntry, SceneObject>>>();
  const geometries = new WeakMap<MapEntry, Geometry>();

  const entryFor = (layer: MapLayer, object: MapEntry, route?: MapRoute): SceneObject => {
    let layerEntries = cache.get(layer);

    if (!layerEntries) {
      layerEntries = new WeakMap();
      cache.set(layer, layerEntries);
    }

    const owner = route ?? object;
    let ownerEntries = layerEntries.get(owner);
    const cached = ownerEntries?.get(object);

    if (cached) {
      return cached;
    }

    if (!ownerEntries) {
      ownerEntries = new WeakMap();
      layerEntries.set(owner, ownerEntries);
    }

    let geometry = geometries.get(object);

    if (!geometry) {
      geometry = createGeometry(object);
      geometries.set(object, geometry);
    }

    const entry: SceneObject = Object.freeze({
      layer,
      object,
      geometry,
      ...(route ? { route } : {}),
    });
    ownerEntries.set(object, entry);

    return entry;
  };

  const resolveLayerEntries = (
    layer: MapLayer,
    root: MapEntry,
    membership: boolean,
  ): readonly SceneObject[] => {
    if (layer.objectIds.has(root.id)) {
      const previous = appearances.get(layer)!.get(root);

      // Coordinate edits do not read owned membership or rebuild direct geometry.
      if (!membership && previous) {
        return previous;
      }

      const result = [entryFor(layer, root)];

      if (root.kind === 'route') {
        result.push(...root.points.map(point => entryFor(layer, point, root)));
      }

      return result;
    }

    if (!layer.intersectionBounds) {
      return [];
    }

    let byRoot = automatic.get(layer);

    if (!byRoot) {
      byRoot = new WeakMap();
      automatic.set(layer, byRoot);
    }

    let prepare = byRoot.get(root);

    if (!prepare) {
      prepare = createClippedAppearance(layer, root, entryFor);
      byRoot.set(root, prepare);
    }

    return prepare();
  };

  const updateAppearance = (layer: MapLayer, root: MapEntry, membership: boolean): boolean => {
    const byRoot = appearances.get(layer)!;
    const previous = byRoot.get(root) ?? [];
    const next = resolveLayerEntries(layer, root, membership);
    const same =
      previous.length === next.length && previous.every((entry, index) => entry === next.at(index));

    if (!same) {
      byRoot.set(root, next);
      next.forEach(entry => pending.add(entry));
    }

    if (layer.intersectionBounds && !layer.objectIds.has(root.id)) {
      // Cut positions can move without changing the number/identity of fragments.
      for (const entry of next) {
        if (entry.object === root) {
          pending.add(entry);
        }
      }
    }

    return !same;
  };

  const reconcileEntries = (): void => {
    const next = orderedLayers.reduce<SceneObject[]>((result, layer) => {
      for (const root of roots) {
        result.push(...(appearances.get(layer)!.get(root) ?? []));
      }

      return result;
    }, []);

    if (
      next.length !== entries.length ||
      next.some((entry, index) => entry !== entries.at(index))
    ) {
      entries = Object.freeze(next);
    }

    const current = new Set(entries);

    for (const entry of pending) {
      if (!current.has(entry)) {
        pending.delete(entry);
      }
    }

    entryDependencies = new Map();

    const dependOn = (source: object, entry: SceneObject): void => {
      const affected = entryDependencies.get(source) ?? [];
      affected.push(entry);
      entryDependencies.set(source, affected);
    };

    for (const entry of entries) {
      dependOn(entry.object, entry);

      if (entry.object.kind === 'line' || entry.object.kind === 'route') {
        for (const point of entry.object.points) {
          dependOn(point, entry);
        }
      }
    }
  };

  const reconcileRoots = (): void => {
    roots = Array.from(objects);
    const currentRoots = new Set(roots);

    for (const [layer, byRoot] of appearances) {
      for (const root of byRoot.keys()) {
        if (!currentRoots.has(root)) {
          byRoot.delete(root);
        }
      }

      for (const root of roots) {
        updateAppearance(layer, root, true);
      }
    }
  };

  const reconcileRootDependencies = (): void => {
    rootDependencies = new Map();

    const dependOn = (source: object, root: MapEntry): void => {
      const affected = rootDependencies.get(source) ?? new Set<MapEntry>();
      affected.add(root);
      rootDependencies.set(source, affected);
    };

    for (const root of roots) {
      if (!orderedLayers.some(layer => layer.intersectionBounds || layer.objectIds.has(root.id))) {
        continue;
      }

      dependOn(root, root);

      if (root.kind === 'line' || root.kind === 'route') {
        for (const point of root.points) {
          dependOn(point, root);
        }
      }
    }
  };

  const queueChanges = (changed: ReadonlySet<object>): void => {
    for (const source of changed) {
      for (const entry of entryDependencies.get(source) ?? []) {
        pending.add(entry);
      }
    }
  };

  const syncChanges = (changed: ReadonlySet<object>): boolean => {
    queueChanges(changed);
    const affectedRoots = new Set<MapEntry>();

    for (const source of changed) {
      for (const root of rootDependencies.get(source) ?? []) {
        affectedRoots.add(root);
      }
    }

    let compositionChanged = false;

    for (const root of affectedRoots) {
      for (const layer of orderedLayers) {
        compositionChanged = updateAppearance(layer, root, false) || compositionChanged;
      }
    }

    return compositionChanged;
  };

  const syncTracking = (): void => {
    const sources = new Set<object>([
      objects,
      ...orderedLayers.map(layer => layer.objectIds),
      ...rootDependencies.keys(),
    ]);

    for (const source of tracked) {
      if (!sources.has(source)) {
        untrackScene(source, reference);
        tracked.delete(source);
      }
    }

    for (const source of sources) {
      if (tracked.has(source)) {
        continue;
      }

      trackScene(source, reference);
      tracked.add(source);

      // Includes reattachment after a synchronous query released detached tracking.
      queueChanges(new Set([source]));
    }
  };

  const sync = (): void => {
    if (!invalidation.membership && invalidation.changed.size === 0) {
      return;
    }

    const membership = invalidation.membership;
    const changed = new Set(invalidation.changed);
    invalidation.changed.clear();
    invalidation.membership = false;

    if (membership) {
      reconcileRoots();
      reconcileRootDependencies();
    }

    if (membership || syncChanges(changed)) {
      reconcileEntries();
    }

    if (membership) {
      syncTracking();
      queueChanges(changed);
    }
  };

  sync();

  return Object.freeze({
    layers: orderedLayers,
    get objects(): readonly SceneObject[] {
      sync();

      return entries;
    },
    symbols: defaultSymbols,
    takeChanges(): ReadonlySet<SceneObject> {
      sync();
      const affected = new Set(pending);
      pending.clear();

      return affected;
    },
  });
}

/** Revalidate the captured appearance itself after synchronous application handlers. */
export function isSceneObjectEligible(scene: SceneGeometry, entry: SceneObject): boolean {
  return isLayerEligible(entry.layer) && scene.objects.includes(entry);
}

/** Visibility is evaluated from live runtime state, including before the next paint. */
export function isLayerEligible(layer: MapLayer): boolean {
  return layer.visible;
}

function createGeometry(object: MapEntry): Geometry {
  if (object.kind === 'polygon') {
    return createPolygonGeometry(object);
  }

  if (object.kind === 'point') {
    return Object.freeze({
      kind: 'point',
      get position(): Point3 {
        return object.position;
      },
    });
  }

  if (object.kind === 'line') {
    return Object.freeze({
      kind: 'line',
      get start(): Point3 {
        return object.points[0].position;
      },
      get end(): Point3 {
        return object.points[1].position;
      },
    });
  }

  const cache = new WeakMap<MapPoint, Point3>();

  const positionFor = (point: MapPoint): Point3 => {
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
    get points(): readonly Point3[] {
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
function createPositionView(point: MapPoint): Point3 {
  return Object.freeze({
    get x(): number {
      return point.position.x;
    },
    get y(): number {
      return point.position.y;
    },
    get z(): number {
      return point.position.z;
    },
  });
}
