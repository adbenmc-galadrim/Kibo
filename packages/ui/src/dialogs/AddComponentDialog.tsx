import type { DraftSummary, Layout, Page } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { RadioGroup } from "@kibo/sdk/ui/radio-group";
import { Blocks, Check, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { nextLayout } from "../lib/next-layout";
import { BUILTIN_COMPONENTS, componentIcon } from "../registry";
import { useComponents } from "../state/use-components";
import { CatalogRow, CatalogSection, VersionPill } from "./CatalogRow";
import { ComponentPreview } from "./ComponentPreview";
import { CreateComponentDialog } from "./CreateComponentDialog";
import { builtinChoices, type Choice, matches, mineChoices } from "./catalog-choices";
import { Segment } from "./Segment";
import { TrustDialog, type TrustTarget, trustTargetOf } from "./TrustDialog";

type Props = {
  projectId: string;
  page: Page;
  taken: Layout[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublishDraft?: (id: string) => void;
};

const BUILTINS = builtinChoices(BUILTIN_COMPONENTS);

function DraftRow({
  draft,
  onPublish,
}: {
  draft: DraftSummary;
  onPublish: ((id: string) => void) | undefined;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed px-2 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
        <Blocks aria-hidden className="size-4" />
      </span>
      <span className="flex flex-1 items-center gap-2 text-sm font-medium">
        {draft.title}
        <Badge variant="secondary">{fr.addComponent.draft}</Badge>
      </span>
      {onPublish ? (
        <Button size="sm" variant="outline" onClick={() => onPublish(draft.id)}>
          {fr.addComponent.publish}
        </Button>
      ) : (
        <VersionPill version={draft.version} />
      )}
    </div>
  );
}

function Details({ choice, page }: { choice: Choice; page: Page }) {
  const a = fr.addComponent;
  return (
    <>
      <ComponentPreview id={choice.id} icon={componentIcon(choice.ref)} />
      <div className="grid gap-1">
        <p className="text-base font-semibold">{choice.title}</p>
        {choice.description && <p className="text-muted-foreground">{choice.description}</p>}
      </div>
      <div className="grid gap-2">
        <p className="font-medium">{a.display}</p>
        <Segment
          value={page.kind}
          options={[{ value: page.kind, label: page.kind === "dashboard" ? a.widget : a.view }]}
        />
      </div>
      {choice.reads.includes("ticket") && (
        <div className="grid gap-2">
          <p className="font-medium">{a.source}</p>
          <Segment
            value="local"
            options={[
              { value: "local", label: a.sourceLocal },
              { value: "synced", label: a.sourceSynced, disabled: true, hint: a.sourceSoon },
            ]}
          />
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check aria-hidden className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
        {choice.line}
      </p>
    </>
  );
}

export function AddComponentDialog({ projectId, page, taken, open, onOpenChange, onPublishDraft }: Props) {
  const a = fr.addComponent;
  const { components, drafts, error } = useComponents();
  const [query, setQuery] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [trust, setTrust] = useState<TrustTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const mine = mineChoices(components ?? []);
  const shown = (c: Choice) => matches(`${c.title} ${c.description ?? ""}`, query);
  const shownBuiltins = BUILTINS.filter(shown);
  const shownMine = mine.filter(shown);
  const shownDrafts = (drafts ?? []).filter((d) => d.validated && matches(d.title, query));
  const selected = [...BUILTINS, ...mine].find((c) => c.ref === ref) ?? null;

  const addInstance = async (component: string) => {
    setFailed(false);
    try {
      await client.rpc({
        method: "command",
        projectId,
        command: {
          method: "addInstance",
          pageId: page.id,
          component,
          ...(page.kind === "dashboard" && { layout: nextLayout(taken) }),
        },
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };
  const submit = () => {
    if (!selected) return;
    if (!selected.pending) {
      void addInstance(selected.ref);
      return;
    }
    const target = trustTargetOf(selected.id, selected.title, selected.pending);
    setFailed(target === null);
    setTrust(target);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{a.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-1">
              <div className="relative">
                <Search aria-hidden className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={a.search}
                  aria-label={a.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <RadioGroup value={ref ?? ""} onValueChange={setRef} className="grid gap-0.5">
                {shownBuiltins.length > 0 && <CatalogSection label={a.builtin} />}
                {shownBuiltins.map((c) => (
                  <CatalogRow
                    key={c.ref}
                    value={c.ref}
                    icon={componentIcon(c.ref)}
                    title={c.title}
                    description={c.description}
                    aside={<VersionPill version={c.version} />}
                  />
                ))}
                {(shownMine.length > 0 || shownDrafts.length > 0) && <CatalogSection label={a.mine} />}
                {shownMine.map((c) => (
                  <CatalogRow
                    key={c.ref}
                    value={c.ref}
                    icon={Blocks}
                    title={c.title}
                    description={c.line}
                    aside={<VersionPill version={c.version} />}
                  />
                ))}
              </RadioGroup>
              {shownDrafts.map((d) => (
                <DraftRow key={d.id} draft={d} onPublish={onPublishDraft} />
              ))}
              {shownBuiltins.length + shownMine.length + shownDrafts.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{a.noResult}</p>
              )}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
              >
                <Sparkles aria-hidden className="size-4" />
                {a.create}
              </button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {a.loadFailed}
                </p>
              )}
            </div>
            <div className="grid content-start gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
              {selected ? (
                <Details choice={selected} page={page} />
              ) : (
                <p className="text-muted-foreground">{a.pick}</p>
              )}
            </div>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {a.failed}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button disabled={!selected} onClick={submit}>
              {a.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {trust && (
        <TrustDialog
          target={trust}
          mode="approveAndAdd"
          open
          onOpenChange={(o) => {
            if (!o) setTrust(null);
          }}
          onApproved={(v) => void addInstance(`${trust.id}@${v.version}`)}
        />
      )}
      <CreateComponentDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
