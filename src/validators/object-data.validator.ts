import { AtlasMaterialError } from '#errors/atlas-material-error.js';

import type { JsonObject, JsonValue } from '#definitions/material-definition.js';

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/** Validate descriptors before reading values, so accessors are never invoked. */
export function copyObjectData(value: unknown, field = 'data'): JsonObject | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainRecord(value)) {
    throw invalidData(field);
  }

  return copyJson(value, field, new Set()) as JsonObject;
}

function invalidData(field: string): AtlasMaterialError {
  return new AtlasMaterialError({ code: 'INVALID_OBJECT_DATA', details: { field } });
}

// eslint-disable-next-line sonarjs/function-return-type -- JSON preserves its primitive, array and record value types.
function copyJson(value: unknown, field: string, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if ((!Array.isArray(value) && !isPlainRecord(value)) || ancestors.has(value)) {
    throw invalidData(field);
  }

  ancestors.add(value);
  const keys = Reflect.ownKeys(value);

  if (keys.some(key => typeof key === 'symbol')) {
    throw invalidData(field);
  }

  const readValue = (key: string): JsonValue => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw invalidData(`${field}.${key}`);
    }

    return copyJson(descriptor.value, `${field}.${key}`, ancestors);
  };

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1) {
      throw invalidData(field);
    }

    const result = Object.freeze(
      Array.from({ length: value.length }, (_, i) => readValue(String(i))),
    );
    ancestors.delete(value);

    return result;
  }

  const result = Object.freeze(Object.fromEntries(keys.map(key => [key, readValue(String(key))])));
  ancestors.delete(value);

  return result;
}
