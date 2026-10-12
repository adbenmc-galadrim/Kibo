import { KiboError } from "@kibo/schema";

export function stored<T>(parse: () => T, what: string): T {
  try {
    return parse();
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `${what}: ${String(e)}`);
  }
}
