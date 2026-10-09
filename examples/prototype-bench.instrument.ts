/* eslint-disable @typescript-eslint/unbound-method -- Store originals and invoke with explicit receivers. */
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapPolygon } from '#objects/map-polygon.js';
import { MapRoute } from '#objects/map-route.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';

/** Intrusive, example-only counters; installed exclusively in the instrumentation phase. */
export function instrument(): {
  reset(): void;
  snapshot(): Record<string, number>;
  restore(): void;
} {
  const counters: Record<string, number> = {};

  const increment = (key: string, amount = 1): void => {
    counters[key] = (counters[key] ?? 0) + amount;
  };

  const attribute = Element.prototype.setAttribute;
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
      symbols: geometry.symbols,
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
        increment('renderer_changed_entries', changed.size);

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
      for (const key of Object.keys(counters)) {
        delete counters[key];
      }
    },
    snapshot(): Record<string, number> {
      return { ...counters };
    },
    restore(): void {
      Element.prototype.setAttribute = attribute;
      MapObjectCollection.prototype[Symbol.iterator] = iterate;
      SvgRenderer.prototype.prepare = prepare;
      SvgRenderer.prototype.render = render;
      properties.forEach(([prototype, key], index) =>
        Object.defineProperty(prototype, key, descriptors[index]!),
      );
    },
  };
}
