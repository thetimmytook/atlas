import { MapMaterials } from '#objects/map-materials.js';
import { getCollectionMaterials } from '#objects/material-consumers.js';

import { createClippedAppearance } from './clipped-appearance.js';
import { pathLabelPosition } from './path-label-position.js';
import { createPolygonGeometry } from './polygon-geometry.js';
import { trackScene, untrackScene } from './scene-invalidation.js';

import type { Point2 } from '#math/point2.js';
import type { Point3 } from '#math/point3.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { ResolvedAppearance } from '#objects/map-materials.js';
import type { MapEntry, MapObjectCollection } from '#objects/map-object-collection.js';
import type { MapObject } from '#objects/map-object.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';
import type { Geometry } from './geometry.js';
import type { SceneInvalidation } from './scene-invalidation.js';

export interface SceneObject {
  readonly layer: MapLayer;
  readonly object: MapEntry;
  readonly geometry: Geometry;
  readonly route?: MapRoute;
}

export interface SceneChanges {
  readonly geometry: ReadonlySet<SceneObject>;
  readonly appearance: ReadonlySet<SceneObject>;
  readonly labels: ReadonlySet<SceneObject>;
}

export interface SceneGeometry {
  /** Fixed bottom-to-top layer composition, shared by SVG and spatial queries. */
  readonly layers: readonly MapLayer[];
  readonly objects: readonly SceneObject[];
  appearanceFor(entry: SceneObject): ResolvedAppearance;

  /** One attachment per owner/layer, after all of its displayed path fragments. */
  labelPositionFor(entry: SceneObject): Point2 | undefined;
  invalidateAppearances(objects: ReadonlySet<MapObject>): void;

  /** Drain display changes for the current single view; spatial reads never consume them. */
  takeChanges(): SceneChanges;
}

/** Shared direct views and cached derived appearances, reconciled before queries or painting. */
export function prepareSceneGeometry(
  objects: MapObjectCollection,
  layers: readonly MapLayer[],
  materialSet?: MapMaterials,
): SceneGeometry {
  const orderedLayers = Object.freeze([...layers].sort((a, b) => a.stackIndex - b.stackIndex));
  const invalidation: SceneInvalidation = {
    membership: true,
    changed: new Set(),
    topology: new Set(),
  };
  const reference = new WeakRef(invalidation);
  const tracked = new Set<object>();
  const pending = new Set<SceneObject>();
  const labelPositions = new WeakMap<SceneObject, Point2>();
  const appearanceChanges = new Set<MapObject>();
  const materials =
    materialSet ??
    getCollectionMaterials(objects) ??
    new MapMaterials(undefined, objects, changed => {
      changed.forEach(object => appearanceChanges.add(object));
    });
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

  const updateLabelPosition = (
    root: MapEntry,
    previous: readonly SceneObject[],
    next: readonly SceneObject[],
  ): void => {
    if (root.kind !== 'line' && root.kind !== 'route') {
      return;
    }

    const paths = next.filter(entry => entry.object === root);
    const position = pathLabelPosition(
      paths.flatMap(entry =>
        entry.geometry.kind === 'line' || entry.geometry.kind === 'polyline'
          ? [entry.geometry]
          : [],
      ),
    );

    // The last fragment hosts the label, ahead of owned points and following roots.
    for (const entry of previous) {
      if (labelPositions.delete(entry)) {
        pending.add(entry);
      }
    }

    const host = paths.at(-1);

    if (host && position) {
      labelPositions.set(host, position);
      pending.add(host);
    }
  };

  const updateAppearance = (
    layer: MapLayer,
    root: MapEntry,
    membership: boolean,
    geometryChanged = false,
  ): boolean => {
    const byRoot = appearances.get(layer)!;
    const previous = byRoot.get(root) ?? [];
    const next = resolveLayerEntries(layer, root, membership);

    const same =
      previous.length === next.length && previous.every((entry, index) => entry === next.at(index));

    if (!same || geometryChanged) {
      updateLabelPosition(root, previous, next);
    }

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

  const reconcileRoots = (affectedRoots: ReadonlySet<MapEntry>): void => {
    roots = Array.from(objects);
    const currentRoots = new Set(roots);

    for (const [layer, byRoot] of appearances) {
      for (const [root, previous] of byRoot) {
        if (currentRoots.has(root)) {
          continue;
        }

        // Cached entries survive removal and may return with empty/different fragments.
        previous.forEach(entry => labelPositions.delete(entry));
        byRoot.delete(root);
      }

      for (const root of roots) {
        updateAppearance(layer, root, true, affectedRoots.has(root));
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

  const affectedRootsFor = (changed: ReadonlySet<object>): ReadonlySet<MapEntry> => {
    const affectedRoots = new Set<MapEntry>();

    for (const source of changed) {
      for (const root of rootDependencies.get(source) ?? []) {
        affectedRoots.add(root);
      }
    }

    return affectedRoots;
  };

  const syncChanges = (
    affectedRoots: ReadonlySet<MapEntry>,
    topology: ReadonlySet<MapRoute>,
  ): boolean => {
    let compositionChanged = false;

    for (const root of affectedRoots) {
      for (const layer of orderedLayers) {
        compositionChanged =
          updateAppearance(layer, root, root.kind === 'route' && topology.has(root), true) ||
          compositionChanged;
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
    if (
      !invalidation.membership &&
      invalidation.changed.size === 0 &&
      invalidation.topology.size === 0
    ) {
      return;
    }

    const membership = invalidation.membership;
    const changed = new Set(invalidation.changed);
    const topology = new Set(invalidation.topology);
    invalidation.changed.clear();
    invalidation.topology.clear();
    invalidation.membership = false;

    queueChanges(changed);
    const affectedRoots = affectedRootsFor(changed);

    if (membership) {
      reconcileRoots(affectedRoots);
    }

    if (membership || topology.size > 0) {
      reconcileRootDependencies();
    }

    if (membership || syncChanges(affectedRoots, topology) || topology.size > 0) {
      reconcileEntries();
    }

    if (membership || topology.size > 0) {
      // Refresh owned-point links even if all automatic appearances remain empty.
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
    appearanceFor(entry: SceneObject): ResolvedAppearance {
      return materials.appearanceFor(entry.object, entry.route !== undefined);
    },
    labelPositionFor(entry: SceneObject): Point2 | undefined {
      sync();

      return entry.geometry.kind === 'point' ? entry.geometry.position : labelPositions.get(entry);
    },
    invalidateAppearances(changed: ReadonlySet<MapObject>): void {
      changed.forEach(object => appearanceChanges.add(object));
    },
    takeChanges(): SceneChanges {
      sync();
      const appearance = new Set<SceneObject>();

      for (const object of appearanceChanges) {
        for (const entry of entryDependencies.get(object) ?? []) {
          if (entry.object === object) {
            appearance.add(entry);
          }
        }
      }

      appearanceChanges.clear();
      const labels = new Set<SceneObject>();

      for (const object of invalidation.labels ?? []) {
        for (const entry of entryDependencies.get(object) ?? []) {
          if (entry.object === object) {
            labels.add(entry);
          }
        }
      }

      invalidation.labels?.clear();
      const geometry = new Set(pending);
      pending.clear();

      return { geometry, appearance, labels };
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

  const invalidation: SceneInvalidation = {
    membership: false,
    changed: new Set(),
    topology: new Set(),
  };
  trackScene(object, new WeakRef(invalidation));
  let positions = Object.freeze(object.points.map(positionFor));

  return Object.freeze({
    kind: 'polyline',
    get points(): readonly Point3[] {
      if (invalidation.topology.delete(object)) {
        positions = Object.freeze(object.points.map(positionFor));
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
