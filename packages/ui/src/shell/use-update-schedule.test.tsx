import { expect, mock, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";

const calls = { started: 0, stopped: 0 };
mock.module("../updates/use-update", () => ({
  startUpdateSchedule: () => {
    calls.started++;
    return () => calls.stopped++;
  },
}));
const { useUpdateSchedule } = await import("./use-update-schedule");

function Probe({ enabled }: { enabled: boolean }) {
  useUpdateSchedule(enabled);
  return null;
}

test("the schedule only starts in the desktop window, and stops on unmount", async () => {
  render(<Probe enabled={false} />);
  await new Promise((r) => setTimeout(r, 10));
  expect(calls.started).toBe(0);
  const { unmount } = render(<Probe enabled />);
  await waitFor(() => expect(calls.started).toBe(1));
  expect(calls.stopped).toBe(0);
  unmount();
  expect(calls.stopped).toBe(1);
});
