import type { JsonObject } from '#definitions/material-definition.js';
import type { MapMaterials } from './map-materials.js';
import type { MapEntry, MapObjectCollection } from './map-object-collection.js';
import type { MapObject } from './map-object.js';
import type { MapRoute } from './map-route.js';

export interface ObjectMaterialCandidate {
  readonly data?: JsonObject | undefined;
  readonly material?: string | undefined;
}

const CONSUMERS = new WeakMap<MapObject, Set<WeakRef<MapMaterials>>>();
const COLLECTIONS = new WeakMap<MapObjectCollection, MapMaterials>();

export function getCollectionMaterials(objects: MapObjectCollection): MapMaterials | undefined {
  return COLLECTIONS.get(objects);
}

export function objectsWithOwnedPoints(roots: Iterable<MapEntry>): ReadonlySet<MapEntry> {
  const objects = new Set<MapEntry>();

  for (const root of roots) {
    objects.add(root);

    if (root.kind === 'line' || root.kind === 'route') {
      root.points.forEach(point => objects.add(point));
    }
  }

  return objects;
}

export function registerMaterialCollection(
  objects: MapObjectCollection,
  materials: MapMaterials,
): void {
  COLLECTIONS.set(objects, materials);
}

export function unregisterMaterialCollection(objects: MapObjectCollection): void {
  COLLECTIONS.delete(objects);
}

export function trackMaterialConsumer(object: MapObject, reference: WeakRef<MapMaterials>): void {
  const consumers = CONSUMERS.get(object) ?? new Set();

  for (const previous of consumers) {
    if (!previous.deref()) {
      consumers.delete(previous);
    }
  }

  consumers.add(reference);
  CONSUMERS.set(object, consumers);
}

export function untrackMaterialConsumer(object: MapObject, reference: WeakRef<MapMaterials>): void {
  CONSUMERS.get(object)?.delete(reference);
}

function consumersOf(object: MapObject): readonly MapMaterials[] {
  const consumers = CONSUMERS.get(object);
  const active: MapMaterials[] = [];

  for (const reference of consumers ?? []) {
    const materials = reference.deref();

    if (materials) {
      active.push(materials);
    } else {
      consumers?.delete(reference);
    }
  }

  return active;
}

/** Preflight all maps first. The returned commit never invokes application readers. */
export function prepareObjectMaterialChange(
  object: MapObject,
  candidate: ObjectMaterialCandidate,
): () => void {
  const commits = consumersOf(object).map(materials => materials.prepareObject(object, candidate));

  return (): void => {
    commits.forEach(commit => commit());
  };
}

export function refreshPointAppearance(object: MapObject): void {
  consumersOf(object).forEach(materials => materials.refreshAppearance(object));
}

export function prepareRootAttachment(
  collection: MapObjectCollection,
  object: MapEntry,
): () => void {
  return (
    COLLECTIONS.get(collection)?.prepareObjects(objectsWithOwnedPoints([object])) ??
    ((): void => {})
  );
}

export function refreshCollectionConsumers(collection: MapObjectCollection): void {
  COLLECTIONS.get(collection)?.syncConsumers();
}

export function prepareOwnedPointAttachment(
  route: MapRoute,
  points: readonly MapEntry[],
): () => void {
  const commits = consumersOf(route).map(materials => materials.prepareObjects(points));

  return (): void => {
    commits.forEach(commit => commit());
  };
}

export function refreshRouteConsumers(route: MapRoute): void {
  consumersOf(route).forEach(materials => materials.syncRoute(route));
}
