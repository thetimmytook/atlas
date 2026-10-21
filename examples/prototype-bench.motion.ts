import { Point2 } from '#math/point2.js';

import { frame, settle, surface } from './prototype-bench.check.js';

import type { MapElement } from '#components/map-element/map-element.js';

export const MOTION_FRAMES = 24;
type Emit = (metric: string, unit: string, value: number, sample?: number) => void;

/** Shared scripted camera sequence. Ordinary benchmark observation remains enabled. */
export async function motion(
  map: MapElement,
  scenario: string,
  emit: Emit,
  observe = true,
  marks = false,
): Promise<void> {
  const center = map.camera.center;
  const zoom = map.camera.zoom;
  let previous = await frame();
  let operationStart = 0;
  let syncEnd = 0;
  let currentIndex = -1;
  const observer = observe
    ? new MutationObserver(() => {
        if (currentIndex < 0) {
          return;
        }

        const delivery = performance.now();
        emit('svg_last_delivery_from_start_ms', 'ms', delivery - operationStart, currentIndex);
        emit('post_sync_svg_delivery_ms', 'ms', delivery - syncEnd, currentIndex);
      })
    : undefined;
  observer?.observe(surface(map), { attributes: true, childList: true, subtree: true });

  if (marks) {
    performance.mark('atlas-zoom-start');
  }

  try {
    for (let index = 0; index < MOTION_FRAMES; index += 1) {
      const time = await frame();

      if (marks) {
        performance.mark(`atlas-zoom-step-${index}`);
      }

      emit('raf_interval_ms', 'ms', time - previous, index);
      const angle = ((index + 1) / MOTION_FRAMES) * Math.PI * 2;
      const start = performance.now();
      operationStart = start;
      currentIndex = index;

      if (scenario === 'pan') {
        map.camera.center = new Point2(
          center.x + Math.sin(angle) * 60,
          center.y + (1 - Math.cos(angle)) * 40,
        );
      } else {
        map.camera.zoom = zoom * 2 ** ((1 - Math.cos(angle)) / 2);
      }

      syncEnd = performance.now();
      emit('camera_api_sync_ms', 'ms', syncEnd - start, index);
      previous = time;
    }

    await settle();
  } finally {
    if (marks) {
      performance.mark('atlas-zoom-end');
    }

    observer?.disconnect();
  }
}
