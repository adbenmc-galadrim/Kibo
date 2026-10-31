export const trackingFr = {
  months: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  today: "aujourd'hui",
  slip: (code: string) => `glisse en ${code}`,
  blocked: (ref: string) => `bloquée · ${ref}`,
  timeline: "Frise des fonctionnalités par sprint",
  legendLabel: "Légende",
  tip: {
    done: "livrée",
    todo: "à faire",
    progress: "en cours",
    review: (pr: number | null) => (pr === null ? "en review" : `en review · PR #${pr}`),
    blocked: (ref: string | null) => (ref === null ? "bloqué" : `bloqué · ${ref}`),
    hold: (reason: string | null) => (reason === null ? "en attente" : `en attente · ${reason}`),
    context: (feature: string, n: number, total: number, sprint: string | null) =>
      `${feature} · étape ${n} sur ${total}${sprint === null ? "" : ` · sprint ${sprint}`}`,
  },
  recap: {
    close: "Fermer",
    title: (code: string) => `Sprint ${code} terminé`,
    delivered: (n: number) => (n > 1 ? `${n} fonctionnalités livrées` : `${n} fonctionnalité livrée`),
    merged: (n: number) => (n > 1 ? `${n} étapes fusionnées` : `${n} étape fusionnée`),
    planned: (planned: number, capacity: number) => `sur ${planned} prévues · capacité ${capacity}`,
    slipsTo: (label: string, to: string) => `${label} passe en ${to}`,
    stays: (label: string) => `${label} reste à finir`,
    left: (n: number) => (n > 1 ? `${n} étapes restantes` : `${n} étape restante`),
    next: (code: string, range: string, steps: number) =>
      `Suivant : ${code} · ${range} · ${steps > 1 ? `${steps} étapes prévues` : `${steps} étape prévue`}`,
    openPlanning: "Ouvrir le planning",
  },
};

export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${trackingFr.months[d.getUTCMonth()] ?? ""}`;
}

export function shortRange(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${shortDate(end)}`
    : `${shortDate(start)} – ${shortDate(end)}`;
}
