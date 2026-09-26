import { expect, test } from "bun:test";
import type { CommitDefaults, CommitInfo } from "@kibo/schema";
import { act, renderHook } from "@testing-library/react";
import { useCommitDraft } from "./use-commit-draft";

const defaults = (message: string): CommitDefaults => ({
  ticketId: "t1",
  ticketKey: "KIB-12",
  message,
  prTitle: message,
  prBody: "",
});

const head: CommitInfo = {
  sha: "a".repeat(40),
  shortSha: "aaaaaaa",
  subject: "feat: schéma (KIB-12)",
  body: "",
  author: "Adam",
  time: 0,
  pushed: false,
};

type Props = { defaults: CommitDefaults | null };

const setup = () =>
  renderHook((p: Props) => useCommitDraft(p.defaults, true), {
    initialProps: { defaults: defaults("feat: ticket (KIB-12)") },
  });

test("defaults loaded late do not overwrite a message typed meanwhile", () => {
  const { result, rerender } = setup();
  expect(result.current.message).toBe("feat: ticket (KIB-12)");

  act(() => result.current.edit("fix: à la main"));
  rerender({ defaults: defaults("feat: ticket (KIB-12)") });

  expect(result.current.message).toBe("fix: à la main");
});

test("defaults loaded late keep the commit loaded for an amend", () => {
  const { result, rerender } = setup();

  act(() => result.current.load(head));
  act(() => result.current.edit("feat: schéma complet (KIB-12)"));
  rerender({ defaults: defaults("feat: ticket (KIB-12)") });

  expect(result.current.message).toBe("feat: schéma complet (KIB-12)");
  expect(result.current.amend).toBe(true);
});

test("after a commit the next defaults prefill the message again", () => {
  const { result, rerender } = setup();

  act(() => result.current.edit("fix: à la main"));
  act(() => result.current.clear());
  rerender({ defaults: defaults("feat: suite (KIB-12)") });

  expect(result.current.message).toBe("feat: suite (KIB-12)");
  expect(result.current.prefilled).toBe(true);
});

test("after committing the prefilled message, the defaults fill it again without waiting for a reload", () => {
  const { result } = setup();

  act(() => result.current.clear());

  expect(result.current.message).toBe("feat: ticket (KIB-12)");
  expect(result.current.prefilled).toBe(true);
});
