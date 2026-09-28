import html from './atlas-map.html?raw';

export class AtlasMap extends HTMLElement {
  readonly #surface: SVGSVGElement;
  #resizeObserver: ResizeObserver | undefined;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
    const surface = shadow.querySelector('svg');

    if (!surface) {
      throw new Error('AtlasMap template must contain an SVG surface.');
    }

    this.#surface = surface;
  }

  connectedCallback(): void {
    if (this.#resizeObserver) {
      return;
    }

    this.#resizeObserver = new ResizeObserver(entries => {
      if (!this.isConnected) {
        return;
      }

      for (const entry of entries) {
        this.#surface.setAttribute('width', String(entry.contentRect.width));
        this.#surface.setAttribute('height', String(entry.contentRect.height));
      }
    });
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }
}
