import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Rect } from '#math/rect.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { expectPolyline, svgGroups } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapRoute } from '#objects/map-route.js';

const ELEMENT_NAME = 'atlas-route-topology-regression';
const maps: MapElement[] = [];
customElements.define(ELEMENT_NAME, MapElement);
afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

function point(id: string, x: number, y = 100, z = 1): MapPointDefinition {
  return { kind: 'point', id, position: { x, y, z } };
}

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function createMap(
  remove = false,
): Promise<{ map: MapElement; surface: SVGSVGElement; route: MapRoute; spatial: Spatial }> {
  const unrelated = Array.from(
    { length: 60 },
    (_, index): NonNullable<MapDefinition['objects']>[number] => {
      const id = `other-${index}`;
      const x = 400 + index * 10;

      return {
        id,
        kind: index % 2 ? 'route' : 'line',
        points: [point(`${id}-a`, x), point(`${id}-b`, x + 5, 110, 5)],
      };
    },
  );
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  maps.push(map);
  document.body.append(map);
  await map.load({
    objects: [
      ...unrelated,
      {
        id: 'route',
        kind: 'route',
        points: [
          point('a', 20),
          point('b', 120, remove ? 160 : 100, remove ? 5 : 1),
          point('c', 220),
        ],
      },
    ],
    layers: [
      {
        id: 'direct',
        stackIndex: -1,
        objects: ['route'],
        intersectionBounds: { min: { z: 3 }, max: { z: 6 } },
      },
      { id: 'lower', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
      { id: 'upper', stackIndex: 1, intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
    ],
  });
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();
  const surface = map.shadowRoot!.querySelector('svg')!;
  const route = map.objects.get('route') as MapRoute;

  return {
    map,
    surface,
    route,
    spatial: new Spatial(prepareSceneGeometry(map.objects, map.layers)),
  };
}

function routeGroups(surface: SVGSVGElement, layer: string): SVGGElement[] {
  return Array.from(
    surface.querySelectorAll<SVGGElement>(`[data-layer-id="${layer}"] > [data-object-id="route"]`),
  );
}

function captureMutations(surface: SVGSVGElement): () => MutationRecord[] {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver(batch => records.push(...batch));
  observer.observe(surface, { attributes: true, childList: true, subtree: true });

  return () => {
    records.push(...observer.takeRecords());
    observer.disconnect();

    return records;
  };
}

describe('route topology in native SVG', () => {
  it.each(['add', 'insert', 'remove', 'replace'] as const)(
    'keeps unrelated automatic geometry and surviving nodes intact on %s',
    async operation => {
      const { map, surface, route, spatial } = await createMap(operation === 'remove');
      const original = svgGroups(surface);
      const shapes = new Map(original.map(group => [group, group.firstElementChild]));
      const unaffected = original.filter(
        group => !['route', 'a', 'b', 'c'].includes(group.dataset.objectId!),
      );
      const oldMiddle = route.points[1]!;
      const originalPaths = ['direct', 'lower'].map(layer => routeGroups(surface, layer)[0]!);
      const reads = Array.from(map.objects)
        .filter(root => root !== route)
        .flatMap(root => {
          if (root.kind !== 'route' && root.kind !== 'line') {
            throw new Error('Expected an unrelated line or route.');
          }

          return root.points.map(vertex => vi.spyOn(vertex, 'position', 'get'));
        });
      const finish = captureMutations(surface);
      let target = oldMiddle;

      switch (operation) {
        case 'add':
          target = route.addPoint(point('d', 300, 160, 5));
          break;
        case 'insert':
          target = route.insertPoint(1, point('d', 70, 160, 5));
          break;
        case 'remove':
          route.removePoint(target);
          break;
        case 'replace':
          target = route.replacePoints(1, 2, [point('d', 120, 160, 5)])[0]!;
          break;
      }

      await paint();
      const mutations = finish();
      reads.forEach(read => expect(read).not.toHaveBeenCalled());
      expect(mutations.filter(record => record.type === 'attributes').length).toBeGreaterThan(0);
      expect(
        mutations.some(record =>
          unaffected.some(group => group === record.target || group.contains(record.target)),
        ),
      ).toBe(false);
      unaffected.forEach(group => {
        expect(group.isConnected).toBe(true);
        expect(group.firstElementChild).toBe(shapes.get(group));
      });
      const survivingIds =
        operation === 'add' || operation === 'insert' ? ['a', 'b', 'c'] : ['a', 'c'];
      original
        .filter(group => survivingIds.includes(group.dataset.objectId!))
        .forEach(group => {
          expect(group.isConnected).toBe(true);
          expect(group.firstElementChild).toBe(shapes.get(group));
        });
      originalPaths.forEach(group => {
        expect(group.isConnected).toBe(true);
        expect(group.firstElementChild).toBe(shapes.get(group));
      });

      const expected = {
        add: {
          direct: ['20,100 120,100 220,100 300,160'],
          lower: ['20,100 120,100 220,100 260,130'],
          upper: ['260,130 300,160'],
        },
        insert: {
          direct: ['20,100 70,160 120,100 220,100'],
          lower: ['20,100 45,130', '95,130 120,100 220,100'],
          upper: ['45,130 70,160 95,130'],
        },
        remove: { direct: ['20,100 220,100'], lower: ['20,100 220,100'], upper: [] },
        replace: {
          direct: ['20,100 120,160 220,100'],
          lower: ['20,100 70,130', '170,130 220,100'],
          upper: ['70,130 120,160 170,130'],
        },
      }[operation];

      for (const layer of ['direct', 'lower', 'upper'] as const) {
        const groups = routeGroups(surface, layer);
        expect(groups).toHaveLength(expected[layer].length);
        groups.forEach((group, index) => expectPolyline(group, expected[layer][index]!));
      }

      if (operation === 'remove' || operation === 'replace') {
        original
          .filter(group => group.dataset.objectId === 'b')
          .forEach(group => expect(group.isConnected).toBe(false));
      }

      const clicks: ObjectClickEvent[] = [];
      map.addEventListener('objectclick', event => clicks.push(event as ObjectClickEvent));
      const position = operation === 'remove' ? new Point2(120, 100) : target.position;
      expect(spatial.hitTest(position, map.camera)?.object).toBe(
        operation === 'remove' ? route : target,
      );
      await userEvent.click(surface, { position: { x: position.x, y: position.y } });
      expect(clicks).toHaveLength(1);
      expect(clicks[0]!.detail.object).toBe(operation === 'remove' ? route : target);
      expect(clicks[0]!.detail.layer.id).toBe(operation === 'remove' ? 'lower' : 'upper');
    },
  );

  it('keeps synchronous and disconnected picking current through consecutive edits and reattachment', async () => {
    const { map, surface, route, spatial } = await createMap();
    const lower = routeGroups(surface, 'lower')[0]!;
    const direct = routeGroups(surface, 'direct')[0]!;
    const a = svgGroups(surface).filter(group => group.dataset.objectId === 'a');
    const hits: unknown[] = [];
    const listener = vi.fn(() => {
      const vertex = route.points[1]!;
      hits.push(spatial.hitTest(vertex.position, map.camera)?.object);
      vertex.position = new Point3(70, 180, 5);
      hits.push(spatial.hitTest(vertex.position, map.camera)?.object);
    });
    route.addEventListener('change', listener, { once: true });
    const inserted = route.insertPoint(1, point('d', 70, 160, 5));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(hits).toEqual([inserted, inserted]);
    map.remove();
    const removed = route.points[2]!;
    route.removePoint(removed);
    const transient = route.addPoint(point('transient', 300, 200, 5));
    route.removePoint(transient);
    inserted.position = new Point3(70, 160, 5);
    expect(spatial.hitTest(inserted.position, map.camera)?.object).toBe(inserted);
    expect(spatial.hitTest(new Point2(120, 100), map.camera)).toBeUndefined();
    removed.position = new Point3(120, 200, 1);
    transient.position = new Point3(300, 200, 1);
    expect(spatial.hitTest(removed.position, map.camera)).toBeUndefined();
    map.objects.remove(route);
    expect(spatial.hitTest(inserted.position, map.camera)).toBeUndefined();
    route.replacePoints(1, 2, [point('replacement', 120, 160, 5)]);
    map.objects.add(route);
    expect(spatial.hitTest(new Point2(120, 160), map.camera)?.object).toBe(route.points[1]);
    document.body.append(map);
    await paint();
    expect(routeGroups(surface, 'lower')[0]).toBe(lower);
    expect(routeGroups(surface, 'direct')[0]).toBe(direct);
    a.forEach(group => expect(group.isConnected).toBe(true));
    expectPolyline(direct, '20,100 120,160 220,100');
    expectPolyline(lower, '20,100 70,130');
    const finish = captureMutations(surface);
    removed.position = new Point3(150, 200, 1);
    transient.position = new Point3(280, 200, 1);
    inserted.position = new Point3(80, 180, 5);
    await paint();
    expect(finish()).toEqual([]);
    route.points[1]!.position = new Point3(140, 180, 5);
    expect(spatial.hitTest(new Point2(140, 180), map.camera)?.object).toBe(route.points[1]);
    await paint();
    expectPolyline(direct, '20,100 140,180 220,100');
    expectPolyline(lower, '20,100 80,140');
  });
});
