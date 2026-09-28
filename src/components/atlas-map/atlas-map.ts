import { prepareMapDefinition } from '../../definitions/map-definition.js';
import { AtlasError } from '../../errors/atlas-error.js';
import { SvgRenderer } from '../../renderers/svg/svg-renderer.js';

import html from './atlas-map.html?raw';

import type { MapDefinition } from '../../definitions/map-definition.js';
import type { AtlasRenderer } from '../../renderers/atlas-renderer.js';

export class AtlasMap extends HTMLElement {
  readonly #renderer: AtlasRenderer;
  #definition: MapDefinition | undefined;
  #loading = false;
  #resizeObserver: ResizeObserver | undefined;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
    const surface = shadow.querySelector('svg');

    if (!surface) {
      throw new Error('AtlasMap template must contain an SVG surface.');
    }

    this.#renderer = new SvgRenderer(surface);
  }

  get definition(): MapDefinition | undefined {
    return this.#definition;
  }

  async load(definition: MapDefinition): Promise<void> {
    if (this.#loading) {
      throw new AtlasError('A map load is already in progress.', {
        code: 'MAP_LOAD_IN_PROGRESS',
      });
    }

    this.#loading = true;

    try {
      const preparedDefinition = prepareMapDefinition(definition);
      const background = await this.#renderer.prepareBackground(preparedDefinition.background);
      background.show();
      this.#definition = preparedDefinition;
    } finally {
      this.#loading = false;
    }
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
        this.#renderer.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
  }
}
