import type { Agent, AgentFile, AgentRef, AgentSettingsPatch } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { client } from "../../api";
import { type FileEditor, useFileEditor } from "../../file-editor/use-file-editor";

export type SpecDraft = { description: string; model: string | null };

export type AgentSheetState = {
  agent: Agent | null;
  failed: boolean;
  draft: SpecDraft;
  setDraft(patch: Partial<SpecDraft>): void;
  editor: FileEditor;
  dirty: boolean;
  draftFile(): AgentFile | null;
  settingsFailed: boolean;
  patch(patch: AgentSettingsPatch): Promise<void>;
};

const NO_DRAFT: SpecDraft = { description: "", model: null };
const draftOf = (agent: Agent): SpecDraft => ({
  description: agent.file?.frontmatter.description ?? "",
  model: agent.file?.frontmatter.model ?? null,
});

function withDraft(file: AgentFile, draft: SpecDraft, body: string): AgentFile {
  const { model: _model, ...frontmatter } = file.frontmatter;
  return {
    frontmatter: {
      ...frontmatter,
      description: draft.description,
      ...(draft.model ? { model: draft.model } : {}),
    },
    body,
  };
}

export function useAgentSheet(ref: AgentRef): AgentSheetState {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraftState] = useState<SpecDraft>(NO_DRAFT);
  const [savedDraft, setSavedDraft] = useState<SpecDraft>(NO_DRAFT);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const latest = useRef({ agent, draft });
  latest.current = { agent, draft };

  const editor = useFileEditor({
    topic: "agent-files",
    externalHash: agent?.hash ?? null,
    read: async () => {
      const read = await client.rpc({ method: "agents.read", ref });
      setAgent(read);
      setDraftState(draftOf(read));
      setSavedDraft(draftOf(read));
      return { content: read.file?.body ?? "", hash: read.hash ?? "" };
    },
    save: async (content, baseHash) => {
      const current = latest.current.agent?.file;
      if (!current) throw new Error("agent file unreadable");
      const file = withDraft(current, latest.current.draft, content);
      const result = await client.rpc({ method: "agents.save", ref, file, baseHash });
      if (!result.ok) return result;
      setAgent(result.value);
      setSavedDraft(latest.current.draft);
      return { ok: true, value: { hash: result.value.hash ?? "" } };
    },
  });

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      client.rpc({ method: "agents.read", ref }).then(
        (fresh) => alive && setAgent((prev) => (prev ? { ...fresh, file: prev.file } : fresh)),
        () => alive && setFailed(true),
      );
    const off = client.subscribeTopic("agent-files", () => void refresh());
    return () => {
      alive = false;
      off();
    };
  }, [ref]);

  useEffect(() => {
    if (editor.error !== null && agent === null) setFailed(true);
  }, [editor.error, agent]);

  const patch = async (settings: AgentSettingsPatch) => {
    const before = latest.current.agent;
    if (!before) return;
    setSettingsFailed(false);
    setAgent({ ...before, settings: { ...before.settings, ...settings } });
    try {
      const next = await client.rpc({ method: "agents.settings", ref, patch: settings });
      setAgent((prev) => (prev ? { ...next, file: prev.file } : next));
    } catch {
      setAgent((prev) => (prev ? { ...prev, settings: before.settings } : prev));
      setSettingsFailed(true);
    }
  };

  const draftDirty = draft.description !== savedDraft.description || draft.model !== savedDraft.model;
  return {
    agent,
    failed,
    draft,
    setDraft: (p) => setDraftState((d) => ({ ...d, ...p })),
    editor,
    dirty: editor.dirty || draftDirty,
    draftFile: () => (agent?.file ? withDraft(agent.file, draft, editor.content) : null),
    settingsFailed,
    patch,
  };
}
