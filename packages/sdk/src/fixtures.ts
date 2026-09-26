import { type Assignee, KiboError, type ProjectCommand, type StatusId, Ticket } from "@kibo/schema";

type Row = [number, string, number | null, StatusId, string | null];

const ROWS: Row[] = [
  [3, "Noyau de données", null, "in_progress", null],
  [4, "Orchestration des agents", null, "in_progress", null],
  [5, "Monorepo Bun workspaces", null, "done", "adam"],
  [6, "UI de base", null, "in_progress", null],
  [7, "Tokens shadcn + thème sombre", 6, "in_review", "adam"],
  [9, "Setup Tauri + sidecar Bun", null, "todo", "adam"],
  [10, "Watcher git et gh", null, "in_progress", "agent:opus-dev"],
  [11, "Démon : auth par jeton local", null, "in_review", "adam"],
  [12, "Schéma Loro des tickets (LoroTree)", 3, "in_progress", "agent:opus-dev-1"],
  [13, "Snapshots Loro ↔ SQLite", 3, "done", "adam"],
  [14, "Récepteur de hooks Claude Code", 4, "in_progress", "agent:opus-dev-2"],
  [15, "Kanban : drag & drop entre colonnes", 6, "todo", "adam"],
  [16, "Moteur de règles déclaratif", 4, "in_progress", "agent:opus-dev-3"],
  [18, "Adaptateur GitHub Issues", null, "todo", "agent:opus-dev"],
  [21, "Sandbox iframe des composants", null, "blocked", "adam"],
  [22, "Export Markdown / Obsidian", null, "backlog", "adam"],
  [24, "Types Zod Ticket / Link / Status", 12, "done", "agent:opus-dev-1"],
  [25, "Opérations move / reparent", 12, "done", "agent:opus-dev-1"],
  [26, "Index SQLite dérivé", 12, "done", "agent:opus-dev-1"],
  [27, "Tests de convergence (fast-check)", 12, "in_progress", "agent:opus-dev-1"],
  [28, "Générateur d'opérations concurrentes", 27, "in_progress", "agent:haiku-tests"],
  [29, "Migration v0 → v1", 12, "todo", "agent:opus-dev"],
];

const BLOCKS: [number, number][] = [
  [5, 12],
  [13, 12],
  [12, 15],
  [11, 21],
  [21, 22],
  [16, 22],
];

const LAST_KEY = 29;
const BLOCKED_REASON = "Audit sécurité externe en attente";

const assignee = (ref: string | null, viewer: string): Assignee | null => {
  if (ref === null) return null;
  if (ref.startsWith("agent:")) return { kind: "agent", ref: ref.slice("agent:".length) };
  return { kind: "human", ref: ref === "adam" ? viewer : ref };
};

export function seedDemo(run: (cmd: ProjectCommand) => unknown, viewer = "adam"): Record<string, string> {
  const ids: Record<string, string> = {};
  const idOf = (n: number) => ids[`KIB-${n}`] ?? "";
  const fillers: string[] = [];
  for (let n = 1; n <= LAST_KEY; n += 1) {
    const row = ROWS.find((r) => r[0] === n);
    const parent = row?.[2] ?? null;
    const status = row?.[3] ?? "todo";
    const ticket = Ticket.parse(
      run({
        method: "createTicket",
        title: row?.[1] ?? "—",
        parentId: parent === null ? null : idOf(parent),
        assignee: assignee(row?.[4] ?? null, viewer),
        ...(status !== "blocked" && { statusId: status }),
      }),
    );
    if (!row) fillers.push(ticket.id);
    else if (ticket.key === null) throw new KiboError("INTERNAL", "demo tickets need local keys");
    else ids[ticket.key] = ticket.id;
    if (row && status === "blocked") {
      run({ method: "setStatus", ticketId: ticket.id, statusId: "blocked", reason: BLOCKED_REASON });
    }
  }
  for (const id of fillers) run({ method: "deleteTicket", ticketId: id });
  for (const [from, to] of BLOCKS) run({ method: "addLink", from: idOf(from), to: idOf(to), type: "blocks" });
  run({ method: "addLink", from: idOf(12), to: idOf(16), type: "relates" });
  return ids;
}

export const DEMO_NOTES: Record<string, string> = {
  "decisions-architecture.md": `# Décisions d'architecture

## Stockage

On garde Loro comme CRDT : c'est le seul à gérer nativement le déplacement dans un arbre, indispensable pour les sous-tickets en profondeur illimitée.

Voir KIB-12 et KIB-13.

## Agents

- L'état vient uniquement des hooks Claude Code (KIB-14)
- Un jeton par run pour le récepteur
- Réponse à un agent = --resume sessionId

\`\`\`sh
claude -p --settings .kibo/run-42/settings.json \\
  --append-system-prompt-file brief.md
\`\`\`
`,
  "journal-agents.md":
    "# Journal agents\n\nRelire [[decisions-architecture]] avant de brancher le récepteur.\n",
  "idees-composants.md":
    "# Idées composants\n\n- Burndown, voir [[decisions-architecture]]\n- Graphe, voir [[decisions-architecture]]\n",
  "reunion-kick-off.md": "# Réunion kick-off\n\nPremière réunion de cadrage.\n",
};

export const DEMO_NOTE_AGES: Record<string, number> = {
  "decisions-architecture.md": 0,
  "journal-agents.md": 1,
  "idees-composants.md": 4,
  "reunion-kick-off.md": 8,
};
