import { setTimeout as observeWindow } from 'node:timers/promises';

import { writeJson } from './evidence.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { Page } from 'playwright';

export type ViewportPostmortemMode = 'passive' | 'activate' | 'screenshot';

const OBSERVATION_WINDOW_MS = 2_000;

interface CallbackState {
  time: number;
  ready: DocumentReadyState;
  visibility: DocumentVisibilityState;
  focused: boolean;
  connected: boolean | undefined;
  viewport: { width: number; height: number } | undefined;
  viewBox: string | null | undefined;
  timeline: Window['viewportDiagnostics'];
  lastReadiness: unknown;
}

/** Serialized after the original failure. No layout reads or new browser callbacks. */
function readCallbackState(): CallbackState {
  const map = window.platform?.map ?? document.querySelector<MapElement>('atlas-map');

  return {
    time: performance.now(),
    ready: document.readyState,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    connected: map?.isConnected,
    viewport: map?.camera.viewport,
    viewBox: map?.shadowRoot?.querySelector('svg')?.getAttribute('viewBox'),
    timeline: window.viewportDiagnostics,
    lastReadiness: window.platform?.observations?.initialViewportReadiness,
  };
}

/** Diagnostic only: never rechecks readiness or changes the caller's failed result. */
export async function captureViewportPostmortem(
  page: Page,
  prefix: string,
  mode: ViewportPostmortemMode,
): Promise<{ postmortem: string; screenshot?: string }> {
  const before = await page.evaluate(readCallbackState);
  const eligible =
    before.viewport?.width === 0 &&
    before.viewport.height === 0 &&
    before.timeline?.some(event => event.type === 'raf.request') === true &&
    !before.timeline.some(event => event.type === 'raf.run' || event.type === 'resize.entries');
  const postmortem = `${prefix}-postmortem.json`;
  const evidence: {
    mode: ViewportPostmortemMode;
    eligible: boolean;
    originalOutcome: 'fail';
    observationWindowMs: number;
    before: CallbackState;
    afterAction?: CallbackState;
    afterObservation?: CallbackState;
  } = {
    mode,
    eligible,
    originalOutcome: 'fail',
    observationWindowMs: OBSERVATION_WINDOW_MS,
    before,
  };
  await writeJson(postmortem, evidence);

  if (!eligible) {
    return { postmortem };
  }

  let screenshot: string | undefined;

  if (mode === 'activate') {
    await page.bringToFront();
  } else if (mode === 'screenshot') {
    screenshot = `${prefix}-postmortem.png`;
    await page.screenshot({ path: screenshot, fullPage: true, timeout: 5_000 });
  }

  if (mode !== 'passive') {
    evidence.afterAction = await page.evaluate(readCallbackState);
    await writeJson(postmortem, evidence);
  }

  // A single Node-side observation deadline AFTER failure, never a readiness retry.
  // No page operations, layout reads, polling or extra RAFs during this interval.
  await observeWindow(OBSERVATION_WINDOW_MS);
  evidence.afterObservation = await page.evaluate(readCallbackState);
  await writeJson(postmortem, evidence);

  return screenshot ? { postmortem, screenshot } : { postmortem };
}
