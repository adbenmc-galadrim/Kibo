export const frDelivery = {
  label: "Livraison",
  line: (step: number, max: number, label: string) => `Livraison : ${step}/${max} · ${label}`,
  retouchLine: (step: number, max: number, label: string) => `Retouche : ${step}/${max} · ${label}`,
  bar: (label: string) => `Étape de livraison : ${label}`,
  deliver: "Livrer",
  deliverChildren: "Livrer les sous-tickets",
  deliverHint: (brief: string) => `Lance ${brief}`,
};
