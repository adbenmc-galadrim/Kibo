import type { FileContent, FileRef, Worktree } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { resolveWorktree, useWorktrees } from "../code/use-worktrees";
import { fr } from "../i18n/fr";
import { errorMessage } from "../lib/error-message";
import { highlightLines, plainTokens, type Token } from "./highlight";
import { languageOf } from "./language";

export type FileContentState = {
  worktree: Worktree | null;
  content: FileContent | null;
  tokens: Token[][] | null;
  error: string | null;
  setError(error: string | null): void;
  reload(): void;
  replaceContent(content: FileContent): void;
};

export function useFileContent(ref: FileRef): FileContentState {
  const { worktrees, error: worktreeError } = useWorktrees(ref.projectId);
  const worktree = resolveWorktree(worktrees, ref.worktree);
  const [content, setContent] = useState<FileContent | null>(null);
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const latest = useRef<FileContent | null>(null);
  const worktreePath = worktree?.path ?? null;
  const { projectId, path } = ref;

  const replaceContent = useCallback((next: FileContent) => {
    latest.current = next;
    setContent(next);
    setTokens(null);
    if (next.content === null) return;
    const source = next.content;
    highlightLines(source, languageOf(next.path).id).then(
      (lines) => {
        if (latest.current === next) setTokens(lines);
      },
      () => {
        if (latest.current !== next) return;
        setTokens(plainTokens(source));
        setError(fr.file.languageFailed);
      },
    );
  }, []);

  const load = useCallback(() => {
    const id = ++request.current;
    latest.current = null;
    setContent(null);
    setTokens(null);
    setError(null);
    if (!worktreePath) return;
    client.code({ method: "readFile", projectId, worktree: worktreePath, path, revision: "worktree" }).then(
      (c) => {
        if (id === request.current) replaceContent(c);
      },
      (e: unknown) => {
        if (id === request.current) setError(errorMessage(e));
      },
    );
  }, [projectId, path, worktreePath, replaceContent]);

  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
  }, [load]);

  const missingWorktree = worktrees !== null && worktree === null ? fr.errors.NOT_FOUND : null;

  return {
    worktree,
    content,
    tokens,
    error: error ?? (worktreeError ? errorMessage(worktreeError) : missingWorktree),
    setError,
    reload: load,
    replaceContent,
  };
}
