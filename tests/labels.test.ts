/* eslint-disable sonarjs/no-duplicate-string -- Repeated literal labels make preservation expectations explicit in regressions. */
import { describe, expect, it, vi } from 'vitest';

import { resolveMapDefinition, resolveMapEntry } from '#definitions/map-definition.js';
import { AtlasError } from '#errors/atlas-error.js';
import { MapLine } from '#objects/map-line.js';
import { MapModel } from '#objects/map-model.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapPoint } from '#objects/map-point.js';
import { MapPolygon } from '#objects/map-polygon.js';
import { MapRoute } from '#objects/map-route.js';

import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapEntry } from '#objects/map-object-collection.js';

const point = { kind: 'point', position: { x: 10, y: 20 }, label: '  Vertex  ' } as const;
const definitions: readonly MapEntryDefinition[] = [
  { ...point, id: 'point', label: '  Point  ' },
  { kind: 'line', id: 'line', points: [point, point], label: '  Line  ' },
  { kind: 'route', id: 'route', points: [point, point], label: '  Route  ' },
  {
    kind: 'polygon',
    id: 'polygon',
    contour: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 20 },
    ],
    label: '  Polygon  ',
  },
];

function construct(definition: MapEntryDefinition): MapEntry {
  switch (definition.kind) {
    case 'point':
      return new MapPoint(definition);
    case 'line':
      return new MapLine(definition);
    case 'route':
      return new MapRoute(definition);
    case 'polygon':
      return new MapPolygon(definition);
  }
}

describe('label input paths and runtime state', () => {
  it.each(definitions)(
    'preserves $kind labels in construction, resolution, addition and snapshots',
    definition => {
      const direct = construct(definition);
      const resolved = resolveMapEntry(definition);
      const snapshot = resolveMapDefinition({ objects: [definition], layers: [] });
      const model = new MapModel(snapshot);
      const added = new MapObjectCollection().add(definition);

      expect(direct.label).toBe(definition.label);
      expect(resolved.label).toBe(definition.label);
      expect(added.label).toBe(definition.label);
      expect(snapshot.objects[0]!.label).toBe(definition.label);
      expect(model.objects.get(definition.id!)!.label).toBe(definition.label);
      expect(Object.isFrozen(snapshot.objects[0])).toBe(true);

      if (direct instanceof MapLine || direct instanceof MapRoute) {
        expect(direct.points.map(vertex => vertex.label)).toEqual(['  Vertex  ', '  Vertex  ']);
        expect(added).toBeInstanceOf(direct.constructor);
        const copied = snapshot.objects[0]!;
        expect(copied.kind === 'line' || copied.kind === 'route').toBe(true);

        if (copied.kind === 'line' || copied.kind === 'route') {
          expect(copied.points.map(vertex => vertex.label)).toEqual(['  Vertex  ', '  Vertex  ']);
          expect(copied.points.every(Object.isFrozen)).toBe(true);
        }
      }

      const live = model.objects.get(definition.id!)!;
      live.label = 'changed';
      expect(snapshot.objects[0]!.label).toBe(definition.label);
      expect(model.definition).toBe(snapshot);
    },
  );

  it('copies appended, inserted and replaced route point labels and keeps retained membership', () => {
    const route = new MapRoute({ kind: 'route', points: [point] });
    const original = route.points;
    const input = { ...point, label: '  Added  ' };
    const added = route.addPoint(input);
    const inserted = route.insertPoint(1, { ...point, label: '' });
    const replaced = route.replacePoints(0, 1, [{ ...point, label: '   ' }]);
    input.label = 'external edit';

    expect(added.label).toBe('  Added  ');
    expect(inserted.label).toBe('');
    expect(replaced[0]!.label).toBe('   ');
    expect(original[0]!.label).toBe(point.label);
    expect(route.points.map(vertex => vertex.label)).toEqual(['   ', '', '  Added  ']);
    expect(route.removePoint(inserted)).toBe(true);
    inserted.label = 'detached';
    expect(inserted.label).toBe('detached');
  });

  it.each(['', '   ', ' \t spaces \t ', '<b>Exit</b> **literal**', 'Exit'])(
    'preserves literal text %j and notifies even for the same value',
    label => {
      const object = new MapPoint({ ...point, label });
      const changed = vi.fn(() => expect(object.label).toBe(label));
      object.addEventListener('change', changed);
      object.label = label;
      expect(changed).toHaveBeenCalledTimes(1);
      expect(object.label).toBe(label);
    },
  );

  it.each(definitions)('replaces and removes $kind text without changing data', definition => {
    const object = construct({ ...definition, data: { label: 'application-owned' } });
    const changed = vi.fn();
    object.addEventListener('change', changed);
    object.label = 'new';
    expect(object.label).toBe('new');
    object.label = undefined;
    expect(object.label).toBeUndefined();
    expect(object.data).toEqual({ label: 'application-owned' });
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('keeps one label across shared maps, root/owned uses and immediate change handlers', () => {
    const first = new MapModel(
      resolveMapDefinition({
        objects: [{ kind: 'route', id: 'r', label: 'Route', points: [point] }],
        layers: [],
      }),
    );
    const second = new MapModel(resolveMapDefinition({ layers: [] }));
    const route = first.objects.get('r') as MapRoute;
    const shared = route.points[0]!;
    second.objects.add(route);
    second.objects.add(shared);
    first.observeChanges();
    second.observeChanges();
    const firstChanged = vi.fn();
    const secondChanged = vi.fn();
    first.addEventListener('change', firstChanged);
    second.addEventListener('change', secondChanged);
    shared.addEventListener('change', () => {
      expect(route.points[0]!.label).toBe('shared edit');
      expect(second.objects.get(shared.id)!.label).toBe('shared edit');
      expect(first.definition!.objects[0]!.label).toBe('Route');
    });

    shared.label = 'shared edit';
    expect(firstChanged).toHaveBeenCalledTimes(1);
    expect(secondChanged).toHaveBeenCalledTimes(2);
    firstChanged.mockClear();
    secondChanged.mockClear();
    expect(() => {
      shared.label = 'invalid\rlabel';
    }).toThrow(AtlasError);
    expect(shared.label).toBe('shared edit');
    expect(firstChanged).not.toHaveBeenCalled();
    expect(secondChanged).not.toHaveBeenCalled();
    const savedRoute = first.definition!.objects[0]!;
    expect(savedRoute.kind).toBe('route');

    if (savedRoute.kind === 'route') {
      expect(savedRoute.points[0]!.label).toBe(point.label);
    }
  });

  it('omits absent text from definitions without creating it from a material', () => {
    const model = new MapModel(
      resolveMapDefinition({
        layers: [],
        objects: [{ kind: 'point', id: 'p', position: { x: 0, y: 0 }, material: 'labelled' }],
        materials: { labelled: { properties: { label: { color: '#222222' } } } },
      }),
    );
    expect(model.objects.get('p')!.label).toBeUndefined();
    expect(Object.hasOwn(model.definition!.objects[0]!, 'label')).toBe(false);
  });
});

describe('label validation and atomicity', () => {
  it.each(['constructor', 'snapshot'] as const)(
    'reads an accessor label once and preserves the validated value in the %s',
    path => {
      const read = vi
        .fn<() => string>()
        .mockReturnValueOnce('valid')
        .mockReturnValue('invalid\nlabel');
      const definition: MapPointDefinition = {
        kind: 'point',
        position: { x: 10, y: 20 },
        get label(): string {
          return read();
        },
      };
      const result =
        path === 'constructor'
          ? new MapPoint(definition)
          : resolveMapDefinition({ layers: [], objects: [definition] }).objects[0]!;

      expect(result.label).toBe('valid');
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it.each([null, 42, false, {}, [], 'A\nB', 'A\rB', 'A\r\nB'])(
    'rejects %j before mutation, creation or membership changes',
    actual => {
      const invalid = actual as string;
      const object = new MapPoint(point);
      const changed = vi.fn();
      object.addEventListener('change', changed);
      expect(() => {
        object.label = invalid;
      }).toThrow(
        expect.objectContaining({
          name: 'AtlasError',
          code: 'INVALID_OBJECT_LABEL',
          message: 'Object label must be a single-line string or undefined.',
          details: { field: 'label', actual },
        }),
      );
      expect(object.label).toBe(point.label);
      expect(changed).not.toHaveBeenCalled();

      for (const definition of definitions) {
        expect(() => construct({ ...definition, label: invalid })).toThrow(AtlasError);
        expect(() =>
          resolveMapDefinition({ layers: [], objects: [{ ...definition, label: invalid }] }),
        ).toThrow(expect.objectContaining({ code: 'INVALID_OBJECT_LABEL' }));
      }

      const collection = new MapObjectCollection();
      collection.add(object);
      const added = vi.fn();
      collection.addEventListener('add', added);
      expect(() => collection.add({ ...point, label: invalid })).toThrow(AtlasError);
      expect([...collection]).toEqual([object]);
      expect(added).not.toHaveBeenCalled();

      const route = new MapRoute({ kind: 'route', points: [point, point] });
      const points = route.points;
      const routeChanged = vi.fn();
      route.addEventListener('change', routeChanged);
      const badPoint: MapPointDefinition = { ...point, label: invalid };
      expect(() => route.addPoint(badPoint)).toThrow(AtlasError);
      expect(() => route.insertPoint(1, badPoint)).toThrow(AtlasError);
      expect(() => route.replacePoints(0, 2, [point, badPoint])).toThrow(AtlasError);
      expect(() => new MapLine({ kind: 'line', points: [point, badPoint] })).toThrow(AtlasError);
      expect(() => new MapRoute({ kind: 'route', points: [point, badPoint] })).toThrow(AtlasError);
      expect(route.points).toBe(points);
      expect(routeChanged).not.toHaveBeenCalled();
    },
  );
});
