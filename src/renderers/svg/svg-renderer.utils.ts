import { AtlasError } from '#errors/atlas-error.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Geometry } from '#spatial/geometry.js';
import type { SceneObject, SceneSymbols } from '#spatial/scene-geometry.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type SvgShape = SVGCircleElement | SVGLineElement | SVGPolylineElement;

export interface SvgObject {
  readonly source: SceneObject;
  readonly element: SVGGElement;
  readonly shape: SvgShape;
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
  element.setAttribute('width', String(background.size.width));
  element.setAttribute('height', String(background.size.height));

  return element;
}

/** Translate a shared symbol into SVG without changing scene composition order. */
export function createObject(source: SceneObject, symbols: SceneSymbols): SvgObject {
  const { kind } = source.geometry;
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  group.setAttribute('class', `atlas-${kind}`);
  group.setAttribute('data-object-id', source.object.id);
  group.setAttribute('visibility', 'hidden');
  group.setAttribute('aria-hidden', 'true');

  const shape = createShape(kind, symbols);
  group.append(shape);

  return { source, element: group, shape };
}

/** Write map-space coordinates; camera scale does not affect this step. */
export function applyGeometry(element: SVGGElement, shape: SvgShape, geometry: Geometry): void {
  if (geometry.kind === 'point') {
    setChangedAttribute(
      element,
      'transform',
      `translate(${geometry.position.x} ${geometry.position.y})`,
    );

    return;
  }

  if (geometry.kind === 'polyline') {
    // A single vertex has no stroke; its optional point symbol is prepared separately.
    const points =
      geometry.points.length < 2
        ? ''
        : geometry.points.map(point => `${point.x},${point.y}`).join(' ');
    setChangedAttribute(shape, 'points', points);

    return;
  }

  setChangedAttribute(shape, 'x1', String(geometry.start.x));
  setChangedAttribute(shape, 'y1', String(geometry.start.y));
  setChangedAttribute(shape, 'x2', String(geometry.end.x));
  setChangedAttribute(shape, 'y2', String(geometry.end.y));
}

/** Dirty entries can still contain unchanged endpoint values or no-op position assignments. */
function setChangedAttribute(element: SVGElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** Compensate camera zoom on the point symbol, leaving map-space placement unchanged. */
export function applyScreenScale(shape: SvgShape, kind: Geometry['kind'], scale: number): void {
  if (kind !== 'point') {
    return;
  }

  shape.setAttribute('transform', `scale(${scale})`);
}

function createShape(kind: Geometry['kind'], symbols: SceneSymbols): SvgShape {
  if (kind !== 'point') {
    const line = document.createElementNS(SVG_NAMESPACE, kind);
    line.setAttribute('stroke-width', String(symbols.line.strokeWidth));
    line.setAttribute('stroke-linecap', symbols.line.lineCap);
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('fill', 'none');
    line.setAttribute('vector-effect', 'non-scaling-stroke');

    return line;
  }

  const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
  circle.setAttribute('r', String(symbols.point.radius));
  circle.setAttribute('stroke-width', String(symbols.point.strokeWidth));

  return circle;
}
