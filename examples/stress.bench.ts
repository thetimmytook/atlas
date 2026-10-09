import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { prepareMutationCheck } from './stress.check.js';
import { instrumentAtlas } from './stress.instrument.js';
import {
  BACKGROUND_SIZE,
  cameraAt,
  createStressScene,
  HIT_POSITION,
  initialScale,
  MISS_POSITION,
  SEED,
  VIEWPORT,
} from './stress.scene.js';

import type { MapEntry } from '#objects/map-object-collection.js';
import type { StressScene } from './stress.scene.js';

declare const __BENCH_BUILD__: {
  sourceCommit: string;
  dirty: string;
  hashes: Record<string, string>;
};

const WARMUPS = 1;
const REPEATS = 5;
const MOTION_MS = 1500;
const QUERY_SAMPLES = 200;
const ROUTE_SCENARIO = 'route-update';
const SCENARIOS = [
  'load',
  'pan',
  'zoom',
  'hit',
  'miss',
  'position-single',
  'position-series',
  'add-100',
  'add-500',
  'add-1000',
  'remove-100',
  'remove-500',
  'remove-1000',
  ROUTE_SCENARIO,
  'wheel-input',
] as const;
type Scenario = (typeof SCENARIOS)[number];
interface Row {
  engine: string;
  version: string;
  renderer: string;
  runId: string;
  sceneId: string;
  scenario: string;
  metric: string;
  unit: string;
  sample: number;
  value: number;
}

function element<T extends HTMLElement>(id: string): T {
  const target = document.getElementById(id);

  if (!target) {
    throw new Error('Missing benchmark control.');
  }

  return target as T;
}

const stage = element('stage');
const controls = element<HTMLFieldSetElement>('controls');
const status = element('status');
const rows: Row[] = [];
const runs: object[] = [];
let preview: MapElement | undefined;
let invalidated = false;

customElements.define('atlas-map', MapElement);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    invalidated = true;
  }
});
window.addEventListener('resize', () => {
  invalidated = true;
});

function frame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/** Scheduling opportunities only; neither callback proves paint or presentation. */
async function opportunities(): Promise<void> {
  await frame();
  await frame();
}

function surface(map: MapElement): SVGSVGElement {
  const svg = map.shadowRoot?.querySelector('svg');

  if (!svg) {
    throw new Error('Missing benchmark SVG.');
  }

  return svg;
}

async function createMap(
  scene: StressScene,
): Promise<{ map: MapElement; loadMs: number; totalMs: number }> {
  const start = performance.now();
  const map = new MapElement();
  stage.replaceChildren(map);
  await opportunities();
  const loadStart = performance.now();

  try {
    await map.load(scene.definition);
    const loadMs = performance.now() - loadStart;
    await opportunities();

    return { map, loadMs, totalMs: performance.now() - start };
  } catch (error) {
    map.remove();
    throw error;
  }
}

function record(
  runId: string,
  scene: StressScene,
  scenario: string,
  metric: string,
  unit: string,
  sample: number,
  value: number,
): void {
  rows.push({
    engine: 'Atlas',
    version: `${__BENCH_BUILD__.sourceCommit.slice(0, 12)}+bench`,
    renderer: 'SVG',
    runId,
    sceneId: scene.id,
    scenario,
    metric,
    unit,
    sample,
    value,
  });
}

function checkScene(map: MapElement, scene: StressScene): void {
  const svg = surface(map);

  if (
    map.objects.size !== scene.roots ||
    svg.querySelectorAll('g[data-object-id]').length !== scene.counts.visualPrimitives ||
    svg.querySelector('[visibility="hidden"]') ||
    !svg.getAttribute('viewBox')
  ) {
    throw new Error('Scene composition or initial render mismatch.');
  }
}

async function motion(
  map: MapElement,
  scenario: 'pan' | 'zoom',
  emit: (metric: string, unit: string, index: number, value: number) => void,
): Promise<void> {
  const scale = initialScale(map.camera.viewport.width, map.camera.viewport.height);
  const original = surface(map).getAttribute('viewBox');
  const start = await frame();
  let previous = start;
  let index = 0;
  let changed = false;

  while (previous - start < MOTION_MS) {
    const time = await frame();
    emit('frame_interval_ms', 'ms', index, time - previous);
    const target = cameraAt(Math.min(1, (time - start) / MOTION_MS), scenario, scale);
    const operationStart = performance.now();

    if (scenario === 'pan') {
      map.camera.center = new Point2(target.x, target.y);
    } else {
      map.camera.zoom = target.scale;
    }

    emit('camera_api_sync_ms', 'ms', index, performance.now() - operationStart);
    changed ||= surface(map).getAttribute('viewBox') !== original;
    previous = time;
    index += 1;
  }

  await opportunities();

  if (!changed) {
    throw new Error('Motion did not change the displayed scene.');
  }

  emit('motion_elapsed_ms', 'ms', 0, previous - start);
  emit('camera_updates', 'count', 0, index);
}

type Emit = (metric: string, unit: string, index: number, value: number) => void;

function queries(map: MapElement, scene: StressScene, scenario: 'hit' | 'miss', emit: Emit): void {
  // Same root collection, separate internal spatial view; not DOM input latency.
  const spatial = new Spatial(prepareSceneGeometry(map.objects, map.layers));
  const position = scenario === 'hit' ? HIT_POSITION : MISS_POSITION;
  const point = new Point2(position.x, position.y);

  for (let index = 0; index < QUERY_SAMPLES; index += 1) {
    const start = performance.now();
    const hit = spatial.hitTest(point, map.camera);
    emit('spatial_hit_test_sync_ms', 'ms', index, performance.now() - start);

    if (scenario === 'hit' ? hit?.object.id !== `root-${scene.roots - 5}` : hit !== undefined) {
      throw new Error('Unexpected spatial query result.');
    }
  }
}

function editPositions(roots: readonly MapEntry[], amount: number): void {
  for (const object of roots.slice(0, amount)) {
    const point = object.kind === 'point' ? object : object.points[0];

    if (point) {
      point.position = new Point3(point.position.x + 1, point.position.y + 1, point.position.z);
    }
  }
}

function editRoute(roots: readonly MapEntry[]): void {
  const route = roots.find(object => object.kind === 'route');

  if (!route || route.kind !== 'route') {
    throw new Error('Route scenario is unavailable.');
  }

  route.replacePoints(1, route.points.length - 1, [
    { id: 'replacement-0', kind: 'point', position: { x: 60, y: 65 } },
    { id: 'replacement-1', kind: 'point', position: { x: 62, y: 67 } },
  ]);
}

function massChange(
  map: MapElement,
  scene: StressScene,
  scenario: string,
  roots: readonly MapEntry[],
  start: number,
): {
  delta: number;
  checkpoints: { count: number; elapsed: number }[];
} {
  const amount = Number(scenario.split('-').at(1));
  const adding = scenario.startsWith('add-');
  const checkpoints: { count: number; elapsed: number }[] = [];

  for (let index = 0; index < amount; index += 1) {
    if (adding) {
      const added = map.objects.add(scene.additions.at(index)!);
      map.layers[0]!.objectIds.add(added.id);
    } else if (!map.objects.remove(roots.at(index)!)) {
      throw new Error('Root removal failed.');
    }

    if ((index + 1) % 100 === 0) {
      checkpoints.push({ count: index + 1, elapsed: performance.now() - start });
    }
  }

  return { delta: adding ? amount : -amount, checkpoints };
}

async function wheelInput(map: MapElement, emit: Emit): Promise<void> {
  const svg = surface(map);

  // Read the client anchor outside dispatch timing; renderer/input reads stay measured.
  const client = map.coordinates.mapToClient(map.camera.center);

  for (let index = 0; index < 10; index += 1) {
    const event = new WheelEvent('wheel', {
      clientX: client.x,
      clientY: client.y,
      deltaY: -50,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    });
    const start = performance.now();
    svg.dispatchEvent(event);
    emit('synthetic_wheel_dispatch_sync_ms', 'ms', index, performance.now() - start);

    if (!event.defaultPrevented) {
      throw new Error('Wheel input was not handled.');
    }

    await opportunities();
  }
}

async function operation(
  map: MapElement,
  scene: StressScene,
  scenario: Scenario,
  emit: Emit,
): Promise<void> {
  if (scenario === 'pan' || scenario === 'zoom') {
    await motion(map, scenario, emit);

    return;
  }

  if (scenario === 'wheel-input') {
    await wheelInput(map, emit);

    return;
  }

  if (scenario === 'hit' || scenario === 'miss') {
    queries(map, scene, scenario, emit);

    return;
  }

  const roots = Array.from(map.objects);
  const start = performance.now();
  let delta = 0;
  let checkpoints: { count: number; elapsed: number }[] = [];

  switch (scenario) {
    case 'position-single':
      editPositions(roots, 1);
      break;
    case 'position-series':
      editPositions(roots, 100);
      break;
    case ROUTE_SCENARIO:
      editRoute(roots);
      break;
    default:
      ({ delta, checkpoints } = massChange(map, scene, scenario, roots, start));
  }

  emit('operation_sync_ms', 'ms', 0, performance.now() - start);

  for (const checkpoint of checkpoints) {
    emit('cumulative_operation_ms', 'ms', checkpoint.count, checkpoint.elapsed);
  }

  await opportunities();
  emit('operation_to_raf_opportunities_ms', 'ms', 0, performance.now() - start);

  if (map.objects.size !== scene.roots + delta) {
    throw new Error('Post-operation root count mismatch.');
  }
}

function emitInstrumentation(
  trace: ReturnType<typeof instrumentAtlas> | undefined,
  emit: Emit,
): void {
  if (!trace) {
    return;
  }

  for (const [metric, value] of trace.counters) {
    emit(metric, 'count', 0, value);
  }

  if (!trace.counters.has('layout_rect_reads')) {
    emit('layout_rect_reads', 'count', 0, 0);
  }

  trace.renderDurations.forEach((value, index) =>
    emit('instrumented_renderer_callback_ms', 'ms', index, value),
  );
  trace.preparationDurations.forEach((value, index) =>
    emit('instrumented_prepare_promise_ms', 'ms', index, value),
  );
}

async function sample(
  runId: string,
  scene: StressScene,
  scenario: Scenario,
  repeat: number,
  measured: boolean,
  instrumented: boolean,
): Promise<void> {
  const trace = instrumented ? instrumentAtlas() : undefined;
  let map: MapElement | undefined;

  try {
    const loaded = await createMap(scene);
    map = loaded.map;
    checkScene(map, scene);
    const checkMutation = prepareMutationCheck(map, scene, scenario);

    const emit = (metric: string, unit: string, index: number, value: number): void => {
      if (measured) {
        record(runId, scene, scenario, metric, unit, repeat * 10000 + index, value);
      }
    };

    if (scenario === 'load') {
      emit('load_promise_ms', 'ms', 0, loaded.loadMs);
      emit('create_to_raf_opportunities_ms', 'ms', 0, loaded.totalMs);
      emit('semantic_roots', 'count', 0, map.objects.size);
      emit('owned_points', 'count', 0, scene.counts.ownedPoints);
      emit('visual_primitives', 'count', 0, scene.counts.visualPrimitives);
      emit('svg_element_nodes', 'count', 0, surface(map).querySelectorAll('*').length + 1);
      emit('shadow_element_nodes', 'count', 0, map.shadowRoot!.querySelectorAll('*').length);
      const walker = document.createTreeWalker(map.shadowRoot!, NodeFilter.SHOW_ALL);
      let nodes = 0;

      while (walker.nextNode()) {
        nodes += 1;
      }

      emit('shadow_dom_nodes', 'count', 0, nodes);
    } else {
      trace?.reset();
      await operation(map, scene, scenario, emit);
    }

    emitInstrumentation(trace, emit);

    // Validation reads must not enter timings or instrumentation metrics.
    checkMutation?.();

    if (trace) {
      const retained = map.objects[Symbol.iterator]().next().value;
      map.remove();
      trace.reset();

      if (retained?.kind === 'point') {
        retained.position = new Point3(0, 0);
      }

      await opportunities();
      emit('cleanup_renderer_calls', 'count', 0, trace.renderDurations.length);
      emit('cleanup_stage_children', 'count', 0, stage.childElementCount);

      if (trace.renderDurations.length || stage.childElementCount) {
        throw new Error('Disconnected scene retained rendering activity.');
      }
    }
  } finally {
    map?.remove();
    trace?.restore();
    stage.replaceChildren();
  }

  if (invalidated || document.hidden) {
    throw new Error('Run invalidated by hidden page or viewport resize; discard this run.');
  }
}

function csv(): string {
  const columns: (keyof Row)[] = [
    'engine',
    'version',
    'renderer',
    'runId',
    'sceneId',
    'scenario',
    'metric',
    'unit',
    'sample',
    'value',
  ];

  return [columns.join(','), ...rows.map(row => Object.values(row).join(','))].join('\n') + '\n';
}

function publish(): void {
  element<HTMLTextAreaElement>('results').value = csv();
  element<HTMLTextAreaElement>('metadata').value = JSON.stringify(runs, null, 2);
  const groups = new Map<string, number[]>();

  for (const row of rows) {
    if (
      row.unit !== 'ms' ||
      row.metric === 'camera_api_sync_ms' ||
      row.metric === 'cumulative_operation_ms'
    ) {
      continue;
    }

    const key = `${row.runId} ${row.sceneId} ${row.scenario} ${row.metric}`;
    const values = groups.get(key) ?? [];
    values.push(row.value);
    groups.set(key, values);
  }

  element('summary').textContent = Array.from(groups, ([key, values]) => {
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median =
      values.length % 2 ? values.at(middle)! : (values.at(middle - 1)! + values.at(middle)!) / 2;

    return `${key}: n=${values.length}, median=${median.toFixed(3)}, p95=${values.at(Math.ceil(values.length * 0.95) - 1)!.toFixed(3)}, max=${values.at(-1)!.toFixed(3)} ms${values.length < 20 ? ' (small sample)' : ''}`;
  }).join('\n');
}

async function run(all: boolean, instrumented: boolean): Promise<void> {
  controls.disabled = true;
  preview?.remove();
  preview = undefined;
  invalidated = false;
  const runId = `${instrumented ? 'instrument' : 'timing'}-${new Date().toISOString().replaceAll(':', '-')}`;
  const scenes = all
    ? [
        createStressScene(3000, 'points'),
        createStressScene(5000, 'points'),
        createStressScene(3000, 'mixed'),
        createStressScene(5000, 'mixed'),
      ]
    : [selectedScene()];
  const selection = element<HTMLSelectElement>('scenario').value as Scenario;
  const rect = stage.getBoundingClientRect();
  runs.push({
    runId,
    buildMode: import.meta.env.PROD ? 'production' : 'development',
    ...__BENCH_BUILD__,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    viewport: { width: rect.width, height: rect.height },
    window: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
    seed: SEED,
    warmups: instrumented ? 0 : WARMUPS,
    repeats: instrumented ? 1 : REPEATS,
    motionMs: MOTION_MS,
    querySamples: QUERY_SAMPLES,
    instrumented,
    backgroundCache:
      'explicit Image.decode warmup before every run; network cold load not measured',
    scenes: scenes.map(scene => ({
      id: scene.id,
      roots: scene.roots,
      composition: scene.composition,
      counts: scene.counts,
    })),
  });

  try {
    const image = new Image();
    image.src = scenes[0]!.definition.layers[0]!.background!.source;
    await image.decode();
    await executeSamples(runId, scenes, all ? SCENARIOS : [selection], instrumented);

    status.textContent = `Complete: ${runId}. Stage released; ${rows.length} CSV rows.`;
  } catch (error) {
    // Discard partial timing rows; record failure in metadata instead.
    rows.splice(0, rows.length, ...rows.filter(row => row.runId !== runId));
    runs.push({
      runId,
      failed: true,
      reason: error instanceof Error ? error.message : String(error),
    });
    status.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    controls.disabled = false;
    publish();
  }
}

async function executeSamples(
  runId: string,
  scenes: StressScene[],
  scenarios: readonly Scenario[],
  instrumented: boolean,
): Promise<void> {
  const repeats = instrumented ? 1 : WARMUPS + REPEATS;

  for (let repeat = 0; repeat < repeats; repeat += 1) {
    // Reverse scene order on alternate repeats; engine order belongs to step two.
    const ordered = repeat % 2 ? [...scenes].reverse() : scenes;

    for (const scene of ordered) {
      const available = scenarios.filter(
        scenario => scenario !== ROUTE_SCENARIO || scene.composition === 'mixed',
      );

      for (const scenario of available) {
        status.textContent = `${runId}: ${scene.id}, ${scenario}, repeat ${repeat + 1}/${repeats}`;
        await sample(
          runId,
          scene,
          scenario,
          Math.max(0, repeat - (instrumented ? 0 : WARMUPS)),
          instrumented || repeat >= WARMUPS,
          instrumented,
        );
      }
    }
  }
}

function selectedScene(): StressScene {
  const roots = Number(element<HTMLSelectElement>('roots').value) as 3000 | 5000;
  const composition = element<HTMLSelectElement>('composition').value as StressScene['composition'];

  return createStressScene(roots, composition);
}

function download(contents: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

element<HTMLSelectElement>('scenario').replaceChildren(
  ...SCENARIOS.map(scenario => {
    const option = document.createElement('option');
    option.value = scenario;
    option.textContent = scenario;

    return option;
  }),
);
element('run').addEventListener('click', () => {
  void run(false, false);
});
element('suite').addEventListener('click', () => {
  void run(true, false);
});
element('instrument').addEventListener('click', () => {
  void run(true, true);
});
element('preview').addEventListener('click', () => {
  void (async (): Promise<void> => {
    controls.disabled = true;
    preview?.remove();

    try {
      const scene = selectedScene();
      preview = (await createMap(scene)).map;
      checkScene(preview, scene);
      status.textContent = `${scene.id}: ${JSON.stringify(scene.counts)}; viewport ${preview.camera.viewport.width}×${preview.camera.viewport.height}; target ${VIEWPORT.width}×${VIEWPORT.height}; background ${BACKGROUND_SIZE.width}×${BACKGROUND_SIZE.height}.`;
    } catch (error) {
      status.textContent = String(error);
    } finally {
      controls.disabled = false;
    }
  })();
});
element('csv').addEventListener('click', () => {
  download(csv(), 'atlas-benchmark.csv', 'text/csv');
});
element('json').addEventListener('click', () => {
  download(JSON.stringify(runs, null, 2), 'atlas-benchmark-runs.json', 'application/json');
});
