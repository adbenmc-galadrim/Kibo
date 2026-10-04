import type { Instance } from "@kibo/schema";
import { createSignal, focusApi, NO_SELECTION, type Signal, visibilityApi } from "@kibo/sdk";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { type InstanceApis, instanceCapabilities, instanceSelects } from "../lib/instance-capabilities";
import { reportRefusal } from "../lib/report-refusal";
import { usePageContext } from "./PageContext";
import { useVisibility } from "./use-visibility";

function useSignalOf<T>(value: T): Signal<T> {
  const [signal] = useState(() => createSignal(value));
  useEffect(() => signal.set(value), [signal, value]);
  return signal;
}

export function useInstanceApis(
  projectId: string,
  instance: Instance,
  ref: RefObject<Element | null>,
): InstanceApis | null {
  const page = usePageContext();
  const components = page?.components ?? null;
  const { component } = instance;
  const capabilities = useMemo(
    () => instanceCapabilities({ component }, components),
    [component, components],
  );
  const selects = useMemo(() => instanceSelects({ component }, components), [component, components]);
  const bus = page?.bus;
  const dispatch = page?.dispatch;
  const focusedId = page?.focusedId ?? null;
  const visible = useVisibility(ref);
  const active = useSignalOf(focusedId === instance.id);
  const fullscreen = capabilities.includes("fullscreen");
  const id = instance.id;
  const focus = useMemo(
    () =>
      focusApi(active, (on) => {
        if (!fullscreen) reportRefusal(projectId, id, "focus");
        else dispatch?.(on ? { type: "request", id, allowed: true } : { type: "exit", id });
      }),
    [active, fullscreen, dispatch, projectId, id],
  );
  const visibility = useMemo(() => visibilityApi(visible), [visible]);
  const selection = useMemo(() => (bus ? bus.api(selects) : NO_SELECTION), [bus, selects]);
  const apis = useMemo(
    () => ({ capabilities, focus, visibility, selection }),
    [capabilities, focus, visibility, selection],
  );
  return components !== null ? apis : null;
}
