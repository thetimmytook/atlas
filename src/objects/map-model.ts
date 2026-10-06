import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { MapObjectCollection } from './map-object-collection.js';

import type { ResolvedMapDefinition } from '#definitions/map-definition.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';
import type { MapEntry } from './map-object-collection.js';

/** Internal scene owner; runtime objects remain the source of live geometry. */
export class MapModel extends EventTarget {
  readonly definition: ResolvedMapDefinition | undefined;
  readonly objects: MapObjectCollection;
  readonly geometry: SceneGeometry;
  readonly spatial: Spatial;
  readonly #observedObjects = new Set<MapEntry>();
  #observing = false;

  /** Takes the already resolved input; validation/copying stays at the load boundary. */
  constructor(definition?: ResolvedMapDefinition) {
    super();
    this.definition = definition;
    this.objects = new MapObjectCollection(definition?.objects);
    this.geometry = prepareSceneGeometry(this.objects);
    this.spatial = new Spatial(this.geometry);
  }

  /** Internal view-controlled observation, not a public standalone model lifecycle. */
  observeChanges(): void {
    if (this.#observing) {
      return;
    }

    this.#observing = true;
    this.objects.addEventListener('add', this.#objectAdded);
    this.objects.addEventListener('remove', this.#objectRemoved);

    for (const object of this.objects) {
      this.#observeObject(object);
    }
  }

  unobserveChanges(): void {
    this.#observing = false;
    this.objects.removeEventListener('add', this.#objectAdded);
    this.objects.removeEventListener('remove', this.#objectRemoved);

    // A removal listener may stop observation before the removed root is released.
    for (const object of this.#observedObjects) {
      object.removeEventListener('change', this.#changed);
    }

    this.#observedObjects.clear();
  }

  hasObject(object: MapEntry): boolean {
    for (const entry of this.objects) {
      if (entry === object) {
        return true;
      }
    }

    return false;
  }

  #observeObject(object: MapEntry): void {
    object.addEventListener('change', this.#changed);
    this.#observedObjects.add(object);
  }

  readonly #objectAdded = (event: Event): void => {
    const object = (event as CustomEvent<MapEntry>).detail;

    // Earlier handlers may remove the added root or stop observation synchronously.
    if (!this.#observing || !this.hasObject(object)) {
      return;
    }

    this.#observeObject(object);
    this.#changed();
  };

  readonly #objectRemoved = (event: Event): void => {
    const object = (event as CustomEvent<MapEntry>).detail;

    // Earlier handlers may reattach the root or disconnect its view.
    if (!this.#observing || this.hasObject(object)) {
      return;
    }

    object.removeEventListener('change', this.#changed);
    this.#observedObjects.delete(object);
    this.#changed();
  };

  readonly #changed = (): void => {
    this.dispatchEvent(new Event('change'));
  };
}
