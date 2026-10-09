import { squaredDistanceToSegment } from '#math/distance.js';

import { isLayerEligible, isSceneObjectEligible } from './scene-geometry.js';

import type { Camera } from '#camera/camera.js';
import type { Point } from '#math/point.js';
import type { Geometry } from './geometry.js';
import type { ClippedSegment } from './intersection.js';
import type { SceneGeometry, SceneObject, SceneSymbols } from './scene-geometry.js';

/** Spatial queries over scene geometry, independent of rendering and browser DOM. */
export class Spatial {
  readonly #geometry: SceneGeometry;

  constructor(geometry: SceneGeometry) {
    this.#geometry = geometry;
  }

  /** Check only the captured display, without picking an object underneath it. */
  hasHit(entry: SceneObject, point: Point, camera: Camera): boolean {
    return (
      isSceneObjectEligible(this.#geometry, entry) &&
      hitTestGeometry(point, entry.geometry, this.#geometry.symbols, camera.zoom)
    );
  }

  /** Flat-view picking, equivalent to a perpendicular ray with 2D composition order. */
  hitTest(point: Point, camera: Camera): SceneObject | undefined {
    const { center, zoom, viewport } = camera;
    const x = (point.x - center.x) * zoom;
    const y = (point.y - center.y) * zoom;

    if (
      viewport.width <= 0 ||
      viewport.height <= 0 ||
      x < -viewport.width / 2 ||
      x >= viewport.width / 2 ||
      y < -viewport.height / 2 ||
      y >= viewport.height / 2
    ) {
      return undefined;
    }

    const objects = this.#geometry.objects;

    // Reverse composition order avoids scanning objects behind the first hit.
    for (let index = objects.length - 1; index >= 0; index--) {
      const entry = objects.at(index);

      if (!entry || !isLayerEligible(entry.layer)) {
        continue;
      }

      if (hitTestGeometry(point, entry.geometry, this.#geometry.symbols, zoom)) {
        return entry;
      }
    }

    return undefined;
  }
}

function hitTestGeometry(
  point: Point,
  geometry: Geometry,
  symbols: SceneSymbols,
  zoom: number,
): boolean {
  if (geometry.kind === 'point') {
    const { position } = geometry;
    const { radius, strokeWidth } = symbols.point;
    const dx = (point.x - position.x) * zoom;
    const dy = (point.y - position.y) * zoom;
    const outerRadius = radius + strokeWidth / 2;

    return dx * dx + dy * dy <= outerRadius * outerRadius;
  }

  const radius = symbols.line.strokeWidth / (2 * zoom);

  if (geometry.kind === 'line') {
    if (geometry.segment) {
      return hitTestClippedSegment(point, geometry.segment, radius * radius);
    }

    return squaredDistanceToSegment(point, geometry.start, geometry.end) <= radius * radius;
  }

  if (geometry.segments) {
    return geometry.segments.some(segment =>
      hitTestClippedSegment(point, segment, radius * radius),
    );
  }

  return geometry.points.some((end, index) => {
    const start = index > 0 ? geometry.points.at(index - 1) : undefined;

    return start !== undefined && squaredDistanceToSegment(point, start, end) <= radius * radius;
  });
}

/** A hit exists when an eligible centerline position lies within the screen-sized stroke. */
function hitTestClippedSegment(
  point: Point,
  segment: ClippedSegment,
  radiusSquared: number,
): boolean {
  const { start, end, startIncluded, endIncluded } = segment;
  const distance = squaredDistanceToSegment(point, start, end);

  if (distance < radiusSquared) {
    // An interior position can be arbitrarily close to an excluded endpoint.
    return true;
  }

  if (!Number.isFinite(distance) || distance > radiusSquared) {
    return false;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    // Every eligible position of a vertical transition projects to the same screen point.
    return true;
  }

  const projection = (point.x - start.x) * dx + (point.y - start.y) * dy;

  if (projection <= 0) {
    return startIncluded;
  }

  if (projection >= dx * dx + dy * dy) {
    return endIncluded;
  }

  return true;
}
