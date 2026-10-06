import { validateObjectId } from '#validators/object-id.validator.js';

import { createId } from './create-id.js';

/** Shared identity and events for map objects and their owned parts. */
export abstract class MapObject extends EventTarget {
  readonly #id: string;

  protected constructor(id: string | undefined, field = 'id') {
    super();
    validateObjectId(field, id);
    this.#id = id ?? createId();
  }

  get id(): string {
    return this.#id;
  }

  abstract get kind(): string;
}
