import type { AgentExecution, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Lock, Plus, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { DeliverChildrenDialog } from "../delivery/lazy";
import { useDeliver } from "../delivery/use-deliver";
import { frDelivery } from "../i18n/fr-delivery";
import { frFeature as t } from "../i18n/fr-group";
import { canEdit } from "../state/access";
import { useAgentsState } from "../state/agents-context";
import { useNow } from "../state/use-agents";
import { useAppSettings } from "../state/use-app-settings";
import { useTicketCommand } from "../ticket/use-ticket-command";
import { DependenciesCard } from "./feature/DependenciesCard";
import { ExpectedResult } from "./feature/ExpectedResult";
import { FeatureHeader } from "./feature/FeatureHeader";
import { ActivityCard, QuestionsCard } from "./feature/FeedCards";
import { featureActivity, featureQuestions } from "./feature/feature-feed";
import { featureDependencies } from "./feature/feature-links";
import { featureBadge, nextToDeliver, sprintFacts, stepModels } from "./feature/feature-model";
import { NextStepAction } from "./feature/NextStepAction";
import { SprintCard } from "./feature/SprintCard";
import { StepsTimeline } from "./feature/StepsTimeline";
import { useOptionalHost } from "./Host";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  now?: number;
  execution?: AgentExecution;
  actions?: (extra: MenuEntry[]) => ReactNode;
  onOpenFile(ref: FileRef): void;
  onOpenTicket(ticketId: string): void;
};

const GHOST =
  "ml-auto h-[25px] gap-[6px] rounded-[6px] px-[10px] py-[5px] has-[>svg]:px-[10px] text-[12px] leading-[15px] font-medium text-(--tracking-mfg) hover:bg-(--tracking-hover) [&_svg:not([class*='size-'])]:size-[13px]";

export function FeatureDetail({
  project,
  ticket: f,
  now: fixedNow,
  execution: forced,
  actions,
  onOpenFile,
  onOpenTicket,
}: Props) {
  const liveNow = useNow(60_000);
  const setting = useAppSettings().agentExecution;
  const execution = forced ?? setting;
  const now = fixedNow ?? liveNow;
  const host = useOptionalHost();
  const agents = useAgentsState();
  const titleCommand = useTicketCommand(project.meta.id);
  const descriptionCommand = useTicketCommand(project.meta.id);
  const sprintCommand = useTicketCommand(project.meta.id);
  const editable = canEdit(project);
  const group = useDeliver(project.meta.id, f);
  const deliveryEntries: MenuEntry[] =
    execution === "shown" && editable
      ? [{ label: frDelivery.deliverChildren, icon: Truck, onSelect: () => void group.deliver() }]
      : [];
  const steps = stepModels(project, f.id, agents?.runs ?? [], now);
  const next = nextToDeliver(steps);
  const facts = sprintFacts(project, f);
  const setSprint = (sprintId: string | null) =>
    void sprintCommand.run({ method: "setTicketSprint", ticketId: f.id, sprintId });
  const openFile = (r: { path: string; line: number | null }) =>
    onOpenFile({
      projectId: project.meta.id,
      worktree: null,
      path: r.path,
      line: r.line,
      origin: f.keyLabel,
    });
  return (
    <div data-screen="feature" className="@container w-full text-(--tracking-fg)">
      <div className="flex flex-col gap-[28px] px-[28px] py-[22px] @min-[900px]:flex-row @min-[900px]:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <FeatureHeader
            feature={f}
            sprintCode={facts.sprint?.code ?? null}
            badge={featureBadge(f.feature)}
            steps={steps}
            editable={editable}
            command={titleCommand}
            actions={actions?.(deliveryEntries)}
          />
          {group.error && (
            <p role="alert" className="text-[12px] text-(--tracking-red)">
              {group.error}
            </p>
          )}
          {group.children && (
            <DeliverChildrenDialog
              projectId={project.meta.id}
              parent={group.children.parent}
              items={group.children.items}
              onClose={group.closeChildren}
            />
          )}
          <ExpectedResult
            ticketId={f.id}
            description={f.description}
            editable={editable}
            command={descriptionCommand}
            onOpenFile={openFile}
          />
          <div className="flex min-h-[25px] w-full items-center gap-[8px]">
            <h2 className="text-[15px] leading-[18px] font-semibold">{t.journey}</h2>
            <span className="text-[12.5px] leading-[15px] text-(--tracking-dim)">{t.journeyHint}</span>
            {editable && host && (
              <Button
                variant="ghost"
                className={GHOST}
                onClick={() => host.openNewTicket({ parentId: f.id })}
              >
                <Plus absoluteStrokeWidth size={13} />
                {t.addStep}
              </Button>
            )}
          </div>
          <StepsTimeline
            steps={steps}
            workflow={project.workflow}
            now={now}
            nextId={next?.ticketId ?? null}
            nextAction={
              next && <NextStepAction projectId={project.meta.id} step={next} execution={execution} />
            }
            onOpenTicket={onOpenTicket}
          />
        </div>
        <aside className="flex w-full flex-col gap-[14px] @min-[900px]:w-[320px] @min-[900px]:shrink-0">
          <SprintCard facts={facts} sprints={project.sprints} editable={editable} onSetSprint={setSprint} />
          {sprintCommand.error && (
            <p role="alert" className="text-[12px] text-(--tracking-red)">
              {sprintCommand.error}
            </p>
          )}
          <DependenciesCard dependencies={featureDependencies(project, f.id)} onOpenTicket={onOpenTicket} />
          <QuestionsCard
            questions={featureQuestions(project, f.id, now)}
            onOpenQuestion={(id) => host?.openView("questions", undefined, id)}
          />
          <ActivityCard items={featureActivity(steps, now)} />
          <p className="flex items-start gap-[8px] text-[11.5px] leading-[17px] text-(--tracking-dim)">
            <Lock absoluteStrokeWidth size={13} aria-hidden className="size-[13px] shrink-0" />
            {t.footer}
          </p>
        </aside>
      </div>
    </div>
  );
}
