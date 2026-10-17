export const trackingFr = {
  months: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  today: "aujourd'hui",
  slip: (code: string) => `glisse en ${code}`,
  blocked: (ref: string) => `bloquée · ${ref}`,
  timeline: "Frise des fonctionnalités par sprint",
  legend: {
    done: "étape livrée",
    review: "en review",
    progress: "en cours",
    blocked: "bloquée",
    todo: "à faire",
    slipped: "glissement prévu",
  },
};

export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${trackingFr.months[d.getUTCMonth()] ?? ""}`;
}
