import type { StartReason } from "@kibo/schema";

export const deliveryTexts = {
  copy: (command: string) => `Copier ${command}`,
  copied: (waiting: readonly string[], question: string | null = null) =>
    [
      "Copié",
      ...(question ? [`bloqué par ${question}`] : []),
      ...(waiting.length > 0 ? [`attend ${waiting.join(", ")}`] : []),
    ].join(" · "),
  copiedBecause: (reason: string) => `Copié · ${reason}`,
  reason: (reason: StartReason): string | null => {
    switch (reason.kind) {
      case "dependency":
        return `attend ${reason.keys.join(", ")}`;
      case "question":
        return `bloqué par ${reason.label}`;
      case "sprint":
        return `sprint ${reason.code}`;
      case "unplanned":
        return "sans sprint";
      case "limit":
        return `limite ${reason.count}/${reason.limit} atteinte`;
      case "onHold":
        return reason.hold.source === "own"
          ? `en attente : ${reason.hold.reason}`
          : `en attente de ${reason.hold.key}`;
      case "status":
        return null;
    }
  },
  copyFailed: "Copie impossible",
};
