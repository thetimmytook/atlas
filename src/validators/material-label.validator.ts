/* eslint-disable security/detect-object-injection -- Keys are checked against fixed label fields before copying. */
import { AtlasMaterialError } from '#errors/atlas-material-error.js';

import { isPlainRecord } from './object-data.validator.js';

import type {
  LabelFontProperties,
  LabelLength,
  LabelOffset,
  LabelProperties,
} from '#definitions/material-definition.js';
import type { AtlasMaterialErrorCode } from '#errors/atlas-material-error.js';

const LABEL_ORIGINS: readonly string[] = [
  'top left',
  'top center',
  'top right',
  'center left',
  'center center',
  'center right',
  'bottom left',
  'bottom center',
  'bottom right',
];

function fail(
  field: string,
  actual: unknown,
  material: string | undefined,
  code: AtlasMaterialErrorCode = 'INVALID_MATERIAL_PROPERTY',
): never {
  throw new AtlasMaterialError({ code, details: { material, property: 'label', field, actual } });
}

function validateLabelFields(
  value: unknown,
  allowed: readonly string[],
  field: string,
  material: string | undefined,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    fail(field, value, material);
  }

  for (const key of Reflect.ownKeys(value)) {
    const path = `${field}.${String(key)}`;

    if (typeof key !== 'string' || !allowed.includes(key)) {
      fail(path, undefined, material, 'UNKNOWN_MATERIAL_PROPERTY');
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;

    if (!Object.hasOwn(descriptor, 'value')) {
      fail(path, undefined, material);
    }
  }
}

function validateLength(
  value: unknown,
  field: string,
  material: string | undefined,
  positive = false,
): asserts value is LabelLength {
  const match =
    typeof value === 'string' ? /^([+-]?(?:\d+|\d+\.\d*|\.\d+))(?:px|rem)$/.exec(value) : null;
  const number = match === null ? NaN : Number(match[1]);

  // The full-match check also rejects a final line break, which $ alone permits.
  if (
    match === null ||
    match[0] !== value ||
    !Number.isFinite(number) ||
    (positive && number <= 0)
  ) {
    fail(field, value, material);
  }
}

function copyLabelFont(value: unknown, material: string | undefined): LabelFontProperties {
  const field = 'properties.label.font';
  validateLabelFields(value, ['size', 'family', 'weight'], field, material);

  return Object.freeze(
    Object.fromEntries(
      Object.getOwnPropertyNames(value).map(key => {
        const actual = value[key];
        const path = `${field}.${key}`;

        switch (key) {
          case 'size':
            validateLength(actual, path, material, true);
            break;
          case 'family':
            if (typeof actual !== 'string' || !actual.trim()) {
              fail(path, actual, material);
            }

            break;
          case 'weight':
            if (actual !== 'normal' && actual !== 'bold') {
              fail(path, actual, material);
            }

            break;
        }

        return [key, actual];
      }),
    ),
  );
}

function copyLabelOffset(value: unknown, material: string | undefined): LabelOffset {
  const field = 'properties.label.offset';
  validateLabelFields(value, ['x', 'y'], field, material);
  validateLength(value.x, `${field}.x`, material);
  validateLength(value.y, `${field}.y`, material);

  return Object.freeze({ x: value.x, y: value.y });
}

/** Preserve own declarations without defaults or visual inheritance resolution. */
export function copyLabelProperties(value: unknown, material?: string): LabelProperties {
  const field = 'properties.label';
  validateLabelFields(value, ['color', 'font', 'origin', 'offset'], field, material);

  return Object.freeze(
    Object.fromEntries(
      Object.getOwnPropertyNames(value).map(key => {
        const actual = value[key];
        const path = `${field}.${key}`;

        switch (key) {
          case 'color':
            if (
              typeof actual !== 'string' ||
              !/^#[\da-f]{6}$/i.test(actual) ||
              actual.length !== 7
            ) {
              fail(path, actual, material);
            }

            break;
          case 'font':
            return [key, copyLabelFont(actual, material)];
          case 'origin':
            if (typeof actual !== 'string' || !LABEL_ORIGINS.includes(actual)) {
              fail(path, actual, material);
            }

            break;
          case 'offset':
            return [key, copyLabelOffset(actual, material)];
        }

        return [key, actual];
      }),
    ),
  );
}
