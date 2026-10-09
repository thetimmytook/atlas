import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import {
  assert,
  frame,
  functionalChecks,
  initialFloors,
  mutation,
  settle,
  surface,
} from './prototype-bench.check.js';
import { instrument } from './prototype-bench.instrument.js';
import {
  backgroundMetadata,
  backgroundSvg,
  composition,
  createScene,
  MAP_VIEWPORT,
  SEED,
} from './prototype-bench.scene.js';

import type { ObjectClickDetail } from '#interaction/object-click-event.js';

declare const __PROTOTYPE_BENCH_BUILD__: {
  sourceCommit: string;
  dirty: string;
  hashes: Record<string, string>;
};

const MUTATIONS = [
  'floor-switch',
  'vertex-position',
  'route-add',
  'route-insert',
  'route-remove',
  'route-replacePoints',
  'polygon-vertex',
  'polygon-baseZ',
  'polygon-height',
  'root-add',
  'root-remove',
  'layer-direct-add',
  'layer-direct-remove',
] as const;
const SCENARIOS = ['load', 'pan', 'zoom', 'pick-hit', 'pick-miss', ...MUTATIONS] as const;
const MOTION_FRAMES = 24;
const PICKS = 40;
type Phase = 'timing' | 'instrument';
interface Row {
  phase: Phase;
  roots: number;
  repeat: number;
  scenario: string;
  metric: string;
  unit: string;
  sample: number;
  value: number;
}
interface Options {
  warmups: number;
  repeats: number;
  instrumentRepeats: number;
}

const stage = document.getElementById('stage')!;
const status = document.getElementById('status')!;
customElements.define('atlas-prototype-bench', MapElement);
let invalidated = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    invalidated = true;
  }
});
window.addEventListener('resize', () => {
  invalidated = true;
});

function environment(): object {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight },
    mapViewport: MAP_VIEWPORT,
    visibility: document.visibilityState,
    crossOriginIsolated,
    timerResolutionNote:
      'performance.now; browser quantization applies. Zero does not imply no work.',
  };
}

async function attach(): Promise<MapElement> {
  const map = new MapElement();
  stage.replaceChildren(map);
  await settle();
  assert(
    map.camera.viewport.width === MAP_VIEWPORT.width &&
      map.camera.viewport.height === MAP_VIEWPORT.height,
    'Unexpected map viewport.',
  );

  return map;
}

function nodes(map: MapElement): Record<string, number> {
  const svg = surface(map);
  const groups = Array.from(svg.querySelectorAll<SVGGElement>('[data-object-id]'));
  const visible = groups.filter(group => group.parentElement?.getAttribute('display') !== 'none');
  const walker = document.createTreeWalker(map.shadowRoot!, NodeFilter.SHOW_ALL);
  let total = 0;

  while (walker.nextNode()) {
    total += 1;
  }

  return {
    svg_element_nodes: svg.querySelectorAll('*').length + 1,
    shadow_element_nodes: map.shadowRoot!.querySelectorAll('*').length,
    shadow_all_nodes: total,
    appearances_all_layers: groups.length,
    appearances_visible_layers: visible.length,
    visible_point_symbols: visible.filter(group => group.querySelector('circle')).length,
    visible_route_fragments: visible.filter(group => group.querySelector('polyline')).length,
    visible_polygon_paths: visible.filter(group => group.querySelector('path')).length,
    layers: map.layers.length,
    visible_layers: map.layers.filter(layer => layer.visible).length,
  };
}

type Emit = (metric: string, unit: string, value: number, sample?: number) => void;

/** Minimal observation in timing runs; no patched prototypes or work counters. */
async function observeOperation(
  map: MapElement,
  action: () => void | Promise<void>,
  emit: Emit,
  loading = false,
): Promise<void> {
  let lastDelivery: number | undefined;
  const observer = new MutationObserver(() => {
    lastDelivery = performance.now();
  });
  observer.observe(surface(map), { attributes: true, childList: true, subtree: true });
  const start = performance.now();

  try {
    const pending = action();
    const syncEnd = performance.now();
    emit(loading ? 'load_call_sync_ms' : 'operation_sync_ms', 'ms', syncEnd - start);
    await pending;
    const apiEnd = performance.now();

    if (loading) {
      emit('load_promise_ms', 'ms', apiEnd - start);
    }

    const first = await frame();
    const second = await frame();
    emit('operation_to_two_raf_ms', 'ms', performance.now() - start);
    emit('raf_interval_ms', 'ms', second - first);
    emit('svg_mutation_observed', 'boolean', lastDelivery === undefined ? 0 : 1);

    if (lastDelivery !== undefined) {
      emit('svg_last_delivery_from_start_ms', 'ms', lastDelivery - start);

      // Time after synchronous return; includes scheduling and MutationObserver delivery.
      emit('post_sync_svg_delivery_ms', 'ms', lastDelivery - syncEnd);
    }
  } finally {
    observer.disconnect();
  }
}

async function motion(map: MapElement, scenario: string, emit: Emit): Promise<void> {
  const center = map.camera.center;
  const zoom = map.camera.zoom;
  let previous = await frame();
  let operationStart = 0;
  let syncEnd = 0;
  let currentIndex = -1;
  const observer = new MutationObserver(() => {
    if (currentIndex < 0) {
      return;
    }

    const delivery = performance.now();
    emit('svg_last_delivery_from_start_ms', 'ms', delivery - operationStart, currentIndex);
    emit('post_sync_svg_delivery_ms', 'ms', delivery - syncEnd, currentIndex);
  });
  observer.observe(surface(map), { attributes: true, childList: true, subtree: true });

  try {
    for (let index = 0; index < MOTION_FRAMES; index += 1) {
      const time = await frame();
      emit('raf_interval_ms', 'ms', time - previous, index);
      const angle = ((index + 1) / MOTION_FRAMES) * Math.PI * 2;
      const start = performance.now();
      operationStart = start;
      currentIndex = index;

      if (scenario === 'pan') {
        map.camera.center = new Point2(
          center.x + Math.sin(angle) * 60,
          center.y + (1 - Math.cos(angle)) * 40,
        );
      } else {
        map.camera.zoom = zoom * 2 ** ((1 - Math.cos(angle)) / 2);
      }

      syncEnd = performance.now();
      emit('camera_api_sync_ms', 'ms', syncEnd - start, index);
      previous = time;
    }

    await settle();
  } finally {
    observer.disconnect();
  }
}

function preparePicking(map: MapElement, scenario: string, emit: Emit): () => void {
  // Same runtime roots/layers, separate scene view. Setup is excluded from query timings.
  // Public component input is checked separately with real browser mouse events.
  const spatial = new Spatial(prepareSceneGeometry(map.objects, map.layers));
  const position = scenario === 'pick-hit' ? new Point2(670, 480) : new Point2(600, 380);
  const expected = map.objects.get('probe-membership');
  assert(expected, 'Missing picking target.');

  return () => {
    for (let index = 0; index < PICKS; index += 1) {
      const start = performance.now();
      const result = spatial.hitTest(position, map.camera);
      emit('spatial_pick_sync_ms', 'ms', performance.now() - start, index);
      assert(
        scenario === 'pick-hit'
          ? result?.object === expected && result.layer.id === 'b3-f0'
          : result === undefined,
        'Picking sample mismatch.',
      );
    }
  };
}

async function sample(
  phase: Phase,
  roots: 3000 | 5000,
  scenario: string,
  repeat: number,
  measured: boolean,
  background: string,
  rows: Row[],
): Promise<void> {
  const definition = createScene(roots, background);
  const map = await attach();
  let trace: ReturnType<typeof instrument> | undefined;

  const emit: Emit = (metric, unit, value, index = 0) => {
    if (measured) {
      rows.push({ phase, roots, repeat, scenario, metric, unit, sample: index, value });
    }
  };

  try {
    if (scenario !== 'load') {
      await map.load(definition);
      initialFloors(map);
      await settle();
    }

    const action = MUTATIONS.includes(scenario as (typeof MUTATIONS)[number])
      ? mutation(map, scenario)
      : undefined;
    const pick = scenario.startsWith('pick-') ? preparePicking(map, scenario, emit) : undefined;
    trace = phase === 'instrument' ? instrument() : undefined;

    if (scenario === 'load') {
      await observeOperation(map, () => map.load(definition), emit, true);
    } else if (scenario === 'pan' || scenario === 'zoom') {
      await motion(map, scenario, emit);
    } else if (scenario.startsWith('pick-')) {
      assert(pick, 'Missing picking operation.');
      pick();
    } else {
      assert(action, 'Missing operation.');
      await observeOperation(map, action, emit);
    }

    // Snapshot before correctness/count reads, and remove patches before cleanup.
    const counters = trace?.snapshot();
    trace?.restore();
    trace = undefined;

    if (counters) {
      const keys = [
        'svg_attribute_writes',
        'svg_map_geometry_writes',
        'svg_symbol_scale_writes',
        'svg_viewbox_writes',
        'root_iterator_creations',
        'root_iterator_next_calls',
        'runtime_points_getter_reads',
        'runtime_contour_getter_reads',
        'runtime_baseZ_getter_reads',
        'runtime_height_getter_reads',
        'renderer_scene_reads',
        'renderer_entries_exposed',
        'renderer_composition_changes',
        'renderer_changed_entries',
        'renderer_callbacks',
      ];
      keys.forEach(key => emit(key, 'count', counters[key] ?? 0));
      Object.entries(nodes(map)).forEach(([key, value]) => emit(key, 'count', value));
    }

    assert(
      map.objects.size ===
        roots + Number(scenario === 'root-add') - Number(scenario === 'root-remove'),
      'Root count after operation differs.',
    );
    assert(
      !surface(map).querySelector('[visibility="hidden"]'),
      'Unpainted SVG groups remain after observation.',
    );
  } finally {
    trace?.restore();
    map.remove();
  }

  assert(!invalidated && !document.hidden, 'Hidden/resized page invalidates capture.');
}

async function run(phase: Phase, options: Options): Promise<object> {
  invalidated = false;
  const rows: Row[] = [];
  const background = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  const start = new Date().toISOString();

  try {
    const repeats = phase === 'timing' ? options.repeats : options.instrumentRepeats;

    for (const roots of [3000, 5000] as const) {
      for (let repeat = -options.warmups; repeat < repeats; repeat += 1) {
        // Rotate order deterministically to reduce a fixed scenario/time-order bias.
        const offset = (repeat + options.warmups) % SCENARIOS.length;
        const order = [...SCENARIOS.slice(offset), ...SCENARIOS.slice(0, offset)];

        for (const scenario of order) {
          status.textContent = `${phase}, ${roots} roots, repeat ${repeat}, ${scenario}`;
          await sample(phase, roots, scenario, repeat, repeat >= 0, background, rows);
        }
      }
    }

    return {
      phase,
      start,
      end: new Date().toISOString(),
      build: __PROTOTYPE_BENCH_BUILD__,
      environment: environment(),
      options,
      motionFrames: MOTION_FRAMES,
      picksPerRepeat: PICKS,
      scenarios: SCENARIOS,
      rows,
    };
  } finally {
    URL.revokeObjectURL(background);
    stage.replaceChildren();
    status.textContent = 'Capture finished.';
  }
}

async function hashText(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function check(): Promise<object> {
  const background = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  const results: object[] = [];

  try {
    for (const roots of [3000, 5000] as const) {
      const map = await attach();

      try {
        const definition = createScene(roots, background);
        await map.load(definition);
        const allLayers = nodes(map);
        initialFloors(map);
        await settle();
        const initial = nodes(map);
        results.push({
          roots,
          composition: composition(definition),
          definitionSha256: await hashText(
            JSON.stringify(createScene(roots, 'generated-background.svg')),
          ),
          allLayers,
          initial,
          functional: await functionalChecks(map),
        });
      } finally {
        map.remove();
      }
    }

    return {
      results,
      seed: SEED,
      background: { ...backgroundMetadata(), sha256: await hashText(backgroundSvg()) },
      environment: environment(),
    };
  } finally {
    URL.revokeObjectURL(background);
  }
}

let nativeMap: MapElement | undefined;
let nativeBackground: string | undefined;
let nativeHit: ObjectClickDetail | undefined;

async function nativeSetup(): Promise<object> {
  nativeBackground = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  nativeMap = await attach();
  await nativeMap.load(createScene(3000, nativeBackground));
  initialFloors(nativeMap);
  await settle();
  nativeMap.addEventListener('objectclick', event => {
    nativeHit = (event as CustomEvent<ObjectClickDetail>).detail;
  });

  return nativeAnchor(90, 80);
}

function nativeAnchor(x: number, y: number): object {
  assert(nativeMap, 'Native check not initialized.');
  nativeHit = undefined;
  const client = nativeMap.coordinates.mapToClient(new Point2(x, y));

  return { x: client.x, y: client.y };
}

function nativeAssert(id: string, layer: string): void {
  const expected = nativeMap?.objects.get(id) ?? nativeMap?.objects.get('probe-route');
  assert(
    nativeMap &&
      nativeHit?.object.id === id &&
      (id === 'pr-1' ? nativeHit.route === expected : nativeHit.object === expected) &&
      nativeHit?.layer === nativeMap.layers.find(entry => entry.id === layer),
    'Native input returned wrong source/layer.',
  );
}

const api = {
  build: __PROTOTYPE_BENCH_BUILD__,
  run,
  check,
  nativeSetup,
  nativeAnchor,
  nativeAssert,
  nativeEdit(): object {
    assert(nativeMap, 'Native check not initialized.');
    mutation(nativeMap, 'vertex-position')();

    return nativeAnchor(110, 80);
  },
  async nativeFloor(): Promise<object> {
    assert(nativeMap, 'Native check not initialized.');
    mutation(nativeMap, 'floor-switch')();
    await settle();

    return nativeAnchor(125, 80);
  },
  nativeCleanup(): void {
    nativeMap?.remove();
    nativeMap = undefined;

    if (nativeBackground) {
      URL.revokeObjectURL(nativeBackground);
    }
  },
};
declare global {
  interface Window {
    prototypeBench: typeof api;
  }
}
window.prototypeBench = api;
