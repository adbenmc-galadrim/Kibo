import json, re, sys, subprocess, collections
import os
D = sys.argv[1]
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = open(W + "/scripts/01-base.js").read()
def pal(mode):
    m = re.search(mode + r": \{(.*?)\}", base, re.S).group(1)
    return dict(re.findall(r"(\w+): \"(#[0-9A-Fa-f]{6})\"", m))
PD, PL = pal("dark"), pal("light")
ORDER = ["bg","panel","card","muted","hover","border","soft","fg","mfg","dim","faint","primary","pfg","brand","brandBtn","brandSoft","brandLine","brandText","blue","purple","green","red","amber","blueSoft","purpleSoft","greenSoft","redSoft","amberSoft","hold","holdSoft","track","grid","canvas"]
def tok(hd, hl):
    if hd is None: return "—"
    a, op = (hd.split("@") + [None])[:2]
    b = hl.split("@")[0] if hl else None
    ks = [k for k in ORDER if PD.get(k, "").upper() == a.upper() and (b is None or PL.get(k, "").upper() == b.upper())]
    s = ks[0] if ks else (a if (b is None or a.upper() == b.upper()) else f"{a} / {b}")
    return s + (f" ({op} %)" if op else "")
SCREENS = [(1, "P1 bis · Vue d'ensemble", "proposition-vue-ensemble-v2"), (2, "P2 · Planning", "proposition-planning"), (3, "P3 · Fonctionnalité", "proposition-fonctionnalite"), (5, "P5 · Graphe", "proposition-graphe")]
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
    (18, "P8 · Fiche ticket · en attente", "proposition-attente-fiche-ticket"), (19, "P8c · Mettre en attente", "proposition-attente-dialogue"),
    (20, "P8d · Fiche ticket, menu", "proposition-attente-fiche-menu"), (21, "P8e · Fiche ticket en attente, menu", "proposition-attente-fiche-menu-reprendre"),
    (22, "P2b · Planning, Reprendre dans", "proposition-attente-planning-menu")]
MARK29 = "\n## Phase 29\n"
SCREENS_A2 = [(23, "P9b · Questions, menu", "proposition-questions-menu"), (24, "P9c · Supprimer la question", "proposition-questions-supprimer"),
    (25, "P9d · Questions, répondues", "proposition-questions-repondues")]
MARK_A2 = "\n## 0.29.0-alpha.2\n"
SCREENS_A3 = []
MARK_A3 = "\n## 0.29.0-alpha.3\n"
SCREENS30 = [(27, "P5b · Graphe, Fonctionnalités", "proposition-graphe-fonctionnalites"), (28, "P5c · Graphe, PRs", "proposition-graphe-prs"),
    (29, "P5e · Graphe, aucune PR", "proposition-graphe-prs-vide"), (30, "P8f · Fiche ticket, Maquettes", "proposition-fiche-ticket-maquettes"),
    (31, "P8g · Maquette en plein écran", "proposition-apercu-maquette")]
MARK30 = "\n## Phase 30\n"
SCREENS31 = [(32, "P5b · Graphe · en attente", "proposition-attente-graphe"), (33, "P1 bis · Agent agrandi", "proposition-agent-agrandi")]
MARK31 = "\n## Phase 31\n"
SCREENS34 = [(34, "P34 · Aujourd'hui", "proposition-p34-aujourdhui"),
    (35, "P34 · Vue d'ensemble, livrée aujourd'hui", "proposition-p34-vue-ensemble-livree"),
    (36, "P34 · Planning", "proposition-p34-planning"),
    (37, "P34 · Graphe, Tout voir", "proposition-p34-graphe-tout-voir"),
    (38, "P34 · Graphe, F5 redépliée", "proposition-p34-graphe-redeplie"),
    (39, "P34 · Kanban, colonne vide repliée", "proposition-p34-kanban-replie"),
    (40, "P34 · Kanban, infobulle", "proposition-p34-kanban-infobulle"),
    (41, "P34 · Kanban, Lancer dans T3", "proposition-p34-kanban-survol-t3"),
    (42, "P34 · Questions", "proposition-p34-questions"),
    (43, "P34 · Questions, Q14 dépliée", "proposition-p34-questions-depliee"),
    (44, "P34 · Fiche ticket", "proposition-p34-fiche-ticket"),
    (45, "P34 · Fiche ticket, confirmation", "proposition-p34-fiche-confirmation"),
    (46, "P34 · Fiche ticket, T3 en cours", "proposition-p34-fiche-lancee"),
    (47, "P34 · Fiche ticket, T3 attend", "proposition-p34-fiche-attend"),
    (48, "P34 · Fiche ticket, clé copiée", "proposition-p34-fiche-copiee"),
    (49, "P34 · Toast de livraison", "proposition-p34-toast-livree"),
    (50, "P34 · Récapitulatif de sprint", "proposition-p34-recap-sprint"),
    (51, "P34 · Code couleur", "proposition-p34-couleurs")]
MARK34 = "\n## Phase 34\n"
if "--sections" in sys.argv:
    wanted = sys.argv[sys.argv.index("--sections") + 1].split(",")
    cur = open(W + "/cotes.md").read()
    for i, name, png in SCREENS + SCREENS27 + SCREENS29 + SCREENS_A2 + SCREENS_A3 + SCREENS30 + SCREENS31 + SCREENS34:
        if str(i) not in wanted: continue
        where = "" if (i, name, png) in SCREENS27 + SCREENS29 + SCREENS_A2 + SCREENS_A3 + SCREENS30 + SCREENS31 + SCREENS34 else f" ; écran 2{10 + i - 1 if i > 1 else 10} de la page « 35 · Redesign Silo » du fichier « Kibo »"
        start = cur.index(f"\n## {name}\n") + 1
        nxt = re.search(r"\n## ", cur[start + 3:]); end = start + 3 + nxt.start() + 1 if nxt else len(cur)
        cur = cur[:start] + screen_md(i, name, png, where) + ("\n\n" if nxt else "\n") + cur[end:]
    open(W + "/cotes.md", "w").write(cur)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase34" in sys.argv:
    cur = open(W + "/cotes.md").read()
    cur = cur.split(MARK34)[0].rstrip("\n") + "\n"
    intro = ["## Phase 34", "", "Aujourd'hui, fin de parcours et lancement dans T3 (spec §50), données de la section « Phase 34 · Aujourd'hui, fin de parcours et lancement dans T3 » de `design/donnees-fictives.md`, horloge au vendredi 16 octobre (S42). Les dix-huit boards sont sur la page « Phase 34 » du fichier « Kibo · Redesign » (`scripts/61-phase-34.js`) : chacun clone sa référence de la page « Proposition » (copie « src · … » rangée à x = −20 000) ou est dessiné de zéro (Aujourd'hui, code couleur), puis reçoit les patchs de la phase. Rangées de 1 600 px à partir de y = 0, sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` par board (`_dump-34` à `_dump-51`), puis `python3 scripts/cotes.py <dossier des JSON> --phase34`, qui remplace cette partie seulement. Les boards de la page « Proposition » redessinés en place (Vue d'ensemble, Planning, Fonctionnalité, Graphe, Kanban, Questions, fiche ticket, variantes en attente) sont relevés à leur place (`--sections 1,2,3,6,8,…,33`)."]
    parts = [screen_md(i, name, png, "").replace("page « Proposition »", "page « Phase 34 »", 1) for i, name, png in SCREENS34]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n")
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase31" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail34 = (MARK34 + cur.split(MARK34)[1]) if MARK34 in cur else ""
    cur = cur.split(MARK34)[0].split(MARK31)[0].rstrip("\n") + "\n"
    intro = ["## Phase 31", "", "Étapes en attente visibles en cyan (spec §45), données de la sous-section « Phase 31 · Graphe en attente et couleur de l'attente » du projet Silo (`design/donnees-fictives.md`, scénario `silo-graphe`). Jeton `hold` (`#22D3EE` / `#0E7490`) et `holdSoft` (`#082F35` / `#ECFEFF`) dans `scripts/01-base.js`. Le board clone « P5b · Graphe, Fonctionnalités » (`scripts/59c-graphe-attente.js`) : F1 renommée « Connexion, environnements et hébergement » sur trois lignes (cadre de 96 px, F2 descendue de 15 px) ; F4 livrée ne garde que la ligne SILO-45 en attente (cadre de 212 × 96, « 3/4 ⏸ 1 ✓ ») ; F5 « 1/2 ⏸ 3 » sans pied « en retard » ; F7 « 0/4 ⏸ 1 » ; points, ⏸ et segments en `hold` ; flèches recalculées (ancre à 38 px du haut des cadres). Rangée à y = 51 500 (après P8g), sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` (`_dump-32`), puis `python3 scripts/cotes.py <dossier des JSON> --phase31`, qui remplace cette partie seulement. Comparaison au pixel : « attente-graphe » (`silo-graphe`, masques de « graphe »). Agent de projet en conversation (spec §46), données de la sous-section « Phase 31 · Agent de projet en conversation » : « P1 bis · Agent agrandi » clone « P1 bis v3 · Vue d'ensemble », lui rend sa pleine largeur sans volet étroit (grille des échéances étirée) et pose par-dessus le volet de 720 px en calque à droite, ombre portée vers la gauche (décision d'Adam du 2026-10-21, `scripts/59d-agent-conversation.js`) : en-tête de 56 px (« Agent de projet · Silo », boutons `panelLeftClose`, `plus`, `minimize2`, `x`), liste des agents de 210 px (fond `bg`, bord droit `border`, « Nouvel agent » de 32 px, items de 56 px, agent en cours sur `panel` avec « en cours » en `brandText`), conversation dans la colonne de lecture (bulle d'Adam de 240 px à droite, réponse de l'agent, « Lu : … », lot n° 7) et saisie en pied ; la page n'est jamais compressée. Rangée à y = 53 000 (après P5b · en attente). Relevé `_dump-33`. Comparaison au pixel : « agent-agrandi » (`silo-maquettes`). « Agent de projet, volet » (340 × 1 000, liste ouverte par-dessus la conversation) et « Agent de projet, agrandi, liste rétractée » (720 × 1 000) sont des références visuelles sans cotes. Le volet étroit de P1 bis v3, « En retard », P6 et « Vue d'ensemble · en attente » est redessiné en conversation et relevé à sa place (`--sections 6,13,8,14`). P5b (légende « En attente ») et les quatre boards « … · en attente » de la phase 29 (Vue d'ensemble, Planning, Fonctionnalité, Kanban) sont redessinés par leurs scripts et relevés à leur place (`--sections 14,15,16,17,27`)."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS31]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail34)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase30" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail31 = (MARK31 + cur.split(MARK31)[1]) if MARK31 in cur else ""
    cur = cur.split(MARK31)[0].split(MARK30)[0].rstrip("\n") + "\n"
    intro = ["## Phase 30", "", "Graphe simplifié et vue des PR (spec §44), données de la sous-section « Phase 30 · PR empilées » du projet Silo (`design/donnees-fictives.md`). Les trois boards clonent « P5 · Graphe » (`scripts/59-graphe-prs.js`) : la barre ne garde que le sélecteur « Fonctionnalités | PRs » et le compteur ; P5b garde les colonnes par sprint, P5c dessine les piles de PR de bas en haut sur le rail « dev · branche de base », P5e l'état vide « Aucune PR ouverte ». La variante P5d (PR par fonctionnalité) est écartée. Rangées à partir de y = 44 000 (pas de 1 500 px), sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` par board (`_dump-27` à `_dump-29`), puis `python3 scripts/cotes.py <dossier des JSON> --phase30`, qui remplace cette partie seulement. Comparaison au pixel sur P5b (« graphe », `silo-maquettes`) et P5c (« graphe-prs », `silo-prs`) ; P5e a une capture seulement.", "", "Plein écran des maquettes de la fiche ticket (spec §44.8), données de la sous-section « Phase 30 · Aperçu de maquette » (`scripts/59b-apercu-maquette.js`, rangées à y = 48 500 et 50 000) : P8f clone « P8 · Fiche ticket », ouvre la section « Maquettes » (propriété « Maquette », vignette du cadre « Conflit de saisie », « Plein écran » en tête des actions, champ « Lier un cadre ») et défile le corps de la feuille jusqu'à elle ; P8g est la vue plein écran (barre de 40 px, visualiseur `muted`, cadre de 444 × 960 à l'échelle 1 en (498, 40), barre de zoom « 100 % »). Relevé `_dump-30` et `_dump-31`. Comparaison au pixel sur P8g (« apercu-maquette », `silo-apercu`, aucun masque) ; P8f a une capture seulement ; le cadre seul est exporté dans `proposition-apercu-maquette-cadre.png`, image du faux Figma."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS30]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail31)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--alpha3" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail30 = (MARK30 + cur.split(MARK30)[1]) if MARK30 in cur else ""
    cur = cur.split(MARK30)[0].split(MARK_A3)[0].rstrip("\n") + "\n"
    intro = ["## 0.29.0-alpha.3", "", "Réveil de l'agent de projet sur une réponse (spec §43). Le board « Agent · réveil sur réponse » est retiré avec la vue Suivi (spec §46.3) : un réveil est une ligne discrète de la conversation (voir « Phase 31 »). Sa rangée (y = 42 500) reste réservée ; `python3 scripts/cotes.py <dossier des JSON> --alpha3` réécrit cette partie seulement."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS_A3]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail30)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--alpha2" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail_a3 = (MARK_A3 + cur.split(MARK_A3)[1]) if MARK_A3 in cur else ""
    cur = cur.split(MARK_A3)[0].split(MARK_A2)[0].rstrip("\n") + "\n"
    intro = ["## 0.29.0-alpha.2", "", "Questions sans transmission et suppression d'une question (spec §42), données de la sous-section « 0.29.0-alpha.2 » du projet Silo (`design/donnees-fictives.md`). Chaque board clone « P9 · Questions » sans l'aperçu d'export ni le toast (`scripts/57-alpha2-questions.js`) : P9b ouvre le menu « ⋯ » de Q16, P9c pose le dialogue de suppression de Q16 sur fond assombri, P9d montre le filtre « Répondues » avec la réponse de Q16. Rangées à partir de y = 38 000 (pas de 1 500 px), sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` par board (`_dump-23` à `_dump-25`), puis `python3 scripts/cotes.py <dossier des JSON> --alpha2`, qui remplace cette partie seulement. Pas de comparaison au pixel (capture seulement) ; P9 et sa référence ne changent pas."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS_A2]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail_a3)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase29" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail_a2 = (MARK_A2 + cur.split(MARK_A2)[1]) if MARK_A2 in cur else ""
    cur = cur.split(MARK29)[0].rstrip("\n") + "\n"
    intro = ["## Phase 29", "", "Étapes en attente (spec §41), données `silo-attente` (section « Phase 29 · étapes en attente » de `design/donnees-fictives.md`). Chaque board clone la référence pixel de son écran (P1 bis v3, P2, P3, P7, P8) puis y pose l'attente (`scripts/56-phase-29.js`) ; P8c pose le dialogue « Mettre SILO-82 en attente » sur le Kanban en attente. Rangées à partir de y = 24 500 (pas de 1 500 px), sombre à x = 0, clair à x = 1 540. Relevé : `scripts/95-cotes.js` par board, puis `python3 scripts/cotes.py <dossier des JSON> --phase29`, qui remplace cette partie seulement. Le dialogue et les menus (P8d, P8e, P2b) n'ont pas de comparaison au pixel (capture seulement)."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS29]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail_a2)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
if "--phase27" in sys.argv:
    cur = open(W + "/cotes.md").read()
    tail29 = (MARK29 + cur.split(MARK29)[1]) if MARK29 in cur else ""
    cur = cur.split(MARK27)[0].rstrip("\n") + "\n"
    intro = ["## Phase 27", "", "Boards de la phase 27 (spec §39, §39.6), relevés comme les précédents : `scripts/95-cotes.js` par board, puis `python3 scripts/cotes.py <dossier des JSON> --phase27`, qui remplace cette partie seulement. Rangées à partir de y = 8 000 (pas de 1 500 px). Mêmes tokens, polices et règles qu'en tête ; horloge figée au vendredi 16 octobre (S42), sauf la variante « En retard au 18 oct. » (dimanche, S42 terminé), données `silo-maquettes`. La barre repliée (`exports/proposition-barre-repliee-*.png`, 1 180 × 1 000) sert de référence visuelle, sans cotes ni comparaison au pixel. Le volet de l'agent de projet de P1 bis v3, de « En retard » et de P6 est la conversation de la phase 31 (spec §46, voir « Phase 31 ») ; les boards « Agent · question » et « Agent · récapitulatif » sont retirés."]
    parts = [screen_md(i, name, png, "") for i, name, png in SCREENS27]
    open(W + "/cotes.md", "w").write(cur + "\n" + "\n".join(intro) + "\n\n" + "\n\n".join(parts) + "\n" + tail29)
    print(sum(1 for _ in open(W + "/cotes.md")))
    sys.exit(0)
for i, name, png in SCREENS:
    screens_md.append(screen_md(i, name, png, f" ; écran 2{10 + i - 1 if i > 1 else 10} de la page « 35 · Redesign Silo » du fichier « Kibo »"))
head = ["# Cotes du redesign", "",
 "Relevé automatique des boards validés (P1 bis, P2, P3, P5 ; P4 · Tickets retiré en phase 33) par l'API du plugin Penpot (`penpotUtils.findShapes`, géométrie, `flex`, `layoutChild`, polices et remplissages), sombre et clair comparés nœud à nœud. Source : page « Proposition » du fichier « Kibo · Redesign » ; copie identique en page « 35 · Redesign Silo » du fichier « Kibo » (écrans 210 à 214, sans 213). Relevé : `scripts/95-cotes.js` dans le plugin (un board par appel, JSON reçu par `receiver.py`), puis `python3 scripts/cotes.py <dossier des JSON>`.",
 "", "Horloge figée : vendredi 16 octobre (S42, 12–16 oct.), dernière activité à 15:04, « Suivi à jour · il y a 4 min ». Les données affichées sont listées exactement par écran (section « Données affichées ») ; une fixture e2e doit les reproduire.",
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
