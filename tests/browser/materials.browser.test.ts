import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { Point3 } from '#math/point3.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapPolygon } from '#objects/map-polygon.js';
import type { MapRoute } from '#objects/map-route.js';
import type { SceneChanges, SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';

const ELEMENT_NAME = 'atlas-material-test-map';
customElements.define(ELEMENT_NAME, MapElement);
MapElement.configure({
  properties: [
    {
      name: 'color',
      valueType: 'string',
      optional: true,
      appliesTo: ['point'],
      read: (object): unknown => object.data?.color,
    },
  ],
});
const maps: MapElement[] = [];

afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  vi.restoreAllMocks();
});

function createElement(): MapElement {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  maps.push(map);
  document.body.append(map);

  return map;
}

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function definition(input: Partial<MapDefinition> = {}): MapDefinition {
  const objects = input.objects ?? [{ kind: 'point', id: 'p', position: { x: 100, y: 100 } }];

  return {
    layers: [{ id: 'content', background, objects: objects.map(object => object.id!) }],
    ...input,
    objects,
  };
}

async function createMap(
  input: Partial<MapDefinition> = {},
): Promise<{ map: MapElement; surface: SVGSVGElement; spatial: Spatial }> {
  const map = createElement();
  await map.load(definition(input));
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();

  return {
    map,
    surface: map.shadowRoot!.querySelector('svg')!,
    spatial: new Spatial(prepareSceneGeometry(map.objects, map.layers)),
  };
}

function group(surface: SVGSVGElement, id = 'p'): SVGGElement {
  return surface.querySelector<SVGGElement>(`[data-object-id="${id}"]`)!;
}

function svg(
  source = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path fill="#12ab34" d="M10 0h10v20H10z"/></svg>',
): string {
  return 'data:image/svg+xml,' + encodeURIComponent(source);
}

function png(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 20;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ee0011';
  context.fillRect(10, 0, 10, 20);

  return canvas.toDataURL('image/png');
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function iconDefinition(source = svg()): MapDefinition {
  return definition({
    resources: { icon: { kind: 'image', source } },
    materials: { icon: { properties: { symbol: 'image', image: { resource: 'icon' } } } },
    objects: [{ kind: 'point', id: 'p', material: 'icon', position: { x: 100, y: 100 } }],
  });
}

function captureActiveMap(map: MapElement, surface: SVGSVGElement): () => void {
  const objects = map.objects;
  const layers = map.layers;
  const lookup = map.materials;
  const material = lookup.get('icon');
  const snapshot = map.definition;
  const children = Array.from(surface.children);
  const center = map.camera.center;
  const zoom = map.camera.zoom;
  const object = map.objects.get('p');
  const href = group(surface).querySelector('image')!.getAttribute('href');

  return (): void => {
    expect(map.objects).toBe(objects);
    expect(map.layers).toBe(layers);
    expect(map.materials).toBe(lookup);
    expect(map.materials.get('icon')).toBe(material);
    expect(map.definition).toBe(snapshot);
    expect(Array.from(surface.children)).toEqual(children);
    expect(group(surface).querySelector('image')!.getAttribute('href')).toBe(href);
    expect(map.camera.center).toBe(center);
    expect(map.camera.zoom).toBe(zoom);
    const spatial = new Spatial(prepareSceneGeometry(map.objects, map.layers));
    expect(spatial.hitTest(new Point2(100, 100), map.camera)?.object).toBe(object);
  };
}

/** Count coordinates consumed by the real renderer without changing model geometry. */
function traceCoordinates(scene: SceneGeometry, reads: Map<string, number>): SceneGeometry {
  const originals = new Map<SceneObject, SceneObject>();
  const traced = new Map<SceneObject, SceneObject>();
  const arrays = new WeakMap<readonly SceneObject[], readonly SceneObject[]>();

  const trace = (entry: SceneObject): SceneObject => {
    const cached = traced.get(entry);

    if (cached) {
      return cached;
    }

    const point = (position: Point3): Point3 =>
      new Proxy(position, {
        get(target, field, receiver): unknown {
          if (field === 'x' || field === 'y') {
            reads.set(entry.object.id, (reads.get(entry.object.id) ?? 0) + 1);
          }

          return Reflect.get(target, field, receiver);
        },
      });
    const geometry = new Proxy(entry.geometry, {
      get(target, field, receiver): unknown {
        if (target.kind === 'polyline' && field === 'points') {
          return target.points.map(point);
        }

        if (target.kind === 'polygon' && field === 'cells') {
          return target.cells.map(cell => cell.map(point));
        }

        return Reflect.get(target, field, receiver);
      },
    });
    const result = { ...entry, geometry };
    traced.set(entry, result);
    originals.set(result, entry);

    return result;
  };

  return {
    layers: scene.layers,
    invalidateAppearances: objects => scene.invalidateAppearances(objects),
    appearanceFor: entry => scene.appearanceFor(originals.get(entry)!),
    get objects(): readonly SceneObject[] {
      const sources = scene.objects;
      const entries = arrays.get(sources) ?? sources.map(trace);
      arrays.set(sources, entries);

      return entries;
    },
    takeChanges(): SceneChanges {
      const changes = scene.takeChanges();

      return {
        geometry: new Set([...changes.geometry].map(trace)),
        appearance: new Set([...changes.appearance].map(trace)),
      };
    },
  };
}

describe('material browser integration', () => {
  it('locks configuration at the start of the first failed load, but not construction', async () => {
    const map = createElement();
    expect(() => MapElement.configure({ properties: [] })).not.toThrow();
    await expect(map.load({ layers: null as never })).rejects.toMatchObject({
      code: 'INVALID_MAP_LAYERS',
    });
    expect(() => MapElement.configure({ properties: [] })).toThrow(
      expect.objectContaining({ code: 'MATERIAL_CONFIGURATION_LOCKED' }),
    );
    expect(map.materials.get('builtin.point')).toBeUndefined();
  });

  it('keeps the active map when null collections or unknown declaration fields reject loading', async () => {
    const { map, surface } = await createMap({
      materials: { marker: { properties: { color: '#112233' } } },
      materialRules: [{ when: { kind: 'point' }, material: 'marker' }],
    });
    const snapshot = map.definition;
    const object = map.objects.get('p');
    const marker = map.materials.get('marker');
    const original = group(surface);
    const candidates = [
      [{ materials: null }, 'INVALID_MATERIAL_DEFINITION'],
      [{ materialRules: null }, 'INVALID_MATERIAL_RULE'],
      [{ resources: null }, 'INVALID_IMAGE_RESOURCE'],
      [
        { materials: { marker: { properties: {}, inherit: 'parent' } } },
        'INVALID_MATERIAL_DEFINITION',
      ],
      [
        { resources: { icon: { kind: 'image', source: svg(), extra: true } } },
        'INVALID_IMAGE_RESOURCE',
      ],
      [
        {
          materials: { marker: { properties: {} } },
          materialRules: [{ when: { kind: 'point' }, material: 'marker', extra: true }],
        },
        'INVALID_MATERIAL_RULE',
      ],
    ] as const;

    for (const [candidate, code] of candidates) {
      await expect(map.load(definition(candidate as never))).rejects.toMatchObject({ code });
      expect(map.definition).toBe(snapshot);
      expect(map.objects.get('p')).toBe(object);
      expect(map.materials.get('marker')).toBe(marker);
      expect(group(surface)).toBe(original);
      expect(original.querySelector('circle')!.getAttribute('fill')).toBe('#112233');
    }
  });

  it('renders an ordinary bend without a symbol and a POI with independently enabled picking', async () => {
    const { map, surface, spatial } = await createMap({
      objects: [
        {
          kind: 'route',
          id: 'walk',
          points: [
            { kind: 'point', id: 'start', position: { x: 20, y: 100 } },
            { kind: 'point', id: 'bend', position: { x: 100, y: 100 } },
            {
              kind: 'point',
              id: 'poi',
              material: 'poi',
              pickable: true,
              position: { x: 200, y: 100 },
            },
          ],
        },
      ],
      materials: { poi: { properties: { symbol: 'circle', color: '#00aa00', size: 30 } } },
    });
    const route = map.objects.get('walk') as MapRoute;
    const poi = route.points[2]!;
    expect(group(surface, 'bend').querySelector('circle,image')).toBeNull();
    expect(group(surface, 'poi').querySelector('circle')!.getAttribute('fill')).toBe('#00aa00');
    expect(spatial.hitTest(new Point2(100, 100), map.camera)?.object).toBe(route);
    expect(spatial.hitTest(new Point2(200, 100), map.camera)).toMatchObject({ object: poi, route });
    const clicks: ObjectClickEvent[] = [];
    map.addEventListener('objectclick', event => clicks.push(event as ObjectClickEvent));
    await userEvent.click(surface, { position: { x: 200, y: 100 } });
    expect(clicks.at(-1)!.detail).toMatchObject({ object: poi, route });
    poi.pickable = undefined;
    expect(spatial.hitTest(new Point2(200, 100), map.camera)?.object).toBe(route);
    expect(group(surface, 'poi').querySelector('circle')).not.toBeNull();
    poi.pickable = true;
    map.clickTrigger = 'press';

    const listener = (): void => {
      poi.pickable = false;
    };

    map.addEventListener('press', listener, { once: true });
    clicks.length = 0;
    await userEvent.click(surface, { position: { x: 200, y: 100 } });
    expect(clicks).toHaveLength(0);
    expect(spatial.hitTest(new Point2(200, 100), map.camera)?.object).toBe(route);
  });

  it('updates only affected output and exposes current picking inside a nested batch before painting', async () => {
    const { map, surface, spatial } = await createMap({
      objects: [
        { kind: 'point', id: 'p', material: 'marker', position: { x: 100, y: 100 } },
        { kind: 'point', id: 'other', position: { x: 250, y: 180 } },
        {
          kind: 'route',
          id: 'route',
          material: 'path',
          points: [
            { kind: 'point', position: { x: 20, y: 40 } },
            { kind: 'point', position: { x: 250, y: 40 } },
          ],
        },
      ],
      materials: {
        marker: { properties: { size: 10, color: '#112233' } },
        path: { properties: { width: 4 } },
      },
    });
    const pointGroup = group(surface);
    const circle = pointGroup.querySelector('circle')!;
    const routeGroup = group(surface, 'route');
    const path = routeGroup.querySelector('polyline')!;
    const other = group(surface, 'other');
    const otherShape = other.firstElementChild;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface, { subtree: true, attributes: true, childList: true });
    map.batch(() => {
      map.batch(() => {
        map.materials.get('marker')!.properties = { size: 30, color: '#445566' };
        map.materials.get('path')!.properties = { width: 20 };
        expect(circle.getAttribute('r')).toBe('5');
        expect(path.getAttribute('stroke-width')).toBe('4');
        expect(spatial.hitTest(new Point2(114, 100), map.camera)?.object.id).toBe('p');
        expect(spatial.hitTest(new Point2(100, 49), map.camera)?.object.id).toBe('route');
        expect(records).toHaveLength(0);
      });
    });
    await paint();
    observer.disconnect();
    expect(pointGroup.querySelector('circle')).toBe(circle);
    expect(routeGroup.querySelector('polyline')).toBe(path);
    expect(circle.getAttribute('r')).toBe('15');
    expect(circle.getAttribute('fill')).toBe('#445566');
    expect(path.getAttribute('points')).toBe('20,40 250,40');
    expect(path.getAttribute('stroke-width')).toBe('20');
    expect(group(surface, 'other')).toBe(other);
    expect(other.firstElementChild).toBe(otherShape);
    expect(
      records.every(
        record =>
          (record.target === circle && ['r', 'fill'].includes(record.attributeName!)) ||
          (record.target === path && record.attributeName === 'stroke-width'),
      ),
    ).toBe(true);
  });

  it.each(['appearance first', 'geometry first'])(
    'avoids coordinate reads for color edits and applies both batch changes: %s',
    async order => {
      const reads = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the renderer instance through call below.
      const prepare = SvgRenderer.prototype.prepare;
      vi.spyOn(SvgRenderer.prototype, 'prepare').mockImplementation(function (
        this: SvgRenderer,
        scene,
      ) {
        return prepare.call(this, traceCoordinates(scene, reads));
      });
      const { map, surface } = await createMap({
        objects: [
          {
            kind: 'route',
            id: 'route',
            points: Array.from({ length: 1000 }, (_, index) => ({
              kind: 'point' as const,
              position: { x: index / 4, y: 100 },
            })),
          },
          {
            kind: 'polygon',
            id: 'polygon',
            contour: Array.from({ length: 1000 }, (_, index) => ({
              x: 150 + 30 * Math.cos((index * 2 * Math.PI) / 1000),
              y: 150 + 30 * Math.sin((index * 2 * Math.PI) / 1000),
            })),
          },
        ],
        materials: { common: { properties: { color: '#112233' } } },
        materialRules: [{ when: { kind: ['route', 'polygon'] }, material: 'common' }],
      });
      expect(reads.get('route')).toBeGreaterThanOrEqual(2000);
      expect(reads.get('polygon')).toBeGreaterThanOrEqual(2000);
      const path = group(surface, 'route').querySelector('polyline')!;
      const polygonPath = group(surface, 'polygon').querySelector('path')!;
      const oldPoints = path.getAttribute('points');
      const oldContour = polygonPath.getAttribute('d');
      reads.clear();
      map.materials.get('common')!.properties = { color: '#445566' };
      await paint();
      expect(reads.get('route') ?? 0).toBe(0);
      expect(reads.get('polygon') ?? 0).toBe(0);
      expect(path.getAttribute('stroke')).toBe('#445566');
      expect(polygonPath.getAttribute('fill')).toBe('#445566');
      expect(path.getAttribute('points')).toBe(oldPoints);
      expect(polygonPath.getAttribute('d')).toBe(oldContour);
      const route = map.objects.get('route') as MapRoute;
      const polygon = map.objects.get('polygon') as MapPolygon;

      const changeGeometry = (): void => {
        route.points[500]!.position = { x: 125, y: 80 };
        polygon.setVertex(0, { x: 181, y: 150 });
      };

      const changeAppearance = (): void => {
        map.materials.get('common')!.properties = { color: '#778899' };
      };

      map.batch(() => {
        const actions =
          order === 'appearance first'
            ? [changeAppearance, changeGeometry]
            : [changeGeometry, changeAppearance];
        actions.forEach(action => action());
        expect(path.getAttribute('stroke')).toBe('#445566');
        expect(path.getAttribute('points')).toBe(oldPoints);
        expect(polygonPath.getAttribute('d')).toBe(oldContour);
      });
      await paint();
      expect(reads.get('route')).toBe(2000);
      expect(reads.get('polygon')).toBeGreaterThanOrEqual(2000);
      expect(group(surface, 'route').querySelector('polyline')).toBe(path);
      expect(group(surface, 'polygon').querySelector('path')).toBe(polygonPath);
      expect(path.getAttribute('stroke')).toBe('#778899');
      expect(path.getAttribute('points')!.split(' ')[500]).toBe('125,80');
      expect(polygonPath.getAttribute('fill')).toBe('#778899');
      expect(polygonPath.getAttribute('d')).not.toBe(oldContour);
      expect(polygonPath.getAttribute('d')).toContain('181,150');
    },
  );

  it.each(['SVG', 'PNG'])(
    'uses decoded %s source dimensions, anchors and transparent rectangular picking',
    async format => {
      const { map, surface, spatial } = await createMap({
        resources: { icon: { kind: 'image', source: format === 'SVG' ? svg() : png() } },
        materials: {
          icon: {
            properties: {
              symbol: 'image',
              image: { resource: 'icon', width: 80, height: 80, anchor: { x: 0.5, y: 1 } },
            },
          },
        },
        objects: [{ kind: 'point', id: 'p', material: 'icon', position: { x: 100, y: 100 } }],
      });
      const image = group(surface).querySelector('image')!;
      expect(['x', 'y', 'width', 'height'].map(name => Number(image.getAttribute(name)))).toEqual([
        -40, -40, 80, 40,
      ]);
      expect(image.hasAttribute('fill')).toBe(false);
      expect(image.getAttribute('preserveAspectRatio')).toBe('none');
      expect(spatial.hitTest(new Point2(61, 61), map.camera)?.object.id).toBe('p');
      expect(spatial.hitTest(new Point2(100, 101), map.camera)).toBeUndefined();

      for (const zoom of [0.5, 2]) {
        map.camera.zoom = zoom;
        await paint();
        const size = image.getBoundingClientRect();
        expect(size.width).toBeCloseTo(80);
        expect(size.height).toBeCloseTo(40);
      }
    },
  );

  it.each([
    ['width="40px" height="20"', 40, 20],
    ['width="+4e1px" height="2e1px"', 40, 20],
    ['viewBox="0 0 40 20"', 40, 20],
    ['width="80" viewBox="0 0 40 20"', 80, 40],
    ['width="80px" viewBox="0 0 40 20"', 80, 40],
    ['height="40" viewBox="0 0 40 20"', 80, 40],
    ['height="40px" viewBox="0 0 40 20"', 80, 40],
    ['width="100%" height="2em" viewBox="0 0 40 20"', 40, 20],
  ])('prepares SVG source dimensions from %s', async (attributes, width, height) => {
    const { surface } = await createMap({
      resources: {
        icon: {
          kind: 'image',
          source: svg(
            `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><path d="M0 0h1v1z"/></svg>`,
          ),
        },
      },
      materials: { icon: { properties: { symbol: 'image', image: { resource: 'icon' } } } },
      objects: [{ kind: 'point', id: 'p', material: 'icon', position: { x: 100, y: 100 } }],
    });
    const image = group(surface).querySelector('image')!;
    expect(Number(image.getAttribute('width'))).toBe(width);
    expect(Number(image.getAttribute('height'))).toBe(height);
  });

  it.each(
    (['width', 'height'] as const).flatMap(field =>
      ['0', '-1', '0px', '-1px', '1e309', '1e309px'].map(actual => ({ field, actual })),
    ),
  )(
    'rejects explicit SVG $field="$actual" despite viewBox, retaining the active map',
    async ({ field, actual }) => {
      const { map, surface } = await createMap(iconDefinition());
      map.camera.center = new Point2(120, 90);
      map.camera.zoom = 2;
      await paint();
      const unchanged = captureActiveMap(map, surface);
      const source = svg(
        `<svg xmlns="http://www.w3.org/2000/svg" ${field}="${actual}" viewBox="0 0 40 20"><path d="M0 0h40v20H0z"/></svg>`,
      );

      await expect(map.load(iconDefinition(source))).rejects.toMatchObject({
        name: 'AtlasMaterialError',
        code: 'INVALID_IMAGE_RESOURCE',
        details: { resourceId: 'icon', source, field, actual },
      });
      unchanged();
    },
  );

  it.each(
    (['fetch', 'body', 'decode'] as const).flatMap(stage =>
      (['resolve', 'reject'] as const).map(completion => ({ stage, completion })),
    ),
  )(
    'rejects promptly and cleans up a late $stage $completion after a resource failure',
    async ({ stage, completion }) => {
      const created = new Set<string>();
      const revoked = new Set<string>();
      const createUrl = URL.createObjectURL.bind(URL);
      const revokeUrl = URL.revokeObjectURL.bind(URL);
      vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
        const url = createUrl(blob);
        created.add(url);

        return url;
      });
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => {
        revoked.add(url);
        revokeUrl(url);
      });
      const liveUrls = (): string[] => [...created].filter(url => !revoked.has(url));
      const { map, surface } = await createMap(iconDefinition());
      map.camera.center = new Point2(120, 90);
      map.camera.zoom = 2;
      await paint();
      const unchanged = captureActiveMap(map, surface);
      const oldUrl = group(surface).querySelector('image')!.getAttribute('href')!;
      const broken = deferred<Response>();
      const pending = deferred<Response>();
      const body = deferred<ArrayBuffer>();
      const decode = deferred<void>();
      const ready = deferred<void>();
      const started = deferred<void>();
      const brokenSource = '/broken-icon.svg';
      const pendingSource = '/pending-resource.svg';
      const brokenSvg = '<not-svg/>';
      let pendingSignal: AbortSignal | undefined;
      let decodeWasCancelled = (): boolean => false;
      let cancelledRequests = 0;
      let blobDecodes = 0;
      const fetcher = globalThis.fetch;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with its image instance below.
      const decodeImage = HTMLImageElement.prototype.decode;
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(async function (
        this: HTMLImageElement,
      ): Promise<void> {
        const ordinal = this.src.startsWith('blob:') ? blobDecodes++ : -1;
        await decodeImage.call(this);

        if (ordinal === 0) {
          ready.resolve();
        } else if (ordinal === 1 && stage === 'decode') {
          decodeWasCancelled = (): boolean => !this.hasAttribute('src');
          started.resolve();
          await decode.promise;
        }
      });
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = input instanceof Request ? input.url : input.toString();

        if (url.endsWith(brokenSource)) {
          return broken.promise;
        }

        if (url.endsWith(pendingSource)) {
          pendingSignal = init?.signal ?? undefined;

          return pending.promise; // Deliberately ignore abort to exercise late completion.
        }

        if (url.endsWith('/cancel-icon.svg')) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                cancelledRequests++;
                reject(new DOMException('Cancelled sibling request.', 'AbortError'));
              },
              { once: true },
            );
          });
        }

        return fetcher(input, init);
      });
      const unhandled: unknown[] = [];

      const recordUnhandled = (event: PromiseRejectionEvent): void => {
        unhandled.push(event.reason);
      };

      window.addEventListener('unhandledrejection', recordUnhandled);
      let state = 'pending';
      const settled = map
        .load(
          definition({
            resources: {
              ready: { kind: 'image', source: svg() },
              broken: { kind: 'image', source: brokenSource },
              pending: { kind: 'image', source: pendingSource },
              cancel: { kind: 'image', source: '/cancel-icon.svg' },
            },
          }),
        )
        .then(
          () => {
            state = 'resolved';
          },
          (error: unknown) => {
            state = 'rejected';

            return error;
          },
        );
      const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"/>';

      try {
        await ready.promise;

        if (stage === 'body') {
          const response = new Response(validSvg);
          vi.spyOn(response, 'arrayBuffer').mockImplementation(() => {
            started.resolve();

            return body.promise;
          });
          pending.resolve(response);
          await started.promise;
        } else if (stage === 'decode') {
          pending.resolve(new Response(validSvg));
          await started.promise;
        }

        broken.resolve(new Response(brokenSvg));
        await expect.poll(() => state).toBe('rejected');
        expect(await settled).toMatchObject({
          name: 'AtlasMaterialError',
          code: 'INVALID_IMAGE_RESOURCE',
          details: { resourceId: 'broken', source: brokenSource },
        });
        expect(pendingSignal?.aborted).toBe(true);
        expect(cancelledRequests).toBe(1);
        expect(liveUrls()).toEqual([oldUrl]);
        expect(created.size).toBe(stage === 'decode' ? 3 : 2);

        if (stage === 'decode') {
          expect(decodeWasCancelled()).toBe(true);
        }

        unchanged();
        await map.load(iconDefinition());
        await paint();
        const next = map.definition;
        const nextObject = map.objects.get('p');
        const nextUrl = group(surface).querySelector('image')!.getAttribute('href')!;
        const allocations = created.size;
        expect(revoked.has(oldUrl)).toBe(true);
        expect(liveUrls()).toEqual([nextUrl]);
        const lateFailure = new Error('Late resource failure.');

        if (completion === 'reject') {
          if (stage === 'fetch') pending.reject(lateFailure);
          else if (stage === 'body') body.reject(lateFailure);
          else decode.reject(lateFailure);
        } else if (stage === 'fetch') {
          pending.resolve(new Response(validSvg));
        } else if (stage === 'body') {
          body.resolve(new TextEncoder().encode(validSvg).buffer);
        } else {
          decode.resolve();
        }

        await paint();
        expect(map.definition).toBe(next);
        expect(map.objects.get('p')).toBe(nextObject);
        expect(group(surface).querySelector('image')!.getAttribute('href')).toBe(nextUrl);
        expect(created.size).toBe(allocations);
        expect(liveUrls()).toEqual([nextUrl]);
        expect(unhandled).toEqual([]);
        await map.load(definition());
        expect(liveUrls()).toEqual([]);
      } finally {
        broken.resolve(new Response(brokenSvg));
        pending.resolve(new Response(validSvg));
        body.resolve(new TextEncoder().encode(validSvg).buffer);
        decode.resolve();
        await settled;
        window.removeEventListener('unhandledrejection', recordUnhandled);
      }
    },
  );

  it('switches preloaded icons synchronously, preserving groups, unrelated geometry and reconnect behavior', async () => {
    const { map, surface, spatial } = await createMap({
      resources: { a: { kind: 'image', source: svg() }, b: { kind: 'image', source: png() } },
      materials: { icon: { properties: { size: 20 } } },
      objects: [
        { kind: 'point', id: 'p', material: 'icon', position: { x: 100, y: 100 } },
        { kind: 'point', id: 'other', position: { x: 250, y: 180 } },
      ],
    });
    const pointGroup = group(surface);
    const other = group(surface, 'other');
    const otherShape = other.firstElementChild;
    const material = map.materials.get('icon')!;
    const fetcher = vi.spyOn(globalThis, 'fetch');
    material.properties = { symbol: 'image', image: { resource: 'a', width: 80 } };
    expect(spatial.hitTest(new Point2(130, 100), map.camera)?.object.id).toBe('p');
    await paint();
    const image = pointGroup.querySelector('image')!;
    const href = image.getAttribute('href');
    map.remove();
    material.properties = { symbol: 'image', image: { resource: 'b', width: 40 } };
    expect(spatial.hitTest(new Point2(130, 100), map.camera)).toBeUndefined();
    document.body.append(map);
    await paint();
    expect(group(surface)).toBe(pointGroup);
    expect(pointGroup.querySelector('image')).toBe(image);
    expect(image.getAttribute('href')).not.toBe(href);
    expect(group(surface, 'other')).toBe(other);
    expect(other.firstElementChild).toBe(otherShape);
    expect(fetcher).not.toHaveBeenCalled();
    material.properties = { symbol: 'none' };
    await paint();
    expect(pointGroup.querySelector('circle,image')).toBeNull();
    expect(spatial.hitTest(new Point2(100, 100), map.camera)?.object.id).toBe('p');
  });

  it('retains the complete active map after unused broken/unsupported/indeterminate resources', async () => {
    const { map, surface } = await createMap({ materials: { own: { properties: { size: 20 } } } });
    map.camera.center = new Point2(120, 90);
    map.camera.zoom = 2;
    await paint();
    const objects = map.objects;
    const layers = map.layers;
    const lookup = map.materials;
    const snapshot = map.definition;
    const children = Array.from(surface.children);
    const center = map.camera.center;
    const sources = [
      [
        svg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'),
        'INVALID_IMAGE_RESOURCE',
      ],
      [svg('<not-svg/>'), 'INVALID_IMAGE_RESOURCE'],
      ['data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'INVALID_IMAGE_RESOURCE'],
      ['https://[', 'INVALID_IMAGE_RESOURCE'],
      ['data:image/png;base64,iVBORw0KGgo=', 'IMAGE_RESOURCE_LOAD_FAILED'],
      ['/missing-material-image.png', 'IMAGE_RESOURCE_LOAD_FAILED'],
    ] as const;

    for (const [source, code] of sources) {
      if (source === '/missing-material-image.png') {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response('Missing image', { status: 404 }),
        );
      }

      await expect(
        map.load(definition({ resources: { unused: { kind: 'image', source } } })),
      ).rejects.toMatchObject({ name: 'AtlasMaterialError', code });
      expect(map.objects).toBe(objects);
      expect(map.layers).toBe(layers);
      expect(map.materials).toBe(lookup);
      expect(map.definition).toBe(snapshot);
      expect(Array.from(surface.children)).toEqual(children);
      expect(map.camera.center).toBe(center);
      expect(map.camera.zoom).toBe(2);
    }
  });

  it('keeps the active lookup during preparation and makes retained handles independent after success', async () => {
    const { map } = await createMap({ materials: { shared: { properties: { size: 20 } } } });
    const oldLookup = map.materials;
    const oldHandle = oldLookup.get('shared')!;
    const oldObject = map.objects.get('p') as MapPoint;
    let finish!: (response: Response) => void;
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : input.toString();

      if (url.endsWith('/pending-icon.svg')) {
        return new Promise(resolve => {
          finish = resolve;
        });
      }

      return original(input, init);
    });
    const loading = map.load(
      definition({
        resources: { pending: { kind: 'image', source: '/pending-icon.svg' } },
        materials: { shared: { properties: { size: 30 } } },
      }),
    );
    expect(map.materials).toBe(oldLookup);
    oldHandle.properties = { size: 25 };
    expect(oldHandle.properties.size).toBe(25);
    await expect(map.load(definition())).rejects.toMatchObject({ code: 'MAP_LOAD_IN_PROGRESS' });
    finish(new Response('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'));
    await loading;
    expect(map.materials).not.toBe(oldLookup);
    expect(map.materials.get('shared')).not.toBe(oldHandle);
    oldObject.material = 'shared';
    map.objects.add(oldObject);
    map.layers[0]!.objectIds.add(oldObject.id);
    oldHandle.properties = { size: 100 };
    const spatial = new Spatial(prepareSceneGeometry(map.objects, map.layers));
    expect(spatial.hitTest(new Point2(120, 100), map.camera)).toBeUndefined();
    expect(map.materials.get('shared')!.properties.size).toBe(30);
  });

  it('rejects shared-object assignment in a disconnected second map without any successful event', async () => {
    const first = await createMap({
      materials: { shared: { properties: {} }, exclusive: { properties: {} } },
    });
    const second = await createMap({ objects: [], materials: { shared: { properties: {} } } });
    const point = first.map.objects.get('p') as MapPoint;
    point.material = 'shared';
    second.map.objects.add(point);
    second.map.remove();
    const changed = vi.fn();
    point.addEventListener('change', changed);
    expect(() => {
      point.material = 'exclusive';
    }).toThrow(expect.objectContaining({ code: 'UNKNOWN_MATERIAL' }));
    expect(point.material).toBe('shared');
    expect(changed).not.toHaveBeenCalled();
    second.map.objects.remove(point);
    point.material = 'exclusive';
    expect(changed).toHaveBeenCalledOnce();
  });

  it('selects from candidate data, keeps whole own snapshots, and rejects invalid parameter replacement', async () => {
    const { map, surface } = await createMap({
      materials: {
        base: { properties: { color: '#123456', size: 20 } },
        selected: { inherits: 'base', properties: {} },
      },
      materialRules: [{ when: { kind: 'point', color: 'urgent' }, material: 'selected' }],
    });
    const point = map.objects.get('p') as MapPoint;
    const material = map.materials.get('base')!;
    point.data = { color: 'urgent', width: 'application key' };
    await paint();
    expect(group(surface).querySelector('circle')!.getAttribute('fill')).toBe('#123456');
    const snapshot = material.properties;
    material.properties = { size: 30 };
    await paint();
    expect(snapshot).toEqual({ color: '#123456', size: 20 });
    expect(group(surface).querySelector('circle')!.getAttribute('fill')).toBe('#2775d9');
    const committed = material.properties;
    expect(() => {
      material.properties = { color: 'red' };
    }).toThrow();
    expect(material.properties).toBe(committed);
    const data = point.data;
    expect(() => {
      point.data = { color: 1 };
    }).toThrow(expect.objectContaining({ code: 'INVALID_SELECTION_PROPERTY_VALUE' }));
    expect(point.data).toBe(data);
  });
});
