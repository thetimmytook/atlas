import { MapLine } from './map-line.js';
import { MapPoint } from './map-point.js';
import { MapRoute } from './map-route.js';

import type { ResolvedMapEntry } from '#definitions/map-definition.js';

export type MapEntry = MapLine | MapPoint | MapRoute;

/** Read access to the runtime objects of one successfully prepared map. */
export class MapObjectCollection implements Iterable<MapEntry> {
  readonly #objects: Map<string, MapEntry>;

  constructor(definitions: readonly ResolvedMapEntry[] = []) {
    this.#objects = new Map(
      definitions.map(definition => [definition.id, createMapObject(definition)]),
    );
  }

  get size(): number {
    return this.#objects.size;
  }

  get(id: string): MapEntry | undefined {
    return this.#objects.get(id);
  }

  [Symbol.iterator](): MapIterator<MapEntry> {
    return this.#objects.values();
  }
}

function createMapObject(definition: ResolvedMapEntry): MapEntry {
  switch (definition.kind) {
    case 'point':
      return new MapPoint(definition);
    case 'route':
      return new MapRoute(definition.id, definition.points);
    case 'line':
      return new MapLine(definition.id, definition.points);
  }
}
