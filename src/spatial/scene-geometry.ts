import type { MapObject } from '#objects/map-object.js';

/** Circle dimensions in viewport CSS pixels, shared by rendering and spatial queries. */
export interface PointSymbol {
  readonly radius: number;
  readonly strokeWidth: number;
}

/** Screen-sized stroke; round caps also define the segment's picking boundary. */
export interface LineSymbol {
  readonly strokeWidth: number;
  readonly lineCap: 'round';
}

export interface SceneSymbols {
  readonly point: PointSymbol;
  readonly line: LineSymbol;
}

export interface SceneGeometry {
  readonly objects: readonly MapObject[];
  readonly symbols: SceneSymbols;
}

// Temporary shared defaults; replace with per-object symbols derived from resolved materials.
const defaultSymbols: SceneSymbols = Object.freeze({
  point: Object.freeze({ radius: 11, strokeWidth: 2 }),
  line: Object.freeze({ strokeWidth: 4, lineCap: 'round' }),
});

/** Prepare shared geometry descriptions once; positions remain owned by runtime objects. */
export function prepareSceneGeometry(objects: Iterable<MapObject>): SceneGeometry {
  return Object.freeze({
    objects: Object.freeze(Array.from(objects)),
    symbols: defaultSymbols,
  });
}
