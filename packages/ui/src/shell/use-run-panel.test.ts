import { expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useRunPanel } from "./use-run-panel";

type Props = { projectId: string | null; agentOpen: boolean };

function setup(initial: Props = { projectId: "kibo", agentOpen: false }) {
  const closeAgent = mock(() => {});
  const hook = renderHook(
    ({ projectId, agentOpen }: Props) => useRunPanel(projectId, { open: agentOpen, close: closeAgent }),
    { initialProps: initial },
  );
  return { ...hook, closeAgent };
}

test("opening a run shows its panel and closes the project agent's panel", () => {
  const { result, closeAgent } = setup({ projectId: "kibo", agentOpen: true });
  act(() => result.current.open("r1"));
  expect(result.current.runId).toBe("r1");
  expect(closeAgent).toHaveBeenCalled();
  act(() => result.current.close());
  expect(result.current.runId).toBeNull();
});

test("opening the project agent's panel closes the run's panel", () => {
  const { result, rerender } = setup();
  act(() => result.current.open("r1"));
  rerender({ projectId: "kibo", agentOpen: true });
  expect(result.current.runId).toBeNull();
});

test("changing project closes the run's panel, staying in it does not", () => {
  const { result, rerender } = setup();
  act(() => result.current.open("r1"));
  rerender({ projectId: "kibo", agentOpen: false });
  expect(result.current.runId).toBe("r1");
  rerender({ projectId: "other", agentOpen: false });
  expect(result.current.runId).toBeNull();
  rerender({ projectId: "kibo", agentOpen: false });
  expect(result.current.runId).toBeNull();
});
