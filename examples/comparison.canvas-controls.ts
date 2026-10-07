import { assertComparison, initialCamera } from './comparison.adapter.js';
import { canvasFixtures } from './comparison.canvas-fixtures.js';
import { expectedDefinitions } from './comparison.expected.js';
import { LeafletAdapter } from './comparison.leaflet.js';

import type { CanvasFixture } from './comparison.canvas-fixtures.js';
import type { CanvasPixels } from './comparison.canvas.js';

// Only bounded typed-array indices and the fixture's closed CanvasChange keys are indexed.
/* eslint-disable security/detect-object-injection */

interface ControlCase {
  fixture: string;
  scenario: string;
  mode: 'normal' | 'suppressed';
  definitions: ReturnType<typeof expectedDefinitions>;
  expected: ReturnType<typeof expectedDefinitions>;
  required: CanvasFixture['required'];
  initial?: CanvasPixels;
  output?: CanvasPixels;
  restored?: CanvasPixels;
  modelPassed?: boolean;
  bitmapUnchanged?: boolean;
  methodsRestored?: boolean;
  failed?: string;
}

export interface CanvasControls {
  mode: 'preflight' | 'diagnostic';
  status: 'running' | 'passed' | 'failed';
  cases: ControlCase[];
}

async function opportunities(): Promise<void> {
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => requestAnimationFrame(resolve));
}

function requireOutput(output: CanvasPixels, fixture: CanvasFixture, changed: boolean): void {
  assertComparison(output.passed, 'Sparse Canvas actual output');

  if (changed) {
    assertComparison(
      fixture.required.every(change => output.changes[change].probes > 0),
      'Sparse Canvas new/old symbol/path probe coverage',
    );
  }
}

function bitmap(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

/** Only called by the separate functional diagnostic, after verified initial output.
 * Patch this instance's public 2D context; never Canvas prototypes or Leaflet fields.
 */
async function suppressedMutation(
  map: LeafletAdapter,
  perform: () => void,
  read: () => CanvasPixels,
  result: ControlCase,
): Promise<void> {
  const canvas = map.host.querySelector('canvas')!;
  const context = canvas.getContext('2d')!;

  // Saved methods are only restored to this context, never invoked unbound.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = { clearRect: context.clearRect, fill: context.fill, stroke: context.stroke };
  const before = bitmap(canvas);

  try {
    context.clearRect = (): void => {};

    context.fill = (): void => {};

    context.stroke = (): void => {};

    perform();
    await opportunities();
    result.output = read();
    const after = bitmap(canvas);
    result.bitmapUnchanged = before.every((value, index) => value === after[index]);
  } finally {
    context.clearRect = original.clearRect;
    context.fill = original.fill;
    context.stroke = original.stroke;
    result.methodsRestored =
      context.clearRect === original.clearRect &&
      context.fill === original.fill &&
      context.stroke === original.stroke;
  }
}

async function controlCase(
  stage: HTMLElement,
  fixture: CanvasFixture,
  result: ControlCase,
): Promise<void> {
  const map = new LeafletAdapter(true);

  try {
    stage.replaceChildren(map.host);
    await opportunities();
    await map.setup(fixture.scene);
    await opportunities();
    map.prepareCheck(fixture.scene, 'load')();
    map.checkCamera(initialCamera(800, 480));
    result.initial = map.prepareCanvasOutputCheck(fixture.scene, 'load')();
    requireOutput(result.initial, fixture, false);
    const model = map.prepareCheck(fixture.scene, fixture.scenario);
    const read = map.prepareCanvasOutputCheck(fixture.scene, fixture.scenario);
    const operation = map.prepareOperation(fixture.scene, fixture.scenario);
    const perform = (): void => operation(() => {});

    if (result.mode === 'normal') {
      perform();
      await opportunities();
      result.output = read();
      requireOutput(result.output, fixture, true);
    } else {
      await suppressedMutation(map, perform, read, result);
      assertComparison(result.bitmapUnchanged === true, 'Suppressed Canvas bitmap unchanged');
      assertComparison(result.methodsRestored === true, 'Canvas drawing methods restored');
      assertComparison(result.output?.passed === false, 'Suppressed Canvas fault detected');
      assertComparison(
        fixture.required.every(change => result.output!.changes[change].mismatches > 0),
        'Suppressed Canvas new/old symbol/path failures',
      );
    }

    // Intentionally shows that public model checks alone accept the frozen bitmap.
    model();
    result.modelPassed = true;

    if (result.mode === 'suppressed') {
      // Removed layers no longer have a public redraw target. A camera round-trip
      // refreshes the whole Canvas, then returns to the same mutated model/view.
      const camera = initialCamera(800, 480);
      map.setCamera({ ...camera, x: camera.x + 10 }, 'pan');
      await opportunities();
      map.setCamera(camera, 'pan');
      await opportunities();
      result.restored = read();
      requireOutput(result.restored, fixture, true);
      model();
    }

    map.checkCamera(initialCamera(800, 480));
  } catch (error) {
    result.failed =
      error instanceof Error ? `${error.message} ${JSON.stringify(error.cause)}` : String(error);

    throw error;
  } finally {
    map.dispose();
    stage.replaceChildren();
  }
}

/** All native reference painting/readback is outside the timing/sample machinery. */
export async function runCanvasControls(
  stage: HTMLElement,
  report: CanvasControls,
  validate: () => void,
  progress: (message: string) => void,
): Promise<void> {
  try {
    for (const mode of report.mode === 'diagnostic'
      ? (['normal', 'suppressed'] as const)
      : (['normal'] as const)) {
      for (const fixture of canvasFixtures()) {
        const result: ControlCase = {
          fixture: fixture.id,
          scenario: fixture.scenario,
          mode,
          definitions: expectedDefinitions(fixture.scene, 'load'),
          expected: expectedDefinitions(fixture.scene, fixture.scenario),
          required: fixture.required,
        };
        report.cases.push(result);
        progress(`Canvas ${report.mode}: ${fixture.id}, ${mode}`);
        validate();
        await controlCase(stage, fixture, result);
        validate();
      }
    }

    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';

    throw error;
  }
}
