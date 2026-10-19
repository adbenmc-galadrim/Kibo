import json, re, sys, subprocess, collections
import os
D = sys.argv[1]
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = open(W + "/scripts/01-base.js").read()
def pal(mode):
    m = re.search(mode + r": \{(.*?)\}", base, re.S).group(1)
    return dict(re.findall(r"(\w+): \"(#[0-9A-Fa-f]{6})\"", m))
PD, PL = pal("dark"), pal("light")
ORDER = ["bg","panel","card","muted","hover","border","soft","fg","mfg","dim","faint","primary","pfg","brand","brandBtn","brandSoft","brandLine","brandText","blue","purple","green","red","amber","blueSoft","purpleSoft","greenSoft","redSoft","amberSoft","track","grid","canvas"]
def tok(hd, hl):
    if hd is None: return "—"
    a, op = (hd.split("@") + [None])[:2]
    b = hl.split("@")[0] if hl else None
    ks = [k for k in ORDER if PD.get(k, "").upper() == a.upper() and (b is None or PL.get(k, "").upper() == b.upper())]
    s = ks[0] if ks else (a if (b is None or a.upper() == b.upper()) else f"{a} / {b}")
    return s + (f" ({op} %)" if op else "")
SCREENS = [(1, "P1 bis · Vue d'ensemble", "proposition-vue-ensemble-v2"), (2, "P2 · Planning", "proposition-planning"), (3, "P3 · Fonctionnalité", "proposition-fonctionnalite"), (4, "P4 · Tickets", "proposition-tickets"), (5, "P5 · Graphe", "proposition-graphe")]
def size(png):
    o = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", png], capture_output=True, text=True).stdout
    return re.search(r"pixelWidth: (\d+)", o).group(1) + " × " + re.search(r"pixelHeight: (\d+)", o).group(1)
def num(v):
    v = float(v); return str(int(v)) if v == int(v) else str(v).replace(".", ",")
def tree(rows):
    root = None; stack = []
    for r in rows:
        r["kids"] = []
        while stack and stack[-1]["d"] >= r["d"]: stack.pop()
        if stack: stack[-1]["kids"].append(r)
        else: root = r
        stack.append(r)
    return root
def pad(p):
    return " ".join(num(x) for x in p) if len(set(p)) > 1 else num(p[0])
def line(r, l):
    g = f"x {num(r['x'])}, y {num(r['y'])}, {num(r['w'])} × {num(r['h'])}"
    if r["t"] == "text":
        c = r["c"].replace("\n", " ⏎ ")
        extra = []
        if r.get("ls") not in (None, "0"): extra.append("interlettrage " + num(r["ls"]))
        if r.get("tt") not in (None, "none"): extra.append("majuscules")
        if r.get("al") not in (None, "left"): extra.append("aligné " + r["al"])
        return f"« {c} » — {r['ff']} {num(r['fs'])} / {r['fw']}, interligne {num(r['lh'])}, couleur `{tok((r['col'] or [None])[0], (l.get('col') or [None])[0])}`" + ("".join(", " + e for e in extra)) + f" — {g}"
    if r.get("icon"):
        n = r["n"].replace("icon / ", "").replace("icon/", "")
        return f"icône `{n}` {num(r['w'])} px, `{tok(r.get('col'), l.get('col'))}` — {g}"
    parts = [f"**{r['n']}** ({ {'board':'bloc','rectangle':'rectangle','ellipse':'pastille'}.get(r['t'], r['t']) })", g]
    f = r.get("flex")
    if f: parts.append(f"flex {'ligne' if f['dir']=='row' else 'colonne'}, espacement {num(f['gap'])}, marges internes {pad(f['pad'])}, alignement {f['ai']}/{f['jc']}")
    if r.get("fill"): parts.append("fond `" + tok(r["fill"][0], (l.get("fill") or [None])[0]) + "`")
    if r.get("stroke"):
        sd = r["stroke"][0].split(" "); sl = (l.get("stroke") or [""])[0].split(" ")
        parts.append(f"bordure {num(sd[1])} `{tok(sd[0], sl[0] if sl[0] else None)}`" + (" " + sd[2] if len(sd) > 2 else ""))
    if r.get("r"): parts.append(f"rayon {num(r['r'])}")
    if r.get("lc") and r["lc"] != ["auto", "auto"]: parts.append("dimension " + "/".join({"fix":"fixe","fill":"remplit","auto":"auto"}[z] for z in r["lc"]))
    return " · ".join(parts)
def skip(r):
    return r["t"] == "board" and not r["kids"] and not r.get("fill") and not r.get("stroke")
def kids(r, l):
    f = r.get("flex"); key = (lambda p: (p[0]["x"], p[0]["y"])) if f and f["dir"] == "row" else (lambda p: (p[0]["y"], p[0]["x"]))
    return sorted(zip(r["kids"], l["kids"]), key=key)
def texts_of(r, l, acc):
    if r["t"] == "text": acc.append(r)
    for a, b in kids(r, l): texts_of(a, b, acc)
    return acc
def emit(r, l, depth, out):
    if skip(r): return
    out.append("  " * depth + "- " + line(r, l))
    pairs = kids(r, l)
    for a, b in pairs: emit(a, b, depth + 1, out)
out = []
used_fonts = collections.Counter(); used_colors = collections.Counter(); radii = collections.Counter(); gaps = collections.Counter()
screens_md = []
def screen_md(i, name, png, where):
    dk = json.load(open(f"{D}/_dump-{i}-dark.json"))[name]; lt = json.load(open(f"{D}/_dump-{i}-light.json"))[name + " (clair)"]
    assert len(dk) == len(lt), name
    td, tl = tree(dk), tree(lt)
    for a, b in zip(dk, lt):
        if a["t"] == "text":
            used_fonts[(a["ff"], num(a["fs"]), a["fw"], num(a["lh"]))] += 1
            used_colors[tok(a["col"][0] if a["col"] else None, b["col"][0] if b["col"] else None)] += 1
        for k in ("fill",):
            if a.get(k): used_colors[tok(a[k][0], b[k][0])] += 1
        if a.get("r"): radii[num(a["r"])] += 1
        if a.get("flex"): gaps[num(a["flex"]["gap"])] += 1
    md = [f"## {name}", "", f"Board `{name}` (sombre) et `{name} (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign »{where}.",
          f"Exports : `exports/{png}-dark.png` et `exports/{png}-light.png`, {size(W + '/exports/' + png + '-dark.png')} px (échelle 1).", "",
          "### Données affichées (ordre de lecture)", ""]
    texts = texts_of(td, tl, [])
    md += [f"{k + 1}. « {r['c'].replace(chr(10), ' ⏎ ')} » (x {num(r['x'])}, y {num(r['y'])})" for k, r in enumerate(texts)]
    md += ["", "### Blocs", "", "Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.", ""]
    emit(td, tl, 0, md)
    return "\n".join(md)
SCREENS27 = [(6, "P1 bis v3 · Vue d'ensemble", "proposition-vue-ensemble-v3"), (13, "P1 bis v3 · En retard au 18 oct.", "proposition-vue-ensemble-v3-retard"), (7, "P1 bis v3 · Pour commencer", "proposition-vue-ensemble-v3-pour-commencer"),
    (8, "P6 · Nouveau projet", "proposition-nouveau-projet"), (9, "P7 · Kanban", "proposition-kanban"), (10, "P8 · Fiche ticket", "proposition-fiche-ticket"),
    (11, "P8b · Fiche ticket, Activité", "proposition-fiche-ticket-activite"), (12, "P9 · Questions", "proposition-questions")]
MARK27 = "\n## Phase 27\n"
SCREENS29 = [(14, "P1 bis · Vue d'ensemble · en attente", "proposition-attente-vue-ensemble"), (15, "P2 · Planning · en attente", "proposition-attente-planning"),
    (16, "P3 · Fonctionnalité · en attente", "proposition-attente-fonctionnalite"), (17, "P7 · Kanban · en attente", "proposition-attente-kanban"),
    (18, "P8 · Fiche ticket · en attente", "proposition-attente-fiche-ticket"), (19, "P8c · Mettre en attente", "proposition-attente-dialogue")]
MARK29 = "\n## Phase 29\n"
if "--sections" in sys.argv:
    wanted = sys.argv[sys.argv.index("--sections") + 1].split(",")
    cur = open(W + "/cotes.md").read()
    for i, name, png in SCREENS + SCREENS27 + SCREENS29:
        if str(i) not in wanted: continue
        where = "" if (i, name, png) in SCREENS27 + SCREENS29 else f" ; écran 2{10 + i - 1 if i > 1 else 10} de la page « 35 · Redesign Silo » du fichier « Kibo »"
        start = cur.index(f"\n## {name}\n") + 1
        nxt = re.search(r"\n## ", cur[start + 3:]); end = start + 3 + nxt.start() + 1 if nxt else len(cur)
        cur = cur[:start] + screen_md(i, name, png, where) + ("\n\n" if nxt else "\n") + cur[end:]
    open(W + "/cotes.md", "w").write(cur)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase29" in sys.argv:
    cur = open(W + "/cotes.md").read()
    cur = cur.split(MARK29)[0].rstrip("\n") + "\n"
    intro = ["## Phase 29", "", "Étapes en attente (spec §41), données `silo-attente` (section « Phase 29 · étapes en attente » de `design/donnees-fictives.md`). Chaque board clone la référence pixel de son écran (P1 bis v3, P2, P3, P7, P8) puis y pose l'attente (`scripts/56-phase-29.js`) ; P8c pose le dialogue « Mettre SILO-82 en attente » sur le Kanban en attente. Rangées à partir de y = 24 500 (pas de 1 500 px), sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` par board, puis `python3 scripts/cotes.py <dossier des JSON> --phase29`, qui remplace cette partie seulement. Le dialogue n'a pas de comparaison au pixel (capture seulement)."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS29]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n")
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase27" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail29 = (MARK29 + cur.split(MARK29)[1]) if MARK29 in cur else ""
    cur = cur.split(MARK27)[0].rstrip("\n") + "\n"
    intro = ["## Phase 27", "", "Boards de la phase 27 (spec §39, §39.6), relevés comme les précédents : `scripts/95-cotes.js` par board, puis `python3 scripts/cotes.py <dossier des JSON> --phase27`, qui remplace cette partie seulement. Rangées à partir de y = 8 000 (pas de 1 500 px). Mêmes tokens, polices et règles qu'en tête ; horloge figée au vendredi 16 octobre (S42), sauf la variante « En retard au 18 oct. » (dimanche, S42 terminé), données `silo-maquettes`. La barre repliée (`exports/proposition-barre-repliee-*.png`, 1 180 × 1 000) et le panneau de l'agent (`exports/proposition-agent-{question,recap}-*.png`, 340 × 1 000) servent de référence visuelle, sans cotes ni comparaison au pixel."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS27]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail29)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
for i, name, png in SCREENS:
    screens_md.append(screen_md(i, name, png, f" ; écran 2{10 + i - 1 if i > 1 else 10} de la page « 35 · Redesign Silo » du fichier « Kibo »"))
head = ["# Cotes du redesign", "",
 "Relevé automatique des boards validés (P1 bis, P2 à P5) par l'API du plugin Penpot (`penpotUtils.findShapes`, géométrie, `flex`, `layoutChild`, polices et remplissages), sombre et clair comparés nœud à nœud. Source : page « Proposition » du fichier « Kibo · Redesign » ; copie identique en page « 35 · Redesign Silo » du fichier « Kibo » (écrans 210 à 214). Relevé : `scripts/95-cotes.js` dans le plugin (un board par appel, JSON reçu par `receiver.py`), puis `python3 scripts/cotes.py <dossier des JSON>`.",
 "", "Horloge figée : vendredi 16 octobre (S42, 12–16 oct.), dernière activité à 15:04, « Synchronisé · il y a 1 min », « Suivi à jour · il y a 4 min ». Les données affichées sont listées exactement par écran (section « Données affichées ») ; une fixture e2e doit les reproduire.",
 "", "Règles générales : écrans de 1 440 px de large ; barre latérale 240 px ; panneau de l'agent 340 px (P1 bis) ; barre du haut 48 px ; polices Geist et Geist Mono ; icônes Lucide, trait 2 px. Les blocs sans fond, bordure ni enfant (espaceurs) sont omis : les positions des voisins en tiennent compte.",
 "", "## Tokens de couleur", "", "| Token | Sombre | Clair |", "|---|---|---|"]
head += [f"| `{k}` | `{PD[k]}` | `{PL[k]}` |" for k in ORDER if k in PD]
head += ["", "Couleurs hors tokens relevées (hex sombre / clair) : " + ", ".join(sorted(f"`{c}`" for c in used_colors if c.startswith("#"))) + ".",
 "", "## Typographie utilisée", "", "| Famille | Taille | Graisse | Interligne | Occurrences |", "|---|---|---|---|---|"]
head += [f"| {f} | {s} | {w} | {l} | {n} |" for (f, s, w, l), n in sorted(used_fonts.items(), key=lambda kv: (kv[0][0], float(kv[0][1].replace(',', '.')), kv[0][2]))]
head += ["", "## Rayons et espacements", "", "Rayons relevés (px) : " + ", ".join(f"{r} ({n})" for r, n in sorted(radii.items(), key=lambda kv: float(kv[0].replace(',', '.')))) + ".",
 "", "Espacements flex relevés (px) : " + ", ".join(f"{g} ({n})" for g, n in sorted(gaps.items(), key=lambda kv: float(kv[0].replace(',', '.')))) + ".", ""]
open(W + "/cotes.md", "w").write("\n".join(head) + "\n" + "\n\n".join(screens_md) + "\n")
print(sum(1 for _ in open(W + "/cotes.md")))
