import { invalidateScenes } from '#spatial/scene-invalidation.js';
import { validateLayerObjectId } from '#validators/layer-object-id.validator.js';

/** Stable ID membership, independent of root instances and composition order. */
export class MapLayerObjectIdCollection implements Iterable<string> {
  readonly #ids: Set<string>;
  readonly #changed: () => void;

  /** Internal construction from validated load input. */
  constructor(ids: readonly string[], changed: () => void) {
    this.#ids = new Set(ids);
    this.#changed = changed;
  }

  has(id: string): boolean {
    return this.#ids.has(id);
  }

  add(id: string): boolean {
    validateLayerObjectId(id);

    if (this.#ids.has(id)) {
      return false;
    }

    this.#ids.add(id);
    this.#notify();

    return true;
  }

  remove(id: string): boolean {
    validateLayerObjectId(id);

    if (!this.#ids.delete(id)) {
      return false;
    }

    this.#notify();

    return true;
  }

  [Symbol.iterator](): SetIterator<string> {
    return this.#ids.values();
  }

  #notify(): void {
    invalidateScenes(this, true);
    this.#changed();
  }
}
