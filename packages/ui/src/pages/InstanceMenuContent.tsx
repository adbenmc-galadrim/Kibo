import { type ComponentSummary, compareSemver, type Instance, isBuiltinId, splitRef } from "@kibo/schema";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@kibo/sdk/ui/dropdown-menu";
import { ArrowUpCircle, FolderOpen, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { client } from "../api";
import { modifiable } from "../components-page/rows";
import { fr } from "../i18n/fr";
import { configSchemaOf } from "../lib/config-form";
import { errorMessage } from "../lib/error-message";
import { type TrustTarget, trustTargetOf } from "../lib/trust-target";
import type { Flash } from "../lib/use-flash";
import {
  ConfirmDialog,
  InstanceSettingsDialog,
  ModifyWithAiDialog,
  NotesDirDialog,
  TrustDialog,
} from "../shell/lazy-dialogs";
import { useComponents } from "../state/use-components";

export type InstanceMenuContentProps = {
  projectId: string;
  instance: Instance;
  title: string;
  flash: Flash["flash"];
};
type PendingUpdate = { target: TrustTarget; to: string };

function higherVersions(summary: ComponentSummary | undefined, id: string, version: string) {
  if (isBuiltinId(id) || !summary) return [];
  return summary.versions
    .filter((v) => compareSemver(v.version, version) > 0)
    .sort((a, b) => compareSemver(b.version, a.version));
}

export function InstanceMenuContent({ projectId, instance, title, flash }: InstanceMenuContentProps) {
  const i = fr.instance;
  const { id, version } = splitRef(instance.component);
  const { components } = useComponents();
  const [notesDir, setNotesDir] = useState(false);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [modifying, setModifying] = useState<ModifyTarget | null>(null);
  const [settings, setSettings] = useState(false);
  const [removing, setRemoving] = useState(false);
  const schema = configSchemaOf(instance, components);
  const summary = components?.find((c) => c.id === id && !c.builtin);
  const higher = higherVersions(summary, id, version);
  const isNotes = id === "notes";
  const origin = summary?.versions.find((v) => v.version === version)?.origin ?? null;
  const target: ModifyTarget | null =
    summary && origin !== null && modifiable(origin) ? { id, version, origin, title: summary.title } : null;

  const update = async (to: string) => {
    try {
      await client.rpc({ method: "updateInstance", projectId, instanceId: instance.id, to });
      flash(i.updated(to));
    } catch (e) {
      console.error(e);
      flash(i.updateFailed, "error");
    }
  };
  const remove = async () => {
    await client.rpc({
      method: "command",
      projectId,
      command: { method: "removeInstance", instanceId: instance.id },
    });
  };
  const pick = (v: ComponentSummary["versions"][number]) => {
    const target = !v.active && summary ? trustTargetOf(id, summary.title, v) : null;
    if (target) setPending({ target, to: v.version });
    else void update(v.version);
  };

  return (
    <>
      <DropdownMenuContent align="end">
        {higher.map((v) => (
          <DropdownMenuItem key={v.version} onSelect={() => pick(v)}>
            <ArrowUpCircle aria-hidden />
            {i.updateTo(v.version)}
          </DropdownMenuItem>
        ))}
        {isNotes && (
          <DropdownMenuItem onSelect={() => setNotesDir(true)}>
            <FolderOpen aria-hidden />
            {i.notesDir}
          </DropdownMenuItem>
        )}
        {schema && (
          <DropdownMenuItem onSelect={() => setSettings(true)}>
            <Settings2 aria-hidden />
            {i.settings}
          </DropdownMenuItem>
        )}
        {target && (
          <DropdownMenuItem onSelect={() => setModifying(target)}>
            <Sparkles aria-hidden />
            {fr.ai.modify}
          </DropdownMenuItem>
        )}
        {(higher.length > 0 || isNotes || target || schema) && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
          <Trash2 aria-hidden />
          {i.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
      {notesDir && <NotesDirDialog projectId={projectId} open onOpenChange={setNotesDir} />}
      {settings && schema && (
        <InstanceSettingsDialog
          projectId={projectId}
          instance={instance}
          title={title}
          schema={schema}
          onClose={() => setSettings(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(false)}
          title={i.removeTitle(title)}
          description={i.removeHelp}
          confirmLabel={i.removeConfirm}
          cancelLabel={fr.common.cancel}
          onConfirm={remove}
          describeError={errorMessage}
        />
      )}
      {modifying && (
        <ModifyWithAiDialog
          component={modifying}
          projectId={projectId}
          open
          onOpenChange={(o) => !o && setModifying(null)}
        />
      )}
      {pending && (
        <TrustDialog
          target={pending.target}
          mode="approve"
          open
          onOpenChange={(o) => !o && setPending(null)}
          onApproved={() => {
            setPending(null);
            void update(pending.to);
          }}
        />
      )}
    </>
  );
}
