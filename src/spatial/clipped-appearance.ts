import { clipPolyline, clipSegment, containsPosition } from './intersection.js';

import type { Point } from '#math/point.js';
import type { MapLayer } from '#objects/map-layer.js';
import type { MapEntry } from '#objects/map-object-collection.js';
import type { MapPoint } from '#objects/map-point.js';
import type { MapRoute } from '#objects/map-route.js';
import type { ClippedFragment, ClippedSegment } from './intersection.js';
import type { SceneObject } from './scene-geometry.js';

/** One concrete consumer of derived geometry: an automatic appearance of a root in a layer. */
export function createClippedAppearance(
  layer: MapLayer,
  object: MapEntry,
  pointEntry: (layer: MapLayer, point: MapPoint, route?: MapRoute) => SceneObject,
): () => readonly SceneObject[] {
  const bounds = layer.intersectionBounds!;

  if (object.kind === 'point') {
    const entry = pointEntry(layer, object);

    return () => (containsPosition(bounds, object.position) ? [entry] : []);
  }

  if (object.kind === 'line') {
    let segment: ClippedSegment | undefined;
    const entry: SceneObject = Object.freeze({
      layer,
      object,
      geometry: Object.freeze({
        kind: 'line' as const,
        get start(): Point {
          return segment!.start;
        },
        get end(): Point {
          return segment!.end;
        },
        get segment(): ClippedSegment {
          return segment!;
        },
      }),
    });

    return () => {
      segment = clipSegment(object.points[0].position, object.points[1].position, bounds);

      return segment ? [entry] : [];
    };
  }

  const paths: { entry: SceneObject; update(fragment: ClippedFragment): void }[] = [];

  return () => {
    const points = object.points;
    const fragments = clipPolyline(
      points.map(point => point.position),
      bounds,
    );
    const result = fragments.map((fragment, index) => {
      let path = paths.at(index);

      if (!path) {
        path = createFragmentEntry(layer, object, fragment);
        paths.push(path);
      } else {
        path.update(fragment);
      }

      return path.entry;
    });

    // Temporary route symbols; materials/point interaction will replace this selection later.
    for (const point of points) {
      if (containsPosition(bounds, point.position)) {
        result.push(pointEntry(layer, point, object));
      }
    }

    return result;
  };
}

function createFragmentEntry(
  layer: MapLayer,
  object: MapRoute,
  initial: ClippedFragment,
): {
  entry: SceneObject;
  update(fragment: ClippedFragment): void;
} {
  let fragment = initial;
  const positionsFor = (): readonly Point[] =>
    Object.freeze(
      fragment.points.map((_, index) =>
        Object.freeze({
          get x(): number {
            return fragment.points.at(index)!.x;
          },
          get y(): number {
            return fragment.points.at(index)!.y;
          },
          get z(): number {
            return fragment.points.at(index)!.z ?? 0;
          },
        }),
      ),
    );
  let positions = positionsFor();
  const entry: SceneObject = Object.freeze({
    layer,
    object,
    geometry: Object.freeze({
      kind: 'polyline' as const,
      get points(): readonly Point[] {
        return positions;
      },
      get segments(): readonly ClippedSegment[] {
        return fragment.segments;
      },
    }),
  });

  return {
    entry,
    update(value): void {
      fragment = value;

      if (positions.length !== value.points.length) {
        positions = positionsFor();
      }
    },
  };
}
