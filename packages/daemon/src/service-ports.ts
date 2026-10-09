import { KiboError, type KiboErrorCode } from "@kibo/schema";

export type PortSlot<T> = { get(): T | null; attach(port: T): () => void };

export function portSlot<T>(): PortSlot<T> {
  let current: T | null = null;
  return {
    get: () => current,
    attach(port) {
      current = port;
      return () => {
        current = null;
      };
    },
  };
}

export function ready<T>(port: T | null, code: KiboErrorCode, message: string): T {
  if (!port) throw new KiboError(code, message);
  return port;
}
