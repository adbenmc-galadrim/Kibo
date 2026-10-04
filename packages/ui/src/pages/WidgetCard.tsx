import type { Instance } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import { createRef, useRef } from "react";
import { fr } from "../i18n/fr";
import { WIDGET_CARD } from "./DashboardGrid";
import { FOCUSED_CARD } from "./focus-mode";
import { InstanceFrame } from "./InstanceFrame";
import { useInstanceTitle } from "./InstanceMenu";
import { instanceTitle } from "./instance-title";
import { usePageContext } from "./PageContext";
import { useFocusedCard } from "./use-focused-card";
import { useInstanceApis } from "./use-instance-apis";
import { type BodyProps, WidgetBody, WidgetHeader } from "./WidgetHeader";

const FocusBar = lazyPanel(() => import("./FocusBar").then((m) => m.FocusBar), fr.lazy, {
  fallback: "sr-only",
});

export function WidgetCard(props: BodyProps & { editable: boolean }) {
  const { project, instance, editable } = props;
  const card = useRef<HTMLDivElement>(null);
  const apis = useInstanceApis(project.meta.id, instance, card);
  const focus = usePageContext();
  const title = instanceTitle(instance, useInstanceTitle(instance.component));
  const focused = focus !== null && focus.focusedId === instance.id;
  useFocusedCard(focused, card, focus?.dispatch);
  return (
    <div
      ref={card}
      className={focused ? FOCUSED_CARD : WIDGET_CARD}
      {...(focused && { role: "dialog", "aria-modal": true, "aria-label": title })}
    >
      {focused ? (
        <FocusBar instanceId={instance.id} title={title} dispatch={focus.dispatch} />
      ) : (
        <WidgetHeader
          projectId={project.meta.id}
          instance={instance}
          editable={editable}
          title={title}
          fullscreen={apis?.capabilities.includes("fullscreen") ?? false}
        />
      )}
      <WidgetBody {...props} apis={apis} />
    </div>
  );
}

const NO_ELEMENT = createRef<Element>();

export function ViewInstance({
  projectId,
  instance,
  viewer,
}: {
  projectId: string;
  instance: Instance;
  viewer: string;
}) {
  const apis = useInstanceApis(projectId, instance, NO_ELEMENT);
  if (!apis) return null;
  return (
    <InstanceFrame
      projectId={projectId}
      instance={instance}
      viewer={viewer}
      surface="view"
      format="full"
      apis={apis}
    />
  );
}
