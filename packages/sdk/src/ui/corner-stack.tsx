import type { ReactNode } from "react";
import { createPortal } from "react-dom";

const SLOT = "corner-stack";

function cornerElement(): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-slot=${SLOT}]`);
  if (found !== null) return found;
  const created = document.createElement("div");
  created.dataset.slot = SLOT;
  created.className = "fixed right-[16px] bottom-[16px] z-50 flex flex-col items-end gap-[8px] empty:hidden";
  document.body.append(created);
  return created;
}

export function CornerStack({ children }: { children: ReactNode }) {
  return createPortal(children, cornerElement());
}
