/* eslint-disable @typescript-eslint/unbound-method -- Originals are intentionally restored and invoked with explicit .call(this). */
import { MapObjectCollection } from '#objects/map-object-collection.js';
import { MapRoute } from '#objects/map-route.js';
import { SvgRenderer } from '#renderers/svg/svg-renderer.js';

import type { SceneGeometry, SceneObject } from '#spatial/scene-geometry.js';

/** Example-local intrusive counters. Never enable these during the timing baseline. */
export function instrumentAtlas(): {
  counters: Map<string, number>;
  renderDurations: number[];
  preparationDurations: number[];
  reset(): void;
  restore(): void;
} {
  const counters = new Map<string, number>();
  const renderDurations: number[] = [];
  const preparationDurations: number[] = [];

  const count = (key: string): void => {
    counters.set(key, (counters.get(key) ?? 0) + 1);
  };

  const attribute = Element.prototype.setAttribute;
  const removeAttribute = Element.prototype.removeAttribute;
  const rect = Element.prototype.getBoundingClientRect;
  const iterate = MapObjectCollection.prototype[Symbol.iterator];
  const prepare = SvgRenderer.prototype.prepare;
  const render = SvgRenderer.prototype.render;
  const routePoints = Object.getOwnPropertyDescriptor(MapRoute.prototype, 'points')!;
  const readRoutePoints = routePoints.get as (this: MapRoute) => MapRoute['points'];

  Element.prototype.setAttribute = function (name, value): void {
    if (this instanceof SVGElement) {
      count('svg_attribute_writes');
    }

    attribute.call(this, name, value);
  };

  Element.prototype.removeAttribute = function (name): void {
    if (this instanceof SVGElement) {
      count('svg_attribute_removals');
    }

    removeAttribute.call(this, name);
  };

  Element.prototype.getBoundingClientRect = function (): DOMRect {
    count('layout_rect_reads');

    return rect.call(this);
  };

  MapObjectCollection.prototype[Symbol.iterator] = function (): ReturnType<typeof iterate> {
    count('root_iterator_creations');
    const iterator = iterate.call(this);
    const next = iterator.next.bind(iterator);

    iterator.next = (...args): ReturnType<typeof next> => {
      count('root_iterator_next_calls');

      return next(...args);
    };

    return iterator;
  };

  Object.defineProperty(MapRoute.prototype, 'points', {
    ...routePoints,
    get(this: MapRoute): MapRoute['points'] {
      count('route_membership_reads');

      return readRoutePoints.call(this);
    },
  });

  SvgRenderer.prototype.prepare = async function (
    background,
    geometry,
  ): ReturnType<typeof prepare> {
    let previous: readonly SceneObject[] | undefined;
    const observed: SceneGeometry = {
      symbols: geometry.symbols,
      takeChanges: () => geometry.takeChanges(),
      get objects(): readonly SceneObject[] {
        count('renderer_scene_reads');
        const entries = geometry.objects;

        if (previous && entries !== previous) {
          count('renderer_scene_membership_changes');
        }

        previous = entries;

        return entries;
      },
    };
    const start = performance.now();
    const prepared = await prepare.call(this, background, observed);
    preparationDurations.push(performance.now() - start);

    return prepared;
  };

  SvgRenderer.prototype.render = function (viewport, bounds): void {
    const start = performance.now();
    render.call(this, viewport, bounds);
    renderDurations.push(performance.now() - start);
    count('renderer_calls');
  };

  return {
    counters,
    renderDurations,
    preparationDurations,
    reset(): void {
      counters.clear();
      renderDurations.length = 0;
      preparationDurations.length = 0;
    },
    restore(): void {
      Element.prototype.setAttribute = attribute;
      Element.prototype.removeAttribute = removeAttribute;
      Element.prototype.getBoundingClientRect = rect;
      MapObjectCollection.prototype[Symbol.iterator] = iterate;
      Object.defineProperty(MapRoute.prototype, 'points', routePoints);
      SvgRenderer.prototype.prepare = prepare;
      SvgRenderer.prototype.render = render;
    },
  };
}
