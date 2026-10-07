import { afterEach, describe, expect, it } from 'vitest';

import { Point } from '#math/point.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';

import {
  background,
  captureShapes,
  BACKGROUND_SOURCE,
  expectGroups,
  expectLine,
  expectPoint,
  expectPolyline,
  expectSurvivingShapes,
  pointDefinition,
  shape,
  svgGroups,
} from './fixtures.js';

import type { MapLine } from '#objects/map-line.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';

const OBJECT_ID_ATTRIBUTE = 'data-object-id';
const VIEWPORT = new Size(320, 240);
const BOUNDS = new Rect(0, 0, 320, 240);
const surfaces: SVGSVGElement[] = [];

afterEach(() => {
  surfaces.splice(0).forEach(surface => surface.remove());
});

function createSurface(): SVGSVGElement {
  const surface = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  surface.style.display = 'block';
  surface.style.stroke = '#d95012';
  document.body.append(surface);
  surfaces.push(surface);

  return surface;
}

async function prepareRenderer(objects: MapObjectCollection): Promise<{
  surface: SVGSVGElement;
  renderer: SvgRenderer;
  originalShapes: ReadonlyMap<SVGGElement, Element | null>;
}> {
  const surface = createSurface();
  const renderer = new SvgRenderer(surface);
  const prepared = await renderer.prepare(background, prepareSceneGeometry(objects));
  prepared.show();

  return { surface, renderer, originalShapes: captureShapes(surface) };
}

function mixedScene(): {
  objects: MapObjectCollection;
  point: MapPoint;
  line: MapLine;
  route: MapRoute;
} {
  const objects = new MapObjectCollection();
  const point = objects.add(pointDefinition(40, 30, 'point'));
  const line = objects.add({
    id: 'line',
    kind: 'line',
    points: [pointDefinition(20, 60, 'start'), pointDefinition(200, 60, 'end')],
  });
  const route = objects.add({
    id: 'route',
    kind: 'route',
    points: [
      pointDefinition(50, 100, 'a'),
      pointDefinition(150, 120, 'b'),
      pointDefinition(250, 100, 'c'),
    ],
  });

  return { objects, point, line, route };
}

describe('real SvgRenderer scene output', () => {
  it('prepares off-screen, then shows background and mixed appearances in composition order', async () => {
    const { objects } = mixedScene();
    const surface = createSurface();
    const renderer = new SvgRenderer(surface);
    const prepared = await renderer.prepare(background, prepareSceneGeometry(objects));
    expect(surface.children).toHaveLength(0);

    prepared.show();
    const originalShapes = captureShapes(surface);
    const image = surface.querySelector('image')!;
    const groups = svgGroups(surface);
    expect(Array.from(surface.children, child => child.localName)).toEqual([
      'image',
      'g',
      'g',
      'g',
      'g',
      'g',
      'g',
    ]);
    expect(surface.firstElementChild).toBe(image);
    expect(image.getAttribute('href')).toBe(BACKGROUND_SOURCE);
    expect(image.getAttribute('width')).toBe('320');
    expect(image.getAttribute('height')).toBe('240');
    expect(groups.map(group => group.getAttribute(OBJECT_ID_ATTRIBUTE))).toEqual([
      'point',
      'line',
      'route',
      'a',
      'b',
      'c',
    ]);
    expect(groups.map(group => group.firstElementChild?.localName)).toEqual([
      'circle',
      'line',
      'polyline',
      'circle',
      'circle',
      'circle',
    ]);
    groups.forEach(group => expect(group.getAttribute('visibility')).toBe('hidden'));

    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expect(surface.getAttribute('viewBox')).toBe('0 0 320 240');
    expect(surface.getAttribute('width')).toBe('320');
    expect(surface.getAttribute('height')).toBe('240');
    expectPoint(groups[0]!, 40, 30);
    expectLine(groups[1]!, [20, 60, 200, 60]);
    expectPolyline(groups[2]!, '50,100 150,120 250,100');
    expectPoint(groups[3]!, 50, 100);
    expectPoint(groups[4]!, 150, 120);
    expectPoint(groups[5]!, 250, 100);
    expectGroups(surface, groups);
  });

  it('moves a point and both line endpoints while retaining their groups and shapes', async () => {
    const { objects, point, line } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const groups = svgGroups(surface);
    const shapes = groups.map(group => group.firstElementChild);

    point.position = new Point(80, 45);
    line.points[0].position = new Point(30, 70);
    line.points[1].position = new Point(220, 90);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);

    expectPoint(groups[0]!, 80, 45);
    expectLine(groups[1]!, [30, 70, 220, 90]);
    expectGroups(surface, groups);
    groups.forEach((group, index) => expect(group.firstElementChild).toBe(shapes.at(index)));
  });

  it('moves a route vertex in both its symbol and polyline, preserving all nodes', async () => {
    const { objects, route } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const groups = svgGroups(surface);
    const polyline = shape<SVGPolylineElement>(groups[2]!, 'polyline');
    const circle = shape<SVGCircleElement>(groups[4]!, 'circle');

    route.points[1]!.position = new Point(170, 140);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);

    expectPolyline(groups[2]!, '50,100 170,140 250,100');
    expectPoint(groups[4]!, 170, 140);
    expectGroups(surface, groups);
    expect(shape(groups[2]!, 'polyline')).toBe(polyline);
    expect(shape(groups[4]!, 'circle')).toBe(circle);
  });

  it('appends a new route symbol after the survivors and extends the path', async () => {
    const { objects, route } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const before = svgGroups(surface);
    route.addPoint(pointDefinition(280, 160, 'appended'));
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const appended = svgGroups(surface)[6]!;

    expectGroups(surface, [...before, appended]);
    expect(appended.getAttribute(OBJECT_ID_ATTRIBUTE)).toBe('appended');
    expectPoint(appended, 280, 160);
    expectPolyline(before[2]!, '50,100 150,120 250,100 280,160');
  });

  it('inserts a symbol between existing vertices without replacing surviving nodes', async () => {
    const { objects, route } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const before = svgGroups(surface);
    route.insertPoint(1, pointDefinition(90, 150, 'inserted'));
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const inserted = svgGroups(surface)[4]!;

    expectGroups(surface, [...before.slice(0, 4), inserted, ...before.slice(4)]);
    expect(inserted.getAttribute(OBJECT_ID_ATTRIBUTE)).toBe('inserted');
    expectPoint(inserted, 90, 150);
    expectPolyline(before[2]!, '50,100 90,150 150,120 250,100');
  });

  it('removes a vertex symbol and joins its neighbors without stale geometry', async () => {
    const { objects, route } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const before = svgGroups(surface);
    const removed = route.points[1]!;
    route.removePoint(removed);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);

    expectGroups(surface, [before[0]!, before[1]!, before[2]!, before[3]!, before[5]!]);
    expect(before[4]!.isConnected).toBe(false);
    expectPolyline(before[2]!, '50,100 250,100');
    removed.position = new Point(999, 999);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectPolyline(before[2]!, '50,100 250,100');
  });

  it.each([
    { count: 1, points: '10,20 80,90 280,30' },
    { count: 2, points: '10,20 80,90 120,100 280,30' },
    { count: 3, points: '10,20 80,90 120,100 160,110 280,30' },
  ])(
    'replaces an interior with $count vertices, including same-length replacement and duplicate IDs',
    async ({ count, points }) => {
      const objects = new MapObjectCollection();
      const route = objects.add({
        kind: 'route',
        id: 'route',
        points: [
          pointDefinition(10, 20, 'same'),
          pointDefinition(60, 40, 'same'),
          pointDefinition(200, 40, 'same'),
          pointDefinition(280, 30, 'same'),
        ],
      });
      const { surface, renderer, originalShapes } = await prepareRenderer(objects);
      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      const [path, first, removedA, removedB, last] = svgGroups(surface);
      const definitions = [
        pointDefinition(80, 90, 'same'),
        pointDefinition(120, 100, 'same'),
        pointDefinition(160, 110, 'same'),
      ].slice(0, count);

      route.replacePoints(1, 3, definitions);
      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      const replacements = svgGroups(surface).slice(2, 2 + count);
      expectGroups(surface, [path!, first!, ...replacements, last!]);
      expectPolyline(path!, points);
      expectPoint(first!, 10, 20);
      expectPoint(last!, 280, 30);
      replacements.forEach((node, index) => {
        expect(node).not.toBe(removedA);
        expect(node).not.toBe(removedB);
        expect(node.getAttribute(OBJECT_ID_ATTRIBUTE)).toBe(definitions.at(index)!.id);
        expectPoint(node, definitions.at(index)!.position.x, definitions.at(index)!.position.y);
      });
      expect(removedA!.isConnected).toBe(false);
      expect(removedB!.isConnected).toBe(false);
    },
  );

  it('transitions empty → one → two → one → empty without inventing or retaining a segment', async () => {
    const objects = new MapObjectCollection();
    const route = objects.add({ id: 'route', kind: 'route', points: [] });
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const path = svgGroups(surface)[0]!;
    expectGroups(surface, [path]);
    expectPolyline(path, '');

    const first = route.addPoint(pointDefinition(40, 80, 'first'));
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const firstNode = svgGroups(surface)[1]!;
    expectGroups(surface, [path, firstNode]);
    expectPolyline(path, '');
    expectPoint(firstNode, 40, 80);

    const second = route.addPoint(pointDefinition(140, 100, 'second'));
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const secondNode = svgGroups(surface)[2]!;
    expectGroups(surface, [path, firstNode, secondNode]);
    expectPolyline(path, '40,80 140,100');

    route.removePoint(first);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectGroups(surface, [path, secondNode]);
    expectPolyline(path, '');
    expect(firstNode.isConnected).toBe(false);
    expectPoint(secondNode, 140, 100);

    route.removePoint(second);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectGroups(surface, [path]);
    expectPolyline(path, '');
    expect(secondNode.isConnected).toBe(false);
  });

  it('adds and removes whole roots, including every route appearance, retaining the background and survivors', async () => {
    const { objects } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const image = surface.firstElementChild;
    const before = svgGroups(surface);
    const extra = objects.add({
      id: 'extra',
      kind: 'route',
      points: [pointDefinition(20, 200, 'extra-a'), pointDefinition(80, 200, 'extra-b')],
    });
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const added = svgGroups(surface).slice(6);
    expectGroups(surface, [...before, ...added]);
    expect(added.map(group => group.getAttribute(OBJECT_ID_ATTRIBUTE))).toEqual([
      'extra',
      'extra-a',
      'extra-b',
    ]);
    expectPolyline(added[0]!, '20,200 80,200');
    expectPoint(added[1]!, 20, 200);
    expectPoint(added[2]!, 80, 200);

    objects.remove(extra);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectGroups(surface, before);
    added.forEach(node => expect(node.isConnected).toBe(false));
    expect(surface.firstElementChild).toBe(image);
  });

  it('detects remove+add with the same root count and duplicate IDs before any render', async () => {
    const objects = new MapObjectCollection();
    const old = objects.add(pointDefinition(30, 40, 'same'));
    const survivor = objects.add(pointDefinition(90, 40, 'same'));
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const [oldNode, survivorNode] = svgGroups(surface);
    objects.remove(old);
    const replacement = objects.add(pointDefinition(170, 80, 'same'));
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const newNode = svgGroups(surface)[1]!;

    expectGroups(surface, [survivorNode!, newNode]);
    expect(oldNode!.isConnected).toBe(false);
    expect(newNode).not.toBe(oldNode);
    expectPoint(survivorNode!, 90, 40);
    expectPoint(newNode, 170, 80);
    expect(svgGroups(surface).map(group => group.getAttribute(OBJECT_ID_ATTRIBUTE))).toEqual([
      'same',
      'same',
    ]);
    old.position = new Point(999, 999);
    survivor.position = new Point(95, 45);
    replacement.position = new Point(180, 85);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectPoint(survivorNode!, 95, 45);
    expectPoint(newNode, 180, 85);
  });

  it.each(['root', 'vertex'] as const)(
    'keeps separate appearances of a shared point when its %s appearance is removed',
    async appearance => {
      const objects = new MapObjectCollection();
      const route = objects.add({
        id: 'route',
        kind: 'route',
        points: [pointDefinition(30, 80, 'shared'), pointDefinition(150, 80, 'end')],
      });
      const shared = route.points[0]!;
      objects.add(shared);
      const { surface, renderer, originalShapes } = await prepareRenderer(objects);
      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      const [path, vertex, end, root] = svgGroups(surface);
      expect(root).not.toBe(vertex);
      expect(vertex!.getAttribute(OBJECT_ID_ATTRIBUTE)).toBe(
        root!.getAttribute(OBJECT_ID_ATTRIBUTE),
      );

      shared.position = new Point(50, 100);
      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      expectPoint(root!, 50, 100);
      expectPoint(vertex!, 50, 100);
      expectPolyline(path!, '50,100 150,80');

      if (appearance === 'root') {
        objects.remove(shared);
      } else {
        route.removePoint(shared);
      }

      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      const surviving = appearance === 'root' ? vertex! : root!;
      const removed = appearance === 'root' ? root! : vertex!;
      expectGroups(surface, [
        path!,
        ...(appearance === 'root' ? [vertex!] : []),
        end!,
        ...(appearance === 'vertex' ? [root!] : []),
      ]);
      expect(removed.isConnected).toBe(false);
      shared.position = new Point(70, 110);
      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      expectPoint(surviving, 70, 110);
      expectPolyline(path!, appearance === 'root' ? '70,110 150,80' : '');

      if (appearance === 'root') {
        route.removePoint(shared);
      } else {
        objects.remove(shared);
      }

      renderer.render(VIEWPORT, BOUNDS);
      expectSurvivingShapes(surface, originalShapes);
      expectGroups(surface, [path!, end!]);
      expect(surviving.isConnected).toBe(false);
    },
  );

  it('pans, zooms and resizes with stable nodes and constant CSS-pixel symbols and strokes', async () => {
    const { objects } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    const groups = svgGroups(surface);
    const circle = shape<SVGCircleElement>(groups[0]!, 'circle');
    const line = shape<SVGLineElement>(groups[1]!, 'line');
    const polyline = shape<SVGPolylineElement>(groups[2]!, 'polyline');
    const steps = [
      { viewport: VIEWPORT, bounds: new Rect(20, 10, 320, 240), screen: [20, 20], scale: 1 },
      { viewport: VIEWPORT, bounds: new Rect(0, 0, 160, 120), screen: [80, 60], scale: 0.5 },
      {
        viewport: new Size(480, 320),
        bounds: new Rect(-40, -20, 240, 160),
        screen: [160, 100],
        scale: 0.5,
      },
      { viewport: VIEWPORT, bounds: new Rect(0, 0, 640, 480), screen: [20, 15], scale: 2 },
    ];

    for (const { viewport, bounds, screen, scale } of steps) {
      renderer.render(viewport, bounds);
      expectSurvivingShapes(surface, originalShapes);
      expectGroups(surface, groups);
      expect(surface.getAttribute('viewBox')).toBe(
        [bounds.x, bounds.y, bounds.width, bounds.height].join(' '),
      );
      expect(surface.getAttribute('width')).toBe(String(viewport.width));
      expect(surface.getAttribute('height')).toBe(String(viewport.height));
      expectPoint(groups[0]!, 40, 30);
      expectLine(groups[1]!, [20, 60, 200, 60]);
      expectPolyline(groups[2]!, '50,100 150,120 250,100');
      expect(shape(groups[0]!, 'circle')).toBe(circle);
      expect(circle.getAttribute('transform')).toBe('scale(' + scale + ')');
      const rect = circle.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      expect(rect.x + rect.width / 2 - surfaceRect.x).toBeCloseTo(screen[0]!);
      expect(rect.y + rect.height / 2 - surfaceRect.y).toBeCloseTo(screen[1]!);
      expect(rect.width).toBeCloseTo(22);
      expect(rect.height).toBeCloseTo(22);

      // The SVG bounding box excludes stroke: radius 11 + 2px stroke is 24 CSS pixels.
      const matrix = circle.getScreenCTM()!;
      expect(matrix.a).toBeCloseTo(1);
      expect(
        Number.parseFloat(getComputedStyle(circle).strokeWidth) * matrix.a + rect.width,
      ).toBeCloseTo(24);

      for (const symbol of surface.querySelectorAll('circle')) {
        expect(symbol.getBoundingClientRect().width).toBeCloseTo(22);
        expect(symbol.getBoundingClientRect().height).toBeCloseTo(22);
        expect(symbol.getScreenCTM()!.a).toBeCloseTo(1);
        expect(symbol.getScreenCTM()!.d).toBeCloseTo(1);
      }

      for (const stroke of [line, polyline]) {
        expect(stroke.getAttribute('vector-effect')).toBe('non-scaling-stroke');
        expect(getComputedStyle(stroke).vectorEffect).toBe('non-scaling-stroke');
        expect(Number.parseFloat(getComputedStyle(stroke).strokeWidth)).toBe(4);
      }
    }
  });

  it('synchronizes membership at a zero viewport and paints current coordinates on recovery', async () => {
    const { objects, point, route } = mixedScene();
    const { surface, renderer, originalShapes } = await prepareRenderer(objects);
    renderer.render(new Size(0, 0), new Rect(0, 0, 0, 0));
    expectSurvivingShapes(surface, originalShapes);
    const before = svgGroups(surface);
    expect(surface.getAttribute('width')).toBe('0');
    expect(surface.getAttribute('height')).toBe('0');

    objects.remove(point);
    route.points[0]!.position = new Point(70, 130);
    route.removePoint(route.points[1]!);
    objects.add(pointDefinition(100, 200, 'new'));
    renderer.render(new Size(0, 0), new Rect(0, 0, 0, 0));
    expectSurvivingShapes(surface, originalShapes);
    const added = svgGroups(surface)[4]!;
    expectGroups(surface, [before[1]!, before[2]!, before[3]!, before[5]!, added]);
    expect(before[0]!.isConnected).toBe(false);
    expect(before[4]!.isConnected).toBe(false);

    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectGroups(surface, [before[1]!, before[2]!, before[3]!, before[5]!, added]);
    expectPoint(before[3]!, 70, 130);
    expectPolyline(before[2]!, '70,130 250,100');
    expectPoint(added, 100, 200);

    renderer.render(new Size(320, 0), new Rect(0, 0, 320, 0));
    expectSurvivingShapes(surface, originalShapes);
    route.points[1]!.position = new Point(260, 110);
    renderer.render(VIEWPORT, BOUNDS);
    expectSurvivingShapes(surface, originalShapes);
    expectPoint(before[5]!, 260, 110);
    expectPolyline(before[2]!, '70,130 260,110');
  });
});
