import { validateObjectId } from '#validators/object-id.validator.js';

/** Shared identity and events for map objects and their owned parts. */
export abstract class MapObject extends EventTarget {
  readonly #id: string;

  protected constructor(id: string) {
    super();

    validateObjectId('id', id);
    this.#id = id;
  }

  get id(): string {
    return this.#id;
  }

  abstract get kind(): string;
}
