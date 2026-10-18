import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kibo/sdk/ui/tabs";
import { type ReactNode, useState } from "react";
import { readSessionPref, writeSessionPref } from "../../agents/session-pref";
import { frMoments } from "../../i18n/fr-moments";

export const TICKET_TAB_KEY = "kibo.ticket.tab";
export type TicketTabId = "details" | "activity";

const TRIGGER = "flex-none px-3 text-sm";

const asTab = (value: string | null): TicketTabId => (value === "activity" ? "activity" : "details");

export function useTicketTab(): [TicketTabId, (tab: string) => void] {
  const [tab, setTab] = useState(() => asTab(readSessionPref(TICKET_TAB_KEY)));
  const choose = (value: string) => {
    const next = asTab(value);
    writeSessionPref(TICKET_TAB_KEY, next);
    setTab(next);
  };
  return [tab, choose];
}

type Props = { tab: TicketTabId; onTab(tab: string): void; details: ReactNode; activity: ReactNode };

export function TicketTabs({ tab, onTab, details, activity }: Props) {
  const t = frMoments.activity;
  return (
    <Tabs value={tab} onValueChange={onTab} className="gap-4">
      <TabsList variant="line" aria-label={t.tabs} className="w-full justify-start border-b">
        <TabsTrigger value="details" className={TRIGGER}>
          {t.details}
        </TabsTrigger>
        <TabsTrigger value="activity" className={TRIGGER}>
          {t.activity}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">{details}</TabsContent>
      <TabsContent value="activity">{activity}</TabsContent>
    </Tabs>
  );
}
