import type { ProjectSnapshot } from "@kibo/schema";
import {
  ConversationView,
  frProjectAgent,
  QuestionLinksContext,
  useAgentConversation,
} from "@kibo/ui/project-agent";
import { Bot, ChevronLeft, List } from "lucide-react";
import { useState } from "react";
import { fr } from "../../i18n/fr";
import { frAgent } from "../../i18n/fr-agent";
import type { Presence } from "../../remote-client";
import { useProjectSnapshot } from "../../use-project";
import { OfflineBand } from "../OfflineBand";
import { AgentCompose, isWritable, PastSessionBar } from "./AgentCompose";
import { AgentSessions } from "./AgentSessions";

type ScreenProps = { projectId: string; projectName: string; presence: Presence; onBack(): void };

const ICON_BUTTON = "flex size-11 shrink-0 items-center justify-center rounded-lg";

function AgentTopBar({
  title,
  listing,
  onBack,
  onList,
}: {
  title: string;
  listing: boolean;
  onBack(): void;
  onList(): void;
}) {
  return (
    <header className="shrink-0 border-b border-(--tracking-border) bg-(--tracking-bg) pt-[env(safe-area-inset-top)]">
      <div className="flex h-13 items-center gap-2 pr-3 pl-2">
        <button type="button" aria-label={fr.back} onClick={onBack} className={ICON_BUTTON}>
          <ChevronLeft aria-hidden size={20} />
        </button>
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-(--tracking-brand-line) bg-(--tracking-brand-soft)"
        >
          <Bot size={15} className="text-(--tracking-brand)" />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h1>
        <button
          type="button"
          aria-label={frAgent.sessions}
          aria-pressed={listing}
          onClick={onList}
          className={`${ICON_BUTTON} aria-pressed:bg-(--tracking-muted)`}
        >
          <List aria-hidden size={20} />
        </button>
      </div>
    </header>
  );
}

function AgentConversationPane({
  project,
  presence,
  listing,
  onListed,
}: {
  project: ProjectSnapshot;
  presence: Presence;
  listing: boolean;
  onListed(): void;
}) {
  const chat = useAgentConversation(project, true);
  const openAgent = (runId: string) => {
    onListed();
    chat.openAgent(runId);
  };
  const placeholder = chat.hasSession
    ? frProjectAgent.compose.placeholder
    : frProjectAgent.compose.empty(project.meta.name);
  return (
    <>
      <main className="relative flex min-h-0 flex-1 flex-col">
        {chat.error ? (
          <p role="alert" className="border-b px-4 py-2 text-[13px] text-destructive">
            {frProjectAgent.loadFailed}
          </p>
        ) : null}
        <QuestionLinksContext.Provider value={chat.links}>
          <ConversationView
            items={chat.items}
            status={chat.status}
            readOnly={chat.readOnly || !isWritable(presence)}
            labels={chat.labels}
            onTicket={chat.openTicket}
            onRetry={chat.retry}
            onResend={chat.resend}
            onDecide={chat.decide}
          />
        </QuestionLinksContext.Provider>
        {listing ? <AgentSessions items={chat.agents} selected={chat.selected} onOpen={openAgent} /> : null}
      </main>
      {chat.readOnly ? (
        <PastSessionBar startedAt={chat.pastStartedAt} onBack={chat.back} />
      ) : (
        <AgentCompose presence={presence} placeholder={placeholder} onSend={chat.send} />
      )}
    </>
  );
}

export function AgentScreen({ projectId, projectName, presence, onBack }: ScreenProps) {
  const project = useProjectSnapshot(projectId);
  const [listing, setListing] = useState(false);
  return (
    <div className="phone-agent contents">
      <AgentTopBar
        title={frProjectAgent.header.title(projectName)}
        listing={listing}
        onBack={onBack}
        onList={() => setListing(!listing)}
      />
      <OfflineBand presence={presence} />
      {project ? (
        <AgentConversationPane
          project={project}
          presence={presence}
          listing={listing}
          onListed={() => setListing(false)}
        />
      ) : (
        <p className="p-4 text-[15px] text-(--tracking-mfg)">{fr.loading}</p>
      )}
    </div>
  );
}
