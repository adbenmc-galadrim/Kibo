import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { type Host, HostProvider } from "../shell/Host";
import { useOpenSignal } from "./use-open-signal";

const noop = () => undefined;

function rig(projectId: string | null) {
  let opened = 0;
  const host: Host = {
    openTicket: noop,
    openNewTicket: noop,
    openAssign: noop,
    openFile: noop,
    openView: noop,
    openTarget: noop,
    projectId,
    openProjectAgent: () => {
      opened += 1;
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HostProvider host={host}>{children}</HostProvider>
  );
  return { opened: () => opened, wrapper };
}

test("a signal of the open project opens its project agent conversation", () => {
  const { opened, wrapper } = rig("p1");
  const { result } = renderHook(() => useOpenSignal("p1"), { wrapper });
  result.current?.("s1");
  expect(opened()).toBe(1);
});

test("a signal sent from another project is not clickable", () => {
  const { wrapper } = rig("p1");
  expect(renderHook(() => useOpenSignal("p2"), { wrapper }).result.current).toBeUndefined();
  expect(renderHook(() => useOpenSignal(null), { wrapper }).result.current).toBeUndefined();
});

test("without a host the signal line is not clickable", () => {
  expect(renderHook(() => useOpenSignal("p1")).result.current).toBeUndefined();
});
