import { describe, expect, it, vi } from 'vitest';

import { Point } from '#math/point.js';
import { MapLine } from '#objects/map-line.js';
import { MapPoint } from '#objects/map-point.js';
import { MapRoute } from '#objects/map-route.js';

import { pointDefinition } from './fixtures.js';

describe('point positions and owner notifications', () => {
  it('copies input and updates position before notifying the point and its owner', () => {
    const definition = { kind: 'point' as const, id: 'vertex', position: { x: 10, y: 20 } };
    const route = new MapRoute('route', [definition]);
    const point = route.points[0]!;
    definition.position.x = 999;
    expect(point.position).toEqual(new Point(10, 20, 0));

    const routeChanged = vi.fn(() => point.position);
    const pointChanged = vi.fn(() => point.position);
    route.addEventListener('change', routeChanged);
    point.addEventListener('change', pointChanged);
    const position = new Point(30, 40);
    point.position = position;

    expect(point.position).toEqual(new Point(position.x, position.y, 0));
    expect(point.position).not.toBe(position);
    expect(point.id).toBe('vertex');
    expect(routeChanged).toHaveBeenCalledOnce();
    expect(routeChanged).toHaveReturnedWith(point.position);
    expect(pointChanged).toHaveBeenCalledOnce();
    expect(pointChanged).toHaveReturnedWith(point.position);
  });

  it.each([new Point(NaN, 10), new Point(10, Infinity), new Point(-Infinity, 10)])(
    'rejects non-finite positions without changing state or notifying the owner: %j',
    position => {
      const route = new MapRoute('route', [pointDefinition(10, 20)]);
      const point = route.points[0]!;
      const previous = point.position;
      const points = route.points;
      const routeChanged = vi.fn();
      const pointChanged = vi.fn();
      route.addEventListener('change', routeChanged);
      point.addEventListener('change', pointChanged);

      expect(() => {
        point.position = position;
      }).toThrow(expect.objectContaining({ name: 'AtlasError', code: 'INVALID_NUMBER' }));
      expect(point.position).toBe(previous);
      expect(route.points).toBe(points);
      expect(routeChanged).not.toHaveBeenCalled();
      expect(pointChanged).not.toHaveBeenCalled();

      point.position = new Point(50, 60);
      expect(routeChanged).toHaveBeenCalledOnce();
    },
  );

  it('forwards either line endpoint edit while retaining endpoint references and IDs', () => {
    const line = new MapLine('line', [
      pointDefinition(0, 0, 'start'),
      pointDefinition(100, 0, 'end'),
    ]);
    const points = line.points;
    const changed = vi.fn();
    line.addEventListener('change', changed);
    points[0].position = new Point(10, 20);
    points[1].position = new Point(110, 120);

    expect(line.points).toBe(points);
    expect(line.points[0]).toBe(points[0]);
    expect(line.points[1]).toBe(points[1]);
    expect(line.points.map(point => point.id)).toEqual(['start', 'end']);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('creates stable IDs for omitted IDs and preserves explicit opaque IDs', () => {
    const generated = new MapPoint(pointDefinition(0));
    const id = generated.id;
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
    generated.position = new Point(1, 2);
    expect(generated.id).toBe(id);
    expect(new MapPoint(pointDefinition(0, 0, ' explicit id ')).id).toBe(' explicit id ');
  });
});
