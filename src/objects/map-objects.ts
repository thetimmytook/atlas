import { AtlasObject } from './atlas-object.js';

import type { ObjectDefinition } from '#definitions/object-definition.js';

/** Read access to the runtime objects of one successfully prepared map. */
export class MapObjects implements Iterable<AtlasObject> {
  readonly #objects: Map<string, AtlasObject>;

  constructor(definitions: readonly (ObjectDefinition & { readonly id: string })[] = []) {
    this.#objects = new Map(
      definitions.map(definition => [
        definition.id,
        new AtlasObject(definition.id, definition.geometry),
      ]),
    );
  }

  get size(): number {
    return this.#objects.size;
  }

  get(id: string): AtlasObject | undefined {
    return this.#objects.get(id);
  }

  [Symbol.iterator](): MapIterator<AtlasObject> {
    return this.#objects.values();
  }
}
