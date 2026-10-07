import type { MapEntryDefinition } from '#definitions/map-definition.js';
import type { MapPointDefinition } from '#definitions/map-point-definition.js';
import type { StressScene } from './stress.scene.js';

function moved(point: MapPointDefinition): MapPointDefinition {
  return { ...point, position: { x: point.position.x + 1, y: point.position.y + 1 } };
}

/** Oracle copied from input before timing; never read adapter/runtime state here. */
export function expectedDefinitions(scene: StressScene, scenario: string): MapEntryDefinition[] {
  const roots = scene.definition.objects!.map(root => structuredClone(root));
  const amount = Number(scenario.split('-').at(1));

  if (scenario.startsWith('add-')) {
    return roots.concat(structuredClone(scene.additions.slice(0, amount)));
  }

  if (scenario.startsWith('remove-')) {
    return roots.slice(amount);
  }

  if (scenario.startsWith('position-')) {
    return roots.map((root, index) => {
      if (index >= (scenario === 'position-single' ? 1 : 100)) {
        return root;
      }

      if (root.kind === 'point') {
        return moved(root);
      }

      const points = root.points.map((point, pointIndex) =>
        pointIndex === 0 ? moved(point) : point,
      );

      return root.kind === 'line'
        ? { ...root, points: [points[0]!, points[1]!] }
        : { ...root, points };
    });
  }

  if (scenario === 'route-update') {
    const firstRoute = roots.findIndex(root => root.kind === 'route');

    return roots.map((root, index) => {
      if (index !== firstRoute || root.kind !== 'route') {
        return root;
      }

      return {
        ...root,
        points: [
          root.points[0]!,
          { id: 'replacement-0', kind: 'point', position: { x: 60, y: 65 } },
          { id: 'replacement-1', kind: 'point', position: { x: 62, y: 67 } },
          root.points.at(-1)!,
        ],
      };
    });
  }

  return roots;
}
