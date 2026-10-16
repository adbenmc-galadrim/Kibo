import {
  type AssetUrl,
  type ComponentCall,
  type ComponentManifest,
  capPermission,
  type DesignFrame,
  type EmbedView,
  type ProjectAsset,
  type StorybookOrigin,
} from "@kibo/schema";
import type { AssetsApi, DesignApi, EmbedApi } from "./types";

type Guard = { deny(what: string): never };
type Call = <T>(c: ComponentCall) => Promise<T>;

export function assetsApi(manifest: ComponentManifest, guard: Guard, call: Call): AssetsApi {
  const need = () => {
    if (!manifest.capabilities.includes("assets")) guard.deny(capPermission("assets"));
  };
  return {
    async list() {
      need();
      return call<ProjectAsset[]>({ kind: "assets.list" });
    },
    async url(name) {
      need();
      return call<AssetUrl>({ kind: "assets.url", name });
    },
  };
}

export function designApi(manifest: ComponentManifest, guard: Guard, call: Call): DesignApi {
  const need = () => {
    if (!manifest.capabilities.includes("design")) guard.deny(capPermission("design"));
  };
  return {
    async frame(url, opts = {}) {
      need();
      return call<DesignFrame>({ kind: "design.frame", url, refresh: opts.refresh ?? false });
    },
    async storybooks() {
      need();
      return call<StorybookOrigin[]>({ kind: "design.storybooks" });
    },
  };
}

export function embedApi(manifest: ComponentManifest, guard: Guard, call: Call): EmbedApi {
  return {
    async open(url) {
      if (!manifest.capabilities.includes("embed")) guard.deny(capPermission("embed"));
      return call<EmbedView>({ kind: "embed.open", url });
    },
  };
}
