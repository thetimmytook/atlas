import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Rect } from '#math/rect.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { background, expectLine, expectPoint, expectPolyline, svgGroups } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapSurfaceEvent } from '#interaction/map-surface-event.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';

const ELEMENT_NAME = 'atlas-intersection-regression';
const FLOOR = { min: { z: 0 }, max: { z: 3 } };
const maps: MapElement[] = [];
customElements.define(ELEMENT_NAME, MapElement);
afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

function point(x: number, y: number, z: number, id: string): MapPointDefinition {
  return { kind: 'point', id, position: new Point3(x, y, z) };
}

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function floors(): MapDefinition {
  return {
    objects: [
      {
        id: 'route',
        kind: 'route',
        points: [point(20, 100, 1, 'a'), point(120, 100, 5, 'b'), point(220, 100, 1, 'c')],
      },
      point(280, 200, 3, 'boundary'),
    ],
    layers: [
      { id: 'background', stackIndex: -1, background },
      { id: 'lower', intersectionBounds: FLOOR },
      { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
    ],
  };
}

async function createMap(
  data = floors(),
): Promise<{ map: MapElement; surface: SVGSVGElement; spatial: Spatial }> {
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

function groups(surface: SVGSVGElement, layer: string, id: string): SVGGElement[] {
  return Array.from(
    surface.querySelectorAll<SVGGElement>(`[data-layer-id="${layer}"] > [data-object-id="${id}"]`),
  );
}

function events(map: MapElement): ObjectClickEvent[] {
  const result: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => result.push(event as ObjectClickEvent));

  return result;
}

async function click(surface: SVGSVGElement, x: number, y: number): Promise<void> {
  await userEvent.click(surface, { position: { x, y } });
}

function mutations(surface: SVGSVGElement): () => MutationRecord[] {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver(batch => records.push(...batch));
  observer.observe(surface, { attributes: true, childList: true, subtree: true });

  return () => {
    records.push(...observer.takeRecords());
    observer.disconnect();

    return records;
  };
}

describe('automatic fragments in real SVG and native picking', () => {
  it('creates initially excluded root appearances and removes them after hidden edits', async () => {
    const { map, surface, spatial } = await createMap({
      objects: [
        point(80, 60, 9, 'point'),
        { id: 'line', kind: 'line', points: [point(20, 150, 9, 'la'), point(220, 150, 9, 'lb')] },
        { id: 'route', kind: 'route', points: [point(20, 200, 9, 'ra'), point(220, 200, 9, 'rb')] },
      ],
      layers: [{ id: 'lower', intersectionBounds: FLOOR }],
    });
    expect(svgGroups(surface)).toHaveLength(0);
    const rootPoint = map.objects.get('point') as MapPoint;
    const line = map.objects.get('line')!;
    const route = map.objects.get('route') as MapRoute;

    if (line.kind !== 'line') {
      throw new Error('Expected line.');
    }

    rootPoint.position = new Point3(80, 60, 1);
    line.points[0].position = new Point3(20, 150, 1);
    route.points[0]!.position = new Point3(20, 200, 1);
    expect(spatial.hitTest(rootPoint.position, map.camera)?.object).toBe(rootPoint);
    expect(spatial.hitTest(new Point2(40, 150), map.camera)?.object).toBe(line);
    await paint();
    expect(svgGroups(surface)).toHaveLength(4);
    expectLine(groups(surface, 'lower', 'line')[0]!, [20, 150, 70, 150]);
    const hits = events(map);
    await click(surface, 80, 60);
    expect(hits.at(-1)!.detail.object).toBe(rootPoint);
    map.layers[0]!.visible = false;
    rootPoint.position = new Point3(80, 60, 9);
    line.points[0].position = new Point3(20, 150, 9);
    route.points[0]!.position = new Point3(20, 200, 9);
    expect(spatial.hitTest(new Point2(40, 150), map.camera)).toBeUndefined();
    await paint();
    map.layers[0]!.visible = true;
    await paint();
    expect(svgGroups(surface)).toHaveLength(0);
  });

  it('renders separate directed route fragments and only eligible original symbols', async () => {
    const { map, surface, spatial } = await createMap();
    const route = map.objects.get('route') as MapRoute;
    const points = route.points;
    const lower = groups(surface, 'lower', 'route');
    expect(lower).toHaveLength(2);
    expectPolyline(lower[0]!, '20,100 70,100');
    expectPolyline(lower[1]!, '170,100 220,100');
    expectPolyline(groups(surface, 'upper', 'route')[0]!, '70,100 120,100 170,100');
    expect(groups(surface, 'lower', 'b')).toHaveLength(0);
    expect(groups(surface, 'upper', 'a')).toHaveLength(0);
    expect(surface.querySelectorAll('circle')).toHaveLength(4);
    expect(map.objects.size).toBe(2);
    expect(route.points).toBe(points);
    expect(map.layers[1]!.objects).toEqual([]);
    expect(map.layers[2]!.objects).toEqual([]);
    const hits = events(map);
    const surfaceEvents: MapSurfaceEvent[] = [];
    map.addEventListener('press', event => surfaceEvents.push(event as MapSurfaceEvent));
    map.addEventListener('release', event => surfaceEvents.push(event as MapSurfaceEvent));
    await click(surface, 70, 100);
    expect(hits.at(-1)!.detail).toMatchObject({ object: route, layer: map.layers[2] });
    map.layers[2]!.visible = false;
    await click(surface, 70, 100);
    expect(hits.at(-1)!.detail).toMatchObject({ object: route, layer: map.layers[1] });
    map.layers[2]!.visible = true;
    await click(surface, 45, 100);
    expect(hits.at(-1)!.detail).toMatchObject({ object: route, layer: map.layers[1] });
    await click(surface, 120, 100);
    expect(hits.at(-1)!.detail).toMatchObject({
      object: route.points[1],
      route,
      layer: map.layers[2],
    });
    expect(hits.at(-1)!.detail.mapPoint).toBeInstanceOf(Point2);
    expect(hits.at(-1)!.detail.clientPoint).toBeInstanceOf(Point2);
    expect(Object.hasOwn(hits.at(-1)!.detail.mapPoint, 'z')).toBe(false);
    expect(Object.hasOwn(hits.at(-1)!.detail.clientPoint, 'z')).toBe(false);
    expect(surfaceEvents.map(event => event.type)).toContain('press');
    expect(surfaceEvents.map(event => event.type)).toContain('release');

    for (const event of surfaceEvents) {
      expect(event.detail.mapPoint).toBeInstanceOf(Point2);
      expect(event.detail.clientPoint).toBeInstanceOf(Point2);
    }

    const client = map.coordinates.mapToClient(route.points[1]!.position);
    expect(client).toBeInstanceOf(Point2);
    expect(Object.hasOwn(client, 'z')).toBe(false);
    const planar = map.coordinates.clientToMap(client);
    expect(planar).toBeInstanceOf(Point2);
    expect(planar.x).toBeCloseTo(120);
    expect(planar.y).toBeCloseTo(100);
    expect(Object.hasOwn(planar, 'z')).toBe(false);
    expect(spatial.hitTest(new Point2(45, 100), map.camera)?.object).toBe(route);
    await click(surface, 280, 200);
    expect(hits.at(-1)!.detail).toMatchObject({
      object: map.objects.get('boundary'),
      layer: map.layers[2],
    });
    expect(groups(surface, 'lower', 'boundary')).toHaveLength(0);
  });

  it('picks near min/max with finite stroke, including neighboring floors and vertical transitions', async () => {
    const data: MapDefinition = {
      objects: [
        { id: 'line', kind: 'line', points: [point(0, 100, 0, 'a'), point(200, 100, 0, 'b')] },
      ],
      layers: [{ id: 'lower', intersectionBounds: { min: { x: 50 }, max: { x: 150 } } }],
    };
    const { map, surface, spatial } = await createMap(data);
    expectLine(groups(surface, 'lower', 'line')[0]!, [50, 100, 150, 100]);
    const hits = events(map);

    for (const x of [48, 49, 50, 150, 151]) {
      await click(surface, x, 100);
      expect(hits.at(-1)!.detail.object.id).toBe('line');
      expect(spatial.hitTest(new Point2(x, 100), map.camera)?.object.id).toBe('line');
    }

    const count = hits.length;
    await click(surface, 152, 100);
    expect(hits).toHaveLength(count);
    await click(surface, 150, 101);
    expect(hits).toHaveLength(count + 1);
    await click(surface, 150, 102);
    expect(hits).toHaveLength(count + 1);
    await click(surface, 50, 102);
    expect(hits).toHaveLength(count + 2);
    await map.load({
      objects: [
        {
          id: 'vertical',
          kind: 'line',
          points: [point(100, 100, -1, 'a'), point(100, 100, 7, 'b')],
        },
      ],
      layers: floors().layers,
    });
    await paint();
    expectLine(groups(surface, 'lower', 'vertical')[0]!, [100, 100, 100, 100]);
    expectLine(groups(surface, 'upper', 'vertical')[0]!, [100, 100, 100, 100]);
    await click(surface, 100, 101);
    expect(hits.at(-1)!.detail.layer.id).toBe('upper');
    map.layers[2]!.visible = false;
    await click(surface, 100, 101);
    expect(hits.at(-1)!.detail.layer.id).toBe('lower');
  });

  it('preserves root order, distinct duplicate-ID instances and full direct priority', async () => {
    const { map, surface, spatial } = await createMap({
      objects: [point(80, 60, 1, 'same'), point(80, 60, 5, 'same'), point(80, 60, 1, 'last')],
      layers: [{ id: 'lower', intersectionBounds: FLOOR, objects: ['same'] }],
    });
    const roots = [...map.objects];
    expect(svgGroups(surface).map(group => group.dataset.objectId)).toEqual([
      'same',
      'same',
      'last',
    ]);
    expect(spatial.hitTest(new Point2(80, 60), map.camera)?.object).toBe(roots[2]);
    map.objects.remove(roots[2]!);
    const hits = events(map);
    await click(surface, 80, 60);
    expect(hits.at(-1)!.detail.object).toBe(roots[1]);
    map.layers[0]!.objectIds.remove('same');
    await click(surface, 80, 60);
    expect(hits.at(-1)!.detail.object).toBe(roots[0]);
    await paint();
    expect(groups(surface, 'lower', 'same')).toHaveLength(1);
  });

  it('updates height before RAF, retains surviving paths and leaves unrelated SVG nodes untouched', async () => {
    const { map, surface, spatial } = await createMap();
    const route = map.objects.get('route') as MapRoute;
    const nodes = svgGroups(surface);
    const lower = groups(surface, 'lower', 'route');
    const upper = groups(surface, 'upper', 'route')[0]!;
    const boundary = groups(surface, 'upper', 'boundary')[0]!;
    const image = surface.querySelector('image');
    const finish = mutations(surface);
    route.points[1]!.position = new Point3(120, 100, 9);
    expect(spatial.hitTest(new Point2(80, 100), map.camera)?.object).toBe(route);
    expect(spatial.hitTest(new Point2(120, 100), map.camera)).toBeUndefined();
    await paint();
    expect(groups(surface, 'lower', 'route')).toEqual(lower);
    expect(groups(surface, 'upper', 'route')[0]).toBe(upper);
    expectPolyline(lower[0]!, '20,100 45,100');
    expectPolyline(lower[1]!, '195,100 220,100');
    const changes = finish();
    expect(
      changes.filter(change => change.type === 'attributes' && change.attributeName === 'points'),
    ).toHaveLength(4);
    expect(
      changes.some(change => boundary.contains(change.target) || image?.contains(change.target)),
    ).toBe(false);
    expect(groups(surface, 'upper', 'b')).toHaveLength(0);
    nodes
      .filter(node => node.dataset.objectId !== 'b')
      .forEach(node => expect(node.isConnected).toBe(true));
  });

  it('writes only viewBox on pan and only visibility on hide/show, preserving geometry and background', async () => {
    const { map, surface } = await createMap();
    const nodes = Array.from(surface.querySelectorAll('*'));
    const finishPan = mutations(surface);
    map.camera.center = new Point2(170, 120);
    await paint();
    const pan = finishPan();
    expect(pan).toHaveLength(1);
    expect(pan[0]!.target).toBe(surface);
    expect(pan[0]!.attributeName).toBe('viewBox');
    const center = map.camera.center;
    const finishVisibility = mutations(surface);
    map.layers[1]!.visible = false;
    await paint();
    map.layers[1]!.visible = true;
    await paint();
    const visibility = finishVisibility();
    expect(visibility).toHaveLength(2);
    expect(visibility.every(change => change.attributeName === 'display')).toBe(true);
    expect(Array.from(surface.querySelectorAll('*'))).toEqual(nodes);
    expect(map.camera.center).toBe(center);
  });

  it('paints hidden/disconnected edits and remove/query/edit/reattach while retaining surviving nodes', async () => {
    const { map, surface, spatial } = await createMap();
    const route = map.objects.get('route') as MapRoute;
    const lower = groups(surface, 'lower', 'route')[0]!;
    map.layers[1]!.visible = false;
    map.remove();
    route.points[1]!.position = new Point3(120, 100, 9);
    expect(spatial.hitTest(new Point2(120, 100), map.camera)).toBeUndefined();
    document.body.append(map);
    map.layers[1]!.visible = true;
    await paint();
    expectPolyline(lower, '20,100 45,100');
    map.objects.remove(route);
    expect(spatial.hitTest(new Point2(30, 100), map.camera)).toBeUndefined();
    route.points[1]!.position = new Point3(120, 100, 5);
    map.objects.add(route);
    expect(spatial.hitTest(new Point2(45, 100), map.camera)?.object).toBe(route);
    await paint();
    expect(groups(surface, 'lower', 'route')[0]).toBe(lower);
    expectPolyline(lower, '20,100 70,100');
  });

  it.each(['press', 'release'] as const)(
    'suppresses stale automatic clicks after synchronous %s edits, without fallback',
    async trigger => {
      const { map, surface } = await createMap();
      const hits = events(map);
      map.clickTrigger = trigger;
      const route = map.objects.get('route') as MapRoute;
      const underneath = map.objects.add(point(120, 100, 1, 'underneath'));
      map.addEventListener(
        trigger,
        () => {
          route.points.forEach(vertex => {
            vertex.position = new Point3(vertex.position.x, vertex.position.y, 9);
          });
        },
        { once: true },
      );
      await click(surface, 120, 100);
      expect(hits).toHaveLength(0);
      const spatial = new Spatial(prepareSceneGeometry(map.objects, map.layers));
      expect(spatial.hitTest(new Point2(120, 100), map.camera)?.object).toBe(underneath);
      expect(surface.querySelector('image')).not.toBeNull();
    },
  );

  it('suppresses a captured fragment moved away while preserving the same fragment entry', async () => {
    const { map, surface } = await createMap();
    map.layers[2]!.visible = false;
    const hits = events(map);
    const route = map.objects.get('route') as MapRoute;
    map.addEventListener(
      'release',
      () => {
        route.points[1]!.position = new Point3(120, 100, 21);
      },
      { once: true },
    );
    await click(surface, 60, 100);
    expect(hits).toHaveLength(0);
  });

  it('preserves the whole active map after invalid bounds, and snapshots bounds before async preparation', async () => {
    const { map, surface } = await createMap();
    const oldDefinition = map.definition;
    const oldLayers = map.layers;
    const oldObjects = map.objects;
    const nodes = Array.from(surface.querySelectorAll('*'));
    const center = map.camera.center;
    await expect(
      map.load({ layers: [{ intersectionBounds: { min: { z: 3 }, max: { z: 3 } } }] }),
    ).rejects.toMatchObject({ code: 'INVALID_INTERSECTION_BOUNDS' });
    expect(map.definition).toBe(oldDefinition);
    expect(map.layers).toBe(oldLayers);
    expect(map.objects).toBe(oldObjects);
    expect(map.camera.center).toBe(center);
    expect(Array.from(surface.querySelectorAll('*'))).toEqual(nodes);
    const hits = events(map);
    await click(surface, 120, 100);
    expect(hits.at(-1)!.detail.route).toBe(oldObjects.get('route'));
    const bounds = { min: { z: 0 }, max: { z: 3 } };
    const data = {
      objects: [point(80, 60, 1, 'point')],
      layers: [{ background, intersectionBounds: bounds }],
    };
    const loading = map.load(data);
    bounds.max.z = 0;
    await loading;
    await paint();
    expect(map.layers[0]!.intersectionBounds!.max!.z).toBe(3);
    expectPoint(svgGroups(surface)[0]!, 80, 60);
    const root = map.objects.get('point') as MapPoint;
    root.position = new Point3(80, 60, 2);
    expect((map.definition!.objects[0] as MapPointDefinition).position).toEqual(
      new Point3(80, 60, 1),
    );
  });
});
