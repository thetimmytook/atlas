import { AtlasError } from '#errors/atlas-error.js';
import { DEFAULTS } from '#objects/material-defaults.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { Point2 } from '#math/point2.js';
import type { ResolvedAppearance } from '#objects/map-materials.js';
import type { Geometry } from '#spatial/geometry.js';
import type { ObjectLabel } from '#spatial/object-label.js';
import type { SceneObject } from '#spatial/scene-geometry.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type SvgShape =
  | SVGCircleElement
  | SVGLineElement
  | SVGPolylineElement
  | SVGPathElement
  | SVGImageElement
  | SVGGElement;

export interface SvgObject {
  source: SceneObject;
  readonly element: SVGGElement;
  shape: SvgShape;
  appearance: ResolvedAppearance;
  label?: SVGTextElement;
}

/** The text is the owner's next child, preserving geometry/label composition. */
export function applyLabel(
  object: SvgObject,
  label: ObjectLabel | undefined,
  position: Point2 | undefined,
  scale: number,
): void {
  if (!label || !position) {
    object.label?.remove();
    delete object.label;

    return;
  }

  if (!object.label) {
    const text = document.createElementNS(SVG_NAMESPACE, 'text');
    text.style.cssText =
      'writing-mode:horizontal-tb;white-space:pre;text-anchor:start;text-transform:none;font-style:normal;font-variant:normal;letter-spacing:normal;word-spacing:normal;';

    // Paint the halo first so it never covers the letter's fill or thin strokes.
    const outline = DEFAULTS.labelOutline;
    text.setAttribute('stroke', outline.color);
    text.setAttribute('stroke-width', String(outline.width));
    text.setAttribute('stroke-linejoin', outline.lineJoin);
    text.setAttribute('paint-order', outline.paintOrder);
    object.element.append(text);
    object.label = text;
  }

  const text = object.label;

  if (text.textContent !== label.text) {
    text.textContent = label.text;
  }

  setChangedAttribute(text, 'x', String(label.x));
  setChangedAttribute(text, 'y', String(label.y));
  setChangedAttribute(text, 'fill', label.color);
  setChangedAttribute(text, 'font-family', label.family);
  setChangedAttribute(text, 'font-size', String(label.size));
  setChangedAttribute(text, 'font-weight', label.weight);
  const placement =
    object.source.geometry.kind === 'point' ? '' : `translate(${position.x} ${position.y}) `;
  setChangedAttribute(text, 'transform', `${placement}scale(${scale})`);
}

/** Browser resource preparation stays outside the renderer-independent runtime. */
export async function prepareImage(
  background: BackgroundDescription,
  layerId: string,
): Promise<SVGImageElement> {
  const image = new Image();
  image.src = background.source;

  try {
    await image.decode();
  } catch (cause) {
    throw new AtlasError('Unable to load background.', {
      code: 'BACKGROUND_LOAD_FAILED',
      details: { source: background.source, layerId },
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
export function createObject(source: SceneObject, appearance: ResolvedAppearance): SvgObject {
  const { kind } = source.geometry;
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  group.setAttribute('class', `atlas-${kind}`);
  group.setAttribute('data-object-id', source.object.id);
  group.setAttribute('visibility', 'hidden');
  group.setAttribute('aria-hidden', 'true');

  const shape = createShape(kind, appearance);
  group.append(shape);
  const object = { source, element: group, shape, appearance };
  applyAppearance(object, appearance);

  return object;
}

/** A symbol switch replaces only the point's child; style edits keep its existing shape. */
export function applyAppearance(object: SvgObject, appearance: ResolvedAppearance): boolean {
  let replaced = false;

  if (appearance.kind === 'point') {
    const tag = pointShapeTag(appearance.symbol);

    if (object.shape.localName !== tag) {
      const shape = createShape('point', appearance);
      object.shape.replaceWith(shape);
      object.shape = shape;
      replaced = true;
    }

    if (appearance.symbol === 'circle') {
      setChangedAttribute(object.shape, 'r', String(appearance.size / 2));
      setChangedAttribute(object.shape, 'fill', appearance.color);
      setChangedAttribute(object.shape, 'stroke', 'none');
    } else if (appearance.image) {
      const image = appearance.image;
      setChangedAttribute(object.shape, 'href', image.source);
      setChangedAttribute(object.shape, 'x', String(image.x));
      setChangedAttribute(object.shape, 'y', String(image.y));
      setChangedAttribute(object.shape, 'width', String(image.width));
      setChangedAttribute(object.shape, 'height', String(image.height));
      setChangedAttribute(object.shape, 'preserveAspectRatio', 'none');
    }
  } else if (appearance.kind === 'polygon') {
    setChangedAttribute(object.shape, 'fill', appearance.color);
    setChangedAttribute(object.shape, 'fill-opacity', String(appearance.opacity));
  } else {
    setChangedAttribute(object.shape, 'stroke', appearance.color);
    setChangedAttribute(object.shape, 'stroke-width', String(appearance.width));
  }

  object.appearance = appearance;

  return replaced;
}

/** Write map-space coordinates; camera scale does not affect this step. */
export function applyGeometry(element: SVGGElement, shape: SvgShape, geometry: Geometry): void {
  if (geometry.kind === 'polygon') {
    const path = geometry.cells
      .map(cell => {
        const points = cell.map(point => `${point.x},${point.y}`).join('L');

        return `M${points}Z`;
      })
      .join('');
    setChangedAttribute(shape, 'd', path);

    return;
  }

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

  setChangedAttribute(shape, 'transform', `scale(${scale})`);
}

function createShape(kind: Geometry['kind'], appearance: ResolvedAppearance): SvgShape {
  if (kind === 'polygon') {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');

    path.setAttribute('fill-rule', 'nonzero');
    path.setAttribute('stroke', 'none');

    return path;
  }

  if (kind !== 'point') {
    const line = document.createElementNS(SVG_NAMESPACE, kind);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('fill', 'none');
    line.setAttribute('vector-effect', 'non-scaling-stroke');

    return line;
  }

  const symbol = appearance.kind === 'point' ? appearance.symbol : 'none';

  return document.createElementNS(SVG_NAMESPACE, pointShapeTag(symbol));
}

function pointShapeTag(symbol: 'circle' | 'image' | 'none'): 'circle' | 'image' | 'g' {
  if (symbol === 'none') {
    return 'g';
  }

  return symbol;
}
