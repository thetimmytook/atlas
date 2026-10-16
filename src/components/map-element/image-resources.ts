import { AtlasMaterialError } from '#errors/atlas-material-error.js';

import type { ImageResourceId, ImageResourceDefinition } from '#definitions/material-definition.js';
import type { PreparedImage } from '#objects/map-materials.js';

export interface PreparedImages {
  readonly images: ReadonlyMap<ImageResourceId, PreparedImage>;
  release(): void;
}

/** Browser decoding is separate from map state and renderer-independent appearance resolution. */
export async function prepareImageResources(
  resources: Readonly<Record<ImageResourceId, ImageResourceDefinition>>,
): Promise<PreparedImages> {
  const controller = new AbortController();
  const urls = new Set<string>();

  const release = (): void => {
    controller.abort();
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
  };

  try {
    const entries = await Promise.all(
      Object.entries(resources).map(async ([resourceId, resource]) => {
        const image = await prepareResource(resourceId, resource.source, urls, controller.signal);

        return [resourceId, image] as const;
      }),
    );

    return { images: new Map(entries), release };
  } catch (cause) {
    release();
    throw cause;
  }
}

async function prepareResource(
  resourceId: ImageResourceId,
  source: string,
  urls: Set<string>,
  signal: AbortSignal,
): Promise<PreparedImage> {
  const details = { resourceId, source };
  let resolved: URL;

  try {
    resolved = new URL(source, document.baseURI);
  } catch (cause) {
    throw new AtlasMaterialError({ code: 'INVALID_IMAGE_RESOURCE', details, cause });
  }

  let bytes: ArrayBuffer;

  try {
    const response = await fetch(resolved, { signal });
    signal.throwIfAborted();

    if (!response.ok) {
      throw new Error('Image resource request failed.');
    }

    bytes = await response.arrayBuffer();
  } catch (cause) {
    throw new AtlasMaterialError({ code: 'IMAGE_RESOURCE_LOAD_FAILED', details, cause });
  }

  // A cancelled fetch/body implementation may still finish; never allocate its result.
  signal.throwIfAborted();
  const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8));
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (value, index) => signature.at(index) === value,
  );
  const svgSize = png ? undefined : readSvgSize(new TextDecoder().decode(bytes), details);
  const url = URL.createObjectURL(new Blob([bytes], { type: png ? 'image/png' : 'image/svg+xml' }));
  urls.add(url);
  const image = new Image();
  image.src = url;
  const cancelDecode = (): void => image.removeAttribute('src');
  signal.addEventListener('abort', cancelDecode, { once: true });

  try {
    await image.decode();
  } catch (cause) {
    throw new AtlasMaterialError({ code: 'IMAGE_RESOURCE_LOAD_FAILED', details, cause });
  } finally {
    signal.removeEventListener('abort', cancelDecode);
  }

  signal.throwIfAborted();
  const width = svgSize?.width ?? image.naturalWidth;
  const height = svgSize?.height ?? image.naturalHeight;

  if (!positive(width) || !positive(height)) {
    throw new AtlasMaterialError({ code: 'INVALID_IMAGE_RESOURCE', details });
  }

  return Object.freeze({ source: url, width, height });
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function readSvgSize(
  text: string,
  details: Readonly<Record<string, unknown>>,
): { width: number; height: number } {
  const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = xml.documentElement;

  if (
    root.localName !== 'svg' ||
    root.namespaceURI !== 'http://www.w3.org/2000/svg' ||
    xml.querySelector('parsererror')
  ) {
    throw new AtlasMaterialError({ code: 'INVALID_IMAGE_RESOURCE', details });
  }

  const dimension = (name: string): number | undefined => {
    const actual = root.getAttribute(name);

    if (actual === null) {
      return undefined;
    }

    const input = actual.trim();
    const unitless = input.endsWith('px') ? input.slice(0, -2).trim() : input;
    const numeric =
      unitless.startsWith('+') || unitless.startsWith('-') ? unitless.slice(1) : unitless;

    // eslint-disable-next-line security/detect-unsafe-regex -- Digit runs are separated by a literal dot or exponent; repeated runs do not overlap.
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric)) {
      return undefined;
    }

    const value = Number(unitless);

    if (!positive(value)) {
      throw new AtlasMaterialError({
        code: 'INVALID_IMAGE_RESOURCE',
        details: { ...details, field: name, actual },
      });
    }

    return value;
  };

  const box = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const validBox =
    box?.length === 4 && box.every(Number.isFinite) && positive(box[2]!) && positive(box[3]!);
  let width = dimension('width');
  let height = dimension('height');

  if (validBox) {
    if (width === undefined && height === undefined) {
      width = box[2];
      height = box[3];
    } else if (width === undefined) {
      width = (height! * box[2]!) / box[3]!;
    } else if (height === undefined) {
      height = (width * box[3]!) / box[2]!;
    }
  }

  if (width === undefined || height === undefined || !positive(width) || !positive(height)) {
    throw new AtlasMaterialError({ code: 'INVALID_IMAGE_RESOURCE', details });
  }

  return { width, height };
}
