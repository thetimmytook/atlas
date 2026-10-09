import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { AtlasError } from '#errors/atlas-error.js';
import { Point2 } from '#math/point2.js';
import { MapPoint } from '#objects/map-point.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import {
  expectGroups,
  expectPoint,
  mapDefinition,
  pointDefinition,
  svgGroups,
} from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';

const ELEMENT_NAME = 'atlas-batch-regression';
const POINT_SELECTOR = '[data-object-id="point"]';
const maps: MapElement[] = [];

// Test waits use native RAF without inflating the component scheduling counter.
const requestFrame = window.requestAnimationFrame.bind(window);
customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

async function paint(): Promise<void> {
  await new Promise<void>(resolve => requestFrame(() => requestFrame(() => resolve())));
}

async function createMap(
  definition: MapDefinition = mapDefinition([
    pointDefinition(40, 30, 'point'),
    pointDefinition(250, 200, 'other'),
  ]),
): Promise<{ map: MapElement; surface: SVGSVGElement; point: MapPoint; spatial: Spatial }> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  maps.push(map);
  document.body.append(map);
  await map.load(definition);
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  await expect.poll(() => map.camera.viewport.height).toBe(240);
  await paint();

  return {
    map,
    surface: map.shadowRoot!.querySelector('svg')!,
    point: map.objects.get('point') as MapPoint,
    spatial: new Spatial(prepareSceneGeometry(map.objects, map.layers)),
  };
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

describe('synchronous MapElement.batch', () => {
  it('holds scheduling until exit and writes only the final changed SVG attribute', async () => {
    const { map, surface, point, spatial } = await createMap();
    const groups = svgGroups(surface);
    const circle = groups[0]!.firstElementChild;
    const finish = captureMutations(surface);
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const callback = vi.fn(() => {
      point.position = new Point2(80, 40);
      point.position = new Point2(120, 60);
      expect(spatial.hitTest(new Point2(120, 60), map.camera)?.object).toBe(point);
      expect(spatial.hitTest(new Point2(40, 30), map.camera)).toBeUndefined();
      expectPoint(groups[0]!, 40, 30);
      expect(frames).not.toHaveBeenCalled();

      return 42;
    });

    expect(map.batch(callback)).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(frames).toHaveBeenCalledTimes(1);
    expectPoint(groups[0]!, 40, 30);
    await paint();
    expectPoint(groups[0]!, 120, 60);
    expectGroups(surface, groups);
    expect(groups[0]!.firstElementChild).toBe(circle);
    expect(finish().map(record => [record.target, record.attributeName])).toEqual([
      [groups[0], 'transform'],
    ]);
    expect(frames).toHaveBeenCalledTimes(1);
  });

  it('keeps events and picking immediate through nested batches in change handlers', async () => {
    const { map, surface, point, spatial } = await createMap();
    const other = map.objects.get('other') as MapPoint;
    const events: string[] = [];
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    other.addEventListener('change', () => {
      events.push('other');
      expect(spatial.hitTest(new Point2(220, 180), map.camera)?.object).toBe(other);
      expect(frames).not.toHaveBeenCalled();
    });
    point.addEventListener('change', () => {
      events.push('point');
      expect(point.position).toEqual({ x: 100, y: 50, z: 0 });
      expect(spatial.hitTest(new Point2(100, 50), map.camera)?.object).toBe(point);
      map.batch(() => {
        other.position = new Point2(220, 180);
        expect(frames).not.toHaveBeenCalled();
      });
      expect(frames).not.toHaveBeenCalled();
    });

    map.batch(() => {
      map.batch(() => {
        point.position = new Point2(100, 50);
      });
      events.push('outer');
      expect(events).toEqual(['point', 'other', 'outer']);
      expect(frames).not.toHaveBeenCalled();
    });
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expectPoint(svgGroups(surface)[0]!, 100, 50);
    expectPoint(svgGroups(surface)[1]!, 220, 180);
  });

  it('picks through the actual component inside a batch in a native pointer task', async () => {
    const { map, surface, point } = await createMap();
    const group = svgGroups(surface)[0]!;
    const clicks: ObjectClickEvent[] = [];
    map.clickTrigger = 'press';
    map.addEventListener('objectclick', event => clicks.push(event as ObjectClickEvent));
    surface.addEventListener(
      'pointerdown',
      event => {
        // Re-dispatch while the native pointer is active so browser capture still works.
        event.stopImmediatePropagation();
        map.batch(() => {
          point.position = new Point2(120, 60);
          surface.dispatchEvent(new PointerEvent('pointerdown', event));
          expect(clicks).toHaveLength(1);
          expect(clicks[0]!.detail.object).toBe(point);
          expectPoint(group, 40, 30);
        });
      },
      { capture: true, once: true },
    );

    await userEvent.click(surface, { position: { x: 120, y: 60 } });
    expect(clicks).toHaveLength(1);
    await paint();
    expectPoint(group, 120, 60);
  });

  it.each(['outer', 'inner'] as const)(
    'preserves changes and the original %s exception, then displays ordinary edits',
    async location => {
      const { map, surface, point } = await createMap();
      const group = svgGroups(surface)[0]!;
      const failure = new Error('Callback failure');
      const frames = vi.spyOn(window, 'requestAnimationFrame');

      const fail = (): void => {
        point.position = new Point2(100, 50);
        expect(frames).not.toHaveBeenCalled();
        throw failure;
      };

      let thrown: unknown;

      try {
        map.batch(() => (location === 'inner' ? map.batch(fail) : fail()));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(failure);
      expect(point.position).toEqual({ x: 100, y: 50, z: 0 });
      expect(frames).toHaveBeenCalledTimes(1);
      await paint();
      expectPoint(group, 100, 50);
      point.position = new Point2(140, 70);
      expect(frames).toHaveBeenCalledTimes(2);
      await paint();
      expectPoint(group, 140, 70);
    },
  );

  it('retains the outer hold after a caught inner exception', async () => {
    const { map, surface, point } = await createMap();
    const failure = new Error('Inner failure');
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    map.batch(() => {
      try {
        map.batch(() => {
          point.position = new Point2(80, 40);
          throw failure;
        });
      } catch (error) {
        expect(error).toBe(failure);
      }

      expect(frames).not.toHaveBeenCalled();
      point.position = new Point2(120, 60);
      expect(frames).not.toHaveBeenCalled();
    });
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expectPoint(svgGroups(surface)[0]!, 120, 60);
  });

  it('requests no RAF or SVG writes for empty and no-change batches', async () => {
    const { map, surface } = await createMap();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const finish = captureMutations(surface);
    map.batch(() => {});
    map.batch(() => {
      map.batch(() => {});
      map.layers[0]!.visible = true;
      expect(map.objects.add(map.objects.get('point')!)).toBe(map.objects.get('point'));
    });
    await paint();
    expect(frames).not.toHaveBeenCalled();
    expect(finish()).toEqual([]);
  });

  it('preserves an already scheduled frame and clears the accumulated request after it', async () => {
    const { map, surface, point } = await createMap();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    point.position = new Point2(70, 40);
    expect(frames).toHaveBeenCalledTimes(1);
    map.batch(() => {});
    map.batch(() => {
      point.position = new Point2(120, 60);
      expect(frames).toHaveBeenCalledTimes(1);
    });
    expect(frames).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    await paint();
    expectPoint(svgGroups(surface)[0]!, 120, 60);
    map.batch(() => {});
    await paint();
    expect(frames).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'handles disconnect and reconnect (reconnect inside batch: %s)',
    async inside => {
      const { map, surface, point, spatial } = await createMap();
      const group = svgGroups(surface)[0]!;
      const frames = vi.spyOn(window, 'requestAnimationFrame');
      map.batch(() => {
        point.position = new Point2(80, 40);
        map.remove();
        point.position = new Point2(120, 60);
        expect(spatial.hitTest(new Point2(120, 60), map.camera)?.object).toBe(point);

        if (inside) {
          document.body.append(map);
        }

        expect(frames).not.toHaveBeenCalled();
      });

      if (!inside) {
        expect(frames).not.toHaveBeenCalled();
        map.batch(() => {
          point.position = new Point2(120, 60);
        });
        expect(frames).not.toHaveBeenCalled();
        document.body.append(map);
      }

      expect(frames).toHaveBeenCalledTimes(1);
      await paint();
      expectPoint(group, 120, 60);
      expect(svgGroups(surface)[0]).toBe(group);
    },
  );

  it('holds only the chosen map when two maps share a runtime point', async () => {
    const first = await createMap();
    const second = await createMap();
    second.map.objects.remove(second.point);
    second.map.objects.add(first.point);
    await paint();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    first.map.batch(() => {
      first.point.position = new Point2(120, 60);
      expect(second.spatial.hitTest(new Point2(120, 60), second.map.camera)?.object).toBe(
        first.point,
      );
      expect(frames).toHaveBeenCalledTimes(1);
      second.map.batch(() => {});
      expect(frames).toHaveBeenCalledTimes(1);
    });
    expect(frames).toHaveBeenCalledTimes(2);
    await paint();
    expectPoint(svgGroups(first.surface)[0]!, 120, 60);
    expectPoint(
      svgGroups(second.surface).find(group => group.dataset.objectId === 'point')!,
      120,
      60,
    );
  });

  it('batches root and layer membership, visibility, route topology and camera changes', async () => {
    const { map, surface, spatial } = await createMap(
      mapDefinition([
        pointDefinition(40, 30, 'point'),
        { kind: 'route', id: 'route', points: [pointDefinition(20, 100, 'a')] },
      ]),
    );
    const route = map.objects.get('route');
    expect(route?.kind).toBe('route');
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    map.batch(() => {
      const added = map.objects.add(pointDefinition(200, 180, 'added'));
      map.layers[0]!.objectIds.add(added.id);
      expect(spatial.hitTest(new Point2(200, 180), map.camera)?.object).toBe(added);
      map.layers[0]!.visible = false;
      expect(spatial.hitTest(new Point2(200, 180), map.camera)).toBeUndefined();
      map.layers[0]!.visible = true;

      if (route?.kind === 'route') {
        route.addPoint(pointDefinition(150, 100, 'b'));
        expect(spatial.hitTest(new Point2(90, 100), map.camera)?.object).toBe(route);
      }

      map.objects.remove(map.objects.get('point')!);
      map.camera.center = new Point2(170, 130);
      expect(frames).not.toHaveBeenCalled();
    });
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expect(surface.getAttribute('viewBox')).toBe('10 10 320 240');
    expect(surface.querySelector(POINT_SELECTOR)).toBeNull();
    expect(surface.querySelector('[data-object-id="added"]')!.getAttribute('transform')).toBe(
      'translate(200 180)',
    );
    expect(surface.querySelector('polyline')!.getAttribute('points')).toBe('20,100 150,100');
  });

  it('updates polygon shape and vertical eligibility before painting without touching other nodes', async () => {
    const definition = mapDefinition([
      pointDefinition(250, 200, 'point'),
      {
        kind: 'polygon',
        id: 'zone',
        baseZ: 1,
        height: 1,
        contour: [
          { x: 20, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 80 },
          { x: 20, y: 80 },
        ],
      },
    ]);
    const { map, surface, spatial } = await createMap({
      ...definition,
      layers: [
        {
          ...definition.layers[0]!,
          intersectionBounds: { min: { z: 0 }, max: { z: 3 } },
          objects: ['point'],
        },
        { id: 'upper', intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
      ],
    });
    const zone = map.objects.get('zone');
    expect(zone?.kind).toBe('polygon');
    const group = surface.querySelector<SVGGElement>(POINT_SELECTOR)!;
    const circle = group.firstElementChild;
    const oldPath = surface.querySelector('path')!;
    const finish = captureMutations(surface);
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    map.batch(() => {
      if (zone?.kind !== 'polygon') {
        throw new Error('Expected a polygon.');
      }

      zone.setVertex(0, new Point2(40, 20));
      zone.baseZ = 3;
      zone.height = 2;
      expect(spatial.hitTest(new Point2(25, 25), map.camera)).toBeUndefined();
      const hit = spatial.hitTest(new Point2(60, 50), map.camera);
      expect(hit?.object).toBe(zone);
      expect(hit?.layer.id).toBe('upper');
      expect(oldPath.isConnected).toBe(true);
      expect(frames).not.toHaveBeenCalled();
    });
    await paint();
    expect(oldPath.isConnected).toBe(false);
    expect(
      surface.querySelector('[data-layer-id="upper"] [data-object-id="zone"] path'),
    ).not.toBeNull();
    expect(surface.querySelector(POINT_SELECTOR)).toBe(group);
    expect(group.firstElementChild).toBe(circle);
    expect(
      finish().filter(
        record => record.target.isSameNode(group) || record.target.isSameNode(circle),
      ),
    ).toEqual([]);
    expect(frames).toHaveBeenCalledTimes(1);
  });

  it('preserves route-local topology invalidation during immediate picking and deferred painting', async () => {
    const definition = mapDefinition([
      pointDefinition(40, 30, 'point'),
      {
        kind: 'route',
        id: 'other-route',
        points: [pointDefinition(220, 180, 'other-a'), pointDefinition(280, 180, 'other-b')],
      },

      // Picking stops at this route; getter counts isolate geometry preparation from hit scanning.
      {
        kind: 'route',
        id: 'route',
        points: [pointDefinition(20, 100, 'a'), pointDefinition(140, 100, 'b')],
      },
    ]);
    const { map, surface, spatial } = await createMap({
      ...definition,
      layers: [
        {
          ...definition.layers[0]!,
          objects: [],
          intersectionBounds: { min: { z: 0 }, max: { z: 3 } },
        },
      ],
    });
    const route = map.objects.get('route');
    const other = map.objects.get('other-route');

    if (route?.kind !== 'route' || other?.kind !== 'route') {
      throw new Error('Expected routes.');
    }

    expect(spatial.hitTest(new Point2(80, 100), map.camera)?.object).toBe(route);
    const unrelatedGroup = surface.querySelector('[data-object-id="other-route"]')!;
    const unrelatedShape = unrelatedGroup.firstElementChild;
    const path = surface.querySelector('[data-object-id="route"] polyline')!;
    const reads = other.points.map(point => vi.spyOn(point, 'position', 'get'));
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const finish = captureMutations(surface);

    map.batch(() => {
      route.addPoint(pointDefinition(180, 100, 'c'));
      expect(spatial.hitTest(new Point2(160, 100), map.camera)?.object).toBe(route);
      reads.forEach(read => expect(read).not.toHaveBeenCalled());
      expect(path.getAttribute('points')).toBe('20,100 140,100');
      expect(frames).not.toHaveBeenCalled();
    });
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expect(path.getAttribute('points')).toBe('20,100 140,100 180,100');
    reads.forEach(read => expect(read).not.toHaveBeenCalled());
    expect(surface.querySelector('[data-object-id="other-route"]')).toBe(unrelatedGroup);
    expect(unrelatedGroup.firstElementChild).toBe(unrelatedShape);
    expect(finish().filter(record => unrelatedGroup.contains(record.target))).toEqual([]);
  });

  it.each([undefined, null, 42, 'callback', {}])(
    'rejects a non-function callback: %s',
    async value => {
      const { map } = await createMap();
      const frames = vi.spyOn(window, 'requestAnimationFrame');
      expect(() => map.batch(value as () => void)).toThrow(
        expect.objectContaining({
          name: 'AtlasError',
          code: 'INVALID_BATCH_CALLBACK',
          message: 'Batch callback must be a function.',
          details: { receivedType: typeof value },
        }),
      );
      map.batch(() => {});
      expect(frames).not.toHaveBeenCalled();
    },
  );

  it.each(['promise', 'object', 'function'] as const)(
    'diagnoses a returned %s thenable without invoking it and still paints committed changes',
    async kind => {
      const { map, surface, point } = await createMap();
      const frames = vi.spyOn(window, 'requestAnimationFrame');
      const then = vi.fn();
      let value: unknown = { then };

      if (kind === 'promise') {
        value = Promise.resolve();
      }

      if (kind === 'function') {
        value = Object.assign(() => {}, { then });
      }

      expect(() =>
        map.batch(() => {
          point.position = new Point2(120, 60);

          return value;
        }),
      ).toThrow(
        expect.objectContaining({
          name: 'AtlasError',
          code: 'ASYNC_BATCH_CALLBACK',
          message: 'Batch callback must be synchronous.',
        }),
      );
      expect(then).not.toHaveBeenCalled();
      expect(frames).toHaveBeenCalledTimes(1);
      await paint();
      expectPoint(svgGroups(surface)[0]!, 120, 60);
      point.position = new Point2(140, 70);
      await paint();
      expectPoint(svgGroups(surface)[0]!, 140, 70);
    },
  );

  it('propagates a then getter failure unchanged and restores nesting', async () => {
    const { map, surface, point } = await createMap();
    const failure = new Error('Then getter failure');
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const value = {
      get then(): never {
        throw failure;
      },
    };
    let thrown: unknown;
    map.batch(() => {
      try {
        map.batch(() => {
          point.position = new Point2(120, 60);

          return value;
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(failure);
      expect(frames).not.toHaveBeenCalled();
    });
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expectPoint(svgGroups(surface)[0]!, 120, 60);
  });

  it('retains the outer hold when it catches an inner thenable diagnostic', async () => {
    const { map, surface, point } = await createMap();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const then = vi.fn();
    map.batch(() => {
      expect(() =>
        map.batch(() => {
          point.position = new Point2(80, 40);

          return { then };
        }),
      ).toThrow(expect.objectContaining({ code: 'ASYNC_BATCH_CALLBACK' }));
      expect(frames).not.toHaveBeenCalled();
      point.position = new Point2(120, 60);
      expect(frames).not.toHaveBeenCalled();
    });
    expect(then).not.toHaveBeenCalled();
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expectPoint(svgGroups(surface)[0]!, 120, 60);
  });

  it('ignores ordinary return values, including a non-callable then', async () => {
    const { map } = await createMap();
    const frames = vi.spyOn(window, 'requestAnimationFrame');

    for (const result of [undefined, null, 42, 'value', { then: true }, (): void => {}]) {
      expect(map.batch(() => result)).toBeUndefined();
    }

    expect(frames).not.toHaveBeenCalled();
  });

  it('diagnoses async misuse without cancelling a continuation outside batch', async () => {
    const { map, surface, point } = await createMap();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    let resume: (() => void) | undefined;
    const ready = new Promise<void>(resolve => {
      resume = resolve;
    });

    const callback = async (): Promise<void> => {
      point.position = new Point2(80, 40);
      await ready;
      point.position = new Point2(120, 60);
    };

    // TypeScript accepts this shape; the intentional misuse is checked at runtime.
    expect(() => map.batch(callback as () => void)).toThrow(AtlasError);
    expect(point.position.x).toBe(80);
    expect(frames).toHaveBeenCalledTimes(1);
    await paint();
    expectPoint(svgGroups(surface)[0]!, 80, 40);
    resume!();
    await paint();
    expect(frames).toHaveBeenCalledTimes(2);
    expectPoint(svgGroups(surface)[0]!, 120, 60);
  });
});
