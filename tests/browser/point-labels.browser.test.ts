import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';

import { MapElement } from '#components/map-element/map-element.js';
import { ObjectLabels } from '#components/map-element/object-labels.js';
import { resolveMapDefinition } from '#definitions/map-definition.js';
import { Point2 } from '#math/point2.js';
import { Rect } from '#math/rect.js';
import { MapModel } from '#objects/map-model.js';

import { background } from './fixtures.js';

import type { MapDefinition } from '#definitions/map-definition.js';
import type { LabelOrigin, MaterialProperties } from '#definitions/material-definition.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';

const ELEMENT_NAME = 'atlas-point-label-test';
const FONT_LOAD_EVENT = 'loadingdone';
const FAMILY_ATTRIBUTE = 'font-family';
const HORIZONTAL_WRITING_MODE = 'horizontal-tb';
const MEDIA_EMULATION_COMMAND = 'Emulation.setEmulatedMedia';
const maps: MapElement[] = [];
const rootStyle = document.documentElement.getAttribute('style');
const FONT_FACES: FontFace[] = [];
const cleanups: (() => void)[] = [];
customElements.define(ELEMENT_NAME, MapElement);

afterEach(() => {
  maps.splice(0).forEach(map => map.remove());
  cleanups.splice(0).forEach(cleanup => cleanup());
  FONT_FACES.splice(0).forEach(face => document.fonts.delete(face));

  if (rootStyle === null) {
    document.documentElement.removeAttribute('style');
  } else {
    document.documentElement.setAttribute('style', rootStyle);
  }

  vi.restoreAllMocks();
});

function definition(input: Partial<MapDefinition> = {}): MapDefinition {
  const objects = input.objects ?? [
    { kind: 'point', id: 'p', label: 'A  B', position: { x: 100, y: 100 } },
  ];

  return {
    layers: [{ id: 'content', background, objects: objects.map(object => object.id!) }],
    ...input,
    objects,
  };
}

function style(label: MaterialProperties['label'] = {}): Partial<MapDefinition> {
  return {
    materials: {
      label: {
        properties: {
          label: {
            font: { size: '20px', family: 'monospace' },
            origin: 'top left',
            offset: { x: '40px', y: '30px' },
            ...label,
          },
        },
      },
    },
    materialRules: [{ when: { kind: 'point' }, material: 'label' }],
  };
}

async function paint(): Promise<void> {
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function createMap(input: Partial<MapDefinition> = {}): Promise<MapElement> {
  const map = document.createElement(ELEMENT_NAME) as MapElement;
  map.style.width = '320px';
  map.style.height = '240px';
  maps.push(map);
  document.body.append(map);
  await map.load(definition(input));
  await expect.poll(() => map.camera.viewport.width).toBe(320);
  await expect.poll(() => map.camera.viewport.height).toBe(240);
  map.camera.fit(new Rect(0, 0, 320, 240));
  await paint();

  return map;
}

function surface(map: MapElement): SVGSVGElement {
  return map.shadowRoot!.querySelector('svg')!;
}

function groups(map: MapElement, id = 'p'): SVGGElement[] {
  return Array.from(surface(map).querySelectorAll<SVGGElement>(`[data-object-id="${id}"]`));
}

function text(map: MapElement, id = 'p', index = 0): SVGTextElement {
  const node = groups(map, id).at(index)!.querySelector('text');
  expect(node).not.toBeNull();

  return node!;
}

function clicks(map: MapElement): ObjectClickEvent[] {
  const result: ObjectClickEvent[] = [];
  map.addEventListener('objectclick', event => result.push(event as ObjectClickEvent));

  return result;
}

/** Synthetic input keeps the edit/query pair in the same JS turn; SVG and component picking are real. */
function clickClient(map: MapElement, clientX: number, clientY: number): void {
  const svg = surface(map);
  vi.spyOn(svg, 'setPointerCapture').mockImplementation(() => {});

  for (const type of ['pointerdown', 'pointerup']) {
    svg.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX, clientY }));
  }
}

function clickMap(map: MapElement, x: number, y: number): void {
  const client = map.coordinates.mapToClient(new Point2(x, y));
  clickClient(map, client.x, client.y);
}

function clickText(map: MapElement, node = text(map)): void {
  const box = node.getBoundingClientRect();
  clickClient(map, box.x + box.width / 2, box.y + box.height / 2);
}

describe('point label SVG and picking', () => {
  it.each(['circle', 'image', 'none'] as const)(
    'renders standalone and route-owned text with symbol %s',
    async symbol => {
      const map = await createMap({
        ...style(),
        resources: { icon: { kind: 'image', source: background.source } },
        materials: {
          marker: {
            properties: {
              symbol,
              ...(symbol === 'image' ? { image: { resource: 'icon' } } : {}),
              label: { offset: { x: '0px', y: '-25px' } },
            },
          },
        },
        materialRules: [{ when: { kind: 'point' }, material: 'marker' }],
        objects: [
          { kind: 'point', id: 'p', label: 'Standalone', position: { x: 80, y: 100 } },
          {
            kind: 'route',
            id: 'route',
            points: [
              {
                kind: 'point',
                id: 'owned',
                label: 'Owned',
                pickable: true,
                position: { x: 230, y: 100 },
              },
            ],
          },
        ],
      });
      expect(text(map).textContent).toBe('Standalone');
      expect(text(map, 'owned').textContent).toBe('Owned');
      expect(text(map).getBoundingClientRect().height).toBeGreaterThan(0);
      const events = clicks(map);
      clickText(map);
      clickText(map, text(map, 'owned'));
      expect(events.map(event => event.detail.object.id)).toEqual(['p', 'owned']);
      expect(events[1]!.detail.route).toBe(map.objects.get('route'));
      expect(events[1]!.detail.layer).toBe(map.layers[0]);
    },
  );

  it('uses safe literal text and preserves leading, inner and trailing spaces in actual SVG', async () => {
    const literal = '  <b>A</b>  **B**  ';
    const map = await createMap({
      ...style(),
      objects: [{ kind: 'point', id: 'p', label: literal, position: { x: 40, y: 80 } }],
    });
    const node = text(map);
    expect(node.textContent).toBe(literal);
    expect(node.children).toHaveLength(0);
    expect(getComputedStyle(node).whiteSpace).toBe('pre');
    const original = node.getBoundingClientRect().width;
    (map.objects.get('p') as MapPoint).label = literal.trim();
    await paint();
    expect(text(map)).toBe(node);
    expect(node.getBoundingClientRect().width).toBeLessThan(original);
  });

  it.each(['vertical-rl', 'vertical-lr'])(
    'keeps rendered/measured labels horizontal under inherited %s',
    async writingMode => {
      const map = await createMap(style());
      const node = text(map);
      map.style.writingMode = writingMode;
      map.objects.get('p')!.label = 'A  B  C';
      await paint();
      expect(text(map)).toBe(node);
      expect(getComputedStyle(map).writingMode).toBe(writingMode);
      expect(getComputedStyle(node).writingMode).toBe(HORIZONTAL_WRITING_MODE);
      const measurement = map.shadowRoot!.querySelector<SVGTextElement>('svg[aria-hidden] text')!;
      expect(getComputedStyle(measurement).writingMode).toBe(HORIZONTAL_WRITING_MODE);
      const box = node.getBoundingClientRect();
      expect(box.width).toBeGreaterThan(box.height);
      const events = clicks(map);
      clickClient(map, box.right - 1, box.y + box.height / 2);
      expect(events[0]!.detail.object).toBe(map.objects.get('p'));
      clickClient(map, box.x + box.width / 2, box.bottom + 4);
      expect(events).toHaveLength(1);
    },
  );

  it.each([
    ['text-anchor', 'end'],
    ['text-transform', 'uppercase'],
  ])(
    'keeps cached literal SVG text and picking aligned after container %s: %s',
    async (property, value) => {
      const literal = 'iiiiiiiiiiii';
      const map = await createMap({
        ...style({ font: { size: '20px', family: 'serif' } }),
        objects: [{ kind: 'point', id: 'p', label: literal, position: { x: 100, y: 100 } }],
      });
      const node = text(map);
      const original = node.getBoundingClientRect();
      const advance = node.getComputedTextLength();
      const character = node.getExtentOfChar(0);
      const events = clicks(map);
      clickText(map, node);
      expect(events).toHaveLength(1);
      events.length = 0;
      const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
      map.style.setProperty(property, value);
      await paint();
      expect(text(map)).toBe(node);
      expect(node.textContent).toBe(literal);
      expect(node.getBoundingClientRect().toJSON()).toEqual(original.toJSON());
      expect(node.getComputedTextLength()).toBe(advance);
      expect(node.getExtentOfChar(0)).toEqual(character);
      expect(measurements).not.toHaveBeenCalled();

      for (const textNode of [
        node,
        map.shadowRoot!.querySelector<SVGTextElement>('svg[aria-hidden] text')!,
      ]) {
        expect(getComputedStyle(textNode).textAnchor).toBe('start');
        expect(getComputedStyle(textNode).textTransform).toBe('none');
        expect(getComputedStyle(textNode).writingMode).toBe(HORIZONTAL_WRITING_MODE);
      }

      const point = map.coordinates.mapToClient(new Point2(100, 100));
      expect(original.x).toBeCloseTo(point.x + 40, 3);
      expect(original.y).toBeCloseTo(point.y + 30, 3);
      clickClient(map, original.right - 1, original.y + original.height / 2);
      clickClient(map, original.x - 2, original.y + original.height / 2);
      clickClient(map, original.right + 2, original.y + original.height / 2);
      expect(events).toHaveLength(1);
      expect(events[0]!.detail.object).toBe(map.objects.get('p'));

      // A later measurement under those inherited properties must use the same text settings too.
      map.objects.get('p')!.label = literal + 'i';
      await paint();
      const updated = node.getBoundingClientRect();
      expect(node.textContent).toBe(literal + 'i');
      expect(updated.x).toBeCloseTo(point.x + 40, 3);
      expect(updated.y).toBeCloseTo(point.y + 30, 3);
      clickClient(map, updated.right - 1, updated.y + updated.height / 2);
      clickClient(map, updated.right + 2, updated.y + updated.height / 2);
      expect(events).toHaveLength(2);
    },
  );

  it.each([undefined, '', '  \t  '])('retains %j without text or a label hit area', async label => {
    const map = await createMap({
      ...style(),
      objects: [
        {
          kind: 'point',
          id: 'p',
          ...(label === undefined ? {} : { label }),
          position: { x: 100, y: 100 },
        },
      ],
    });
    expect(map.objects.get('p')!.label).toBe(label);
    expect(groups(map)[0]!.querySelector('text')).toBeNull();
    const events = clicks(map);
    clickMap(map, 150, 140);
    expect(events).toHaveLength(0);
  });

  it.each<LabelOrigin>([
    'top left',
    'top center',
    'top right',
    'center left',
    'center center',
    'center right',
    'bottom left',
    'bottom center',
    'bottom right',
  ])('aligns the measured rectangle with %s', async origin => {
    const map = await createMap(style({ origin, offset: { x: '12px', y: '-15px' } }));
    const box = text(map).getBoundingClientRect();
    const point = map.coordinates.mapToClient(new Point2(100, 100));
    const [vertical, horizontal] = origin.split(' ');
    const horizontalFactor = ['left', 'center', 'right'].indexOf(horizontal!) / 2;
    const verticalFactor = ['top', 'center', 'bottom'].indexOf(vertical!) / 2;
    expect(box.x + box.width * horizontalFactor).toBeCloseTo(point.x + 12, 3);
    expect(box.y + box.height * verticalFactor).toBeCloseTo(point.y - 15, 3);
  });

  it('keeps text/offset screen-sized through pan/zoom without measuring again', async () => {
    document.documentElement.style.fontSize = '20px';
    const map = await createMap(
      style({ font: { size: '1rem', family: 'monospace' }, offset: { x: '1rem', y: '10px' } }),
    );
    const node = text(map);
    const original = node.getBoundingClientRect();
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    const events = clicks(map);
    map.camera.center = new Point2(140, 110);
    map.camera.zoom = 1.5;
    await paint();
    const box = node.getBoundingClientRect();
    const point = map.coordinates.mapToClient(new Point2(100, 100));
    expect(box.width).toBeCloseTo(original.width, 3);
    expect(box.height).toBeCloseTo(original.height, 3);
    expect(box.x - point.x).toBeCloseTo(20, 3);
    expect(box.y - point.y).toBeCloseTo(10, 3);
    clickText(map, node);
    expect(events[0]!.detail.object.id).toBe('p');
    expect(measurements).not.toHaveBeenCalled();
  });

  it('refreshes root rem immediately for picking and automatically for SVG', async () => {
    document.documentElement.style.fontSize = '10px';
    const map = await createMap(
      style({ font: { size: '1rem', family: 'monospace' }, offset: { x: '4rem', y: '3rem' } }),
    );
    const node = text(map);
    const original = node.getBoundingClientRect();
    const events = clicks(map);
    document.documentElement.style.fontSize = '20px';
    clickMap(map, 185, 165);
    expect(events).toHaveLength(1);
    clickMap(map, 145, 135);
    expect(events).toHaveLength(1);
    await paint();
    expect(text(map)).toBe(node);
    expect(node.getBoundingClientRect().width).toBeGreaterThan(original.width);
    expect(node.getBoundingClientRect().height).toBeGreaterThan(original.height);
    expect(node.getAttribute('font-size')).toBe('20');

    // A second change is observed without a query/camera/object change to schedule paint.
    document.documentElement.style.fontSize = '15px';
    await expect.poll(() => Number(node.getAttribute('font-size'))).toBe(15);
  });

  it('remeasures after a real FontFace finishes loading and preserves the text node', async () => {
    const family = 'Atlas Label Regression';
    const map = await createMap(
      style({ font: { size: '20px', family: `"${family}", monospace` } }),
    );
    const node = text(map);
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    const face = new FontFace(
      family,
      'local("Arial"), local("Liberation Sans"), local("DejaVu Sans")',
    );
    FONT_FACES.push(face);
    const loaded = new Promise<void>(resolve =>
      document.fonts.addEventListener(FONT_LOAD_EVENT, () => resolve(), { once: true }),
    );
    document.fonts.add(face);
    await face.load();
    await loaded;
    await paint();
    expect(text(map)).toBe(node);
    expect(measurements).toHaveBeenCalled();
    const events = clicks(map);
    const box = node.getBoundingClientRect();
    clickClient(map, box.right - 1, box.y + box.height / 2);
    expect(events[0]!.detail.object.id).toBe('p');
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(1);
  });

  it('picks the white halo outside the text rectangle at every camera zoom without remeasurement', async () => {
    const map = await createMap(style());
    const node = text(map);
    const events = clicks(map);
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');

    for (const zoom of [1, 2, 0.75]) {
      map.camera.zoom = zoom;
      await paint();
      const box = node.getBoundingClientRect();
      const computed = getComputedStyle(node);
      expect(computed.stroke).toBe('rgb(255, 255, 255)');
      expect(computed.paintOrder).toBe('stroke');
      expect(computed.strokeLinejoin).toBe('round');
      expect(parseFloat(computed.strokeWidth) * node.getScreenCTM()!.a).toBeCloseTo(3, 3);
      const count = events.length;
      clickClient(map, box.x - 1, box.y + box.height / 2);
      clickClient(map, box.right + 1, box.y + box.height / 2);
      clickClient(map, box.x + box.width / 2, box.y - 1);
      clickClient(map, box.x + box.width / 2, box.bottom + 1);
      expect(events).toHaveLength(count + 4);
      expect(events.every(event => event.detail.object === map.objects.get('p'))).toBe(true);
      clickClient(map, box.right + 2, box.y + box.height / 2);
      expect(events).toHaveLength(count + 4);
    }

    expect(measurements).not.toHaveBeenCalled();
  });

  it('picks the rectangular whitespace gap, including native pointer input', async () => {
    const map = await createMap({
      ...style(),
      objects: [{ kind: 'point', id: 'p', label: 'A        B', position: { x: 100, y: 100 } }],
    });
    const box = text(map).getBoundingClientRect();
    const svg = surface(map).getBoundingClientRect();
    const events = clicks(map);
    await userEvent.click(surface(map), {
      position: { x: box.x + box.width / 2 - svg.x, y: box.y + box.height / 2 - svg.y },
    });
    expect(events[0]!.detail.object).toBe(map.objects.get('p'));
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(1);
  });

  it('follows contextual pickable defaults and explicit overrides without hiding text', async () => {
    const map = await createMap({
      ...style(),
      objects: [
        { kind: 'point', id: 'p', label: 'Root', position: { x: 30, y: 50 } },
        {
          kind: 'route',
          id: 'route',
          points: [{ kind: 'point', id: 'owned', label: 'Owned', position: { x: 150, y: 140 } }],
        },
      ],
    });
    const point = map.objects.get('p') as MapPoint;
    const owned = (map.objects.get('route') as MapRoute).points[0]!;
    const events = clicks(map);
    clickText(map);
    clickText(map, text(map, 'owned'));
    expect(events.map(event => event.detail.object.id)).toEqual(['p']);
    owned.pickable = true;
    point.pickable = false;
    clickText(map);
    clickText(map, text(map, 'owned'));
    expect(events.map(event => event.detail.object.id)).toEqual(['p', 'owned']);
    owned.pickable = undefined;
    point.pickable = undefined;
    clickText(map, text(map, 'owned'));
    clickText(map);
    expect(events.map(event => event.detail.object.id)).toEqual(['p', 'owned', 'p']);
    await paint();
    expect(text(map, 'owned').getBoundingClientRect().height).toBeGreaterThan(0);
  });
});

describe('point label composition and live invalidation', () => {
  it.each(['render', 'picking'] as const)(
    'refreshes unchanged probe metrics after non-viewport media on the next %s',
    async update => {
      const session = cdp();
      await session.send(MEDIA_EMULATION_COMMAND, {
        features: [{ name: 'prefers-color-scheme', value: 'light' }],
      });
      const css = document.createElement('style');
      css.textContent =
        '.label-preference-test { font-family: monospace; } @media (prefers-color-scheme: dark) { .label-preference-test { font-family: "Atlas Missing Family", monospace; } }';
      document.head.append(css);
      cleanups.push(() => css.remove());

      try {
        const map = await createMap(style({ font: { size: '20px' } }));
        map.classList.add('label-preference-test');
        const node = text(map);
        await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
        await paint();
        const probe = map.shadowRoot!.querySelector('span')!;
        const before = probe.getBoundingClientRect();
        await session.send(MEDIA_EMULATION_COMMAND, {
          features: [{ name: 'prefers-color-scheme', value: 'dark' }],
        });
        await expect
          .poll(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
          .toBe(true);
        expect(getComputedStyle(map).fontFamily).toContain('Atlas Missing Family');
        expect(probe.getBoundingClientRect().width).toBe(before.width);
        expect(probe.getBoundingClientRect().height).toBe(before.height);

        if (update === 'render') {
          map.camera.center = new Point2(161, 120);
        } else {
          const events = clicks(map);
          clickText(map, node);
          expect(events[0]!.detail.object).toBe(map.objects.get('p'));
        }

        await paint();
        expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe(getComputedStyle(map).fontFamily);
        expect(text(map)).toBe(node);
      } finally {
        await session.send(MEDIA_EMULATION_COMMAND, { features: [] });
      }
    },
  );

  it('refreshes a family-only media query change without map input or viewport changes in the map', async () => {
    const css = document.createElement('style');
    css.textContent =
      '.label-media-test { font-family: monospace; } @media (max-width: 800px) { .label-media-test { font-family: serif; } }';
    document.head.append(css);
    cleanups.push(() => css.remove());
    const map = await createMap(style({ font: { size: '20px' } }));
    map.classList.add('label-media-test');
    await expect.poll(() => text(map).getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    const node = text(map);
    const rootSize = getComputedStyle(document.documentElement).fontSize;
    const viewport = map.camera.viewport;

    try {
      await page.viewport(760, 700);
      await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
      expect(getComputedStyle(map).fontFamily).toBe('serif');
      expect(getComputedStyle(document.documentElement).fontSize).toBe(rootSize);
      expect(map.camera.viewport).toEqual(viewport);
      expect(text(map)).toBe(node);
      const events = clicks(map);
      clickText(map, node);
      expect(events[0]!.detail.object).toBe(map.objects.get('p'));
    } finally {
      await page.viewport(900, 700);
    }
  });

  it('refreshes when a stylesheet finishes loading without interaction', async () => {
    const map = await createMap(style({ font: { size: '20px' } }));
    map.classList.add('label-stylesheet-test');
    const node = text(map);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const url = URL.createObjectURL(
      new Blob(['.label-stylesheet-test { font-family: serif; }'], { type: 'text/css' }),
    );
    link.href = url;
    const loaded = new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => reject(new Error('Test stylesheet failed to load.')), {
        once: true,
      });
    });
    cleanups.push(() => {
      link.remove();
      URL.revokeObjectURL(url);
    });
    document.head.append(link);
    await loaded;
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    expect(getComputedStyle(map).fontFamily).toBe('serif');
    expect(text(map)).toBe(node);
    const events = clicks(map);
    const box = node.getBoundingClientRect();
    clickClient(map, box.right - 1, box.y + box.height / 2);
    clickClient(map, box.right + 2, box.y + box.height / 2);
    expect(events).toHaveLength(1);
  });

  it('refreshes automatically when a CSSOM change changes probe dimensions', async () => {
    const map = await createMap(style({ font: { size: '20px' } }));
    const css = document.createElement('style');
    css.textContent = '.label-cssom-test { font-family: monospace; }';
    document.head.append(css);
    cleanups.push(() => css.remove());
    map.classList.add('label-cssom-test');
    const node = text(map);
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    await paint();
    const probe = map.shadowRoot!.querySelector('span')!;
    const before = probe.getBoundingClientRect().width;
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    css.sheet!.insertRule('.label-cssom-test { font-family: serif; }', 1);
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    expect(measurements).toHaveBeenCalledTimes(1);
    expect(probe.getBoundingClientRect().width).not.toBe(before);
    expect(text(map)).toBe(node);
  });

  it.each(['render', 'picking'] as const)(
    'refreshes Cyrillic CSSOM font metrics with an unchanged Latin probe on the next %s',
    async update => {
      const family = 'Atlas Cyrillic Regression';
      const face = new FontFace(
        family,
        'local("Arial"), local("Liberation Sans"), local("DejaVu Sans")',
        { unicodeRange: 'U+0400-04FF' },
      );
      FONT_FACES.push(face);
      await face.load();
      document.fonts.add(face);
      await document.fonts.ready;
      const css = document.createElement('style');
      css.textContent = '.label-cyrillic-test { font-family: monospace; }';
      document.head.append(css);
      cleanups.push(() => css.remove());
      const map = await createMap({
        ...style({ font: { size: '20px' } }),
        objects: [{ kind: 'point', id: 'p', label: 'ЖЖЖЖЖЖЖЖ', position: { x: 40, y: 70 } }],
      });
      map.classList.add('label-cyrillic-test');
      const node = text(map);
      await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
      await paint();
      const original = node.getBoundingClientRect();
      const probe = map.shadowRoot!.querySelector('span')!;
      const before = probe.getBoundingClientRect();
      css.sheet!.insertRule(`.label-cyrillic-test { font-family: "${family}", monospace; }`, 1);
      const currentFamily = getComputedStyle(map).fontFamily;
      expect(currentFamily).toContain(family);
      expect(probe.getBoundingClientRect().width).toBe(before.width);
      expect(probe.getBoundingClientRect().height).toBe(before.height);

      // Measure an independent real SVG reference using the loaded Cyrillic font.
      const reference = node.cloneNode(true) as SVGTextElement;
      reference.setAttribute(FAMILY_ATTRIBUTE, currentFamily);
      node.parentElement!.append(reference);
      const expected = reference.getBoundingClientRect();
      reference.remove();
      expect(expected.width).not.toBe(original.width);
      const events = clicks(map);

      if (update === 'render') {
        map.camera.center = new Point2(161, 120);
        await paint();
      }

      const point = map.coordinates.mapToClient(new Point2(40, 70));
      clickClient(map, point.x + 40 + expected.width - 1, point.y + 30 + expected.height / 2);
      expect(events[0]!.detail.object).toBe(map.objects.get('p'));
      clickClient(map, point.x + 40 + expected.width + 2, point.y + 30 + expected.height / 2);
      expect(events).toHaveLength(1);
      await paint();
      expect(text(map)).toBe(node);
      expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe(currentFamily);
      const actual = node.getBoundingClientRect();
      expect(actual.width).toBeCloseTo(expected.width, 3);
      expect(actual.height).toBeCloseTo(expected.height, 3);
      expect(actual.x).toBeCloseTo(point.x + 40, 3);
      expect(actual.y).toBeCloseTo(point.y + 30, 3);
    },
  );

  it('does not inspect application stylesheets or CSS rules for empty maps', async () => {
    const css = document.createElement('style');
    css.textContent = Array.from(
      { length: 500 },
      (_, index) => `.label-unrelated-${index} { color: red; }`,
    ).join('\n');
    document.head.append(css);
    cleanups.push(() => css.remove());
    const rules = vi.spyOn(CSSStyleSheet.prototype, 'cssRules', 'get');
    const sheets = vi.spyOn(Document.prototype, 'styleSheets', 'get');
    const adopted = vi.spyOn(Document.prototype, 'adoptedStyleSheets', 'get');

    for (let index = 0; index < 3; index++) {
      await createMap({ objects: [] });
    }

    expect(rules).not.toHaveBeenCalled();
    expect(sheets).not.toHaveBeenCalled();
    expect(adopted).not.toHaveBeenCalled();
  });

  it('observes ancestors across nested open and closed shadow roots', async () => {
    const wrapper = document.createElement('div');
    wrapper.style.fontFamily = 'monospace';
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const outerShadow = outer.attachShadow({ mode: 'open' });
    const innerShadow = inner.attachShadow({ mode: 'closed' });
    outerShadow.append(inner);
    wrapper.append(outer);
    document.body.append(wrapper);
    cleanups.push(() => wrapper.remove());
    const map = await createMap(style({ font: { size: '20px' } }));
    innerShadow.append(map);
    await expect.poll(() => text(map).getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    const node = text(map);
    wrapper.style.fontFamily = 'serif';
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    expect(getComputedStyle(map).fontFamily).toBe('serif');
    inner.style.fontFamily = 'monospace';
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(text(map)).toBe(node);
    const events = clicks(map);
    clickText(map, node);
    expect(events[0]!.detail.object).toBe(map.objects.get('p'));
  });

  it('follows font inheritance through an assigned slot', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const slot = document.createElement('slot');
    slot.style.fontFamily = 'monospace';
    shadow.append(slot);
    document.body.append(host);
    cleanups.push(() => host.remove());
    const map = await createMap(style({ font: { size: '20px' } }));
    host.append(map);
    await expect.poll(() => text(map).getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    const node = text(map);
    slot.style.fontFamily = 'serif';
    await expect.poll(() => node.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    expect(text(map)).toBe(node);
  });

  it('keeps whole labels beyond clipped layer bounds, hides excluded points and clips at the viewport', async () => {
    const map = await createMap({
      ...style(),
      layers: [
        {
          id: 'content',
          background,
          intersectionBounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        },
      ],
      objects: [
        { kind: 'point', id: 'p', label: 'Beyond bounds', position: { x: 90, y: 80 } },
        { kind: 'point', id: 'excluded', label: 'Excluded', position: { x: 110, y: 80 } },
      ],
    });
    expect(groups(map, 'excluded')).toHaveLength(0);
    const node = text(map);
    expect(node.getBoundingClientRect().width).toBeGreaterThan(0);
    const events = clicks(map);
    clickMap(map, 140, 115);
    expect(events[0]!.detail.object.id).toBe('p');
    map.layers[0]!.visible = false;
    clickMap(map, 140, 115);
    expect(events).toHaveLength(1);
    await paint();
    expect(node.getBoundingClientRect().width).toBe(0);
    map.layers[0]!.visible = true;
    (map.objects.get('p') as MapPoint).position = new Point2(300, 80);

    // Automatic clipping removes the appearance, rather than clipping just its text.
    await paint();
    expect(groups(map)).toHaveLength(0);
    map.layers[0]!.objectIds.add('p');
    map.materials.get('label')!.properties = {
      label: { origin: 'top left', offset: { x: '0px', y: '30px' } },
    };
    await paint();
    expect(text(map).getBoundingClientRect().right).toBeGreaterThan(
      surface(map).getBoundingClientRect().right,
    );
    clickMap(map, 305, 115);
    expect(events).toHaveLength(2);
    clickMap(map, 325, 115);
    expect(events).toHaveLength(2);
    expect(getComputedStyle(surface(map)).overflow).toBe('hidden');
  });

  it('composes geometry A, label A, geometry B, label B and picks in reverse', async () => {
    const map = await createMap({
      ...style(),
      objects: [
        { kind: 'point', id: 'p', label: 'A        B', position: { x: 40, y: 50 } },
        { kind: 'point', id: 'cover', label: 'C', position: { x: 115, y: 90 } },
      ],
    });
    const first = groups(map)[0]!;
    const second = groups(map, 'cover')[0]!;
    expect(Array.from(first.children).map(child => child.localName)).toEqual(['circle', 'text']);
    expect(first.nextElementSibling).toBe(second);
    const events = clicks(map);
    clickMap(map, 115, 90);
    expect(events[0]!.detail.object.id).toBe('cover');
    (map.objects.get('cover') as MapPoint).pickable = false;
    clickMap(map, 115, 90);
    expect(events[1]!.detail.object.id).toBe('p');
  });

  it('keeps separate layer/root/route contexts for the same point instance', async () => {
    const map = await createMap({
      ...style(),
      layers: [
        { id: 'low', background, objects: ['route'] },
        { id: 'high', stackIndex: 1, objects: ['route'] },
      ],
      objects: [
        {
          kind: 'route',
          id: 'route',
          points: [{ kind: 'point', id: 'p', label: 'Shared', position: { x: 100, y: 100 } }],
        },
      ],
    });
    const route = map.objects.get('route') as MapRoute;
    const point = route.points[0]!;
    map.objects.add(point);
    map.layers.forEach(layer => layer.objectIds.add('p'));
    await paint();
    expect(groups(map)).toHaveLength(4);
    const nodes = groups(map).map(group => group.querySelector('text'));
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    point.label = 'Changed in every context';
    await paint();
    expect(groups(map).map(group => group.querySelector('text'))).toEqual(nodes);
    expect(nodes.every(node => node!.textContent === point.label)).toBe(true);
    expect(measurements).toHaveBeenCalledTimes(1);
    const events = clicks(map);
    clickText(map);
    expect(events[0]!.detail).toMatchObject({ object: point, layer: map.layers[1] });
    expect(events[0]!.detail.route).toBeUndefined();
    point.pickable = true;
    map.objects.remove(point);
    clickText(map);
    expect(events[1]!.detail).toMatchObject({ object: point, route, layer: map.layers[1] });
    map.layers[1]!.visible = false;
    clickText(map);
    expect(events[2]!.detail).toMatchObject({ object: point, route, layer: map.layers[0] });
  });

  it('picks updated text, materials and positions synchronously inside batch, retaining nodes', async () => {
    const map = await createMap(style());
    const point = map.objects.get('p') as MapPoint;
    const node = text(map);
    const group = groups(map)[0];
    const events = clicks(map);
    map.batch(() => {
      point.label = 'A much longer label';
      clickMap(map, 240, 135);
      expect(events).toHaveLength(1);
      expect(node.textContent).toBe('A  B');
      point.label = 'A';
      clickMap(map, 240, 135);
      expect(events).toHaveLength(1);
      map.materials.get('label')!.properties = {
        label: {
          font: { size: '20px', family: 'monospace' },
          origin: 'top left',
          offset: { x: '-60px', y: '-30px' },
        },
      };
      point.position = new Point2(120, 120);
      clickMap(map, 65, 95);
      expect(events).toHaveLength(2);
      point.pickable = false;
      clickMap(map, 65, 95);
      expect(events).toHaveLength(2);
    });
    await paint();
    expect(groups(map)[0]).toBe(group);
    expect(text(map)).toBe(node);
    expect(node.textContent).toBe('A');
    expect(node.getBoundingClientRect().height).toBeGreaterThan(0);
  });

  it('measures before any SVG render and leaves pending text invalidation intact', async () => {
    const map = await createMap(style());
    const labels = new ObjectLabels(map, map.shadowRoot!, () => {});
    const model = new MapModel(resolveMapDefinition(definition(style())), labels);
    labels.setScene(model.geometry);
    const point = model.objects.get('p') as MapPoint;
    model.geometry.takeChanges();
    point.label = 'Unrendered label';
    expect(model.spatial.hitTest(new Point2(145, 135), map.camera)?.object).toBe(point);
    expect(model.geometry.takeChanges().labels.size).toBe(1);
    labels.disconnect();
    model.materials.deactivate();
  });

  it('picks a newly added label before its first SVG node exists', async () => {
    const map = await createMap(style());
    const events = clicks(map);
    const point = map.objects.add({
      kind: 'point',
      id: 'new',
      label: 'New point',
      position: { x: 50, y: 50 },
    });
    map.layers[0]!.objectIds.add('new');
    expect(groups(map, 'new')).toHaveLength(0);
    clickMap(map, 95, 85);
    expect(events[0]!.detail.object).toBe(point);
    expect(groups(map, 'new')).toHaveLength(0);
    await paint();
    expect(text(map, 'new').textContent).toBe('New point');
  });

  it('keeps a label node through symbol changes and updates container fallback before observer delivery', async () => {
    const map = await createMap(style({ font: { size: '20px' } }));
    const node = text(map);
    const events = clicks(map);
    map.style.fontFamily = 'monospace';
    map.materials.get('label')!.properties = {
      symbol: 'none',
      label: { font: { size: '20px' }, origin: 'top left', offset: { x: '40px', y: '30px' } },
    };
    clickMap(map, 145, 135);
    expect(events).toHaveLength(1);
    await paint();
    expect(text(map)).toBe(node);
    expect(node.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(groups(map)[0]!.firstElementChild!.localName).toBe('g');
  });

  it('releases browser observers on disconnect and old scene state on replacement', async () => {
    const map = await createMap(style());
    const point = map.objects.get('p') as MapPoint;
    const snapshot = map.definition;
    const node = text(map);
    await expect(
      map.load(
        definition({ materials: { bad: { properties: { label: { font: { size: '0px' } } } } } }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_MATERIAL_PROPERTY' });
    expect(map.definition).toBe(snapshot);
    expect(text(map)).toBe(node);
    const observerDisconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
    const mutationDisconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const fontUnsubscribe = vi.spyOn(document.fonts, 'removeEventListener');
    const stylesheetUnsubscribe = vi.spyOn(document, 'removeEventListener');
    const windowUnsubscribe = vi.spyOn(window, 'removeEventListener');
    map.remove();
    expect(observerDisconnect).toHaveBeenCalledTimes(2);
    expect(mutationDisconnect).toHaveBeenCalledTimes(1);
    expect(fontUnsubscribe).toHaveBeenCalledWith(FONT_LOAD_EVENT, expect.any(Function));
    expect(fontUnsubscribe).toHaveBeenCalledWith('loadingerror', expect.any(Function));
    expect(stylesheetUnsubscribe).toHaveBeenCalledWith('load', expect.any(Function), true);
    expect(windowUnsubscribe).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(map.shadowRoot!.querySelectorAll('svg')).toHaveLength(1);
    document.body.append(map);
    await map.load(definition({ objects: [] }));
    await paint();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    point.label = 'Detached old scene';
    expect(frames).not.toHaveBeenCalled();
    expect(groups(map)).toHaveLength(0);
  });

  it('updates shared maps with their own container families and reconnects current state', async () => {
    const first = await createMap(style({ font: { size: '20px' } }));
    const second = await createMap({ ...style({ font: { size: '20px' } }), objects: [] });
    first.style.fontFamily = 'monospace';
    second.style.fontFamily = 'serif';
    const point = first.objects.get('p') as MapPoint;
    second.objects.add(point);
    second.layers[0]!.objectIds.add('p');
    await paint();
    const firstNode = text(first);
    const secondNode = text(second);
    expect(firstNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('monospace');
    expect(secondNode.getAttribute(FAMILY_ATTRIBUTE)).toBe('serif');
    second.remove();
    point.label = 'Changed while detached';
    point.position = new Point2(50, 50);
    document.body.append(second);
    const events = clicks(second);
    clickMap(second, 95, 85);
    expect(events[0]!.detail.object).toBe(point);
    await paint();
    expect(text(first)).toBe(firstNode);
    expect(text(second)).toBe(secondNode);
    expect(firstNode.textContent).toBe(point.label);
    expect(secondNode.textContent).toBe(point.label);
  });

  it('limits text edits and inherited material edits to their consumers without path changes', async () => {
    const map = await createMap({
      ...style(),
      materials: {
        base: { properties: { label: { font: { size: '20px', family: 'monospace' } } } },
        child: { inherits: 'base', properties: {} },
        other: { properties: {} },
      },
      materialRules: [],
      objects: [
        {
          kind: 'route',
          id: 'route',
          points: [
            {
              kind: 'point',
              id: 'p',
              label: 'Owned',
              material: 'child',
              position: { x: 60, y: 80 },
            },
            { kind: 'point', position: { x: 90, y: 100 } },
          ],
        },
        {
          kind: 'point',
          id: 'other',
          label: 'Unchanged',
          material: 'other',
          position: { x: 230, y: 180 },
        },
      ],
    });
    const route = map.objects.get('route') as MapRoute;
    const other = text(map, 'other');
    const path = groups(map, 'route')[0]!.querySelector('polyline')!;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(surface(map), {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    const measurements = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox');
    route.points[0]!.label = 'Edited';
    await paint();
    expect(measurements).toHaveBeenCalledTimes(1);
    expect(records.every(record => !other.contains(record.target) && record.target !== path)).toBe(
      true,
    );
    records.length = 0;
    measurements.mockClear();
    map.materials.get('base')!.properties = {
      label: { color: '#123456', font: { size: '20px', family: 'monospace' } },
    };
    await paint();
    expect(measurements).not.toHaveBeenCalled();
    expect(records.map(record => record.target)).toEqual([text(map)]);
    expect(text(map).getAttribute('fill')).toBe('#123456');
    expect(text(map, 'other')).toBe(other);
    observer.disconnect();
  });

  it.each(['press', 'release'] as const)(
    'suppresses an obsolete captured label hit changed during %s',
    async trigger => {
      const map = await createMap({
        ...style(),
        objects: [
          { kind: 'point', id: 'under', label: 'Underlying label', position: { x: 100, y: 100 } },
          { kind: 'point', id: 'p', label: 'Captured label', position: { x: 100, y: 100 } },
        ],
      });
      const events = clicks(map);
      map.clickTrigger = trigger;
      map.addEventListener(
        trigger,
        () => {
          map.objects.get('p')!.label = undefined;
        },
        { once: true },
      );
      clickText(map);
      expect(events).toHaveLength(0);
      clickText(map);
      expect(events[0]!.detail.object.id).toBe('under');
    },
  );
});
