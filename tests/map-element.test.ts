import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Point } from '#math/point.js';
import { Size } from '#math/size.js';
import { MapPoint } from '#objects/map-point.js';

import { pointDefinition, selectAddedRoots } from './fixtures.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { MapDefinition } from '#definitions/map-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapRoute } from '#objects/map-route.js';
import type { PreparedScene, Renderer } from '#renderers/renderer.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';

const renderer = vi.hoisted(() => ({
  prepare: vi.fn<Renderer['prepare']>(),
  render: vi.fn<Renderer['render']>(),
  show: vi.fn<PreparedScene['show']>(),
}));

vi.mock('#renderers/svg/svg-renderer.js', () => ({
  SvgRenderer: class {
    prepare = renderer.prepare;
    render = renderer.render;
  },
}));

// Minimal browser boundary for Node tests; controls, coordinates, camera and picking are real.
class TestSurface extends EventTarget {
  isConnected = false;
  readonly captures = new Set<number>();

  getBoundingClientRect(): DOMRect {
    return { left: 0, top: 0, width: 1000, height: 600 } as DOMRect;
  }

  setPointerCapture(id: number): void {
    this.captures.add(id);
  }

  hasPointerCapture(id: number): boolean {
    return this.captures.has(id);
  }

  releasePointerCapture(id: number): void {
    this.captures.delete(id);
  }
}

class TestElement extends EventTarget {
  isConnected = false;
  readonly surface = new TestSurface();
  readonly shadowRoot = { innerHTML: '', querySelector: (): TestSurface => this.surface };

  attachShadow(): typeof this.shadowRoot {
    return this.shadowRoot;
  }
}

class TestPointerEvent extends Event {
  readonly button: number;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;

  constructor(type: string, options: PointerEventInit) {
    super(type);
    this.button = options.button ?? 0;
    this.pointerId = options.pointerId ?? 1;
    this.clientX = options.clientX ?? 0;
    this.clientY = options.clientY ?? 0;
  }
}

let ElementClass: typeof MapElement;
let display: SceneGeometry | undefined;
const elements: MapElement[] = [];
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
  const id = ++nextFrame;
  frames.set(id, callback);

  return id;
});
const cancelFrame = vi.fn((id: number): void => {
  frames.delete(id);
});

function surface(element: MapElement): SVGSVGElement {
  return element.shadowRoot!.querySelector('svg')!;
}

function connect(element: MapElement): void {
  Object.defineProperty(element, 'isConnected', { value: true, configurable: true });
  Object.defineProperty(surface(element), 'isConnected', { value: true, configurable: true });
  element.connectedCallback();
}

function disconnect(element: MapElement): void {
  Object.defineProperty(element, 'isConnected', { value: false, configurable: true });
  Object.defineProperty(surface(element), 'isConnected', { value: false, configurable: true });
  element.disconnectedCallback();
}

async function loadDefinition(element: MapElement): Promise<void> {
  await element.load(definition());
  selectAddedRoots(element.objects, element.layers[0]!);
}

function createElement(): MapElement {
  const element = new ElementClass();
  elements.push(element);
  element.camera.resize(new Size(1000, 600));
  connect(element);

  return element;
}

function flushFrame(): void {
  const callbacks = Array.from(frames.values());
  frames.clear();

  for (const callback of callbacks) {
    callback(0);
  }
}

function pointer(element: MapElement, type: string, x: number, y: number): void {
  surface(element).dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
}

function click(element: MapElement, x: number, y: number): void {
  pointer(element, 'pointerdown', x, y);
  pointer(element, 'pointerup', x, y);
}

function definition(): MapDefinition {
  return {
    layers: [
      {
        id: 'content',
        objects: ['point'],
        background: { source: '/map.png', size: new Size(1000, 600) },
      },
    ],
    objects: [pointDefinition(100, 100, 'point')],
  };
}

beforeAll(async () => {
  vi.stubGlobal('HTMLElement', TestElement);
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  ElementClass = (await import('#components/map-element/map-element.js')).MapElement;
});

beforeEach(() => {
  display = undefined;
  renderer.prepare.mockReset();
  renderer.render.mockClear();
  renderer.show.mockClear();
  requestFrame.mockClear();
  cancelFrame.mockClear();
  renderer.prepare.mockImplementation(geometry =>
    Promise.resolve({
      show: (): void => {
        display = geometry;
        renderer.show();
      },
    }),
  );
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    disconnect(element);
  }

  frames.clear();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('component scene replacement', () => {
  it('keeps a stable collection before first load and replaces it only on success', async () => {
    const element = createElement();
    const initial = element.objects;
    const point = initial.add(pointDefinition(100, 100));
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    expect(element.objects).toBe(initial);
    expect(element.definition).toBeUndefined();
    element.camera.center = new Point(500, 300);
    click(element, 100, 100);
    expect(clicked).not.toHaveBeenCalled();
    await loadDefinition(element);
    expect(element.objects).not.toBe(initial);
    expect(initial.get(point.id)).toBe(point);
    expect(element.camera.center).toEqual(new Point(500, 300));
    expect(element.camera.zoom).toBe(1);
    click(element, 100, 100);
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('copies input before preparation and keeps definition as an immutable load snapshot', async () => {
    const element = createElement();
    const input = { kind: 'point' as const, id: 'point', position: { x: 100, y: 100 } };
    const data = {
      layers: [
        {
          objects: ['point'],
          background: { source: '/map.png', size: { width: 1000, height: 600 } },
        },
      ],
      objects: [input],
    };
    const loading = element.load(data);
    input.position.x = 999;
    data.layers[0]!.background.size.width = 999;
    await loading;
    const point = element.objects.get('point') as MapPoint;
    expect(point.position).toEqual(new Point(100, 100));
    expect(element.definition?.layers[0]?.background?.size).toEqual(new Size(1000, 600));
    point.position = new Point(200, 200);
    expect(element.definition?.objects[0]).toMatchObject({ position: { x: 100, y: 100 } });
    expect(Object.isFrozen(element.definition)).toBe(true);
  });

  it('keeps the old scene usable throughout preparation and after a failed load', async () => {
    const element = createElement();
    await loadDefinition(element);
    const objects = element.objects;
    const oldDefinition = element.definition;
    const oldDisplay = display;
    const point = objects.get('point') as MapPoint;
    element.camera.center = new Point(450, 250);
    element.camera.zoom = 2;
    const center = element.camera.center;
    let rejectPreparation!: (reason: Error) => void;
    const candidateSubscriptions = vi.spyOn(MapPoint.prototype, 'addEventListener');
    renderer.prepare.mockImplementationOnce(() => {
      return new Promise((_resolve, reject) => {
        rejectPreparation = reject;
      });
    });
    const loading = element.load(definition());
    const failure = expect(loading).rejects.toThrow('Image failed');
    expect(element.objects).toBe(objects);
    expect(display).toBe(oldDisplay);
    point.position = new Point(200, 200);
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    const client = element.coordinates.mapToClient(point.position);
    click(element, client.x, client.y);
    expect(clicked).toHaveBeenCalledOnce();
    rejectPreparation(new Error('Image failed'));
    await failure;
    expect(candidateSubscriptions).not.toHaveBeenCalled();
    expect(element.objects).toBe(objects);
    expect(element.definition).toBe(oldDefinition);
    expect(display).toBe(oldDisplay);
    expect(element.camera.center).toBe(center);
    expect(element.camera.zoom).toBe(2);
    expect(renderer.show).toHaveBeenCalledOnce();
    flushFrame();
    requestFrame.mockClear();
    point.position = new Point(300, 200);
    expect(requestFrame).toHaveBeenCalledOnce();
  });

  it('copies all layers before preparation and validates every background before any preparation', async () => {
    const element = createElement();
    const references = ['point'];
    const firstBackground = { source: '/first.svg', size: { width: 1000, height: 600 } };
    const secondBackground = { source: '/second.svg', size: { width: 500, height: 300 } };
    const input = {
      objects: [pointDefinition(100, 100, 'point')],
      layers: [
        { id: 'first', objects: references, background: firstBackground },
        { id: 'second', objects: ['point'], background: secondBackground },
      ],
    };
    const loading = element.load(input);
    references.push('missing');
    firstBackground.source = '/changed.svg';
    secondBackground.size.width = 999;
    await loading;
    expect(element.layers[0]!.background!.source).toBe('/first.svg');
    expect(element.layers[1]!.background!.size.width).toBe(500);
    expect([...element.layers[0]!.objectIds]).toEqual(['point']);
    expect(element.layers[0]!.objects[0]).toBe(element.layers[1]!.objects[0]);
    renderer.prepare.mockClear();
    const oldLayers = element.layers;
    await expect(
      element.load({
        layers: [
          { background: firstBackground },
          { background: { ...secondBackground, size: { width: 0, height: 300 } } },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_NUMBER' });
    expect(renderer.prepare).not.toHaveBeenCalled();
    expect(element.layers).toBe(oldLayers);
  });

  it('rejects invalid input before preparation and overlapping loads while accepting the first', async () => {
    const element = createElement();
    const initial = element.objects;
    await expect(
      element.load({ ...definition(), objects: [pointDefinition(NaN)] }),
    ).rejects.toThrow();
    expect(renderer.prepare).not.toHaveBeenCalled();
    expect(element.objects).toBe(initial);
    let finish!: (scene: PreparedScene) => void;
    renderer.prepare.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const loading = element.load(definition());
    await expect(element.load(definition())).rejects.toMatchObject({
      code: 'MAP_LOAD_IN_PROGRESS',
    });
    expect(element.objects).toBe(initial);
    finish({ show: renderer.show });
    await loading;
    expect(element.objects).not.toBe(initial);
    await loadDefinition(element);
    expect(renderer.show).toHaveBeenCalledTimes(2);
  });

  it('releases old collection and object listeners after replacement', async () => {
    const element = createElement();
    await loadDefinition(element);
    const oldObjects = element.objects;
    const oldPoint = oldObjects.get('point') as MapPoint;
    const release = vi.spyOn(oldPoint, 'removeEventListener');
    await loadDefinition(element);
    expect(release).toHaveBeenCalledWith('change', expect.any(Function));
    flushFrame();
    requestFrame.mockClear();
    oldPoint.position = new Point(300, 300);
    oldObjects.add(pointDefinition(400));
    oldObjects.remove(oldPoint);
    expect(requestFrame).not.toHaveBeenCalled();
    (element.objects.get('point') as MapPoint).position = new Point(200, 200);
    expect(requestFrame).toHaveBeenCalledOnce();
  });

  it('cancels a pending click when a successful load replaces the scene', async () => {
    const element = createElement();
    await loadDefinition(element);
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    pointer(element, 'pointerdown', 100, 100);
    await loadDefinition(element);
    pointer(element, 'pointerup', 100, 100);
    expect(clicked).not.toHaveBeenCalled();
    click(element, 100, 100);
    expect(clicked).toHaveBeenCalledOnce();
  });
});

describe('component observation and interaction', () => {
  it('cancels frames on disconnect and reconnects current objects and route membership once', async () => {
    const element = createElement();
    await loadDefinition(element);
    const route = element.objects.add({
      kind: 'route',
      id: 'route',
      points: [pointDefinition(400, 100), pointDefinition(600, 100)],
    });
    const oldPoint = element.objects.get('point') as MapPoint;
    disconnect(element);
    expect(frames.size).toBe(0);
    requestFrame.mockClear();
    oldPoint.position = new Point(150, 150);
    element.objects.remove(oldPoint);
    const added = element.objects.add(pointDefinition(200, 200));
    const inserted = route.insertPoint(1, pointDefinition(500, 200));
    expect(requestFrame).not.toHaveBeenCalled();
    connect(element);
    connect(element);
    expect(requestFrame).toHaveBeenCalledOnce();
    flushFrame();
    expect(display?.objects.map(entry => entry.object)).toEqual([route, ...route.points, added]);
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    click(element, 500, 200);
    expect((clicked.mock.calls[0]![0] as ObjectClickEvent).detail).toMatchObject({
      object: inserted,
      route,
    });
    requestFrame.mockClear();
    added.position = new Point(250, 250);
    route.points[0]!.position = new Point(450, 100);
    expect(requestFrame).toHaveBeenCalledOnce();
    flushFrame();
    requestFrame.mockClear();
    oldPoint.position = new Point(350, 350);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('loads while disconnected without observing candidates and resumes on reconnect', async () => {
    const element = createElement();
    disconnect(element);
    requestFrame.mockClear();
    await loadDefinition(element);
    const point = element.objects.get('point') as MapPoint;
    point.position = new Point(200, 200);
    expect(requestFrame).not.toHaveBeenCalled();
    connect(element);
    flushFrame();
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    click(element, 200, 200);
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('releases an already removed root when an earlier remove handler disconnects the view', () => {
    const element = createElement();
    disconnect(element);
    const point = element.objects.add(pointDefinition(100));
    element.objects.addEventListener('remove', () => {
      disconnect(element);
    });
    connect(element);
    const release = vi.spyOn(point, 'removeEventListener');
    element.objects.remove(point);
    expect(release).toHaveBeenCalledWith('change', expect.any(Function));
    requestFrame.mockClear();
    point.position = new Point(200, 200);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('picks live positions and membership before the coalesced render', async () => {
    const element = createElement();
    await loadDefinition(element);
    flushFrame();
    renderer.render.mockClear();
    const point = element.objects.get('point') as MapPoint;
    point.position = new Point(200, 200);
    const clicked = vi.fn();
    element.addEventListener('objectclick', clicked);
    click(element, 100, 100);
    expect(clicked).not.toHaveBeenCalled();
    click(element, 200, 200);
    expect((clicked.mock.calls[0]![0] as ObjectClickEvent).detail.object).toBe(point);
    element.objects.remove(point);
    click(element, 200, 200);
    expect(clicked).toHaveBeenCalledOnce();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it.each(['disconnect', 'remove root', 'remove vertex', 'replace vertex'] as const)(
    'suppresses a stale click when a surface handler performs %s',
    async action => {
      const element = createElement();
      await element.load({
        ...definition(),
        layers: [{ ...definition().layers[0], objects: ['route'] }],
        objects: [{ kind: 'route', id: 'route', points: [pointDefinition(100, 100)] }],
      });
      const route = element.objects.get('route') as MapRoute;
      const pressed = vi.fn(() => {
        switch (action) {
          case 'disconnect':
            disconnect(element);
            break;
          case 'remove root':
            element.objects.remove(route);
            break;
          case 'remove vertex':
            route.removePoint(route.points[0]!);
            break;
          case 'replace vertex':
            route.replacePoints(0, 1, [pointDefinition(100, 100)]);
            break;
        }
      });
      const clicked = vi.fn();
      element.clickTrigger = 'press';
      element.addEventListener('press', pressed);
      element.addEventListener('objectclick', clicked);
      pointer(element, 'pointerdown', 100, 100);
      expect(pressed).toHaveBeenCalledOnce();
      expect(clicked).not.toHaveBeenCalled();
    },
  );
});
