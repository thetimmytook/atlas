import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { Point2 } from '#math/point2.js';
import { Size } from '#math/size.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type {
  JsonObject,
  MaterialProperties,
  PropertyRegistration,
} from '#definitions/material-definition.js';
import type { MapPoint } from '#objects/map-point.js';

async function freshApi(): Promise<{
  configuration: typeof import('#objects/property-configuration.js');
  definitions: typeof import('#definitions/map-definition.js');
  models: typeof import('#objects/map-model.js');
  points: typeof import('#objects/map-point.js');
  routes: typeof import('#objects/map-route.js');
  lines: typeof import('#objects/map-line.js');
  polygons: typeof import('#objects/map-polygon.js');
}> {
  vi.resetModules();
  const [configuration, definitions, models, points, routes, lines, polygons] = await Promise.all([
    import('#objects/property-configuration.js'),
    import('#definitions/map-definition.js'),
    import('#objects/map-model.js'),
    import('#objects/map-point.js'),
    import('#objects/map-route.js'),
    import('#objects/map-line.js'),
    import('#objects/map-polygon.js'),
  ]);

  return { configuration, definitions, models, points, routes, lines, polygons };
}

let api: Awaited<ReturnType<typeof freshApi>>;
beforeEach(async () => {
  api = await freshApi();
});

function model(input: Partial<MapDefinition> = {}): InstanceType<typeof api.models.MapModel> {
  const result = new api.models.MapModel(
    api.definitions.resolveMapDefinition({ layers: [{ id: 'content' }], ...input }),
  );

  for (const object of result.objects) {
    result.layers[0]!.objectIds.add(object.id);
  }

  return result;
}

function point(data?: JsonObject): {
  kind: 'point';
  id: string;
  position: Point2;
  data?: JsonObject;
} {
  return {
    kind: 'point',
    id: 'p',
    position: new Point2(100, 100),
    ...(data === undefined ? {} : { data }),
  };
}

function register(overrides: Partial<PropertyRegistration> = {}): PropertyRegistration {
  const registration: PropertyRegistration = {
    name: 'type',
    valueType: 'string',
    optional: true,
    appliesTo: ['point'],
    read: object => object.data?.type,
    ...overrides,
  };
  api.configuration.configureProperties({ properties: [registration] });

  return registration;
}

function appearance(
  scene: ReturnType<typeof model>,
  objectId = 'p',
): ReturnType<typeof scene.geometry.appearanceFor> {
  return scene.geometry.appearanceFor(
    scene.geometry.objects.find(entry => entry.object.id === objectId)!,
  );
}

function camera(): Camera {
  const result = new Camera();
  result.center = new Point2(100, 100);
  result.resize(new Size(400, 300));

  return result;
}

describe('registration and mandatory readers', () => {
  it('accumulates copied registrations and permits material parameter names', () => {
    const appliesTo: PropertyRegistration['appliesTo'][number][] = ['point'];
    register({ name: 'color', appliesTo, read: object => object.data?.color });
    appliesTo.length = 0;
    register({ name: 'size', valueType: 'number', read: object => object.data?.size });
    register({ name: 'width', valueType: 'boolean', read: object => object.data?.width });
    const scene = model({
      objects: [
        point({ color: 'urgent', size: 5, width: true, kind: 'application', arbitrary: null }),
      ],
      materials: { red: { properties: { color: '#FF0000' } } },
      materialRules: [{ when: { kind: 'point', color: 'urgent' }, material: 'red' }],
    });
    expect(appearance(scene)).toMatchObject({ color: '#FF0000', size: 22 });
  });

  it('rejects duplicate calls atomically, including kind, and locks even empty calls', () => {
    const registration = register();
    expect(() =>
      api.configuration.configureProperties({
        properties: [{ ...registration, name: 'new' }, registration],
      }),
    ).toThrow(expect.objectContaining({ code: 'DUPLICATE_PROPERTY_REGISTRATION' }));
    register({ name: 'new' });
    expect(() => register({ name: 'kind' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_PROPERTY_REGISTRATION' }),
    );
    const fresh = { ...registration, name: 'fresh' };
    expect(() => api.configuration.configureProperties({ properties: [fresh, fresh] })).toThrow();
    register({ name: 'fresh' });
    api.configuration.lockPropertyConfiguration();
    expect(() => api.configuration.configureProperties({ properties: [] })).toThrow(
      expect.objectContaining({ code: 'MATERIAL_CONFIGURATION_LOCKED' }),
    );
  });

  it.each([
    { name: '' },
    { name: ' padded' },
    { optional: undefined },
    { valueType: 'object' },
    { appliesTo: [] },
    { appliesTo: ['unknown'] },
    { read: undefined },
  ])('rejects incomplete or invalid registration %j without adding it', invalid => {
    expect(() => register(invalid as unknown as Partial<PropertyRegistration>)).toThrow(
      expect.objectContaining({ code: 'INVALID_MATERIAL_CONFIGURATION' }),
    );
    register();
  });

  it.each([undefined, null, 4, false, {}, [], Promise.resolve('ok')])(
    'requires valid unused properties even on hidden explicit-material objects: %j',
    value => {
      register({ optional: false, read: () => value });
      expect(() =>
        model({
          layers: [],
          materials: { fixed: { properties: {} } },
          objects: [{ ...point(), material: 'fixed' }],
        }),
      ).toThrow(expect.objectContaining({ code: 'INVALID_SELECTION_PROPERTY_VALUE' }));
    },
  );

  it.each([NaN, Infinity, -Infinity, '4', null])(
    'rejects invalid numeric reader output %j',
    value => {
      register({ valueType: 'number', read: () => value });
      expect(() => model({ objects: [point()] })).toThrow(
        expect.objectContaining({ code: 'INVALID_SELECTION_PROPERTY_VALUE' }),
      );
    },
  );

  it('reads every applicable root and owned point and wraps thrown reader causes', () => {
    const failure = new Error('reader failed');
    register({
      optional: false,
      read: object => {
        if (object.id === 'bad') {
          throw failure;
        }

        return 'valid';
      },
    });
    expect(() =>
      model({ layers: [], objects: [{ kind: 'route', points: [{ ...point(), id: 'bad' }] }] }),
    ).toThrow(
      expect.objectContaining({
        name: 'AtlasMaterialError',
        code: 'MATERIAL_PROPERTY_READ_FAILED',
        cause: failure,
        details: { property: 'type', objectId: 'bad', kind: 'point' },
      }),
    );
    expect(() =>
      model({ objects: [{ kind: 'line', points: [point(), { ...point(), id: 'bad' }] }] }),
    ).toThrow(expect.objectContaining({ cause: failure }));
    expect(() => model({ objects: [{ kind: 'route', points: [] }] })).not.toThrow();
  });

  it('passes a frozen candidate projection while the actual object retains committed data', () => {
    const observedObject: { object?: MapPoint } = {};
    const observed: unknown[] = [];
    register({
      optional: false,
      read: projection => {
        expect(Object.isFrozen(projection)).toBe(true);
        expect(Object.keys(projection).sort((a, b) => a.localeCompare(b))).toEqual([
          'data',
          'id',
          'kind',
        ]);
        expect(projection).not.toBe(observedObject.object);
        expect(Object.isFrozen(projection.data)).toBe(true);
        observed.push([projection.data?.type, observedObject.object?.data?.type]);

        return projection.data?.type;
      },
    });
    const scene = model({ objects: [point({ type: 'old' })] });
    observedObject.object = scene.objects.get('p') as MapPoint;
    const actual = observedObject.object;
    actual.data = { type: 'new' };
    expect(observed.at(-1)).toEqual(['new', 'old']);
    const previous = actual.data;
    const changed = vi.fn();
    actual.addEventListener('change', changed);
    expect(() => {
      actual.data = {};
    }).toThrow();
    expect(actual.data).toBe(previous);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('immutable JSON and full definition constructors', () => {
  it('copies nested records, arrays, null-prototype records and special application keys', () => {
    const data = {
      nested: { list: [1, null, { valid: true }] },
      empty: {},
      ['__proto__']: 'value',
    };
    const object = new api.points.MapPoint(point(data));
    const previous = object.data;
    data.nested.list.length = 0;
    expect(previous).toEqual({
      nested: { list: [1, null, { valid: true }] },
      empty: {},
      ['__proto__']: 'value',
    });
    expect(Object.isFrozen((previous!.nested as JsonObject).list)).toBe(true);
    object.data = Object.assign(Object.create(null) as JsonObject, { type: 'record' });
    expect(object.data).toEqual({ type: 'record' });
    object.data = undefined;
    expect(object.data).toBeUndefined();
    expect(previous!.empty).toEqual({});
  });

  it.each([
    null,
    [],
    new Date(),
    { bad: undefined },
    { bad: NaN },
    { bad: Infinity },
    { bad: 1n },
    { bad: Symbol('x') },
    { bad: (): void => {} },
    { bad: new Map() },
    { bad: Array(2) },
  ])('rejects non-JSON data atomically: %s', value => {
    const object = new api.points.MapPoint(point({ old: true }));
    const previous = object.data;
    const changed = vi.fn();
    object.addEventListener('change', changed);
    expect(() => {
      object.data = value as unknown as JsonObject;
    }).toThrow(expect.objectContaining({ code: 'INVALID_OBJECT_DATA' }));
    expect(object.data).toBe(previous);
    expect(changed).not.toHaveBeenCalled();
  });

  it('rejects cycles, symbol keys, sparse arrays and accessors without invoking getters', () => {
    class CustomArray extends Array<number> {}
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const getter = vi.fn(() => 'hidden');
    const accessor = Object.defineProperty({}, 'value', { get: getter });
    const array = Object.defineProperty([1], '0', { get: getter });

    for (const data of [
      cyclic,
      accessor,
      { array },
      { custom: new CustomArray(1, 2) },
      { [Symbol('key')]: 1 },
    ]) {
      expect(() => new api.points.MapPoint(point(data as JsonObject))).toThrow(
        expect.objectContaining({ code: 'INVALID_OBJECT_DATA' }),
      );
    }

    expect(getter).not.toHaveBeenCalled();
  });

  it('retains common fields in direct constructors, loading, additions and route edits', () => {
    const input = { ...point({ type: 'owned' }), material: 'marker', pickable: false };
    const line = new api.lines.MapLine({
      kind: 'line',
      data: { type: 'line' },
      material: 'path',
      points: [input, point()],
    });
    const route = new api.routes.MapRoute({
      kind: 'route',
      data: { type: 'route' },
      material: 'path',
      points: [input],
    });
    const polygon = new api.polygons.MapPolygon({
      kind: 'polygon',
      contour: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
      ],
      data: { type: 'polygon' },
      material: 'fill',
    });
    expect(line.id).not.toBe(route.id);
    expect(route.id.length).toBeGreaterThan(0);
    expect(line.data).toEqual({ type: 'line' });
    expect(line.material).toBe('path');
    expect(line.points[0]).toMatchObject({ data: input.data, material: 'marker', pickable: false });
    expect(route.points[0]).toMatchObject({
      data: input.data,
      material: 'marker',
      pickable: false,
    });
    expect(polygon.data).toEqual({ type: 'polygon' });
    expect(polygon.material).toBe('fill');
    expect(() => new api.routes.MapRoute({ kind: 'line', points: [] } as never)).toThrow(
      expect.objectContaining({ code: 'INVALID_OBJECT_KIND' }),
    );
    const scene = model({
      materials: { marker: { properties: {} }, path: { properties: {} } },
      objects: [
        { kind: 'route', id: 'route', material: 'path', data: { loaded: true }, points: [input] },
      ],
    });
    const owned = scene.objects.get('route') as InstanceType<typeof api.routes.MapRoute>;
    expect(scene.definition!.objects[0]).toMatchObject({
      data: { loaded: true },
      material: 'path',
      points: [input],
    });
    expect(owned.addPoint(input).pickable).toBe(false);
    expect(owned.insertPoint(0, input).data).toEqual(input.data);
    expect(owned.replacePoints(0, 1, [input])[0]!.material).toBe('marker');
    expect(scene.objects.add(input).data).toEqual(input.data);
  });
});

describe('selection, inheritance and atomic runtime edits', () => {
  it.each([
    ['materials', 'INVALID_MATERIAL_DEFINITION'],
    ['materialRules', 'INVALID_MATERIAL_RULE'],
    ['resources', 'INVALID_IMAGE_RESOURCE'],
  ] as const)('rejects null %s and normalizes only absence or undefined', (field, code) => {
    expect(() => model({ [field]: null })).toThrow(
      expect.objectContaining({ code, details: { field } }),
    );
    const absent = model().definition!;
    const explicitUndefined = model({ [field]: undefined }).definition!;
    expect(explicitUndefined).toEqual(absent);
    expect(explicitUndefined).toMatchObject({ materials: {}, materialRules: [], resources: {} });
  });

  it.each([
    {
      input: {
        materials: { parent: { properties: {} }, child: { properties: {}, inherit: 'parent' } },
      },
      code: 'INVALID_MATERIAL_DEFINITION',
      details: { material: 'child', field: 'inherit' },
    },
    {
      input: { materials: { marker: { properties: {}, color: '#112233' } } },
      code: 'INVALID_MATERIAL_DEFINITION',
      details: { material: 'marker', field: 'color' },
    },
    {
      input: { resources: { icon: { kind: 'image', source: '/icon.svg', url: '/other.svg' } } },
      code: 'INVALID_IMAGE_RESOURCE',
      details: { resourceId: 'icon', field: 'url' },
    },
    {
      input: {
        materials: { marker: { properties: {} } },
        materialRules: [{ when: { kind: 'point' }, material: 'marker', priority: 1 }],
      },
      code: 'INVALID_MATERIAL_RULE',
      details: { ruleIndex: 0, field: 'priority' },
    },
  ])('rejects unknown declaration fields with $code', ({ input, code, details }) => {
    expect(() => model(input as never)).toThrow(expect.objectContaining({ code, details }));
  });

  it('preserves arbitrary data keys even when they resemble declaration fields', () => {
    const data = { inherit: 'parent', inherits: null, color: '#112233', url: 'free', priority: 1 };
    const scene = model({ objects: [point(data)] });
    expect(scene.objects.get('p')!.data).toEqual(data);
    expect(scene.definition!.objects[0]!.data).toEqual(data);
  });

  it('uses kind then conditional then explicit, with last-match order and no implicit parent', () => {
    register();
    const scene = model({
      objects: [point({ type: 'exit' })],
      materials: {
        general: { properties: { color: '#000000', size: 50 } },
        conditional: { properties: { size: 32 } },
        explicit: { properties: { color: '#ffffff' } },
        'general.child': { properties: {} },
      },
      materialRules: [
        { when: { kind: 'point', type: ['exit', 'entrance'] }, material: 'conditional' },
        { when: { kind: 'point' }, material: 'general' },
      ],
    });
    const object = scene.objects.get('p') as MapPoint;
    expect(appearance(scene)).toMatchObject({ color: '#2775d9', size: 32 });
    expect(object.material).toBeUndefined();
    object.material = 'explicit';
    expect(appearance(scene)).toMatchObject({ color: '#ffffff', size: 22 });
    object.material = undefined;
    expect(appearance(scene)).toMatchObject({ size: 32 });
    object.data = {};
    expect(appearance(scene)).toMatchObject({ color: '#000000', size: 50 });
    object.material = 'general.child';
    expect(appearance(scene)).toMatchObject({ color: '#2775d9', size: 22 });
    expect(scene.materials.get('builtin.point')).toBeUndefined();
    const last = model({
      objects: [point()],
      materials: { a: { properties: { size: 10 } }, b: { properties: { size: 20 } } },
      materialRules: [
        { when: { kind: 'point' }, material: 'a' },
        { when: { kind: ['point'] }, material: 'b' },
      ],
    });
    expect(appearance(last)).toMatchObject({ size: 20 });
  });

  it('matches numeric and boolean alternatives exactly with AND and last conditional order', () => {
    register({
      name: 'score',
      valueType: 'number',
      optional: false,
      read: object => object.data?.score,
    });
    register({
      name: 'enabled',
      valueType: 'boolean',
      optional: false,
      read: object => object.data?.enabled,
    });
    const scene = model({
      objects: [point({ score: 2, enabled: true })],
      materials: {
        first: { properties: { color: '#111111' } },
        last: { properties: { color: '#222222' } },
      },
      materialRules: [
        { when: { kind: 'point', score: [1, 2, 2], enabled: true }, material: 'first' },
        { when: { kind: 'point', enabled: [true] }, material: 'last' },
      ],
    });
    expect(appearance(scene)).toMatchObject({ color: '#222222' });
    const object = scene.objects.get('p') as MapPoint;
    object.data = { score: 2, enabled: false };
    expect(appearance(scene)).toMatchObject({ color: '#2775d9' });

    for (const score of [[2, '2'], [NaN], [Infinity]]) {
      expect(() =>
        model({
          materials: { first: { properties: {} } },
          materialRules: [{ when: { kind: 'point', score: score as never }, material: 'first' }],
        }),
      ).toThrow(expect.objectContaining({ code: 'INVALID_MATERIAL_RULE' }));
    }
  });

  it('checks every rule target and every declared graph even if unused', () => {
    register();
    const invalid: Partial<MapDefinition>[] = [
      { materials: { a: { inherits: 'missing', properties: {} } } },
      { materials: { a: { inherits: 'b', properties: {} }, b: { inherits: 'a', properties: {} } } },
      { materials: { a: { properties: { color: 'red' } } } },
      { materials: { a: { properties: { image: { resource: 'missing' } } } } },
      { materials: { a: { properties: { symbol: 'image' } } } },
      {
        materials: { a: { properties: { size: 10 } } },
        materialRules: [{ when: { kind: ['line', 'point'] }, material: 'a' }],
      },
      {
        materials: { a: { properties: {} } },
        materialRules: [{ when: { kind: ['line', 'point'], type: 'x' }, material: 'a' }],
      },
      {
        materials: { a: { properties: {} } },
        materialRules: [{ when: { kind: 'point', unknown: true }, material: 'a' }],
      },
      {
        materials: { a: { properties: {} } },
        materialRules: [{ when: { kind: 'point', type: [] }, material: 'a' }],
      },
      {
        materials: { a: { properties: {} } },
        materialRules: [{ when: { kind: 'point', type: ['x', 1] as never }, material: 'a' }],
      },
      { materialRules: [{ when: { kind: 'point' }, material: 'missing' }] },
      {
        materials: { a: { properties: {} } },
        materialRules: [{ when: {} as never, material: 'a' }],
      },
    ];
    invalid.forEach(input => expect(() => model(input)).toThrow());
    expect(() =>
      model({
        materials: { 'builtin.point': { properties: {} } },
        objects: [{ ...point(), material: 'builtin.point' }],
      }),
    ).not.toThrow();
  });

  it('resolves explicit parents and validates edits against descendants, rules and users', () => {
    const definition: Partial<MapDefinition> = {
      objects: [{ ...point(), material: 'child' }],
      materials: {
        parent: { properties: { color: '#123456', size: 40 } },
        child: { inherits: 'parent', properties: { size: 30 } },
      },
    };
    const scene = model(definition);
    const other = model(definition);
    const parent = scene.materials.get('parent')!;
    const child = scene.materials.get('child')!;
    const snapshot = parent.properties;
    parent.properties = { color: '#654321', size: 60 };
    expect(appearance(scene)).toMatchObject({ color: '#654321', size: 30 });
    expect(appearance(other)).toMatchObject({ color: '#123456', size: 30 });
    child.properties = {};
    expect(appearance(scene)).toMatchObject({ size: 60 });
    const before = parent.properties;
    expect(() => {
      parent.properties = { width: 5 };
    }).toThrow(expect.objectContaining({ code: 'INCOMPATIBLE_MATERIAL_PROPERTY' }));
    expect(parent.properties).toBe(before);
    expect(snapshot).toEqual({ color: '#123456', size: 40 });
    expect(scene.definition!.materials.parent!.properties).toBe(snapshot);
    expect(Object.isFrozen(parent)).toBe(true);
    expect(Object.isFrozen(parent.properties)).toBe(true);
    const unusedRule = model({
      materials: { shared: { properties: {} } },
      materialRules: [{ when: { kind: ['point', 'line'] }, material: 'shared' }],
    });
    expect(() => {
      unusedRule.materials.get('shared')!.properties = { size: 10 };
    }).toThrow();
  });

  it('preflights shared roots and owned points in every map before mutation, including disconnected use', () => {
    register({ optional: false });
    const first = model({
      materials: { common: { properties: {} }, onlyFirst: { properties: {} } },
    });
    const second = model({ materials: { common: { properties: {} } } });
    const root = new api.routes.MapRoute({
      kind: 'route',
      points: [{ ...point({ type: 'valid' }), material: 'common' }],
    });
    first.objects.add(root);
    second.objects.add(root);
    first.unobserveChanges();
    second.unobserveChanges();
    const vertex = root.points[0]!;
    const before = vertex.data;
    const changed = vi.fn();
    root.addEventListener('change', changed);
    expect(() => {
      vertex.material = 'onlyFirst';
    }).toThrow(expect.objectContaining({ code: 'UNKNOWN_MATERIAL' }));
    expect(vertex.material).toBe('common');
    expect(changed).not.toHaveBeenCalled();
    expect(() => {
      vertex.data = {};
    }).toThrow();
    expect(vertex.data).toBe(before);
    const points = root.points;
    expect(() => root.addPoint(point())).toThrow();
    expect(() =>
      root.insertPoint(0, { ...point({ type: 'valid' }), material: 'onlyFirst' }),
    ).toThrow();
    expect(() => root.replacePoints(0, 1, [point()])).toThrow();
    expect(root.points).toBe(points);
    expect(changed).not.toHaveBeenCalled();
    expect(() =>
      second.objects.add({ ...point({ type: 'valid' }), material: 'onlyFirst' }),
    ).toThrow();
    expect(second.objects.size).toBe(1);
    first.objects.add(vertex);
    root.removePoint(vertex);
    vertex.material = 'onlyFirst';
    expect(vertex.material).toBe('onlyFirst');
    expect(() => second.objects.add(vertex)).toThrow();
    vertex.material = 'common';
    second.objects.add(vertex);
    first.materials.deactivate();
    second.objects.remove(vertex);
    vertex.data = {};
    expect(vertex.data).toEqual({});
  });

  it('keeps image inheritance atomic and resolves all aspect-ratio combinations', () => {
    const scene = model({
      objects: [{ ...point(), material: 'child' }],
      resources: {
        first: { kind: 'image', source: '/a.svg' },
        second: { kind: 'image', source: '/b.png' },
      },
      materials: {
        parent: {
          properties: {
            symbol: 'image',
            image: {
              resource: 'first',
              width: 80,
              height: 80,
              anchor: { x: 0.5, y: 1 },
              preserveAspectRatio: false,
            },
          },
        },
        child: { inherits: 'parent', properties: { image: { resource: 'second', width: 80 } } },
      },
    });
    scene.materials.setPreparedImages(
      new Map([
        ['first', { source: 'a', width: 20, height: 40 }],
        ['second', { source: 'b', width: 40, height: 20 }],
      ]),
    );
    const child = scene.materials.get('child')!;
    expect(appearance(scene)).toMatchObject({
      image: { source: 'b', width: 80, height: 40, x: -40, y: -20 },
    });
    const cases: readonly [MaterialProperties['image'], number, number][] = [
      [{ resource: 'second' }, 40, 20],
      [{ resource: 'second', height: 80 }, 160, 80],
      [{ resource: 'second', width: 80, height: 80 }, 80, 40],
      [{ resource: 'second', preserveAspectRatio: false, width: 80 }, 80, 20],
      [{ resource: 'second', preserveAspectRatio: false, height: 80 }, 40, 80],
      [{ resource: 'second', preserveAspectRatio: false, width: 80, height: 80 }, 80, 80],
    ];

    for (const [image, width, height] of cases) {
      child.properties = { image: image! };
      expect(appearance(scene)).toMatchObject({ image: { width, height } });
    }

    child.properties = {};
    expect(appearance(scene)).toMatchObject({
      image: { source: 'a', width: 80, height: 80, x: -40, y: -80 },
    });
  });
});

describe('per-appearance picking and immediate invalidation', () => {
  it('keeps contextual defaults when one point is root and route-owned in different maps', () => {
    const route = new api.routes.MapRoute({ kind: 'route', id: 'route', points: [point()] });
    const vertex = route.points[0]!;
    const owned = model();
    owned.objects.add(route);
    owned.layers[0]!.objectIds.add(route.id);
    const standalone = model();
    standalone.objects.add(vertex);
    standalone.layers[0]!.objectIds.add(vertex.id);
    const c = camera();
    expect(owned.spatial.hitTest(vertex.position, c)).toBeUndefined();
    expect(appearance(owned)).toMatchObject({ symbol: 'none', pickable: false });
    expect(standalone.spatial.hitTest(vertex.position, c)?.object).toBe(vertex);
    expect(appearance(standalone)).toMatchObject({ symbol: 'circle', pickable: true });
    const captured = standalone.geometry.objects[0]!;
    const listener = vi.fn(() => [
      owned.spatial.hitTest(vertex.position, c)?.object,
      standalone.spatial.hasHit(captured, vertex.position, c),
    ]);
    vertex.addEventListener('change', listener);
    vertex.pickable = true;
    expect(listener).toHaveLastReturnedWith([vertex, true]);
    vertex.pickable = false;
    expect(listener).toHaveLastReturnedWith([undefined, false]);
    vertex.pickable = undefined;
    expect(listener).toHaveLastReturnedWith([undefined, true]);
    const before = listener.mock.calls.length;
    expect(() => {
      vertex.pickable = 'true' as never;
    }).toThrow(expect.objectContaining({ code: 'INVALID_POINT_PICKABLE' }));
    expect(vertex.pickable).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(before);
    owned.objects.add(vertex);
    owned.layers[0]!.objectIds.add(vertex.id);
    const roles = owned.geometry.objects.filter(entry => entry.object === vertex);
    expect(roles).toHaveLength(2);
    expect(roles.map(entry => owned.geometry.appearanceFor(entry))).toMatchObject([
      { symbol: 'none', pickable: false },
      { symbol: 'circle', pickable: true },
    ]);
  });

  it('changes style/picking without rebuilding clipped geometry or draining display work', () => {
    const scene = model({
      objects: [
        { ...point(), material: 'marker' },
        {
          kind: 'line',
          id: 'line',
          material: 'path',
          points: [
            { ...point(), position: { x: 0, y: 0 } },
            { ...point(), position: { x: 200, y: 0 } },
          ],
        },
      ],
      materials: {
        marker: { properties: { symbol: 'none', size: 10 } },
        path: { properties: { width: 4 } },
      },
    });
    const object = scene.objects.get('p') as MapPoint;
    const c = camera();
    scene.geometry.takeChanges();
    expect(scene.spatial.hitTest(new Point2(108, 100), c)).toBeUndefined();
    scene.materials.get('marker')!.properties = { size: 20, symbol: 'none' };
    expect(scene.spatial.hitTest(new Point2(108, 100), c)?.object).toBe(object);
    expect(scene.geometry.takeChanges().appearance.size).toBe(1);
    scene.materials.get('path')!.properties = { width: 20 };
    expect(scene.spatial.hitTest(new Point2(100, 8), c)?.object.id).toBe('line');
    expect(scene.geometry.takeChanges().appearance.size).toBe(1);
  });

  it('keeps clipping and triangulation cached during shared color edits', async () => {
    const intersections = await import('#spatial/intersection.js');
    const polygons = await import('#math/polygon.js');
    const clipping = vi.spyOn(intersections, 'clipPolyline');
    const triangulation = vi.spyOn(polygons, 'triangulatePolygon');
    const scene = model({
      layers: [
        {
          id: 'clipped',
          objects: ['other'],
          intersectionBounds: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
        },
      ],
      objects: [
        point(),
        {
          kind: 'route',
          id: 'route',
          points: [
            { kind: 'point', position: { x: -20, y: 50 } },
            { kind: 'point', position: { x: 220, y: 50 } },
          ],
        },
        {
          kind: 'polygon',
          id: 'polygon',
          contour: [
            { x: -10, y: -10 },
            { x: 40, y: -10 },
            { x: 40, y: 40 },
            { x: -10, y: 40 },
          ],
        },
        { ...point(), id: 'other', material: 'other' },
      ],
      materials: { common: { properties: { color: '#112233' } }, other: { properties: {} } },
      materialRules: [{ when: { kind: ['point', 'route', 'polygon'] }, material: 'common' }],
    });

    // Keep only the explicit unrelated root; the three material users use automatic clipping.
    for (const id of ['p', 'route', 'polygon']) {
      scene.layers[0]!.objectIds.remove(id);
    }

    const entries = scene.geometry.objects;
    const cells = entries.find(entry => entry.object.kind === 'polygon')!.geometry;

    if (cells.kind === 'polygon') {
      expect(cells.cells.length).toBeGreaterThan(0);
    }

    scene.geometry.takeChanges();
    clipping.mockClear();
    triangulation.mockClear();
    scene.materials.get('common')!.properties = { color: '#445566' };
    expect(scene.geometry.objects).toBe(entries);
    const changed = scene.geometry.takeChanges();
    expect(changed.geometry.size).toBe(0);
    expect(
      [...changed.appearance].map(entry => entry.object.id).sort((a, b) => a.localeCompare(b)),
    ).toEqual(['p', 'polygon', 'route']);
    expect(clipping).not.toHaveBeenCalled();
    expect(triangulation).not.toHaveBeenCalled();
    clipping.mockRestore();
    triangulation.mockRestore();
  });

  it('uses the anchored image rectangle including transparency at every zoom', () => {
    const scene = model({
      objects: [{ ...point(), material: 'icon' }],
      resources: { icon: { kind: 'image', source: '/icon.svg' } },
      materials: {
        icon: {
          properties: {
            symbol: 'image',
            image: { resource: 'icon', width: 80, height: 80, anchor: { x: 0.5, y: 1 } },
          },
        },
      },
    });
    scene.materials.setPreparedImages(
      new Map([['icon', { source: 'icon', width: 40, height: 20 }]]),
    );
    const c = camera();

    for (const zoom of [0.5, 1, 2]) {
      c.zoom = zoom;
      expect(
        scene.spatial.hitTest(new Point2(100 - 40 / zoom, 100 - 40 / zoom), c)?.object.id,
      ).toBe('p');
      expect(scene.spatial.hitTest(new Point2(100 + 41 / zoom, 100), c)).toBeUndefined();
      expect(scene.spatial.hitTest(new Point2(100, 100 + 1 / zoom), c)).toBeUndefined();
    }
  });
});
