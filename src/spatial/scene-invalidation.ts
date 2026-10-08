/** Internal mutation state, independent of view observation and public events. */
export interface SceneInvalidation {
  membership: boolean;
  readonly changed: Set<object>;
}

// Weak scene links let retained/shared runtime objects outlive their maps.
const SCENES = new WeakMap<object, Set<WeakRef<SceneInvalidation>>>();

export function trackScene(source: object, reference: WeakRef<SceneInvalidation>): void {
  let scenes = SCENES.get(source);

  if (!scenes) {
    scenes = new Set();
    SCENES.set(source, scenes);
  }

  for (const previous of scenes) {
    if (!previous.deref()) {
      scenes.delete(previous);
    }
  }

  scenes.add(reference);
}

export function untrackScene(source: object, reference: WeakRef<SceneInvalidation>): void {
  SCENES.get(source)?.delete(reference);
}

/** Called after state is committed, before any synchronous application handler. */
export function invalidateScenes(source: object, membership = false): void {
  const scenes = SCENES.get(source);

  if (!scenes) {
    return;
  }

  for (const reference of scenes) {
    const scene = reference.deref();

    if (!scene) {
      scenes.delete(reference);
      continue;
    }

    scene.membership ||= membership;
    scene.changed.add(source);
  }
}
