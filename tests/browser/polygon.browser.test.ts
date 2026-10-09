import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapPolygonDefinition } from '#definitions/map-polygon-definition.js';
import type { MapSurfaceEvent } from '#interaction/map-surface-event.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapPolygon } from '#objects/map-polygon.js';

const ELEMENT_NAME = 'atlas-polygon-regression';
const CONTOUR = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];
const U_CONTOUR = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 60, y: 80 },
  { x: 60, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 80 },
  { x: 20, y: 80 },
];
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

function definition(contour = CONTOUR): MapDefinition {
  return {
    objects: [
      { id: 'polygon', kind: 'polygon', contour },
      { id: 'other', kind: 'point', position: { x: 250, y: 200 } },
    ],
    layers: [
      { id: 'background', background },
      { id: 'floor', objects: ['other'], intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
    ],
  };
}

async function createMap(
  data = definition(),
): Promise<{ map: MapElement; surface: SVGSVGElement; spatial: Spatial; polygon: MapPolygon }> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  document.body.append(map);
  maps.push(map);
  await map.load(data);
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();

  return {
    map,
    surface: map.shadowRoot!.querySelector('svg')!,
    spatial: new Spatial(prepareSceneGeometry(map.objects, map.layers)),
    polygon: map.objects.get('polygon') as MapPolygon,
  };
}

function path(surface: SVGSVGElement): SVGPathElement {
  return surface.querySelector<SVGPathElement>(
    '[data-layer-id="floor"] [data-object-id="polygon"] path',
  )!;
}

describe('polygon SVG and component interaction', () => {
  it('renders one filled path without vertex symbols or internal strokes and picks the original object/layer', async () => {
    const { map, surface, polygon } = await createMap();
    const shape = path(surface);
    expect(surface.querySelectorAll('path')).toHaveLength(1);
    expect(surface.querySelectorAll('circle')).toHaveLength(1);
    expect(shape.getAttribute('stroke')).toBe('none');
    expect(shape.getAttribute('fill-rule')).toBe('nonzero');
    expect(shape.isPointInFill(new DOMPoint(50, 50))).toBe(true);
    const clicks: ObjectClickEvent[] = [];
    map.addEventListener('objectclick', event => clicks.push(event as ObjectClickEvent));
    await userEvent.click(surface, { position: { x: 50, y: 50 } });
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.detail.object).toBe(polygon);
    expect(clicks[0]!.detail.layer).toBe(map.layers[1]);
    expect(clicks[0]!.detail.mapPoint.x).toBeCloseTo(50);
    expect(clicks[0]!.detail.mapPoint.y).toBeCloseTo(50);
    expect(clicks[0]!.detail.clientPoint).toBeInstanceOf(Point2);
    expect(clicks[0]!.detail.route).toBeUndefined();

    const image = new Image();
    image.src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${shape.outerHTML}</svg>`,
      );
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const alphas = [48, 49, 50, 51].map(x => context.getImageData(x, 50, 1, 1).data[3]!);
    expect(alphas.every(alpha => alpha >= 76 && alpha <= 77)).toBe(true);
  });

  it('shows disjoint clipped areas in the same path and has no fill or hit in the gap', async () => {
    const data = definition(U_CONTOUR);
    const { map, surface, spatial, polygon } = await createMap({
      ...data,
      layers: [{ id: 'floor', intersectionBounds: { min: { y: 50 }, max: { y: 70 } } }],
    });
    expect(path(surface).isPointInFill(new DOMPoint(30, 60))).toBe(true);
    expect(path(surface).isPointInFill(new DOMPoint(70, 60))).toBe(true);
    expect(path(surface).isPointInFill(new DOMPoint(50, 60))).toBe(false);
    expect(spatial.hitTest(new Point2(30, 60), map.camera)?.object).toBe(polygon);
    expect(spatial.hitTest(new Point2(70, 60), map.camera)?.object).toBe(polygon);
    expect(spatial.hitTest(new Point2(50, 60), map.camera)).toBeUndefined();
    expect(spatial.hitTest(new Point2(30, 70), map.camera)).toBeUndefined();
  });

  it('preserves surviving nodes, writes only affected geometry and synchronizes picking before paint', async () => {
    const { map, surface, polygon, spatial } = await createMap();
    const shape = path(surface);
    const group = shape.parentElement;
    const other = surface.querySelector('[data-object-id="other"]')!;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface, { subtree: true, attributes: true, childList: true });
    polygon.setVertex(0, new Point2(40, 40));
    expect(spatial.hitTest(new Point2(25, 25), map.camera)).toBeUndefined();
    await paint();
    expect(path(surface)).toBe(shape);
    expect(shape.parentElement).toBe(group);
    expect(surface.querySelector('[data-object-id="other"]')).toBe(other);
    expect(records.every(record => record.target === shape && record.attributeName === 'd')).toBe(
      true,
    );
    records.length = 0;
    polygon.baseZ = 1;
    await paint();
    expect(records).toHaveLength(0);
    map.camera.center = new Point2(150, 120);
    await paint();
    expect(
      records.every(record => record.target === surface && record.attributeName === 'viewBox'),
    ).toBe(true);
    observer.disconnect();
  });

  it('suppresses a captured polygon moved out of its layer during the surface event', async () => {
    const { map, surface, polygon } = await createMap();
    const clicks = vi.fn();
    map.addEventListener('objectclick', clicks);
    map.addEventListener(
      'release',
      (event: Event) => {
        expect((event as MapSurfaceEvent).detail.mapPoint.x).toBeCloseTo(50);
        expect((event as MapSurfaceEvent).detail.mapPoint.y).toBeCloseTo(50);
        polygon.baseZ = 3;
      },
      { once: true },
    );
    await userEvent.click(surface, { position: { x: 50, y: 50 } });
    expect(clicks).not.toHaveBeenCalled();
    await paint();
    expect(path(surface)).toBeNull();
  });

  it('keeps the active scene on invalid polygon loads and copies input before asynchronous preparation', async () => {
    const { map, surface, polygon } = await createMap();
    const roots = map.objects;
    const layers = map.layers;
    const snapshot = map.definition;
    const shape = path(surface);
    const center = map.camera.center;
    const invalid = {
      ...definition(),
      objects: [
        {
          id: 'bad',
          kind: 'polygon',
          contour: CONTOUR.map((point, index) =>
            index === 0 ? { ...point, z: undefined } : point,
          ),
        },
      ],
    } as MapDefinition;
    await expect(map.load(invalid)).rejects.toMatchObject({ code: 'INVALID_POLYGON_VERTEX' });
    expect(map.objects).toBe(roots);
    expect(map.layers).toBe(layers);
    expect(map.definition).toBe(snapshot);
    expect(path(surface)).toBe(shape);
    expect(map.camera.center).toBe(center);
    expect(map.objects.get('polygon')).toBe(polygon);
    const contour = CONTOUR.map(point => ({ ...point }));
    const input: MapPolygonDefinition = { id: 'polygon', kind: 'polygon', contour, baseZ: 1 };
    const loading = map.load({
      objects: [input],
      layers: [{ id: 'floor', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } }],
    });
    contour[0]!.x = 999;
    await loading;
    expect((map.objects.get('polygon') as MapPolygon).contour).toEqual(CONTOUR);
  });

  it('drops empty-area appearances and restores hidden/disconnected and detached edits', async () => {
    const { map, surface, polygon, spatial } = await createMap();
    const shape = path(surface);
    map.layers[1]!.visible = false;
    polygon.setContour([
      { x: 100, y: 40 },
      { x: 160, y: 40 },
      { x: 160, y: 80 },
      { x: 100, y: 80 },
    ]);
    expect(spatial.hitTest(new Point2(120, 60), map.camera)).toBeUndefined();
    map.remove();
    polygon.setVertex(0, new Point2(90, 30));
    document.body.append(map);
    map.layers[1]!.visible = true;
    await paint();
    expect(path(surface)).toBe(shape);
    expect(shape.isPointInFill(new DOMPoint(120, 60))).toBe(true);
    map.objects.remove(polygon);
    expect(spatial.hitTest(new Point2(120, 60), map.camera)).toBeUndefined();
    polygon.setVertex(0, new Point2(80, 20));
    map.objects.add(polygon);
    await paint();
    expect(path(surface)).toBe(shape);
    expect(spatial.hitTest(new Point2(120, 60), map.camera)?.object).toBe(polygon);
    await map.load({
      objects: [{ id: 'polygon', kind: 'polygon', contour: CONTOUR }],
      layers: [{ id: 'floor', intersectionBounds: { min: { x: 80 } } }],
    });
    await paint();
    expect(path(surface)).toBeNull();
  });
  it('shares a volume across floors and leaves SVG paths untouched for height-only changes', async () => {
    const { map, surface, polygon, spatial } = await createMap({
      objects: [{ id: 'polygon', kind: 'polygon', contour: CONTOUR, baseZ: 1, height: 4 }],
      layers: [
        { id: 'floor', intersectionBounds: { min: { z: 0 }, max: { z: 3 } } },
        { id: 'upper', intersectionBounds: { min: { z: 3 }, max: { z: 6 } } },
      ],
    });
    const paths = [...surface.querySelectorAll('path')];
    expect(paths).toHaveLength(2);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface, { subtree: true, attributes: true, childList: true });
    polygon.height = 5;
    expect(spatial.hitTest(new Point2(50, 50), map.camera)?.layer).toBe(map.layers[1]);
    await paint();
    expect([...surface.querySelectorAll('path')]).toEqual(paths);
    expect(records).toHaveLength(0);
    const clicks: ObjectClickEvent[] = [];
    map.addEventListener('objectclick', event => clicks.push(event as ObjectClickEvent));
    await userEvent.click(surface, { position: { x: 50, y: 50 } });
    expect(clicks.at(-1)!.detail.object).toBe(polygon);
    expect(clicks.at(-1)!.detail.layer).toBe(map.layers[1]);
    map.layers[1]!.visible = false;
    expect(spatial.hitTest(new Point2(50, 50), map.camera)?.layer).toBe(map.layers[0]);
    polygon.height = 0;
    await paint();
    expect(path(surface)).toBe(paths[0]);
    await expect(
      map.load({
        layers: [],
        objects: [
          {
            id: 'polygon',
            kind: 'polygon',
            contour: CONTOUR,
            baseZ: Number.MAX_VALUE,
            height: Number.MAX_VALUE,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_POLYGON_VERTICAL_RANGE' });
    expect(map.objects.get('polygon')).toBe(polygon);
    observer.disconnect();
  });
});
