import { AtlasError } from '#errors/atlas-error.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { ObjectGeometry } from '#definitions/object-definition.js';
import type { AtlasObject } from '#objects/atlas-object.js';
import type { SceneSymbols } from '#spatial/scene-geometry.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export interface SvgObject {
  readonly object: AtlasObject;
  readonly element: SVGGElement;
  readonly shape: SVGCircleElement | SVGLineElement;
}

/** Browser resource preparation stays outside the renderer-independent runtime. */
export async function prepareImage(background: BackgroundDescription): Promise<SVGImageElement> {
  const image = new Image();
  image.src = background.source;

  try {
    await image.decode();
  } catch (cause) {
    throw new AtlasError('Unable to load background.', {
      code: 'BACKGROUND_LOAD_FAILED',
      details: { source: background.source },
      cause,
    });
  }

  const element = document.createElementNS(SVG_NAMESPACE, 'image');
  element.setAttribute('href', image.src);
  element.setAttribute('width', String(background.width));
  element.setAttribute('height', String(background.height));

  return element;
}

/** Translate a shared symbol into SVG without changing scene composition order. */
export function createObject(object: AtlasObject, symbols: SceneSymbols): SvgObject {
  const { kind } = object.geometry;
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  group.setAttribute('class', `atlas-${kind}`);
  group.setAttribute('data-object-id', object.id);
  group.setAttribute('visibility', 'hidden');
  group.setAttribute('aria-hidden', 'true');

  const shape = createShape(kind, symbols);
  group.append(shape);

  return { object, element: group, shape };
}

/** Write map-space coordinates; camera scale does not affect this step. */
export function applyGeometry(
  element: SVGGElement,
  shape: SVGCircleElement | SVGLineElement,
  geometry: ObjectGeometry,
): void {
  if (geometry.kind === 'point') {
    element.setAttribute('transform', `translate(${geometry.position.x} ${geometry.position.y})`);

    return;
  }

  shape.setAttribute('x1', String(geometry.start.x));
  shape.setAttribute('y1', String(geometry.start.y));
  shape.setAttribute('x2', String(geometry.end.x));
  shape.setAttribute('y2', String(geometry.end.y));
}

/** Compensate camera zoom on the point symbol, leaving map-space placement unchanged. */
export function applyScreenScale(
  shape: SVGCircleElement | SVGLineElement,
  kind: ObjectGeometry['kind'],
  scale: number,
): void {
  if (kind !== 'point') {
    return;
  }

  shape.setAttribute('transform', `scale(${scale})`);
}

function createShape(
  kind: ObjectGeometry['kind'],
  symbols: SceneSymbols,
): SVGCircleElement | SVGLineElement {
  if (kind === 'line') {
    const line = document.createElementNS(SVG_NAMESPACE, 'line');
    line.setAttribute('stroke-width', String(symbols.line.strokeWidth));
    line.setAttribute('stroke-linecap', symbols.line.lineCap);
    line.setAttribute('vector-effect', 'non-scaling-stroke');

    return line;
  }

  const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
  circle.setAttribute('r', String(symbols.point.radius));
  circle.setAttribute('stroke-width', String(symbols.point.strokeWidth));

  return circle;
}
