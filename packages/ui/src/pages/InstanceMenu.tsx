import { type ComponentSummary, compareSemver, type Instance, isBuiltinId, splitRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ArrowUpCircle, Ellipsis, FolderOpen, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ModifyTarget } from "../ai/ModifyWithAiDialog";
import { client } from "../api";
import { modifiable } from "../components-page/rows";
import { NotesDirDialog } from "../dialogs/NotesDirDialog";
import { TrustDialog, type TrustTarget, trustTargetOf } from "../dialogs/TrustDialog";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { findComponent } from "../registry";
import { ModifyWithAiDialog } from "../shell/lazy-dialogs";
import { useComponents } from "../state/use-components";

type Props = { projectId: string; instance: Instance; title: string };
type PendingUpdate = { target: TrustTarget; to: string };

export function useInstanceTitle(ref: string): string {
  const { components } = useComponents();
  const builtin = findComponent(ref);
  if (builtin) return builtin.manifest.title;
  const { id } = splitRef(ref);
  return components?.find((c) => c.id === id)?.title ?? ref;
}

function higherVersions(summary: ComponentSummary | undefined, id: string, version: string) {
  if (isBuiltinId(id) || !summary) return [];
  return summary.versions
    .filter((v) => compareSemver(v.version, version) > 0)
    .sort((a, b) => compareSemver(b.version, a.version));
}

export function InstanceMenu({ projectId, instance, title }: Props) {
  const i = fr.instance;
  const { id, version } = splitRef(instance.component);
  const { components } = useComponents();
  const { message, tone, flash } = useFlash();
  const [notesDir, setNotesDir] = useState(false);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [modifying, setModifying] = useState<ModifyTarget | null>(null);
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
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: { method: "removeInstance", instanceId: instance.id },
      });
    } catch (e) {
      console.error(e);
      flash(i.removeFailed, "error");
    }
  };
  const pick = (v: ComponentSummary["versions"][number]) => {
    const target = !v.active && summary ? trustTargetOf(id, summary.title, v) : null;
    if (target) setPending({ target, to: v.version });
    else void update(v.version);
  };

  return (
    <>
      {message && (
        <span
          role={tone === "error" ? "alert" : "status"}
          className={`truncate text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={i.menu(title)}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
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
          {target && (
            <DropdownMenuItem onSelect={() => setModifying(target)}>
              <Sparkles aria-hidden />
              {fr.ai.modify}
            </DropdownMenuItem>
          )}
          {(higher.length > 0 || isNotes || target) && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
            <Trash2 aria-hidden />
            {i.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {notesDir && <NotesDirDialog projectId={projectId} open onOpenChange={setNotesDir} />}
      {modifying && (
        <ModifyWithAiDialog component={modifying} open onOpenChange={(o) => !o && setModifying(null)} />
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
