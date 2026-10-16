import { AtlasMaterialError } from '#errors/atlas-material-error.js';

import type {
  MapConfiguration,
  MaterialScalar,
  PropertyReadObject,
  PropertyRegistration,
} from '#definitions/material-definition.js';

const OBJECT_KINDS = ['point', 'line', 'route', 'polygon'] as const;
const REGISTRATIONS = new Map<string, PropertyRegistration>();
let configurationLocked = false;

export function isObjectKind(value: unknown): value is PropertyReadObject['kind'] {
  return OBJECT_KINDS.some(kind => value === kind);
}

export function isMaterialName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

export function configureProperties(configuration: MapConfiguration): void {
  if (configurationLocked) {
    throw new AtlasMaterialError({ code: 'MATERIAL_CONFIGURATION_LOCKED' });
  }

  if (!Array.isArray(configuration?.properties)) {
    throw new AtlasMaterialError({ code: 'INVALID_MATERIAL_CONFIGURATION' });
  }

  const candidates = new Map<string, PropertyRegistration>();

  for (const input of Array.from(configuration.properties as readonly PropertyRegistration[])) {
    if (
      !input ||
      !isMaterialName(input.name) ||
      !['string', 'number', 'boolean'].includes(input.valueType) ||
      typeof input.optional !== 'boolean' ||
      typeof input.read !== 'function' ||
      !Array.isArray(input.appliesTo) ||
      input.appliesTo.length === 0 ||
      Array.from(input.appliesTo).some(kind => !isObjectKind(kind))
    ) {
      throw new AtlasMaterialError({ code: 'INVALID_MATERIAL_CONFIGURATION' });
    }

    if (input.name === 'kind' || REGISTRATIONS.has(input.name) || candidates.has(input.name)) {
      throw new AtlasMaterialError({
        code: 'DUPLICATE_PROPERTY_REGISTRATION',
        details: { property: input.name },
      });
    }

    candidates.set(
      input.name,
      Object.freeze({
        name: input.name,
        valueType: input.valueType,
        optional: input.optional,
        appliesTo: Object.freeze([...(input.appliesTo as readonly PropertyReadObject['kind'][])]),
        read: input.read,
      }),
    );
  }

  for (const [name, registration] of candidates) {
    REGISTRATIONS.set(name, registration);
  }
}

export function lockPropertyConfiguration(): void {
  configurationLocked = true;
}

export function getPropertyRegistration(name: string): PropertyRegistration | undefined {
  return REGISTRATIONS.get(name);
}

/** Every applicable reader is required, even if rules or explicit assignment never use it. */
export function readSelectionProperties(
  object: PropertyReadObject,
): ReadonlyMap<string, MaterialScalar> {
  const projection = Object.freeze({
    id: object.id,
    kind: object.kind,
    ...(object.data === undefined ? {} : { data: object.data }),
  });
  const values = new Map<string, MaterialScalar>();

  for (const registration of REGISTRATIONS.values()) {
    if (!registration.appliesTo.includes(object.kind)) {
      continue;
    }

    const { name: property, read, optional, valueType } = registration;
    const details = { property, objectId: object.id, kind: object.kind };
    let value: unknown;

    try {
      value = read(projection);
    } catch (cause) {
      throw new AtlasMaterialError({ code: 'MATERIAL_PROPERTY_READ_FAILED', details, cause });
    }

    if (value === undefined && optional) {
      continue;
    }

    if (typeof value !== valueType || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new AtlasMaterialError({
        code: 'INVALID_SELECTION_PROPERTY_VALUE',
        details: { ...details, expected: valueType, actual: value },
      });
    }

    values.set(property, value as MaterialScalar);
  }

  return values;
}
