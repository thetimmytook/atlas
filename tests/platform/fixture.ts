import type { MapElement } from '#components/map-element/map-element.js';
import type { MapDefinition } from '#definitions/map-definition.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';

export interface RecordedEvent {
  type: string;
  trusted?: boolean;
  pointerType?: string;
  pointerId?: number;
  time?: number;
  objectId?: string;
  layerId?: string;
  routeId?: string | undefined;
  objectSame?: boolean | undefined;
  layerSame?: boolean | undefined;
  routeSame?: boolean;
  clientPoint?: { x: number; y: number };
  mapPoint?: { x: number; y: number };
  isClick?: boolean | undefined;
}

interface Probe {
  map: MapElement;
  surface: SVGSVGElement;
  roots: Record<string, MapEntry>;
  layers: Record<string, MapLayer>;
  owned?: MapRoute['points'][number] | undefined;
  ownedPoints: readonly MapPoint[];
  definition: MapDefinition;
  events: RecordedEvent[];
  eventHistory: RecordedEvent[];
  observations: Record<string, unknown>;
  text: (id: string, layer?: string) => SVGTextElement;
  saveReferences: () => void;
  bounds: (node: SVGGraphicsElement) => DOMRect;
}

declare global {
  interface Window {
    platform: Probe;
    secondPlatform?: Probe;
  }
}

/** Serialized by Playwright; only public runtime APIs and browser DOM are used. */
export function installProbe(host: string): void {
  const map = document.querySelector<MapElement>(host)!;
  const surface = map.shadowRoot!.querySelector<SVGSVGElement>('svg:not([aria-hidden])')!;
  const probe: Probe = {
    map,
    surface,
    roots: {},
    layers: {},
    ownedPoints: [],
    definition: map.definition!,
    events: [],
    eventHistory: [],
    observations: {},
    text: (id, layer = 'p-full') =>
      surface.querySelector(`[data-layer-id="${layer}"] [data-object-id="${id}"] text`)!,
    bounds: node => {
      // Firefox's client rect includes stroke; compare fill geometry consistently.
      const box = node.getBBox();
      const matrix = node.getScreenCTM()!;
      const points = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x, box.y + box.height],
        [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      const xs = points.map(point => point.x);
      const ys = points.map(point => point.y);

      return new DOMRect(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
    },
    saveReferences: () => {
      probe.roots = Object.fromEntries(Array.from(map.objects, object => [object.id, object]));
      probe.layers = Object.fromEntries(map.layers.map(layer => [layer.id, layer]));
      probe.ownedPoints = Object.values(probe.roots).flatMap(owner =>
        owner.kind === 'route' || owner.kind === 'line' ? [...owner.points] : [],
      );
      const route = probe.roots['p-route'];
      probe.owned = route?.kind === 'route' ? route.points[0] : undefined;
      probe.definition = map.definition!;
    },
  };
  probe.saveReferences();

  const record = (event: RecordedEvent): void => {
    probe.events.push(event);
    probe.eventHistory.push(event);
  };

  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(
      type,
      event => {
        const pointer = event as PointerEvent;
        record({
          type,
          time: performance.now(),
          trusted: event.isTrusted,
          pointerId: pointer.pointerId,
          pointerType: pointer.pointerType,
        });
      },
      { capture: true },
    );
  }

  for (const type of ['press', 'release', 'objectclick']) {
    map.addEventListener(type, event => {
      const { object, layer, route, clientPoint, mapPoint, isClick } = (
        event as CustomEvent<
          import('#interaction/object-click-event.js').ObjectClickDetail & { isClick?: boolean }
        >
      ).detail;
      const root = object && probe.roots[object.id];
      const originalOwned = object && probe.ownedPoints.includes(object as MapPoint);
      record({
        type,
        time: performance.now(),
        isClick,
        objectId: object?.id,
        layerId: layer?.id,
        routeId: route?.id,
        objectSame: object ? object === root || originalOwned : undefined,
        layerSame: layer ? layer === probe.layers[layer.id] : undefined,
        routeSame: route ? route === probe.roots[route.id] : route === undefined,
        clientPoint: { x: clientPoint.x, y: clientPoint.y },
        mapPoint: { x: mapPoint.x, y: mapPoint.y },
      });
    });
  }

  window.platform = probe;
}

/** Test-local transcription of the acceptance plan's disposable P setup. */
export async function loadP(): Promise<void> {
  const { map } = window.platform;
  const background = map.definition!.layers.find(layer => layer.background)!.background!;
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 20;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 20, 20);
  context.fillStyle = '#00ff00';
  context.fillRect(20, 0, 10, 20);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path fill="#ff0000" d="M0 0h20v20H0z"/><path fill="#00ff00" d="M20 0h10v20H20z"/></svg>';
  const point = (
    x: number,
    y: number,
    z: number,
  ): import('#definitions/map-point-definition.js').MapPointDefinition => ({
    kind: 'point',
    position: { x, y, z },
  });
  await map.load({
    resources: {
      svg: { kind: 'image', source: 'data:image/svg+xml,' + encodeURIComponent(svg) },
      png: { kind: 'image', source: canvas.toDataURL('image/png') },
    },
    materials: {
      labels: {
        properties: {
          label: { font: { size: '20px' }, origin: 'top left', offset: { x: '0px', y: '30px' } },
        },
      },
      child: {
        inherits: 'labels',
        properties: { label: { color: '#663399', font: { weight: 'bold' } } },
      },
      iconBase: { inherits: 'child', properties: { symbol: 'image', image: { resource: 'svg' } } },
      icon: { inherits: 'iconBase', properties: { color: '#0000ff' } },
      onlyFirst: { properties: { label: { color: '#ff0000' } } },
    },
    materialRules: [{ when: { kind: ['point', 'line', 'route', 'polygon'] }, material: 'child' }],
    layers: [
      { id: 'site', stackIndex: -1, background },
      { id: 'p-full', objects: ['p-icon', 'p-text', 'p-line', 'p-flat'] },
      {
        id: 'p-low',
        stackIndex: 1,
        intersectionBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 360, y: 200, z: 3 } },
      },
      {
        id: 'p-high',
        stackIndex: 2,
        intersectionBounds: { min: { x: 0, y: 0, z: 3 }, max: { x: 360, y: 200, z: 6 } },
      },
      { id: 'p-over', stackIndex: 3 },
    ],
    objects: [
      { ...point(40, 90, 9), id: 'p-icon', material: 'icon' },
      { ...point(170, 45, 9), id: 'p-text', label: '  A  B  ' },
      { id: 'p-line', kind: 'line', label: 'Line', points: [point(40, 45, 9), point(120, 45, 9)] },
      {
        id: 'p-route',
        kind: 'route',
        label: 'Route',
        points: [
          { ...point(30, 130, 1), id: 'p-owned', label: 'Owned', pickable: true },
          point(150, 130, 5),
          point(270, 130, 1),
        ],
      },
      {
        id: 'p-flat',
        kind: 'polygon',
        label: 'Flat',
        baseZ: 9,
        contour: [
          { x: 210, y: 15 },
          { x: 250, y: 15 },
          { x: 250, y: 35 },
          { x: 210, y: 35 },
        ],
      },
      {
        id: 'p-volume',
        kind: 'polygon',
        label: 'Volume',
        baseZ: 1,
        height: 4,
        contour: [
          { x: 280, y: 70 },
          { x: 320, y: 70 },
          { x: 320, y: 90 },
          { x: 280, y: 90 },
        ],
      },
    ],
  });
  map.style.fontFamily = 'monospace';
  map.camera.center = { x: 180, y: 100 };
  map.camera.zoom = Math.min(map.camera.viewport.width / 360, map.camera.viewport.height / 200);
  window.platform.saveReferences();
}
