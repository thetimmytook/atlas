import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';
import { MapPoint } from '#objects/map-point.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { background, expectPoint, expectPolyline, pointDefinition, svgGroups } from './fixtures.js';

import type { MapDefinition, MapEntryDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapRoute } from '#objects/map-route.js';

const ELEMENT_NAME = 'atlas-layer-regression-map';
const maps: MapElement[] = [];
customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function definition(): MapDefinition {
  return {
    objects: [
      pointDefinition(80, 60, 'shared'),
      {
        id: 'route',
        kind: 'route',
        points: [pointDefinition(50, 150, 'start'), pointDefinition(250, 150, 'end')],
      },
      pointDefinition(280, 200, 'other'),
    ],
    layers: [
      { id: 'background', stackIndex: -5, background },
      { id: 'lower', stackIndex: -1, objects: ['route', 'shared', 'other'] },
      { id: 'upper', objects: ['shared', 'route'] },
    ],
  };
}

async function createMap(data: MapDefinition = definition()): Promise<{
  map: MapElement;
  surface: SVGSVGElement;
  spatial: Spatial;
}> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  document.body.append(map);
  maps.push(map);
  await map.load(data);
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();
  const surface = map.shadowRoot!.querySelector('svg')!;

  return { map, surface, spatial: new Spatial(prepareSceneGeometry(map.objects, map.layers)) };
}

function group(surface: SVGSVGElement, layerId: string, objectId: string): SVGGElement {
  return surface.querySelector<SVGGElement>(
    `[data-layer-id="${layerId}"] > [data-object-id="${objectId}"]`,
  )!;
}

function clicks(map: MapElement): ObjectClickEvent[] {
  const events: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => events.push(event as ObjectClickEvent));

  return events;
}

async function click(surface: SVGSVGElement, x: number, y: number): Promise<void> {
  await userEvent.click(surface, { position: { x, y } });
}

function mutations(surface: SVGSVGElement): () => MutationRecord[] {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver(batch => records.push(...batch));
  observer.observe(surface, { subtree: true, attributes: true, childList: true });

  return (): MutationRecord[] => {
    records.push(...observer.takeRecords());
    observer.disconnect();

    return records;
  };
}

describe('layers in actual SVG and picking', () => {
  it('renders a background-free replacement after pending frames finish, preserving the camera', async () => {
    const { map, surface } = await createMap();
    map.camera.center = new Point2(150, 110);
    map.camera.zoom = 2;
    await paint();
    const center = map.camera.center;
    const zoom = map.camera.zoom;
    const viewBox = surface.getAttribute('viewBox');
    const cameraChanged = vi.fn();
    map.camera.addEventListener('change', cameraChanged);

    await map.load({
      objects: [pointDefinition(140, 100, 'replacement')],
      layers: [{ id: 'content', objects: ['replacement'] }],
    });
    await paint();

    expectPoint(group(surface, 'content', 'replacement'), 140, 100);
    expect(surface.querySelector('image')).toBeNull();
    expect(surface.getAttribute('viewBox')).toBe(viewBox);
    expect(map.camera.center).toBe(center);
    expect(map.camera.zoom).toBe(zoom);
    expect(cameraChanged).not.toHaveBeenCalled();
  });

  it('uses one order for negative, default and equal stack indices, with root order inside layers', async () => {
    const { map, surface, spatial } = await createMap({
      objects: [pointDefinition(80, 60, 'first'), pointDefinition(80, 60, 'last')],
      layers: [
        { id: 'equal-first', stackIndex: 2, objects: ['last', 'first'] },
        { id: 'negative', stackIndex: -3, objects: ['first'] },
        { id: 'zero', objects: ['first'] },
        { id: 'equal-last', stackIndex: 2, objects: ['first'] },
      ],
    });
    expect(Array.from(surface.children, node => node.getAttribute('data-layer-id'))).toEqual([
      'negative',
      'zero',
      'equal-first',
      'equal-last',
    ]);
    expect(
      Array.from(surface.children[2]!.children, node => node.getAttribute('data-object-id')),
    ).toEqual(['first', 'last']);
    const events = clicks(map);

    for (const [id, objectId] of [
      ['equal-last', 'first'],
      ['equal-first', 'last'],
      ['zero', 'first'],
      ['negative', 'first'],
    ]) {
      expect(spatial.hitTest(new Point2(80, 60), map.camera)?.layer.id).toBe(id);
      await click(surface, 80, 60);
      expect(events.at(-1)!.detail.layer.id).toBe(id);
      expect(events.at(-1)!.detail.object).toBe(map.objects.get(objectId!));
      map.layers.find(layer => layer.id === id)!.visible = false;
    }

    expect(spatial.hitTest(new Point2(80, 60), map.camera)).toBeUndefined();
  });

  it('picks all visible layers before RAF and returns the same shared object', async () => {
    const { map, surface } = await createMap();
    const upper = map.layers[2]!;
    const events = clicks(map);
    map.clickTrigger = 'press';
    surface.addEventListener(
      'pointerdown',
      () => {
        upper.visible = false;
        expect(surface.children[2]!.getAttribute('display')).toBeNull();
      },
      { capture: true, once: true },
    );
    await click(surface, 80, 60);
    expect(events[0]!.detail.layer).toBe(map.layers[1]);
    expect(events[0]!.detail.object).toBe(map.objects.get('shared'));
    upper.visible = true;
    await click(surface, 80, 60);
    expect(events[1]!.detail.object).toBe(events[0]!.detail.object);
    expect(events[1]!.detail.layer).toBe(upper);
  });

  it.each(['hide', 'remove ID'] as const)(
    'suppresses a stale objectclick after a synchronous surface handler: %s',
    async action => {
      const { map, surface } = await createMap();
      const events = clicks(map);
      const layer = map.layers[2]!;
      map.addEventListener(
        'release',
        () => {
          if (action === 'hide') {
            layer.visible = false;
          } else {
            layer.objectIds.remove('shared');
          }
        },
        { once: true },
      );
      await click(surface, 80, 60);
      expect(events).toHaveLength(0);
      await click(surface, 80, 60);
      expect(events[0]!.detail.layer).toBe(map.layers[1]);
    },
  );

  it('keeps route and vertex ownership across layer clicks and edits through event objects', async () => {
    const { map, surface } = await createMap();
    const events = clicks(map);
    await click(surface, 150, 150);
    const route = events[0]!.detail.object as MapRoute;
    expect(route).toBe(map.objects.get('route'));
    expect(events[0]!.detail.layer).toBe(map.layers[2]);
    expect(events[0]!.detail.route).toBeUndefined();
    route.points[0]!.position = new Point2(50, 170);
    await paint();

    for (const layerId of ['lower', 'upper']) {
      expectPolyline(group(surface, layerId, 'route'), '50,170 250,150');
      expectPoint(group(surface, layerId, 'start'), 50, 170);
    }

    await click(surface, 50, 170);
    expect(events[1]!.detail.object).toBe(route.points[0]);
    expect(events[1]!.detail.route).toBe(route);
    expect(events[1]!.detail.layer).toBe(map.layers[2]);
    map.layers[2]!.visible = false;
    await click(surface, 150, 160);
    expect(events[2]!.detail.object).toBe(route);
    expect(events[2]!.detail.layer).toBe(map.layers[1]);
  });

  it('updates only affected shared point and route appearances, preserves nodes, and writes no geometry on pan', async () => {
    const { map, surface } = await createMap();
    const nodes = svgGroups(surface);
    const shapes = nodes.map(node => node.firstElementChild);
    const collect = mutations(surface);
    (map.objects.get('shared') as MapPoint).position = new Point2(90, 80);
    await paint();
    const records = collect();
    expect(records.filter(record => record.type === 'attributes')).toHaveLength(2);
    expect(
      records.every(
        record =>
          record.attributeName === 'transform' &&
          (record.target as Element).getAttribute('data-object-id') === 'shared',
      ),
    ).toBe(true);
    expect(records.some(record => record.type === 'childList')).toBe(false);
    const routeCollect = mutations(surface);
    (map.objects.get('route') as MapRoute).points[0]!.position = new Point2(50, 170);
    await paint();
    const routeRecords = routeCollect();
    expect(routeRecords.filter(record => record.attributeName === 'points')).toHaveLength(2);
    expect(routeRecords.filter(record => record.attributeName === 'transform')).toHaveLength(2);
    expect(routeRecords).toHaveLength(4);
    nodes.forEach((node, index) => {
      expect(svgGroups(surface).at(index)).toBe(node);
      expect(node.firstElementChild).toBe(shapes.at(index));
    });
    const panCollect = mutations(surface);
    map.camera.center = new Point2(170, 120);
    await paint();
    const panRecords = panCollect();
    expect(panRecords).toHaveLength(1);
    expect(panRecords[0]!.target).toBe(surface);
    expect(panRecords[0]!.attributeName).toBe('viewBox');
  });

  it('shows current hidden geometry and toggles backgrounds without reloads, camera changes or extra nodes', async () => {
    const { map, surface, spatial } = await createMap();
    const decode = vi.spyOn(HTMLImageElement.prototype, 'decode');
    const nodes = Array.from(surface.querySelectorAll('*'));
    const center = map.camera.center;
    const zoom = map.camera.zoom;
    const point = map.objects.get('shared') as MapPoint;
    map.layers[1]!.visible = false;
    map.layers[2]!.visible = false;
    point.position = new Point2(90, 80);
    expect(spatial.hitTest(point.position, map.camera)).toBeUndefined();
    await paint();
    expectPoint(group(surface, 'upper', 'shared'), 90, 80);
    const visibilityCollect = mutations(surface);

    for (let index = 0; index < 4; index++) {
      map.layers.forEach(layer => {
        layer.visible = false;
      });
      await paint();
      expect(
        Array.from(surface.children).every(node => node.getAttribute('display') === 'none'),
      ).toBe(true);
      map.layers.forEach(layer => {
        layer.visible = true;
      });
      expect(spatial.hitTest(point.position, map.camera)?.layer).toBe(map.layers[2]);
      await paint();
    }

    expect(Array.from(surface.querySelectorAll('*'))).toEqual(nodes);
    const visibilityRecords = visibilityCollect();
    expect(visibilityRecords).toHaveLength(22);
    expect(visibilityRecords.every(record => record.attributeName === 'display')).toBe(true);
    expect(map.camera.center).toBe(center);
    expect(map.camera.zoom).toBe(zoom);
    expect(decode).not.toHaveBeenCalled();
  });

  it.each(['point', 'line', 'route'] as const)(
    'refreshes every returned %s after remove, synchronous picking and detached edits before RAF',
    async kind => {
      const points = [pointDefinition(40, 30, 'start'), pointDefinition(180, 60, 'end')];
      let root: MapEntryDefinition = pointDefinition(40, 30, 'returned');

      if (kind === 'line') {
        root = { id: 'returned', kind: 'line', points: [points[0]!, points[1]!] };
      }

      if (kind === 'route') {
        root = { id: 'returned', kind: 'route', points };
      }

      const { map, surface, spatial } = await createMap({
        objects: [root],
        layers: [
          { id: 'lower', background, objects: ['returned'] },
          { id: 'upper', objects: ['returned'] },
        ],
      });
      const instance = map.objects.get('returned')!;
      const oldGroups = svgGroups(surface);
      const point = instance.kind === 'point' ? instance : instance.points[0];
      const events = clicks(map);
      map.clickTrigger = 'press';

      // The actual component's picking reconciles removal after capture, before its press event.
      surface.addEventListener(
        'pointerdown',
        () => {
          map.objects.remove(instance);
          expect(spatial.hitTest(new Point2(40, 30), map.camera)).toBeUndefined();
          expect(map.layers[0]!.objects).toEqual([]);
        },
        { capture: true, once: true },
      );
      map.addEventListener(
        'press',
        () => {
          point.position = new Point2(90, 80);
          map.objects.add(instance);
        },
        { once: true },
      );
      await click(surface, 40, 30);
      expect(events).toHaveLength(0);
      expect(map.layers[0]!.objects[0]).toBe(instance);
      expect(spatial.hitTest(point.position, map.camera)?.layer).toBe(map.layers[1]);
      await paint();
      expect(svgGroups(surface)).toEqual(oldGroups);

      for (const layerId of ['lower', 'upper']) {
        if (kind === 'point') {
          expectPoint(group(surface, layerId, 'returned'), 90, 80);
        } else if (kind === 'route') {
          expectPolyline(group(surface, layerId, 'returned'), '90,80 180,60');
        } else {
          expect(
            group(surface, layerId, 'returned').querySelector('line')!.getAttribute('x1'),
          ).toBe('90');
        }
      }
    },
  );

  it('keeps membership and picking live while disconnected and reconnects without duplicate subscriptions', async () => {
    const { map, surface, spatial } = await createMap();
    const point = map.objects.get('shared') as MapPoint;
    const oldNodes = svgGroups(surface);
    const layer = map.layers[2]!;
    const subscribe = vi.spyOn(layer, 'addEventListener');
    const unsubscribe = vi.spyOn(layer, 'removeEventListener');
    const events = clicks(map);
    map.remove();
    point.position = new Point2(90, 80);
    layer.objectIds.remove('shared');
    expect(layer.objects).not.toContain(point);
    expect(spatial.hitTest(point.position, map.camera)?.layer).toBe(map.layers[1]);
    layer.objectIds.add('shared');
    layer.visible = false;
    expect(group(surface, 'upper', 'shared').getAttribute('transform')).toBe('translate(80 60)');
    document.body.append(map);
    await paint();
    expect(svgGroups(surface)).toEqual(oldNodes);
    expectPoint(group(surface, 'upper', 'shared'), 90, 80);

    for (let index = 0; index < 3; index++) {
      map.remove();
      layer.visible = true;
      document.body.append(map);
      await paint();
      await click(surface, 90, 80);
    }

    expect(events).toHaveLength(3);
    expect(subscribe).toHaveBeenCalledTimes(4);
    expect(unsubscribe).toHaveBeenCalledTimes(4);
  });

  it('resolves live ID additions/removals immediately and keeps matching duplicate roots distinct', async () => {
    const { map, surface, spatial } = await createMap();
    const layer = map.layers[2]!;
    const first = map.objects.add(pointDefinition(110, 80, 'new'));
    expect(spatial.hitTest(first.position, map.camera)).toBeUndefined();
    layer.objectIds.add('new');
    const second = map.objects.add(pointDefinition(140, 80, 'new'));
    expect(layer.objects.slice(-2)).toEqual([first, second]);
    expect(spatial.hitTest(second.position, map.camera)?.object).toBe(second);
    await paint();
    expect(surface.querySelectorAll('[data-object-id="new"]')).toHaveLength(2);
    layer.objectIds.remove('new');
    expect(spatial.hitTest(first.position, map.camera)).toBeUndefined();
    expect(spatial.hitTest(second.position, map.camera)).toBeUndefined();
    expect(map.objects.get('new')).toBe(first);
    await paint();
    expect(surface.querySelectorAll('[data-object-id="new"]')).toHaveLength(0);
  });

  it.each(['background failure', 'unknown reference', 'intersection bounds'] as const)(
    'keeps the previous map, camera, SVG and clicks after %s',
    async failure => {
      const { map, surface } = await createMap();
      map.camera.center = new Point2(140, 100);
      map.camera.zoom = 2;
      await paint();
      const oldDefinition = map.definition;
      const layers = map.layers;
      const objects = map.objects;
      const nodes = Array.from(surface.querySelectorAll('*'));
      const center = map.camera.center;
      const viewBox = surface.getAttribute('viewBox');
      const events = clicks(map);
      let candidate: MapDefinition;
      let code: string;

      if (failure === 'background failure') {
        code = 'BACKGROUND_LOAD_FAILED';
        candidate = {
          objects: [pointDefinition(80, 60, 'new')],
          layers: [
            { id: 'good', background, objects: ['new'] },
            { id: 'bad', background: { ...background, source: 'data:image/png;base64,AAAA' } },
          ],
        };
      } else if (failure === 'unknown reference') {
        code = 'UNKNOWN_LAYER_OBJECT';
        candidate = { layers: [{ objects: ['missing'] }] };
      } else {
        code = 'INVALID_INTERSECTION_BOUNDS';
        candidate = {
          layers: [{ intersectionBounds: { min: { z: 3 }, max: { z: 0 } } }],
        };
      }

      const decode = vi.spyOn(HTMLImageElement.prototype, 'decode');
      await expect(map.load(candidate)).rejects.toMatchObject({ code });

      if (failure !== 'background failure') {
        expect(decode).not.toHaveBeenCalled();
      }

      expect(map.definition).toBe(oldDefinition);
      expect(map.layers).toBe(layers);
      expect(map.objects).toBe(objects);
      expect(map.camera.center).toBe(center);
      expect(map.camera.zoom).toBe(2);
      expect(Array.from(surface.querySelectorAll('*'))).toEqual(nodes);
      expect(surface.getAttribute('viewBox')).toBe(viewBox);
      const client = map.coordinates.mapToClient(new Point2(80, 60));
      const bounds = surface.getBoundingClientRect();
      await click(surface, client.x - bounds.left, client.y - bounds.top);
      expect(events[0]!.detail.object).toBe(objects.get('shared'));
      expect(events[0]!.detail.layer).toBe(layers[2]);
    },
  );

  it('fits all backgrounds including hidden layers and preserves the camera without backgrounds', async () => {
    const { map } = await createMap({
      layers: [
        { background: { ...background, size: { width: 100, height: 600 } } },
        { background: { ...background, size: { width: 800, height: 200 } } },
      ],
    });
    map.layers[1]!.visible = false;
    map.fit();
    expect(map.camera.center).toEqual(new Point2(400, 300));
    expect(map.camera.zoom).toBeCloseTo(0.4);
    const center = map.camera.center;
    await map.load({ layers: [] });
    map.fit();
    expect(map.camera.center).toBe(center);
    expect(map.camera.zoom).toBeCloseTo(0.4);
  });
});
