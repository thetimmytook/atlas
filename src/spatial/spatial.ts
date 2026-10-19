import { squaredDistanceToSegment } from '#math/distance.js';
import { containsConvexPolygon } from '#math/polygon.js';

import { containsPolygonXY } from './polygon-clipping.js';
import { isLayerEligible, isSceneObjectEligible } from './scene-geometry.js';

import type { Camera } from '#camera/camera.js';
import type { Point2 } from '#math/point2.js';
import type { ResolvedAppearance } from '#objects/map-materials.js';
import type { Geometry } from './geometry.js';
import type { ClippedSegment } from './intersection.js';
import type { ObjectLabelView } from './object-label.js';
import type { SceneGeometry, SceneObject } from './scene-geometry.js';

/** Spatial queries over scene geometry, independent of rendering and browser DOM. */
export class Spatial {
  readonly #geometry: SceneGeometry;
  readonly #labels: ObjectLabelView | undefined;

  constructor(geometry: SceneGeometry, labels?: ObjectLabelView) {
    this.#geometry = geometry;
    this.#labels = labels;
  }

  /** Revalidate the captured owner/layer, without picking another object underneath. */
  hasHit(entry: SceneObject, point: Point2, camera: Camera): boolean {
    this.#labels?.refresh();

    if (entry.object.kind !== 'point') {
      // Derived appearances have no public identity; captures belong to the owner/layer.
      return (
        isLayerEligible(entry.layer) &&
        this.#geometry.objects.some(
          candidate =>
            candidate.object === entry.object &&
            candidate.layer === entry.layer &&
            this.#hitTestEntry(candidate, point, camera.zoom),
        )
      );
    }

    return (
      isSceneObjectEligible(this.#geometry, entry) && this.#hitTestEntry(entry, point, camera.zoom)
    );
  }

  /** Flat-view picking, equivalent to a perpendicular ray with 2D composition order. */
  hitTest(point: Point2, camera: Camera): SceneObject | undefined {
    this.#labels?.refresh();
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

      if (this.#hitTestEntry(entry, point, zoom)) {
        return entry;
      }
    }

    return undefined;
  }

  #hitTestEntry(entry: SceneObject, point: Point2, zoom: number): boolean {
    const appearance = this.#geometry.appearanceFor(entry);

    if (appearance.kind !== 'point' || appearance.pickable) {
      const label = this.#labels?.forEntry(entry);
      const position = label && this.#geometry.labelPositionFor(entry);

      if (label && position) {
        const dx = (point.x - position.x) * zoom;
        const dy = (point.y - position.y) * zoom;
        const { x, y, width, height } = label.bounds;

        if (dx >= x && dx <= x + width && dy >= y && dy <= y + height) {
          return true;
        }
      }
    }

    return hitTestGeometry(point, entry.geometry, appearance, zoom);
  }
}

function hitTestGeometry(
  point: Point2,
  geometry: Geometry,
  appearance: ResolvedAppearance,
  zoom: number,
): boolean {
  if (geometry.kind === 'polygon') {
    return (
      (!geometry.bounds || containsPolygonXY(geometry.bounds, point)) &&
      geometry.cells.some(cell => containsConvexPolygon(cell, point))
    );
  }

  if (geometry.kind === 'point') {
    const { position } = geometry;

    if (appearance.kind !== 'point' || !appearance.pickable) {
      return false;
    }

    const dx = (point.x - position.x) * zoom;
    const dy = (point.y - position.y) * zoom;

    if (appearance.image) {
      const { x, y, width, height } = appearance.image;

      return dx >= x && dx <= x + width && dy >= y && dy <= y + height;
    }

    const outerRadius = appearance.size / 2;

    return Math.hypot(dx, dy) <= outerRadius;
  }

  if (appearance.kind !== 'line' && appearance.kind !== 'route') {
    return false;
  }

  const radius = appearance.width / 2 / zoom;

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
  point: Point2,
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
