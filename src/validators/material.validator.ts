/* eslint-disable security/detect-object-injection -- Field keys are fixed locally; dictionary references are checked with Object.hasOwn before access. */
import { AtlasMaterialError } from '#errors/atlas-material-error.js';
import { Point2 } from '#math/point2.js';
import {
  getPropertyRegistration,
  isMaterialName,
  isObjectKind,
} from '#objects/property-configuration.js';

import { isPlainRecord } from './object-data.validator.js';

import type { MapDefinition, MapEntryDefinition } from '#definitions/map-definition.js';
import type {
  ImageResourceId,
  ImageResourceDefinition,
  MaterialCondition,
  MaterialConditionValue,
  MaterialDefinition,
  MaterialProperties,
  MaterialRule,
  PointImage,
} from '#definitions/material-definition.js';
import type { AtlasMaterialErrorCode } from '#errors/atlas-material-error.js';

export interface MaterialDeclarations {
  readonly materials: Readonly<Record<string, MaterialDefinition>>;
  readonly materialRules: readonly MaterialRule[];
  readonly resources: Readonly<Record<ImageResourceId, ImageResourceDefinition>>;
}

export function validateMaterialName(value: unknown, field = 'material'): asserts value is string {
  if (!isMaterialName(value)) {
    fail('INVALID_MATERIAL_DEFINITION', { field, actual: value });
  }
}

function fail(code: AtlasMaterialErrorCode, details: Readonly<Record<string, unknown>>): never {
  throw new AtlasMaterialError({ code, details });
}

function validateFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: AtlasMaterialErrorCode,
  details: Readonly<Record<string, unknown>>,
): void {
  for (const field of Reflect.ownKeys(value)) {
    if (typeof field !== 'string' || !allowed.includes(field)) {
      fail(code, { ...details, field });
    }
  }
}

export function copyMaterialProperties(value: unknown, material?: string): MaterialProperties {
  if (!isPlainRecord(value)) {
    fail('INVALID_MATERIAL_DEFINITION', { material, field: 'properties' });
  }

  const entries = Object.entries(value).map(([property, actual]): readonly [string, unknown] => {
    const details = { material, property, actual };

    switch (property) {
      case 'symbol':
        if (actual !== 'none' && actual !== 'circle' && actual !== 'image') {
          fail('INVALID_MATERIAL_PROPERTY', details);
        }

        break;
      case 'color':
        if (typeof actual !== 'string' || !/^#[\da-f]{6}$/i.test(actual)) {
          fail('INVALID_MATERIAL_PROPERTY', details);
        }

        break;
      case 'size':
      case 'width':
        if (typeof actual !== 'number' || !Number.isFinite(actual) || actual <= 0) {
          fail('INVALID_MATERIAL_PROPERTY', details);
        }

        break;
      case 'opacity':
        if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < 0 || actual > 1) {
          fail('INVALID_MATERIAL_PROPERTY', details);
        }

        break;
      case 'image':
        return [property, copyPointImage(actual, material)];
      default:
        fail('UNKNOWN_MATERIAL_PROPERTY', details);
    }

    return [property, actual];
  });

  return Object.freeze(Object.fromEntries(entries));
}

function copyPointImage(value: unknown, material?: string): PointImage {
  const details = { material, property: 'image', actual: value };

  if (!isPlainRecord(value) || !isMaterialName(value.resource)) {
    fail('INVALID_MATERIAL_PROPERTY', details);
  }

  if (
    Object.keys(value).some(
      key => !['resource', 'width', 'height', 'preserveAspectRatio', 'anchor'].includes(key),
    )
  ) {
    fail('INVALID_MATERIAL_PROPERTY', details);
  }

  for (const field of ['width', 'height'] as const) {
    if (
      Object.hasOwn(value, field) &&
      (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] <= 0)
    ) {
      fail('INVALID_MATERIAL_PROPERTY', { ...details, field });
    }
  }

  if (
    Object.hasOwn(value, 'preserveAspectRatio') &&
    typeof value.preserveAspectRatio !== 'boolean'
  ) {
    fail('INVALID_MATERIAL_PROPERTY', details);
  }

  const anchor = value.anchor;

  if (
    Object.hasOwn(value, 'anchor') &&
    (anchor === null ||
      typeof anchor !== 'object' ||
      'z' in anchor ||
      !('x' in anchor) ||
      !('y' in anchor) ||
      typeof anchor.x !== 'number' ||
      typeof anchor.y !== 'number' ||
      !Number.isFinite(anchor.x) ||
      !Number.isFinite(anchor.y) ||
      anchor.x < 0 ||
      anchor.x > 1 ||
      anchor.y < 0 ||
      anchor.y > 1)
  ) {
    fail('INVALID_MATERIAL_PROPERTY', details);
  }

  const image = value as unknown as PointImage;

  return Object.freeze({
    resource: image.resource,
    ...(image.width === undefined ? {} : { width: image.width }),
    ...(image.height === undefined ? {} : { height: image.height }),
    ...(image.preserveAspectRatio === undefined
      ? {}
      : { preserveAspectRatio: image.preserveAspectRatio }),
    ...(image.anchor === undefined ? {} : { anchor: new Point2(image.anchor.x, image.anchor.y) }),
  });
}

export function resolveMaterialDeclarations(definition: MapDefinition): MaterialDeclarations {
  const resources = copyResources(definition.resources === undefined ? {} : definition.resources);
  const input = definition.materials === undefined ? {} : definition.materials;

  if (!isPlainRecord(input)) {
    fail('INVALID_MATERIAL_DEFINITION', { field: 'materials' });
  }

  const materials = Object.freeze(
    Object.fromEntries(
      Object.entries(input).map(([name, value]) => {
        validateMaterialName(name, 'materials');

        if (!isPlainRecord(value)) {
          fail('INVALID_MATERIAL_DEFINITION', { material: name });
        }

        validateFields(value, ['properties', 'inherits'], 'INVALID_MATERIAL_DEFINITION', {
          material: name,
        });
        const properties = copyMaterialProperties(value.properties, name);

        if (value.inherits !== undefined) {
          validateMaterialName(value.inherits, 'inherits');
        }

        return [
          name,
          Object.freeze({
            properties,
            ...(value.inherits === undefined ? {} : { inherits: value.inherits }),
          }),
        ];
      }),
    ),
  ) as Readonly<Record<string, MaterialDefinition>>;
  const effective = effectiveMaterialProperties(materials);
  validateEffectiveMaterials(effective, resources);
  const materialRules = copyRules(
    definition.materialRules === undefined ? [] : definition.materialRules,
    materials,
    effective,
  );

  return Object.freeze({ materials, materialRules, resources });
}

function copyResources(input: unknown): Readonly<Record<ImageResourceId, ImageResourceDefinition>> {
  if (!isPlainRecord(input)) {
    fail('INVALID_IMAGE_RESOURCE', { field: 'resources' });
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).map(([resourceId, value]) => {
        if (
          !isMaterialName(resourceId) ||
          !isPlainRecord(value) ||
          value.kind !== 'image' ||
          typeof value.source !== 'string' ||
          !value.source.trim()
        ) {
          fail('INVALID_IMAGE_RESOURCE', { resourceId, actual: value });
        }

        validateFields(value, ['kind', 'source'], 'INVALID_IMAGE_RESOURCE', { resourceId });

        return [resourceId, Object.freeze({ kind: 'image', source: value.source })];
      }),
    ),
  );
}

/** The image entry is spread as one top-level value, never merged field by field. */
export function effectiveMaterialProperties(
  materials: Readonly<Record<string, MaterialDefinition>>,
): ReadonlyMap<string, MaterialProperties> {
  const result = new Map<string, MaterialProperties>();
  const visiting = new Set<string>();

  const visit = (name: string): MaterialProperties => {
    const cached = result.get(name);

    if (cached) {
      return cached;
    }

    if (visiting.has(name)) {
      fail('MATERIAL_INHERITANCE_CYCLE', { material: name, cycle: [...visiting, name] });
    }

    const material = Object.hasOwn(materials, name) ? materials[name] : undefined;

    if (!material) {
      fail('UNKNOWN_MATERIAL_PARENT', { parent: name });
    }

    visiting.add(name);
    const parent = material.inherits === undefined ? {} : visit(material.inherits);
    const properties = Object.freeze({ ...parent, ...material.properties });
    visiting.delete(name);
    result.set(name, properties);

    return properties;
  };

  Object.keys(materials).forEach(visit);

  return result;
}

export function validateEffectiveMaterials(
  effective: ReadonlyMap<string, MaterialProperties>,
  resources: Readonly<Record<ImageResourceId, ImageResourceDefinition>>,
): void {
  for (const [material, properties] of effective) {
    if (properties.image && !Object.hasOwn(resources, properties.image.resource)) {
      fail('UNKNOWN_IMAGE_RESOURCE', { material, resourceId: properties.image.resource });
    }

    if (properties.symbol === 'image' && !properties.image) {
      fail('INVALID_MATERIAL_PROPERTY', { material, property: 'image' });
    }
  }
}

export function validateMaterialKind(
  properties: MaterialProperties,
  kind: MapEntryDefinition['kind'],
  material?: string,
): void {
  let supported = ['color', 'width'];

  if (kind === 'point') {
    supported = ['symbol', 'color', 'size', 'image'];
  } else if (kind === 'polygon') {
    supported = ['color', 'opacity'];
  }

  for (const property of Object.keys(properties)) {
    if (!supported.includes(property)) {
      fail('INCOMPATIBLE_MATERIAL_PROPERTY', { kind, material, property });
    }
  }
}

export function ruleKinds(rule: MaterialRule): readonly MapEntryDefinition['kind'][] {
  return typeof rule.when.kind === 'string' ? [rule.when.kind] : rule.when.kind;
}

function copyRules(
  input: unknown,
  materials: Readonly<Record<string, MaterialDefinition>>,
  effective: ReadonlyMap<string, MaterialProperties>,
): readonly MaterialRule[] {
  if (!Array.isArray(input)) {
    fail('INVALID_MATERIAL_RULE', { field: 'materialRules' });
  }

  return Object.freeze(
    Array.from(input, (value: unknown, ruleIndex) => {
      if (!isPlainRecord(value) || !isMaterialName(value.material) || !isPlainRecord(value.when)) {
        fail('INVALID_MATERIAL_RULE', { ruleIndex });
      }

      validateFields(value, ['when', 'material'], 'INVALID_MATERIAL_RULE', { ruleIndex });

      if (!Object.hasOwn(materials, value.material)) {
        fail('UNKNOWN_MATERIAL', { material: value.material, ruleIndex });
      }

      const kinds = Array.isArray(value.when.kind)
        ? (value.when.kind as unknown[])
        : [value.when.kind];

      if (kinds.length === 0 || Array.from(kinds).some(kind => !isObjectKind(kind))) {
        fail('INVALID_MATERIAL_RULE', { ruleIndex, property: 'kind' });
      }

      const targetKinds = kinds as MapEntryDefinition['kind'][];
      const when = Object.freeze(
        Object.fromEntries(
          Object.entries(value.when).map(([property, actual]) => {
            const registration = getPropertyRegistration(property);
            const expected = property === 'kind' ? 'string' : registration?.valueType;

            if (
              property !== 'kind' &&
              (!registration || targetKinds.some(kind => !registration.appliesTo.includes(kind)))
            ) {
              fail('INVALID_MATERIAL_RULE', { ruleIndex, property });
            }

            const alternatives = Array.isArray(actual) ? (actual as unknown[]) : [actual];

            if (
              !alternatives.length ||
              Array.from(alternatives).some(
                item =>
                  typeof item !== expected || (typeof item === 'number' && !Number.isFinite(item)),
              )
            ) {
              fail('INVALID_MATERIAL_RULE', { ruleIndex, property, expected, actual });
            }

            return [property, Array.isArray(actual) ? Object.freeze([...alternatives]) : actual];
          }),
        ),
      ) as MaterialCondition;
      targetKinds.forEach(kind =>
        validateMaterialKind(
          effective.get(value.material as string)!,
          kind,
          value.material as string,
        ),
      );

      return Object.freeze({ material: value.material, when });
    }),
  );
}

export function matchesCondition(actual: unknown, condition: MaterialConditionValue): boolean {
  return (
    actual !== undefined &&
    (Array.isArray(condition) ? condition.some(value => value === actual) : condition === actual)
  );
}
