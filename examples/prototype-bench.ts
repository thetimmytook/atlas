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
import { motion, MOTION_FRAMES } from './prototype-bench.motion.js';
import {
  backgroundMetadata,
  backgroundSvg,
  composition,
  createScene,
  MAP_VIEWPORT,
  PROFILES,
  resourceMetadata,
  SEED,
} from './prototype-bench.scene.js';
import {
  componentProbe,
  labelPosition,
  VISUAL_MUTATIONS,
  visualChecks,
  visualMutation,
} from './prototype-bench.visual.js';
import { zoomSession } from './prototype-bench.zoom.js';

import type { ObjectClickDetail } from '#interaction/object-click-event.js';
import type { Profile } from './prototype-bench.scene.js';

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
const SCENARIOS = [
  'load',
  'pan',
  'zoom',
  'pick-hit',
  'pick-miss',
  'label-query-hit',
  'label-query-miss',
  'native-label-hit',
  'native-label-miss',
  ...MUTATIONS,
] as const;
const PICKS = 40;
type Phase = 'timing' | 'instrument';
interface Row {
  phase: Phase;
  roots: number;
  profile: Profile;
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
MapElement.configure({
  properties: [
    {
      name: 'benchVisual',
      valueType: 'string',
      optional: true,
      appliesTo: ['point', 'line', 'route', 'polygon'],
      read: (object): unknown => object.data?.visual,
    },
  ],
});
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

  const viewport = svg.getBoundingClientRect();

  const intersects = (node: Element): boolean => {
    const box = node.getBoundingClientRect();

    return (
      box.right > viewport.left &&
      box.left < viewport.right &&
      box.bottom > viewport.top &&
      box.top < viewport.bottom
    );
  };

  return {
    text_nodes_viewport_intersecting: visible.filter(group => {
      const text = group.querySelector(':scope > text');

      return text && intersects(text);
    }).length,
    icons_viewport_intersecting: visible.filter(group => {
      const image = group.querySelector(':scope > image');

      return image && intersects(image);
    }).length,
    svg_element_nodes: svg.querySelectorAll('*').length + 1,
    shadow_element_nodes: map.shadowRoot!.querySelectorAll('*').length,
    shadow_all_nodes: total,
    appearances_all_layers: groups.length,
    appearances_visible_layers: visible.length,
    visible_point_symbols: visible.filter(group => group.querySelector('circle, image')).length,
    text_nodes_all_layers: svg.querySelectorAll('[data-object-id] > text').length,
    text_nodes_visible_layers: visible.filter(group => group.querySelector(':scope > text')).length,
    icons_all_layers: svg.querySelectorAll('[data-object-id] > image').length,
    icons_visible_layers: visible.filter(group => group.querySelector(':scope > image')).length,
    visible_route_fragments: visible.filter(group => group.querySelector('polyline')).length,
    visible_polygon_paths: visible.filter(group => group.querySelector('path')).length,
    layers: map.layers.length,
    visible_layers: map.layers.filter(layer => layer.visible).length,
  };
}

function countLabels(definition: ReturnType<typeof createScene>): Record<string, number> {
  return definition.objects!.reduce(
    (counts, object) => {
      counts.roots += Number(Boolean(object.label?.trim()));

      if (object.kind === 'line' || object.kind === 'route') {
        counts.owned += object.points.filter(point => point.label?.trim()).length;
      }

      return counts;
    },
    { roots: 0, owned: 0 },
  );
}

async function warmResources(background: string): Promise<void> {
  const resources = createScene(3000, background, 'materials-labels').resources!;

  for (const source of [background, ...Object.values(resources).map(resource => resource.source)]) {
    const image = new Image();
    image.src = source;
    await image.decode();
  }

  await document.fonts.load('12px monospace');
  await document.fonts.load('16px monospace');
  await document.fonts.ready;
}

function componentQueries(map: MapElement, scenario: string, profile: Profile, emit: Emit): void {
  const probe = componentProbe(map);
  const client = map.coordinates.mapToClient(
    scenario === 'label-query-hit' ? labelPosition(map) : new Point2(600, 380),
  );

  try {
    for (let index = 0; index < PICKS; index++) {
      const start = performance.now();
      const hit = probe.query(client);
      emit('component_pointer_query_sync_ms', 'ms', performance.now() - start, index);
      assert(
        scenario === 'label-query-hit' && profile === 'materials-labels'
          ? hit?.object === map.objects.get('probe-point') && hit?.layer.id === 'b1-f1'
          : hit === undefined,
        'Component label query mismatch.',
      );
    }
  } finally {
    probe.close();
  }
}

async function nativeSamples(
  map: MapElement,
  scenario: string,
  profile: Profile,
  emit: Emit,
): Promise<void> {
  const position = scenario === 'native-label-hit' ? labelPosition(map) : new Point2(600, 380);
  const client = map.coordinates.mapToClient(position);
  let hit: ObjectClickDetail | undefined;
  let start = 0;
  let clickTime: number | undefined;

  const begin = (event: Event): void => {
    assert(event.isTrusted, 'Native input must be trusted.');
    start = performance.now();
    hit = undefined;
    clickTime = undefined;
  };

  const clicked = (event: Event): void => {
    hit = (event as CustomEvent<ObjectClickDetail>).detail;
    clickTime = performance.now();
  };

  const end = (): void => {
    emit('native_pointerup_dispatch_ms', 'ms', performance.now() - start);
  };

  const svg = surface(map);
  svg.addEventListener('pointerup', begin, true);
  map.addEventListener('objectclick', clicked);
  svg.addEventListener('pointerup', end);

  try {
    await window.prototypeNativeClick({ x: client.x, y: client.y });
    assert(
      scenario === 'native-label-hit' && profile === 'materials-labels'
        ? hit?.object === map.objects.get('probe-point') && hit?.layer.id === 'b1-f1'
        : hit === undefined,
      'Native label input mismatch.',
    );

    if (clickTime !== undefined) {
      emit('native_pointerup_to_objectclick_ms', 'ms', clickTime - start);
    }
  } finally {
    svg.removeEventListener('pointerup', begin, true);
    map.removeEventListener('objectclick', clicked);
    svg.removeEventListener('pointerup', end);
  }
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
  profile: Profile,
  scenario: string,
  repeat: number,
  measured: boolean,
  background: string,
  rows: Row[],
): Promise<void> {
  const definition = createScene(roots, background, profile);
  const map = await attach();
  let trace: ReturnType<typeof instrument> | undefined;

  const emit: Emit = (metric, unit, value, index = 0) => {
    if (measured) {
      rows.push({ phase, roots, profile, repeat, scenario, metric, unit, sample: index, value });
    }
  };

  try {
    // Install only in the diagnostic phase, before prepare(), then discard setup counts.
    trace = phase === 'instrument' ? instrument(map) : undefined;

    if (scenario !== 'load') {
      await map.load(definition);
      initialFloors(map);
      await settle();
    }

    let action: (() => void) | undefined;

    if (MUTATIONS.includes(scenario as (typeof MUTATIONS)[number])) {
      action = mutation(map, scenario);
    } else if (VISUAL_MUTATIONS.includes(scenario as (typeof VISUAL_MUTATIONS)[number])) {
      action = visualMutation(map, scenario);
    }

    const pick = scenario.startsWith('pick-') ? preparePicking(map, scenario, emit) : undefined;
    const beforeNodes =
      phase === 'instrument' ? Array.from(surface(map).querySelectorAll('*')) : [];
    const beforeNodeSet = new Set(beforeNodes);
    trace?.reset();

    if (scenario === 'load') {
      await observeOperation(map, () => map.load(definition), emit, true);
    } else if (scenario === 'pan' || scenario === 'zoom') {
      await motion(map, scenario, emit);
    } else if (scenario.startsWith('label-query-')) {
      const client = map.coordinates.mapToClient(new Point2(600, 380));
      await window.prototypeNativeHold({ x: client.x, y: client.y }, true);

      try {
        componentQueries(map, scenario, profile, emit);
      } finally {
        await window.prototypeNativeHold({ x: client.x, y: client.y }, false);
      }
    } else if (scenario.startsWith('native-label-')) {
      await nativeSamples(map, scenario, profile, emit);
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
        'svg_css_style_mutations',
        'svg_touched_owners',
        'svg_touched_text_owners',
        'svg_text_attribute_writes',
        'svg_text_content_writes',
        'svg_style_attribute_writes',
        'text_measurement_getBBox',
        'displayed_text_content_writes',
        'measurement_text_content_writes',
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
      emit(
        'svg_nodes_retained',
        'count',
        beforeNodes.filter(node => surface(map).contains(node)).length,
      );
      emit('svg_nodes_before', 'count', beforeNodes.length);
      emit(
        'svg_nodes_new',
        'count',
        Array.from(surface(map).querySelectorAll('*')).filter(node => !beforeNodeSet.has(node))
          .length,
      );
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

function scenarioOrder(profile: Profile, index: number): string[] {
  const scenarios = profile === 'control' ? SCENARIOS : [...SCENARIOS, ...VISUAL_MUTATIONS];
  const offset = index % scenarios.length;

  return [...scenarios.slice(offset), ...scenarios.slice(0, offset)];
}

async function run(phase: Phase, options: Options): Promise<object> {
  invalidated = false;
  const rows: Row[] = [];
  const background = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  const start = new Date().toISOString();

  try {
    const repeats = phase === 'timing' ? options.repeats : options.instrumentRepeats;

    await warmResources(background);

    for (const roots of [3000, 5000] as const) {
      for (let repeat = -options.warmups; repeat < repeats; repeat += 1) {
        await window.prototypeProgress({ phase, roots, repeat, repeats });

        // Rotate order deterministically to reduce a fixed scenario/time-order bias.
        // Alternate the profile that runs first each repetition, on the same runtime/page.
        const profiles = (repeat + options.warmups) % 2 ? [...PROFILES].reverse() : PROFILES;

        for (const profile of profiles) {
          const order = scenarioOrder(profile, repeat + options.warmups);

          for (const scenario of order) {
            status.textContent = `${phase}, ${roots}, ${profile}, repeat ${repeat}, ${scenario}`;
            await sample(phase, roots, profile, scenario, repeat, repeat >= 0, background, rows);
          }
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
      scenarios: { control: SCENARIOS, 'materials-labels': [...SCENARIOS, ...VISUAL_MUTATIONS] },
      profiles: PROFILES,
      resourceWarmup:
        'Background and both data icons decoded and document.fonts.ready before warmups. Every fresh map rebuilds its text-metric cache; load promise includes runtime icon fetch/decode; load-to-SVG/two-RAF additionally includes first label measurements in render.',
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

function geometryInput(definition: ReturnType<typeof createScene>): object[] {
  return definition.objects!.map(object => {
    const base = { id: object.id, kind: object.kind };

    if (object.kind === 'point') {
      return { ...base, position: object.position, pickable: object.pickable };
    }

    if (object.kind === 'polygon') {
      return { ...base, contour: object.contour, baseZ: object.baseZ, height: object.height };
    }

    return {
      ...base,
      points: object.points.map(point => ({
        id: point.id,
        kind: point.kind,
        position: point.position,
        pickable: point.pickable,
      })),
    };
  });
}

async function check(): Promise<object> {
  const background = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  const results: object[] = [];

  try {
    for (const profile of PROFILES) {
      const smaller = createScene(3000, 'generated-background.svg', profile);
      const larger = createScene(5000, 'generated-background.svg', profile);
      assert(
        JSON.stringify(smaller.objects) === JSON.stringify(larger.objects!.slice(0, 3000)),
        'Common profile prefix differs.',
      );
      assert(
        JSON.stringify(smaller) ===
          JSON.stringify(createScene(3000, 'generated-background.svg', profile)),
        'Profile is not deterministic.',
      );
      assert(
        JSON.stringify(geometryInput(larger)) ===
          JSON.stringify(geometryInput(createScene(5000, 'generated-background.svg'))),
        'Visual profile changed geometry.',
      );
      assert(
        JSON.stringify(larger.layers) ===
          JSON.stringify(createScene(5000, 'generated-background.svg').layers),
        'Visual profile changed layers.',
      );
    }

    for (const roots of [3000, 5000] as const) {
      for (const profile of PROFILES) {
        const map = await attach();

        try {
          const definition = createScene(roots, background, profile);
          await map.load(definition);
          await settle();
          const allLayers = nodes(map);
          initialFloors(map);
          await settle();
          const initial = nodes(map);
          results.push({
            roots,
            profile,
            resources: resourceMetadata(profile),
            labelledObjects: countLabels(definition),
            visual:
              profile === 'materials-labels'
                ? await visualChecks(map)
                : { passed: 0, applicable: false },
            composition: composition(definition),
            definitionSha256: await hashText(
              JSON.stringify(createScene(roots, 'generated-background.svg', profile)),
            ),
            allLayers,
            initial,
            functional: await functionalChecks(map),
          });
        } finally {
          map.remove();
        }
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

async function nativeSetup(
  roots: 3000 | 5000 = 3000,
  profile: Profile = 'control',
): Promise<object> {
  nativeBackground = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
  nativeMap = await attach();
  await nativeMap.load(createScene(roots, nativeBackground, profile));
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
  zoom: zoomSession({ attach, warmResources, valid: () => !invalidated && !document.hidden }),
  run,
  check,
  nativeSetup,
  nativeAnchor,
  nativeAssert,
  nativeLabel(): object {
    assert(nativeMap, 'Native map missing.');
    const position = labelPosition(nativeMap);

    return nativeAnchor(position.x, position.y);
  },
  nativeMiss(): object {
    return nativeAnchor(600, 380);
  },
  nativeAssertMiss(): void {
    assert(nativeHit === undefined, 'Native miss hit a label/object.');
  },
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
    prototypeProgress: (progress: {
      phase: Phase;
      roots: number;
      repeat: number;
      repeats: number;
    }) => Promise<void>;
    prototypeNativeHold: (point: { x: number; y: number }, down: boolean) => Promise<void>;
    prototypeNativeClick: (point: { x: number; y: number }) => Promise<void>;
  }
}
window.prototypeBench = api;
