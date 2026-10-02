import { MapObject } from './map-object.js';

import type { ObjectDefinition } from '#definitions/object-definition.js';

/** Read access to the runtime objects of one successfully prepared map. */
export class MapObjects implements Iterable<MapObject> {
  readonly #objects: Map<string, MapObject>;

  constructor(definitions: readonly (ObjectDefinition & { readonly id: string })[] = []) {
    this.#objects = new Map(
      definitions.map(definition => [
        definition.id,
        new MapObject(definition.id, definition.geometry),
      ]),
    );
  }

  get size(): number {
    return this.#objects.size;
  }

  get(id: string): MapObject | undefined {
    return this.#objects.get(id);
  }

  [Symbol.iterator](): MapIterator<MapObject> {
    return this.#objects.values();
  }
}
