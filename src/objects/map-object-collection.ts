import { MapLine } from './map-line.js';
import { MapPoint } from './map-point.js';
import { MapRoute } from './map-route.js';

import type { ResolvedMapEntry } from '#definitions/map-definition.js';

export type MapEntry = MapLine | MapPoint | MapRoute;

/** Read access to the runtime objects of one successfully prepared map. */
export class MapObjectCollection implements Iterable<MapEntry> {
  readonly #objects: readonly MapEntry[];

  constructor(definitions: readonly ResolvedMapEntry[] = []) {
    this.#objects = Object.freeze(definitions.map(createMapObject));
  }

  get size(): number {
    return this.#objects.length;
  }

  /** Return the first root object with this ID in collection order. */
  get(id: string): MapEntry | undefined {
    return this.#objects.find(object => object.id === id);
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
