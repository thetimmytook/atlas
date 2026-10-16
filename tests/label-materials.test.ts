/* eslint-disable sonarjs/no-duplicate-string -- Literal paths and values keep table-driven diagnostic regressions readable. */
import { describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition } from '#definitions/map-definition.js';
import { AtlasMaterialError } from '#errors/atlas-material-error.js';
import { MapModel } from '#objects/map-model.js';
import { copyMaterialProperties } from '#validators/material.validator.js';

import type {
  LabelFontProperties,
  LabelLength,
  LabelOffset,
  LabelOrigin,
  LabelProperties,
  MaterialProperties,
} from '#definitions/material-definition.js';

// These compile as LabelLength, but the runtime decimal grammar deliberately rejects them.
const TYPE_ACCEPTED_INVALID_LENGTHS: readonly LabelLength[] = ['1e2px', '0x10px', ' 2px'];
const origins: readonly LabelOrigin[] = [
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

function model(properties: MaterialProperties = {}): MapModel {
  return new MapModel(
    resolveMapDefinition({
      layers: [],
      objects: [{ kind: 'point', id: 'p', position: { x: 0, y: 0 }, material: 'style' }],
      materials: { style: { properties } },
    }),
  );
}

describe('label material own declarations', () => {
  it.each<LabelProperties>([
    {},
    { font: {} },
    { color: '#222222' },
    { font: { family: '  Arial, sans-serif  ' } },
  ])('preserves empty and partial declarations without defaults: %j', label => {
    const scene = model({ label });
    const properties = scene.materials.get('style')!.properties;
    expect(properties).toEqual({ label });
    expect(scene.definition!.materials.style!.properties).toEqual({ label });
    expect(Object.isFrozen(properties.label)).toBe(true);
    expect(properties.label).not.toBe(label);
  });

  it('copies and freezes label, font and offset at load and replacement, keeping old snapshots', () => {
    const font: LabelFontProperties = { size: '14px', family: '  Arial  ', weight: 'bold' };
    const offset: LabelOffset = { x: '+.5rem', y: '-1rem' };
    const label: LabelProperties = { color: '#aB12cD', font, offset, origin: 'bottom center' };
    const scene = model({ label });
    const handle = scene.materials.get('style')!;
    const original = handle.properties;
    const snapshot = scene.definition;

    for (const properties of [original, snapshot!.materials.style!.properties]) {
      expect(properties).toEqual({ label });
      expect(Object.isFrozen(properties)).toBe(true);
      expect(Object.isFrozen(properties.label)).toBe(true);
      expect(Object.isFrozen(properties.label!.font)).toBe(true);
      expect(Object.isFrozen(properties.label!.offset)).toBe(true);
      expect(properties.label).not.toBe(label);
      expect(properties.label!.font).not.toBe(font);
      expect(properties.label!.offset).not.toBe(offset);
    }

    const input = {
      label: {
        font: { size: '2rem' as LabelLength },
        offset: { x: '0px' as LabelLength, y: '3px' as LabelLength },
      },
    };
    handle.properties = input;
    const replacement = handle.properties;
    input.label.font.size = '9px';
    input.label.offset.x = '10px';
    expect(replacement).toEqual({
      label: { font: { size: '2rem' }, offset: { x: '0px', y: '3px' } },
    });
    expect(Object.isFrozen(replacement.label!.font)).toBe(true);
    expect(Object.isFrozen(replacement.label!.offset)).toBe(true);
    expect(Reflect.set(replacement.label!.font!, 'size', '20px')).toBe(false);
    expect(Reflect.set(replacement.label!.offset!, 'y', '20px')).toBe(false);
    expect(original).toEqual({ label });
    expect(scene.definition).toBe(snapshot);
    expect(snapshot!.materials.style!.properties).toBe(original);

    handle.properties = { label: { font: {} } };
    expect(handle.properties).toEqual({ label: { font: {} } });
    handle.properties = {};
    expect(handle.properties).toEqual({});
    expect(replacement.label!.font!.size).toBe('2rem');
  });

  it('preserves parent and child own values independently across whole-value edits and maps', () => {
    const definition = resolveMapDefinition({
      layers: [],
      materials: {
        base: {
          properties: {
            label: { font: { size: '2rem', family: 'Arial' }, offset: { x: '1px', y: '2px' } },
          },
        },
        child: {
          inherits: 'base',
          properties: { label: { color: '#123456', font: { weight: 'bold' } } },
        },
      },
      objects: [{ kind: 'point', id: 'p', position: { x: 0, y: 0 }, material: 'child' }],
    });
    const first = new MapModel(definition);
    const second = new MapModel(definition);
    const base = first.materials.get('base')!;
    const child = first.materials.get('child')!;
    const original = child.properties;
    base.properties = { label: { font: { family: 'Serif' } } };
    expect(child.inherits).toBe('base');
    expect(child.properties).toBe(original);
    child.properties = { label: { font: {} } };
    expect(child.properties).toEqual({ label: { font: {} } });
    expect(base.properties).toEqual({ label: { font: { family: 'Serif' } } });
    expect(second.materials.get('child')!.properties).toBe(original);
    expect(definition.materials.child!.properties).toBe(original);
    expect(definition.materials.base!.properties.label!.font!.size).toBe('2rem');
  });

  it('accepts the common label group for all four kinds and unused rule targets', () => {
    const definition = resolveMapDefinition({
      layers: [],
      materials: { style: { properties: { label: { font: { size: '1rem' } } } } },
      materialRules: [{ when: { kind: ['point', 'line', 'route', 'polygon'] }, material: 'style' }],
      objects: [
        { kind: 'point', position: { x: 0, y: 0 } },
        {
          kind: 'line',
          points: [
            { kind: 'point', position: { x: 0, y: 0 } },
            { kind: 'point', position: { x: 10, y: 0 } },
          ],
        },
        { kind: 'route', points: [] },
        {
          kind: 'polygon',
          contour: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
          ],
        },
      ],
    });
    const scene = new MapModel(definition);
    scene.materials.get('style')!.properties = { label: { color: '#654321' } };
    expect(scene.objects.size).toBe(4);
    expect([...scene.objects].every(object => object.label === undefined)).toBe(true);
  });
});

describe('label material valid values', () => {
  it.each<LabelLength>(['1rem', '14px', '+.5rem', '.25px', '1.px', '+001.20px'])(
    'accepts a positive decimal font size %s unchanged',
    size => {
      expect(copyMaterialProperties({ label: { font: { size } } })).toEqual({
        label: { font: { size } },
      });
    },
  );

  it.each<LabelLength>(['0px', '-0rem', '+0px', '-1rem', '-.5px', '1.25rem', '+2.px'])(
    'accepts a finite offset %s unchanged in either coordinate',
    length => {
      expect(copyMaterialProperties({ label: { offset: { x: length, y: length } } })).toEqual({
        label: { offset: { x: length, y: length } },
      });
    },
  );

  it.each(origins)('accepts origin %s', origin => {
    expect(model({ label: { origin } }).materials.get('style')!.properties).toEqual({
      label: { origin },
    });
  });

  it.each(['normal', 'bold'] as const)('accepts font weight %s', weight => {
    expect(copyMaterialProperties({ label: { font: { weight } } })).toEqual({
      label: { font: { weight } },
    });
  });
});

const invalidLengths: readonly unknown[] = [
  ...TYPE_ACCEPTED_INVALID_LENGTHS,
  undefined,
  null,
  12,
  0,
  NaN,
  Infinity,
  {},
  [],
  '',
  '12',
  '1em',
  '1%',
  'Infinitypx',
  'NaNrem',
  '2px ',
  '2 px',
  'calc(1rem)',
  '1PX',
  '--1px',
  '1.2.3rem',
  '2px\n',
  '2px\r',
  '2px\r\n',
  `${'9'.repeat(400)}px`,
];

describe('label material validation and atomicity', () => {
  function reject(label: unknown, field: string, code = 'INVALID_MATERIAL_PROPERTY'): void {
    const properties = { label } as MaterialProperties;
    const details: unknown = expect.objectContaining({
      material: 'style',
      property: 'label',
      field,
    });
    const expected: unknown = expect.objectContaining({
      name: 'AtlasMaterialError',
      code,
      details,
    });
    expect(() => model(properties)).toThrow(expected);
    const scene = model({ label: { font: { size: '1rem' }, offset: { x: '0px', y: '-1rem' } } });
    scene.observeChanges();
    const changed = vi.fn();
    scene.addEventListener('change', changed);
    const handle = scene.materials.get('style')!;
    const previous = handle.properties;
    const snapshot = scene.definition;
    const object = scene.objects.get('p');
    expect(() => {
      handle.properties = properties;
    }).toThrow(expected);
    expect(handle.properties).toBe(previous);
    expect(scene.definition).toBe(snapshot);
    expect(scene.objects.get('p')).toBe(object);
    expect(changed).not.toHaveBeenCalled();
  }

  it.each(invalidLengths)('rejects invalid size and either offset coordinate: %j', value => {
    reject({ font: { size: value } }, 'properties.label.font.size');
    reject({ offset: { x: value, y: '0px' } }, 'properties.label.offset.x');
    reject({ offset: { x: '0px', y: value } }, 'properties.label.offset.y');
  });

  it.each(['0px', '-0rem', '-1px', '-.5rem'])('rejects nonpositive font size %s', size => {
    reject({ font: { size } }, 'properties.label.font.size');
  });

  it.each([
    [undefined, 'properties.label'],
    [null, 'properties.label'],
    [[], 'properties.label'],
    ['text', 'properties.label'],
    [{ font: undefined }, 'properties.label.font'],
    [{ font: null }, 'properties.label.font'],
    [{ font: [] }, 'properties.label.font'],
    [{ color: undefined }, 'properties.label.color'],
    [{ color: '#fff' }, 'properties.label.color'],
    [{ color: '#123456\n' }, 'properties.label.color'],
    [{ color: 'red' }, 'properties.label.color'],
    [{ color: 123456 }, 'properties.label.color'],
    [{ font: { family: undefined } }, 'properties.label.font.family'],
    [{ font: { family: '' } }, 'properties.label.font.family'],
    [{ font: { family: ' \t ' } }, 'properties.label.font.family'],
    [{ font: { family: 10 } }, 'properties.label.font.family'],
    [{ font: { weight: undefined } }, 'properties.label.font.weight'],
    [{ font: { weight: 'BOLD' } }, 'properties.label.font.weight'],
    [{ font: { weight: 700 } }, 'properties.label.font.weight'],
    [{ origin: undefined }, 'properties.label.origin'],
    [{ origin: 'left top' }, 'properties.label.origin'],
    [{ origin: 'top center\r' }, 'properties.label.origin'],
    [{ origin: 'top center\n' }, 'properties.label.origin'],
    [{ origin: ' top center' }, 'properties.label.origin'],
    [{ origin: 'top  center' }, 'properties.label.origin'],
    [{ offset: undefined }, 'properties.label.offset'],
    [{ offset: null }, 'properties.label.offset'],
    [{ offset: [] }, 'properties.label.offset'],
    [{ offset: { x: '0px' } }, 'properties.label.offset.y'],
    [{ offset: { y: '0px' } }, 'properties.label.offset.x'],
  ] as const)('rejects malformed nested declarations %j at %s', (label, field) => {
    reject(label, field);
  });

  it.each([
    [{ fontSize: '1rem' }, 'properties.label.fontSize'],
    [{ fontFamily: 'Arial' }, 'properties.label.fontFamily'],
    [{ fontWeight: 'bold' }, 'properties.label.fontWeight'],
    [{ text: 'Exit' }, 'properties.label.text'],
    [{ font: { fontSize: '1rem' } }, 'properties.label.font.fontSize'],
    [{ offset: { x: '0px', y: '0px', z: '0px' } }, 'properties.label.offset.z'],
  ] as const)('rejects unknown nested fields %j with their exact path', (label, field) => {
    reject(label, field, 'UNKNOWN_MATERIAL_PROPERTY');
  });

  it('checks nonenumerable and symbol keys and rejects accessors without invoking them', () => {
    const getter = vi.fn(() => '2rem');
    reject(
      { font: Object.defineProperty({}, 'size', { get: getter }) },
      'properties.label.font.size',
    );
    expect(getter).not.toHaveBeenCalled();
    reject(
      Object.defineProperty({}, 'extra', { value: true }),
      'properties.label.extra',
      'UNKNOWN_MATERIAL_PROPERTY',
    );
    reject(
      { [Symbol('extra')]: true },
      'properties.label.Symbol(extra)',
      'UNKNOWN_MATERIAL_PROPERTY',
    );
    reject(
      { font: Object.defineProperty({}, 'size', { value: undefined }) },
      'properties.label.font.size',
    );
    const copied = copyMaterialProperties({
      label: { font: Object.assign(Object.create(null) as object, { size: '2rem' }) },
    });
    expect(copied).toEqual({ label: { font: { size: '2rem' } } });
    expect(() => copyMaterialProperties({ label: new Date() })).toThrow(AtlasMaterialError);
  });
});
