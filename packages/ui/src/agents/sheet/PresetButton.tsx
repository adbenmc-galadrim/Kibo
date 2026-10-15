import { type Agent, type AgentSettings, presetPatch } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kibo/sdk/ui/dialog";
import { WandSparkles } from "lucide-react";
import { useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { frAgentsPage } from "../../i18n/fr-agents-page";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";
import { frDeliverySettings } from "../../i18n/fr-delivery-settings";
import { abbreviateHome } from "../../lib/home-path";

type Props = { agent: Agent; home: string | null; onApplied(agent: Agent): void };

const t = frDeliverySettings.preset;

const nameOf = (ref: string) => ref.split(":").at(-1) ?? ref;

function subagentsOf(settings: AgentSettings): string {
  if (settings.subagents.length === 0) return frAgentsSkills.subagents.none;
  return settings.subagents.map(nameOf).join(", ");
}

export function presetChanges(settings: AgentSettings): [string, string][] {
  const auto = frAgentsPage.permissionModes.auto;
  const worktree = fr.strategies.worktree;
  return [
    [
      t.mode,
      settings.permissionMode === "auto"
        ? t.unchanged(auto)
        : t.change(frAgentsPage.permissionModes[settings.permissionMode], auto),
    ],
    [
      t.subagents,
      settings.allSubagents ? t.unchanged(t.allSubagents) : t.change(subagentsOf(settings), t.allSubagents),
    ],
    [
      t.workspace,
      settings.workspace === "worktree"
        ? t.unchanged(worktree)
        : t.change(fr.strategies[settings.workspace], worktree),
    ],
    [
      t.skills,
      settings.skills.mode === "all"
        ? t.unchanged(t.allSkills)
        : t.change(frAgentsSkills.skills.list, t.allSkills),
    ],
  ];
}

function AddedList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section aria-label={title} className="grid gap-1.5">
      <h3 className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.nothingAdded}</p>
      ) : (
        <ul className="grid max-h-56 gap-0.5 overflow-auto rounded-md border bg-muted/40 px-3 py-2">
          {items.map((item) => (
            <li key={item} className="font-mono text-xs">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PresetButton({ agent, home, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (agent.scope === "system") return null;
  const patch = presetPatch("delivery", home ?? "~");
  const rules = (patch.allow ?? []).filter((r) => !agent.settings.allow.includes(r));
  const dirs = (patch.addDirs ?? []).filter((d) => !agent.settings.addDirs.includes(d)).map(abbreviateHome);
  const apply = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await client.rpc({ method: "agents.applyPreset", ref: agent.ref, preset: "delivery" });
      setOpen(false);
      onApplied(next);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <WandSparkles aria-hidden />
        {t.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description(agent.name)}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1.5 text-sm">
            {presetChanges(agent.settings).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <AddedList title={t.addedRules(rules.length)} items={rules} />
          <AddedList title={t.addedDirs(dirs.length)} items={dirs} />
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t.failed}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void apply()}>
              <WandSparkles aria-hidden />
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
