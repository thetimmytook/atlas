import { expect } from 'vitest';

import { installProbe, loadP } from './fixture.js';

import type { Page } from 'playwright';

export interface ScenarioContext {
  page: Page;
  origin: string;
  check: (name: string, actual: unknown, expected?: unknown) => void;
  expectedResourceUrls: string[];
  captureFactoryStartup?: (() => Promise<void>) | undefined;
}

export interface Scenario {
  id: string;
  subcases: string[];
  run: (context: ScenarioContext) => Promise<void>;
}

export async function openExample(
  page: Page,
  origin: string,
  host = 'atlas-buildings',
): Promise<void> {
  await page.goto(`${origin}/examples/${host === 'atlas-map' ? '' : 'buildings.html'}`);
  await expect.poll(() => page.locator('#status').textContent()).toContain('loaded.');
  await expect.poll(() => page.locator(`${host} svg:not([aria-hidden])`).isVisible()).toBe(true);
  await page.evaluate(installProbe, host);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { map, surface } = window.platform;
        const rect = surface.getBoundingClientRect();

        if (window.viewportDiagnostics) {
          // Reuse this existing readiness read; post-mortem must not measure layout again.
          window.platform.observations.initialViewportReadiness = {
            time: performance.now(),
            viewport: map.camera.viewport,
            surface: { width: rect.width, height: rect.height },
          };
        }

        return (
          Math.abs(map.camera.viewport.width - rect.width) < 0.1 &&
          Math.abs(map.camera.viewport.height - rect.height) < 0.1
        );
      }),
    )
    .toBe(true);
}

export async function openP(page: Page, origin: string): Promise<void> {
  await openExample(page, origin);
  await page.evaluate(loadP);
  await expect
    .poll(() => page.evaluate(() => window.platform.text('p-text')?.textContent))
    .toBe('  A  B  ');
}

export async function clickMap(page: Page, x: number, y: number): Promise<void> {
  const client = await page.evaluate(
    ({ x, y }) => window.platform.map.coordinates.mapToClient({ x, y }),
    { x, y },
  );
  await page.mouse.click(client.x, client.y);
}

export async function clickIdentity(
  page: Page,
  objectId: string,
  layerId: string,
  routeId?: string,
): Promise<boolean> {
  return page.evaluate(
    ({ objectId, layerId, routeId }) => {
      const events = window.platform.events;
      const clicks = events.filter(event => event.type === 'objectclick');
      const click = clicks.at(-1);
      const native = events
        .filter(event => event.type === 'pointerdown' || event.type === 'pointerup')
        .slice(-2);

      return (
        clicks.length === 1 &&
        click?.objectId === objectId &&
        click.layerId === layerId &&
        click.routeId === routeId &&
        click.objectSame === true &&
        click.layerSame === true &&
        click.routeSame === true &&
        native.length === 2 &&
        native.every(event => event.trusted === true && event.pointerType === 'mouse')
      );
    },
    { objectId, layerId, routeId },
  );
}

export async function clearEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.platform.events.length = 0;
  });
}

export async function clickCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.platform.events.filter(event => event.type === 'objectclick').length,
  );
}

export async function labelTarget(
  page: Page,
  id: string,
  layer = 'p-full',
): Promise<{ x: number; y: number; proof: boolean }> {
  return page.evaluate(
    ({ id, layer }) => {
      const { map, surface, text, roots, owned, observations } = window.platform;
      const node = text(id, layer);
      const rect = window.platform.bounds(node);
      const viewport = surface.getBoundingClientRect();
      const target = { x: rect.x + Math.min(5, rect.width / 2), y: rect.y + rect.height / 2 };
      const point = map.coordinates.clientToMap(target);
      const owner = id === 'p-owned' ? owned! : roots[id]!;

      // Independent source-geometry oracle, not Atlas's picking/attachment helpers.
      let outside = false;

      if (owner.kind === 'point') {
        const position = map.coordinates.mapToClient(owner.position);
        outside = Math.hypot(target.x - position.x, target.y - position.y) > 11;
      } else if (owner.kind === 'line' || owner.kind === 'route') {
        outside = owner.points.slice(1).every((end, i) => {
          const start = map.coordinates.mapToClient(owner.points[i]!.position);
          const finish = map.coordinates.mapToClient(end.position);
          const dx = finish.x - start.x;
          const dy = finish.y - start.y;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((target.x - start.x) * dx + (target.y - start.y) * dy) / (dx * dx + dy * dy) || 0,
            ),
          );

          return Math.hypot(target.x - start.x - t * dx, target.y - start.y - t * dy) > 2;
        });
      } else if (owner.kind === 'polygon') {
        const xs = owner.contour.map(vertex => vertex.x);
        const ys = owner.contour.map(vertex => vertex.y);
        outside =
          point.x < Math.min(...xs) ||
          point.x > Math.max(...xs) ||
          point.y < Math.min(...ys) ||
          point.y > Math.max(...ys);
      }

      const insideLabel =
        target.x > rect.left &&
        target.x < rect.right &&
        target.y > rect.top &&
        target.y < rect.bottom;
      const insideViewport =
        target.x > viewport.left &&
        target.x < viewport.right &&
        target.y > viewport.top &&
        target.y < viewport.bottom;
      observations[`target:${id}:${layer}`] = {
        target,
        rect: rect.toJSON() as unknown,
        viewport: viewport.toJSON() as unknown,
        outside,
        insideLabel,
        insideViewport,
      };

      return { ...target, proof: outside && insideLabel && insideViewport };
    },
    { id, layer },
  );
}
