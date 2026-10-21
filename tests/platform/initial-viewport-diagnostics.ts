import type { Camera } from '#camera/camera.js';
import type { MapElement } from '#components/map-element/map-element.js';

interface DiagnosticEvent {
  time: number;
  type: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    viewportDiagnostics?: DiagnosticEvent[];
  }
}

/** Serialized before upgrade. No layout reads, console traffic or extra RAFs. */
export function installViewportDiagnostics(): void {
  const events: DiagnosticEvent[] = [];
  const wrapped = new WeakSet<Camera>();
  window.viewportDiagnostics = events;

  const record = (type: string, details: Record<string, unknown> = {}): void => {
    events.push({ time: performance.now(), type, ...details });
  };

  const define = customElements.define.bind(customElements);

  customElements.define = (name, constructor, options): void => {
    if (name === 'atlas-map') {
      record('define');
      const prototype = constructor.prototype as MapElement;

      for (const method of ['connectedCallback', 'disconnectedCallback'] as const) {
        // Invoked below with the original component as its receiver.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const original = prototype[method];

        prototype[method] = function (this: MapElement): void {
          record(method, { connected: this.isConnected });

          if (!wrapped.has(this.camera)) {
            wrapped.add(this.camera);
            const resize = this.camera.resize.bind(this.camera);

            this.camera.resize = (size): void => {
              record('camera.resize', { size });
              resize(size);
              record('camera.resized', { viewport: this.camera.viewport });
            };
          }

          original.call(this);
        };
      }
    }

    define(name, constructor, options);
  };

  const Observer = ResizeObserver;
  let observerId = 0;
  window.ResizeObserver = class extends Observer {
    readonly id: number;

    constructor(callback: ResizeObserverCallback) {
      const id = ++observerId;
      super((entries, observer) => {
        record('resize.entries', {
          id,
          entries: entries.map(entry => ({
            target: entry.target.localName,
            width: entry.contentRect.width,
            height: entry.contentRect.height,
            connected: entry.target.isConnected,
          })),
        });
        callback(entries, observer);
      });
      this.id = id;
    }

    override observe(target: Element, options?: ResizeObserverOptions): void {
      record('resize.observe', { id: this.id, target: target.localName });
      super.observe(target, options);
    }

    override disconnect(): void {
      record('resize.disconnect', { id: this.id });
      super.disconnect();
    }
  };
  const raf = window.requestAnimationFrame.bind(window);

  window.requestAnimationFrame = (callback): number => {
    const id = raf(time => {
      record('raf.run', { id });
      callback(time);
      record('raf.done', {
        id,
        viewBox: document
          .querySelector('atlas-map')
          ?.shadowRoot?.querySelector('svg')
          ?.getAttribute('viewBox'),
      });
    });
    record('raf.request', { id });

    return id;
  };

  record('install', { ready: document.readyState, visibility: document.visibilityState });

  for (const type of ['readystatechange', 'visibilitychange']) {
    document.addEventListener(type, () =>
      record(type, {
        ready: document.readyState,
        visibility: document.visibilityState,
      }),
    );
  }
}
