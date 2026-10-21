/* eslint-disable @typescript-eslint/unbound-method -- Saved prototype methods use explicit receivers. */
import {
  assert,
  frame,
  initialFloors,
  selectFloor,
  settle,
  surface,
} from './prototype-bench.check.js';
import { instrument } from './prototype-bench.instrument.js';
import { motion } from './prototype-bench.motion.js';
import { backgroundSvg, createScene } from './prototype-bench.scene.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { Profile } from './prototype-bench.scene.js';

/** Only used by the narrow zoom runner; no patches in timing/trace sessions. */
function layerWrites(map: MapElement): {
  snapshot(): Record<string, number>;
  restore(): void;
} {
  const svg = surface(map);
  const membership = new WeakMap<Element, string>();
  const counts: Record<string, number> = {};

  const add = (key: string): void => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  for (const layer of svg.querySelectorAll('[data-layer-id]')) {
    const visibility = layer.getAttribute('display') === 'none' ? 'hidden' : 'visible';
    membership.set(layer, visibility);
    layer.querySelectorAll('*').forEach(node => membership.set(node, visibility));
  }

  const collect = (records: MutationRecord[]): void => {
    for (const record of records) {
      counts.nodes_added = (counts.nodes_added ?? 0) + record.addedNodes.length;
      counts.nodes_removed = (counts.nodes_removed ?? 0) + record.removedNodes.length;
    }
  };

  const observer = new MutationObserver(collect);
  observer.observe(svg, { childList: true, subtree: true });
  const computedStyle = window.getComputedStyle;
  const clientRect = Element.prototype.getBoundingClientRect;

  window.getComputedStyle = (...args): CSSStyleDeclaration => {
    add('computed_style_reads');

    return computedStyle(...args);
  };

  Element.prototype.getBoundingClientRect = function (): DOMRect {
    add('client_rect_reads');

    return clientRect.call(this);
  };

  const original = Element.prototype.setAttribute;

  Element.prototype.setAttribute = function (name, value): void {
    if (this instanceof SVGElement && svg.contains(this)) {
      const visibility = membership.get(this) ?? 'surface';
      add(`${visibility}_attributes`);

      if (name === 'transform') {
        add(`${visibility}_${this.tagName}_transforms`);
      }

      if (['d', 'points', 'x1', 'x2', 'y1', 'y2'].includes(name)) {
        add(`${visibility}_geometry`);
      }
    }

    original.call(this, name, value);
  };

  return {
    snapshot(): Record<string, number> {
      collect(observer.takeRecords());

      return counts;
    },
    restore(): void {
      observer.disconnect();
      Element.prototype.setAttribute = original;
      Element.prototype.getBoundingClientRect = clientRect;
      window.getComputedStyle = computedStyle;
    },
  };
}

function inventory(map: MapElement): Record<string, number> {
  const result: Record<string, number> = {};

  for (const visibility of ['visible', 'hidden']) {
    const layers = Array.from(surface(map).querySelectorAll('[data-layer-id]')).filter(
      layer => (layer.getAttribute('display') === 'none') === (visibility === 'hidden'),
    );
    result[`${visibility}_layers`] = layers.length;

    for (const [kind, selector] of Object.entries({
      appearances: '[data-object-id]',
      circle: 'circle',
      image: '[data-object-id] > image',
      text: '[data-object-id] > text',
    })) {
      result[`${visibility}_${kind}`] = layers.reduce(
        (total, layer) => total + layer.querySelectorAll(selector).length,
        0,
      );
    }
  }

  return result;
}

export function zoomSession(helpers: {
  attach(): Promise<MapElement>;
  warmResources(background: string): Promise<void>;
  valid(): boolean;
}): {
  setup(roots: 3000 | 5000, profile: Profile, firstShow?: boolean): Promise<object>;
  run(mode: 'timing' | 'trace' | 'instrument'): Promise<object>;
  finish(): object;
} {
  let map: MapElement | undefined;
  let background: string | undefined;
  let markup = '';
  let elements: Element[] = [];
  let startCamera = '';
  let roots = 0;
  let firstShow = false;
  const camera = (): string =>
    JSON.stringify({ center: map?.camera.center, zoom: map?.camera.zoom });

  return {
    async setup(count, profile, show = false): Promise<object> {
      assert(!map, 'Previous zoom session remains attached.');
      background = URL.createObjectURL(new Blob([backgroundSvg()], { type: 'image/svg+xml' }));
      await helpers.warmResources(background);
      map = await helpers.attach();
      roots = count;
      await map.load(createScene(count, background, profile));
      initialFloors(map);
      await settle();
      await document.fonts.ready;
      firstShow = show;

      if (firstShow) {
        // b0-f1 stays hidden while zoom changes from 0.8 to 1.2. Setup is unmeasured.
        map.camera.zoom *= 1.5;
        await settle();
      }

      markup = surface(map).outerHTML;
      elements = Array.from(surface(map).querySelectorAll('*'));
      startCamera = camera();
      performance.clearMarks();

      return { inventory: inventory(map), camera: JSON.parse(startCamera) as object };
    },
    async run(mode): Promise<object> {
      assert(map, 'Zoom session missing.');
      const rows: { metric: string; unit: string; step: number; value: number }[] = [];
      const counters = mode === 'instrument' ? instrument(map) : undefined;
      const split = mode === 'instrument' ? layerWrites(map) : undefined;

      try {
        counters?.reset();

        if (firstShow) {
          const previous = await frame();

          if (mode === 'trace') {
            performance.mark('atlas-zoom-start');
            performance.mark('atlas-zoom-step-0');
          }

          const start = performance.now();
          selectFloor(map, 0, 1);
          rows.push({
            metric: 'show_api_sync_ms',
            unit: 'ms',
            step: 0,
            value: performance.now() - start,
          });
          const first = await frame();

          if (mode === 'trace') {
            performance.mark('atlas-zoom-step-1');
          }

          const second = await frame();
          rows.push(
            { metric: 'show_to_two_raf_ms', unit: 'ms', step: 0, value: performance.now() - start },
            { metric: 'show_raf_interval_ms', unit: 'ms', step: 0, value: first - previous },
            { metric: 'show_raf_interval_ms', unit: 'ms', step: 1, value: second - first },
          );

          if (mode === 'trace') {
            performance.mark('atlas-zoom-end');
          }
        } else
          await motion(
            map,
            'zoom',
            (metric, unit, value, step = 0) => rows.push({ metric, unit, step, value }),
            false,
            mode === 'trace',
          );

        return {
          rows: mode === 'instrument' ? [] : rows,
          counters: counters ? { ...counters.snapshot(), ...split?.snapshot() } : undefined,
        };
      } finally {
        split?.restore();
        counters?.restore();
      }
    },
    finish(): object {
      assert(map, 'Zoom session missing.');

      try {
        const svg = surface(map);
        const finalElements = Array.from(svg.querySelectorAll('*'));
        const beforeSet = new Set(elements);
        const shown = svg.querySelector('[data-layer-id="b0-f1"]')!;
        const scale = 1 / map.camera.zoom;
        const firstShowCurrent =
          !firstShow ||
          (shown.getAttribute('display') === null &&
            Array.from(
              shown.querySelectorAll('.atlas-point > :first-child, [data-object-id] > text'),
            ).every(node => node.getAttribute('transform')?.endsWith(`scale(${scale})`)));
        const result = {
          camera: JSON.parse(camera()) as object,
          cameraRestored: startCamera === camera(),
          markupRestored: markup === svg.outerHTML,
          firstShowCurrent,
          nodesAdded: finalElements.filter(node => !beforeSet.has(node)).length,
          nodesRemoved: elements.filter(node => !svg.contains(node)).length,
          roots: map.objects.size,
          valid: helpers.valid(),
        };
        assert(
          result.cameraRestored &&
            (firstShow ? result.firstShowCurrent : result.markupRestored) &&
            result.nodesAdded === 0 &&
            result.nodesRemoved === 0 &&
            result.roots === roots &&
            result.valid,
          'Zoom changed final camera, scene, nodes, or page visibility/viewport.',
        );

        return result;
      } finally {
        map.remove();
        map = undefined;
        elements = [];

        if (background) {
          URL.revokeObjectURL(background);
        }
      }
    },
  };
}
