import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { assertComparison, initialCamera } from './comparison.adapter.js';
import { prepareCanvasPixels } from './comparison.canvas.js';
import { expectedDefinitions } from './comparison.expected.js';
import { BACKGROUND_SIZE, HIT_POSITION } from './stress.scene.js';

import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { BenchmarkAdapter, CameraTarget, Operation } from './comparison.adapter.js';
import type { CanvasPixels } from './comparison.canvas.js';
import type { StressScene } from './stress.scene.js';

interface RootLayers {
  id: string;
  kind: MapEntryDefinition['kind'];
  path: L.CircleMarker | L.Polyline;
  vertices: { id: string; layer: L.CircleMarker }[];
}

/** CRS.Simple projects (lng, -lat); hence Atlas (x,y) becomes Leaflet [-y,x]. */
function coordinate(position: { x: number; y: number }): L.LatLngTuple {
  return [-position.y, position.x];
}

const POINT_STYLE = {
  radius: 11,
  color: '#ffffff',
  weight: 2,
  fillColor: '#2775d9',
  fillOpacity: 1,
  opacity: 1,
  interactive: false,
  lineCap: 'round',
  lineJoin: 'round',
} satisfies L.CircleMarkerOptions;
const LINE_STYLE = {
  color: '#d95012',
  weight: 4,
  opacity: 1,
  fill: false,
  interactive: false,
  lineCap: 'round',
  lineJoin: 'round',
  smoothFactor: 0,
  noClip: true,
} satisfies L.PolylineOptions;

export class LeafletAdapter implements BenchmarkAdapter {
  readonly host = document.createElement('div');
  readonly #canvas: boolean;
  #map!: L.Map;
  #renderer!: L.Renderer;
  #background!: L.ImageOverlay;
  #roots: RootLayers[] = [];

  constructor(canvas: boolean) {
    this.#canvas = canvas;
    this.host.className = 'comparison-leaflet';
  }

  async setup(scene: StressScene): Promise<void> {
    this.#renderer = this.#canvas ? L.canvas({ padding: 0 }) : L.svg({ padding: 0 });
    this.#map = L.map(this.host, {
      crs: L.CRS.Simple,
      renderer: this.#renderer,
      zoomSnap: 0,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
      zoomControl: false,
      attributionControl: false,
      trackResize: false,
      minZoom: -20,
      maxZoom: 20,
    });
    const size = this.#map.getSize();
    const camera = initialCamera(size.x, size.y);
    this.#map.setView(coordinate(camera), Math.log2(camera.scale), { animate: false });
    this.#background = L.imageOverlay(
      scene.definition.layers[0]!.background!.source,
      [
        [-BACKGROUND_SIZE.height, 0],
        [0, BACKGROUND_SIZE.width],
      ],
      { interactive: false, opacity: 1 },
    );
    const ready = new Promise<void>((resolve, reject) => {
      this.#background.once('load', () => resolve());
      this.#background.once('error', () => reject(new Error('Leaflet background load failed.')));
    });
    this.#background.addTo(this.#map);
    this.#roots = scene.definition.objects!.map(definition => this.#addRoot(definition));
    await ready;
    await this.#background.getElement()!.decode();
  }

  #circle(id: string, position: { x: number; y: number }): L.CircleMarker {
    return L.circleMarker(coordinate(position), {
      ...POINT_STYLE,
      renderer: this.#renderer,
      className: id,
    }).addTo(this.#map);
  }

  #addRoot(definition: MapEntryDefinition): RootLayers {
    const id = definition.id!;

    if (definition.kind === 'point') {
      return {
        id,
        kind: definition.kind,
        path: this.#circle(id, definition.position),
        vertices: [],
      };
    }

    const path = L.polyline(
      definition.points.map(point => coordinate(point.position)),
      {
        ...LINE_STYLE,
        renderer: this.#renderer,
        className: id,
      },
    ).addTo(this.#map);
    const vertices =
      definition.kind === 'route'
        ? definition.points.map(point => ({
            id: point.id!,
            layer: this.#circle(point.id!, point.position),
          }))
        : [];

    return { id, kind: definition.kind, path, vertices };
  }

  setCamera(target: CameraTarget, motion: 'pan' | 'zoom'): void {
    if (motion === 'pan') {
      this.#map.panTo(coordinate(target), { animate: false });
    } else {
      this.#map.setView(coordinate(target), Math.log2(target.scale), { animate: false });
    }
  }

  prepareOperation(scene: StressScene, scenario: string): Operation {
    const amount = Number(scenario.split('-').at(1));
    const selected = this.#roots.slice(0, scenario === 'position-single' ? 1 : 100);
    const additions = scene.additions.slice(0, amount);
    const removed = this.#roots.slice(0, amount);
    const routeIndex = this.#roots.findIndex(root => root.kind === 'route');

    return (checkpoint): void => {
      if (scenario.startsWith('position-')) {
        selected.forEach(root => this.#move(root));

        return;
      }

      if (scenario === 'route-update') {
        const route = this.#roots.at(routeIndex)!;
        assertComparison(route.path instanceof L.Polyline, 'Leaflet route type');
        const points = route.path.getLatLngs() as L.LatLng[];
        route.path.setLatLngs([points[0]!, [-65, 60], [-67, 62], points.at(-1)!]);
        route.vertices.slice(1, -1).forEach(vertex => vertex.layer.remove());
        route.vertices = [
          route.vertices[0]!,
          { id: 'replacement-0', layer: this.#circle('replacement-0', { x: 60, y: 65 }) },
          { id: 'replacement-1', layer: this.#circle('replacement-1', { x: 62, y: 67 }) },
          route.vertices.at(-1)!,
        ];

        // Public ordering APIs restore path/vertex/root composition after insertion.
        // This adapter work is inside the route-update span, unlike dataset generation.
        this.#roots.slice(routeIndex).forEach(root => {
          root.path.bringToFront();
          root.vertices.forEach(vertex => vertex.layer.bringToFront());
        });

        return;
      }

      if (scenario.startsWith('add-')) {
        additions.forEach((definition, index) => {
          this.#roots.push(this.#addRoot(definition));

          if ((index + 1) % 100 === 0) {
            checkpoint(index + 1);
          }
        });

        return;
      }

      removed.forEach((root, index) => {
        root.path.remove();
        root.vertices.forEach(vertex => vertex.layer.remove());

        if ((index + 1) % 100 === 0) {
          checkpoint(index + 1);
        }
      });
      this.#roots.splice(0, amount);
    };
  }

  #move(root: RootLayers): void {
    if (root.path instanceof L.CircleMarker) {
      const current = root.path.getLatLng();
      root.path.setLatLng([current.lat - 1, current.lng + 1]);

      return;
    }

    const points = root.path.getLatLngs() as L.LatLng[];
    const first = points[0]!;
    const next: L.LatLngTuple = [first.lat - 1, first.lng + 1];
    root.path.setLatLngs([next, ...points.slice(1)]);
    root.vertices[0]?.layer.setLatLng(next);
  }

  prepareCheck(scene: StressScene, scenario: string): () => void {
    const expected = expectedDefinitions(scene, scenario);
    const removed = scenario.startsWith('remove-')
      ? this.#roots.slice(0, Number(scenario.split('-').at(1)))
      : [];

    return (): void => {
      assertComparison(this.#roots.length === expected.length, 'Leaflet root membership');
      const ordered: L.Path[] = [];
      expected.forEach((definition, index) => {
        const root = this.#roots.at(index)!;
        assertComparison(
          root.id === definition.id && root.kind === definition.kind,
          'Leaflet root order',
        );
        assertComparison(this.#map.hasLayer(root.path), 'Leaflet installed root');
        const points = definition.kind === 'point' ? [definition] : definition.points;
        const actual =
          root.path instanceof L.CircleMarker
            ? [root.path.getLatLng()]
            : (root.path.getLatLngs() as L.LatLng[]);
        assertComparison(actual.length === points.length, 'Leaflet line/route length');
        points.forEach((point, pointIndex) => {
          const value = actual.at(pointIndex)!;
          assertComparison(
            value.lng === point.position.x && value.lat === -point.position.y,
            'Leaflet coordinates',
          );
        });
        ordered.push(root.path);
        assertComparison(
          root.vertices.length === (definition.kind === 'route' ? points.length : 0),
          'Leaflet symbol count',
        );
        root.vertices.forEach((vertex, pointIndex) => {
          const point = points.at(pointIndex)!;
          const actual = vertex.layer.getLatLng();
          assertComparison(
            vertex.id === point.id &&
              this.#map.hasLayer(vertex.layer) &&
              actual.lng === point.position.x &&
              actual.lat === -point.position.y,
            'Leaflet vertex membership/order/position',
          );
          ordered.push(vertex.layer);
        });
      });
      removed.forEach(root => {
        assertComparison(
          !this.#map.hasLayer(root.path) &&
            root.vertices.every(vertex => !this.#map.hasLayer(vertex.layer)),
          'Leaflet removed roots',
        );
      });
      let paths = 0;
      this.#map.eachLayer(layer => {
        if (layer instanceof L.Path) {
          paths += 1;
        }
      });
      assertComparison(paths === ordered.length, 'Leaflet no extra installed paths');
      const image = this.#background.getElement()!;
      assertComparison(
        this.#map.hasLayer(this.#background) &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.src === scene.definition.layers[0]!.background!.source,
        'Leaflet loaded background',
      );

      if (this.#canvas) {
        assertComparison(
          this.host.querySelectorAll('canvas').length === 1,
          'Leaflet Canvas surface',
        );
        this.checkCanvasPixel(HIT_POSITION);

        return;
      }

      const elements = Array.from(this.host.querySelectorAll('svg > g > path'));
      assertComparison(elements.length === ordered.length, 'Leaflet SVG primitive count');
      ordered.forEach((layer, index) => {
        const element = layer.getElement() as SVGPathElement;
        assertComparison(element === elements.at(index), 'Leaflet SVG actual composition order');
        this.#checkPath(layer, element);
      });
    };
  }

  /** Sparse functional controls only; never called inside a measured sample. */
  prepareCanvasOutputCheck(scene: StressScene, scenario: string): () => CanvasPixels {
    assertComparison(this.#canvas, 'Canvas output checker variant');

    return prepareCanvasPixels(
      this.host,
      expectedDefinitions(scene, 'load'),
      expectedDefinitions(scene, scenario),
      position => this.#map.latLngToContainerPoint([-position.y, position.x]),
    );
  }

  #checkPath(layer: L.Path, element: SVGPathElement): void {
    const d = element.getAttribute('d')!;

    if (layer instanceof L.CircleMarker) {
      assertComparison(
        element.getAttribute('fill') === POINT_STYLE.fillColor &&
          element.getAttribute('stroke') === POINT_STYLE.color &&
          Number(element.getAttribute('stroke-width')) === 2 &&
          layer.getRadius() === 11,
        'Leaflet SVG point style',
      );
      const point = this.#map.latLngToLayerPoint(layer.getLatLng());
      const screen = this.#map.latLngToContainerPoint(layer.getLatLng());
      const size = this.#map.getSize();
      const outside =
        screen.x + 12 < 0 || screen.y + 12 < 0 || screen.x - 12 > size.x || screen.y - 12 > size.y;

      if (outside) {
        assertComparison(d === 'M0 0', 'Leaflet native circle culling');

        return;
      }

      assertComparison(
        d === `M${point.x - 11},${point.y}a11,11 0 1,0 22,0 a11,11 0 1,0 -22,0 `,
        'Leaflet SVG circle geometry',
      );

      return;
    }

    assertComparison(layer instanceof L.Polyline, 'Leaflet SVG path type');
    const points = (layer.getLatLngs() as L.LatLng[]).map(point =>
      this.#map.latLngToLayerPoint(point),
    );
    const expected = points
      .map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`)
      .join('');
    assertComparison(
      d === expected &&
        element.getAttribute('stroke') === LINE_STYLE.color &&
        Number(element.getAttribute('stroke-width')) === 4 &&
        element.getAttribute('fill') === 'none' &&
        element.getAttribute('stroke-linecap') === 'round' &&
        element.getAttribute('stroke-linejoin') === 'round',
      'Leaflet SVG line/route geometry/style',
    );
  }

  checkCamera(target: CameraTarget): void {
    const center = this.#map.getCenter();
    assertComparison(
      Math.abs(center.lng - target.x) * target.scale <= 1.1 &&
        Math.abs(-center.lat - target.y) * target.scale <= 1.1 &&
        Math.abs(2 ** this.#map.getZoom() - target.scale) < 1e-8,
      'Leaflet camera',
    );
    const size = this.#map.getSize();

    const image = this.#background.getElement()!.getBoundingClientRect();
    const host = this.host.getBoundingClientRect();
    assertComparison(
      Math.abs(image.x - host.x - (size.x / 2 - target.x * target.scale)) <= 1.5 &&
        Math.abs(image.y - host.y - (size.y / 2 - target.y * target.scale)) <= 1.5 &&
        Math.abs(image.width - BACKGROUND_SIZE.width * target.scale) <= 1.5 &&
        Math.abs(image.height - BACKGROUND_SIZE.height * target.scale) <= 1.5,
      'Leaflet displayed background camera',
    );

    // Independent screen-space controls catch swapped axes, sign and scale mistakes.
    for (const position of [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 100, y: 40 },
    ]) {
      const screen = this.#map.latLngToContainerPoint([-position.y, position.x]);
      assertComparison(
        Math.abs(screen.x - (size.x / 2 + (position.x - target.x) * target.scale)) <= 1.5 &&
          Math.abs(screen.y - (size.y / 2 + (position.y - target.y) * target.scale)) <= 1.5,
        'Independent CRS control',
      );
    }
  }

  checkCanvasPixel(position: { x: number; y: number }): void {
    const screen = this.#map.latLngToContainerPoint(coordinate(position));
    const canvas = this.host.querySelector('canvas')!;
    const bounds = canvas.getBoundingClientRect();
    const host = this.host.getBoundingClientRect();
    const x = Math.round(((screen.x + host.x - bounds.x) * canvas.width) / bounds.width);
    const y = Math.round(((screen.y + host.y - bounds.y) * canvas.height) / bounds.height);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      return;
    }

    const pixel = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data;
    assertComparison(
      pixel[0] === 39 && pixel[1] === 117 && pixel[2] === 217 && pixel[3] === 255,
      'Canvas gutter point pixel',
    );
  }

  nodeCounts(): { elements: number; svg: number | null } {
    const svg = this.host.querySelector('svg');

    return {
      elements: this.host.querySelectorAll('*').length + 1,
      svg: svg ? svg.querySelectorAll('*').length + 1 : null,
    };
  }

  dispose(): void {
    this.#map?.remove();
    this.host.remove();
  }
}
