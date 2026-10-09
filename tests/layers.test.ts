import { describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point } from '#math/point.js';
import { Size } from '#math/size.js';
import { MapModel } from '#objects/map-model.js';
import { MapPoint } from '#objects/map-point.js';

import { pointDefinition } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapEntry } from '#objects/map-object-collection.js';

function scene(): MapModel {
  return new MapModel(
    resolveMapDefinition({
      objects: [pointDefinition(40, 30, 'shared'), pointDefinition(280, 200, 'other')],
      layers: [
        { id: 'lower', stackIndex: -2, objects: ['other', 'shared'] },
        { id: 'upper', objects: ['shared'] },
      ],
    }),
  );
}

function camera(): Camera {
  const view = new Camera();
  view.resize(new Size(320, 240));
  view.center = new Point(160, 120);

  return view;
}

describe('explicit layer loading', () => {
  it('requires layers, rejects the flat format, and creates no default for an empty array', () => {
    expect(() => resolveMapDefinition({ objects: [] } as unknown as MapDefinition)).toThrow(
      expect.objectContaining({ code: 'INVALID_MAP_LAYERS' }),
    );
    expect(() =>
      resolveMapDefinition({ layers: [], background: {} } as unknown as MapDefinition),
    ).toThrow(expect.objectContaining({ code: 'TOP_LEVEL_BACKGROUND_UNSUPPORTED' }));
    const model = new MapModel(
      resolveMapDefinition({ layers: [], objects: [pointDefinition(40, 30)] }),
    );
    expect(model.layers).toEqual([]);
    expect(model.objects.size).toBe(1);
    expect(model.geometry.objects).toEqual([]);
    expect(model.spatial.hitTest(new Point(40, 30), camera())).toBeUndefined();
  });

  it('copies backgrounds and lists, completes layer IDs, and treats omitted content as empty', () => {
    const background = { source: '/map.svg', size: { width: 320, height: 240 } };
    const ids = ['point'];
    const input = {
      objects: [pointDefinition(40, 30, 'point')],
      layers: [{ background }, { objects: [] }, { objects: ids }],
    };
    const resolved = resolveMapDefinition(input);
    ids.push('missing');
    background.size.width = 999;
    expect(resolved.layers.map(layer => layer.objects)).toEqual([[], [], ['point']]);
    expect(resolved.layers[0]!.background!.size.width).toBe(320);
    expect(new Set(resolved.layers.map(layer => layer.id)).size).toBe(3);
    expect(resolved.layers.every(layer => layer.stackIndex === 0)).toBe(true);
    expect(Object.isFrozen(resolved.layers)).toBe(true);
    expect(Object.isFrozen(resolved.layers[2]!.objects)).toBe(true);
  });

  it('rejects unknown references and owned points that are not roots', () => {
    const objects = [
      { id: 'route', kind: 'route' as const, points: [pointDefinition(40, 30, 'vertex')] },
    ];

    for (const id of ['missing', 'vertex']) {
      expect(() =>
        resolveMapDefinition({ objects, layers: [{ id: 'floor', objects: [id] }] }),
      ).toThrow(
        expect.objectContaining({
          code: 'UNKNOWN_LAYER_OBJECT',
          details: { objectId: id, layerId: 'floor', field: 'layers[0].objects[0]' },
        }),
      );
    }
  });

  it.each(
    [
      [{ id: '' }],
      [{ id: 'same' }, { id: 'same' }],
      [{ stackIndex: Infinity }],
      [{ objects: [''] }],
      [{ objects: [12] }],
      [{ objects: 'point' }],
      [{ intersectionBounds: { min: { z: 3 }, max: { z: 0 } } }],
      [{ intersectionBounds: {} }],
    ].map(layers => ({ layers })),
  )('rejects invalid or unsupported layer input before preparation: %j', ({ layers }) => {
    expect(() => resolveMapDefinition({ layers } as unknown as MapDefinition)).toThrow();
  });

  it('selects every matching root without merging instances or using ID-list order', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [
          pointDefinition(40, 30, 'same'),
          pointDefinition(60, 30, 'other'),
          pointDefinition(80, 30, 'same'),
        ],
        layers: [{ objects: ['other', 'same', 'same'] }],
      }),
    );
    const roots = [...model.objects];
    expect(model.layers[0]!.objects).toEqual(roots);
    expect(model.layers[0]!.objects[0]).toBe(roots[0]);
    expect(model.layers[0]!.objects[2]).toBe(roots[2]);
    expect(roots[0]).not.toBe(roots[2]);
    expect(model.objects.get('same')).toBe(roots[0]);
    expect([...model.layers[0]!.objectIds]).toEqual(['other', 'same']);
  });
});

describe('live layer membership and eligibility', () => {
  it('exposes a stable validated ID collection and frozen current root arrays', () => {
    const model = scene();
    const layer = model.layers[0]!;
    const ids = layer.objectIds;
    const roots = layer.objects;
    expect(Reflect.set(layer, 'objectIds', new Set())).toBe(false);
    expect(() => (roots as MapEntry[]).push(roots[0]!)).toThrow(TypeError);
    expect(ids.add('shared')).toBe(false);
    expect(ids.remove('absent')).toBe(false);
    expect(layer.objects).toBe(roots);
    expect(() => ids.add(' ')).toThrow(
      expect.objectContaining({ code: 'INVALID_LAYER_OBJECT_ID' }),
    );
    expect(() => ids.remove(roots[0] as unknown as string)).toThrow();
    expect(ids.remove('shared')).toBe(true);
    expect(ids.has('shared')).toBe(false);
    expect(layer.objects).toEqual([model.objects.get('other')]);
    expect(model.objects.size).toBe(2);
    expect(layer.objectIds).toBe(ids);
    expect(roots).toHaveLength(2);
  });

  it('permits absent runtime IDs and automatically includes all new matching instances', () => {
    const model = scene();
    const layer = model.layers[0]!;
    expect(layer.objectIds.add('future')).toBe(true);
    const first = model.objects.add(pointDefinition(10, 10, 'future'));
    const second = model.objects.add(pointDefinition(20, 20, 'future'));
    expect(layer.objects.slice(-2)).toEqual([first, second]);
    expect(layer.objectIds.remove('future')).toBe(true);
    expect(layer.objects).not.toContain(first);
    expect(layer.objects).not.toContain(second);
    expect(model.objects.get('future')).toBe(first);
    const unassigned = model.objects.add(pointDefinition(100, 100, 'unassigned'));
    expect(model.geometry.objects.some(entry => entry.object === unassigned)).toBe(false);
  });

  it('shares runtime and geometry identity, and excludes hidden layers immediately', () => {
    const model = scene();
    const [lower, upper] = model.layers;
    const root = model.objects.get('shared') as MapPoint;
    const appearances = model.geometry.objects.filter(entry => entry.object === root);
    expect(appearances).toHaveLength(2);
    expect(appearances[0]!.geometry).toBe(appearances[1]!.geometry);
    expect(lower!.objects[0]).toBe(root);
    expect(upper!.objects[0]).toBe(root);
    expect(model.spatial.hitTest(root.position, camera())?.layer).toBe(upper);
    upper!.visible = false;
    expect(model.spatial.hitTest(root.position, camera())?.layer).toBe(lower);
    lower!.visible = false;
    expect(model.spatial.hitTest(root.position, camera())).toBeUndefined();
    root.position = new Point(90, 80);
    upper!.visible = true;
    expect(model.spatial.hitTest(root.position, camera())?.object).toBe(root);
    expect(() => {
      upper!.visible = 1 as unknown as boolean;
    }).toThrow();
  });

  it('uses negative stack indices and declaration order for equal indices', () => {
    const model = new MapModel(
      resolveMapDefinition({
        objects: [pointDefinition(40, 30, 'shared')],
        layers: [
          { id: 'equal-first', stackIndex: 2, objects: ['shared'] },
          { id: 'negative', stackIndex: -10, objects: ['shared'] },
          { id: 'zero', objects: ['shared'] },
          { id: 'equal-last', stackIndex: 2, objects: ['shared'] },
        ],
      }),
    );
    expect(model.geometry.layers.map(layer => layer.id)).toEqual([
      'negative',
      'zero',
      'equal-first',
      'equal-last',
    ]);

    for (const id of ['equal-last', 'equal-first', 'zero', 'negative']) {
      expect(model.spatial.hitTest(new Point(40, 30), camera())?.layer.id).toBe(id);
      model.layers.find(layer => layer.id === id)!.visible = false;
    }
  });

  it('resolves membership before synchronous callbacks and without connected observation', () => {
    const model = scene();
    const layer = model.layers[1]!;
    const point = model.objects.get('shared') as MapPoint;
    const hits: Array<ReturnType<MapModel['spatial']['hitTest']>> = [];
    const callback = vi.fn(() => {
      hits.push(model.spatial.hitTest(point.position, camera()));

      return layer.objects;
    });
    layer.addEventListener('change', callback);
    layer.objectIds.remove(point.id);
    expect(callback).toHaveLastReturnedWith([]);
    layer.objectIds.add(point.id);
    expect(hits.at(-1)?.layer).toBe(layer);
    layer.visible = false;
    expect(hits.at(-1)?.layer).toBe(model.layers[0]);
    model.objects.remove(point);
    expect(layer.objects).toEqual([]);
    expect(model.spatial.hitTest(point.position, camera())).toBeUndefined();
    point.position = new Point(90, 80);
    model.objects.add(point);
    layer.visible = true;
    expect(layer.objects[0]).toBe(point);
    expect(model.spatial.hitTest(point.position, camera())?.layer).toBe(layer);
  });

  it('keeps composition and root arrays stable on point edits, camera changes, and hide/show', () => {
    const model = scene();
    const entries = model.geometry.objects;
    const roots = model.layers[0]!.objects;
    const iterator = vi.spyOn(model.objects, Symbol.iterator);
    const view = camera();
    const point = model.objects.get('shared') as MapPoint;
    model.geometry.takeChanges();
    point.position = new Point(90, 80);
    expect(model.geometry.takeChanges().size).toBe(2);

    for (let index = 0; index < 10; index++) {
      view.center = new Point(160 + index, 120);
      model.layers[1]!.visible = index % 2 === 0;
      model.spatial.hitTest(point.position, view);
      expect(model.geometry.objects).toBe(entries);
      expect(model.layers[0]!.objects).toBe(roots);
    }

    expect(iterator).not.toHaveBeenCalled();
  });

  it('releases and restores layer subscriptions across observation cycles', () => {
    const model = scene();
    const changed = vi.fn();
    model.addEventListener('change', changed);
    model.observeChanges();
    model.observeChanges();
    model.layers[0]!.visible = false;
    expect(changed).toHaveBeenCalledOnce();
    model.unobserveChanges();
    model.layers[0]!.objectIds.remove('shared');
    model.layers[0]!.visible = true;
    expect(changed).toHaveBeenCalledOnce();
    model.observeChanges();
    model.layers[0]!.objectIds.add('shared');
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
