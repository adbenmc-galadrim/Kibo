import type { ReactNode } from "react";
import { fr } from "../i18n/fr";

export const PRIMARY_BUTTON =
  "flex h-11 w-full items-center justify-center rounded-lg bg-(--tracking-fg) text-[15px] font-medium text-(--tracking-bg) disabled:opacity-60";

export function PhoneScreen({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col gap-6 bg-(--tracking-bg) px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="text-[17px] font-semibold">{fr.appName}</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-semibold">{title}</h1>
        {intro ? <div className="text-[15px] text-(--tracking-mfg)">{intro}</div> : null}
      </div>
      {children}
    </main>
  );
}
