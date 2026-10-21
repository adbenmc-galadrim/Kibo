import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useOutbox } from "./use-outbox";

test("a double click on Réessayer sends the failed message only once more", async () => {
  const sent: string[] = [];
  let fail = true;
  const deliver = (text: string) => {
    sent.push(text);
    return fail ? Promise.reject(new Error("boom")) : new Promise<void>(() => {});
  };
  const { result } = renderHook(() => useOutbox(deliver, []));
  await act(async () => result.current.send("Et F5 ?"));
  const failed = result.current.outbox[0];
  expect(failed).toMatchObject({ text: "Et F5 ?", state: "failed" });
  fail = false;
  act(() => {
    result.current.retry(failed?.id ?? "");
    result.current.retry(failed?.id ?? "");
  });
  expect(sent).toEqual(["Et F5 ?", "Et F5 ?"]);
  expect(result.current.outbox).toMatchObject([{ text: "Et F5 ?", state: "sending" }]);
});
