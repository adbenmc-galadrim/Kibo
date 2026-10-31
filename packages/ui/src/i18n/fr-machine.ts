export const frMachine = {
  title: "Machine",
  description: "Le démon local et ce que cette machine permet.",
  daemon: "Démon",
  daemonDetail: (address: string, home: string) => `${address} · données dans ${home}`,
  capacity: "Capacité",
  capacityDetail: (cores: number, ramGb: number, slots: number) =>
    `${cores} cœurs, ${ramGb} Go · ${slots} place${slots > 1 ? "s" : ""} pour l'agent de projet`,
  loading: "Lecture de la machine…",
} as const;
