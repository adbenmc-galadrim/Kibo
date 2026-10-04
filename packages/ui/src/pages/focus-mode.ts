export type FocusAction =
  | { type: "request"; id: string; allowed: boolean }
  | { type: "exit"; id: string }
  | { type: "escape"; dialogOpen: boolean };

export function focusReducer(current: string | null, action: FocusAction): string | null {
  switch (action.type) {
    case "request":
      return action.allowed ? action.id : current;
    case "exit":
      return current === action.id ? null : current;
    case "escape":
      return action.dialogOpen ? current : null;
  }
}

const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

export const dialogOpen = (doc: Document = document): boolean => doc.querySelector(OPEN_DIALOG) !== null;

export const FOCUSED_CARD = "fixed inset-0 z-50 flex flex-col bg-card";
