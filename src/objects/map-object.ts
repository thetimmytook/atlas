import { invalidateSceneLabels } from '#spatial/scene-invalidation.js';
import { validateMaterialName } from '#validators/material.validator.js';
import { copyObjectAttributes } from '#validators/object-attributes.validator.js';
import { copyObjectData } from '#validators/object-data.validator.js';
import { validateObjectId } from '#validators/object-id.validator.js';
import { validateObjectLabel } from '#validators/object-label.validator.js';

import { createId } from './create-id.js';
import { prepareObjectMaterialChange } from './material-consumers.js';

import type { MapObjectDefinition } from '#definitions/map-object-definition.js';
import type { JsonObject } from '#definitions/material-definition.js';

/** Shared identity and events for map objects and their owned parts. */
export abstract class MapObject extends EventTarget {
  readonly #id: string;
  #data: JsonObject | undefined;
  #material: string | undefined;
  #label: string | undefined;

  protected constructor(definition: MapObjectDefinition, field = 'object') {
    super();
    validateObjectId(`${field}.id`, definition.id);
    this.#id = definition.id ?? createId();
    const attributes = copyObjectAttributes(definition, field);
    this.#data = attributes.data;
    this.#material = attributes.material;
    this.#label = attributes.label;
  }

  get id(): string {
    return this.#id;
  }

  abstract get kind(): string;

  /** Single-line literal text shared by every use of this instance; undefined removes it. */
  get label(): string | undefined {
    return this.#label;
  }

  set label(value: string | undefined) {
    validateObjectLabel(value);
    this.#label = value;
    invalidateSceneLabels(this);
    this.dispatchEvent(new Event('change'));
  }

  get data(): JsonObject | undefined {
    return this.#data;
  }

  set data(value: JsonObject | undefined) {
    const data = copyObjectData(value);
    const commit = prepareObjectMaterialChange(this, { data });
    this.#data = data;
    commit();
    this.dispatchEvent(new Event('change'));
  }

  /** Only explicit assignment; selection and defaults belong to a map appearance. */
  get material(): string | undefined {
    return this.#material;
  }

  set material(value: string | undefined) {
    if (value !== undefined) {
      validateMaterialName(value);
    }

    const commit = prepareObjectMaterialChange(this, { material: value });
    this.#material = value;
    commit();
    this.dispatchEvent(new Event('change'));
  }
}
