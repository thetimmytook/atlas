import { resolveMapEntry } from '#definitions/map-definition.js';

import { MapLine } from './map-line.js';
import { MapPoint } from './map-point.js';
import { MapRoute } from './map-route.js';

import type { MapEntryDefinition, ResolvedMapEntry } from '#definitions/map-definition.js';
import type { MapLineDefinition } from '#definitions/map-line-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapRouteDefinition } from '#definitions/map-route-definition.js';

export type MapEntry = MapLine | MapPoint | MapRoute;

/** Ordered runtime objects with copied-definition additions and reference-based removal. */
export class MapObjectCollection extends EventTarget implements Iterable<MapEntry> {
  #objects: readonly MapEntry[];

  constructor(definitions: readonly ResolvedMapEntry[] = []) {
    super();
    this.#objects = Object.freeze(definitions.map(createMapObject));
  }

  get size(): number {
    return this.#objects.length;
  }

  /** Return the first root object with this ID in collection order. */
  get(id: string): MapEntry | undefined {
    return this.#objects.find(object => object.id === id);
  }

  add(definition: MapPointDefinition): MapPoint;
  add(definition: MapLineDefinition): MapLine;
  add(definition: MapRouteDefinition): MapRoute;
  add(definition: MapEntryDefinition): MapEntry;

  /** Validate and create before committing membership; existing iterators keep their snapshot. */
  add(definition: MapEntryDefinition): MapEntry {
    const object = createMapObject(resolveMapEntry(definition));
    this.#objects = Object.freeze([...this.#objects, object]);

    // Prototype membership notification; replace with the agreed collection event contract.
    this.dispatchEvent(new CustomEvent<MapEntry>('add', { detail: object }));

    return object;
  }

  /** Detach this exact root instance; retained references and iterators remain usable. */
  remove(object: MapEntry): boolean {
    if (!this.#objects.includes(object)) {
      return false;
    }

    this.#objects = Object.freeze(this.#objects.filter(entry => entry !== object));

    // Prototype membership notification; replace with the agreed collection event contract.
    this.dispatchEvent(new CustomEvent<MapEntry>('remove', { detail: object }));

    return true;
  }

  [Symbol.iterator](): ArrayIterator<MapEntry> {
    return this.#objects.values();
  }
}

function createMapObject(definition: ResolvedMapEntry): MapEntry {
  switch (definition.kind) {
    case 'point':
      return new MapPoint(definition);
    case 'line':
      return new MapLine(definition.id, definition.points);
    case 'route':
      return new MapRoute(definition.id, definition.points);
  }
}
