import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type SaveResult, type Topic } from "@kibo/schema";
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

const listeners = new Map<Topic, () => void>();
mock.module("../api", () =>
  apiMock({
    client: {
      subscribeTopic: (topic: Topic, listener: () => void) => {
        listeners.set(topic, listener);
        return () => listeners.delete(topic);
      },
    },
  }),
);

const { useFileEditor } = await import("./use-file-editor");

type Saved = SaveResult<{ hash: string }>;
let disk = { content: "# Spec\n", hash: "h1" };
let saves: { content: string; baseHash: string | null }[] = [];
let answer: (content: string, baseHash: string | null) => Promise<Saved> = (content) =>
  Promise.resolve({ ok: true, value: { hash: `h-${content.length}` } });

const read = () => Promise.resolve(disk);
const save = (content: string, baseHash: string | null) => {
  saves.push({ content, baseHash });
  return answer(content, baseHash);
};

beforeEach(() => {
  listeners.clear();
  disk = { content: "# Spec\n", hash: "h1" };
  saves = [];
  answer = (content) => Promise.resolve({ ok: true, value: { hash: `h-${content.length}` } });
});

const open = async (externalHash?: string | null) => {
  const hook = renderHook(
    (props: { externalHash?: string | null }) =>
      useFileEditor({ read, save, topic: "agent-files", externalHash: props.externalHash }),
    {
      initialProps: { externalHash },
    },
  );
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
};

test("reading gives the content, its hash and a clean editor", async () => {
  const { result } = await open();
  expect([result.current.content, result.current.baseHash, result.current.dirty]).toEqual([
    "# Spec\n",
    "h1",
    false,
  ]);
  act(() => result.current.setContent("# Spec\nPlus.\n"));
  expect(result.current.dirty).toBe(true);
});

test("saving sends the base hash and takes the new one", async () => {
  const { result } = await open();
  act(() => result.current.setContent("abc"));
  let ok = false;
  await act(async () => {
    ok = await result.current.save();
  });
  expect(ok).toBe(true);
  expect(saves).toEqual([{ content: "abc", baseHash: "h1" }]);
  expect([result.current.baseHash, result.current.dirty]).toEqual(["h-3", false]);
});

test("a conflict keeps the local content and writes nothing", async () => {
  answer = () => Promise.resolve({ ok: false, conflict: { content: "disk", hash: "h2", modifiedAt: 1 } });
  const { result } = await open();
  act(() => result.current.setContent("mine"));
  let ok = true;
  await act(async () => {
    ok = await result.current.save();
  });
  expect(ok).toBe(false);
  expect(result.current.conflict).toEqual({ content: "disk", hash: "h2", modifiedAt: 1 });
  expect([result.current.content, result.current.dirty, result.current.baseHash]).toEqual([
    "mine",
    true,
    "h1",
  ]);
});

test("reload takes the disk and keeps the edit as a draft", async () => {
  answer = () => Promise.resolve({ ok: false, conflict: { content: "disk", hash: "h2", modifiedAt: 1 } });
  const { result } = await open();
  act(() => result.current.setContent("mine"));
  await act(async () => {
    await result.current.save();
  });
  disk = { content: "disk", hash: "h2" };
  await act(async () => {
    await result.current.reload();
  });
  expect([result.current.content, result.current.baseHash, result.current.draft]).toEqual([
    "disk",
    "h2",
    "mine",
  ]);
  expect([result.current.conflict, result.current.dirty]).toEqual([null, false]);
});

test("overwrite saves again on top of the disk hash", async () => {
  answer = () => Promise.resolve({ ok: false, conflict: { content: "disk", hash: "h2", modifiedAt: 1 } });
  const { result } = await open();
  act(() => result.current.setContent("mine"));
  await act(async () => {
    await result.current.save();
  });
  answer = () => Promise.resolve({ ok: true, value: { hash: "h3" } });
  let ok = false;
  await act(async () => {
    ok = await result.current.overwrite();
  });
  expect(ok).toBe(true);
  expect(saves.at(-1)).toEqual({ content: "mine", baseHash: "h2" });
  expect([result.current.conflict, result.current.baseHash]).toEqual([null, "h3"]);
});

test("a deleted file is reported as missing and can be recreated", async () => {
  answer = () => Promise.reject(new KiboError("NOT_FOUND", "gone"));
  const { result } = await open();
  await act(async () => {
    await result.current.save();
  });
  expect(result.current.missing).toBe(true);
  answer = () => Promise.resolve({ ok: true, value: { hash: "h9" } });
  await act(async () => {
    await result.current.recreate();
  });
  expect(saves.at(-1)?.baseHash).toBeNull();
  expect([result.current.missing, result.current.baseHash]).toEqual([false, "h9"]);
});

test("another hash on disk shows the file changed without a conflict", async () => {
  const hook = await open("h1");
  expect(hook.result.current.changedOnDisk).toBe(false);
  hook.rerender({ externalHash: "h2" });
  expect(hook.result.current.changedOnDisk).toBe(true);
});

test("without an external hash, the topic triggers a read of the disk hash", async () => {
  const { result } = await open();
  disk = { content: "other", hash: "h5" };
  await act(async () => {
    listeners.get("agent-files")?.();
  });
  await waitFor(() => expect(result.current.changedOnDisk).toBe(true));
  expect(result.current.content).toBe("# Spec\n");
});
