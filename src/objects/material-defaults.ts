import { Point2 } from '#math/point2.js';

/** Internal appearance defaults shared by material resolution, browser layout and SVG. */
export const DEFAULTS = {
  point: { symbol: 'circle', color: '#2775d9', size: 22, pickable: true },
  routeOwnedPoint: { symbol: 'none', pickable: false },
  path: { color: '#d95012', width: 4 },
  polygon: { color: '#f59e0b', opacity: 0.3 },
  image: { preserveAspectRatio: true, anchor: new Point2(0.5, 0.5) },
  labelOutline: Object.freeze({
    color: '#ffffff',
    width: 3,
    lineJoin: 'round',
    paintOrder: 'stroke fill',
  }),
  label: {
    color: '#222222',
    font: Object.freeze({ size: '1rem', weight: 'normal' }),
    origin: 'bottom center',
    offset: Object.freeze({ x: '0px', y: '-1rem' }),
  },
} as const;
