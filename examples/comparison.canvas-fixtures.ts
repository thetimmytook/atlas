import { createStressScene, HIT_POSITION } from './stress.scene.js';

import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { CanvasChange } from './comparison.canvas.js';
import type { StressScene } from './stress.scene.js';

const POSITION_SCENARIO = 'position-single';
const BLUE_NEW: CanvasChange = 'blue-new';
const ORANGE_NEW: CanvasChange = 'orange-new';
const ORANGE_OLD: CanvasChange = 'orange-old';
const SYMBOL_CLEARED: CanvasChange = 'symbol-cleared';

export interface CanvasFixture {
  id: string;
  scene: StressScene;
  scenario: string;
  required: CanvasChange[];
}

function point(id: string, x: number, y: number): MapPointDefinition {
  return { id, kind: 'point', position: { x, y } };
}

/** Separate sparse controls; never substitute them for a measured stress scene. */
export function canvasFixtures(): CanvasFixture[] {
  const base = createStressScene(3000, 'mixed');
  const gutter = point('gutter', HIT_POSITION.x, HIT_POSITION.y);
  const isolated = point('independent', 45, 30);
  const line: MapEntryDefinition = {
    id: 'line',
    kind: 'line',
    points: [point('line-start', 45, 30), point('line-end', 15, 60)],
  };
  const route: MapEntryDefinition = {
    id: 'route',
    kind: 'route',
    points: [
      point('route-start', 90, 25),
      point('route-middle', 60, 55),
      point('route-end', 100, 110),
    ],
  };
  const replaced: MapEntryDefinition = {
    id: 'replaced-route',
    kind: 'route',
    points: [
      point('start', 40, 30),
      point('old-middle-0', 100, 75),
      point('old-middle-1', 95, 110),
      point('end', 40, 115),
    ],
  };
  const overlay: MapEntryDefinition = {
    id: 'top-line',
    kind: 'line',
    points: [point('overlay-start', 25, 30), point('overlay-end', 75, 30)],
  };
  const routeOverlay: MapEntryDefinition = {
    id: 'route-overlay',
    kind: 'line',
    points: [point('over-start', 50, 50), point('over-end', 80, 95)],
  };
  const fixture = (
    id: string,
    scenario: string,
    objects: MapEntryDefinition[],
    required: CanvasChange[],
    additions: MapEntryDefinition[] = [],
  ): CanvasFixture => ({
    id,
    scenario,
    required,
    scene: {
      ...base,
      id: `canvas-control-${id}`,
      definition: { ...base.definition, objects: [...objects, gutter] },
      additions,
    },
  });

  return [
    fixture('independent-point', POSITION_SCENARIO, [isolated], [BLUE_NEW, SYMBOL_CLEARED]),
    fixture('line-endpoint', POSITION_SCENARIO, [line], [ORANGE_NEW, ORANGE_OLD, 'clear-new']),
    fixture(
      'route-vertex-and-path',
      POSITION_SCENARIO,
      [route],
      [BLUE_NEW, SYMBOL_CLEARED, ORANGE_NEW, 'path-cleared'],
    ),
    fixture('add-over-line', 'add-1', [overlay], [BLUE_NEW, ORANGE_OLD], [isolated]),
    fixture('remove-under-line', 'remove-1', [isolated, overlay], ['blue-old', 'clear-new']),
    fixture('remove-route', 'remove-1', [route], ['blue-old', ORANGE_OLD, 'clear-new']),
    fixture(
      'route-replacement-and-order',
      'route-update',
      [replaced, routeOverlay],
      [BLUE_NEW, SYMBOL_CLEARED, ORANGE_NEW, 'path-cleared'],
    ),
  ];
}
