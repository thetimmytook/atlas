import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Rect } from '#math/rect.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapLineDefinition } from '#definitions/map-line-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapRouteDefinition } from '#definitions/map-route-definition.js';
import type { LabelOrigin, LabelProperties } from '#definitions/material-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapLine } from '#objects/map-line.js';
import type { MapRoute } from '#objects/map-route.js';

const DEFAULT_LABEL_COLOR = '#222222';
const FAMILY_ATTRIBUTE = 'font-family';
const ELEMENT_NAME = 'atlas-path-label-test';
const MAPS: MapElement[] = [];
const FLOOR = { min: { z: 0 }, max: { z: 3 } };
const ORIGINS: readonly (readonly [LabelOrigin, number, number])[] = [
  ['top left', 0, 0],
  ['top center', 0, 0.5],
  ['top right', 0, 1],
  ['center left', 0.5, 0],
  ['center center', 0.5, 0.5],
  ['center right', 0.5, 1],
  ['bottom left', 1, 0],
  ['bottom center', 1, 0.5],
  ['bottom right', 1, 1],
];
customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  MAPS.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

function point(x: number, y = 100, z = 0): MapPointDefinition {
  return { kind: 'point', position: { x, y, z } };
}

function path(
  kind: 'line' | 'route',
  id = 'path',
  y = 100,
): MapLineDefinition | MapRouteDefinition {
  return { kind, id, label: '  Path  label  ', points: [point(20, y), point(220, y)] };
}

function fragmented(): MapRouteDefinition {
  return {
    kind: 'route',
    id: 'path',
    label: 'Route',
    points: [
      { ...point(20, 100, 1), id: 'owned', label: 'Owned' },
      point(120, 100, 5),
      point(260, 100, 1),
    ],
  };
}

function typography(label: LabelProperties = {}): Partial<MapDefinition> {
  return {
    materials: {
      labels: {
        properties: {
          label: {
            font: { size: '20px', family: 'monospace' },
            origin: 'top left',
            offset: { x: '0px', y: '20px' },
            ...label,
          },
        },
      },
    },
    materialRules: [{ when: { kind: ['point', 'line', 'route'] }, material: 'labels' }],
  };
}

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function createMap(input: Partial<MapDefinition> = {}): Promise<MapElement> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.cssText = 'display:block;width:320px;height:240px;font-family:monospace;';
  MAPS.push(map);
  document.body.append(map);
  const objects = input.objects ?? [path('route')];
  await map.load({
    ...typography(),
    layers: [{ id: 'content', background, objects: objects.map(object => object.id!) }],
    ...input,
    objects,
  });
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();

  return map;
}

function surface(map: MapElement): SVGSVGElement {
  return map.shadowRoot!.querySelector('svg')!;
}

function groups(map: MapElement, id = 'path'): SVGGElement[] {
  return Array.from(surface(map).querySelectorAll<SVGGElement>(`[data-object-id="${id}"]`));
}

function texts(map: MapElement, id = 'path'): SVGTextElement[] {
  return groups(map, id).flatMap(group => Array.from(group.querySelectorAll('text')));
}

function text(map: MapElement, id = 'path'): SVGTextElement {
  const nodes = texts(map, id);
  expect(nodes.length).toBeGreaterThan(0);

  return nodes[0]!;
}

function clicks(map: MapElement): ObjectClickEvent[] {
  const events: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => events.push(event as ObjectClickEvent));

  return events;
}

/** Same-turn edits/queries use the real SVG surface and component interaction. */
function clickClient(map: MapElement, x: number, y: number): void {
  const svg = surface(map);
  vi.spyOn(svg, 'setPointerCapture').mockImplementation(() => {});

  for (const type of ['pointerdown', 'pointerup']) {
    svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: y }));
  }
}

function clickMap(map: MapElement, x: number, y = 125): void {
  const client = map.coordinates.mapToClient(new Point2(x, y));
  clickClient(map, client.x, client.y);
}

function clickText(map: MapElement, node = text(map)): void {
  const box = node.getBoundingClientRect();
  clickClient(map, box.x + box.width / 2, box.y + box.height / 2);
}

function expectTopLeft(map: MapElement, node: SVGTextElement, x: number, y: number): void {
  const expected = map.coordinates.mapToClient(new Point2(x, y));
  const box = node.getBoundingClientRect();
  expect(box.x).toBeCloseTo(expected.x, 3);
  expect(box.y).toBeCloseTo(expected.y, 3);
}

describe.each(['line', 'route'] as const)('%s label SVG and picking', kind => {
  it('renders literal horizontal text and uses rectangular clicks, including whitespace', async () => {
    const literal = '  <b>A</b>  **B**  ';
    const map = await createMap({
      ...typography({ font: { size: '12px', family: 'monospace' } }),
      objects: [{ ...path(kind), label: literal }],
    });
    const owner = map.objects.get('path');
    const node = text(map);
    expect(node.textContent).toBe(literal);
    expect(node.children).toHaveLength(0);
    expectTopLeft(map, node, 120, 120);
    map.style.cssText += 'writing-mode:vertical-rl;text-anchor:end;text-transform:uppercase;';
    await paint();
    const computed = getComputedStyle(node);
    expect(computed.writingMode).toBe('horizontal-tb');
    expect(computed.textAnchor).toBe('start');
    expect(computed.textTransform).toBe('none');
    const events = clicks(map);
    const box = node.getBoundingClientRect();

    for (const x of [box.x + 1, box.right - 1]) {
      clickClient(map, x, box.y + box.height / 2);
    }

    expect(events.map(event => event.detail.object)).toEqual([owner, owner]);
    expect(
      events.every(
        event => event.detail.layer === map.layers[0] && event.detail.route === undefined,
      ),
    ).toBe(true);
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(2);
    const svg = surface(map);
    const surfaceBox = svg.getBoundingClientRect();
    await userEvent.click(page.elementLocator(svg), {
      position: {
        x: box.x + box.width / 2 - surfaceBox.x,
        y: box.y + box.height / 2 - surfaceBox.y,
      },
    });
    expect(events).toHaveLength(3);
  });

  it('uses default label appearance independently of path color and container text CSS', async () => {
    const map = await createMap({
      materials: { path: { properties: { color: '#ff0000' } } },
      materialRules: [{ when: { kind }, material: 'path' }],
      objects: [path(kind)],
    });
    const node = text(map);
    const box = node.getBoundingClientRect();
    const anchor = map.coordinates.mapToClient(new Point2(120, 100));
    expect(node.getAttribute('fill')).toBe(DEFAULT_LABEL_COLOR);
    const computed = getComputedStyle(node);
    expect(computed.stroke).toBe('rgb(255, 255, 255)');
    expect(computed.paintOrder).toBe('stroke');
    expect(parseFloat(computed.strokeWidth) * node.getScreenCTM()!.a).toBeCloseTo(3, 3);
    const events = clicks(map);
    clickClient(map, box.right + 1, box.y + box.height / 2);
    expect(events.at(-1)!.detail.object).toBe(map.objects.get('path'));
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(1);
    expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe(getComputedStyle(map).fontFamily);
    expect(Number(node.getAttribute('font-size'))).toBe(
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(node.getAttribute('font-weight')).toBe('normal');
    expect(box.x + box.width / 2).toBeCloseTo(anchor.x, 3);
    expect(box.bottom).toBeCloseTo(
      anchor.y - parseFloat(getComputedStyle(document.documentElement).fontSize),
      3,
    );
    expect(map.materials.get('path')!.properties).toEqual({ color: '#ff0000' });
    expect(map.definition!.materials.path!.properties).toEqual({ color: '#ff0000' });
  });

  it.each(ORIGINS)(
    'aligns %s and retains size/offset through pan and zoom',
    async (origin, verticalFraction, horizontalFraction) => {
      const map = await createMap({
        ...typography({ origin, offset: { x: '7px', y: '-.5rem' } }),
        objects: [path(kind)],
      });
      const node = text(map);
      const original = node.getBoundingClientRect();
      const events = clicks(map);
      const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');

      for (const zoom of [1, 2, 0.75]) {
        map.camera.zoom = zoom;
        map.camera.center = new Point2(150, 110);
        await paint();
        const box = node.getBoundingClientRect();
        const anchor = map.coordinates.mapToClient(new Point2(120, 100));
        expect(box.width).toBeCloseTo(original.width, 3);
        expect(box.height).toBeCloseTo(original.height, 3);
        expect(box.x + horizontalFraction * box.width).toBeCloseTo(anchor.x + 7, 3);
        expect(box.y + verticalFraction * box.height).toBeCloseTo(
          anchor.y - parseFloat(getComputedStyle(document.documentElement).fontSize) / 2,
          3,
        );
        clickText(map, node);
      }

      expect(events).toHaveLength(3);
      expect(measurements).not.toHaveBeenCalled();
    },
  );

  it.each([
    [point(100, 20), point(100, 180)],
    [point(200, 160), point(40, 40)],
  ] as const)('keeps vertical/reversed paths horizontal: %j → %j', async (start, end) => {
    const map = await createMap({
      objects: [{ kind, id: 'path', label: 'Path', points: [start, end] }],
    });
    const x = start.position.x === end.position.x ? 100 : 120;
    const node = text(map);
    expectTopLeft(map, node, x, 120);
    expect(getComputedStyle(node).writingMode).toBe('horizontal-tb');
    const events = clicks(map);
    clickText(map, node);
    expect(events.at(-1)!.detail.object).toBe(map.objects.get('path'));
  });

  it('labels a clipped vertical transition at its first displayed XY position', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
      objects: [
        { kind, id: 'path', label: 'Vertical', points: [point(40, 70, -2), point(40, 70, 5)] },
      ],
    });
    expectTopLeft(map, text(map), 40, 90);
    const events = clicks(map);
    clickText(map);
    expect(events.at(-1)!.detail.object).toBe(map.objects.get('path'));
  });

  it('omits empty, undefined and whitespace labels, then reuses the surviving owner', async () => {
    const map = await createMap({ objects: [path(kind)] });
    const owner = map.objects.get('path')!;
    const group = groups(map)[0];
    const events = clicks(map);

    for (const label of [undefined, '', ' \t ']) {
      owner.label = label;
      clickText(map);
      expect(events).toHaveLength(0);
      await paint();
      expect(texts(map)).toHaveLength(0);
      expect(groups(map)[0]).toBe(group);
      owner.label = 'Restored';
      await paint();
    }

    expect(text(map).textContent).toBe('Restored');
  });

  it('updates endpoint placement and picking immediately inside batch without remeasurement', async () => {
    const map = await createMap({
      objects: [{ kind, id: 'path', label: 'Path', points: [point(20), point(100)] }],
    });
    const owner = map.objects.get('path') as MapLine | MapRoute;
    const node = text(map);
    const events = clicks(map);
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    map.batch(() => {
      owner.points[1].position = new Point3(180, 100, 999);
      clickMap(map, 103);
      expect(events.at(-1)!.detail.object).toBe(owner);
      expectTopLeft(map, node, 60, 120);
    });
    await paint();
    expect(text(map)).toBe(node);
    expectTopLeft(map, node, 100, 120);
    expect(measure).not.toHaveBeenCalled();
  });
});

describe('path label composition, clipping and identity', () => {
  it('renders an unequal-segment route at half its XY length', async () => {
    const map = await createMap({
      objects: [
        {
          kind: 'route',
          id: 'path',
          label: 'Weighted',
          points: [point(20, 20), point(40, 20, 1000), point(40, 100, 1000)],
        },
      ],
    });
    expectTopLeft(map, text(map), 40, 70);
    const events = clicks(map);
    clickText(map);
    expect(events.at(-1)!.detail.object).toBe(map.objects.get('path'));
  });

  it('has one label after all fragments, followed by owned labels, with independent pickability', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
      objects: [fragmented()],
    });
    const fragments = groups(map);
    expect(fragments).toHaveLength(2);
    expect(fragments[0]!.querySelector('text')).toBeNull();
    expect(texts(map)).toHaveLength(1);
    expect(text(map).parentElement).toBe(fragments[1]);
    expect(Array.from(fragments[1]!.children).map(child => child.localName)).toEqual([
      'polyline',
      'text',
    ]);
    expect(fragments[1]!.nextElementSibling).toBe(groups(map, 'owned')[0]);
    expectTopLeft(map, text(map), 200, 120);
    const route = map.objects.get('path') as MapRoute;
    const events = clicks(map);
    clickText(map);
    expect(events.at(-1)!.detail.object).toBe(route);
    clickText(map, text(map, 'owned'));
    expect(events).toHaveLength(1);
    route.points[0]!.pickable = true;
    clickText(map, text(map, 'owned'));
    expect(events.at(-1)!.detail).toMatchObject({
      object: route.points[0],
      route,
      layer: map.layers[0],
    });
  });

  it('keeps distinct instances with identical IDs and separate layers', async () => {
    const map = await createMap({
      objects: [path('route', 'same', 50), path('route', 'same', 150)],
      layers: [
        { id: 'low', background, objects: ['same'] },
        { id: 'high', objects: ['same'] },
      ],
    });
    expect(texts(map, 'same')).toHaveLength(4);
    const owners = [...map.objects];
    const events = clicks(map);
    texts(map, 'same')
      .slice(0, 2)
      .forEach(node => clickText(map, node));
    expect(events.map(event => event.detail.object)).toEqual(owners);
    expect(events.every(event => event.detail.layer === map.layers[1])).toBe(true);
    map.layers[1]!.visible = false;
    clickText(map, texts(map, 'same')[0]);
    expect(events.at(-1)!.detail.layer).toBe(map.layers[0]);
  });

  it('draws and picks whole labels beyond intersection bounds, clips at viewport and excludes absent owners', async () => {
    const map = await createMap({
      ...typography({ offset: { x: '30px', y: '20px' } }),
      layers: [{ id: 'floor', background, intersectionBounds: { min: { x: 0 }, max: { x: 80 } } }],
      objects: [path('line'), { ...path('line', 'absent'), points: [point(120), point(220)] }],
    });
    expect(groups(map, 'absent')).toHaveLength(0);
    expectTopLeft(map, text(map), 80, 120);
    const events = clicks(map);
    clickMap(map, 85);
    expect(events.at(-1)!.detail.object.id).toBe('path');
    map.layers[0]!.visible = false;
    clickMap(map, 85);
    expect(events).toHaveLength(1);
    map.layers[0]!.visible = true;
    map.layers[0]!.objectIds.add('path');
    const line = map.objects.get('path') as MapLine;
    line.points[0].position = new Point2(260, 100);
    line.points[1].position = new Point2(300, 100);
    await paint();
    expect(text(map).getBoundingClientRect().right).toBeGreaterThan(
      surface(map).getBoundingClientRect().right,
    );
    clickMap(map, 315);
    expect(events).toHaveLength(2);
    clickMap(map, 325);
    expect(events).toHaveLength(2);
    expect(getComputedStyle(surface(map)).overflow).toBe('hidden');
  });

  it('lets following geometry cover a path label and reverse picking follow composition', async () => {
    const map = await createMap({
      objects: [path('line'), { kind: 'point', id: 'cover', position: { x: 125, y: 125 } }],
    });
    const group = groups(map)[0]!;
    expect(group.nextElementSibling).toBe(groups(map, 'cover')[0]);
    const events = clicks(map);
    clickMap(map, 125);
    expect(events.at(-1)!.detail.object.id).toBe('cover');
    const cover = map.objects.get('cover')!;

    if (cover.kind !== 'point') {
      throw new Error('Expected point.');
    }

    cover.pickable = false;
    clickMap(map, 125);
    expect(events.at(-1)!.detail.object.id).toBe('path');
  });

  it('reconciles fragments and direct membership with a single surviving text node', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
      objects: [fragmented()],
    });
    const route = map.objects.get('path') as MapRoute;
    const node = text(map);
    const fragment = groups(map)[0];
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    route.points[1]!.position = new Point3(120, 100, 1);
    await paint();
    expect(groups(map)).toHaveLength(1);
    expect(groups(map)[0]).toBe(fragment);
    expect(texts(map)).toEqual([node]);
    expectTopLeft(map, node, 140, 120);
    route.points[1]!.position = new Point3(120, 100, 5);
    await paint();
    expect(groups(map)).toHaveLength(2);
    expect(texts(map)).toEqual([node]);
    expectTopLeft(map, node, 200, 120);
    map.layers[0]!.objectIds.add('path');
    await paint();
    expect(groups(map)).toHaveLength(1);
    expect(texts(map)).toEqual([node]);
    expectTopLeft(map, node, 140, 120);
    map.layers[0]!.objectIds.remove('path');
    await paint();
    expect(texts(map)).toEqual([node]);
    expectTopLeft(map, node, 200, 120);
    expect(measure).not.toHaveBeenCalled();
  });

  it.each(['query', 'paint'] as const)(
    'removes stale text and picking after an empty route reattachment following %s',
    async sync => {
      const map = await createMap({
        objects: [{ kind: 'route', id: 'path', label: 'Route', points: [point(20), point(100)] }],
      });
      const route = map.objects.get('path') as MapRoute;
      const events = clicks(map);
      map.objects.remove(route);

      if (sync === 'paint') {
        await paint();
      } else {
        clickMap(map, 65);
        expect(events).toHaveLength(0);
      }

      route.replacePoints(0, route.points.length, []);
      map.objects.add(route);
      clickMap(map, 65);
      expect(events).toHaveLength(0);
      await paint();
      expect(texts(map)).toHaveLength(0);
      expect(groups(map)).toHaveLength(1);
    },
  );

  it('reattaches cached fragments with one SVG label and no ghost label hit', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
      objects: [
        {
          kind: 'route',
          id: 'path',
          label: 'Route',
          points: [point(20, 100, 1), point(100, 100, 1)],
        },
      ],
    });
    const route = map.objects.get('path') as MapRoute;
    const events = clicks(map);
    map.objects.remove(route);
    await paint();
    route.replacePoints(0, route.points.length, [
      point(20, 100, 1),
      point(120, 100, 5),
      point(260, 100, 1),
    ]);
    map.objects.add(route);
    clickMap(map, 65);
    expect(events).toHaveLength(0);
    clickMap(map, 205);
    expect(events.at(-1)!.detail.object).toBe(route);
    await paint();
    expect(groups(map)).toHaveLength(2);
    expect(texts(map)).toHaveLength(1);
    expectTopLeft(map, text(map), 200, 120);
  });

  it('updates route topology inside batch before paint, including empty and single-point routes', async () => {
    const map = await createMap({
      objects: [{ kind: 'route', id: 'path', label: 'Route', points: [point(20), point(100)] }],
    });
    const route = map.objects.get('path') as MapRoute;
    const node = text(map);
    const events = clicks(map);
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    map.batch(() => {
      route.addPoint(point(200));
      clickMap(map, 113);
      expect(events).toHaveLength(1);
      const inserted = route.insertPoint(0, point(0));
      clickMap(map, 103);
      expect(events).toHaveLength(2);
      route.removePoint(inserted);
      clickMap(map, 113);
      expect(events).toHaveLength(3);
      route.replacePoints(0, route.points.length, [point(40), point(80)]);
      clickMap(map, 63);
      expect(events).toHaveLength(4);
      route.replacePoints(0, route.points.length, []);
      clickMap(map, 63);
      expect(events).toHaveLength(4);
      route.addPoint(point(180));
      clickMap(map, 183);
      expect(events).toHaveLength(5);
      expectTopLeft(map, node, 60, 120);
    });
    await paint();
    expect(text(map)).toBe(node);
    expectTopLeft(map, node, 180, 120);
    expect(measure).not.toHaveBeenCalled();
  });

  it('updates clipped positions synchronously when fragment coordinates/count or membership change', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
      objects: [fragmented()],
    });
    const route = map.objects.get('path') as MapRoute;
    const node = text(map);
    const events = clicks(map);
    map.batch(() => {
      route.points[1]!.position = new Point3(120, 100, 1);
      clickMap(map, 143);
      expect(events.at(-1)!.detail.object).toBe(route);
      route.points[1]!.position = new Point3(120, 100, 9);

      // Visible lengths become 25 and 35: halfway is 5 after the second fragment starts at x=225.
      clickMap(map, 233);
      expect(events).toHaveLength(2);
      map.layers[0]!.objectIds.add('path');
      clickMap(map, 143);
      expect(events).toHaveLength(3);
      map.layers[0]!.objectIds.remove('path');
      clickMap(map, 233);
      expect(events).toHaveLength(4);
      expectTopLeft(map, node, 200, 120);
    });
    await paint();
    expectTopLeft(map, text(map), 230, 120);
    expect(texts(map)).toHaveLength(1);
  });
});

describe('path label invalidation and lifecycle', () => {
  it('limits label/material/geometry edits to their consumers and reuses unchanged text metrics', async () => {
    const map = await createMap({
      ...typography(),
      materials: {
        base: {
          properties: {
            label: {
              font: { size: '20px', family: 'monospace' },
              origin: 'top left',
              offset: { x: '0px', y: '20px' },
            },
          },
        },
        child: { inherits: 'base', properties: {} },
        other: { properties: { label: { font: { size: '20px' } } } },
      },
      materialRules: [],
      objects: [
        { ...path('route'), material: 'child' },
        { ...path('line', 'other', 180), material: 'other' },
      ],
    });
    const route = map.objects.get('path') as MapRoute;
    const other = groups(map, 'other')[0]!;
    const node = text(map);
    const pathShape = groups(map)[0]!.querySelector('polyline')!;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface(map), {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    route.label = 'Edited';
    await paint();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(
      records.every(record => !other.contains(record.target) && record.target !== pathShape),
    ).toBe(true);
    records.length = 0;
    measure.mockClear();
    map.materials.get('base')!.properties = {
      label: {
        color: '#123456',
        font: { size: '20px', family: 'monospace' },
        origin: 'top left',
        offset: { x: '7px', y: '20px' },
      },
    };
    await paint();
    expect(measure).not.toHaveBeenCalled();
    expect(records.every(record => record.target === node)).toBe(true);
    records.length = 0;
    route.points[1]!.position = new Point2(180, 100);
    await paint();
    expect(measure).not.toHaveBeenCalled();
    expect(records.every(record => !other.contains(record.target))).toBe(true);
    expect(text(map)).toBe(node);
    observer.disconnect();
  });

  it('keeps shared path geometry current in two maps, with separate typography and reconnect', async () => {
    const first = await createMap({ ...typography({ font: { size: '20px' } }) });
    const second = await createMap({ ...typography({ font: { size: '20px' } }), objects: [] });
    second.style.fontFamily = 'serif';
    const route = first.objects.get('path') as MapRoute;
    second.objects.add(route);
    second.layers[0]!.objectIds.add('path');
    await paint();
    const firstNode = text(first);
    const secondNode = text(second);
    expect(firstNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(secondNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    const firstEvents = clicks(first);
    const secondEvents = clicks(second);
    second.remove();
    first.batch(() => {
      route.replacePoints(0, route.points.length, [point(40), point(120)]);
      route.label = 'Shared';
      clickMap(first, 83);
      expect(firstEvents.at(-1)!.detail.object).toBe(route);
    });
    document.body.append(second);
    clickMap(second, 83);
    expect(secondEvents.at(-1)!.detail.object).toBe(route);
    await paint();
    expect(text(first)).toBe(firstNode);
    expect(text(second)).toBe(secondNode);
    expectTopLeft(first, firstNode, 80, 120);
    expectTopLeft(second, secondNode, 80, 120);
    expect(first.definition!.objects[0]!.label).toBe('  Path  label  ');
    expect(second.definition!.objects).toEqual([]);
  });

  it('measures a newly attached path before its first render and preserves pending painting', async () => {
    const map = await createMap({ objects: [] });
    const events = clicks(map);
    const owner = map.objects.add(path('line'));
    map.layers[0]!.objectIds.add('path');
    clickMap(map, 123);
    expect(events.at(-1)!.detail.object).toBe(owner);
    expect(groups(map)).toHaveLength(0);
    await paint();
    expectTopLeft(map, text(map), 120, 120);
  });

  it.each(['press', 'release'] as const)(
    'revalidates a captured line after %s geometry edits',
    async trigger => {
      const map = await createMap({ objects: [path('line', 'under'), path('line')] });
      const owner = map.objects.get('path') as MapLine;
      const events = clicks(map);
      map.clickTrigger = trigger;
      map.addEventListener(
        trigger,
        () => {
          owner.points[0].position = new Point2(20, 180);
          owner.points[1].position = new Point2(220, 180);
        },
        { once: true },
      );
      clickText(map);
      expect(events).toHaveLength(0);
      clickText(map);
      expect(events.at(-1)!.detail.object.id).toBe('under');
    },
  );

  describe.each(['press', 'release'] as const)('surviving path captures during %s', trigger => {
    it.each(['line', 'route'] as const)(
      'retains a still-valid %s owner/layer hit when the host changes',
      async kind => {
        const map = await createMap({
          layers: [
            {
              id: 'content',
              background,
              intersectionBounds: kind === 'line' ? { min: { x: 20 }, max: { x: 100 } } : FLOOR,
            },
          ],
          objects: [
            kind === 'line'
              ? { kind, id: 'path', label: 'Path', points: [point(0), point(200)] }
              : {
                  kind,
                  id: 'path',
                  label: 'Route',
                  points: [point(20, 100, 1), point(120, 100, 5), point(220, 100, 1)],
                },
          ],
        });
        const owner = map.objects.get('path') as MapLine | MapRoute;
        const events = clicks(map);
        const box = text(map).getBoundingClientRect();
        map.clickTrigger = trigger;
        map.addEventListener(
          trigger,
          () => {
            if (owner.kind === 'line') {
              map.layers[0]!.objectIds.add('path');

              return;
            }

            owner.points[1]!.position = new Point3(120, 100, 1);
          },
          { once: true },
        );

        // This lies inside both independently known old/new rectangles, away from the stroke.
        clickClient(map, box.right - 3, box.y + box.height / 2);
        expect(events).toHaveLength(1);
        expect(events[0]!.detail.object).toBe(owner);
        expect(events[0]!.detail.layer).toBe(map.layers[0]);
        expect(events[0]!.detail.route).toBeUndefined();
      },
    );
  });

  describe.each(['press', 'release'] as const)('captured route hits during %s', trigger => {
    it.each([
      'fragments',
      'coordinates',
      'topology',
      'membership',
      'text',
      'material',
      'visibility',
    ] as const)(
      'suppresses obsolete %s hits without picking the object underneath',
      async change => {
        const map = await createMap({
          layers: [
            { id: 'under', background, intersectionBounds: FLOOR },
            { id: 'over', intersectionBounds: FLOOR },
          ],
          objects: [fragmented()],
        });
        const route = map.objects.get('path') as MapRoute;
        const node = texts(map).at(-1)!;
        const events = clicks(map);
        map.clickTrigger = trigger;
        map.addEventListener(
          trigger,
          () => {
            switch (change) {
              case 'fragments':
                route.points[1]!.position = new Point3(120, 100, 1);
                break;
              case 'coordinates':
                route.points[1]!.position = new Point3(120, 100, 9);
                break;
              case 'topology':
                route.replacePoints(0, route.points.length, [point(20), point(60)]);
                break;
              case 'membership':
                map.layers[1]!.objectIds.add('path');
                break;
              case 'text':
                route.label = undefined;
                break;
              case 'material':
                map.materials.get('labels')!.properties = {
                  label: { offset: { x: '0px', y: '80px' } },
                };
                break;
              case 'visibility':
                map.layers[1]!.visible = false;
            }
          },
          { once: true },
        );
        const box = node.getBoundingClientRect();
        clickClient(map, box.x + 2, box.y + box.height / 2);
        expect(events).toHaveLength(0);

        // Visibility leaves a real hit immediately underneath the captured layer.
        if (change === 'visibility') {
          clickText(map, node);
          expect(events.at(-1)!.detail.layer).toBe(map.layers[0]);
        }
      },
    );
  });
});
