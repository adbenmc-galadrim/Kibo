import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { type Host, HostProvider } from "../shell/Host";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";
import { useOpenSignal } from "./use-open-signal";

const noop = () => undefined;

function rig(projectId: string | null) {
  const opened: ProjectAgentTab[] = [];
  const host: Host = {
    openTicket: noop,
    openNewTicket: noop,
    openAssign: noop,
    openFile: noop,
    openView: noop,
    openTarget: noop,
    projectId,
    openProjectAgent: ({ tab }) => opened.push(tab),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HostProvider host={host}>{children}</HostProvider>
  );
  return { opened, wrapper };
}

test("a signal of the open project opens its project agent on the signals tab", () => {
  const { opened, wrapper } = rig("p1");
  const { result } = renderHook(() => useOpenSignal("p1"), { wrapper });
  result.current?.("s1");
  expect(opened).toEqual(["signals"]);
});

test("a signal sent from another project is not clickable", () => {
  const { wrapper } = rig("p1");
  expect(renderHook(() => useOpenSignal("p2"), { wrapper }).result.current).toBeUndefined();
  expect(renderHook(() => useOpenSignal(null), { wrapper }).result.current).toBeUndefined();
});

test("without a host the signal line is not clickable", () => {
  expect(renderHook(() => useOpenSignal("p1")).result.current).toBeUndefined();
});
