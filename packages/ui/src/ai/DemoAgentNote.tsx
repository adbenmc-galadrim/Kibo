import { Bot } from "lucide-react";
import { frAgentsPage } from "../i18n/fr-agents-page";

export function DemoAgentNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-brand-strong dark:text-brand">
      <Bot aria-hidden className="size-3.5" />
      {frAgentsPage.demo.option}
    </p>
  );
}
