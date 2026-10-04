import {
  type ComponentFormat,
  type ComponentManifest,
  DEFAULT_SIZE_LIMITS,
  type Instance,
  type SizeLimits,
  sizeLimitsOf,
  splitRef,
} from "@kibo/schema";
import { useCallback } from "react";
import { instanceFormat } from "../lib/format-grid";
import { findComponent } from "../registry";
import { useComponents } from "../state/use-components";
import { LayoutEditor, type LayoutEditorProps } from "./LayoutEditor";
import { shortcutFormats } from "./layout-draft";

function useManifestOf(): (instance: Instance) => ComponentManifest | null | undefined {
  const { components } = useComponents();
  return useCallback(
    (instance: Instance) => {
      const { id, version } = splitRef(instance.component);
      return (
        findComponent(instance.component)?.manifest ??
        components?.find((c) => c.id === id && !c.builtin)?.versions.find((v) => v.version === version)
          ?.manifest
      );
    },
    [components],
  );
}

export function EditLayout(props: Omit<LayoutEditorProps, "formatsFor" | "limitsFor">) {
  const manifestOf = useManifestOf();
  const { page } = props;
  const formatsFor = useCallback(
    (instance: Instance): ComponentFormat[] => {
      const manifest = manifestOf(instance);
      return manifest ? shortcutFormats(manifest) : [instanceFormat(instance, page)];
    },
    [manifestOf, page],
  );
  const limitsFor = useCallback(
    (instance: Instance): SizeLimits => {
      const manifest = manifestOf(instance);
      return manifest ? sizeLimitsOf(manifest) : DEFAULT_SIZE_LIMITS;
    },
    [manifestOf],
  );
  return <LayoutEditor {...props} formatsFor={formatsFor} limitsFor={limitsFor} />;
}
