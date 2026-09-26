import type { Instance } from "@kibo/schema";

export function instanceTitle(instance: Instance, componentTitle: string): string {
  const own = instance.config.title;
  return typeof own === "string" && own.trim() !== "" ? own.trim() : componentTitle;
}
