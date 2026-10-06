import type { MapDefinition, MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

export const SEED = 0x41_54_4c_53;
export const BACKGROUND_SIZE = { width: 130.81831, height: 141.23242 };
export const VIEWPORT = { width: 800, height: 480 };
export const ROUTE_LENGTHS = [3, 6, 12] as const;
export const HIT_POSITION = { x: 20, y: 70 };
export const MISS_POSITION = { x: -30, y: 70 };

export interface StressScene {
  id: string;
  roots: 3000 | 5000;
  composition: 'points' | 'mixed';
  definition: MapDefinition;
  additions: readonly MapEntryDefinition[];
  counts: {
    points: number;
    lines: number;
    routes: number;
    ownedPoints: number;
    routeVertices: number;
    visualPrimitives: number;
  };
}

/** Shared engine-neutral data, explicit IDs, and an unsigned 32-bit LCG. */
export function createStressScene(
  roots: 3000 | 5000,
  composition: StressScene['composition'],
): StressScene {
  let state = SEED;
  let routeIndex = 0;

  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 2 ** 32;
  };

  const point = (id: string): MapPointDefinition => ({
    id,
    kind: 'point',
    position: {
      x: 35 + random() * (BACKGROUND_SIZE.width - 43),
      y: 8 + random() * (BACKGROUND_SIZE.height - 16),
    },
  });
  const objects = Array.from({ length: roots }, (_, index): MapEntryDefinition => {
    const id = `root-${index}`;
    const slot = index % 10;

    if (composition === 'points' || slot < 6) {
      const definition = point(id);

      // A reserved gutter guarantees a hit on this root and an in-viewport miss.
      return index === roots - 5 ? { ...definition, position: HIT_POSITION } : definition;
    }

    if (slot < 8) {
      return { id, kind: 'line', points: [point(`${id}-0`), point(`${id}-1`)] };
    }

    const length = ROUTE_LENGTHS[routeIndex % ROUTE_LENGTHS.length]!;
    routeIndex += 1;
    const origin = point(`${id}-0`);
    const points = Array.from({ length }, (_, vertex): MapPointDefinition => ({
      id: `${id}-${vertex}`,
      kind: 'point',
      position: {
        x: Math.min(BACKGROUND_SIZE.width - 8, origin.position.x + vertex * 0.8),
        y: Math.min(
          BACKGROUND_SIZE.height - 8,
          Math.max(8, origin.position.y + Math.sin(vertex) * 3),
        ),
      },
    }));

    return { id, kind: 'route', points };
  });
  const counts = objects.reduce(
    (total, object) => {
      total.visualPrimitives += 1;

      if (object.kind === 'point') {
        total.points += 1;

        return total;
      }

      total.ownedPoints += object.points.length;

      if (object.kind === 'line') {
        total.lines += 1;

        return total;
      }

      total.routes += 1;
      total.routeVertices += object.points.length;
      total.visualPrimitives += object.points.length;

      return total;
    },
    { points: 0, lines: 0, routes: 0, ownedPoints: 0, routeVertices: 0, visualPrimitives: 0 },
  );

  return {
    id: `${composition}-${roots}-seed-${SEED.toString(16)}`,
    roots,
    composition,
    definition: {
      background: {
        source: new URL('./factory/Factory-ground-floor.svg', import.meta.url).href,
        size: BACKGROUND_SIZE,
      },
      objects,
    },
    additions: Array.from({ length: 1000 }, (_, index) => point(`added-${index}`)),
    counts,
  };
}

/** CSS-pixel scale, rather than an engine-specific zoom number. */
export function initialScale(width: number, height: number): number {
  return Math.min(width / BACKGROUND_SIZE.width, height / BACKGROUND_SIZE.height);
}

/** One continuous cycle; endpoints return to the fitted camera. */
export function cameraAt(
  progress: number,
  scenario: 'pan' | 'zoom',
  scale: number,
): {
  x: number;
  y: number;
  scale: number;
} {
  const angle = progress * Math.PI * 2;

  return {
    x: BACKGROUND_SIZE.width / 2 + (scenario === 'pan' ? Math.sin(angle) * 15 : 0),
    y: BACKGROUND_SIZE.height / 2 + (scenario === 'pan' ? (1 - Math.cos(angle)) * 10 : 0),
    scale: scale * (scenario === 'zoom' ? 2 ** (1 - Math.cos(angle)) : 1),
  };
}
