import { AgentText } from "./AgentText";

export function MessageMoment({ text, onTicket }: { text: string; onTicket?: (key: string) => void }) {
  return <AgentText text={text} onTicket={onTicket} className="text-sm leading-relaxed" />;
}
