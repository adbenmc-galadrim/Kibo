import type { CommitDefaults, CommitInfo } from "@kibo/schema";
import { useEffect, useState } from "react";

export function useCommitDraft(defaults: CommitDefaults | null, canAmend: boolean) {
  const [message, setMessage] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [amend, setAmend] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!defaults || edited) return;
    setMessage(defaults.message);
    setPrefilled(defaults.message.length > 0);
  }, [defaults, edited]);

  useEffect(() => {
    if (!canAmend) setAmend(false);
  }, [canAmend]);

  const edit = (next: string) => {
    setMessage(next);
    setPrefilled(false);
    setEdited(true);
  };
  const load = (c: CommitInfo) => {
    edit(c.body ? `${c.subject}\n\n${c.body}` : c.subject);
    setAmend(true);
  };
  const clear = () => {
    edit("");
    setEdited(false);
    setAmend(false);
  };
  return { message, prefilled, amend, setAmend, edit, load, clear };
}
