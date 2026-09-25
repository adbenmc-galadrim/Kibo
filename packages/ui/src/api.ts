import { createClient } from "@kibo/sdk";

const unauthorizedListeners = new Set<() => void>();

export const client = createClient({
  baseUrl: "",
  onUnauthorized: () => {
    for (const l of unauthorizedListeners) l();
  },
});

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}
