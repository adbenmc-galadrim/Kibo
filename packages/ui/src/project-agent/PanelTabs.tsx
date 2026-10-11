import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import type { ReactNode } from "react";
import { frProjectAgent } from "../i18n/fr-project-agent";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";

type Props = {
  tab: ProjectAgentTab;
  open: number;
  onTab(tab: ProjectAgentTab): void;
  conversation: ReactNode;
  signals: ReactNode;
};

const t = frProjectAgent.tabs;
const TRIGGER = "flex-none px-3 text-sm";
const CONTENT = "flex min-h-0 flex-1 flex-col";

export function PanelTabs({ tab, open, onTab, conversation, signals }: Props) {
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTab(v === "signals" ? "signals" : "conversation")}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsList variant="line" aria-label={t.label} className="w-full justify-start border-b px-1">
        <TabsTrigger value="conversation" className={TRIGGER}>
          {t.conversation}
        </TabsTrigger>
        <TabsTrigger value="signals" className={TRIGGER}>
          {t.signals(open)}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="conversation" className={CONTENT}>
        {conversation}
      </TabsContent>
      <TabsContent value="signals" className={CONTENT}>
        {signals}
      </TabsContent>
    </Tabs>
  );
}
