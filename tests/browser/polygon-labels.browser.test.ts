import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPolygonDefinition } from '#definitions/map-polygon-definition.js';
import type { LabelOrigin, LabelProperties } from '#definitions/material-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapPolygon } from '#objects/map-polygon.js';

const ELEMENT_NAME = 'atlas-polygon-label-test';
const LABEL_TEXT = '  Polygon  label  ';
const FAMILY_ATTRIBUTE = 'font-family';
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

function rectangle(x = 80, y = 80, width = 40, height = 20): Point2[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function polygonDefinition(id = 'zone', x = 80, y = 80): MapPolygonDefinition {
  return { kind: 'polygon', id, label: LABEL_TEXT, contour: rectangle(x, y) };
}

function typography(label: LabelProperties = {}): Partial<MapDefinition> {
  return {
    materials: {
      labels: {
        properties: {
          label: {
            font: { size: '20px', family: 'monospace' },
            origin: 'top left',
            offset: { x: '0px', y: '40px' },
            ...label,
          },
        },
      },
    },
    materialRules: [{ when: { kind: 'polygon' }, material: 'labels' }],
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
  const objects = input.objects ?? [polygonDefinition()];
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

function groups(map: MapElement, id = 'zone'): SVGGElement[] {
  return Array.from(surface(map).querySelectorAll<SVGGElement>(`[data-object-id="${id}"]`));
}

function texts(map: MapElement, id = 'zone'): SVGTextElement[] {
  return groups(map, id).flatMap(group => Array.from(group.querySelectorAll('text')));
}

function text(map: MapElement, id = 'zone'): SVGTextElement {
  const nodes = texts(map, id);
  expect(nodes.length).toBeGreaterThan(0);

  return nodes[0]!;
}

function owner(map: MapElement): MapPolygon {
  return map.objects.get('zone') as MapPolygon;
}

function clicks(map: MapElement): ObjectClickEvent[] {
  const events: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => events.push(event as ObjectClickEvent));

  return events;
}

/** Real component input in the same turn as mutations, without waiting for RAF. */
function clickClient(map: MapElement, x: number, y: number): void {
  const svg = surface(map);
  vi.spyOn(svg, 'setPointerCapture').mockImplementation(() => {});

  for (const type of ['pointerdown', 'pointerup']) {
    svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: y }));
  }
}

function clickMap(map: MapElement, x = 105, y = 135): void {
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

describe('polygon label SVG, materials and layout', () => {
  it.each([0, 10])('uses centered defaults and container typography at height %s', async height => {
    const map = await createMap({
      materials: {},
      materialRules: [],
      objects: [{ ...polygonDefinition(), height }],
    });
    const node = text(map);
    const group = groups(map)[0]!;
    const box = node.getBoundingClientRect();
    const anchor = map.coordinates.mapToClient(new Point2(100, 90));
    expect(box.x + box.width / 2).toBeCloseTo(anchor.x, 3);
    expect(box.y + box.height / 2).toBeCloseTo(anchor.y, 3);
    expect(node.getAttribute('fill')).toBe('#222222');
    expect(Number(node.getAttribute('font-size'))).toBe(
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(node.getAttribute('font-weight')).toBe('normal');
    expect(node.getAttribute('stroke')).toBe('#ffffff');
    expect(node.getAttribute('stroke-width')).toBe('3');
    expect(node.getAttribute('stroke-linejoin')).toBe('round');
    expect(node.getAttribute('paint-order')).toBe('stroke fill');
    expect(Array.from(group.children).map(child => child.localName)).toEqual(['path', 'text']);
    const events = clicks(map);
    clickText(map);
    expect(events[0]!.detail).toMatchObject({ object: owner(map), layer: map.layers[0] });
    expect(events[0]!.detail.route).toBeUndefined();
  });

  it('inherits individual label/font fields and atomic offset without modifying declarations/snapshot', async () => {
    const map = await createMap({
      materialRules: [],
      materials: {
        base: {
          properties: {
            color: '#abcdef',
            label: {
              color: '#123456',
              font: { size: '18px', family: 'serif' },
              origin: 'top right',
              offset: { x: '7px', y: '40px' },
            },
          },
        },
        middle: { inherits: 'base', properties: { label: { font: { weight: 'bold' } } } },
        child: { inherits: 'middle', properties: { label: { color: '#654321', font: {} } } },
      },
      objects: [{ ...polygonDefinition(), material: 'child' }],
    });
    const snapshot = map.definition;
    const node = text(map);
    expect(node.getAttribute('fill')).toBe('#654321');
    expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    expect(node.getAttribute('font-size')).toBe('18');
    expect(node.getAttribute('font-weight')).toBe('bold');
    const anchor = map.coordinates.mapToClient(new Point2(107, 130));
    expect(node.getBoundingClientRect().right).toBeCloseTo(anchor.x, 3);
    expect(node.getBoundingClientRect().y).toBeCloseTo(anchor.y, 3);
    const events = clicks(map);
    clickText(map);
    expect(events[0]!.detail.object).toBe(owner(map));
    map.materials.get('child')!.properties = { label: { offset: { x: '0px', y: '60px' } } };
    await paint();
    expect(node.getBoundingClientRect().right).toBeCloseTo(
      map.coordinates.mapToClient(new Point2(100, 150)).x,
      3,
    );
    expect(node.getAttribute('fill')).toBe('#123456');
    expect(map.materials.get('child')!.properties).toEqual({
      label: { offset: { x: '0px', y: '60px' } },
    });
    expect(map.definition).toBe(snapshot);
    expect(snapshot!.materials.child!.properties).toEqual({
      label: { color: '#654321', font: {} },
    });
  });

  it('preserves literal spaces, horizontal typography and halo picking in real SVG', async () => {
    const literal = '  <b>A</b>  **B**  ';
    const map = await createMap({
      ...typography({ font: { size: '12px', family: 'monospace' } }),
      objects: [{ ...polygonDefinition(), label: literal }],
    });
    const node = text(map);
    map.style.cssText += 'writing-mode:vertical-rl;text-anchor:end;text-transform:uppercase;';
    await paint();
    expect(node.textContent).toBe(literal);
    expect(node.children).toHaveLength(0);
    expect(getComputedStyle(node).writingMode).toBe('horizontal-tb');
    expect(getComputedStyle(node).textAnchor).toBe('start');
    expect(getComputedStyle(node).textTransform).toBe('none');
    expectTopLeft(map, node, 100, 130);
    const events = clicks(map);
    const box = node.getBoundingClientRect();

    for (const x of [box.x - 1, box.x + 1, box.right - 1, box.right + 1]) {
      clickClient(map, x, box.y + box.height / 2);
    }

    expect(events).toHaveLength(4);
    expect(events.every(event => event.detail.object === owner(map))).toBe(true);
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(4);
    const svg = surface(map);
    const surfaceBox = svg.getBoundingClientRect();
    await userEvent.click(page.elementLocator(svg), {
      position: {
        x: box.x + box.width / 2 - surfaceBox.x,
        y: box.y + box.height / 2 - surfaceBox.y,
      },
    });
    expect(events).toHaveLength(5);
  });

  it.each(ORIGINS)(
    'uses origin %s for both layout and picking',
    async (origin, vertical, horizontal) => {
      const map = await createMap({
        ...typography({ origin }),
        objects: [{ ...polygonDefinition(), label: 'Zone' }],
      });
      const node = text(map);
      const anchor = map.coordinates.mapToClient(new Point2(100, 130));
      const box = node.getBoundingClientRect();
      expect(box.x + box.width * horizontal).toBeCloseTo(anchor.x, 3);
      expect(box.y + box.height * vertical).toBeCloseTo(anchor.y, 3);
      const events = clicks(map);
      clickText(map);
      expect(events[0]!.detail.object).toBe(owner(map));
    },
  );

  it('keeps CSS text size/offset independent of zoom and reuses measurements across pan', async () => {
    const map = await createMap();
    const node = text(map);
    const width = node.getBoundingClientRect().width;
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    map.camera.zoom *= 2;
    map.camera.center = new Point2(100, 90);
    await paint();
    expect(node.getBoundingClientRect().width).toBeCloseTo(width, 3);
    const anchor = map.coordinates.mapToClient(new Point2(100, 90));
    expect(node.getBoundingClientRect().y).toBeCloseTo(anchor.y + 40, 3);
    const events = clicks(map);
    clickText(map);
    expect(events[0]!.detail.object).toBe(owner(map));
    expect(measure).not.toHaveBeenCalled();
  });

  it('refreshes rem typography and layout synchronously before picking', async () => {
    const original = document.documentElement.style.fontSize;

    try {
      document.documentElement.style.fontSize = '10px';
      const map = await createMap({
        ...typography({
          font: { size: '1rem', family: 'monospace' },
          offset: { x: '0px', y: '3rem' },
        }),
      });
      const node = text(map);
      const events = clicks(map);
      document.documentElement.style.fontSize = '20px';
      clickMap(map, 105, 155);
      expect(events[0]!.detail.object).toBe(owner(map));
      expect(node.getAttribute('font-size')).toBe('10');
      await paint();
      expect(node.getAttribute('font-size')).toBe('20');
      expectTopLeft(map, node, 100, 150);
    } finally {
      document.documentElement.style.fontSize = original;
    }
  });

  it.each([undefined, '', ' ', '\t  '])('omits empty label %j and its hit area', async label => {
    const map = await createMap({
      objects: [
        {
          kind: 'polygon',
          id: 'zone',
          contour: rectangle(),
          ...(label === undefined ? {} : { label }),
        },
      ],
    });
    expect(texts(map)).toHaveLength(0);
    const events = clicks(map);
    clickMap(map);
    expect(events).toHaveLength(0);
    owner(map).label = 'Returned';
    clickMap(map);
    expect(events[0]!.detail.object).toBe(owner(map));
    await paint();
    expect(text(map).textContent).toBe('Returned');
  });
});

describe('polygon label displayed area, composition and identity', () => {
  it('renders and picks the largest-cell fallback for a concave polygon', async () => {
    const map = await createMap({
      objects: [
        {
          kind: 'polygon',
          id: 'zone',
          label: 'Fallback',
          contour: [
            { x: 20, y: 20 },
            { x: 140, y: 20 },
            { x: 140, y: 140 },
            { x: 120, y: 140 },
            { x: 120, y: 60 },
            { x: 40, y: 60 },
            { x: 40, y: 140 },
            { x: 20, y: 140 },
          ],
        },
      ],
    });

    // Largest triangle [(20,20),(140,20),(120,60)] has centroid (280/3,100/3).
    expectTopLeft(map, text(map), 280 / 3, 220 / 3);
    const events = clicks(map);
    clickMap(map, 100, 80);
    expect(events[0]!.detail.object).toBe(owner(map));
  });

  it('uses each flat/extruded layer XY region, with no screen displacement from height', async () => {
    const map = await createMap({
      objects: [
        { ...polygonDefinition('flat'), baseZ: 1 },
        { ...polygonDefinition(), height: 10 },
      ],
      layers: [
        { id: 'lower', background, intersectionBounds: { min: { x: 100, z: 0 }, max: { z: 3 } } },
        { id: 'upper', intersectionBounds: { min: { z: 3 }, max: { x: 100, z: 6 } } },
      ],
    });
    expect(texts(map, 'flat')).toHaveLength(1);
    expectTopLeft(map, text(map, 'flat'), 110, 130);
    expect(texts(map)).toHaveLength(2);
    expectTopLeft(map, texts(map)[0]!, 110, 130);
    expectTopLeft(map, texts(map)[1]!, 90, 130);
    const events = clicks(map);
    clickMap(map, 95);
    expect(events[0]!.detail.layer).toBe(map.layers[1]);
    expect(events[0]!.detail.object).toBe(owner(map));
    owner(map).height = 9;
    await paint();
    expectTopLeft(map, texts(map)[0]!, 110, 130);
    expectTopLeft(map, texts(map)[1]!, 90, 130);
  });

  it('shares the area centroid of disconnected clipped regions with picking', async () => {
    const map = await createMap({
      objects: [
        {
          kind: 'polygon',
          id: 'zone',
          label: 'Disconnected',
          contour: [
            { x: 20, y: 20 },
            { x: 220, y: 20 },
            { x: 220, y: 180 },
            { x: 180, y: 180 },
            { x: 180, y: 60 },
            { x: 140, y: 60 },
            { x: 140, y: 180 },
            { x: 20, y: 180 },
          ],
        },
      ],
      layers: [
        { id: 'content', background, intersectionBounds: { min: { y: 100 }, max: { y: 180 } } },
      ],
    });
    expectTopLeft(map, text(map), 110, 180);
    const events = clicks(map);
    clickMap(map, 115, 185);
    expect(events[0]!.detail.object).toBe(owner(map));
  });

  it('picks whole text beyond contour/intersection bounds and clips it at the viewport', async () => {
    const map = await createMap({
      layers: [
        { id: 'floor', background, intersectionBounds: { min: { x: 80 }, max: { x: 100 } } },
      ],
      objects: [polygonDefinition(), polygonDefinition('absent', 200)],
    });
    expect(groups(map, 'absent')).toHaveLength(0);
    const events = clicks(map);
    clickMap(map, 130);
    expect(events[0]!.detail.object).toBe(owner(map));
    map.layers[0]!.objectIds.add('zone');
    owner(map).setContour(rectangle(280));
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

  it.each(['object', 'layer'] as const)(
    'lets a following %s cover geometry and labels in picking order',
    async order => {
      const cover = { ...polygonDefinition('cover', 100, 125), label: '' };
      const map = await createMap({
        objects: [polygonDefinition(), cover],
        ...(order === 'layer'
          ? {
              layers: [
                { id: 'low', background, objects: ['zone'] },
                { id: 'high', objects: ['cover'] },
              ],
            }
          : {}),
      });
      const group = groups(map)[0]!;

      if (order === 'object') expect(group.nextElementSibling).toBe(groups(map, 'cover')[0]);
      else
        expect(group.parentElement!.nextElementSibling).toBe(
          groups(map, 'cover')[0]!.parentElement,
        );

      const events = clicks(map);
      clickMap(map, 110);
      expect(events[0]!.detail.object.id).toBe('cover');
      map.objects.remove(map.objects.get('cover')!);
      clickMap(map, 110);
      expect(events[1]!.detail.object).toBe(owner(map));
    },
  );

  it('keeps duplicate IDs on different instances and layers independent', async () => {
    const map = await createMap({
      objects: [polygonDefinition('zone', 20), polygonDefinition('zone', 180)],
      layers: [
        { id: 'low', background, objects: ['zone'] },
        { id: 'high', objects: ['zone'] },
      ],
    });
    expect(texts(map)).toHaveLength(4);
    const owners = [...map.objects];
    const events = clicks(map);
    clickMap(map, 45);
    clickMap(map, 205);
    expect(events.map(event => event.detail.object)).toEqual(owners);
    expect(events.every(event => event.detail.layer === map.layers[1])).toBe(true);
    map.layers[1]!.visible = false;
    clickMap(map, 45);
    expect(events.at(-1)!.detail.layer).toBe(map.layers[0]);
    await paint();
    expect(groups(map)[2]!.parentElement!.getAttribute('display')).toBe('none');
  });

  it('preserves owner, shape and text nodes across direct/clipped switches without remeasurement', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: { min: { x: 100 } } }],
    });
    const group = groups(map)[0]!;
    const shape = group.querySelector('path');
    const node = text(map);
    const events = clicks(map);
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    expectTopLeft(map, node, 110, 130);

    for (const direct of [true, false, true]) {
      if (direct) map.layers[0]!.objectIds.add('zone');
      else map.layers[0]!.objectIds.remove('zone');

      clickMap(map, direct ? 103 : 113);
      expect(events.at(-1)!.detail.object).toBe(owner(map));
      await paint();
      expect(groups(map)).toEqual([group]);
      expect(group.querySelector('path')).toBe(shape);
      expect(texts(map)).toEqual([node]);
      expectTopLeft(map, node, direct ? 100 : 110, 130);
    }

    expect(measure).not.toHaveBeenCalled();
  });
});

describe('polygon label invalidation and lifecycle', () => {
  it('uses setVertex and setContour immediately before RAF and within batch without remeasurement', async () => {
    const map = await createMap();
    const polygon = owner(map);
    const node = text(map);
    const events = clicks(map);
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    polygon.setVertex(1, { x: 100, y: 80 });

    // Area centroid is (80 + 140/9, 80 + 100/9); text begins at its y + 40.
    clickMap(map, 97, 133);
    expect(events).toHaveLength(1);
    map.batch(() => {
      polygon.setContour(rectangle(200));
      clickMap(map, 105);
      expect(events).toHaveLength(1);
      clickMap(map, 225);
      expect(events).toHaveLength(2);
      expectTopLeft(map, node, 100, 130);
    });
    await paint();
    expect(text(map)).toBe(node);
    expectTopLeft(map, node, 220, 130);
    expect(measure).not.toHaveBeenCalled();
  });

  it('removes and restores appearances synchronously through XY and vertical clipping', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: FLOOR }],
    });
    const polygon = owner(map);
    const events = clicks(map);
    map.batch(() => {
      polygon.baseZ = 3;
      clickMap(map);
      expect(events).toHaveLength(0);
      polygon.height = 5;
      polygon.baseZ = -2;
      clickMap(map);
      expect(events).toHaveLength(1);
      polygon.height = 1;
      clickMap(map);
      expect(events).toHaveLength(1);
      polygon.baseZ = 1;
      clickMap(map);
      expect(events).toHaveLength(2);
    });
    await paint();
    expect(texts(map)).toHaveLength(1);
    polygon.baseZ = 5;
    await paint();
    expect(texts(map)).toHaveLength(0);
    polygon.baseZ = 0;
    await paint();
    expect(texts(map)).toHaveLength(1);
    polygon.setContour(rectangle(400));

    // Vertical-only bounds still display the offscreen owner; viewport alone excludes its text.
    clickMap(map);
    expect(events).toHaveLength(2);
  });

  it('removes label and hit area when clipping leaves only a boundary and restores them after edits', async () => {
    const map = await createMap({
      layers: [{ id: 'floor', background, intersectionBounds: { max: { x: 100 } } }],
    });
    const events = clicks(map);
    owner(map).setContour(rectangle(100));
    clickMap(map, 95);
    expect(events).toHaveLength(0);
    await paint();
    expect(groups(map)).toHaveLength(0);
    owner(map).setContour(rectangle());
    clickMap(map, 95);
    expect(events[0]!.detail.object).toBe(owner(map));
    await paint();
    expectTopLeft(map, text(map), 90, 130);
  });

  it.each(['query', 'paint'] as const)(
    'has no stale hits after removal/reattachment following %s',
    async sync => {
      const map = await createMap({
        layers: [{ id: 'floor', background, intersectionBounds: { max: { x: 140 } } }],
        objects: [{ ...polygonDefinition(), label: 'Zone' }],
      });
      const polygon = owner(map);
      const events = clicks(map);
      map.objects.remove(polygon);

      if (sync === 'paint') await paint();
      else clickMap(map);

      polygon.setContour(rectangle(200));
      map.objects.add(polygon);
      clickMap(map);
      expect(events).toHaveLength(0);
      await paint();
      expect(groups(map)).toHaveLength(0);
      polygon.setContour(rectangle(20));
      clickMap(map, 45);
      expect(events[0]!.detail.object).toBe(polygon);
      await paint();
      expectTopLeft(map, text(map), 40, 130);
      clickMap(map, 250);
      expect(events).toHaveLength(1);
    },
  );

  it('keeps text/material/geometry updates local and reuses unchanged text metrics', async () => {
    const map = await createMap({
      materialRules: [],
      materials: {
        base: {
          properties: {
            label: {
              font: { size: '20px', family: 'monospace' },
              origin: 'top left',
              offset: { x: '0px', y: '40px' },
            },
          },
        },
        child: { inherits: 'base', properties: {} },
        other: { properties: { label: { font: { size: '20px' } } } },
      },
      objects: [
        { ...polygonDefinition(), material: 'child' },
        { ...polygonDefinition('other', 20, 180), material: 'other' },
      ],
    });
    const other = groups(map, 'other')[0]!;
    const group = groups(map)[0]!;
    const shape = group.querySelector('path')!;
    const node = text(map);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface(map), {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    const measure = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    owner(map).label = 'Edited';
    await paint();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => record.target === node)).toBe(true);
    records.length = 0;
    measure.mockClear();
    map.materials.get('base')!.properties = {
      label: {
        color: '#123456',
        font: { size: '20px', family: 'monospace' },
        origin: 'top left',
        offset: { x: '7px', y: '40px' },
      },
    };
    await paint();
    expect(measure).not.toHaveBeenCalled();
    expect(records.every(record => record.target === node)).toBe(true);
    records.length = 0;
    owner(map).setContour(rectangle(100));
    await paint();
    expect(measure).not.toHaveBeenCalled();
    expect(records.some(record => record.target === shape)).toBe(true);
    expect(records.every(record => !other.contains(record.target))).toBe(true);
    expect(groups(map)[0]).toBe(group);
    expect(text(map)).toBe(node);
    observer.disconnect();
  });

  it('updates text and material before painting, including disappearing/returning labels', async () => {
    const map = await createMap();
    const node = text(map);
    const events = clicks(map);
    map.batch(() => {
      owner(map).label = ' ';
      clickMap(map);
      expect(events).toHaveLength(0);
      owner(map).label = 'Returned';
      map.materials.get('labels')!.properties = {
        label: {
          font: { size: '20px', family: 'monospace' },
          origin: 'top left',
          offset: { x: '0px', y: '80px' },
        },
      };
      clickMap(map);
      expect(events).toHaveLength(0);
      clickMap(map, 105, 175);
      expect(events[0]!.detail.object).toBe(owner(map));
      expect(node.textContent).toBe(LABEL_TEXT);
    });
    await paint();
    expect(text(map)).toBe(node);
    expectTopLeft(map, node, 100, 170);
    expect(node.textContent).toBe('Returned');
    owner(map).label = undefined;
    await paint();
    expect(texts(map)).toHaveLength(0);
  });

  it('keeps shared objects current in two maps and reconnects with separate typography', async () => {
    const first = await createMap({ ...typography({ font: { size: '20px' } }) });
    const second = await createMap({ ...typography({ font: { size: '20px' } }), objects: [] });
    second.style.fontFamily = 'serif';
    const polygon = owner(first);
    second.objects.add(polygon);
    second.layers[0]!.objectIds.add('zone');
    await paint();
    const firstNode = text(first);
    const secondNode = text(second);
    expect(firstNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(secondNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    const firstEvents = clicks(first);
    const secondEvents = clicks(second);
    second.remove();
    first.batch(() => {
      polygon.setContour(rectangle(180));
      polygon.label = 'Shared';
      clickMap(first, 205);
      expect(firstEvents[0]!.detail.object).toBe(polygon);
    });
    document.body.append(second);
    clickMap(second, 205);
    expect(secondEvents[0]!.detail.object).toBe(polygon);
    await paint();
    expect(text(first)).toBe(firstNode);
    expect(text(second)).toBe(secondNode);
    expectTopLeft(first, firstNode, 200, 130);
    expectTopLeft(second, secondNode, 200, 130);
    expect(first.definition!.objects[0]!.label).toBe(LABEL_TEXT);
    expect(second.definition!.objects).toEqual([]);
  });

  it('measures a new owner before its first RAF and preserves pending painting', async () => {
    const map = await createMap({ objects: [] });
    const events = clicks(map);
    const polygon = map.objects.add(polygonDefinition());
    map.layers[0]!.objectIds.add('zone');
    clickMap(map);
    expect(events[0]!.detail.object).toBe(polygon);
    expect(groups(map)).toHaveLength(0);
    await paint();
    expectTopLeft(map, text(map), 100, 130);
  });
});

describe.each(['press', 'release'] as const)(
  'polygon captured hits after synchronous %s',
  trigger => {
    it.each(['direct', 'clipped'] as const)(
      'retains a valid label capture when switching to %s appearance',
      async mode => {
        const map = await createMap({
          layers: [
            {
              id: 'floor',
              background,
              intersectionBounds: { min: { x: 100 } },
              ...(mode === 'clipped' ? { objects: ['zone'] } : {}),
            },
          ],
        });
        const events = clicks(map);
        map.clickTrigger = trigger;
        map.addEventListener(
          trigger,
          () => {
            if (mode === 'direct') map.layers[0]!.objectIds.add('zone');
            else map.layers[0]!.objectIds.remove('zone');
          },
          { once: true },
        );
        clickMap(map, 120);
        expect(events).toHaveLength(1);
        expect(events[0]!.detail.object).toBe(owner(map));
        expect(events[0]!.detail.layer).toBe(map.layers[0]);
        expect(events[0]!.detail.route).toBeUndefined();
      },
    );

    it('retains a still-valid geometry capture across direct/clipped replacement', async () => {
      const map = await createMap({
        layers: [{ id: 'floor', background, intersectionBounds: { min: { x: 100 } } }],
      });
      const events = clicks(map);
      map.clickTrigger = trigger;
      map.addEventListener(trigger, () => map.layers[0]!.objectIds.add('zone'), { once: true });
      clickMap(map, 110, 85);
      expect(events[0]!.detail.object).toBe(owner(map));
    });

    it.each([
      'contour',
      'vertex',
      'baseZ',
      'height',
      'membership',
      'text',
      'material',
      'visibility',
      'remove',
    ] as const)(
      'suppresses an obsolete %s hit without selecting another owner/layer',
      async change => {
        const map = await createMap({
          objects: [{ ...polygonDefinition(), baseZ: -1, height: 3 }],
          layers: [
            { id: 'under', background, objects: ['zone'] },
            { id: 'over', intersectionBounds: FLOOR },
          ],
        });
        const polygon = owner(map);
        const events = clicks(map);
        map.clickTrigger = trigger;
        map.addEventListener(
          trigger,
          () => {
            switch (change) {
              case 'contour':
                polygon.setContour(rectangle(220));
                break;
              case 'vertex':
                polygon.setVertex(1, { x: 280, y: 80 });
                break;
              case 'baseZ':
                polygon.baseZ = 5;
                break;
              case 'height':
                polygon.height = 0;
                break;
              case 'membership':
                map.layers[1]!.objectIds.add('zone');
                polygon.baseZ = 5;
                map.layers[1]!.objectIds.remove('zone');
                break;
              case 'text':
                polygon.label = undefined;
                break;
              case 'material':
                map.materials.get('labels')!.properties = {
                  label: { offset: { x: '0px', y: '80px' } },
                };
                break;
              case 'visibility':
                map.layers[1]!.visible = false;
                break;
              case 'remove':
                map.objects.remove(polygon);
            }
          },
          { once: true },
        );
        clickMap(map);
        expect(events).toHaveLength(0);

        if (change === 'visibility' || change === 'baseZ' || change === 'height') {
          clickMap(map);
          expect(events[0]!.detail.layer).toBe(map.layers[0]);
        }
      },
    );

    it.each(['direct', 'clipped'] as const)(
      'suppresses a moved label capture when switching to %s',
      async mode => {
        const map = await createMap({
          objects: [{ ...polygonDefinition(), contour: rectangle(20, 80, 200) }],
          layers: [
            {
              id: 'floor',
              background,
              intersectionBounds: { max: { x: 40 } },
              ...(mode === 'clipped' ? { objects: ['zone'] } : {}),
            },
          ],
        });
        const events = clicks(map);
        map.clickTrigger = trigger;
        map.addEventListener(
          trigger,
          () => {
            if (mode === 'direct') map.layers[0]!.objectIds.add('zone');
            else map.layers[0]!.objectIds.remove('zone');
          },
          { once: true },
        );

        // At the first pixel of the old label (outside both old/new geometry).
        clickMap(map, mode === 'direct' ? 31 : 300);
        expect(events).toHaveLength(0);
      },
    );
  },
);
