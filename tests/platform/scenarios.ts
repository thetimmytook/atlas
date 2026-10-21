import { openExample } from './browser.js';
import { CAMERA_LAYERS } from './camera-layers.js';
import { clickFactory, INITIAL_VIEWPORT } from './initial-viewport.js';
import { LABELS } from './labels.js';
import { LIFECYCLE } from './lifecycle.js';
import { FAILED_RESOURCE, MATERIALS } from './materials.js';

import type { Scenario } from './browser.js';

const smoke: Scenario = {
  id: 'ENV-01 / Factory + Buildings production smoke',
  subcases: [
    'Factory decoded background and viewport',
    'Factory initial SVG projection and native object identity',
    'Buildings decoded background and viewport',
  ],
  run: async ({ page, origin, check }): Promise<void> => {
    for (const [host, name] of [
      ['atlas-map', 'Factory'],
      ['atlas-buildings', 'Buildings'],
    ]) {
      await openExample(page, origin, host);
      const state = await page.evaluate(async () => {
        const { map, surface } = window.platform;
        const images = Array.from(surface.querySelectorAll('image'));
        const decoded = await Promise.all(
          images.map(async node => {
            const image = new Image();
            image.src = node.getAttribute('href')!;
            await image.decode();

            return image.naturalWidth > 0 && image.naturalHeight > 0;
          }),
        );
        const rect = surface.getBoundingClientRect();

        return {
          decoded: decoded.length > 0 && decoded.every(Boolean),
          correctSize:
            Math.abs(map.camera.viewport.width - rect.width) < 0.1 &&
            Math.abs(map.camera.viewport.height - rect.height) < 0.1 &&
            rect.width > 0 &&
            rect.height > 0,
          geometry: surface.querySelectorAll('[data-object-id]').length > 0,
        };
      });
      check(`${name} decoded background and viewport`, state, {
        decoded: true,
        correctSize: true,
        geometry: true,
      });

      if (host === 'atlas-map') {
        check(
          'Factory initial SVG projection and native object identity',
          await clickFactory(page),
        );
      }
    }
  },
};

export const SCENARIOS: Scenario[] = [
  smoke,
  ...INITIAL_VIEWPORT,
  ...CAMERA_LAYERS,
  ...MATERIALS,
  FAILED_RESOURCE,
  ...LABELS,
  ...LIFECYCLE,
];
