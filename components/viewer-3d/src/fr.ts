export const fr = {
  empty: "Choisis un fichier .glb dans les réglages du widget.",
  missing: "Fichier introuvable sur cet appareil.",
  failed: "Le modèle n'a pas pu être chargé.",
  loading: "Chargement du modèle…",
  label: (name: string) => `Modèle 3D ${name}`,
  lighting: {
    toggle: "Éclairage",
    panel: "Réglages d'éclairage",
    preset: "Préréglage",
    presets: { soft: "Doux", studio: "Studio", contrast: "Contraste" },
    times: (v: number) =>
      `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}×`,
    saveFailed: "Réglage non enregistré.",
  },
};
