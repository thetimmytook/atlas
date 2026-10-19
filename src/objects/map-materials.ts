/* eslint-disable security/detect-object-injection -- Dictionary keys are immutable declared handle names or previously validated parent references. */
import { AtlasMaterialError } from '#errors/atlas-material-error.js';
import {
  copyMaterialProperties,
  effectiveMaterialProperties,
  matchesCondition,
  ruleKinds,
  validateEffectiveMaterials,
  validateMaterialKind,
} from '#validators/material.validator.js';

import {
  objectsWithOwnedPoints,
  registerMaterialCollection,
  trackMaterialConsumer,
  untrackMaterialConsumer,
  unregisterMaterialCollection,
} from './material-consumers.js';
import { DEFAULTS } from './material-defaults.js';
import { isObjectKind, readSelectionProperties } from './property-configuration.js';
import { RuntimeMaterial } from './runtime-material.js';

import type { ResolvedMapDefinition } from '#definitions/map-definition.js';
import type {
  ImageResourceId,
  LabelProperties,
  Material,
  MaterialDefinition,
  MaterialLookup,
  MaterialProperties,
  MaterialRule,
  PointImage,
} from '#definitions/material-definition.js';
import type { MapEntry, MapObjectCollection } from './map-object-collection.js';
import type { MapObject } from './map-object.js';
import type { MapRoute } from './map-route.js';
import type { ObjectMaterialCandidate } from './material-consumers.js';

/** Internal resolved declarations; the view supplies the container family and px metrics. */
export interface ResolvedLabel {
  readonly color: string;
  readonly font: Required<Omit<NonNullable<LabelProperties['font']>, 'family'>> & {
    readonly family?: string;
  };
  readonly origin: NonNullable<LabelProperties['origin']>;
  readonly offset: NonNullable<LabelProperties['offset']>;
}

export interface PreparedImage {
  readonly source: string;
  readonly width: number;
  readonly height: number;
}

export interface ResolvedPointImage extends PreparedImage {
  readonly x: number;
  readonly y: number;
}

export type ResolvedAppearance =
  | {
      readonly kind: 'point';
      readonly symbol: 'circle' | 'none' | 'image';
      readonly color: string;
      readonly size: number;
      readonly pickable: boolean;
      readonly label: ResolvedLabel;
      readonly image?: ResolvedPointImage;
    }
  | {
      readonly kind: 'line' | 'route';
      readonly color: string;
      readonly width: number;
      readonly label: ResolvedLabel;
    }
  | { readonly kind: 'polygon'; readonly color: string; readonly opacity: number };

/** One map's material state and object consumers, independent of DOM observation. */
export class MapMaterials implements MaterialLookup {
  readonly lookup: MaterialLookup = Object.freeze({
    get: (name: string): Material | undefined => this.get(name),
  });
  readonly #objects: MapObjectCollection;
  readonly #rules: readonly MaterialRule[];
  readonly #resources: ResolvedMapDefinition['resources'];
  readonly #handles = new Map<string, RuntimeMaterial>();
  readonly #selected = new WeakMap<MapObject, string | undefined>();
  readonly #appearances = new WeakMap<MapObject, Map<boolean, ResolvedAppearance>>();
  readonly #tracked = new Set<MapEntry>();
  readonly #rootMembers = new Map<MapEntry, ReadonlySet<MapEntry>>();
  readonly #useCounts = new Map<MapEntry, number>();
  readonly #reference = new WeakRef(this);
  readonly #changed: (objects: ReadonlySet<MapObject>, notify: boolean) => void;
  #definitions: Readonly<Record<string, MaterialDefinition>>;
  #effective: ReadonlyMap<string, MaterialProperties>;
  #images: ReadonlyMap<ImageResourceId, PreparedImage> = new Map();

  constructor(
    definition: ResolvedMapDefinition | undefined,
    objects: MapObjectCollection,
    changed: (objects: ReadonlySet<MapObject>, notify: boolean) => void,
  ) {
    this.#objects = objects;
    this.#rules = definition?.materialRules ?? [];
    this.#resources = definition?.resources ?? {};
    this.#definitions = definition?.materials ?? {};
    this.#effective = effectiveMaterialProperties(this.#definitions);
    this.#changed = changed;

    for (const [name, material] of Object.entries(this.#definitions)) {
      this.#handles.set(
        name,
        new RuntimeMaterial(name, material.properties, material.inherits, this.#replace),
      );
    }

    const candidates = objectsWithOwnedPoints(objects);
    const selections = Array.from(
      candidates,
      object => [object, this.#select(object, {})] as const,
    );
    selections.forEach(([object, material]) => this.#selected.set(object, material));
    registerMaterialCollection(objects, this);
    this.syncConsumers();
  }

  get(name: string): Material | undefined {
    return this.#handles.get(name);
  }

  setPreparedImages(images: ReadonlyMap<ImageResourceId, PreparedImage>): void {
    for (const properties of this.#effective.values()) {
      if (properties.image) {
        resolveImage(properties.image, images);
      }
    }

    this.#images = images;
  }

  deactivate(): void {
    this.#tracked.forEach(object => untrackMaterialConsumer(object, this.#reference));
    this.#tracked.clear();
    this.#rootMembers.clear();
    this.#useCounts.clear();
    unregisterMaterialCollection(this.#objects);
  }

  /** Membership links survive component disconnects and are refreshed before public events. */
  syncConsumers(): void {
    const roots = new Set(this.#objects);

    for (const [root, members] of this.#rootMembers) {
      if (!roots.has(root)) {
        members.forEach(object => this.#decrementObjectUsage(object));
        this.#rootMembers.delete(root);
      }
    }

    roots.forEach(root => this.#syncRoot(root));
  }

  syncRoute(route: MapRoute): void {
    if (this.#rootMembers.has(route)) {
      this.#syncRoot(route);
    }
  }

  #syncRoot(root: MapEntry): void {
    const previous = this.#rootMembers.get(root) ?? new Set<MapEntry>();
    const next = objectsWithOwnedPoints([root]);

    for (const object of previous) {
      if (!next.has(object)) {
        this.#decrementObjectUsage(object);
      }
    }

    for (const object of next) {
      if (!previous.has(object)) {
        const count = this.#useCounts.get(object) ?? 0;
        this.#useCounts.set(object, count + 1);

        if (count === 0) {
          trackMaterialConsumer(object, this.#reference);
          this.#tracked.add(object);
        }
      }
    }

    this.#rootMembers.set(root, next);
  }

  #decrementObjectUsage(object: MapEntry): void {
    const count = this.#useCounts.get(object)! - 1;

    if (count > 0) {
      this.#useCounts.set(object, count);

      return;
    }

    untrackMaterialConsumer(object, this.#reference);
    this.#tracked.delete(object);
    this.#useCounts.delete(object);
    this.#selected.delete(object);
    this.#appearances.delete(object);
  }

  prepareObjects(objects: Iterable<MapObject>): () => void {
    const commits = Array.from(objects, object => this.prepareObject(object, {}));

    return (): void => {
      commits.forEach(commit => commit());
    };
  }

  prepareObject(object: MapObject, candidate: ObjectMaterialCandidate): () => void {
    const selection = this.#select(object, candidate);

    return (): void => {
      this.#selected.set(object, selection);
      this.refreshAppearance(object);
    };
  }

  refreshAppearance(object: MapObject): void {
    this.#appearances.delete(object);
    this.#changed(new Set([object]), false);
  }

  appearanceFor(object: MapEntry, routeOwned = false): ResolvedAppearance {
    const cached = this.#appearances.get(object)?.get(routeOwned);

    if (cached) {
      return cached;
    }

    const name = this.#selected.get(object);
    const properties = name === undefined ? {} : this.#effective.get(name)!;
    let appearance: ResolvedAppearance;

    if (object.kind === 'point') {
      const defaults = routeOwned ? DEFAULTS.routeOwnedPoint : DEFAULTS.point;
      const symbol = properties.symbol ?? defaults.symbol;
      appearance = Object.freeze({
        kind: 'point',
        symbol,
        color: properties.color ?? DEFAULTS.point.color,
        size: properties.size ?? DEFAULTS.point.size,
        pickable: object.pickable ?? defaults.pickable,
        label: resolveLabel(properties.label),
        ...(symbol === 'image' ? { image: resolveImage(properties.image!, this.#images) } : {}),
      });
    } else if (object.kind === 'polygon') {
      appearance = Object.freeze({
        kind: object.kind,
        color: properties.color ?? DEFAULTS.polygon.color,
        opacity: properties.opacity ?? DEFAULTS.polygon.opacity,
      });
    } else {
      appearance = Object.freeze({
        kind: object.kind,
        color: properties.color ?? DEFAULTS.path.color,
        width: properties.width ?? DEFAULTS.path.width,
        label: resolveLabel(properties.label),
      });
    }

    const byRole = this.#appearances.get(object) ?? new Map<boolean, ResolvedAppearance>();
    byRole.set(routeOwned, appearance);
    this.#appearances.set(object, byRole);

    return appearance;
  }

  #select(object: MapObject, candidate: ObjectMaterialCandidate): string | undefined {
    const kind = object.kind;

    if (!isObjectKind(kind)) {
      throw new AtlasMaterialError({ code: 'INVALID_MATERIAL_DEFINITION', details: { kind } });
    }

    const data = Object.hasOwn(candidate, 'data') ? candidate.data : object.data;
    const values = readSelectionProperties({
      id: object.id,
      kind,
      ...(data === undefined ? {} : { data }),
    });
    let kindMaterial: string | undefined;
    let conditionalMaterial: string | undefined;

    for (const rule of this.#rules) {
      if (
        !Object.entries(rule.when).every(([property, condition]) =>
          matchesCondition(property === 'kind' ? kind : values.get(property), condition),
        )
      ) {
        continue;
      }

      if (Object.keys(rule.when).length === 1) {
        kindMaterial = rule.material;
      } else {
        conditionalMaterial = rule.material;
      }
    }

    const explicit = Object.hasOwn(candidate, 'material') ? candidate.material : object.material;
    const selected = explicit ?? conditionalMaterial ?? kindMaterial;

    if (selected !== undefined) {
      const properties = this.#effective.get(selected);

      if (!properties) {
        throw new AtlasMaterialError({
          code: 'UNKNOWN_MATERIAL',
          details: { material: selected, objectId: object.id, kind },
        });
      }

      validateMaterialKind(properties, kind, selected);
    }

    return selected;
  }

  readonly #replace = (name: string, input: MaterialProperties): void => {
    const properties = copyMaterialProperties(input, name);
    const definitions = Object.freeze({
      ...this.#definitions,
      [name]: Object.freeze({ ...this.#definitions[name]!, properties }),
    });
    const effective = effectiveMaterialProperties(definitions);
    validateEffectiveMaterials(effective, this.#resources);

    for (const value of effective.values()) {
      if (value.image) {
        resolveImage(value.image, this.#images);
      }
    }

    for (const rule of this.#rules) {
      ruleKinds(rule).forEach(kind =>
        validateMaterialKind(effective.get(rule.material)!, kind, rule.material),
      );
    }

    const affected = new Set<MapObject>();

    for (const object of this.#tracked) {
      const selected = this.#selected.get(object);

      if (selected === undefined) {
        continue;
      }

      validateMaterialKind(effective.get(selected)!, object.kind, selected);
      let ancestor: string | undefined = selected;

      while (ancestor !== undefined) {
        if (ancestor === name) {
          affected.add(object);
          break;
        }

        ancestor = definitions[ancestor]?.inherits;
      }
    }

    this.#definitions = definitions;
    this.#effective = effective;
    this.#handles.get(name)!.commitProperties(properties);
    affected.forEach(object => this.#appearances.delete(object));
    this.#changed(affected, true);
  };
}

function resolveImage(
  image: PointImage,
  images: ReadonlyMap<ImageResourceId, PreparedImage>,
): ResolvedPointImage {
  const source = images.get(image.resource);

  if (!source) {
    throw new AtlasMaterialError({
      code: 'INVALID_IMAGE_RESOURCE',
      details: { resourceId: image.resource },
    });
  }

  let width = image.width ?? source.width;
  let height = image.height ?? source.height;

  if (image.preserveAspectRatio ?? DEFAULTS.image.preserveAspectRatio) {
    let scale = 1;

    if (image.width !== undefined && image.height !== undefined) {
      scale = Math.min(width / source.width, height / source.height);
    } else if (image.width !== undefined) {
      scale = width / source.width;
    } else if (image.height !== undefined) {
      scale = height / source.height;
    }

    width = source.width * scale;
    height = source.height * scale;
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new AtlasMaterialError({
      code: 'INVALID_MATERIAL_PROPERTY',
      details: { property: 'image', resourceId: image.resource, width, height },
    });
  }

  const anchor = image.anchor ?? DEFAULTS.image.anchor;

  return Object.freeze({
    source: source.source,
    width,
    height,
    x: -anchor.x * width,
    y: -anchor.y * height,
  });
}

/** Shared point/path defaults; own declarations and load snapshots stay untouched. */
function resolveLabel(properties: LabelProperties | undefined): ResolvedLabel {
  return Object.freeze({
    ...DEFAULTS.label,
    ...properties,
    font: Object.freeze({ ...DEFAULTS.label.font, ...properties?.font }),
  });
}
