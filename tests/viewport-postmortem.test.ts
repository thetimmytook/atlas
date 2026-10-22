import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureViewportPostmortem } from './platform/initial-viewport-postmortem.js';

import type { Page } from 'playwright';

const EVIDENCE_PREFIX = '/evidence/viewport';

const io = vi.hoisted(() => ({
  write: vi.fn<(path: string, value: unknown) => Promise<void>>(),
  observe: vi.fn<(ms: number) => Promise<void>>(),
}));

vi.mock('./platform/evidence.js', () => ({ writeJson: io.write }));
vi.mock('node:timers/promises', () => ({ setTimeout: io.observe }));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// These doubles test diagnostic evidence integrity, not the cause of the browser stall.
function stalledPage(): {
  page: Page;
  order: string[];
  saved: unknown[];
  recover: () => void;
  activate: ReturnType<typeof vi.fn>;
  screenshot: ReturnType<typeof vi.fn>;
} {
  const order: string[] = [];
  const saved: unknown[] = [];
  const timeline = [{ time: 216, type: 'raf.request', id: 1 }];
  let viewBox: string | null = null;
  const map = {
    isConnected: true,
    camera: { viewport: { width: 0, height: 0 } },
    shadowRoot: { querySelector: (): object => ({ getAttribute: (): string | null => viewBox }) },
  };

  vi.stubGlobal('window', {
    platform: {
      map,
      observations: {
        initialViewportReadiness: {
          viewport: { width: 0, height: 0 },
          surface: { width: 800, height: 480 },
        },
      },
    },
    viewportDiagnostics: timeline,
  });

  vi.stubGlobal('document', {
    readyState: 'complete',
    visibilityState: 'visible',
    hasFocus: (): boolean => true,
  });

  const recover = (): void => {
    map.camera.viewport = { width: 800, height: 480 };
    viewBox = '0 0 800 480';
    timeline.push({ time: 1500, type: 'raf.run', id: 1 });
  };

  const activate = vi.fn((): Promise<void> => {
    order.push('activate');
    recover();

    return Promise.resolve();
  });
  const screenshot = vi.fn((): Promise<void> => {
    order.push('screenshot');
    recover();

    return Promise.resolve();
  });
  io.write.mockImplementation((_path, value): Promise<void> => {
    order.push('write');
    saved.push(structuredClone(value));

    return Promise.resolve();
  });
  io.observe.mockImplementation((): Promise<void> => {
    order.push('observe');

    return Promise.resolve();
  });

  return {
    page: {
      evaluate: (callback: () => unknown): Promise<unknown> => {
        order.push('capture');

        // Match Playwright's serialization boundary, not live object references.
        return Promise.resolve(structuredClone(callback()));
      },
      bringToFront: activate,
      screenshot,
    } as unknown as Page,
    order,
    saved,
    recover,
    activate,
    screenshot,
  };
}

describe('initial viewport post-mortem evidence', () => {
  it('preserves the failed snapshot when callbacks recover during passive observation', async () => {
    const { page, saved, recover, activate, screenshot } = stalledPage();
    io.observe.mockImplementation((): Promise<void> => {
      recover();

      return Promise.resolve();
    });
    await captureViewportPostmortem(page, EVIDENCE_PREFIX, 'passive');

    expect(activate).not.toHaveBeenCalled();
    expect(screenshot).not.toHaveBeenCalled();
    expect(io.observe).toHaveBeenCalledExactlyOnceWith(2000);
    expect(saved.at(-1)).toMatchObject({
      originalOutcome: 'fail',
      before: { viewport: { width: 0, height: 0 }, timeline: [{ type: 'raf.request' }] },
      afterObservation: { viewport: { width: 800, height: 480 } },
    });
    expect(saved[0]).toMatchObject({
      before: {
        lastReadiness: { viewport: { width: 0, height: 0 }, surface: { width: 800, height: 480 } },
      },
    });
  });

  it.each(['activate', 'screenshot'] as const)(
    'saves before the single %s intervention and retains failure after recovery',
    async mode => {
      const { page, order, saved, activate, screenshot } = stalledPage();
      await captureViewportPostmortem(page, EVIDENCE_PREFIX, mode);

      expect(order.slice(0, 3)).toEqual(['capture', 'write', mode]);
      expect(activate).toHaveBeenCalledTimes(mode === 'activate' ? 1 : 0);
      expect(screenshot).toHaveBeenCalledTimes(mode === 'screenshot' ? 1 : 0);
      expect(saved[0]).toMatchObject({ originalOutcome: 'fail', before: { viewBox: null } });
      expect(saved.at(-1)).toMatchObject({
        originalOutcome: 'fail',
        before: { viewport: { width: 0, height: 0 } },
        afterAction: { viewport: { width: 800, height: 480 } },
        afterObservation: { viewport: { width: 800, height: 480 } },
      });
    },
  );

  it('records a recovered failure without intervening in a different condition', async () => {
    const { page, saved, recover, activate, screenshot } = stalledPage();
    recover();
    await captureViewportPostmortem(page, EVIDENCE_PREFIX, 'activate');

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ eligible: false, originalOutcome: 'fail' });
    expect(activate).not.toHaveBeenCalled();
    expect(screenshot).not.toHaveBeenCalled();
    expect(io.observe).not.toHaveBeenCalled();
  });

  it('keeps the initial evidence when the intervention fails', async () => {
    const { page, saved, activate } = stalledPage();
    activate.mockRejectedValueOnce(new Error('Activation failed.'));
    await expect(captureViewportPostmortem(page, EVIDENCE_PREFIX, 'activate')).rejects.toThrow(
      'Activation failed.',
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ originalOutcome: 'fail', before: { viewBox: null } });
  });
});
