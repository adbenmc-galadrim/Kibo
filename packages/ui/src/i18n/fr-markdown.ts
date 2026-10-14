import type { MarkdownLabels } from "@kibo/sdk/markdown";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export const frMarkdown: MarkdownLabels = {
  table: "Tableau",
  expand: "Agrandir",
  expandTable: "Agrandir le tableau",
  size: (rows, columns) => `${plural(rows, "ligne", "lignes")} · ${plural(columns, "colonne", "colonnes")}`,
  copy: "Copier en Markdown",
  copied: "Copié",
  copyFailed: "Copie impossible : le presse-papiers est refusé.",
};
