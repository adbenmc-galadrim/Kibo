import {
  type ComponentFormat,
  type ComponentManifest,
  DEFAULT_SIZE_LIMITS,
  type Instance,
  type Layout,
  type ProjectSnapshot,
  type SizeLimits,
  sizeLimitsOf,
  splitRef,
} from "@kibo/schema";
import { useCallback, useRef } from "react";
import { instanceFormat } from "../lib/format-grid";
import { findComponent } from "../registry";
import { useComponents } from "../state/use-components";
import { LayoutEditor, type LayoutEditorProps } from "./LayoutEditor";
import { shortcutFormats } from "./layout-draft";
import { useInstanceApis } from "./use-instance-apis";
import { type BodyProps, WidgetBody } from "./WidgetHeader";

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

function LayoutWidgetBody(props: BodyProps) {
  const container = useRef<HTMLDivElement>(null);
  const apis = useInstanceApis(props.project.meta.id, props.instance, container);
  return <WidgetBody {...props} apis={apis} containerRef={container} />;
}

type Props = Omit<LayoutEditorProps, "formatsFor" | "limitsFor" | "renderWidget"> & {
  project: ProjectSnapshot;
  viewer: string;
};

export function EditLayout({ project, viewer, ...props }: Props) {
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
  const renderWidget = (instance: Instance, layout: Layout) => (
    <LayoutWidgetBody project={project} page={page} instance={instance} layout={layout} viewer={viewer} />
  );
  return (
    <LayoutEditor {...props} formatsFor={formatsFor} limitsFor={limitsFor} renderWidget={renderWidget} />
  );
}
