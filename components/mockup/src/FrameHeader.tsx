import type { DesignFrame } from "@kibo/schema";
import type { ReactNode } from "react";
import { FrameBadges, OpenInButton, RefreshButton } from "./FrameTools";

type Props = { frame: DesignFrame; refreshing: boolean; onRefresh(): void; children?: ReactNode };

export function FrameHeader({ frame, refreshing, onRefresh, children }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-3 pt-2 pb-1">
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{frame.name}</p>
      <FrameBadges frame={frame} />
      {children}
      <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
      <OpenInButton frame={frame} />
    </div>
  );
}
