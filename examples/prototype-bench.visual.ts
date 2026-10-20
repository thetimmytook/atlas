import { Point2 } from '#math/point2.js';

import { assert, selectFloor, settle, surface } from './prototype-bench.check.js';
import { BATCH_IDS } from './prototype-bench.scene.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { ObjectClickDetail } from '#interaction/object-click-event.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';

export const VISUAL_MUTATIONS = [
  'label-text',
  'label-color-offset',
  'label-font',
  'shared-material',
  'group-no-batch',
  'group-batch',
] as const;

/** Standard PointerEvents through CameraControls and component picking. The runner holds
 * native pointer 1 active outside the query span, so real pointer capture needs no stubs.
 * Dispatch is synthetic; independent native clicks validate the browser input path. */
export function componentProbe(map: MapElement): {
  query(clientPoint: Point2): ObjectClickDetail | undefined;
  close(): void;
} {
  let hit: ObjectClickDetail | undefined;

  const listener = (event: Event): void => {
    hit = (event as CustomEvent<ObjectClickDetail>).detail;
  };

  map.addEventListener('objectclick', listener);

  return {
    query(clientPoint): ObjectClickDetail | undefined {
      hit = undefined;

      for (const type of ['pointerdown', 'pointerup']) {
        surface(map).dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            button: 0,
            clientX: clientPoint.x,
            clientY: clientPoint.y,
          }),
        );
      }

      return hit;
    },
    close(): void {
      map.removeEventListener('objectclick', listener);
    },
  };
}

/** Literal anchor + fixed offset, chosen within every nonempty monospace label, outside geometry. */
export function labelPosition(map: MapElement, x = 670, y = 80, dx = 44, dy = -16): Point2 {
  return new Point2(x + dx / map.camera.zoom, y + dy / map.camera.zoom);
}

export function visualMutation(map: MapElement, scenario: string): () => void {
  const target = map.objects.get('probe-point')!;
  const material = map.materials.get('probe-marker')!;
  const group = BATCH_IDS.map(id => map.objects.get(id)!);

  const update = (): void => {
    group.forEach((object, index) => {
      object.label = `U${String(index).padStart(6, '0')}`;
      object.material = 'probe-style';
      object.label = `V${String(index).padStart(6, '0')}`;
    });
  };

  switch (scenario) {
    case 'label-text':
      return () => {
        target.label = 'Updated point 000006';
      };

    case 'label-color-offset':
      return () => {
        material.properties = {
          ...material.properties,
          label: {
            ...material.properties.label,
            color: '#be123c',
            offset: { x: '60px', y: '-20px' },
          },
        };
      };

    case 'label-font':
      return () => {
        material.properties = {
          ...material.properties,
          label: { ...material.properties.label, font: { size: '16px', family: 'monospace' } },
        };
      };

    case 'shared-material':
      return () => {
        const shared = map.materials.get('typography')!;
        shared.properties = {
          label: {
            font: { size: '12px', family: 'monospace', weight: 'normal' },
            color: '#15803d',
          },
        };
      };

    case 'group-no-batch':
      return update;
    case 'group-batch':
      return () => map.batch(update);
    default:
      throw new Error('Unknown visual mutation.');
  }
}

function label(map: MapElement, id: string, layer: string): SVGTextElement {
  const text = surface(map).querySelector<SVGTextElement>(
    `[data-layer-id="${layer}"] [data-object-id="${id}"] > text`,
  );
  assert(text, `Missing fixture text: ${id}/${layer}`);

  return text;
}

export async function visualChecks(map: MapElement): Promise<object> {
  const probe = componentProbe(map);
  const checks: string[] = [];

  const query = (position: Point2, id?: string, layer?: string, route?: string): void => {
    const hit = probe.query(map.coordinates.mapToClient(position));
    assert(
      id === undefined
        ? hit === undefined
        : hit?.object.id === id && hit.layer.id === layer && hit.route?.id === route,
      `Label query mismatch: ${id ?? 'miss'}`,
    );
  };

  const text = label(map, 'probe-point', 'b1-f1');
  const group = text.parentElement!;
  const originalText = text.textContent;
  const originalStyle = map.materials.get('probe-marker')!.properties;
  const expected = [
    ['probe-point', 'b1-f1', 670, 80],
    ['probe-route', 'b0-f0', 90, 80],
    ['probe-direct', 'b0-f0', 100, 115],
    ['probe-line', 'b0-f0', 90, 155],
    ['probe-polygon', 'b0-f0', 70, 195],
    ['probe-clip-polygon', 'b0-f0', 60, 320],
  ] as const;

  try {
    for (const [id, layer, x, y] of expected) {
      const node = label(map, id, layer);
      assert(
        node.textContent === map.objects.get(id)!.label &&
          node.getAttribute('font-family') === 'monospace' &&
          node.getAttribute('font-size') === '12',
        'Text/font inheritance mismatch.',
      );

      // The full glyph box is browser layout; the expected attachment is independently known.
      const box = node.getBoundingClientRect();
      const anchor = map.coordinates.mapToClient(new Point2(x, y));
      assert(
        Math.abs(box.left - anchor.x - 40) < 0.1 && Math.abs(box.top - anchor.y + 20) < 0.1,
        `Independent label anchor differs: ${id}`,
      );
      query(labelPosition(map, x, y), id, layer);
    }

    query(new Point2(600, 380));
    assert(group.querySelector('image')?.getAttribute('width') === '16', 'SVG icon not applied.');
    const generated = Array.from(
      surface(map).querySelectorAll<SVGImageElement>('[data-object-id^="root-"] > image'),
    );
    assert(
      generated.some(image => image.getAttribute('width') === '14') &&
        generated.some(image => image.getAttribute('width') === '16'),
      'PNG/SVG selector icons missing.',
    );
    assert(
      surface(map).querySelector('[data-object-id="root-16"] > circle')?.getAttribute('fill') ===
        '#2563eb',
      'Kind-based inherited point style missing.',
    );
    checks.push(
      'actual SVG/PNG resources, kind + application data selector, inherited font, literal text, independent point/path/polygon anchors and label-only hits; checked miss',
    );

    selectFloor(map, 0, 2);
    await settle();
    const flat = label(map, 'probe-flat', 'b0-f2');
    assert(flat.textContent === map.objects.get('probe-flat')!.label, 'Flat label missing.');
    query(labelPosition(map, 75, 260), 'probe-flat', 'b0-f2');
    selectFloor(map, 0, 1);
    await settle();
    query(labelPosition(map, 100, 80, -56), 'pr-1', 'b0-f1', 'probe-route');
    const owned = (map.objects.get('probe-route') as MapRoute).points[1] as MapPoint;
    owned.pickable = false;
    query(labelPosition(map, 100, 80, -56));
    owned.pickable = true;
    selectFloor(map, 0, 0);
    await settle();
    checks.push(
      'flat/extruded and clipped visibility, owned point label pickability and original route/layer context',
    );

    const stale = labelPosition(map);
    map.batch(() => {
      map.objects.get('probe-point')!.label = undefined;
      query(stale);
      map.objects.get('probe-point')!.label = originalText!;
      query(stale, 'probe-point', 'b1-f1');
      visualMutation(map, 'label-color-offset')();
      query(stale);
      query(labelPosition(map, 670, 80, 64), 'probe-point', 'b1-f1');
      assert(
        text.textContent === originalText && text.parentElement === group,
        'Batch painted before exit.',
      );
    });
    await settle();
    assert(
      label(map, 'probe-point', 'b1-f1') === text && text.getAttribute('fill') === '#be123c',
      'Local style edit replaced text or failed.',
    );
    map.materials.get('probe-marker')!.properties = originalStyle;
    visualMutation(map, 'label-font')();
    query(stale, 'probe-point', 'b1-f1');
    await settle();
    assert(text.getAttribute('font-size') === '16', 'Font edit not rendered.');
    map.materials.get('probe-marker')!.properties = originalStyle;
    map.objects.get('probe-point')!.label = originalText!;
    await settle();
    checks.push(
      'same-turn text/offset/font picking before RAF and inside batch; obsolete hit rectangle removed; surviving text/owner nodes',
    );

    const route = map.objects.get('probe-route') as MapRoute;
    route.addPoint({
      kind: 'point',
      id: 'visual-fragment',
      position: { x: 160, y: 100, z: 5 },
      pickable: true,
    });
    await settle();
    assert(
      surface(map).querySelectorAll(
        '[data-layer-id="b0-f0"] [data-object-id="probe-route"] > polyline',
      ).length === 2 &&
        surface(map).querySelectorAll(
          '[data-layer-id="b0-f0"] [data-object-id="probe-route"] > text',
        ).length === 1,
      'Route fragments duplicated text.',
    );
    route.removePoint(route.points.at(-1)!);
    const floor = map.layers.find(layer => layer.id === 'b0-f0')!;
    floor.objectIds.add(route.id);
    query(labelPosition(map, 100, 80), route.id, floor.id);
    floor.objectIds.remove(route.id);
    query(labelPosition(map, 90, 80), route.id, floor.id);
    await settle();
    const target = map.objects.get('probe-point')!;
    map.objects.remove(target);
    query(stale);
    map.objects.add(target);
    query(stale, target.id, 'b1-f1');
    await settle();
    checks.push(
      'one label across multiple clipped route fragments; direct membership updates attachments before RAF; removal/reattachment clears stale hits',
    );

    const snapshot = (): string =>
      JSON.stringify(
        BATCH_IDS.map(id => {
          const object = map.objects.get(id)!;

          return { id, label: object.label, material: object.material };
        }),
      );
    const original = BATCH_IDS.map(id => {
      const object = map.objects.get(id)!;

      return { object, label: object.label, material: object.material };
    });
    visualMutation(map, 'group-no-batch')();
    await settle();
    const state = snapshot();
    const markup = surface(map).innerHTML;
    original.forEach(entry => {
      entry.object.label = entry.label;
      entry.object.material = entry.material;
    });
    await settle();
    visualMutation(map, 'group-batch')();
    await settle();
    assert(
      snapshot() === state && surface(map).innerHTML === markup,
      'Batch/no-batch state or SVG differs.',
    );
    original.forEach(entry => {
      entry.object.label = entry.label;
      entry.object.material = entry.material;
    });
    await settle();
    checks.push(
      'identical 48 operations/order on fixed 16 roots, final runtime state and complete SVG for batch/no-batch',
    );

    return {
      checks,
      passed: checks.length,
      batchConsumers: BATCH_IDS,
      sharedMaterialConsumers:
        map.objects.size +
        Array.from(map.objects).reduce(
          (count, object) =>
            count + (object.kind === 'route' || object.kind === 'line' ? object.points.length : 0),
          0,
        ),
    };
  } finally {
    probe.close();
  }
}
