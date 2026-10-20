/* eslint-disable @typescript-eslint/unbound-method -- Store originals and invoke with explicit receivers. */

import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapPolygon } from '#objects/map-polygon.js';
import { MapRoute } from '#objects/map-route.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';

import type { MapElement } from '#components/map-element/map-element.js';

/** Intrusive, example-only counters; installed exclusively in the instrumentation phase. */
export function instrument(map: MapElement): {
  reset(): void;
  snapshot(): Record<string, number>;
  restore(): void;
} {
  const counters: Record<string, number> = {};

  const increment = (key: string, amount = 1): void => {
    counters[key] = (counters[key] ?? 0) + amount;
  };

  const owners = new Set<string>();
  const textOwners = new Set<string>();

  const touch = (element: SVGElement): void => {
    const id = element.closest('[data-object-id]')?.getAttribute('data-object-id');

    if (id) {
      owners.add(id);

      if (element.tagName === 'text') {
        textOwners.add(id);
      }
    }
  };

  const collect = (records: MutationRecord[]): void => {
    records.forEach(record => {
      if (record.target instanceof SVGElement && record.attributeName === 'style') {
        increment('svg_css_style_mutations');
      }
    });
  };

  const observer = new MutationObserver(collect);
  observer.observe(map.shadowRoot!, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });
  const attribute = Element.prototype.setAttribute;
  const bbox = SVGGraphicsElement.prototype.getBBox;
  const content = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
  const contentSetter = content.set as (this: Node, value: string | null) => void;

  SVGGraphicsElement.prototype.getBBox = function (...args): DOMRect {
    if (this.tagName === 'text') {
      increment('text_measurement_getBBox');
    }

    return bbox.apply(this, args);
  };

  Object.defineProperty(Node.prototype, 'textContent', {
    ...content,
    set(this: Node, value: string | null): void {
      if (this instanceof SVGElement && this.tagName === 'text') {
        increment('svg_text_content_writes');
        touch(this);
        increment(
          this.closest('svg')?.getAttribute('aria-hidden') === 'true'
            ? 'measurement_text_content_writes'
            : 'displayed_text_content_writes',
        );
      }

      contentSetter.call(this, value);
    },
  });
  const iterate = MapObjectCollection.prototype[Symbol.iterator];
  const prepare = SvgRenderer.prototype.prepare;
  const render = SvgRenderer.prototype.render;
  const properties = [
    [MapRoute.prototype, 'points'],
    [MapPolygon.prototype, 'contour'],
    [MapPolygon.prototype, 'baseZ'],
    [MapPolygon.prototype, 'height'],
  ] as const;
  const descriptors = properties.map(([prototype, key]) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key)!;
    const getter = descriptor.get as (this: object) => unknown;
    Object.defineProperty(prototype, key, {
      ...descriptor,
      get(this: object): unknown {
        increment(`runtime_${key}_getter_reads`);

        return getter.call(this);
      },
    });

    return descriptor;
  });

  Element.prototype.setAttribute = function (name, value): void {
    if (this instanceof SVGElement) {
      increment('svg_attribute_writes');
      touch(this);

      if (this.tagName === 'text') {
        increment('svg_text_attribute_writes');
      }

      if (
        [
          'fill',
          'stroke',
          'stroke-width',
          'fill-opacity',
          'font-family',
          'font-size',
          'font-weight',
          'style',
          'paint-order',
          'stroke-linejoin',
        ].includes(name)
      ) {
        increment('svg_style_attribute_writes');
      }

      if (
        ['d', 'points', 'x1', 'y1', 'x2', 'y2'].includes(name) ||
        (name === 'transform' && this.tagName === 'g')
      ) {
        increment('svg_map_geometry_writes');
      }

      if (name === 'transform' && this.tagName === 'circle') {
        increment('svg_symbol_scale_writes');
      }

      if (name === 'viewBox') {
        increment('svg_viewbox_writes');
      }
    }

    attribute.call(this, name, value);
  };

  MapObjectCollection.prototype[Symbol.iterator] = function (): ReturnType<typeof iterate> {
    increment('root_iterator_creations');
    const iterator = iterate.call(this);
    const next = iterator.next.bind(iterator);

    iterator.next = (...args): ReturnType<typeof next> => {
      increment('root_iterator_next_calls');

      return next(...args);
    };

    return iterator;
  };

  SvgRenderer.prototype.prepare = function (geometry): ReturnType<typeof prepare> {
    let previous: typeof geometry.objects | undefined;

    return prepare.call(this, {
      appearanceFor: geometry.appearanceFor,
      labelPositionFor: geometry.labelPositionFor,
      invalidateAppearances: geometry.invalidateAppearances,
      layers: geometry.layers,
      get objects(): typeof geometry.objects {
        increment('renderer_scene_reads');
        const entries = geometry.objects;
        increment('renderer_entries_exposed', entries.length);

        if (previous && previous !== entries) {
          increment('renderer_composition_changes');
        }

        previous = entries;

        return entries;
      },
      takeChanges: () => {
        const changed = geometry.takeChanges();
        increment(
          'renderer_changed_entries',
          new Set([...changed.geometry, ...changed.appearance]).size,
        );

        return changed;
      },
    });
  };

  SvgRenderer.prototype.render = function (viewport, bounds): void {
    increment('renderer_callbacks');
    render.call(this, viewport, bounds);
  };

  return {
    reset(): void {
      observer.takeRecords();
      owners.clear();
      textOwners.clear();

      for (const key of Object.keys(counters)) {
        delete counters[key];
      }
    },
    snapshot(): Record<string, number> {
      collect(observer.takeRecords());

      return {
        ...counters,
        svg_touched_owners: owners.size,
        svg_touched_text_owners: textOwners.size,
      };
    },
    restore(): void {
      observer.disconnect();
      Element.prototype.setAttribute = attribute;
      SVGGraphicsElement.prototype.getBBox = bbox;
      Object.defineProperty(Node.prototype, 'textContent', content);
      MapObjectCollection.prototype[Symbol.iterator] = iterate;
      SvgRenderer.prototype.prepare = prepare;
      SvgRenderer.prototype.render = render;
      properties.forEach(([prototype, key], index) =>
        Object.defineProperty(prototype, key, descriptors[index]!),
      );
    },
  };
}
