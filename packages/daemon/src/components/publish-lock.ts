import { KiboError } from "@kibo/schema";

export type PublishLock = {
  hold<T>(componentId: string, work: () => Promise<T>): Promise<T>;
  isHeld(componentId: string): boolean;
};

export function createPublishLock(): PublishLock {
  const held = new Set<string>();
  return {
    async hold(componentId, work) {
      if (held.has(componentId)) throw new KiboError("CONFLICT", `${componentId} is already being published`);
      held.add(componentId);
      try {
        return await work();
      } finally {
        held.delete(componentId);
      }
    },
    isHeld: (componentId) => held.has(componentId),
  };
}
