import { describe, expect, it } from 'vitest';

import { Point2 } from '#math/point2.js';
import { orientation } from '#math/polygon.js';

describe('polygon orientation fallback', () => {
  it.each([1, 2 ** 600, 2 ** -600, Number.MIN_VALUE])(
    'preserves collinearity and winding at scale %s',
    scale => {
      const origin = new Point2(0, 0);
      const edge = new Point2(scale, 33 * scale);
      const collinear = new Point2(6 * scale, 198 * scale);
      expect(orientation(origin, edge, collinear)).toBe(0);
      expect(orientation(edge, collinear, origin)).toBe(0);
      expect(orientation(collinear, edge, origin)).toBe(0);
      const offset = new Point2(6 * scale, 199 * scale);
      expect(orientation(origin, edge, offset)).toBe(1);
      expect(orientation(origin, offset, edge)).toBe(-1);
    },
  );

  it('preserves the sign when products underflow at the smallest finite coordinate', () => {
    expect(
      orientation(
        new Point2(0, 0),
        new Point2(Number.MIN_VALUE, 0),
        new Point2(0, Number.MIN_VALUE),
      ),
    ).toBe(1);
  });

  it('keeps the scale finite when differences overflow at the largest finite coordinates', () => {
    const origin = new Point2(-Number.MAX_VALUE, -Number.MAX_VALUE);
    const edge = new Point2(Number.MAX_VALUE, Number.MAX_VALUE);
    expect(orientation(origin, edge, new Point2(0, 0))).toBe(0);
    expect(orientation(origin, edge, new Point2(-Number.MAX_VALUE, Number.MAX_VALUE))).toBe(1);
    expect(orientation(edge, origin, new Point2(-Number.MAX_VALUE, Number.MAX_VALUE))).toBe(-1);
  });
});
