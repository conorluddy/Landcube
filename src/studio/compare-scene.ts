import type { CompareScene } from './wipe-compare';

export interface CompareSceneStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CompareScene | undefined;
  publish: (scene: CompareScene) => void;
}

/** The last viewport scene (contours and friends), published by the 2D render for side B of the wipe. */
export function createCompareSceneStore(): CompareSceneStore {
  let scene: CompareScene | undefined;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => scene,
    publish(next) {
      scene = next;

      for (const listener of listeners) {
        listener();
      }
    },
  };
}
