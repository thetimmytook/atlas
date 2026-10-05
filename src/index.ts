export { MapElement } from './components/map-element/map-element.js';

export type {
  MapDefinition,
  ResolvedMapDefinition,
  BackgroundDescription,
  MapEntryDefinition,
} from './definitions/map-definition.js';
export type { MapRouteDefinition } from './definitions/map-route-definition.js';
export type { MapPointDefinition } from './definitions/map-point-definition.js';
export type { WithId } from './definitions/identity.js';

export { AtlasError } from './errors/atlas-error.js';
export type { AtlasErrorOptions } from './errors/atlas-error.js';

export { Camera } from './camera/camera.js';

export { Point } from './math/point.js';
export { Rect } from './math/rect.js';
export { Size } from './math/size.js';

export type { MapCoordinates } from './interaction/map-coordinates.js';

export { createId } from '#objects/create-id.js';
export { MapObject } from '#objects/map-object.js';
export { MapLine } from '#objects/map-line.js';
export type { MapObjectCollection, MapEntry } from '#objects/map-object-collection.js';
export { MapRoute } from '#objects/map-route.js';
export { MapPoint } from '#objects/map-point.js';
export type { MapObjectDefinition } from '#definitions/map-object-definition.js';
export type { MapLineDefinition } from '#definitions/map-line-definition.js';

export { ObjectClickEvent } from '#interaction/object-click-event.js';
export type { ObjectClickDetail } from '#interaction/object-click-event.js';

export { MapSurfaceEvent } from '#interaction/map-surface-event.js';
export type { ClickTrigger, MapSurfaceDetail } from '#interaction/map-surface-event.js';
