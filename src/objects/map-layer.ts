import { AtlasError } from '#errors/atlas-error.js';
import { trackScene } from '#spatial/scene-invalidation.js';

import { MapLayerObjectIdCollection } from './map-layer-object-id-collection.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { ResolvedMapLayerDefinition } from '#definitions/map-layer-definition.js';
import type { IntersectionBounds } from '#math/intersection-bounds.js';
import type { SceneInvalidation } from '#spatial/scene-invalidation.js';
import type { MapEntry, MapObjectCollection } from './map-object-collection.js';

/** Renderer-independent layer; direct content is selected by ID from current roots. */
export class MapLayer extends EventTarget {
  readonly #definition: ResolvedMapLayerDefinition;
  readonly #objectIds: MapLayerObjectIdCollection;
  readonly #roots: MapObjectCollection;
  readonly #invalidation: SceneInvalidation = {
    membership: true,
    changed: new Set(),
    topology: new Set(),
  };
  #objects: readonly MapEntry[] = Object.freeze([]);
  #visible = true;

  /** Internal construction; layers are created together at the load boundary. */
  constructor(definition: ResolvedMapLayerDefinition, roots: MapObjectCollection) {
    super();
    this.#definition = definition;
    this.#roots = roots;
    this.#objectIds = new MapLayerObjectIdCollection(definition.objects, this.#changed);
    const reference = new WeakRef(this.#invalidation);
    trackScene(roots, reference);
    trackScene(this.#objectIds, reference);
  }

  get id(): string {
    return this.#definition.id;
  }

  get stackIndex(): number {
    return this.#definition.stackIndex;
  }

  get background(): BackgroundDescription | undefined {
    return this.#definition.background;
  }

  get intersectionBounds(): IntersectionBounds | undefined {
    return this.#definition.intersectionBounds;
  }

  get objectIds(): MapLayerObjectIdCollection {
    return this.#objectIds;
  }

  /** Only direct root content; automatic clipped appearances are prepared separately. */
  get objects(): readonly MapEntry[] {
    if (this.#invalidation.membership) {
      this.#objects = Object.freeze(
        Array.from(this.#roots).filter(object => this.#objectIds.has(object.id)),
      );
      this.#invalidation.membership = false;
      this.#invalidation.changed.clear();
    }

    return this.#objects;
  }

  get visible(): boolean {
    return this.#visible;
  }

  set visible(value: boolean) {
    if (typeof value !== 'boolean') {
      throw new AtlasError('Layer visibility must be a boolean.', {
        code: 'INVALID_LAYER_VISIBILITY',
        details: { layerId: this.id, value },
      });
    }

    if (value === this.#visible) {
      return;
    }

    this.#visible = value;
    this.#changed();
  }

  readonly #changed = (): void => {
    // Prototype notification; replace with the agreed public scene/change-event contract.
    this.dispatchEvent(new Event('change'));
  };
}
