import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { MapLine } from '#objects/map-line.js';
import { MapPoint } from '#objects/map-point.js';
import { MapRoute } from '#objects/map-route.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { selectAddedRoots } from '../fixtures.js';

import {
  background,
  expectGroups,
  expectLine,
  expectPoint,
  expectPolyline,
  mapDefinition,
  pointDefinition,
  shape,
  svgGroups,
} from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';

const ELEMENT_NAME = 'atlas-regression-map';
const DOM_TIMEOUT = 2_000;
const maps: MapElement[] = [];
let listeners = new AbortController();

customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  listeners.abort();
  maps.splice(0).forEach(map => map.remove());
  listeners = new AbortController();
});

async function waitForDom(assertion: () => void): Promise<void> {
  await expect
    .poll(
      () => {
        assertion();

        return true;
      },
      { timeout: DOM_TIMEOUT },
    )
    .toBe(true);
}

async function createMap(definition: MapDefinition = mapDefinition()): Promise<{
  map: MapElement;
  surface: SVGSVGElement;
}> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  document.body.append(map);
  maps.push(map);
  const surface = map.shadowRoot!.querySelector('svg')!;
  await map.load(definition);
  selectAddedRoots(map.objects, map.layers[0]!);
  await waitForDom(() => {
    expect(map.camera.viewport.width).toBe(320);
    expect(map.camera.viewport.height).toBe(240);
    expect(surface.getAttribute('viewBox')).toBe('0 0 320 240');
    expect(svgGroups(surface).every(group => group.getAttribute('visibility') === null)).toBe(true);
  });

  return { map, surface };
}

async function createMixedMap(): Promise<{
  map: MapElement;
  surface: SVGSVGElement;
  point: MapPoint;
  line: MapLine;
  route: MapRoute;
}> {
  const { map, surface } = await createMap(
    mapDefinition([
      pointDefinition(40, 30, 'point'),
      {
        id: 'line',
        kind: 'line',
        points: [pointDefinition(20, 60, 'start'), pointDefinition(200, 60, 'end')],
      },
      {
        id: 'route',
        kind: 'route',
        points: [pointDefinition(50, 150, 'a'), pointDefinition(250, 150, 'b')],
      },
    ]),
  );
  const point = map.objects.get('point');
  const line = map.objects.get('line');
  const route = map.objects.get('route');
  expect(point).toBeInstanceOf(MapPoint);
  expect(line).toBeInstanceOf(MapLine);
  expect(route).toBeInstanceOf(MapRoute);

  return {
    map,
    surface,
    point: point as MapPoint,
    line: line as MapLine,
    route: route as MapRoute,
  };
}

function recordClicks(map: MapElement): ObjectClickEvent[] {
  const events: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => events.push(event as ObjectClickEvent), {
    signal: listeners.signal,
  });

  return events;
}

async function clickAt(surface: SVGSVGElement, x: number, y: number): Promise<void> {
  await userEvent.click(surface, { position: { x, y } });
}

describe('real MapElement browser integration', () => {
  it('delivers runtime point, line and route changes through Shadow DOM and browser RAF', async () => {
    const { map, surface, point, line, route } = await createMixedMap();
    expect(customElements.get(ELEMENT_NAME)).toBe(MapElement);
    expect(map.shadowRoot).toBeInstanceOf(ShadowRoot);
    const groups = svgGroups(surface);
    const circles = groups
      .filter(group => group.querySelector('circle'))
      .map(group => shape(group, 'circle'));
    const definition = map.definition;

    point.position = new Point2(80, 40);
    line.points[0].position = new Point2(30, 70);
    line.points[1].position = new Point2(210, 90);
    route.points[0]!.position = new Point2(60, 170);
    const inserted = route.insertPoint(1, pointDefinition(140, 180, 'middle'));
    await waitForDom(() => {
      expectPoint(groups[0]!, 80, 40);
      expectLine(groups[1]!, [30, 70, 210, 90]);
      expectPolyline(groups[2]!, '60,170 140,180 250,150');
      expectPoint(groups[3]!, 60, 170);
      expectPoint(svgGroups(surface)[4]!, 140, 180);
    });
    const middleNode = svgGroups(surface)[4]!;
    expectGroups(surface, [...groups.slice(0, 4), middleNode, groups[4]!]);
    expect(shape(groups[0]!, 'circle')).toBe(circles[0]);
    expect(map.definition).toBe(definition);

    route.removePoint(inserted);
    await waitForDom(() => {
      expectGroups(surface, groups);
      expectPolyline(groups[2]!, '60,170 250,150');
    });
    expect(middleNode.isConnected).toBe(false);
  });

  it('picks a moved point in the native pointer task before RAF, then paints that same state', async () => {
    const { map, surface, point } = await createMixedMap();
    const group = svgGroups(surface)[0]!;
    map.clickTrigger = 'press';
    const events = recordClicks(map);
    const beforePaint: string[] = [];

    // Capture runs before CameraControls in this trusted provider pointerdown task.
    // Editing here guarantees picking precedes the next browser RAF, without fake timers.
    surface.addEventListener(
      'pointerdown',
      () => {
        point.position = new Point2(120, 40);
        expectPoint(group, 40, 30);
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    map.addEventListener(
      'objectclick',
      () => {
        beforePaint.push(group.getAttribute('transform')!);
      },
      { signal: listeners.signal },
    );

    await clickAt(surface, 120, 40);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(point);
    expect(events[0]!.detail.mapPoint.x).toBeCloseTo(120);
    expect(events[0]!.detail.mapPoint.y).toBeCloseTo(40);
    expect(beforePaint).toEqual(['translate(40 30)']);
    await waitForDom(() => expectPoint(group, 120, 40));
    expect(svgGroups(surface)[0]).toBe(group);

    await clickAt(surface, 40, 30);
    expect(events).toHaveLength(1);
  });

  it('picks moved line endpoints before painting in the same native pointer task', async () => {
    const { map, surface, line } = await createMixedMap();
    const group = svgGroups(surface)[1]!;
    map.clickTrigger = 'press';
    const events = recordClicks(map);
    const beforePaint: number[][] = [];

    // A trusted provider click runs this edit and picking in one pointerdown task, before RAF.
    surface.addEventListener(
      'pointerdown',
      () => {
        line.points[0].position = new Point2(100, 80);
        line.points[1].position = new Point2(200, 80);
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    map.addEventListener(
      'objectclick',
      () => {
        const stroke = shape<SVGLineElement>(group, 'line');
        beforePaint.push(['x1', 'y1', 'x2', 'y2'].map(name => Number(stroke.getAttribute(name))));
      },
      { signal: listeners.signal },
    );

    await clickAt(surface, 150, 80);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(line);
    expect(beforePaint).toEqual([[20, 60, 200, 60]]);
    await waitForDom(() => expectLine(group, [100, 80, 200, 80]));
    expect(svgGroups(surface)[1]).toBe(group);
    await clickAt(surface, 110, 60);
    expect(events).toHaveLength(1);
  });

  it('picks a same-length replacement vertex before RAF and paints its new membership', async () => {
    const { map, surface, route } = await createMixedMap();
    const before = svgGroups(surface);
    const retired = route.points[0]!;
    map.clickTrigger = 'press';
    const events = recordClicks(map);
    const beforePaint: string[] = [];
    let replacement: MapPoint | undefined;

    // Membership changes and picking happen in this trusted pointer task before any paint.
    surface.addEventListener(
      'pointerdown',
      () => {
        replacement = route.replacePoints(0, 1, [pointDefinition(70, 190, 'a')])[0]!;
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    map.addEventListener(
      'objectclick',
      () => {
        beforePaint.push(shape<SVGPolylineElement>(before[2]!, 'polyline').getAttribute('points')!);
      },
      { signal: listeners.signal },
    );

    await clickAt(surface, 70, 190);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(replacement);
    expect(events[0]!.detail.object).not.toBe(retired);
    expect(events[0]!.detail.route).toBe(route);
    expect(beforePaint).toEqual(['50,150 250,150']);
    await waitForDom(() => {
      expectPolyline(before[2]!, '70,190 250,150');
      expectPoint(svgGroups(surface)[3]!, 70, 190);
    });
    const replacementNode = svgGroups(surface)[3]!;
    expectGroups(surface, [before[0]!, before[1]!, before[2]!, replacementNode, before[4]!]);
    expect(before[3]!.isConnected).toBe(false);
    await clickAt(surface, 50, 150);
    expect(events).toHaveLength(1);
  });

  it('returns the original route for its path and the original point with its owner for a vertex', async () => {
    const { map, surface, route } = await createMixedMap();
    const events = recordClicks(map);
    await clickAt(surface, 150, 150);
    await clickAt(surface, 50, 150);

    expect(events).toHaveLength(2);
    expect(events[0]!.detail.object).toBe(route);
    expect(events[0]!.detail.route).toBeUndefined();
    expect(events[1]!.detail.object).toBe(route.points[0]);
    expect(events[1]!.detail.route).toBe(route);
    expect(events[1]!.detail.mapPoint).toEqual(new Point2(50, 150));
  });

  it.each(['root', 'vertex', 'disconnect'] as const)(
    'suppresses a stale objectclick when a synchronous surface handler performs %s removal',
    async action => {
      const { map, surface, route } = await createMixedMap();
      const events = recordClicks(map);
      let releases = 0;
      map.addEventListener(
        'release',
        () => {
          releases++;

          if (action === 'disconnect') {
            map.remove();

            return;
          }

          if (action === 'root') {
            map.objects.remove(route);

            return;
          }

          route.removePoint(route.points[0]!);
        },
        { once: true, signal: listeners.signal },
      );

      await clickAt(surface, 50, 150);
      expect(releases).toBe(1);
      expect(events).toHaveLength(0);

      if (action === 'disconnect') {
        expect(map.isConnected).toBe(false);

        return;
      }

      await waitForDom(() => {
        expect(svgGroups(surface)).toHaveLength(action === 'root' ? 2 : 4);
      });
    },
  );

  it('reconnects after disconnected edits and equal-length route replacement without multiplying events', async () => {
    const { map, surface, point, route } = await createMixedMap();
    const before = svgGroups(surface);
    const events = recordClicks(map);
    let releases = 0;
    map.addEventListener('release', () => releases++, { signal: listeners.signal });

    map.remove();
    point.position = new Point2(90, 40);
    route.points[1]!.position = new Point2(260, 170);
    route.replacePoints(0, 1, [pointDefinition(70, 170, 'a')]);
    const added = map.objects.add(pointDefinition(280, 200, 'added'));
    expectGroups(surface, before);
    expectPoint(before[0]!, 40, 30);

    document.body.append(map);
    await waitForDom(() => {
      expectPoint(before[0]!, 90, 40);
      expectPolyline(before[2]!, '70,170 260,170');
      expectPoint(svgGroups(surface)[3]!, 70, 170);
      expectPoint(svgGroups(surface)[5]!, 280, 200);
    });
    const current = svgGroups(surface);
    expectGroups(surface, [
      before[0]!,
      before[1]!,
      before[2]!,
      current[3]!,
      before[4]!,
      current[5]!,
    ]);
    expect(current[3]).not.toBe(before[3]);
    expect(before[3]!.isConnected).toBe(false);

    for (const x of [95, 100, 105]) {
      map.remove();
      point.position = new Point2(x, 40);
      document.body.append(map);
      await waitForDom(() => expectPoint(before[0]!, x, 40));
      await clickAt(surface, x, 40);
    }

    await clickAt(surface, 70, 170);
    await clickAt(surface, 280, 200);
    expect(releases).toBe(5);
    expect(events).toHaveLength(5);
    events.slice(0, 3).forEach(event => expect(event.detail.object).toBe(point));
    expect(events[3]!.detail.object).toBe(route.points[0]);
    expect(events[3]!.detail.route).toBe(route);
    expect(events[4]!.detail.object).toBe(added);
    expectGroups(surface, current);
  });

  it.each(['decode', 'load'] as const)(
    'preserves the complete old scene on background %s failure and replaces it on a subsequent success',
    async failure => {
      const { map, surface } = await createMap(
        mapDefinition([
          pointDefinition(80, 80, 'point'),
          {
            id: 'route',
            kind: 'route',
            points: [pointDefinition(40, 180, 'a'), pointDefinition(260, 180, 'b')],
          },
        ]),
      );
      const oldObjects = map.objects;
      const oldPoint = oldObjects.get('point') as MapPoint;
      const oldRoute = oldObjects.get('route') as MapRoute;
      map.camera.center = new Point2(100, 80);
      map.camera.zoom = 2;
      await waitForDom(() => expect(surface.getAttribute('viewBox')).toBe('20 20 160 120'));
      const nodes = Array.from(surface.children);
      const oldGroups = svgGroups(surface);
      const primitives = oldGroups.map(group => group.firstElementChild);
      const definition = map.definition;
      const events = recordClicks(map);

      let failedSource = 'data:image/png;base64,AAAA';

      if (failure === 'load') {
        // A revoked local URL exercises resource failure without an external network request.
        failedSource = URL.createObjectURL(new Blob(['unavailable'], { type: 'image/svg+xml' }));
        URL.revokeObjectURL(failedSource);
      }

      const failedLoad = map.load({
        layers: [{ objects: ['point'], background: { ...background, source: failedSource } }],
        objects: [pointDefinition(220, 140, 'point')],
      });
      expect(surface.children).toHaveLength(nodes.length);
      nodes.forEach((node, index) => expect(surface.children.item(index)).toBe(node));
      expect(map.objects).toBe(oldObjects);
      await expect(failedLoad).rejects.toMatchObject({ code: 'BACKGROUND_LOAD_FAILED' });
      expect(surface.children).toHaveLength(nodes.length);
      expectGroups(surface, oldGroups);
      oldGroups.forEach((group, index) =>
        expect(group.firstElementChild).toBe(primitives.at(index)),
      );
      nodes.forEach((node, index) => expect(surface.children.item(index)).toBe(node));
      expect(map.definition).toBe(definition);
      expect(map.objects).toBe(oldObjects);
      expect(map.camera.center).toEqual(new Point2(100, 80));
      expect(map.camera.zoom).toBe(2);
      expect(map.camera.viewport).toEqual({ width: 320, height: 240 });
      expect(surface.getAttribute('viewBox')).toBe('20 20 160 120');
      await clickAt(surface, 120, 120);
      expect(events[0]!.detail.object).toBe(oldPoint);

      const replacementBackground = {
        ...background,
        source:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="blue" d="M0 0h2v2H0z"/></svg>',
          ),
      };
      await map.load({
        layers: [{ objects: ['point'], background: replacementBackground }],
        objects: [pointDefinition(220, 140, 'point')],
      });
      await waitForDom(() => {
        expect(surface.getAttribute('viewBox')).toBe('0 0 320 240');
        expect(svgGroups(surface)).toHaveLength(1);
        expectPoint(svgGroups(surface)[0]!, 220, 140);
      });
      const newPoint = map.objects.get('point') as MapPoint;
      const newNodes = Array.from(surface.children);
      expect(newPoint).not.toBe(oldPoint);
      expect(map.objects).not.toBe(oldObjects);
      expect(map.definition).not.toBe(definition);
      expect(surface.querySelector('image')!.getAttribute('href')).toBe(
        replacementBackground.source,
      );
      nodes.forEach(node => expect(node.isConnected).toBe(false));

      // Force a real component frame while changing retained objects from the retired scene.
      oldPoint.position = new Point2(225, 145);
      oldRoute.addPoint(pointDefinition(225, 145, 'retired-vertex'));
      oldObjects.add(pointDefinition(225, 145, 'retired-root'));
      newPoint.position = new Point2(225, 145);
      await waitForDom(() => expectPoint(svgGroups(surface)[0]!, 225, 145));
      newNodes.forEach((node, index) => expect(surface.children.item(index)).toBe(node));
      expect(svgGroups(surface)).toHaveLength(1);
      await clickAt(surface, 225, 145);
      expect(events).toHaveLength(2);
      expect(events[1]!.detail.object).toBe(newPoint);
    },
  );

  it('keeps shared runtime instances active in the second component after first-view detach and removal', async () => {
    const first = await createMap();
    const second = await createMap();
    const route = new MapRoute('shared-route', [
      pointDefinition(50, 170, 'a'),
      pointDefinition(250, 170, 'b'),
    ]);
    const point = route.points[0]!;
    first.map.objects.add(route);
    first.map.objects.add(point);
    second.map.objects.add(route);
    second.map.objects.add(point);
    await waitForDom(() => {
      expect(svgGroups(first.surface)).toHaveLength(4);
      expect(svgGroups(second.surface)).toHaveLength(4);
      expectPoint(svgGroups(first.surface)[3]!, 50, 170);
      expectPoint(svgGroups(second.surface)[3]!, 50, 170);
    });
    const firstNodes = svgGroups(first.surface);
    const secondNodes = svgGroups(second.surface);
    expect(firstNodes[0]).not.toBe(secondNodes[0]);
    const events = recordClicks(second.map);

    point.position = new Point2(70, 180);
    await waitForDom(() => {
      expectPoint(firstNodes[1]!, 70, 180);
      expectPoint(firstNodes[3]!, 70, 180);
      expectPoint(secondNodes[1]!, 70, 180);
      expectPoint(secondNodes[3]!, 70, 180);
      expectPolyline(firstNodes[0]!, '70,180 250,170');
      expectPolyline(secondNodes[0]!, '70,180 250,170');
    });

    first.map.remove();
    point.position = new Point2(90, 180);
    route.insertPoint(1, pointDefinition(150, 200, 'middle'));
    await waitForDom(() => {
      expectPoint(secondNodes[1]!, 90, 180);
      expectPoint(secondNodes[3]!, 90, 180);
      expectPolyline(secondNodes[0]!, '90,180 150,200 250,170');
      expect(svgGroups(second.surface)).toHaveLength(5);
    });

    document.body.append(first.map);
    await waitForDom(() => expectPolyline(firstNodes[0]!, '90,180 150,200 250,170'));
    first.map.objects.remove(route);
    first.map.objects.remove(point);
    await waitForDom(() => expect(svgGroups(first.surface)).toHaveLength(0));

    point.position = new Point2(100, 180);
    route.points[2]!.position = new Point2(260, 170);
    await waitForDom(() => {
      expectPoint(secondNodes[1]!, 100, 180);
      expectPoint(secondNodes[3]!, 100, 180);
      expectPolyline(secondNodes[0]!, '100,180 150,200 260,170');
    });
    expect(svgGroups(first.surface)).toHaveLength(0);
    const middle = svgGroups(second.surface)[2]!;
    expectGroups(second.surface, [
      secondNodes[0]!,
      secondNodes[1]!,
      middle,
      secondNodes[2]!,
      secondNodes[3]!,
    ]);
    await clickAt(second.surface, 100, 180);
    await clickAt(second.surface, 205, 185);
    expect(events).toHaveLength(2);
    expect(events[0]!.detail.object).toBe(point);
    expect(events[0]!.detail.route).toBeUndefined();
    expect(events[1]!.detail.object).toBe(route);
  });

  it('uses real ResizeObserver through zero-size collapse and recovery without refitting the camera', async () => {
    const { map, surface, point, route } = await createMixedMap();
    const before = svgGroups(surface);
    map.camera.center = new Point2(120, 100);
    map.camera.zoom = 2;
    await waitForDom(() => expect(surface.getAttribute('viewBox')).toBe('40 40 160 120'));

    map.style.width = '0px';
    map.style.height = '0px';
    await waitForDom(() => {
      expect(map.camera.viewport.width).toBe(0);
      expect(map.camera.viewport.height).toBe(0);
      expect(surface.getAttribute('width')).toBe('0');
      expect(surface.getAttribute('height')).toBe('0');
    });
    point.position = new Point2(100, 80);
    route.replacePoints(0, 1, [pointDefinition(80, 160, 'a')]);
    map.style.width = '480px';
    map.style.height = '320px';
    await waitForDom(() => {
      expect(map.camera.viewport.width).toBe(480);
      expect(map.camera.viewport.height).toBe(320);
      expect(surface.getAttribute('viewBox')).toBe('0 20 240 160');
      expectPoint(before[0]!, 100, 80);
      expectPolyline(before[2]!, '80,160 250,150');
    });
    expect(map.camera.center).toEqual(new Point2(120, 100));
    expect(map.camera.zoom).toBe(2);
    const current = svgGroups(surface);
    expectGroups(surface, [before[0]!, before[1]!, before[2]!, current[3]!, before[4]!]);
    expect(before[3]!.isConnected).toBe(false);
    expect(shape<SVGCircleElement>(before[0]!, 'circle').getBoundingClientRect().width).toBeCloseTo(
      22,
    );
    const events = recordClicks(map);

    // At zoom 2 with center (120,100) in a 480x320 viewport, (100,80) projects to (200,120).
    await clickAt(surface, 200, 120);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(point);
  });
});

describe('membership picking before view updates', () => {
  it('picks added roots and ignores removed roots in the native pointer task before RAF', async () => {
    const { map, surface } = await createMixedMap();
    const before = svgGroups(surface);
    const events = recordClicks(map);
    map.clickTrigger = 'press';
    let added: MapPoint | undefined;
    const paintedCounts: number[] = [];
    map.addEventListener('objectclick', () => paintedCounts.push(svgGroups(surface).length), {
      signal: listeners.signal,
    });
    surface.addEventListener(
      'pointerdown',
      () => {
        added = map.objects.add(pointDefinition(280, 220, 'new'));
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    await clickAt(surface, 280, 220);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(added);
    expect(paintedCounts).toEqual([before.length]);
    await waitForDom(() => expectPoint(svgGroups(surface).at(-1)!, 280, 220));
    surface.addEventListener(
      'pointerdown',
      () => {
        map.objects.remove(added!);
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    await clickAt(surface, 280, 220);
    expect(events).toHaveLength(1);
    await waitForDom(() => expectGroups(surface, before));
  });

  it('queries disconnected edits without consuming the changes needed on reconnect', async () => {
    const { map, surface, point, route } = await createMixedMap();
    const geometry = prepareSceneGeometry(map.objects, map.layers);
    const spatial = new Spatial(geometry);
    const before = svgGroups(surface);
    map.remove();
    point.position = new Point2(90, 40);
    const inserted = route.insertPoint(1, pointDefinition(140, 200, 'middle'));
    const added = map.objects.add(pointDefinition(280, 220, 'new'));
    expect(spatial.hitTest(new Point2(90, 40), map.camera)?.object).toBe(point);
    expect(spatial.hitTest(new Point2(140, 200), map.camera)?.object).toBe(inserted);
    expect(spatial.hitTest(new Point2(280, 220), map.camera)?.object).toBe(added);
    route.removePoint(inserted);
    expect(spatial.hitTest(new Point2(140, 200), map.camera)).toBeUndefined();
    expectPoint(before[0]!, 40, 30);
    expectGroups(surface, before);
    document.body.append(map);
    await waitForDom(() => {
      expectPoint(before[0]!, 90, 40);
      expectPolyline(before[2]!, '50,150 250,150');
      expectPoint(svgGroups(surface).at(-1)!, 280, 220);
    });
  });
});

describe('reentrant reattachment before browser RAF', () => {
  it('refreshes a reused symbol after capture removal, internal picking and press reattachment', async () => {
    const { map, surface, point } = await createMixedMap();
    const before = svgGroups(surface);
    const target = before[0]!;
    const primitive = shape(target, 'circle');
    const events = recordClicks(map);
    const beforePaint: string[] = [];
    map.clickTrigger = 'press';
    surface.addEventListener(
      'pointerdown',
      () => {
        map.objects.remove(point);
        expectPoint(target, 40, 30);
      },
      { capture: true, once: true, signal: listeners.signal },
    );
    map.addEventListener(
      'press',
      () => {
        point.position = new Point2(90, 80);
        map.objects.add(point);
        beforePaint.push(target.getAttribute('transform')!);
      },
      { once: true, signal: listeners.signal },
    );

    await clickAt(surface, 40, 30);
    expect(events).toHaveLength(0);
    expect(beforePaint).toEqual(['translate(40 30)']);
    await waitForDom(() => expectPoint(target, 90, 80));
    expectGroups(surface, [...before.slice(1), target]);
    expect(shape(target, 'circle')).toBe(primitive);
    await clickAt(surface, 90, 80);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.object).toBe(point);
    expectPoint(target, 90, 80);
  });
});
