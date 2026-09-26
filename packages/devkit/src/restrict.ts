import { KiboError } from "@kibo/schema";

const GLOBALS = ["fetch", "WebSocket", "XMLHttpRequest", "EventSource"] as const;
const BUN_CAPS = [
  "spawn",
  "spawnSync",
  "file",
  "write",
  "connect",
  "listen",
  "serve",
  "udpSocket",
  "$",
  "openInEditor",
] as const;
const PROCESS_CAPS = ["binding", "_linkedBinding", "dlopen", "getBuiltinModule", "kill", "chdir"] as const;

export const RESTRICTED = { globals: GLOBALS, bun: BUN_CAPS, process: PROCESS_CAPS } as const;

function lockedEmpty(current: PropertyDescriptor): PropertyDescriptor {
  if (current.configurable)
    return { value: undefined, writable: false, configurable: false, enumerable: false };
  return { value: undefined, writable: false };
}

function remove(target: object, name: string): void {
  const current = Reflect.getOwnPropertyDescriptor(target, name);
  if (current) Reflect.defineProperty(target, name, lockedEmpty(current));
  if (Reflect.get(target, name) !== undefined)
    throw new KiboError("INTERNAL", `cannot remove capability ${name}`);
}

export function restrictGlobals(opts: { freeze: boolean }): void {
  for (const name of GLOBALS) remove(globalThis, name);
  for (const name of BUN_CAPS) remove(Bun, name);
  for (const name of PROCESS_CAPS) remove(process, name);
  if (opts.freeze) Object.freeze(globalThis);
}
