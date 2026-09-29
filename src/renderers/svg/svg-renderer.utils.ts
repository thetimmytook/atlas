import { AtlasError } from '#errors/atlas-error.js';

import type { BackgroundDescription } from '#definitions/map-definition.js';
import type { AtlasObject } from '#objects/atlas-object.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Temporary appearance defaults; replace with values from the resolved point material.
const DEFAULT_POINT_SIZE = 24;
const DEFAULT_POINT_STROKE_WIDTH = 2;

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

/** Temporary point symbol; replace with geometry material resolution and rendering. */
export function createPoint(object: AtlasObject): SVGGElement {
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  group.setAttribute('class', 'atlas-point');
  group.setAttribute('data-object-id', object.id);
  group.setAttribute('visibility', 'hidden');
  group.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
  circle.setAttribute('r', String((DEFAULT_POINT_SIZE - DEFAULT_POINT_STROKE_WIDTH) / 2));
  circle.setAttribute('stroke-width', String(DEFAULT_POINT_STROKE_WIDTH));
  group.append(circle);

  return group;
}
