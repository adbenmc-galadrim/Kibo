import type { ReactNode } from "react";
import { SettingsNav, type SettingsScreen } from "./SettingsNav";

export function SettingsLayout({ active, children }: { active: SettingsScreen; children: ReactNode }) {
  return (
    <div className="grid min-h-full grid-cols-1 content-start md:grid-cols-[14rem_1fr] md:content-stretch">
      <SettingsNav active={active} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
