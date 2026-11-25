type ToastKind = "message" | "success" | "error" | "info" | "warning";
type ToastAction = { label: string; onClick(): void };
type ToastOptions = { action?: ToastAction; description?: string };

export type PhoneToast = {
  id: number;
  kind: ToastKind;
  message: string;
  description: string | null;
  action: ToastAction | null;
};

const listeners = new Set<(toast: PhoneToast) => void>();
let lastId = 0;

const show =
  (kind: ToastKind) =>
  (message: string, options: ToastOptions = {}): number => {
    lastId += 1;
    const shown = {
      id: lastId,
      kind,
      message,
      description: options.description ?? null,
      action: options.action ?? null,
    };
    for (const l of [...listeners]) l(shown);
    return lastId;
  };

export const toast = Object.assign(show("message"), {
  message: show("message"),
  success: show("success"),
  error: show("error"),
  info: show("info"),
  warning: show("warning"),
});

export function onPhoneToast(listener: (toast: PhoneToast) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
