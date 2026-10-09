import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';

import { prepareMutationCheck } from './stress.check.js';
import { BACKGROUND_SIZE, cameraAt, initialScale } from './stress.scene.js';

import type { StressScene } from './stress.scene.js';

export type Variant = 'Atlas SVG' | 'Leaflet SVG' | 'Leaflet Canvas';
export type CameraTarget = ReturnType<typeof cameraAt>;
export type Operation = (checkpoint: (count: number) => void) => void;
export interface BenchmarkAdapter {
  host: HTMLElement;
  setup(scene: StressScene): Promise<void>;
  setCamera(target: CameraTarget, motion: 'pan' | 'zoom'): void;
  prepareOperation(scene: StressScene, scenario: string): Operation;
  prepareCheck(scene: StressScene, scenario: string): () => void;
  checkCamera(target: CameraTarget): void;
  nodeCounts(): { elements: number; svg: number | null };
  dispose(): void;
}

export function assertComparison(condition: boolean, check: string): asserts condition {
  if (!condition) {
    throw new Error('Comparison correctness check failed.', { cause: { check } });
  }
}

export function initialCamera(width: number, height: number): CameraTarget {
  return {
    x: BACKGROUND_SIZE.width / 2,
    y: BACKGROUND_SIZE.height / 2,
    scale: initialScale(width, height),
  };
}

/** Concrete example adapter; no engine contract or renderer abstraction is introduced. */
export class AtlasAdapter implements BenchmarkAdapter {
  readonly host = new MapElement();

  async setup(scene: StressScene): Promise<void> {
    await this.host.load(scene.definition);
  }

  setCamera(target: CameraTarget, motion: 'pan' | 'zoom'): void {
    if (motion === 'pan') {
      this.host.camera.center = new Point2(target.x, target.y);
    } else {
      this.host.camera.zoom = target.scale;
    }
  }

  prepareOperation(scene: StressScene, scenario: string): Operation {
    const roots = Array.from(this.host.objects);
    const amount = Number(scenario.split('-').at(1));
    const selected = roots.slice(0, scenario === 'position-single' ? 1 : 100);
    const additions = scene.additions.slice(0, amount);
    const removed = roots.slice(0, amount);
    const route = roots.find(root => root.kind === 'route');
    const replacements = [
      { id: 'replacement-0', kind: 'point' as const, position: { x: 60, y: 65 } },
      { id: 'replacement-1', kind: 'point' as const, position: { x: 62, y: 67 } },
    ];

    return (checkpoint): void => {
      if (scenario.startsWith('position-')) {
        for (const root of selected) {
          assertComparison(root.kind !== 'polygon', 'benchmark root kind');
          const point = root.kind === 'point' ? root : root.points[0];
          point.position = new Point3(point.position.x + 1, point.position.y + 1, point.position.z);
        }

        return;
      }

      if (scenario === 'route-update' && route?.kind === 'route') {
        route.replacePoints(1, route.points.length - 1, replacements);

        return;
      }

      if (scenario.startsWith('add-')) {
        additions.forEach((definition, index) => {
          const added = this.host.objects.add(definition);
          this.host.layers[0]!.objectIds.add(added.id);

          if ((index + 1) % 100 === 0) {
            checkpoint(index + 1);
          }
        });

        return;
      }

      removed.forEach((root, index) => {
        assertComparison(this.host.objects.remove(root), 'Atlas remove');

        if ((index + 1) % 100 === 0) {
          checkpoint(index + 1);
        }
      });
    };
  }

  prepareCheck(scene: StressScene, scenario: string): () => void {
    const mutation = /^(position-|add-|remove-|route-update)/u.test(scenario);
    const check = prepareMutationCheck(this.host, scene, mutation ? scenario : 'add-0')!;

    return (): void => {
      check();
      const svg = this.host.shadowRoot!.querySelector('svg')!;
      const image = svg.querySelector('image')!;
      assertComparison(
        image.getAttribute('href') === scene.definition.layers[0]!.background!.source &&
          Number(image.getAttribute('width')) === BACKGROUND_SIZE.width &&
          Number(image.getAttribute('height')) === BACKGROUND_SIZE.height,
        'Atlas background',
      );
      assertComparison(
        getComputedStyle(svg.querySelector('circle')!).fill === 'rgb(39, 117, 217)',
        'Atlas point color',
      );
      const line = svg.querySelector('line, polyline');

      if (line) {
        assertComparison(
          getComputedStyle(line).stroke === 'rgb(217, 80, 18)' &&
            line.getAttribute('stroke-linecap') === 'round' &&
            line.getAttribute('stroke-linejoin') === 'round',
          'Atlas line color/caps/joins',
        );
      }
    };
  }

  checkCamera(target: CameraTarget): void {
    const { camera } = this.host;
    assertComparison(
      Math.abs(camera.center.x - target.x) < 1e-8 &&
        Math.abs(camera.center.y - target.y) < 1e-8 &&
        Math.abs(camera.zoom - target.scale) < 1e-8,
      'Atlas camera state',
    );
    const svg = this.host.shadowRoot!.querySelector('svg')!;
    const bounds = svg.viewBox.baseVal;
    assertComparison(
      Math.abs(bounds.x + bounds.width / 2 - target.x) < 1e-4 &&
        Math.abs(bounds.y + bounds.height / 2 - target.y) < 1e-4 &&
        Math.abs(camera.viewport.width / bounds.width - target.scale) < 1e-4,
      'Atlas displayed camera',
    );
  }

  nodeCounts(): { elements: number; svg: number } {
    return {
      elements: this.host.shadowRoot!.querySelectorAll('*').length + 1,
      svg: this.host.shadowRoot!.querySelector('svg')!.querySelectorAll('*').length + 1,
    };
  }

  dispose(): void {
    this.host.remove();
  }
}
