import {
  type ComponentFormat,
  DEFAULT_SIZE_LIMITS,
  type Instance,
  type Layout,
  type ProjectSnapshot,
  type SizeLimits,
  sizeLimitsOf,
} from "@kibo/schema";
import { useCallback, useRef } from "react";
import { instanceFormat } from "../lib/format-grid";
import { manifestOf } from "../lib/instance-capabilities";
import { LayoutEditor, type LayoutEditorProps } from "./LayoutEditor";
import { shortcutFormats } from "./layout-draft";
import { useInstanceApis } from "./use-instance-apis";
import { type BodyProps, WidgetBody } from "./WidgetHeader";

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
  const { page } = props;
  const formatsFor = useCallback(
    (instance: Instance): ComponentFormat[] => {
      const manifest = manifestOf(instance);
      return manifest ? shortcutFormats(manifest) : [instanceFormat(instance, page)];
    },
    [page],
  );
  const limitsFor = useCallback((instance: Instance): SizeLimits => {
    const manifest = manifestOf(instance);
    return manifest ? sizeLimitsOf(manifest) : DEFAULT_SIZE_LIMITS;
  }, []);
  const renderWidget = (instance: Instance, layout: Layout) => (
    <LayoutWidgetBody project={project} page={page} instance={instance} layout={layout} viewer={viewer} />
  );
  return (
    <LayoutEditor {...props} formatsFor={formatsFor} limitsFor={limitsFor} renderWidget={renderWidget} />
  );
}
