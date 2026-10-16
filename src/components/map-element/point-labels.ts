import { Rect } from '#math/rect.js';

import type { LabelLength } from '#definitions/material-definition.js';
import type { MapPoint } from '#objects/map-point.js';
import type { PointLabel, PointLabelView } from '#spatial/point-label.js';
import type { SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';

interface Measurement {
  readonly text: string;
  readonly family: string;
  readonly size: number;
  readonly weight: string;
  readonly generation: number;
  readonly box: DOMRect;
}

/** One map's browser typography. No rendered object node is needed for a spatial query. */
export class PointLabels implements PointLabelView {
  readonly #host: HTMLElement;
  readonly #shadow: ShadowRoot;
  readonly #changed: () => void;
  #scene: SceneGeometry | undefined;
  #measurements = new WeakMap<MapPoint, Measurement>();
  #layouts = new WeakMap<
    SceneObject,
    { revision: number; appearance: object; label: PointLabel }
  >();
  #measurement: SVGSVGElement | undefined;
  #text: SVGTextElement | undefined;
  #probe: HTMLElement | undefined;
  #resize: ResizeObserver | undefined;
  #mutations: MutationObserver | undefined;
  readonly #styleRoots = new Set<Document | ShadowRoot>();
  #rootSize = 16;
  #family = '';
  #generation = 0;
  #revision = 0;

  constructor(host: HTMLElement, shadow: ShadowRoot, changed: () => void) {
    this.#host = host;
    this.#shadow = shadow;
    this.#changed = changed;
  }

  get revision(): number {
    return this.#revision;
  }

  setScene(scene: SceneGeometry): void {
    this.#scene = scene;
    this.#measurements = new WeakMap();
    this.#layouts = new WeakMap();
    this.#revision++;
  }

  connect(): void {
    if (this.#resize) {
      return;
    }

    // Height tracks rem; width detects typography changes only when the probe's metrics change.
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = 'MWim 0123456789';
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;width:max-content;height:1rem;writing-mode:horizontal-tb;white-space:pre;font-family:inherit;font-size:1rem;font-weight:normal;font-style:normal;letter-spacing:normal;word-spacing:normal;contain:layout style;';
    this.#shadow.append(probe);
    this.#probe = probe;
    this.#resize = new ResizeObserver(this.#environmentChanged);
    this.#resize.observe(probe);
    this.#mutations = new MutationObserver(this.#environmentChanged);

    for (
      let ancestor: Element | null = this.#host;
      ancestor;
      ancestor = inheritedParent(ancestor)
    ) {
      this.#mutations.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class'] });
      const root = ancestor.getRootNode();

      if (root instanceof ShadowRoot || root instanceof Document) {
        this.#styleRoots.add(root);
      }
    }

    for (const root of this.#styleRoots) {
      this.#mutations.observe(root instanceof Document ? root.head : root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'media', 'href', 'rel', 'disabled'],
      });
      root.addEventListener('load', this.#stylesheetLoaded, true);
    }

    window.addEventListener('resize', this.#environmentChanged);
    document.fonts.addEventListener('loadingdone', this.#fontsChanged);
    document.fonts.addEventListener('loadingerror', this.#fontsChanged);

    // Fonts/styles may have changed while disconnected, without any subscribed notification.
    this.#fontsChanged();
  }

  disconnect(): void {
    this.#resize?.disconnect();
    this.#mutations?.disconnect();
    this.#resize = undefined;
    this.#mutations = undefined;
    this.#probe?.remove();
    this.#probe = undefined;
    this.#measurement?.remove();
    this.#measurement = undefined;
    this.#text = undefined;
    this.#styleRoots.forEach(root =>
      root.removeEventListener('load', this.#stylesheetLoaded, true),
    );
    this.#styleRoots.clear();
    window.removeEventListener('resize', this.#environmentChanged);
    document.fonts.removeEventListener('loadingdone', this.#fontsChanged);
    document.fonts.removeEventListener('loadingerror', this.#fontsChanged);
  }

  /** Also called synchronously before picking, before Mutation/ResizeObserver delivery. */
  refresh(): void {
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const family = getComputedStyle(this.#host).fontFamily;

    if (rootSize === this.#rootSize && family === this.#family) {
      return;
    }

    this.#rootSize = rootSize;
    this.#family = family;
    this.#revision++;
    this.#changed();
  }

  forEntry(entry: SceneObject): PointLabel | undefined {
    const object = entry.object;
    const text = object.label;

    if (object.kind !== 'point' || text === undefined || !text.trim()) {
      return undefined;
    }

    const appearance = this.#scene!.appearanceFor(entry);

    if (appearance.kind !== 'point') {
      return undefined;
    }

    const style = appearance.label;
    const cached = this.#layouts.get(entry);

    if (
      cached?.revision === this.#revision &&
      cached.appearance === style &&
      cached.label.text === text
    ) {
      return cached.label;
    }

    const family = style.font.family ?? this.#family;
    const size = this.#pixels(style.font.size);
    const weight = style.font.weight;
    const box = this.#measure(object, text, family, size, weight);
    const [vertical, horizontal] = style.origin.split(' ');
    const x = this.#pixels(style.offset.x) - box.width * alignment(horizontal);
    const y = this.#pixels(style.offset.y) - box.height * alignment(vertical);
    const label = Object.freeze({
      text,
      color: style.color,
      family,
      size,
      weight,
      bounds: new Rect(x, y, box.width, box.height),
      x: x - box.x,
      y: y - box.y,
    });
    this.#layouts.set(entry, { revision: this.#revision, appearance: style, label });

    return label;
  }

  #pixels(length: LabelLength): number {
    return parseFloat(length) * (length.endsWith('rem') ? this.#rootSize : 1);
  }

  #measure(object: MapPoint, text: string, family: string, size: number, weight: string): DOMRect {
    const cached = this.#measurements.get(object);

    if (
      cached?.text === text &&
      cached.family === family &&
      cached.size === size &&
      cached.weight === weight &&
      cached.generation === this.#generation
    ) {
      return cached.box;
    }

    if (!this.#text) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden;';
      this.#text = document.createElementNS(svg.namespaceURI, 'text') as SVGTextElement;
      this.#text.style.cssText =
        'writing-mode:horizontal-tb;white-space:pre;text-anchor:start;text-transform:none;font-style:normal;font-variant:normal;letter-spacing:normal;word-spacing:normal;';
      svg.append(this.#text);
      this.#shadow.append(svg);
      this.#measurement = svg;
    }

    const element = this.#text;
    element.textContent = text;
    element.setAttribute('font-family', family);
    element.setAttribute('font-size', String(size));
    element.setAttribute('font-weight', weight);
    const box = element.getBBox();
    this.#measurements.set(object, {
      text,
      family,
      size,
      weight,
      generation: this.#generation,
      box,
    });

    return box;
  }

  readonly #environmentChanged = (): void => {
    this.refresh();
  };

  readonly #stylesheetLoaded = (event: Event): void => {
    if (event.target instanceof HTMLLinkElement || event.target instanceof HTMLStyleElement) {
      this.refresh();
    }
  };

  readonly #fontsChanged = (): void => {
    this.#generation++;
    this.#revision++;
    this.refresh();
    this.#changed();
  };
}

/** Font inheritance crosses shadow hosts and follows assigned slots. */
function inheritedParent(element: Element): Element | null {
  if (element.assignedSlot) {
    return element.assignedSlot;
  }

  if (element.parentElement) {
    return element.parentElement;
  }

  const root = element.getRootNode();

  return root instanceof ShadowRoot ? root.host : null;
}

function alignment(word: string | undefined): number {
  if (word === 'center') {
    return 0.5;
  }

  return word === 'bottom' || word === 'right' ? 1 : 0;
}
