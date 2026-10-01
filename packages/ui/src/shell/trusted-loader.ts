import { ComponentManifest, KiboError, trustedPath } from "@kibo/schema";
import type { ComponentType } from "react";

export type TrustedModule = { manifest: ComponentManifest; Component: ComponentType };
export type Importer = (url: string) => Promise<unknown>;
export type Exposer = () => Promise<void>;

const cache = new Map<string, Promise<TrustedModule>>();
const defaultImporter: Importer = (url) => import(/* @vite-ignore */ url);
const defaultExpose: Exposer = () => import("./shared-modules").then((m) => m.exposeSharedModules());

function linkCss(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const isComponent = (value: unknown): value is ComponentType => typeof value === "function";

async function load(
  id: string,
  version: string,
  hash: string,
  importer: Importer,
  expose: Exposer,
): Promise<TrustedModule> {
  await expose();
  const mod = await importer(trustedPath(id, version, hash, "ui.trusted.js"));
  if (typeof mod !== "object" || mod === null) {
    throw new KiboError("VALIDATION_FAILED", `${id}@${version} is not a module`);
  }
  const manifest = ComponentManifest.safeParse(Reflect.get(mod, "manifest"));
  const Component: unknown = Reflect.get(mod, "Component");
  if (!manifest.success || !isComponent(Component)) {
    throw new KiboError("VALIDATION_FAILED", `${id}@${version} does not export manifest and Component`);
  }
  if (manifest.data.id !== id || manifest.data.version !== version) {
    throw new KiboError(
      "VALIDATION_FAILED",
      `${id}@${version} declares ${manifest.data.id}@${manifest.data.version}`,
    );
  }
  linkCss(trustedPath(id, version, hash, "ui.css"));
  return { manifest: manifest.data, Component };
}

export function loadTrusted(
  id: string,
  version: string,
  hash: string,
  importer: Importer = defaultImporter,
  expose: Exposer = defaultExpose,
): Promise<TrustedModule> {
  const url = trustedPath(id, version, hash, "ui.trusted.js");
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = load(id, version, hash, importer, expose);
  cache.set(url, pending);
  pending.then(
    () => undefined,
    () => cache.delete(url),
  );
  return pending;
}
