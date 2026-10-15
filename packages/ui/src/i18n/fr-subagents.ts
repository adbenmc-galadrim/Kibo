const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const MINUTE = 60_000;

function duration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return `${Math.max(0, Math.floor(ms / 1000))} s`;
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest}`;
}

export const frSubagents = {
  duration,
  label: "Sous-agent",
  running: (ms: number) => `en cours depuis ${duration(ms)}`,
  done: (ms: number) => `terminé en ${duration(ms)}`,
  failed: "échec",
  prompt: "Voir le prompt",
  promptSize: (n: number) => `${n.toLocaleString("fr-FR")} caractères`,
  stateLabel: "État",
  model: "Modèle",
  requested: (model: string) => `${model} (demandé)`,
  result: (text: string) => `Résumé : ${text}`,
  actions: (n: number) => plural(n, "action", "actions"),
  title: (type: string, description: string, state: string) =>
    `Sous-agent ${type} · ${description} · ${state}`,
  detail: (state: string, actions: number) => `${state} · ${plural(actions, "action", "actions")}`,
  inProgress: "en cours",
  nested: {
    label: (type: string) => `Actions du sous-agent ${type}`,
    loading: "Chargement des actions…",
    failed: "Impossible de charger les actions du sous-agent.",
    empty: "Aucune action pour l'instant.",
  },
  line: (description: string, ms: number) => `· ${description} · ${duration(ms)}`,
  open: (type: string, description: string) => `Voir le sous-agent ${type} · ${description} dans le fil`,
  count: (total: number, running: number) =>
    [plural(total, "sous-agent", "sous-agents"), running > 0 && `${running} en cours`]
      .filter(Boolean)
      .join(" · "),
  section: {
    title: "Sous-agents",
    short: (total: number, running: number) =>
      running > 0 ? `${total} · ${running} en cours` : String(total),
    running: (ms: number) => `en cours · ${duration(ms)}`,
    done: (ms: number) => `terminé · ${duration(ms)}`,
    see: "Voir dans le fil",
    failed: "Impossible de charger les sous-agents.",
  },
} as const;
