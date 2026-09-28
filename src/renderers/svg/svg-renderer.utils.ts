import { AtlasError } from '../../errors/atlas-error.js';

import type { BackgroundDescription } from '../../definitions/map-definition.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

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
