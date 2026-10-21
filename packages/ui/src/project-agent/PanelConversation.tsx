import { frProjectAgent } from "../i18n/fr-project-agent";
import { QuestionLinksContext } from "../moments/QuestionText";
import { ComposeBox } from "./ComposeBox";
import { ConversationView } from "./ConversationView";
import { NewAgentButton } from "./NewAgentButton";
import { PastBanner } from "./PastBanner";
import type { AgentConversation } from "./use-agent-conversation";

type Props = {
  projectId: string;
  projectName: string;
  chat: AgentConversation;
  inert?: boolean;
  onNew(): void;
};

export function PanelConversation({ projectId, projectName, chat, inert, onNew }: Props) {
  return (
    <div inert={inert} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {chat.readOnly && chat.pastStartedAt !== null && (
        <PastBanner startedAt={chat.pastStartedAt} onBack={chat.back} />
      )}
      <QuestionLinksContext.Provider value={chat.links}>
        <ConversationView
          items={chat.items}
          status={chat.status}
          readOnly={chat.readOnly}
          labels={chat.labels}
          signals={chat.signals}
          onTicket={chat.openTicket}
          onRetry={chat.retry}
          onResend={chat.resend}
          onDecide={chat.decide}
        />
      </QuestionLinksContext.Provider>
      {chat.readOnly ? (
        <NewAgentButton variant="block" canReset={chat.canReset} onNew={onNew} />
      ) : (
        <ComposeBox
          projectId={projectId}
          placeholder={
            chat.hasSession ? frProjectAgent.compose.placeholder : frProjectAgent.compose.empty(projectName)
          }
          onSend={chat.send}
        />
      )}
    </div>
  );
}
