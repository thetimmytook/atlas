import { resolveMapDefinition } from '#definitions/map-definition.js';
import { MapLayer } from '#objects/map-layer.js';
import { MapModel } from '#objects/map-model.js';
import { prepareSceneGeometry } from '#spatial/scene-geometry.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { MapObjectCollection, MapEntry } from '#objects/map-object-collection.js';
import type { SceneGeometry } from '#spatial/scene-geometry.js';

export function pointDefinition(x: number, y = 0, id?: string): MapPointDefinition {
  return { kind: 'point', position: { x, y }, ...(id === undefined ? {} : { id }) };
}

/** Test application explicitly assigns added roots to its single content layer. */
export function selectAddedRoots(objects: MapObjectCollection, layer: MapLayer): void {
  objects.addEventListener('add', event => {
    layer.objectIds.add((event as CustomEvent<MapEntry>).detail.id);
  });
}

export function objectScene(
  objects: MapObjectCollection,
  background?: BackgroundDescription,
): SceneGeometry {
  const layer = new MapLayer(
    {
      id: 'content',
      stackIndex: 0,
      objects: Array.from(objects, object => object.id),
      ...(background ? { background } : {}),
    },
    objects,
  );
  selectAddedRoots(objects, layer);

  return prepareSceneGeometry(objects, [layer]);
}

export function editableModel(): MapModel {
  const model = new MapModel(resolveMapDefinition({ layers: [{ id: 'content' }] }));
  selectAddedRoots(model.objects, model.layers[0]!);

  return model;
}
