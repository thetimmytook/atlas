import { MapElement } from '#components/map-element/map-element.js';
import { Point2 } from '#math/point2.js';

import type { MapSurfaceEvent } from '#interaction/map-surface-event.js';
import type { ObjectClickEvent } from '#interaction/object-click-event.js';

interface RecordedSurfaceEvent {
  type: string;
  isClick: boolean | undefined;
  keys: string[];
}

interface RecordedInput {
  type: string;
  pointerId: number;
  pointerType: string;
  trusted: boolean;
}

declare global {
  interface Window {
    cameraInput: {
      map: MapElement;
      surface: SVGSVGElement;
      events: RecordedSurfaceEvent[];
      clicks: { id: string; sameObject: boolean; layerId: string }[];
      inputs: RecordedInput[];
    };
  }
}

customElements.define('atlas-input-test', MapElement);
const map = document.createElement('atlas-input-test') as MapElement;
document.body.append(map);
const surface = map.shadowRoot!.querySelector('svg')!;
const events: RecordedSurfaceEvent[] = [];
const clicks: Window['cameraInput']['clicks'] = [];
const inputs: RecordedInput[] = [];

for (const type of ['press', 'release']) {
  map.addEventListener(type, event => {
    const { detail } = event as MapSurfaceEvent;
    events.push({
      type,
      isClick: detail.isClick,
      keys: Object.keys(detail).sort((first, second) => first.localeCompare(second)),
    });
  });
}

map.addEventListener('objectclick', event => {
  const { detail } = event as ObjectClickEvent;
  clicks.push({
    id: detail.object.id,
    sameObject: detail.object === map.objects.get('target'),
    layerId: detail.layer.id,
  });
});

for (const type of [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'lostpointercapture',
]) {
  surface.addEventListener(type, event => {
    const pointer = event as PointerEvent;
    inputs.push({
      type,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType,
      trusted: pointer.isTrusted,
    });
  });
}

await map.load({
  layers: [{ id: 'content', objects: ['target'] }],
  objects: [{ id: 'target', kind: 'point', position: { x: 440, y: 240 } }],
});
map.camera.center = new Point2(320, 240);
window.cameraInput = { map, surface, events, clicks, inputs };
