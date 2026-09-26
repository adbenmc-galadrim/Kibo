import { KiboError } from "@kibo/schema";
import type { z } from "zod";
import type { Store } from "./store";

export type LocalSettings = {
  get<T>(key: string, schema: z.ZodType<T>, fallback: T): T;
  set(key: string, value: unknown): void;
};

const PREFIX = "setting:";

export function openLocalSettings(store: Pick<Store, "getLocal" | "setLocal">): LocalSettings {
  return {
    get(key, schema, fallback) {
      const raw = store.getLocal(PREFIX + key);
      if (raw === null) return fallback;
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        throw new KiboError("STORE_CORRUPT", `setting ${key} is not valid JSON: ${String(e)}`);
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success)
        throw new KiboError("STORE_CORRUPT", `setting ${key} is invalid: ${parsed.error.message}`);
      return parsed.data;
    },
    set(key, value) {
      store.setLocal(PREFIX + key, JSON.stringify(value));
    },
  };
}
