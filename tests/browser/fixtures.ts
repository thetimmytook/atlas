import { expect } from 'vitest';

import { Point } from '#math/point.js';
import { Size } from '#math/size.js';
import { createId } from '#objects/create-id.js';

import type { BackgroundDescription, MapDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';

export const BACKGROUND_SOURCE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="#eee" d="M0 0h2v2H0z"/></svg>',
  );

export const background: BackgroundDescription = {
  source: BACKGROUND_SOURCE,
  size: new Size(320, 240),
};

export function pointDefinition(x: number, y: number, id: string): MapPointDefinition {
  return { kind: 'point', id, position: new Point(x, y) };
}

export function mapDefinition(objects: NonNullable<MapDefinition['objects']> = []): MapDefinition {
  const roots = objects.map(object => ({ ...object, id: object.id ?? createId() }));

  return {
    layers: [{ id: 'content', background, objects: roots.map(object => object.id) }],
    objects: roots,
  };
}

export function svgGroups(surface: SVGSVGElement): SVGGElement[] {
  return Array.from(
    surface.querySelectorAll<SVGGElement>(':scope > g[data-layer-id] > g[data-object-id]'),
  );
}

export function shape<T extends SVGElement>(group: SVGGElement, tag: string): T {
  const element = group.querySelector<T>(tag);
  expect(element).not.toBeNull();

  return element!;
}

export function expectPoint(group: SVGGElement, x: number, y: number): void {
  expect(group.getAttribute('transform')).toBe('translate(' + x + ' ' + y + ')');
  expect(group.getAttribute('visibility')).toBeNull();
}

export function expectLine(group: SVGGElement, coordinates: readonly number[]): void {
  expect(group.getAttribute('visibility')).toBeNull();
  const line = shape<SVGLineElement>(group, 'line');
  expect(['x1', 'y1', 'x2', 'y2'].map(name => Number(line.getAttribute(name)))).toEqual(
    coordinates,
  );
}

export function expectPolyline(group: SVGGElement, points: string): void {
  expect(group.getAttribute('visibility')).toBeNull();
  expect(shape<SVGPolylineElement>(group, 'polyline').getAttribute('points')).toBe(points);
}

export function expectGroups(surface: SVGSVGElement, expected: readonly SVGGElement[]): void {
  const actual = svgGroups(surface);
  expect(actual).toHaveLength(expected.length);
  expected.forEach((node, index) => expect(actual.at(index)).toBe(node));
}

/** Capture primitives separately: retaining a group must also retain its surviving shape. */
export function captureShapes(surface: SVGSVGElement): ReadonlyMap<SVGGElement, Element | null> {
  return new Map(svgGroups(surface).map(group => [group, group.firstElementChild]));
}

export function expectSurvivingShapes(
  surface: SVGSVGElement,
  original: ReadonlyMap<SVGGElement, Element | null>,
): void {
  for (const group of svgGroups(surface)) {
    if (!original.has(group)) {
      continue;
    }

    expect(group.firstElementChild).toBe(original.get(group));
  }
}
