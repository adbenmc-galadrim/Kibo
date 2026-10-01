import type { AgentsState, ComponentDraft } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { aiErrorMessage } from "../ai/ai-error";
import { ModifyWithAiDialog } from "../ai/ModifyWithAiDialog";
import { client } from "../api";
import { CreateComponentDialog } from "../dialogs/CreateComponentDialog";
import { fr } from "../i18n/fr";
import { frCreations } from "../i18n/fr-creations";
import { useComponentDrafts } from "../state/use-component-drafts";
import { CreationRow } from "./CreationRow";
import { groupDrafts } from "./creation-status";

const t = frCreations.page;
const HEAD = "h-9 px-4 text-2xs font-normal text-muted-foreground";

type GroupProps = {
  title: string;
  drafts: ComponentDraft[];
  agents: AgentsState | null;
  now: number;
  onOpen(draft: ComponentDraft): void;
  onAbandon(draft: ComponentDraft): void;
};

function CreationsGroup({ title, drafts, ...rest }: GroupProps) {
  const id = useId();
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2 id={id} className="text-sm font-medium">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD} w-[24%]`}>{t.columns.component}</TableHead>
              <TableHead className={`${HEAD} w-[12%]`}>{t.columns.mode}</TableHead>
              <TableHead className={`${HEAD} w-[26%]`}>{t.columns.progress}</TableHead>
              <TableHead className={`${HEAD} w-[11%]`}>{t.columns.updated}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{t.columns.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((d) => (
              <CreationRow key={d.id} draft={d} {...rest} />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{t.empty}</p>
      <Button onClick={onCreate}>
        <Plus aria-hidden />
        {t.create}
      </Button>
    </div>
  );
}

export type CreationsPageProps = { agents: AgentsState | null; now: number };

export function CreationsPage({ agents, now }: CreationsPageProps) {
  const { drafts, error, reload } = useComponentDrafts();
  const [opened, setOpened] = useState<ComponentDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [abandoning, setAbandoning] = useState<ComponentDraft | null>(null);
  const groups = drafts ? groupDrafts(drafts) : null;
  const close = (open: boolean) => {
    if (open) return;
    setOpened(null);
    setCreating(false);
    reload();
  };
  const abandon = async () => {
    if (!abandoning) return;
    await client.rpc({ method: "abandonComponentDraft", draftId: abandoning.id });
    reload();
  };
  const rows = { agents, now, onOpen: setOpened, onAbandon: setAbandoning };

  return (
    <div className="grid content-start gap-6 p-6">
      <header className="grid max-w-2xl gap-1">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!groups && !error && <p className="text-sm text-muted-foreground">{t.loading}</p>}
      {groups && drafts?.length === 0 && <EmptyState onCreate={() => setCreating(true)} />}
      {groups && <CreationsGroup title={t.active(groups.active.length)} drafts={groups.active} {...rows} />}
      {groups && (
        <CreationsGroup title={t.finished(groups.finished.length)} drafts={groups.finished} {...rows} />
      )}
      <ConfirmDialog
        open={abandoning !== null}
        onOpenChange={(o) => !o && setAbandoning(null)}
        title={frCreations.abandon.title(abandoning?.title ?? "")}
        description={frCreations.abandon.description}
        confirmLabel={frCreations.abandon.confirm}
        cancelLabel={fr.common.cancel}
        onConfirm={abandon}
        describeError={aiErrorMessage}
      />
      <CreateComponentDialog
        open={creating || opened?.mode === "create"}
        onOpenChange={close}
        target={null}
        draftId={opened?.mode === "create" ? opened.id : undefined}
      />
      {opened?.mode === "modify" && (
        <ModifyWithAiDialog component={null} draftId={opened.id} open onOpenChange={close} />
      )}
    </div>
  );
}
