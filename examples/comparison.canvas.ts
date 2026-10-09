import { assertComparison } from './comparison.adapter.js';

import type { StressEntryDefinition } from './stress.scene.js';

// Offsets are bounded numeric pixel indices; record keys are the closed CanvasChange union.
/* eslint-disable security/detect-object-injection */

type Position = { x: number; y: number };
export type CanvasChange =
  | 'blue-new'
  | 'blue-old'
  | 'orange-new'
  | 'orange-old'
  | 'clear-new'
  | 'symbol-cleared'
  | 'path-cleared';
export interface CanvasPixels {
  /** Pixel agreement only; the control separately requires changed-category coverage. */
  passed: boolean;
  compared: number;
  mismatches: number;
  examples: { x: number; y: number; expected: number[]; actual: number[] }[];
  changes: Record<CanvasChange, { probes: number; mismatches: number }>;
  backing: { width: number; height: number; scaleX: number; scaleY: number };
}

const BLUE = '#2775d9';
const ORANGE = '#d95012';
const WHITE = '#ffffff';

/** Sparse-only reference: input definitions, native Canvas, public map projection.
 * No layer getters, SVG rasterization, or renderer-private coordinates are used.
 */
function reference(
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  definitions: readonly StressEntryDefinition[],
  project: (position: Position) => Position,
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.scale(scaleX, scaleY);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const circle = (position: Position): void => {
    const screen = project(position);
    context.beginPath();
    context.arc(screen.x, screen.y, 11, 0, Math.PI * 2);
    context.fillStyle = BLUE;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = WHITE;
    context.stroke();
  };

  definitions.forEach(root => {
    if (root.kind === 'point') {
      circle(root.position);

      return;
    }

    context.beginPath();
    root.points.forEach((point, index) => {
      const screen = project(point.position);

      if (index === 0) {
        context.moveTo(screen.x, screen.y);
      } else {
        context.lineTo(screen.x, screen.y);
      }
    });
    context.lineWidth = 4;
    context.strokeStyle = ORANGE;
    context.stroke();

    if (root.kind === 'route') {
      root.points.forEach(point => circle(point.position));
    }
  });

  return context.getImageData(0, 0, width, height).data;
}

// Probe only flat, opaque palette interiors or fully transparent empty Canvas.
// The background is a separate ImageOverlay and is checked by the dense checker.
function colorAt(data: Uint8ClampedArray, index: number): number {
  if (data[index + 3] === 0) {
    return 0;
  }

  if (data[index + 3] !== 255) {
    return -1;
  }

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];

  if (red === 39 && green === 117 && blue === 217) {
    return 1;
  }

  if (red === 217 && green === 80 && blue === 18) {
    return 2;
  }

  return red === 255 && green === 255 && blue === 255 ? 3 : -1;
}

function stable(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  margin: number,
): number {
  const color = colorAt(data, (y * width + x) * 4);

  if (color < 0) {
    return -1;
  }

  for (let dy = -margin; dy <= margin; dy += 1) {
    for (let dx = -margin; dx <= margin; dx += 1) {
      // A square's diagonal corners can erase every interior of a 4px diagonal
      // stroke. Keep a flat diamond of the same CSS-pixel radius instead.
      if (Math.abs(dx) + Math.abs(dy) > margin) {
        continue;
      }

      if (colorAt(data, ((y + dy) * width + x + dx) * 4) !== color) {
        return -1;
      }
    }
  }

  return color;
}

// Native damage clipping can slightly change antialiasing versus an unclipped
// reference. These channel tolerances are far below blue/orange/white separation.
function matches(actual: Uint8ClampedArray, expected: Uint8ClampedArray, index: number): boolean {
  if (expected[index + 3] === 0) {
    return actual[index + 3]! <= 8;
  }

  return (
    actual[index + 3]! >= 239 &&
    Math.abs(actual[index]! - expected[index]!) <= 24 &&
    Math.abs(actual[index + 1]! - expected[index + 1]!) <= 24 &&
    Math.abs(actual[index + 2]! - expected[index + 2]!) <= 24
  );
}

function changedColors(oldColor: number, newColor: number): CanvasChange[] {
  if (oldColor === newColor) {
    return [];
  }

  const changes: CanvasChange[] = [];

  if (newColor === 1) {
    changes.push('blue-new');
  }

  if (oldColor === 1) {
    changes.push('blue-old');
  }

  if (newColor === 2) {
    changes.push('orange-new');
  }

  if (oldColor === 2) {
    changes.push('orange-old');
  }

  if (newColor === 0) {
    changes.push('clear-new');

    if (oldColor === 1 || oldColor === 3) {
      changes.push('symbol-cleared');
    }

    if (oldColor === 2) {
      changes.push('path-cleared');
    }
  }

  return changes;
}

/** Reference work is prepared before mutation; readback is after RAF, untimed. */
export function prepareCanvasPixels(
  host: HTMLElement,
  before: readonly StressEntryDefinition[],
  after: readonly StressEntryDefinition[],
  project: (position: Position) => Position,
): () => CanvasPixels {
  const canvas = host.querySelector('canvas')!;
  const bounds = canvas.getBoundingClientRect();
  const hostBounds = host.getBoundingClientRect();
  const { width, height } = canvas;
  const scaleX = width / bounds.width;
  const scaleY = height / bounds.height;

  const local = (position: Position): Position => {
    const screen = project(position);

    return { x: screen.x + hostBounds.x - bounds.x, y: screen.y + hostBounds.y - bounds.y };
  };

  const previous = reference(width, height, scaleX, scaleY, before, local);
  const expected = reference(width, height, scaleX, scaleY, after, local);

  // Leaflet 1.9.4 uses backing scale 1 or 2, not necessarily devicePixelRatio.
  // Require a flat expected diamond with about one CSS pixel of axial radius.
  // The old reference only classifies the transition at the probe itself: eroding
  // both sides would erase the 1-map-unit symbol's narrow changed crescents.
  const margin = Math.max(1, Math.floor(Math.min(scaleX, scaleY)));

  return (): CanvasPixels => {
    assertComparison(canvas.width === width && canvas.height === height, 'Canvas size stable');
    const actual = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    const result: CanvasPixels = {
      passed: true,
      compared: 0,
      mismatches: 0,
      examples: [],
      changes: {
        'blue-new': { probes: 0, mismatches: 0 },
        'blue-old': { probes: 0, mismatches: 0 },
        'orange-new': { probes: 0, mismatches: 0 },
        'orange-old': { probes: 0, mismatches: 0 },
        'clear-new': { probes: 0, mismatches: 0 },
        'symbol-cleared': { probes: 0, mismatches: 0 },
        'path-cleared': { probes: 0, mismatches: 0 },
      },
      backing: { width, height, scaleX, scaleY },
    };

    for (let y = margin; y < height - margin; y += 1) {
      for (let x = margin; x < width - margin; x += 1) {
        const oldColor = stable(previous, x, y, width, 0);
        const newColor = stable(expected, x, y, width, margin);

        if (oldColor < 0 || newColor < 0) {
          continue;
        }

        const mismatch = !matches(actual, expected, (y * width + x) * 4);

        if (mismatch && result.examples.length < 8) {
          const index = (y * width + x) * 4;
          result.examples.push({
            x,
            y,
            expected: Array.from(expected.slice(index, index + 4)),
            actual: Array.from(actual.slice(index, index + 4)),
          });
        }

        result.compared += 1;
        result.mismatches += Number(mismatch);

        changedColors(oldColor, newColor).forEach(change => {
          result.changes[change].probes += 1;
          result.changes[change].mismatches += Number(mismatch);
        });
      }
    }

    result.passed = result.compared > 0 && result.mismatches === 0;

    return result;
  };
}
