import { startReasonText } from "@kibo/schema";

export const deliveryTexts = {
  copy: (command: string) => `Copier ${command}`,
  copied: (waiting: readonly string[], question: string | null = null) =>
    [
      "Copié",
      ...(question ? [`bloqué par ${question}`] : []),
      ...(waiting.length > 0 ? [`attend ${waiting.join(", ")}`] : []),
    ].join(" · "),
  copiedBecause: (reason: string) => `Copié · ${reason}`,
  reason: startReasonText,
  copyFailed: "Copie impossible",
};
