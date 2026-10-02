import type { AtlasObject } from '#objects/atlas-object.js';

/** Circle dimensions in viewport CSS pixels, shared by rendering and spatial queries. */
export interface PointSymbol {
  readonly radius: number;
  readonly strokeWidth: number;
}

export interface ScenePoint {
  readonly object: AtlasObject;
  readonly symbol: PointSymbol;
}

export interface SceneGeometry {
  readonly points: readonly ScenePoint[];
}

// Temporary circle symbol; replace with geometry derived from the resolved point material.
const defaultPointSymbol: PointSymbol = Object.freeze({ radius: 11, strokeWidth: 2 });

/** Prepare shared geometry descriptions once; positions remain owned by runtime objects. */
export function prepareSceneGeometry(objects: Iterable<AtlasObject>): SceneGeometry {
  return Object.freeze({
    points: Object.freeze(
      Array.from(objects, object => Object.freeze({ object, symbol: defaultPointSymbol })),
    ),
  });
}
