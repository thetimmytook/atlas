import { version as leafletVersion } from 'leaflet';

import { MapElement } from '#components/map-element/map-element.js';
import { Point } from '#math/point.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';
import { Spatial } from '#spatial/spatial.js';

import { assertComparison, AtlasAdapter, initialCamera } from './comparison.adapter.js';
import { runCanvasControls } from './comparison.canvas-controls.js';
import { instrumentSvg } from './comparison.instrument.js';
import { LeafletAdapter } from './comparison.leaflet.js';
import { cameraAt, createStressScene, HIT_POSITION, MISS_POSITION, SEED } from './stress.scene.js';

import type { BenchmarkAdapter, CameraTarget, Variant } from './comparison.adapter.js';
import type { CanvasControls } from './comparison.canvas-controls.js';
import type { StressScene } from './stress.scene.js';

declare const __BENCH_BUILD__: {
  sourceCommit: string;
  dirty: string;
  hashes: Record<string, string>;
};
const LEAFLET_CANVAS = 'Leaflet Canvas';
const ROUTE_SCENARIO = 'route-update';
const VARIANTS: Variant[] = ['Atlas SVG', 'Leaflet SVG', LEAFLET_CANVAS];
const SCENARIOS = [
  'load',
  'pan',
  'zoom',
  'position-single',
  'position-series',
  'add-100',
  'add-500',
  'add-1000',
  'remove-100',
  'remove-500',
  'remove-1000',
  ROUTE_SCENARIO,
  'hit',
  'miss',
  'wheel-input',
];
const WARMUPS = 1;
const REPEATS = 5;
const MOTION_MS = 1500;
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
  value: number | null;
}
type Emit = (metric: string, unit: string, index: number, value: number | null) => void;

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id)! as T;
}

const stage = element('stage');
const controls = element<HTMLFieldSetElement>('controls');
const status = element('status');
const rows: Row[] = [];
const runs: object[] = [];
let preview: BenchmarkAdapter | undefined;
let invalidReason: string | undefined;
let activeRun = false;

if (!customElements.get('atlas-map')) {
  customElements.define('atlas-map', MapElement);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    invalidReason = 'hidden page';
  }
});
window.addEventListener('resize', () => {
  invalidReason = 'window resized';
});
new ResizeObserver(() => {
  const box = stage.getBoundingClientRect();

  if (box.width !== 800 || box.height !== 480) {
    invalidReason = 'stage resized';
  }
}).observe(stage);

for (const type of ['pointerdown', 'wheel', 'keydown']) {
  document.addEventListener(
    type,
    event => {
      if (activeRun && event.isTrusted) {
        invalidReason = 'trusted input interrupted run';
      }
    },
    { capture: true },
  );
}

function frame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

async function opportunities(): Promise<void> {
  await frame();
  await frame();
}

function adapter(variant: Variant): BenchmarkAdapter {
  return variant === 'Atlas SVG'
    ? new AtlasAdapter()
    : new LeafletAdapter(variant === LEAFLET_CANVAS);
}

function valid(dpr: number): void {
  const rect = stage.getBoundingClientRect();
  assertComparison(
    !document.hidden &&
      !invalidReason &&
      rect.width === 800 &&
      rect.height === 480 &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.right <= innerWidth &&
      rect.bottom <= innerHeight &&
      devicePixelRatio === dpr,
    invalidReason ?? 'viewport/DPR changed',
  );
}

async function motion(
  map: BenchmarkAdapter,
  scenario: 'pan' | 'zoom',
  emit: Emit,
  target: CameraTarget,
): Promise<void> {
  const start = await frame();
  let previous = start;
  let index = 0;
  let previousTarget = target;
  let checkedMotion = false;

  while (previous - start < MOTION_MS) {
    const time = await frame();
    emit('frame_interval_ms', 'ms', index, time - previous);

    if (!checkedMotion && previous - start >= MOTION_MS / 2) {
      map.checkCamera(previousTarget);
      checkedMotion = true;
    }

    const camera = cameraAt(Math.min(1, (time - start) / MOTION_MS), scenario, target.scale);
    const operationStart = performance.now();
    map.setCamera(camera, scenario);
    emit('camera_api_sync_ms', 'ms', index, performance.now() - operationStart);
    previous = time;
    previousTarget = camera;
    index += 1;
  }

  await opportunities();
  assertComparison(checkedMotion, 'motion midpoint observed');
  map.checkCamera(target);
  emit('motion_elapsed_ms', 'ms', 0, previous - start);
  emit('camera_updates', 'count', 0, index);
}

async function atlasDiagnostic(
  map: AtlasAdapter,
  scene: StressScene,
  scenario: string,
  emit: Emit,
): Promise<void> {
  if (scenario === 'wheel-input') {
    const host = map.host;
    const client = host.coordinates.mapToClient(host.camera.center);
    const svg = host.shadowRoot!.querySelector('svg')!;
    const originalScale = host.camera.zoom;

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
      assertComparison(event.defaultPrevented, 'Atlas wheel handled');
      await opportunities();
    }

    assertComparison(host.camera.zoom > originalScale, 'Atlas wheel zoom changed');

    return;
  }

  const spatial = new Spatial(prepareSceneGeometry(map.host.objects));
  const point = scenario === 'hit' ? HIT_POSITION : MISS_POSITION;
  const position = new Point(point.x, point.y);

  for (let index = 0; index < 200; index += 1) {
    const start = performance.now();
    const result = spatial.hitTest(position, map.host.camera);
    emit('spatial_hit_test_sync_ms', 'ms', index, performance.now() - start);
    assertComparison(
      scenario === 'hit' ? result?.object.id === `root-${scene.roots - 5}` : !result,
      'Atlas picking diagnostic',
    );
  }
}

async function measuredOperation(
  map: BenchmarkAdapter,
  scene: StressScene,
  scenario: string,
  emit: Emit,
  target: CameraTarget,
  perform: ReturnType<BenchmarkAdapter['prepareOperation']> | undefined,
): Promise<void> {
  if (scenario === 'pan' || scenario === 'zoom') {
    await motion(map, scenario, emit, target);

    return;
  }

  if (['hit', 'miss', 'wheel-input'].includes(scenario)) {
    assertComparison(map instanceof AtlasAdapter, 'Atlas diagnostic adapter');
    await atlasDiagnostic(map, scene, scenario, emit);

    return;
  }

  const checkpoints: { count: number; elapsed: number }[] = [];
  const start = performance.now();
  perform!(count => checkpoints.push({ count, elapsed: performance.now() - start }));
  emit('operation_sync_ms', 'ms', 0, performance.now() - start);
  checkpoints.forEach(point => emit('cumulative_operation_ms', 'ms', point.count, point.elapsed));
  await opportunities();
  emit('operation_to_raf_opportunities_ms', 'ms', 0, performance.now() - start);
}

function emitCounters(
  variant: Variant,
  counters: Record<string, number> | undefined,
  emit: Emit,
): void {
  for (const [metric, value] of [
    ['svg_attribute_writes', counters?.svg_attribute_writes],
    ['svg_attribute_removals', counters?.svg_attribute_removals],
    ['dom_added_nodes', counters?.dom_added_nodes],
    ['dom_removed_nodes', counters?.dom_removed_nodes],
  ] as const) {
    emit(metric, variant === LEAFLET_CANVAS ? 'N/A' : 'count', 0, value ?? null);
  }
}

async function sample(
  scene: StressScene,
  scenario: string,
  variant: Variant,
  emit: Emit,
  instrumented: boolean,
): Promise<void> {
  const dpr = devicePixelRatio;
  const diagnostic = ['hit', 'miss', 'wheel-input'].includes(scenario);

  if (
    (diagnostic && variant !== 'Atlas SVG') ||
    (scenario === ROUTE_SCENARIO && scene.composition !== 'mixed')
  ) {
    emit('not_applicable', 'N/A', 0, null);

    return;
  }

  const trace = instrumented && variant !== LEAFLET_CANVAS ? instrumentSvg() : undefined;
  let map: BenchmarkAdapter | undefined;

  try {
    const createStart = performance.now();
    map = adapter(variant);
    stage.replaceChildren(map.host);
    await opportunities();

    // Same connected-viewport opportunities precede setup for all engines.
    trace?.reset();
    const setupStart = performance.now();
    await map.setup(scene);
    const setupMs = performance.now() - setupStart;
    await opportunities();
    const totalMs = performance.now() - createStart;
    const target = initialCamera(800, 480);
    const initial = map.prepareCheck(scene, 'load');
    const loadCounters = trace?.finish();
    initial();
    map.checkCamera(target);
    const check = map.prepareCheck(scene, scenario);
    const perform = ['hit', 'miss', 'wheel-input', 'load', 'pan', 'zoom'].includes(scenario)
      ? undefined
      : map.prepareOperation(scene, scenario);

    if (scenario === 'load') {
      emit(
        variant === 'Atlas SVG' ? 'atlas_load_promise_ms' : 'leaflet_scene_setup_ms',
        'ms',
        0,
        setupMs,
      );
      emit('create_to_raf_opportunities_ms', 'ms', 0, totalMs);
      const nodes = map.nodeCounts();
      emit('semantic_roots', 'count', 0, scene.definition.objects!.length);
      emit('owned_points', 'count', 0, scene.counts.ownedPoints);
      emit('visual_primitives', 'count', 0, scene.counts.visualPrimitives);
      emit('svg_element_nodes', 'count', 0, nodes.svg);
      emit('owned_element_nodes', 'count', 0, nodes.elements);
    } else {
      trace?.reset();

      await measuredOperation(map, scene, scenario, emit, target, perform);
    }

    // Capture instrumentation before correctness reads and disposal.
    const counters = scenario === 'load' ? loadCounters : trace?.finish();

    if (instrumented) {
      emitCounters(variant, counters, emit);
    }

    check();

    if (scenario !== 'wheel-input') {
      map.checkCamera(target);
    }

    valid(dpr);
  } finally {
    trace?.restore();
    map?.dispose();
    stage.replaceChildren();
  }
}

function csv(): string {
  return (
    [
      'engine,version,renderer,runId,sceneId,scenario,metric,unit,sample,value',
      ...rows.map(row =>
        (Object.values(row) as (string | number | null)[]).map(value => value ?? 'N/A').join(','),
      ),
    ].join('\n') + '\n'
  );
}

function publish(): void {
  element<HTMLTextAreaElement>('results').value = csv();
  element<HTMLTextAreaElement>('metadata').value = JSON.stringify(runs, null, 2);
  const groups = new Map<string, number[]>();
  rows.forEach(row => {
    if (row.value === null || row.unit !== 'ms' || row.metric === 'cumulative_operation_ms') {
      return;
    }

    const key = `${row.runId} ${row.engine} ${row.renderer} ${row.sceneId} ${row.scenario} ${row.metric}`;
    const values = groups.get(key) ?? [];
    values.push(row.value);
    groups.set(key, values);
  });
  element('summary').textContent = Array.from(groups, ([key, values]) => {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 ? values.at(mid)! : (values.at(mid - 1)! + values.at(mid)!) / 2;
    const p95 = values[Math.ceil(values.length * 0.95) - 1]!;

    return `${key}: n=${values.length}, median=${median.toFixed(3)}, p95=${p95.toFixed(3)} ms`;
  }).join('\n');
}

async function run(all: boolean, instrumented: boolean): Promise<void> {
  controls.disabled = true;
  activeRun = true;
  preview?.dispose();
  preview = undefined;
  invalidReason = undefined;
  const runId = `comparison-${instrumented ? 'instrument' : 'timing'}-${new Date().toISOString().replaceAll(':', '-')}`;
  const scenes = all
    ? [
        createStressScene(3000, 'points'),
        createStressScene(5000, 'points'),
        createStressScene(3000, 'mixed'),
        createStressScene(5000, 'mixed'),
      ]
    : [selectedScene()];
  const scenarios = all ? SCENARIOS : [element<HTMLSelectElement>('scenario').value];
  const repeats = instrumented ? 1 : WARMUPS + REPEATS;
  const metadata = {
    runId,
    ...__BENCH_BUILD__,
    buildMode: import.meta.env.PROD ? 'production' : 'development',
    variants: VARIANTS,
    versions: { Atlas: __BENCH_BUILD__.sourceCommit, Leaflet: leafletVersion },
    leafletApiDocumentation: 'https://github.com/Leaflet/Leaflet/tree/v1.9.4/src',
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceNotes: element<HTMLTextAreaElement>('device').value,
    viewport: { width: 800, height: 480 },
    window: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
    seed: SEED,
    scenarios,
    symbols: {
      pointRadius: 11,
      pointStroke: 2,
      fill: '#2775d9',
      pointStrokeColor: '#ffffff',
      lineStroke: 4,
      lineColor: '#d95012',
      caps: 'round',
      joins: 'round',
    },
    initialCamera: initialCamera(800, 480),
    background: {
      size: { width: 130.81831, height: 141.23242 },
      source: 'Factory-ground-floor.svg',
    },
    instrumented,
    warmups: instrumented ? 0 : WARMUPS,
    repeats: instrumented ? 1 : REPEATS,
    motionMs: MOTION_MS,
    rafOpportunities: 2,
    backgroundCache:
      'Image.decode once before run; warm cache; navigation/module download excluded',
    order:
      'scene reversal every other repeat; engine cyclic rotation then reversal every other repeat',
    settings: {
      crs: 'Simple; [-y,x]',
      zoom: 'log2(CSS pixels per map unit)',
      zoomSnap: 0,
      animations: false,
      smoothFactor: 0,
      noClip: true,
      rendererPadding: 0,
      interactivePaths: false,
    },
    boundaries: {
      create_to_raf_opportunities_ms:
        'construction/connection + 2 RAF + engine setup with decoded background, scene and camera + 2 RAF',
      atlas_load_promise_ms: 'call/resolution of MapElement.load',
      leaflet_scene_setup_ms:
        'Leaflet map construction, camera, overlay and path installation, image load/decode; not readiness event',
      operation_sync_ms:
        'prepared synchronous mutation API sequence, adapter translation and checkpoint bookkeeping',
      operation_to_raf_opportunities_ms:
        'same mutation start to 2 subsequent RAF callbacks; not pixel presentation',
      frame_interval_ms:
        'consecutive RAF timestamps during 1500ms wall-clock trajectory; not renderer or paint duration',
    },
    unavailable: {
      leafletPicking: 'No public synchronous query equivalent to Spatial.hitTest; no custom scan',
      leafletWheel: 'native handler debounce and scale/input semantics differ',
      canvasSvgCounters: 'N/A; no claim about Canvas drawing cost',
      routePointsOnly: 'N/A; no routes',
    },
    correctness: {
      Atlas: 'existing definition oracle: model/spatial/SVG + background/camera',
      LeafletSVG:
        'public layer geometry/membership + actual ordered DOM path geometry/styles + independent CRS controls',
      LeafletCanvas:
        'each dense sample: public layer geometry/membership, camera/background and gutter pixel; sparse native Canvas reference preflight checks changed symbols/paths and old disappearance',
    },
    scenes: scenes.map(scene => ({
      id: scene.id,
      roots: scene.roots,
      composition: scene.composition,
      counts: scene.counts,
    })),
    canvasPreflight: { mode: 'preflight', status: 'running', cases: [] } as CanvasControls,
    completedSamples: 0,
    failed: false,
    reason: '',
  };
  runs.push(metadata);

  try {
    valid(devicePixelRatio);
    const image = new Image();
    image.src = scenes[0]!.definition.background.source;
    await image.decode();

    const dpr = devicePixelRatio;
    await runCanvasControls(
      stage,
      metadata.canvasPreflight,
      () => valid(dpr),
      message => {
        status.textContent = message;
      },
    );

    metadata.completedSamples = await executeSamples(
      runId,
      scenes,
      scenarios,
      instrumented,
      repeats,
    );
    status.textContent = `Complete: ${runId}; ${metadata.completedSamples} accepted sample slots.`;
  } catch (error) {
    rows.splice(0, rows.length, ...rows.filter(row => row.runId !== runId));
    metadata.failed = true;
    metadata.reason =
      error instanceof Error
        ? `${error.message} ${JSON.stringify(error.cause ?? '')}`
        : String(error);
    status.textContent = `Failed: ${metadata.reason}; all run rows discarded.`;
  } finally {
    controls.disabled = false;
    activeRun = false;
    publish();
  }
}

/** Functional-only export: no timing rows, warmups, or intrusive SVG counters. */
async function canvasDiagnostic(): Promise<void> {
  controls.disabled = true;
  activeRun = true;
  preview?.dispose();
  preview = undefined;
  invalidReason = undefined;
  const dpr = devicePixelRatio;
  const metadata = {
    runId: `canvas-functional-${new Date().toISOString().replaceAll(':', '-')}`,
    ...__BENCH_BUILD__,
    buildMode: import.meta.env.PROD ? 'production' : 'development',
    version: leafletVersion,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    deviceNotes: element<HTMLTextAreaElement>('device').value,
    viewport: { width: 800, height: 480 },
    window: { width: innerWidth, height: innerHeight },
    dpr,
    injection:
      'instance context clearRect/fill/stroke suppressed only after verified initial output; restored in finally; public camera round-trip redraw recovery',
    boundaries:
      'functional only; native reference rendering and pixel readback; no timing CSV rows',
    canvasControls: { mode: 'diagnostic', status: 'running', cases: [] } as CanvasControls,
    failed: false,
    reason: '',
  };
  runs.push(metadata);

  try {
    await runCanvasControls(
      stage,
      metadata.canvasControls,
      () => valid(dpr),
      message => {
        status.textContent = message;
      },
    );
    status.textContent =
      'Canvas functional complete: 7 normal passes, 7 frozen bitmap failures detected, 7 restored passes.';
  } catch (error) {
    metadata.failed = true;
    metadata.reason =
      error instanceof Error ? `${error.message} ${JSON.stringify(error.cause)}` : String(error);
    status.textContent = `Canvas functional failed: ${metadata.reason}`;
  } finally {
    controls.disabled = false;
    activeRun = false;
    publish();
  }
}

element('canvas-diagnostic').addEventListener('click', () => {
  void canvasDiagnostic();
});

function appendSample(pending: Row[], measured: boolean): void {
  if (measured) {
    rows.push(...pending);
  }
}

async function executeSamples(
  runId: string,
  scenes: StressScene[],
  scenarios: string[],
  instrumented: boolean,
  repeats: number,
): Promise<number> {
  let accepted = 0;

  for (let repeat = 0; repeat < repeats; repeat += 1) {
    const orderedScenes = repeat % 2 ? [...scenes].reverse() : scenes;
    const rotated = VARIANTS.slice(repeat % 3).concat(VARIANTS.slice(0, repeat % 3));

    if (repeat % 2) {
      rotated.reverse();
    }

    const variants = rotated;

    for (const scene of orderedScenes) {
      for (const scenario of scenarios) {
        for (const variant of variants) {
          status.textContent = `${runId}: ${scene.id}, ${scenario}, ${variant}, repeat ${repeat + 1}/${repeats}`;
          const pending: Row[] = [];
          await sample(
            scene,
            scenario,
            variant,
            (metric, unit, index, value) => {
              pending.push({
                engine: variant === 'Atlas SVG' ? 'Atlas' : 'Leaflet',
                version:
                  variant === 'Atlas SVG'
                    ? __BENCH_BUILD__.sourceCommit.slice(0, 12)
                    : leafletVersion,
                renderer: variant === LEAFLET_CANVAS ? 'Canvas' : 'SVG',
                runId,
                sceneId: scene.id,
                scenario,
                metric,
                unit,
                sample: Math.max(0, repeat - (instrumented ? 0 : WARMUPS)) * 10000 + index,
                value,
              });
            },
            instrumented,
          );

          appendSample(pending, instrumented || repeat >= WARMUPS);
          accepted += Number(instrumented || repeat >= WARMUPS);
        }
      }
    }
  }

  return accepted;
}

function selectedScene(): StressScene {
  return createStressScene(
    Number(element<HTMLSelectElement>('roots').value) as 3000 | 5000,
    element<HTMLSelectElement>('composition').value as StressScene['composition'],
  );
}

element<HTMLSelectElement>('scenario').replaceChildren(
  ...SCENARIOS.map(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;

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

function smokeScene(): StressScene {
  const scene = createStressScene(3000, 'mixed');

  return {
    ...scene,
    definition: {
      ...scene.definition,
      objects: [
        { id: 'smoke-point', kind: 'point', position: HIT_POSITION },
        {
          id: 'smoke-line',
          kind: 'line',
          points: [
            { id: 'line-start', kind: 'point', position: { x: 40, y: 30 } },
            { id: 'line-end', kind: 'point', position: { x: 90, y: 30 } },
          ],
        },
        {
          id: 'smoke-route',
          kind: 'route',
          points: [
            { id: 'route-start', kind: 'point', position: { x: 45, y: 60 } },
            { id: 'route-middle', kind: 'point', position: { x: 65, y: 90 } },
            { id: 'route-end', kind: 'point', position: { x: 90, y: 60 } },
          ],
        },
        {
          id: 'smoke-top-line',
          kind: 'line',
          points: [
            { id: 'top-start', kind: 'point', position: { x: 90, y: 60 } },
            { id: 'top-end', kind: 'point', position: { x: 105, y: 80 } },
          ],
        },
      ],
    },
  };
}

element('preview').addEventListener('click', () => showPreview(false));
element('smoke').addEventListener('click', () => showPreview(true));

function showPreview(smoke: boolean): void {
  void (async (): Promise<void> => {
    controls.disabled = true;
    preview?.dispose();
    preview = adapter(element<HTMLSelectElement>('variant').value as Variant);

    try {
      stage.replaceChildren(preview.host);
      await opportunities();
      const scene = smoke ? smokeScene() : selectedScene();
      await preview.setup(scene);
      await opportunities();
      preview.prepareCheck(scene, 'load')();
      preview.checkCamera(initialCamera(800, 480));
      status.textContent = `Preview verified: ${smoke ? 'sparse smoke' : scene.id}, ${element<HTMLSelectElement>('variant').value}`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? `${error.message} ${JSON.stringify(error.cause)}` : String(error);
    } finally {
      controls.disabled = false;
    }
  })();
}

for (const [id, mime, contents] of [
  ['csv', 'text/csv', csv],
  ['json', 'application/json', (): string => JSON.stringify(runs, null, 2)],
] as const) {
  element(id).addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([contents()], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `leaflet-comparison-${new Date().toISOString().slice(0, 10)}.${id === 'csv' ? 'csv' : 'json'}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
