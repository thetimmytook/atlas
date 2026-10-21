import { afterEach, describe, expect, it, vi } from 'vitest';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Rect } from '#math/rect.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapPolygon } from '#objects/map-polygon.js';
import type { MapRoute } from '#objects/map-route.js';

const ELEMENT_NAME = 'atlas-hidden-zoom-test';
const MAPS: MapElement[] = [];
const IDS = ['circle', 'icon', 'line', 'route', 'polygon'];
customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  MAPS.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

function frame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

async function settle(): Promise<void> {
  await frame();
  await frame();
}

function definition(): MapDefinition {
  return {
    resources: { icon: { kind: 'image', source: background.source } },
    materials: {
      base: {
        properties: {
          label: {
            font: { size: '16px' },
            origin: 'top left',
            offset: { x: '12px', y: '20px' },
          },
        },
      },
      marker: { inherits: 'base', properties: { size: 12 } },
      icon: {
        inherits: 'base',
        properties: {
          symbol: 'image',
          image: { resource: 'icon', preserveAspectRatio: false, width: 20, height: 10 },
        },
      },
    },
    materialRules: [
      { when: { kind: 'point' }, material: 'marker' },
      { when: { kind: ['line', 'route', 'polygon'] }, material: 'base' },
    ],
    objects: [
      { kind: 'point', id: 'circle', label: 'Circle', position: { x: 80, y: 60 } },
      { kind: 'point', id: 'icon', label: 'Icon', material: 'icon', position: { x: 240, y: 60 } },
      {
        kind: 'line',
        id: 'line',
        label: 'Line',
        points: [
          { kind: 'point', position: { x: 20, y: 110 } },
          { kind: 'point', position: { x: 100, y: 110 } },
        ],
      },
      {
        kind: 'route',
        id: 'route',
        label: 'Route',
        points: [
          {
            kind: 'point',
            id: 'owned',
            label: 'Owned',
            pickable: true,
            position: { x: 160, y: 110 },
          },
          { kind: 'point', position: { x: 200, y: 110 } },
          { kind: 'point', position: { x: 200, y: 150 } },
        ],
      },
      {
        kind: 'polygon',
        id: 'polygon',
        label: 'Polygon',
        contour: [
          { x: 40, y: 160 },
          { x: 100, y: 160 },
          { x: 100, y: 200 },
          { x: 40, y: 200 },
        ],
      },
    ],
    layers: [
      { id: 'a0', objects: IDS },
      { id: 'a1', objects: IDS },
      { id: 'b0', objects: IDS },
      { id: 'b1', objects: IDS },
    ],
  };
}

async function createMap(input = definition()): Promise<MapElement> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.cssText = 'display:block;width:320px;height:240px;font-family:monospace;';
  MAPS.push(map);
  document.body.append(map);
  await map.load(input);
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await settle();

  return map;
}

function svg(map: MapElement): SVGSVGElement {
  return map.shadowRoot!.querySelector('svg')!;
}

function layerNode(map: MapElement, layer: string): SVGGElement {
  return svg(map).querySelector(`[data-layer-id="${layer}"]`)!;
}

function group(map: MapElement, layer: string, id: string): SVGGElement {
  return layerNode(map, layer).querySelector(`[data-object-id="${id}"]`)!;
}

function layer(map: MapElement, id: string): MapLayer {
  return map.layers.find(value => value.id === id)!;
}

function text(map: MapElement, floor: string, id: string): SVGTextElement {
  return layerNode(map, floor).querySelector(`[data-object-id="${id}"] > text`)!;
}

/** Expected attachment is analytic; placement and size are read from browser output. */
function expectLabel(
  map: MapElement,
  floor: string,
  id: string,
  x: number,
  y: number,
  size = 16,
): void {
  const node = text(map, floor, id);
  expect(node).not.toBeNull();
  const anchor = map.coordinates.mapToClient(new Point2(x, y));
  const box = node.getBoundingClientRect();
  expect(box.x).toBeCloseTo(anchor.x + 12, 3);
  expect(box.y).toBeCloseTo(anchor.y + 20, 3);
  expect(node.getAttribute('font-size')).toBe(String(size));

  // Local SVG glyph bounds exclude camera transforms; Canvas advance widths can differ by font.
  const local = node.getBBox();
  expect(box.width).toBeCloseTo(local.width, 3);
  expect(box.height).toBeCloseTo(local.height, 3);
}

async function hiddenZoom(map: MapElement, id = 'a1'): Promise<void> {
  layer(map, id).visible = false;
  await settle();

  for (const zoom of [1.25, 0.75, 2]) {
    map.camera.zoom = zoom;
    await settle();
  }
}

function clickLabel(map: MapElement, x: number, y: number): void {
  const client = map.coordinates.mapToClient(new Point2(x, y));

  for (const type of ['pointerdown', 'pointerup']) {
    svg(map).dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientX: client.x + 13,
        clientY: client.y + 21,
      }),
    );
  }
}

describe('hidden-layer zoom', () => {
  it('skips hidden writes and catches up on first RAF', async () => {
    const map = await createMap();
    layer(map, 'a1').visible = false;
    layer(map, 'b1').visible = false;
    await settle();
    const nodes = Array.from(svg(map).querySelectorAll('*'));
    const hiddenMarkup = layerNode(map, 'a1').outerHTML;
    const writes = vi.spyOn(Element.prototype, 'setAttribute');
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');

    for (const zoom of [1.25, 0.75, 2]) {
      map.camera.zoom = zoom;
      await settle();
    }

    expect(layerNode(map, 'a1').outerHTML).toBe(hiddenMarkup);

    // The spy observes all calls even when MutationObserver delivers between RAFs.
    const targets = writes.mock.contexts.filter(
      (_node, index) => writes.mock.calls.at(index)![0] === 'transform',
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(
      targets.every(
        node => (node as Element).closest('[data-layer-id]')?.getAttribute('display') !== 'none',
      ),
    ).toBe(true);
    expect(measurements).not.toHaveBeenCalled();
    expect(
      group(map, 'a0', 'circle').querySelector('circle')!.getBoundingClientRect().width,
    ).toBeCloseTo(12);
    layer(map, 'a1').visible = true;
    await frame();
    expect(
      group(map, 'a1', 'circle').querySelector('circle')!.getBoundingClientRect().width,
    ).toBeCloseTo(12);
    const icon = group(map, 'a1', 'icon').querySelector('image')!.getBoundingClientRect();
    expect([icon.width, icon.height]).toEqual([20, 10]);
    expectLabel(map, 'a1', 'circle', 80, 60);
    expectLabel(map, 'a1', 'icon', 240, 60);
    expectLabel(map, 'a1', 'line', 60, 110);
    expectLabel(map, 'a1', 'route', 200, 110);
    expectLabel(map, 'a1', 'polygon', 70, 180);
    expectLabel(map, 'a1', 'owned', 160, 110);
    expect(Array.from(svg(map).querySelectorAll('*'))).toEqual(nodes);
    expect(layerNode(map, 'b1').getAttribute('display')).toBe('none');
  });

  it('shows independent floors and new hidden roots', async () => {
    const map = await createMap();
    await hiddenZoom(map);
    layer(map, 'b1').visible = false;
    await settle();
    map.objects.add({ kind: 'point', id: 'new', label: 'New', position: { x: 110, y: 70 } });
    layer(map, 'a1').objectIds.add('new');
    await settle();
    layer(map, 'a0').visible = false;
    layer(map, 'a1').visible = true;
    await frame();
    expectLabel(map, 'a1', 'new', 110, 70);
    expect(
      group(map, 'a1', 'new').querySelector('circle')!.getBoundingClientRect().width,
    ).toBeCloseTo(12);
    expect(layerNode(map, 'b0').getAttribute('display')).toBeNull();
    expect(layerNode(map, 'b1').getAttribute('display')).toBe('none');
    layer(map, 'b0').visible = false;
    layer(map, 'b1').visible = true;
    await frame();
    expectLabel(map, 'b1', 'route', 200, 110);
    expect(layerNode(map, 'a1').getAttribute('display')).toBeNull();
    expect(map.camera.zoom).toBe(2);
  });

  it('uses current hidden edits and preserves nodes', async () => {
    const map = await createMap();
    const circle = map.objects.get('circle') as MapPoint;
    const originalGroup = group(map, 'a1', 'circle');
    const originalText = text(map, 'a1', 'circle');
    const originalImage = group(map, 'a1', 'icon').querySelector('image');
    await hiddenZoom(map);
    circle.position = new Point3(110, 80);
    circle.label = 'Changed';
    map.style.fontFamily = 'serif';
    map.materials.get('base')!.properties = {
      label: {
        font: { size: '20px', weight: 'bold' },
        color: '#123456',
        origin: 'top left',
        offset: { x: '12px', y: '20px' },
      },
    };
    map.materials.get('marker')!.properties = {
      symbol: 'image',
      image: { resource: 'icon', preserveAspectRatio: false, width: 32, height: 14 },
    };
    map.materials.get('icon')!.properties = {
      symbol: 'image',
      image: { resource: 'icon', preserveAspectRatio: false, width: 42, height: 22 },
    };
    await settle();
    map.camera.zoom = 3;
    await settle();
    layer(map, 'a1').visible = true;
    await frame();
    expect(group(map, 'a1', 'circle')).toBe(originalGroup);
    expect(text(map, 'a1', 'circle')).toBe(originalText);
    expect(originalText.textContent).toBe('Changed');
    expect(originalText.getAttribute('font-family')).toBe('serif');
    expect(originalText.getAttribute('fill')).toBe('#123456');
    expect(originalText.getAttribute('stroke')).toBe('#ffffff');
    expectLabel(map, 'a1', 'circle', 110, 80, 20);
    const image = originalGroup.querySelector('image')!.getBoundingClientRect();
    expect(image.width).toBeCloseTo(32, 3);
    expect(image.height).toBeCloseTo(14, 3);
    expect(group(map, 'a1', 'icon').querySelector('image')).toBe(originalImage);
    const resized = originalImage!.getBoundingClientRect();
    expect(resized.width).toBeCloseTo(42, 3);
    expect(resized.height).toBeCloseTo(22, 3);
    layer(map, 'a1').visible = false;
    map.materials.get('marker')!.properties = { symbol: 'circle', size: 18 };
    await settle();
    map.camera.zoom = 1.5;
    await settle();
    layer(map, 'a1').visible = true;
    await frame();
    expect(originalGroup.querySelector('circle')!.getBoundingClientRect().width).toBeCloseTo(18);
    expect(text(map, 'a1', 'circle')).toBe(originalText);
  });

  it('picks all kinds immediately in nested batch', async () => {
    const map = await createMap();
    const events: ObjectClickEvent[] = [];
    map.addEventListener('objectclick', event => events.push(event as ObjectClickEvent));
    vi.spyOn(svg(map), 'setPointerCapture').mockImplementation(() => {});
    await hiddenZoom(map);

    // Hide every other appearance so hits identify the newly shown layer.
    map.layers
      .filter(value => value.id !== 'a1')
      .forEach(value => {
        value.visible = false;
      });
    const point = map.objects.get('circle') as MapPoint;
    const oldText = text(map, 'a1', 'circle');
    map.camera.zoom = 1.5;
    await settle();
    map.batch(() => {
      map.batch(() => {
        point.position = new Point3(100, 75);
        point.label = 'Immediate';
        layer(map, 'a1').visible = true;
        expect(layerNode(map, 'a1').getAttribute('display')).toBe('none');
        clickLabel(map, 100, 75);
        clickLabel(map, 60, 110);
        clickLabel(map, 200, 110);
        clickLabel(map, 70, 180);
        clickLabel(map, 160, 110);
        expect(events.map(event => event.detail.object.id)).toEqual([
          'circle',
          'line',
          'route',
          'polygon',
          'owned',
        ]);
        expect(events.every(event => event.detail.layer === layer(map, 'a1'))).toBe(true);
        expect(events.at(-1)!.detail.route).toBe(map.objects.get('route'));
      });
      expect(text(map, 'a1', 'circle').textContent).toBe('Circle');
    });
    await frame();
    expect(text(map, 'a1', 'circle')).toBe(oldText);
    expectLabel(map, 'a1', 'circle', 100, 75);
    expect(oldText.textContent).toBe('Immediate');
  });

  it('reconciles clipped/direct appearances and labels', async () => {
    const input: MapDefinition = {
      ...definition(),
      layers: [{ id: 'a1', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } }],
      objects: [
        {
          kind: 'route',
          id: 'route',
          label: 'Fragments',
          points: [
            { kind: 'point', position: { x: 20, y: 100, z: 1 } },
            { kind: 'point', position: { x: 120, y: 100, z: 5 } },
            { kind: 'point', position: { x: 260, y: 100, z: 1 } },
          ],
        },
        {
          kind: 'polygon',
          id: 'polygon',
          label: 'Zone',
          baseZ: 1,
          height: 1,
          contour: [
            { x: 40, y: 160 },
            { x: 100, y: 160 },
            { x: 100, y: 200 },
            { x: 40, y: 200 },
          ],
        },
      ],
    };
    const map = await createMap(input);
    const route = map.objects.get('route') as MapRoute;
    const polygon = map.objects.get('polygon') as MapPolygon;
    const routeText = text(map, 'a1', 'route');
    const polygonGroup = group(map, 'a1', 'polygon');
    const polygonText = text(map, 'a1', 'polygon');
    expectLabel(map, 'a1', 'route', 200, 100);
    await hiddenZoom(map);
    layer(map, 'a1').objectIds.add('route');
    layer(map, 'a1').objectIds.add('polygon');
    polygon.setContour([
      { x: 60, y: 140 },
      { x: 120, y: 140 },
      { x: 120, y: 180 },
      { x: 60, y: 180 },
    ]);
    await settle();
    map.camera.zoom = 1.5;
    await settle();
    layer(map, 'a1').visible = true;
    await frame();
    expect(text(map, 'a1', 'route')).toBe(routeText);
    expect(group(map, 'a1', 'polygon')).toBe(polygonGroup);
    expect(text(map, 'a1', 'polygon')).toBe(polygonText);
    expectLabel(map, 'a1', 'route', 140, 100);
    expectLabel(map, 'a1', 'polygon', 90, 160);
    layer(map, 'a1').visible = false;
    layer(map, 'a1').objectIds.remove('route');
    layer(map, 'a1').objectIds.remove('polygon');
    route.label = '';
    polygon.baseZ = 5;
    await settle();
    expect(layerNode(map, 'a1').querySelectorAll('[data-object-id="route"]')).toHaveLength(2);
    expect(text(map, 'a1', 'route')).toBeNull();
    expect(group(map, 'a1', 'polygon')).toBeNull();
    route.points.forEach(point => {
      point.position = new Point3(point.position.x, 100, 5);
    });
    await settle();
    expect(group(map, 'a1', 'route')).toBeNull();
    route.points[0]!.position = new Point3(20, 100, 1);
    route.label = 'Returned';
    polygon.baseZ = 1;
    await settle();
    map.camera.zoom = 2.5;
    await settle();
    layer(map, 'a1').visible = true;
    await frame();
    expect(layerNode(map, 'a1').querySelectorAll('[data-object-id="route"]')).toHaveLength(1);
    expectLabel(map, 'a1', 'route', 45, 100);
    expectLabel(map, 'a1', 'polygon', 90, 160);
  });

  it('reattaches shared objects and reconnects', async () => {
    const first = await createMap();
    const second = await createMap({ ...definition(), objects: [], layers: [{ id: 'a1' }] });
    layer(second, 'a1').objectIds.add('circle');
    const point = first.objects.get('circle') as MapPoint;
    second.objects.add(point);
    await settle();
    await hiddenZoom(first);
    layer(second, 'a1').visible = false;
    second.camera.zoom = 3;
    await settle();
    const secondGroup = group(second, 'a1', 'circle');
    const secondText = text(second, 'a1', 'circle');
    first.objects.remove(point);
    await settle();
    expect(group(first, 'a1', 'circle')).toBeNull();
    first.remove();
    point.position = new Point3(110, 80);
    point.label = 'Shared current';
    first.objects.add(point);
    first.camera.zoom = 1.5;
    layer(first, 'a1').visible = true;
    document.body.append(first);
    layer(second, 'a1').visible = true;
    await settle();
    expect(first.objects.get('circle')).toBe(point);
    expect(second.objects.get('circle')).toBe(point);
    expect(group(second, 'a1', 'circle')).toBe(secondGroup);
    expect(text(second, 'a1', 'circle')).toBe(secondText);
    expectLabel(first, 'a1', 'circle', 110, 80);
    expectLabel(second, 'a1', 'circle', 110, 80);
    expect(
      group(first, 'a1', 'circle').querySelector('circle')!.getBoundingClientRect().width,
    ).toBeCloseTo(12);
    expect(secondGroup.querySelector('circle')!.getBoundingClientRect().width).toBeCloseTo(12);
  });

  it('retains show work through a zero viewport', async () => {
    const map = await createMap();
    await hiddenZoom(map);
    map.style.width = '0px';
    map.style.height = '0px';
    await expect.poll(() => map.camera.viewport.width).toBe(0);
    layer(map, 'a1').visible = true;
    (map.objects.get('circle') as MapPoint).position = new Point3(100, 75);
    await settle();
    map.style.width = '320px';
    map.style.height = '240px';
    await expect.poll(() => map.camera.viewport.width).toBe(320);
    await settle();
    expectLabel(map, 'a1', 'circle', 100, 75);
    expect(
      group(map, 'a1', 'circle').querySelector('circle')!.getBoundingClientRect().width,
    ).toBeCloseTo(12);
  });
});
