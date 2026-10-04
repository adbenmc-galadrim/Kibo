import { type ComponentFormat, type Instance, type Page, splitRef } from "@kibo/schema";
import { useCallback } from "react";
import { instanceFormat } from "../lib/format-grid";
import { findComponent } from "../registry";
import { useComponents } from "../state/use-components";
import { LayoutEditor, type LayoutEditorProps } from "./LayoutEditor";
import { shortcutFormats } from "./layout-draft";

function useFormatsFor(page: Pick<Page, "kind">): (instance: Instance) => ComponentFormat[] {
  const { components } = useComponents();
  return useCallback(
    (instance: Instance) => {
      const { id, version } = splitRef(instance.component);
      const manifest =
        findComponent(instance.component)?.manifest ??
        components?.find((c) => c.id === id && !c.builtin)?.versions.find((v) => v.version === version)
          ?.manifest;
      return manifest ? shortcutFormats(manifest) : [instanceFormat(instance, page)];
    },
    [components, page],
  );
}

export function EditLayout(props: Omit<LayoutEditorProps, "formatsFor">) {
  return <LayoutEditor {...props} formatsFor={useFormatsFor(props.page)} />;
}
