import type { DenialItem } from "@kibo/schema";

const TARGET_SHOWN_MAX = 160;

const shown = (target: string): string =>
  target.length > TARGET_SHOWN_MAX ? `${target.slice(0, TARGET_SHOWN_MAX - 1)}…` : target;
const code = (text: string): string => (text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``);
const tilde = (path: string, home: string): string =>
  path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;

function proposal(item: DenialItem, home: string): string {
  if (item.rule !== null) return code(item.rule);
  if (item.addDir !== null) return `dossier ${code(tilde(item.addDir, home))}`;
  if (item.reason === "shell") return "à autoriser à la main (commande shell)";
  if (item.reason === "mcp") return "à autoriser à la main (outil MCP, dans le fichier de l'agent)";
  return "à autoriser à la main";
}

const line = (item: DenialItem, home: string): string =>
  `- ${code(shown(tilde(item.target, home)))} ⇒ ${proposal(item, home)}`;

export const denialTexts = {
  author: "kibo",
  title: (count: number): string =>
    count > 1 ? `${count} actions refusées pendant le run` : "1 action refusée pendant le run",
  context: (items: readonly DenialItem[], home: string): string =>
    [
      "Claude Code a refusé ces actions : personne ne pouvait les approuver pendant le run. Kibo propose :",
      "",
      ...items.map((item) => line(item, home)),
      "",
      "« Autoriser et relancer » ajoute les règles et les dossiers cochés à l'agent, puis relance le run.",
    ].join("\n"),
  answer: (rules: readonly string[], dirs: readonly string[]): string =>
    `Autorisé : ${rules.length > 0 ? rules.join(", ") : "aucune règle"} ; ${dirs.length > 0 ? dirs.join(", ") : "aucun dossier"}`,
};
