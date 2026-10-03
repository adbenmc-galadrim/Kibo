import { COMPONENT_FORMATS, type ComponentFormat, FORMAT_SIZES, GRID_COLUMNS } from "@kibo/schema";

const REFERENCE_WIDTH = 1200;
const GAP = 16;
const ROW = 80;
const COLUMN = (REFERENCE_WIDTH - (GRID_COLUMNS - 1) * GAP) / GRID_COLUMNS;

export const FORMAT_LABELS: Readonly<Record<ComponentFormat, string>> = {
  small: "Petit",
  medium: "Moyen",
  large: "Large",
  half: "Demi-page",
  full: "Plein écran",
};

const span = (cells: number, unit: number) => Math.round(cells * unit + (cells - 1) * GAP);

const pixels = (f: ComponentFormat) => {
  const { w, h } = FORMAT_SIZES[f];
  return `≈ ${span(w, COLUMN)} × ${span(h, ROW)} px`;
};

const cells = (f: ComponentFormat) => `${FORMAT_SIZES[f].w} × ${FORMAT_SIZES[f].h}`;

export const formatLine = (f: ComponentFormat): string =>
  `${f} (${FORMAT_LABELS[f]}, ${cells(f)} cellules, ${pixels(f)})`;

export function formatTable(declared: readonly ComponentFormat[]): string {
  return [
    `| Format | Libellé | Cellules | Pixels à ${REFERENCE_WIDTH} px | Déclaré |`,
    "| --- | --- | --- | --- | --- |",
    ...COMPONENT_FORMATS.map(
      (f) =>
        `| ${f} | ${FORMAT_LABELS[f]} | ${cells(f)} | ${pixels(f)} | ${declared.includes(f) ? "oui" : "non"} |`,
    ),
  ].join("\n");
}

export const SKILL = `---
name: kibo-component
description: Écrire, tester et corriger un composant Kibo avec le SDK public.
---

# Composant Kibo

Un composant exporte \`Component\` depuis \`ui.tsx\`. Son manifeste \`kibo.component.json\` est écrit par Kibo.
Modèle complet à suivre : \`exemple.tsx\`, à côté de ce fichier.

## API du SDK (\`@kibo/sdk\`)

- \`useEntities("ticket" | "status" | "link" | "page" | "run" | "note" | "ci_run")\` : \`{ data, error, loading }\`, rechargé à chaque changement.
- \`useSdk()\` : \`{ instanceId, config, viewer, surface, format, list, run, subscribe, openTicket, openNewTicket, openFile, openView, data, fetch, action, notes, mcp }\`.
- \`sdk.format\` : le format dans lequel le composant est affiché (\`small\`, \`medium\`, \`large\`, \`half\`, \`full\`).
- \`sdk.run({ method: "createTicket", title })\`, \`sdk.run({ method: "setStatus", ticketId, statusId })\` : commandes du projet.
- \`sdk.data.get/set/delete/keys\` : données privées de l'instance (256 Kio).
- \`sdk.fetch("https://hôte/chemin")\` : HTTPS via le démon, réponse \`{ status, headers, body }\` (\`body\` texte) ; l'URL doit être un littéral.
- \`StatusDot({ statusId })\` et les primitives shadcn : \`@kibo/sdk/ui/button\`, \`card\`, \`badge\`, \`input\`, \`select\`, \`dialog\`…
- Serveur (\`server.ts\`, si présent) : \`defineServer({ actions, jobs })\` depuis \`@kibo/sdk/server\`.

Chaque argument de \`useEntities\`, \`sdk.list\`, \`sdk.run\`, \`sdk.fetch\` est un littéral : Kibo en déduit les permissions.

## Formats

Un tableau de bord est une grille de ${GRID_COLUMNS} colonnes ; à ${REFERENCE_WIDTH} px de large, une colonne ≈ ${Math.round(COLUMN)} px, une rangée ${ROW} px, un écart ${GAP} px.
Le composant s'affiche dans chacun de ses formats déclarés (tableau en fin de fichier) et doit rester lisible dans tous les autres.
Un format \`full\` sur une page vue occupe toute la page.

## Style

- Jetons seulement : \`bg-background\`, \`bg-card\`, \`bg-muted\`, \`text-foreground\`, \`text-muted-foreground\`, \`border\`, \`text-destructive\`.
- \`variant="agent"\` (bouton orange) est réservé aux actions qui lancent un agent.
- Jamais de couleur codée (\`bg-blue-500\`, \`#3b82f6\`, \`rgb(…)\`) : le thème sombre et le thème clair doivent fonctionner tous les deux.

## Responsive

- Racine en \`@container\` avec \`h-full min-h-0 overflow-auto\` : le composant remplit sa cellule et défile au besoin.
- Le corps occupe la hauteur du format : \`CardContent\` en \`flex min-h-0 flex-1 flex-col\` (il s'étire sous l'en-tête jusqu'au bas de la carte) ; une liste ou un graphe le remplit, un chiffre seul se centre avec \`justify-center\`.
- Variantes de conteneur \`@md:\` et \`@lg:\` plutôt que \`md:\` et \`lg:\` (la taille de la fenêtre ne dit rien de la cellule).
- \`sdk.format\` pour changer de disposition : un chiffre en \`small\`, une liste courte en \`medium\`, plus de détail au-delà.
- Jamais de largeur fixe en pixels (\`w-[480px]\`, \`min-w-[300px]\`, \`size-[300px]\`, \`width: 640px\`, \`style={{ width: 640 }}\`) : à partir de 240 px, la validation refuse le composant (« largeur fixe »). Un maximum (\`max-w-[960px]\`) ou une variante de conteneur (\`@lg:w-[320px]\`) reste permis.

## Tests

- \`component.test.tsx\` importe \`runConformance\` de \`@kibo/sdk/conformance\` et appelle \`runConformance({ manifest, Component })\` : ne le retire pas. La suite rend chaque format déclaré, en sombre et en clair.
- Ajoute tes tests dans des fichiers \`*.test.tsx\` avec \`createMockSdk(manifest, { seed, format })\` de \`@kibo/sdk/mock\` et \`@testing-library/react\`.
- Commande : \`kibo component test .\` (typecheck, tests, conformité, largeurs fixes, permissions).
`;

export const EXAMPLE_COMPONENT = `import { StatusDot, useEntities, useSdk } from "@kibo/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";

export function Component() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const statuses = useEntities("status");
  const open = tickets.data.filter((t) => t.statusId !== "done");
  const line = (t: (typeof open)[number]) => (
    <li key={t.id}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
        onClick={() => sdk.openTicket(t.id)}
      >
        <StatusDot statusId={t.statusId} />
        <span className="truncate text-foreground">{t.title}</span>
      </button>
    </li>
  );
  const body = () => {
    if (tickets.error) return <p className="text-sm text-destructive">Tickets indisponibles.</p>;
    if (open.length === 0) return <p className="text-sm text-muted-foreground">Aucun ticket ouvert.</p>;
    if (sdk.format === "small")
      return <p className="text-4xl font-semibold text-foreground @md:text-6xl">{open.length}</p>;
    if (sdk.format === "medium") return <ul className="flex flex-col">{open.slice(0, 5).map(line)}</ul>;
    return (
      <div className="grid gap-4 @lg:grid-cols-2">
        {[...statuses.data]
          .sort((a, b) => a.order - b.order)
          .filter((s) => open.some((t) => t.statusId === s.id))
          .map((s) => (
            <section key={s.id} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">{s.label}</h3>
              <ul className="flex flex-col">{open.filter((t) => t.statusId === s.id).map(line)}</ul>
            </section>
          ))}
      </div>
    );
  };
  return (
    <Card className="@container h-full min-h-0 overflow-auto bg-card">
      <CardHeader>
        <CardTitle>Tickets ouverts</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">{tickets.loading ? null : body()}</CardContent>
    </Card>
  );
}
`;
