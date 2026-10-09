import { describe, expect, it, vi } from 'vitest';

import { Camera } from '#camera/camera.js';
import { Point2 } from '#math/point2.js';
import { Point3 } from '#math/point3.js';
import { Rect } from '#math/rect.js';
import { Size } from '#math/size.js';

describe('camera state, bounds and fitting', () => {
  it('resizes the viewport while preserving center and zoom and previously retained values', () => {
    const camera = new Camera();
    camera.resize(new Size(800, 600));
    camera.center = new Point3(100, 200, 6);
    camera.zoom = 2;
    const center = camera.center;
    expect(center).toBeInstanceOf(Point2);
    expect(center).toEqual({ x: 100, y: 200 });
    const viewport = camera.viewport;
    const bounds = camera.bounds;
    const changed = vi.fn(() => camera.bounds);
    camera.addEventListener('change', changed);
    camera.resize(new Size(400, 200));

    expect(camera.center).toBe(center);
    expect(camera.zoom).toBe(2);
    expect(camera.viewport).toEqual(new Size(400, 200));
    expect(camera.bounds).toEqual(new Rect(0, 150, 200, 100));
    expect(viewport).toEqual(new Size(800, 600));
    expect(bounds).toEqual(new Rect(-100, 50, 400, 300));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveReturnedWith(camera.bounds);
  });

  it.each([
    { viewport: new Size(800, 600), bounds: new Rect(10, 20, 400, 200), zoom: 2 },
    { viewport: new Size(600, 800), bounds: new Rect(-50, -100, 100, 400), zoom: 2 },
  ])('fits both dimensions without stretching for %j', ({ viewport, bounds, zoom }) => {
    const camera = new Camera();
    camera.resize(viewport);
    camera.fit(bounds);
    expect(camera.center).toEqual(
      new Point2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
    );
    expect(camera.zoom).toBe(zoom);
    const fitted = camera.bounds;
    expect(fitted.x).toBeLessThanOrEqual(bounds.x);
    expect(fitted.y).toBeLessThanOrEqual(bounds.y);
    expect(fitted.x + fitted.width).toBeGreaterThanOrEqual(bounds.x + bounds.width);
    expect(fitted.y + fitted.height).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  });

  it('applies a fit deferred at zero size at the first viewport with both dimensions nonzero', () => {
    const camera = new Camera();
    camera.zoom = 3;
    camera.fit(new Rect(10, 20, 200, 100));
    expect(camera.center).toEqual(new Point2(110, 70));
    expect(camera.zoom).toBe(3);
    camera.resize(new Size(400, 0));
    expect(camera.zoom).toBe(3);
    camera.resize(new Size(400, 300));
    expect(camera.zoom).toBe(2);
    camera.resize(new Size(800, 600));
    expect(camera.zoom).toBe(2);
    expect(camera.center).toEqual(new Point2(110, 70));
  });

  it.each(['center', 'zoom'] as const)('an explicit %s change cancels the deferred fit', field => {
    const camera = new Camera();
    camera.fit(new Rect(10, 20, 200, 100));

    if (field === 'center') {
      camera.center = new Point2(30, 40);
    } else {
      camera.zoom = 3;
    }

    const center = camera.center;
    const zoom = camera.zoom;
    camera.resize(new Size(400, 300));
    expect(camera.center).toBe(center);
    expect(camera.zoom).toBe(zoom);
  });

  it.each([0, -1, NaN, Infinity])('rejects zoom %s without changing state or dispatching', zoom => {
    const camera = new Camera();
    camera.center = new Point2(30, 40);
    camera.zoom = 2;
    const center = camera.center;
    const changed = vi.fn();
    camera.addEventListener('change', changed);
    expect(() => {
      camera.zoom = zoom;
    }).toThrow(expect.objectContaining({ code: 'INVALID_NUMBER' }));
    expect(camera.zoom).toBe(2);
    expect(camera.center).toBe(center);
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'center',
      apply: (camera: Camera): void => {
        camera.center = new Point2(10, NaN);
      },
    },
    {
      name: 'resize',
      apply: (camera: Camera): void => {
        camera.resize(new Size(100, -1));
      },
    },
    {
      name: 'fit position',
      apply: (camera: Camera): void => {
        camera.fit(new Rect(Infinity, 0, 100, 100));
      },
    },
    {
      name: 'fit size',
      apply: (camera: Camera): void => {
        camera.fit(new Rect(100, 100, 0, 100));
      },
    },
  ])('rejects invalid $name atomically and keeps a pending fit intact', ({ apply }) => {
    const camera = new Camera();
    camera.fit(new Rect(10, 20, 200, 100));
    const center = camera.center;
    const viewport = camera.viewport;
    const changed = vi.fn();
    camera.addEventListener('change', changed);
    expect(() => apply(camera)).toThrow();
    expect(camera.center).toBe(center);
    expect(camera.viewport).toBe(viewport);
    expect(camera.zoom).toBe(1);
    expect(changed).not.toHaveBeenCalled();
    camera.resize(new Size(400, 300));
    expect(camera.center).toEqual(new Point2(110, 70));
    expect(camera.zoom).toBe(2);
  });
});
