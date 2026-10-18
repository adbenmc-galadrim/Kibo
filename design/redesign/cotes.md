# Cotes du redesign

Relevé automatique des boards validés (P1 bis, P2 à P5) par l'API du plugin Penpot (`penpotUtils.findShapes`, géométrie, `flex`, `layoutChild`, polices et remplissages), sombre et clair comparés nœud à nœud. Source : page « Proposition » du fichier « Kibo · Redesign » ; copie identique en page « 35 · Redesign Emis » du fichier « Kibo » (écrans 210 à 214). Relevé : `scripts/95-cotes.js` dans le plugin (un board par appel, JSON reçu par `receiver.py`), puis `python3 scripts/cotes.py <dossier des JSON>`.

Horloge figée : vendredi 16 octobre (S42, 12–16 oct.), dernière activité à 15:04, « Synchronisé · il y a 1 min », « Suivi à jour · il y a 4 min ». Les données affichées sont listées exactement par écran (section « Données affichées ») ; une fixture e2e doit les reproduire.

Règles générales : écrans de 1 440 px de large ; barre latérale 240 px ; panneau de l'agent 340 px (P1 bis) ; barre du haut 48 px ; polices Geist et Geist Mono ; icônes Lucide, trait **2 px à la taille affichée** : le SVG 24 × 24 (trait 2) est importé dans Penpot puis redimensionné sans mise à l'échelle du trait, donc une icône de 11 à 14 px garde un trait de 2 px réels (rendu plus gras qu'un Lucide par défaut) ; côté interface, `absoluteStrokeWidth` de `lucide-react` (ou `strokeWidth = 48 / taille`). Les blocs sans fond, bordure ni enfant (espaceurs) sont omis : les positions des voisins en tiennent compte.

## Tokens de couleur

| Token | Sombre | Clair |
|---|---|---|
| `bg` | `#09090B` | `#FFFFFF` |
| `panel` | `#0C0C0E` | `#FAFAFA` |
| `card` | `#111113` | `#FFFFFF` |
| `muted` | `#18181B` | `#F4F4F5` |
| `hover` | `#1C1C1F` | `#F4F4F5` |
| `border` | `#27272A` | `#E4E4E7` |
| `soft` | `#1F1F23` | `#EEEEF0` |
| `fg` | `#FAFAFA` | `#09090B` |
| `mfg` | `#A1A1AA` | `#52525B` |
| `dim` | `#71717A` | `#71717A` |
| `faint` | `#52525B` | `#A1A1AA` |
| `primary` | `#FAFAFA` | `#18181B` |
| `pfg` | `#18181B` | `#FAFAFA` |
| `brand` | `#F97316` | `#EA580C` |
| `brandBtn` | `#C2410C` | `#C2410C` |
| `brandSoft` | `#2A1406` | `#FFF7ED` |
| `brandLine` | `#7C2D12` | `#FDBA74` |
| `brandText` | `#FB923C` | `#C2410C` |
| `blue` | `#3B82F6` | `#2563EB` |
| `purple` | `#A855F7` | `#9333EA` |
| `green` | `#22C55E` | `#16A34A` |
| `red` | `#EF4444` | `#DC2626` |
| `amber` | `#F59E0B` | `#D97706` |
| `blueSoft` | `#0B1426` | `#EFF6FF` |
| `purpleSoft` | `#1A1024` | `#FAF5FF` |
| `greenSoft` | `#0D1F12` | `#F0FDF4` |
| `redSoft` | `#2A0F0F` | `#FEF2F2` |
| `amberSoft` | `#1F1608` | `#FFFBEB` |
| `track` | `#27272A` | `#E4E4E7` |
| `grid` | `#1A1A1D` | `#EDEDEF` |
| `canvas` | `#0B0B0D` | `#FAFAFA` |

Couleurs hors tokens relevées (hex sombre / clair) : `#14B8A6`, `#6366F1`, `#84CC16`, `#EC4899`, `#FFFFFF`.

## Typographie utilisée

| Famille | Taille | Graisse | Interligne | Occurrences |
|---|---|---|---|---|
| Geist | 10 | 600 | 1,2 | 5 |
| Geist | 10,5 | 500 | 1,2 | 16 |
| Geist | 11 | 400 | 1,2 | 15 |
| Geist | 11 | 500 | 1,2 | 5 |
| Geist | 11,5 | 400 | 1,2 | 62 |
| Geist | 11,5 | 400 | 1,45 | 2 |
| Geist | 11,5 | 500 | 1,2 | 8 |
| Geist | 12 | 400 | 1,2 | 80 |
| Geist | 12 | 400 | 1,5 | 1 |
| Geist | 12 | 500 | 1,2 | 28 |
| Geist | 12 | 600 | 1,2 | 9 |
| Geist | 12,5 | 400 | 1,2 | 43 |
| Geist | 12,5 | 500 | 1,2 | 16 |
| Geist | 12,5 | 600 | 1,2 | 9 |
| Geist | 13 | 400 | 1,2 | 110 |
| Geist | 13 | 400 | 1,35 | 3 |
| Geist | 13 | 400 | 1,55 | 1 |
| Geist | 13 | 500 | 1,2 | 28 |
| Geist | 13 | 600 | 1,2 | 16 |
| Geist | 14 | 400 | 1,55 | 1 |
| Geist | 14 | 500 | 1,45 | 1 |
| Geist | 14 | 500 | 1,2 | 5 |
| Geist | 14 | 600 | 1,2 | 7 |
| Geist | 15 | 600 | 1,2 | 2 |
| Geist | 22 | 600 | 1,2 | 2 |
| Geist | 24 | 600 | 1,2 | 1 |
| Geist | 26 | 600 | 1,2 | 1 |
| Geist | 28 | 600 | 1 | 5 |
| Geist Mono | 10 | 400 | 1,2 | 5 |
| Geist Mono | 10,5 | 500 | 1,2 | 2 |
| Geist Mono | 10,5 | 600 | 1,2 | 4 |
| Geist Mono | 11 | 400 | 1,2 | 62 |
| Geist Mono | 11,5 | 400 | 1,2 | 6 |
| Geist Mono | 12 | 400 | 1,2 | 45 |
| Geist Mono | 12 | 500 | 1,2 | 12 |
| Geist Mono | 12 | 600 | 1,2 | 12 |
| Geist Mono | 12,5 | 400 | 1,2 | 5 |
| Geist Mono | 12,5 | 500 | 1,2 | 4 |
| Geist Mono | 13 | 600 | 1,2 | 7 |

## Rayons et espacements

Rayons relevés (px) : 1 (183), 1,5 (37), 2 (71), 3 (1), 4 (39), 5 (8), 6 (130), 6,5 (1), 7 (2), 8 (29), 9 (2), 10 (29), 12 (6), 14 (5), 15 (1).

Espacements flex relevés (px) : 0 (145), 1,5 (10), 2 (16), 3 (25), 4 (47), 5 (37), 6 (172), 7 (15), 8 (177), 9 (3), 10 (25), 12 (33), 14 (12), 16 (2), 18 (1), 28 (1).

## P1 bis · Vue d'ensemble

Board `P1 bis · Vue d'ensemble` (sombre) et `P1 bis · Vue d'ensemble (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign » ; écran 210 de la page « 35 · Redesign Emis » du fichier « Kibo ».
Exports : `exports/proposition-vue-ensemble-v2-dark.png` et `exports/proposition-vue-ensemble-v2-light.png`, 1440 × 1260 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 1183)
25. « AB » (x 21, y 1222)
26. « Adam Ben Mchichi » (x 48, y 1220,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Vue d'ensemble » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 671, y 16,5)
31. « Nouveau ticket » (x 844, y 16,5)
32. « Agent de projet » (x 982, y 16,5)
33. « Emis » (x 265, y 67)
34. « Suivi de chantier » (x 265, y 100)
35. « · » (x 372, y 100)
36. « galadrimteam/emis-suivi-chantier » (x 404, y 100,5)
37. « Fonctionnalités » (x 303, y 142)
38. « 3 » (x 283, y 162)
39. « livrées sur 9 » (x 307, y 174)
40. « Sprint en cours » (x 465,2, y 142)
41. « S42 » (x 445,2, y 162)
42. « finit ce soir » (x 505,2, y 174)
43. « Terrain hors ligne » (x 445,2, y 195,5)
44. « Ouvertes » (x 627,4, y 142)
45. « 2 » (x 607,4, y 162)
46. « sur 2 max » (x 631,4, y 174)
47. « limite atteinte » (x 620,4, y 195,5)
48. « En review » (x 789,6, y 142)
49. « 3 » (x 769,6, y 162)
50. « PR » (x 793,6, y 174)
51. « #20 · #22 · #23 » (x 769,6, y 195,5)
52. « Questions » (x 951,8, y 142)
53. « 3 » (x 931,8, y 162)
54. « ouvertes » (x 955,8, y 174)
55. « Q14 bloque F6 » (x 944,8, y 195,5)
56. « En ce moment » (x 302, y 261,5)
57. « 2 sessions T3 Code » (x 281, y 281,5)
58. « F5 » (x 454, y 252,5)
59. « EMIS-33 » (x 488, y 252,5)
60. « Écran d'envoi hors ligne » (x 547, y 252)
61. « 7 · Porte qualité » (x 859, y 252,5)
62. « 42 min » (x 1020, y 252,5)
63. « F4 » (x 454, y 289,5)
64. « EMIS-45 » (x 488, y 289,5)
65. « Conflits de saisie » (x 547, y 289)
66. « 9 · Review » (x 859, y 289,5)
67. « 18 min » (x 1023, y 289,5)
68. « Échéances » (x 304, y 349,5)
69. « fonctionnalités par sprint » (x 916, y 350,5)
70. « S42 » (x 525, y 390)
71. « 12 oct. » (x 553, y 390)
72. « S43 » (x 664, y 390)
73. « 19 oct. » (x 692, y 390)
74. « S44 » (x 803, y 390)
75. « 26 oct. » (x 831, y 390)
76. « S45 » (x 942, y 390)
77. « 2 nov. » (x 970, y 390)
78. « F4 » (x 281, y 419)
79. « Saisir un tronçon hors ligne » (x 304, y 419)
80. « F5 » (x 281, y 449)
81. « Envoyer les photos d'un tronçon » (x 304, y 449)
82. « glisse en S43 » (x 783,6, y 449)
83. « bloquée · Q14 » (x 828, y 480)
84. « F6 » (x 281, y 479)
85. « Importer les ISO depuis Excel » (x 304, y 479)
86. « F8 » (x 281, y 509)
87. « Valider les soudures par lot » (x 304, y 509)
88. « F7 » (x 281, y 539)
89. « Rapport de chantier journalier » (x 304, y 539)
90. « aujourd'hui » (x 616,4, y 544)
91. « étape livrée » (x 299, y 578)
92. « en review » (x 397, y 578)
93. « en cours » (x 484, y 578)
94. « bloquée » (x 565, y 578)
95. « à faire » (x 644, y 578)
96. « glissement prévu » (x 713, y 578)
97. « Sprint S42 · Terrain hors ligne » (x 304, y 630,5)
98. « 12–16 oct. » (x 589, y 631,5)
99. « 2/2 ouvertes » (x 662, y 631,5)
100. « F3 » (x 281, y 673,5)
101. « Réaffecter un ISO » (x 317, y 673)
102. « livrée » (x 566, y 673,5)
103. « 4/4 » (x 720, y 673,5)
104. « F4 » (x 281, y 712,5)
105. « Saisir un tronçon hors ligne » (x 317, y 712)
106. « ouverte » (x 549, y 712,5)
107. « 3/5 » (x 720, y 712,5)
108. « F5 » (x 281, y 751,5)
109. « Envoyer les photos d'un tronçon » (x 317, y 751)
110. « en retard » (x 566, y 751,5)
111. « 1/5 » (x 720, y 751,5)
112. « Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5. » (x 302, y 789)
113. « Prochaine à finir » (x 304, y 841,5)
114. « la plus avancée du sprint » (x 601, y 842,5)
115. « F4 » (x 281, y 875,5)
116. « Saisir un tronçon hors ligne » (x 306, y 874)
117. « 3/5 » (x 720, y 875,5)
118. « EMIS-45 » (x 297, y 902,5)
119. « Conflits de saisie » (x 356, y 902)
120. « changements demandés » (x 466, y 902,5)
121. « EMIS-46 » (x 297, y 924,5)
122. « Démo client » (x 356, y 924)
123. « Étape suivante » (x 293, y 963)
124. « /full-delivery EMIS-45 » (x 387, y 963)
125. « Copier » (x 685, y 963)
126. « Activité » (x 304, y 1032,5)
127. « git » (x 633, y 1033,5)
128. « full-delivery » (x 668, y 1033,5)
129. « 15:04 » (x 281, y 1075,5)
130. « PR #22 ouverte » (x 355, y 1075)
131. « EMIS-32 » (x 643, y 1075,5)
132. « F5 » (x 722, y 1075,5)
133. « 14:51 » (x 281, y 1114,5)
134. « Étape 7 · Porte qualité » (x 355, y 1114)
135. « EMIS-33 » (x 643, y 1114,5)
136. « F5 » (x 722, y 1114,5)
137. « 14:40 » (x 281, y 1153,5)
138. « Suivi mis à jour · lot n° 7 proposé » (x 355, y 1153)
139. « Agent de projet » (x 658, y 1153,5)
140. « 14:36 » (x 281, y 1192,5)
141. « PR #18 fusionnée · F3 livrée » (x 355, y 1192)
142. « EMIS-21 » (x 643, y 1192,5)
143. « F3 » (x 722, y 1192,5)
144. « En review » (x 814, y 630,5)
145. « 3 » (x 894, y 631,5)
146. « #22 » (x 818, y 672)
147. « Route d'envoi des photos » (x 848, y 672)
148. « EMIS-32 » (x 818, y 693)
149. « F5 » (x 897, y 693)
150. « CI verte » (x 836, y 713)
151. « #20 » (x 818, y 749)
152. « Conflits de saisie » (x 848, y 749)
153. « EMIS-45 » (x 818, y 770)
154. « F4 » (x 897, y 770)
155. « changements demandés » (x 836, y 790)
156. « #23 » (x 818, y 826)
157. « Passage à Expo SDK 54 » (x 848, y 826)
158. « EMIS-61 » (x 818, y 846)
159. « CI en cours » (x 835, y 865)
160. « Questions » (x 814, y 917,5)
161. « 3 » (x 898, y 918,5)
162. « Un ISO réaffecté garde-t-il ses photos ? » (x 791, y 959)
163. « F6 » (x 813, y 984)
164. « Q14 · Client · il y a 3 j » (x 840, y 984)
165. « bloquante » (x 965, y 984)
166. « Quota par affaire : 2 Go ou 5 Go ? » (x 791, y 1022)
167. « F5 » (x 813, y 1046)
168. « Q16 · Produit · hier » (x 840, y 1046)
169. « Un rapport par chef de chantier ou par affaire ? » (x 791, y 1083)
170. « F7 » (x 813, y 1125)
171. « Q17 · Client · il y a 2 h » (x 840, y 1125)
172. « Agent de projet » (x 1158, y 13)
173. « Suivi à jour · il y a 4 min » (x 1158, y 32)
174. « Résumé du jour » (x 1118, y 79)
175. « F3 est livrée : 3 fonctionnalités sur 9. » (x 1118, y 102)
176. « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » (x 1118, y 131)
177. « À valider » (x 1118, y 229)
178. « Lot n° 7 » (x 1132, y 264)
179. « 3 actions » (x 1357, y 264,5)
180. « Reporter F5 en S43 » (x 1158, y 302)
181. « 4 étapes restantes, S42 finit aujourd'hui » (x 1158, y 321)
182. « Planifier F9 en S44 » (x 1158, y 359)
183. « seule fonctionnalité à planifier » (x 1158, y 378)
184. « Relancer le client sur Q14 » (x 1158, y 416)
185. « bloque F6, prévue en S43 » (x 1158, y 435)
186. « Valider (3) » (x 1142, y 479)
187. « Refuser » (x 1227, y 479)
188. « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » (x 1139, y 525)
189. « Demander à l'agent de projet… » (x 1130, y 1217)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P1 bis · Vue d'ensemble** (bloc) · x 0, y 0, 1440 × 1260 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1260 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1260 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `fg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 265, 96 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 1176, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 1183,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 1183, 69 × 16
      - **box** (bloc) · x 10, y 1208, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 1216, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 1222, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 1220,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 1221, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1260 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 858 × 1260 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 858 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 164 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 96 × 16
        - **box** (bloc) · x 651, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 651, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 671, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 815, y 11,5, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 825, y 17,5, 13 × 13
          - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 844, y 16,5, 85 × 15
        - **agent-button** (bloc) · x 951, y 11,5, 132 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 6
          - icône `bot` 15 px, `brand` — x 961, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `brandText` — x 982, y 16,5, 91 × 15
      - **line** (bloc) · x 241, y 48, 858 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 858 × 1211 · flex colonne, espacement 14, marges internes 18 24 24 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 810 × 49 · flex ligne, espacement 12, marges internes 0, alignement end/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 67, 370 × 49 · flex colonne, espacement 4, marges internes 0, alignement start/start
            - « Emis » — Geist 24 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 265, y 67, 55 × 29
            - **box** (bloc) · x 265, y 100, 370 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « Suivi de chantier » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 265, y 100, 99 × 16
              - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 372, y 100, 3 × 16
              - icône `github` 13 px, `mfg` — x 383, y 101,5, 13 × 13
              - « galadrimteam/emis-suivi-chantier » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 404, y 100,5, 231 × 15
        - **kpis** (bloc) · x 265, y 130, 810 × 92 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 283, y 142, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `package` 14 px, `mfg` — x 283, y 142,5, 14 × 14
              - « Fonctionnalités » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 303, y 142, 90 × 15
            - **box** (bloc) · x 283, y 162, 96 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 283, y 162, 18 × 28
              - « livrées sur 9 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 307, y 174, 72 × 16
            - **box** (bloc) · x 283, y 195, 150 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **segs** (bloc) · x 283, y 200, 150 × 6 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 283, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 300, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 317, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 334, y 200, 14 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 351, y 200, 14 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 368, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 385, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 402, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 419, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
          - **vline** (bloc) · x 426,2, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 427,2, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 445,2, y 142, 109 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `sprint` 14 px, `mfg` — x 445,2, y 142,5, 14 × 14
              - « Sprint en cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 465,2, y 142, 89 × 15
            - **box** (bloc) · x 445,2, y 162, 126 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « S42 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 445,2, y 162, 54 × 28
              - « finit ce soir » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 505,2, y 174, 66 × 16
            - **box** (bloc) · x 445,2, y 195, 94 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « Terrain hors ligne » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 445,2, y 195,5, 94 × 15
          - **vline** (bloc) · x 588,4, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 589,4, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 607,4, y 142, 74 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `target` 14 px, `mfg` — x 607,4, y 142,5, 14 × 14
              - « Ouvertes » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 627,4, y 142, 54 × 15
            - **box** (bloc) · x 607,4, y 162, 84 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 2 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 607,4, y 162, 18 × 28
              - « sur 2 max » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 631,4, y 174, 60 × 16
            - **box** (bloc) · x 607,4, y 195, 88 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 607,4, y 199,5, 7 × 7 · fond `amber` · dimension fixe/fixe
              - « limite atteinte » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 620,4, y 195,5, 75 × 15
          - **vline** (bloc) · x 750,6, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 751,6, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 769,6, y 142, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `pr` 14 px, `mfg` — x 769,6, y 142,5, 14 × 14
              - « En review » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 789,6, y 142, 57 × 15
            - **box** (bloc) · x 769,6, y 162, 41 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 769,6, y 162, 18 × 28
              - « PR » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 793,6, y 174, 17 × 16
            - **box** (bloc) · x 769,6, y 195, 79 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « #20 · #22 · #23 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 769,6, y 195,5, 79 × 15
          - **vline** (bloc) · x 912,8, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 913,8, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 931,8, y 142, 80 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `question` 14 px, `mfg` — x 931,8, y 142,5, 14 × 14
              - « Questions » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 951,8, y 142, 60 × 15
            - **box** (bloc) · x 931,8, y 162, 76 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 931,8, y 162, 18 × 28
              - « ouvertes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 955,8, y 174, 52 × 16
            - **box** (bloc) · x 931,8, y 195, 92 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 931,8, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « Q14 bloque F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 944,8, y 195,5, 79 × 15
        - **live** (bloc) · x 265, y 236, 810 × 86 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 236, 150 × 86 · flex colonne, espacement 4, marges internes 0 16 0 16, alignement start/center · dimension fixe/remplit
            - **box** (bloc) · x 281, y 261,5, 110 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **halo** (bloc) · x 281, y 263, 13 × 13 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6,5 · dimension fixe/fixe
                - **dot** (pastille) · x 284, y 266, 7 × 7 · fond `brand` · dimension fixe/fixe
              - « En ce moment » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 302, y 261,5, 89 × 16
            - « 2 sessions T3 Code » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 281,5, 107 × 15
          - **box** (bloc) · x 415, y 236, 1 × 86 · fond `brandLine` · dimension fixe/remplit
          - **box** (bloc) · x 416, y 236, 659 × 86 · flex colonne, espacement 0, marges internes 6 16 6 16, alignement start/start · dimension remplit/remplit
            - **box** (bloc) · x 432, y 242, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 251,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 251,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 254, 12 × 12
                  - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 252,5, 15 × 15
              - **box** (bloc) · x 488, y 252, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 252,5, 51 × 15
                - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 252, 143 × 16
              - **box** (bloc) · x 767, y 252,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 254, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 254, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 7 · Porte qualité » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 252,5, 88 × 15
              - **box** (bloc) · x 989, y 252,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 42 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1020, y 252,5, 39 × 15
            - **line** (bloc) · x 432, y 278, 627 × 1 · fond `brandLine` · dimension remplit/fixe
            - **box** (bloc) · x 432, y 279, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 288,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 288,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 291, 12 × 12
                  - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 289,5, 15 × 15
              - **box** (bloc) · x 488, y 289, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 289,5, 51 × 15
                - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 289, 105 × 16
              - **box** (bloc) · x 767, y 289,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 291, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 291, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 9 · Review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 289,5, 58 × 15
              - **box** (bloc) · x 989, y 289,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 18 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1023, y 289,5, 36 × 15
        - **card / Échéances** (bloc) · x 265, y 336, 810 × 267 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 265, y 336, 810 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
            - icône `calendar` 15 px, `mfg` — x 281, y 350,5, 15 × 15
            - « Échéances » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 349,5, 74 × 17
            - « fonctionnalités par sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 916, y 350,5, 143 × 15
          - **line** (bloc) · x 265, y 380, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **grid** (bloc) · x 265, y 381, 806 × 186 · dimension fixe/fixe
            - **box** (bloc) · x 515, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 516, y 381, 138 × 186 · fond `muted (50 %)`
            - **box** (bloc) · x 654, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 793, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 932, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 525, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S42 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 525, y 390, 22 × 15
              - « 12 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 553, y 390, 36 × 15
            - **box** (bloc) · x 664, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S43 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 664, y 390, 22 × 15
              - « 19 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 692, y 390, 36 × 15
            - **box** (bloc) · x 803, y 390, 66 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S44 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 803, y 390, 22 × 15
              - « 26 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 831, y 390, 38 × 15
            - **box** (bloc) · x 942, y 390, 60 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S45 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 942, y 390, 22 × 15
              - « 2 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 970, y 390, 32 × 15
            - **today** (bloc) · x 604,4, y 405, 2 × 162 · fond `fg`
            - **box** (bloc) · x 265, y 411, 806 × 1 · fond `soft`
            - **box** (bloc) · x 281, y 419, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 419, 15 × 15
              - « Saisir un tronçon hors ligne » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 419, 156 × 15
            - **box** (bloc) · x 525, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 573,8, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 598,2, y 421, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 622,6, y 421, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 441, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 449, 206 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 449, 15 × 15
              - « Envoyer les photos d'un tronçon » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 449, 183 × 15
            - **box** (bloc) · x 767,6, y 449, 92 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
              - icône `clockAlert` 12 px, `red` — x 767,6, y 450,5, 12 × 12
              - « glisse en S43 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 783,6, y 449, 76 × 15
            - **box** (bloc) · x 525, y 451, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 451, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 573,8, y 451, 21,4 × 12 · fond `blue` · rayon 2
            - **box** (bloc) · x 598,2, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 622,6, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 664, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 688,4, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 712,8, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 737,2, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 281, y 471, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start
              - **pill** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `lock` 12 px, `red` — x 811, y 481,5, 12 × 12
                - « bloquée · Q14 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 828, y 480, 75 × 15
            - **box** (bloc) · x 281, y 479, 191 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 479, 15 × 15
              - « Importer les ISO depuis Excel » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 479, 168 × 15
            - **box** (bloc) · x 664, y 481, 27,5 × 12 · fond `red` · rayon 2
            - **box** (bloc) · x 694,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 501, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 509, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F8 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 509, 15 × 15
              - « Valider les soudures par lot » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 509, 156 × 15
            - **box** (bloc) · x 664, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 694,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 531, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 539, 193 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F7 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 539, 15 × 15
              - « Rapport de chantier journalier » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 539, 170 × 15
            - **box** (bloc) · x 803, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 827,4, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 851,8, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 876,2, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 900,6, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 610,4, y 543, 76 × 17 · flex ligne, espacement 0, marges internes 1 6 1 6, alignement center/start · fond `primary` · rayon 4
              - « aujourd'hui » — Geist 12 / 600, interligne 1,2, couleur `pfg` — x 616,4, y 544, 64 × 15
          - **line** (bloc) · x 265, y 567, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 568, 810 × 35 · flex ligne, espacement 16, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
            - **box** (bloc) · x 281, y 578, 82 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 281, y 580,5, 12 × 10 · fond `fg` · rayon 2 · dimension fixe/fixe
              - « étape livrée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 299, y 578, 64 × 15
            - **box** (bloc) · x 379, y 578, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 379, y 580,5, 12 × 10 · fond `purple` · rayon 2 · dimension fixe/fixe
              - « en review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 397, y 578, 53 × 15
            - **box** (bloc) · x 466, y 578, 65 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 466, y 580,5, 12 × 10 · fond `blue` · rayon 2 · dimension fixe/fixe
              - « en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 484, y 578, 47 × 15
            - **box** (bloc) · x 547, y 578, 63 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 547, y 580,5, 12 × 10 · fond `red` · rayon 2 · dimension fixe/fixe
              - « bloquée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 565, y 578, 45 × 15
            - **box** (bloc) · x 626, y 578, 53 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 626, y 580,5, 12 × 10 · fond `border` · rayon 2 · dimension fixe/fixe
              - « à faire » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 644, y 578, 35 × 15
            - **box** (bloc) · x 695, y 578, 112 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 695, y 580,5, 12 × 10 · fond `redSoft` · bordure 1 `red` · rayon 2 · dimension fixe/fixe
              - « glissement prévu » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 713, y 578, 94 × 15
        - **box** (bloc) · x 265, y 617, 810 × 602 · flex ligne, espacement 16, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 617, 494 × 602 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension remplit/auto
            - **card / Sprint S42 · Terrain hors ligne** (bloc) · x 265, y 617, 494 × 197 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 617, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `sprint` 15 px, `mfg` — x 281, y 631,5, 15 × 15
                - « Sprint S42 · Terrain hors ligne » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 630,5, 197 × 17
                - « 12–16 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 589, y 631,5, 57 × 15
                - **pill** (bloc) · x 654, y 629,5, 89 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                  - « 2/2 ouvertes » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 662, y 631,5, 73 × 15
              - **line** (bloc) · x 265, y 661, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 662, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 673,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 673,5, 15 × 15
                - **box** (bloc) · x 317, y 673, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 317, y 673, 108 × 16
                - **box** (bloc) · x 541, y 671,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 671,5, 64 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `greenSoft` · rayon 10
                    - icône `circleCheck` 12 px, `green` — x 549, y 675, 12 × 12
                    - « livrée » — Geist 12 / 500, interligne 1,2, couleur `green` — x 566, y 673,5, 31 × 15
                - **box** (bloc) · x 637, y 677, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 677, 49 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 673,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 4/4 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 720, y 673,5, 23 × 15
              - **line** (bloc) · x 265, y 700, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 701, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 712,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 712,5, 15 × 15
                - **box** (bloc) · x 317, y 712, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 712, 167 × 16
                - **box** (bloc) · x 541, y 710,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 710,5, 59 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `blueSoft` · rayon 10
                    - « ouverte » — Geist 12 / 500, interligne 1,2, couleur `blue` — x 549, y 712,5, 43 × 15
                - **box** (bloc) · x 637, y 716, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 716, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 716, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 716, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 712,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 712,5, 23 × 15
              - **line** (bloc) · x 265, y 739, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 740, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 751,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 751,5, 15 × 15
                - **box** (bloc) · x 317, y 751, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 751, 195 × 16
                - **box** (bloc) · x 541, y 749,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 749,5, 84 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                    - icône `clockAlert` 12 px, `red` — x 549, y 753, 12 × 12
                    - « en retard » — Geist 12 / 500, interligne 1,2, couleur `red` — x 566, y 751,5, 51 × 15
                - **box** (bloc) · x 637, y 755, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 755, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 755, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 755, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 755, 10 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 751,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 1/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 751,5, 23 × 15
              - **line** (bloc) · x 265, y 778, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 779, 494 × 35 · flex ligne, espacement 8, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
                - icône `target` 13 px, `mfg` — x 281, y 790, 13 × 13
                - « Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 302, y 789, 441 × 15
            - **card / Prochaine à finir** (bloc) · x 265, y 828, 494 × 177 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 828, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `flag` 15 px, `mfg` — x 281, y 842,5, 15 × 15
                - « Prochaine à finir » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 841,5, 110 × 17
                - « la plus avancée du sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 601, y 842,5, 142 × 15
              - **box** (bloc) · x 265, y 872, 494 × 133 · flex colonne, espacement 10, marges internes 2 16 14 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 281, y 874, 462 × 18 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 875,5, 15 × 15
                  - « Saisir un tronçon hors ligne » — Geist 15 / 600, interligne 1,2, couleur `fg` — x 306, y 874, 197 × 18
                  - **segs** (bloc) · x 588, y 879, 122 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 588, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 613, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 638, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 879, 22 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 688, y 879, 22 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 875,5, 23 × 15
                - **box** (bloc) · x 281, y 902, 462 × 38 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 281, y 902, 320 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **dot** (pastille) · x 281, y 906, 8 × 8 · fond `purple` · dimension fixe/fixe
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 902,5, 51 × 15
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 902, 102 × 16
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 466, y 902,5, 135 × 15
                  - **box** (bloc) · x 281, y 924, 147 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 281, y 928, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                    - « EMIS-46 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 924,5, 51 × 15
                    - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 924, 72 × 16
                - **box** (bloc) · x 281, y 950, 462 × 41 · flex ligne, espacement 10, marges internes 8 10 8 12, alignement center/start · fond `muted` · rayon 8 · dimension remplit/auto
                  - « Étape suivante » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 293, y 963, 84 × 15
                  - « /full-delivery EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 387, y 963, 165 × 15
                  - **Button / outline** (bloc) · x 656, y 958, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                    - icône `copy` 13 px, `fg` — x 666, y 964, 13 × 13
                    - « Copier » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 685, y 963, 38 × 15
            - **card / Activité** (bloc) · x 265, y 1019, 494 × 200 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 1019, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `activity` 15 px, `mfg` — x 281, y 1033,5, 15 × 15
                - « Activité » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 1032,5, 53 × 17
                - **chip** (bloc) · x 627, y 1031,5, 27 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « git » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 633, y 1033,5, 15 × 15
                - **chip** (bloc) · x 662, y 1031,5, 81 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « full-delivery » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 668, y 1033,5, 69 × 15
              - **line** (bloc) · x 265, y 1063, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1064, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1075,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 15:04 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1075,5, 36 × 15
                - icône `pr` 14 px, `purple` — x 331, y 1076, 14 × 14
                - **box** (bloc) · x 355, y 1075, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #22 ouverte » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1075, 91 × 16
                - **box** (bloc) · x 633, y 1074,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1075,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1074,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1077, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1075,5, 15 × 15
              - **line** (bloc) · x 265, y 1102, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1103, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1114,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:51 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1114,5, 36 × 15
                - icône `flag` 14 px, `mfg` — x 331, y 1115, 14 × 14
                - **box** (bloc) · x 355, y 1114, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Étape 7 · Porte qualité » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1114, 130 × 16
                - **box** (bloc) · x 633, y 1113,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1114,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1113,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1116, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1114,5, 15 × 15
              - **line** (bloc) · x 265, y 1141, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1142, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1153,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:40 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1153,5, 36 × 15
                - icône `bot` 14 px, `brand` — x 331, y 1154, 14 × 14
                - **box** (bloc) · x 355, y 1153, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Suivi mis à jour · lot n° 7 proposé » — Geist 13 / 400, interligne 1,2, couleur `brandText` — x 355, y 1153, 192 × 16
                - **box** (bloc) · x 633, y 1153,5, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « Agent de projet » — Geist 12 / 400, interligne 1,2, couleur `brandText` — x 658, y 1153,5, 85 × 15
              - **line** (bloc) · x 265, y 1180, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1181, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1192,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:36 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1192,5, 36 × 15
                - icône `merge` 14 px, `green` — x 331, y 1193, 14 × 14
                - **box** (bloc) · x 355, y 1192, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #18 fusionnée · F3 livrée » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1192, 161 × 16
                - **box** (bloc) · x 633, y 1191,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-21 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1192,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1191,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1194, 12 × 12
                    - « F3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1192,5, 15 × 15
          - **box** (bloc) · x 775, y 617, 300 × 534 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension fixe/auto
            - **card / En review** (bloc) · x 775, y 617, 300 × 273 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 617, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `pr` 15 px, `mfg` — x 791, y 631,5, 15 × 15
                - « En review » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 630,5, 65 × 17
                - **box** (bloc) · x 887, y 631,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 894, y 631,5, 8 × 15
              - **line** (bloc) · x 775, y 661, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 662, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 672, 15 × 15
                - **box** (bloc) · x 818, y 672, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 672, 179 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #22 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 672, 24 × 16
                    - « Route d'envoi des photos » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 672, 149 × 16
                  - **box** (bloc) · x 818, y 692, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 693, 51 × 15
                    - **fchip** (bloc) · x 875, y 692, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 694,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 693, 15 × 15
                  - **box** (bloc) · x 818, y 713, 61 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleCheck` 12 px, `green` — x 818, y 714,5, 12 × 12
                    - « CI verte » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 836, y 713, 43 × 15
              - **line** (bloc) · x 775, y 738, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 739, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `amber` — x 791, y 749, 15 × 15
                - **box** (bloc) · x 818, y 749, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 749, 132 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 749, 24 × 16
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 749, 102 × 16
                  - **box** (bloc) · x 818, y 769, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 770, 51 × 15
                    - **fchip** (bloc) · x 875, y 769, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 771,5, 12 × 12
                      - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 770, 15 × 15
                  - **box** (bloc) · x 818, y 790, 153 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleX` 12 px, `red` — x 818, y 791,5, 12 × 12
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 836, y 790, 135 × 15
              - **line** (bloc) · x 775, y 815, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 816, 300 × 74 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 826, 15 × 15
                - **box** (bloc) · x 818, y 826, 241 × 54 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 826, 173 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #23 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 826, 24 × 16
                    - « Passage à Expo SDK 54 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 826, 143 × 16
                  - **box** (bloc) · x 818, y 846, 51 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-61 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 846, 51 × 15
                  - **box** (bloc) · x 818, y 865, 79 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 818, y 867, 11 × 11 · bordure 2 `amber` · dimension fixe/fixe
                    - « CI en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 835, y 865, 62 × 15
            - **card / Questions** (bloc) · x 775, y 904, 300 × 247 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 904, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `question` 15 px, `mfg` — x 791, y 918,5, 15 × 15
                - « Questions » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 917,5, 69 × 17
                - **box** (bloc) · x 891, y 918,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 898, y 918,5, 8 × 15
              - **line** (bloc) · x 775, y 948, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 949, 300 × 62 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 959, 268 × 42 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un ISO réaffecté garde-t-il ses photos ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 959, 268 × 18
                  - **box** (bloc) · x 791, y 982, 239 × 19 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 983, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 985,5, 12 × 12
                      - « F6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 984, 15 × 15
                    - « Q14 · Client · il y a 3 j » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 984, 111 × 15
                    - **pill** (bloc) · x 957, y 982, 73 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                      - « bloquante » — Geist 12 / 500, interligne 1,2, couleur `red` — x 965, y 984, 57 × 15
              - **line** (bloc) · x 775, y 1011, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1012, 300 × 60 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1022, 268 × 40 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1022, 268 × 18
                  - **box** (bloc) · x 791, y 1045, 147 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1045, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1047,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1046, 15 × 15
                    - « Q16 · Produit · hier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1046, 98 × 15
              - **line** (bloc) · x 775, y 1072, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1073, 300 × 78 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1083, 268 × 58 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un rapport par chef de chantier ou par affaire ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1083, 268 × 36
                  - **box** (bloc) · x 791, y 1124, 163 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1124, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1126,5, 12 × 12
                      - « F7 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1125, 15 × 15
                    - « Q17 · Client · il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1125, 114 × 15
    - **vline** (bloc) · x 1099, y 0, 1 × 1260 · fond `soft` · dimension fixe/remplit
    - **agent-panel** (bloc) · x 1100, y 0, 340 × 1260 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 1100, y 0, 340 × 60 · flex ligne, espacement 10, marges internes 0 18 0 18, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 1118, y 15, 30 × 30 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandSoft` · bordure 1 `brandLine` · rayon 15 · dimension fixe/fixe
          - icône `bot` 17 px, `brand` — x 1124,5, y 21,5, 17 × 17
        - **box** (bloc) · x 1158, y 13, 128 × 34 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - « Agent de projet » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 1158, y 13, 104 × 17
          - « Suivi à jour · il y a 4 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 32, 128 × 15
        - icône `more` 16 px, `mfg` — x 1380, y 22, 16 × 16
        - icône `x` 16 px, `mfg` — x 1406, y 22, 16 × 16
      - **line** (bloc) · x 1100, y 60, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 61, 340 × 149 · flex colonne, espacement 8, marges internes 18, alignement start/start · dimension remplit/auto
        - « Résumé du jour » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 79, 114 × 15
        - « F3 est livrée : 3 fonctionnalités sur 9. » — Geist 14 / 500, interligne 1,45, couleur `fg` — x 1118, y 102, 304 × 21
        - « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » — Geist 13 / 400, interligne 1,55, couleur `mfg` — x 1118, y 131, 304 × 61
      - **line** (bloc) · x 1100, y 210, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 211, 340 × 368 · flex colonne, espacement 10, marges internes 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 229, 304 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « À valider » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 229, 66 × 15
        - **box** (bloc) · x 1118, y 254, 304 × 257 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 1118, y 254, 304 × 36 · flex ligne, espacement 8, marges internes 10 14 10 14, alignement center/start · fond `brandSoft` · dimension remplit/auto
            - « Lot n° 7 » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 1132, y 264, 47 × 16
            - « 3 actions » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1357, y 264,5, 51 × 15
          - **line** (bloc) · x 1118, y 290, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 291, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 302, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 304,5, 11 × 11
            - **box** (bloc) · x 1158, y 302, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Reporter F5 en S43 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 302, 250 × 16
              - « 4 étapes restantes, S42 finit aujourd'hui » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 321, 250 × 15
          - **line** (bloc) · x 1118, y 347, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 348, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 359, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 361,5, 11 × 11
            - **box** (bloc) · x 1158, y 359, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Planifier F9 en S44 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 359, 250 × 16
              - « seule fonctionnalité à planifier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 378, 250 × 15
          - **line** (bloc) · x 1118, y 404, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 405, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 416, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 418,5, 11 × 11
            - **box** (bloc) · x 1158, y 416, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Relancer le client sur Q14 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 416, 250 × 16
              - « bloque F6, prévue en S43 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 435, 250 × 15
          - **line** (bloc) · x 1118, y 461, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 462, 304 × 49 · flex ligne, espacement 8, marges internes 12 14 12 14, alignement center/start · dimension remplit/auto
            - **Button / brand** (bloc) · x 1132, y 474, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `brandBtn` · rayon 6
              - « Valider (3) » — Geist 12 / 500, interligne 1,2, couleur `#FFFFFF` — x 1142, y 479, 57 × 15
            - **Button / outline** (bloc) · x 1217, y 474, 65 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
              - « Refuser » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1227, y 479, 45 × 15
        - **box** (bloc) · x 1118, y 521, 304 × 40 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement start/start · dimension remplit/auto
          - icône `refresh` 13 px, `mfg` — x 1118, y 525, 13 × 13
          - « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » — Geist 12 / 400, interligne 1,5, couleur `mfg` — x 1139, y 525, 283 × 36
      - **line** (bloc) · x 1100, y 1189, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 1190, 340 × 70 · flex colonne, espacement 0, marges internes 14 18 14 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 1204, 304 × 42 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 8 · dimension remplit/fixe
          - « Demander à l'agent de projet… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 1130, y 1217, 179 × 16
          - icône `send` 15 px, `mfg` — x 1395, y 1217,5, 15 × 15

## P2 · Planning

Board `P2 · Planning` (sombre) et `P2 · Planning (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign » ; écran 211 de la page « 35 · Redesign Emis » du fichier « Kibo ».
Exports : `exports/proposition-planning-dark.png` et `exports/proposition-planning-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Planning » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Planning » (x 265, y 67)
34. « 3 fonctionnalités livrées sur 9 · 1 à planifier » (x 368, y 79)
35. « Fonctionnalité » (x 927, y 74)
36. « Sprint » (x 1056, y 74)
37. « Ouvertes : 2 / 2 » (x 1140, y 74)
38. « Colonnes » (x 1282, y 73)
39. « Bandes » (x 1359, y 73)
40. « À planifier » (x 297, y 120)
41. « Glisse une fonctionnalité vers un sprint » (x 277, y 140)
42. « F9 » (x 306, y 178)
43. « Exporter le dossier client » (x 287, y 200)
44. « 0/3 étapes » (x 287, y 240)
45. « suivante : EMIS-91 » (x 364, y 240)
46. « Une fonctionnalité sans sprint n'apparaît ni dans les échéances ni dans la limite d'ouvertes. » (x 279, y 282)
47. « S41 » (x 503, y 120)
48. « Accès » (x 533, y 120)
49. « 5–9 oct. » (x 503, y 141,5)
50. « terminé » (x 649, y 142)
51. « 2/2 livrées » (x 613, y 161)
52. « F1 » (x 532, y 199)
53. « livrée » (x 654, y 199)
54. « Se connecter avec Microsoft » (x 513, y 221)
55. « F2 » (x 532, y 283)
56. « livrée » (x 654, y 283)
57. « Voir ses ISO affectés » (x 513, y 305)
58. « S42 » (x 729, y 120)
59. « Terrain hors ligne » (x 759, y 120)
60. « 12–16 oct. » (x 729, y 141,5)
61. « se termine aujourd'hui » (x 804, y 142)
62. « 1/3 livrées » (x 839, y 161)
63. « F3 » (x 758, y 199)
64. « livrée » (x 880, y 199)
65. « Réaffecter un ISO » (x 739, y 221)
66. « 4/4 étapes » (x 739, y 261)
67. « F4 » (x 758, y 306,5)
68. « ouverte » (x 865, y 307)
69. « Saisir un tronçon hors ligne » (x 739, y 330)
70. « 3/5 étapes » (x 739, y 370)
71. « EMIS-45 » (x 862, y 370)
72. « F5 » (x 758, y 415,5)
73. « ouverte » (x 865, y 416)
74. « Envoyer les photos d'un tronçon » (x 739, y 439)
75. « 1/5 étapes » (x 739, y 495)
76. « EMIS-33 » (x 862, y 495)
77. « F4 ne tiendra pas : 1 étape restante » (x 754, y 535)
78. « F5 ne tiendra pas : 4 étapes restantes » (x 754, y 585)
79. « S43 » (x 955, y 120)
80. « Import et soudures » (x 985, y 120)
81. « 19–23 oct. » (x 955, y 140)
82. « 2 prévues » (x 1093, y 140)
83. « F6 » (x 984, y 179,5)
84. « bloquée · Q14 » (x 1063, y 180)
85. « Importer les ISO depuis Excel » (x 965, y 203)
86. « 0/4 étapes » (x 965, y 259)
87. « suivante : EMIS-51 » (x 1042, y 259)
88. « F8 » (x 984, y 303)
89. « Valider les soudures par lot » (x 965, y 325)
90. « 0/4 étapes » (x 965, y 365)
91. « suivante : EMIS-71 » (x 1043, y 365)
92. « S44 » (x 1181, y 120)
93. « Rapports » (x 1211, y 120)
94. « 26–30 oct. » (x 1181, y 140)
95. « 1 prévue » (x 1328, y 140)
96. « F7 » (x 1210, y 178)
97. « Rapport de chantier journalier » (x 1191, y 200)
98. « 0/5 étapes » (x 1191, y 256)
99. « suivante : EMIS-81 » (x 1268, y 256)
100. « Déposer pour planifier en S44 » (x 1192, y 343,5)
101. « 26–30 oct. » (x 1248, y 364,5)
102. « étape livrée » (x 283, y 968)
103. « en review » (x 377, y 968)
104. « en cours » (x 460, y 968)
105. « bloquée » (x 538, y 968)
106. « à faire » (x 613, y 968)
107. « · une case par étape, dans l'ordre des dépendances » (x 660, y 968)
108. « F9 » (x 1230, y 399)
109. « Exporter le dossier client » (x 1211, y 421)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P2 · Planning** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `fg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 297, 54 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 122 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Planning » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 54 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 1199 × 951 · flex colonne, espacement 14, marges internes 18 24 18 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 1151 × 27 · flex ligne, espacement 10, marges internes 0, alignement end/start · dimension remplit/auto
          - « Planning » — Geist 22 / 600, interligne 1,2, couleur `fg` — x 265, y 67, 93 × 27
          - « 3 fonctionnalités livrées sur 9 · 1 à planifier » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 368, y 79, 241 × 15
          - **Button / outline** (bloc) · x 898, y 69, 119 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
            - icône `plus` 13 px, `fg` — x 908, y 75, 13 × 13
            - « Fonctionnalité » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 927, y 74, 80 × 15
          - **Button / outline** (bloc) · x 1027, y 69, 74 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
            - icône `plus` 13 px, `fg` — x 1037, y 75, 13 × 13
            - « Sprint » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1056, y 74, 35 × 15
          - **box** (bloc) · x 1111, y 69, 149 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
            - icône `target` 13 px, `amber` — x 1121, y 75, 13 × 13
            - « Ouvertes : 2 / 2 » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1140, y 74, 92 × 15
            - icône `chevDown` 12 px, `dim` — x 1238, y 75,5, 12 × 12
          - **box** (bloc) · x 1270, y 67, 146 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
            - **box** (bloc) · x 1272, y 69, 75 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
              - « Colonnes » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1282, y 73, 55 × 15
            - **box** (bloc) · x 1349, y 69, 65 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « Bandes » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 1359, y 73, 45 × 15
        - **sprints** (bloc) · x 265, y 108, 1151 × 846 · flex ligne, espacement 12, marges internes 0, alignement stretch/start · dimension remplit/remplit
          - **col reserve** (bloc) · x 265, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · bordure 1 `border` dashed · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 275, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 277, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `inbox` 14 px, `mfg` — x 277, y 121, 14 × 14
                - « À planifier » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 297, y 120, 64 × 16
              - **box** (bloc) · x 277, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « Glisse une fonctionnalité vers un sprint » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 277, y 140, 204 × 14
            - **feature F9** (bloc) · x 275, y 168, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 287, y 178, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 287, y 178,5, 13 × 13
                - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 306, y 178, 14 × 14
              - « Exporter le dossier client » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 287, y 200, 170 × 16
              - **segs** (bloc) · x 287, y 224, 168 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 287, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 344, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 401, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 287, y 240, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/3 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 287, y 240, 59 × 14
                - « suivante : EMIS-91 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 364, y 240, 93 × 14
            - **box** (bloc) · x 275, y 274, 194 × 67 · flex colonne, espacement 6, marges internes 8 4 8 4, alignement start/start · dimension remplit/auto
              - « Une fonctionnalité sans sprint n'apparaît ni dans les échéances ni dans la limite d'ouvertes. » — Geist 11,5 / 400, interligne 1,45, couleur `dim` — x 279, y 282, 186 × 51
          - **col S41** (bloc) · x 491, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 501, y 118, 194 × 61 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 503, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S41 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 503, y 120, 24 × 16
                - « Accès » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 533, y 120, 39 × 16
              - **box** (bloc) · x 503, y 140, 190 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 5–9 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 503, y 141,5, 44 × 14
                - **chip** (bloc) · x 627, y 140, 66 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `greenSoft` · rayon 4
                  - icône `circleCheck` 12 px, `green` — x 633, y 142,5, 12 × 12
                  - « terminé » — Geist 10,5 / 500, interligne 1,2, couleur `green` — x 649, y 142, 38 × 13
              - **box** (bloc) · x 503, y 161, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - **bar** (bloc) · x 503, y 166,5, 104 × 3 · flex ligne, espacement 0, marges internes 0, alignement start/start · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - **fill** (bloc) · x 503, y 166,5, 104 × 3 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - « 2/2 livrées » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 613, y 161, 54 × 14
            - **feature F1** (bloc) · x 501, y 189, 194 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 513, y 199, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 513, y 199,5, 13 × 13
                - « F1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 532, y 199, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 635, y 199,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 654, y 199, 29 × 14
              - « Se connecter avec Microsoft » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 513, y 221, 170 × 32
            - **feature F2** (bloc) · x 501, y 273, 194 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 513, y 283, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 513, y 283,5, 13 × 13
                - « F2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 532, y 283, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 635, y 283,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 654, y 283, 29 × 14
              - « Voir ses ISO affectés » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 513, y 305, 170 × 16
          - **col S42** (bloc) · x 717, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `card` · bordure 1 `mfg` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 727, y 118, 194 × 61 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 729, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S42 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 729, y 120, 24 × 16
                - « Terrain hors ligne » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 759, y 120, 107 × 16
              - **box** (bloc) · x 729, y 140, 190 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 12–16 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 729, y 141,5, 52 × 14
                - **chip** (bloc) · x 798, y 140, 121 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `muted` · rayon 4
                  - « se termine aujourd'hui » — Geist 10,5 / 500, interligne 1,2, couleur `fg` — x 804, y 142, 109 × 13
              - **box** (bloc) · x 729, y 161, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - **bar** (bloc) · x 729, y 166,5, 104 × 3 · flex ligne, espacement 0, marges internes 0, alignement start/start · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - **fill** (bloc) · x 729, y 166,5, 35 × 3 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - « 1/3 livrées » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 839, y 161, 51 × 14
            - **feature F3** (bloc) · x 727, y 189, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 739, y 199, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 739, y 199,5, 13 × 13
                - « F3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 758, y 199, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 861, y 199,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 880, y 199, 29 × 14
              - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 739, y 221, 170 × 16
              - **segs** (bloc) · x 739, y 245, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 739, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 782, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 825, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 868, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 739, y 261, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 4/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 739, y 261, 58 × 14
            - **feature F4** (bloc) · x 727, y 295, 194 × 99 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 739, y 305, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 739, y 307, 13 × 13
                - « F4 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 758, y 306,5, 14 × 14
                - **chip** (bloc) · x 859, y 305, 50 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `blueSoft` · rayon 4
                  - « ouverte » — Geist 10,5 / 500, interligne 1,2, couleur `blue` — x 865, y 307, 38 × 13
              - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 739, y 330, 170 × 16
              - **segs** (bloc) · x 739, y 354, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 739, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 773, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 807, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 841, y 354, 31 × 8 · fond `purple` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 875, y 354, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 739, y 370, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 3/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 739, y 370, 59 × 14
                - **dot** (pastille) · x 850, y 374, 6 × 6 · fond `brand` · dimension fixe/fixe
                - « EMIS-45 » — Geist Mono 11 / 400, interligne 1,2, couleur `brandText` — x 862, y 370, 47 × 14
            - **feature F5** (bloc) · x 727, y 404, 194 × 115 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 739, y 414, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 739, y 416, 13 × 13
                - « F5 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 758, y 415,5, 14 × 14
                - **chip** (bloc) · x 859, y 414, 50 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `blueSoft` · rayon 4
                  - « ouverte » — Geist 10,5 / 500, interligne 1,2, couleur `blue` — x 865, y 416, 38 × 13
              - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 739, y 439, 170 × 32
              - **segs** (bloc) · x 739, y 479, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 739, y 479, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 773, y 479, 31 × 8 · fond `purple` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 807, y 479, 31 × 8 · fond `blue` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 841, y 479, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 875, y 479, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 739, y 495, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 1/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 739, y 495, 56 × 14
                - **dot** (pastille) · x 850, y 499, 6 × 6 · fond `brand` · dimension fixe/fixe
                - « EMIS-33 » — Geist Mono 11 / 400, interligne 1,2, couleur `brandText` — x 862, y 495, 47 × 14
            - **box** (bloc) · x 727, y 529, 194 × 40 · flex ligne, espacement 6, marges internes 6 8 6 8, alignement center/start · fond `amberSoft` · rayon 6 · dimension remplit/auto
              - icône `clockAlert` 13 px, `amber` — x 735, y 542,5, 13 × 13
              - « F4 ne tiendra pas : 1 étape restante » — Geist 11,5 / 400, interligne 1,2, couleur `amber` — x 754, y 535, 159 × 28
            - **box** (bloc) · x 727, y 579, 194 × 40 · flex ligne, espacement 6, marges internes 6 8 6 8, alignement center/start · fond `amberSoft` · rayon 6 · dimension remplit/auto
              - icône `clockAlert` 13 px, `amber` — x 735, y 592,5, 13 × 13
              - « F5 ne tiendra pas : 4 étapes restantes » — Geist 11,5 / 400, interligne 1,2, couleur `amber` — x 754, y 585, 159 × 28
          - **col S43** (bloc) · x 943, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 953, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 955, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S43 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 955, y 120, 24 × 16
                - « Import et soudures » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 985, y 120, 118 × 16
              - **box** (bloc) · x 955, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 19–23 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 955, y 140, 55 × 14
                - « 2 prévues » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1093, y 140, 52 × 14
            - **feature F6** (bloc) · x 953, y 168, 194 × 115 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 965, y 178, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 965, y 180, 13 × 13
                - « F6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 984, y 179,5, 14 × 14
                - **chip** (bloc) · x 1041, y 178, 94 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `lock` 12 px, `red` — x 1047, y 180,5, 12 × 12
                  - « bloquée · Q14 » — Geist 10,5 / 500, interligne 1,2, couleur `red` — x 1063, y 180, 66 × 13
              - « Importer les ISO depuis Excel » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 965, y 203, 170 × 32
              - **segs** (bloc) · x 965, y 243, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 965, y 243, 40 × 8 · fond `red` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1008, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1051, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1094, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 965, y 259, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 965, y 259, 59 × 14
                - « suivante : EMIS-51 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1042, y 259, 93 × 14
            - **feature F8** (bloc) · x 953, y 293, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 965, y 303, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 965, y 303,5, 13 × 13
                - « F8 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 984, y 303, 14 × 14
              - « Valider les soudures par lot » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 965, y 325, 170 × 16
              - **segs** (bloc) · x 965, y 349, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 965, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1008, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1051, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1094, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 965, y 365, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 965, y 365, 59 × 14
                - « suivante : EMIS-71 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1043, y 365, 92 × 14
          - **col S44** (bloc) · x 1169, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1179, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 1181, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S44 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 1181, y 120, 24 × 16
                - « Rapports » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1211, y 120, 58 × 16
              - **box** (bloc) · x 1181, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 26–30 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1181, y 140, 58 × 14
                - « 1 prévue » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1328, y 140, 43 × 14
            - **feature F7** (bloc) · x 1179, y 168, 194 × 112 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1191, y 178, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 1191, y 178,5, 13 × 13
                - « F7 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1210, y 178, 14 × 14
              - « Rapport de chantier journalier » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1191, y 200, 170 × 32
              - **segs** (bloc) · x 1191, y 240, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1191, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1225, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1259, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1293, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1327, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 1191, y 256, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1191, y 256, 59 × 14
                - « suivante : EMIS-81 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1268, y 256, 93 × 14
            - **dropzone** (bloc) · x 1179, y 290, 194 × 120 · flex colonne, espacement 6, marges internes 0, alignement center/center · fond `muted` · bordure 1 `fg` dashed · rayon 8 · dimension remplit/fixe
              - icône `sprint` 16 px, `fg` — x 1268, y 321,5, 16 × 16
              - « Déposer pour planifier en S44 » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1192, y 343,5, 168 × 15
              - « 26–30 oct. » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1248, y 364,5, 56 × 14
        - **box** (bloc) · x 265, y 968, 1151 × 14 · flex ligne, espacement 14, marges internes 0, alignement center/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 968, 80 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 265, y 971, 12 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
            - « étape livrée » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 283, y 968, 62 × 14
          - **box** (bloc) · x 359, y 968, 69 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 359, y 971, 12 × 8 · fond `purple` · rayon 2 · dimension fixe/fixe
            - « en review » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 377, y 968, 51 × 14
          - **box** (bloc) · x 442, y 968, 64 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 442, y 971, 12 × 8 · fond `blue` · rayon 2 · dimension fixe/fixe
            - « en cours » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 460, y 968, 46 × 14
          - **box** (bloc) · x 520, y 968, 61 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 520, y 971, 12 × 8 · fond `red` · rayon 2 · dimension fixe/fixe
            - « bloquée » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 538, y 968, 43 × 14
          - **box** (bloc) · x 595, y 968, 51 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 595, y 971, 12 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
            - « à faire » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 613, y 968, 33 × 14
          - « · une case par étape, dans l'ordre des dépendances » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 660, y 968, 268 × 14
  - **dragging F9** (bloc) · x 1199, y 389, 194 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `fg` · rayon 8
    - **box** (bloc) · x 1211, y 399, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
      - icône `grip` 13 px, `mfg` — x 1211, y 399,5, 13 × 13
      - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1230, y 399, 14 × 14
    - « Exporter le dossier client » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1211, y 421, 170 × 16
    - **segs** (bloc) · x 1211, y 445, 168 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
      - **seg** (bloc) · x 1211, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
      - **seg** (bloc) · x 1268, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
      - **seg** (bloc) · x 1325, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
  - icône `grab` 22 px, `fg` — x 1363, y 433, 22 × 22

## P3 · Fonctionnalité

Board `P3 · Fonctionnalité` (sombre) et `P3 · Fonctionnalité (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign » ; écran 212 de la page « 35 · Redesign Emis » du fichier « Kibo ».
Exports : `exports/proposition-fonctionnalite-dark.png` et `exports/proposition-fonctionnalite-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Planning » (x 329, y 16)
30. « / » (x 390, y 16)
31. « F5 · Envoyer les photos d'un tronçon » (x 405, y 16)
32. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
33. « Agent de projet » (x 1300, y 16,5)
34. « 3 » (x 1402, y 17,5)
35. « Fonctionnalité · F5 » (x 291, y 72)
36. « S42 » (x 421, y 73)
37. « ouverte » (x 460, y 73)
38. « Envoyer les photos d'un tronçon » (x 269, y 106)
39. « 1 étape livrée sur 5 » (x 497, y 156)
40. « Résultat attendu · ce qu'on montrera à la démo » (x 308, y 202)
41. « Sur le terrain, sans réseau, un chef de chantier photographie un tronçon. Les photos partent seules au retour du réseau et apparaissent dans le dossier de l'affaire. » (x 288, y 223)
42. « Parcours de A à Z » (x 269, y 311,5)
43. « étapes libres, dans l'ordre des dépendances » (x 402, y 313)
44. « Ajouter une étape » (x 953, y 313)
45. « Stockage des photos sur MinIO » (x 325, y 361)
46. « EMIS-31 » (x 538, y 362,5)
47. « Terminé » (x 1004, y 362)
48. « #19 » (x 343, y 385)
49. « fusionnée » (x 370, y 385)
50. « hier 18:22 » (x 454, y 385,5)
51. « 11 · Livré » (x 1006, y 385)
52. « 2 » (x 279, y 457,5)
53. « Route d'envoi des photos » (x 325, y 461)
54. « EMIS-32 » (x 498, y 462,5)
55. « En review » (x 994, y 462)
56. « #22 » (x 343, y 485)
57. « 15:04 » (x 394, y 485,5)
58. « 10 · Démo » (x 996, y 485)
59. « 3 » (x 279, y 557,5)
60. « Écran d'envoi hors ligne » (x 325, y 562,5)
61. « EMIS-33 » (x 487, y 564)
62. « session · T3 Code · 42 min » (x 564, y 564)
63. « En cours » (x 1000, y 563,5)
64. « feat/envoi-hors-ligne » (x 343, y 588)
65. « 14:51 » (x 507, y 588,5)
66. « 7 · Porte qualité » (x 965, y 588)
67. « 4 » (x 279, y 657,5)
68. « Tests E2E de l'envoi » (x 325, y 661)
69. « EMIS-34 » (x 462, y 662,5)
70. « À faire » (x 1012, y 662)
71. « attend EMIS-33 » (x 342, y 685)
72. « — » (x 1039, y 685)
73. « Prochaine étape à livrer une fois EMIS-33 fusionné. » (x 325, y 716)
74. « Livrer la prochaine étape » (x 717, y 716)
75. « /full-delivery EMIS-34 » (x 889, y 716,5)
76. « 5 » (x 279, y 757,5)
77. « Démo client » (x 325, y 761)
78. « EMIS-35 » (x 412, y 762,5)
79. « À faire » (x 1012, y 762)
80. « attend EMIS-34 » (x 342, y 785)
81. « — » (x 1039, y 785)
82. « Sprint » (x 1129, y 83)
83. « S42 » (x 1127, y 122)
84. « Terrain hors ligne · 12–16 oct. » (x 1160, y 121)
85. « 4 étapes restantes : ne tiendra pas dans S42. » (x 1128, y 155)
86. « Déplacer en S43 » (x 1157, y 181)
87. « proposé par l'agent » (x 1269, y 181,5)
88. « Dépendances » (x 1129, y 236)
89. « Dépendance » (x 1324, y 237)
90. « Attend » (x 1106, y 274)
91. « F3 » (x 1170, y 274,5)
92. « Réaffecter un ISO » (x 1192, y 274)
93. « Débloque » (x 1106, y 308)
94. « F7 » (x 1170, y 308,5)
95. « Rapport de chantier » (x 1192, y 308)
96. « S44 » (x 1378, y 308,5)
97. « Questions » (x 1129, y 358)
98. « 1 » (x 1201, y 358,5)
99. « Question » (x 1343, y 359)
100. « Quota par affaire : 2 Go ou 5 Go ? » (x 1106, y 396)
101. « Q16 · Produit · hier · EMIS-34 » (x 1106, y 413)
102. « Activité » (x 1129, y 462)
103. « PR #22 ouverte · EMIS-32 » (x 1128, y 498)
104. « 15:04 » (x 1365, y 498,5)
105. « Étape 7 · Porte qualité · EMIS-33 » (x 1128, y 528)
106. « 14:51 » (x 1365, y 528,5)
107. « PR #19 fusionnée · EMIS-31 » (x 1128, y 558)
108. « hier » (x 1378, y 558,5)
109. « Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery. » (x 1113, y 594)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P3 · Fonctionnalité** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `fg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 297, 54 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 364 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 329, y 16, 53 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 390, y 16, 7 × 16
          - « F5 · Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 405, y 16, 220 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 1199 × 951 · flex ligne, espacement 28, marges internes 22 28 22 28, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 269, y 71, 795 × 708 · flex colonne, espacement 18, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 269, y 71, 235 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - icône `package` 14 px, `mfg` — x 269, y 72,5, 14 × 14
            - « Fonctionnalité · F5 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 291, y 72, 101 × 15
            - **sprint** (bloc) · x 400, y 72, 46 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · fond `muted` · bordure 1 `border` · rayon 4
              - icône `sprint` 11 px, `fg` — x 406, y 74, 11 × 11
              - « S42 » — Geist Mono 10,5 / 500, interligne 1,2, couleur `fg` — x 421, y 73, 19 × 13
            - **chip** (bloc) · x 454, y 71, 50 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `blueSoft` · rayon 4
              - « ouverte » — Geist 10,5 / 500, interligne 1,2, couleur `blue` — x 460, y 73, 38 × 13
          - « Envoyer les photos d'un tronçon » — Geist 26 / 600, interligne 1,2, couleur `fg`, interlettrage -0,4 — x 269, y 106, 386 × 32
          - **box** (bloc) · x 269, y 156, 339 × 16 · flex ligne, espacement 12, marges internes 0, alignement center/start
            - **segs** (bloc) · x 269, y 160, 216 × 8 · flex ligne, espacement 4, marges internes 0, alignement center/start
              - **seg** (bloc) · x 269, y 160, 40 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
              - **seg** (bloc) · x 313, y 160, 40 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
              - **seg** (bloc) · x 357, y 160, 40 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
              - **seg** (bloc) · x 401, y 160, 40 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
              - **seg** (bloc) · x 445, y 160, 40 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
            - « 1 étape livrée sur 5 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 497, y 156, 111 × 16
          - **box** (bloc) · x 269, y 190, 795 × 100 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/fixe
            - **box** (bloc) · x 269, y 190, 3 × 100 · fond `fg` · dimension fixe/remplit
            - **box** (bloc) · x 272, y 190, 792 × 89 · flex colonne, espacement 6, marges internes 12 16 12 16, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 288, y 202, 285 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                - icône `target` 14 px, `mfg` — x 288, y 202,5, 14 × 14
                - « Résultat attendu · ce qu'on montrera à la démo » — Geist 12 / 600, interligne 1,2, couleur `mfg` — x 308, y 202, 265 × 15
              - « Sur le terrain, sans réseau, un chef de chantier photographie un tronçon. Les photos partent seules au retour du réseau et apparaissent dans le dossier de l'affaire. » — Geist 14 / 400, interligne 1,55, couleur `fg` — x 288, y 223, 760 × 44
          - **box** (bloc) · x 269, y 308, 795 × 25 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
            - « Parcours de A à Z » — Geist 15 / 600, interligne 1,2, couleur `fg` — x 269, y 311,5, 125 × 18
            - « étapes libres, dans l'ordre des dépendances » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 402, y 313, 249 × 15
            - **Button / ghost** (bloc) · x 924, y 308, 140 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · rayon 6
              - icône `plus` 13 px, `mfg` — x 934, y 314, 13 × 13
              - « Ajouter une étape » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 953, y 313, 101 × 15
          - **box** (bloc) · x 269, y 351, 795 × 428 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 269, y 351, 795 × 100 · flex ligne, espacement 14, marges internes 0, alignement stretch/start · dimension remplit/auto
              - **box** (bloc) · x 269, y 351, 28 × 100 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/fixe
                - **box** (bloc) · x 269, y 351, 28 × 28 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `fg` · rayon 14 · dimension fixe/fixe
                  - icône `check` 14 px, `bg` — x 276, y 358, 14 × 14
                - **box** (bloc) · x 282, y 379, 2 × 72 · fond `fg` · dimension fixe/remplit
              - **box** (bloc) · x 311, y 351, 753 × 75 · flex colonne, espacement 0, marges internes 0 0 16 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 351, 753 × 59 · flex colonne, espacement 7, marges internes 10 14 10 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
                  - **box** (bloc) · x 325, y 361, 725 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                    - « Stockage des photos sur MinIO » — Geist 14 / 500, interligne 1,2, couleur `mfg` — x 325, y 361, 205 × 17
                    - « EMIS-31 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 538, y 362,5, 49 × 14
                    - **box** (bloc) · x 990, y 362, 60 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                      - **dot** (pastille) · x 990, y 365,5, 8 × 8 · fond `green` · dimension fixe/fixe
                      - « Terminé » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1004, y 362, 46 × 15
                  - **box** (bloc) · x 325, y 385, 725 × 15 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/auto
                    - **box** (bloc) · x 325, y 385, 117 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                      - icône `merge` 13 px, `green` — x 325, y 386, 13 × 13
                      - « #19 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 343, y 385, 22 × 15
                      - « fusionnée » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 370, y 385, 55 × 15
                      - icône `circleCheck` 12 px, `green` — x 430, y 386,5, 12 × 12
                    - « hier 18:22 » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 454, y 385,5, 52 × 14
                    - **box** (bloc) · x 933,5, y 385, 116,5 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
                      - **segs** (bloc) · x 933,5, y 387,5, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                        - **seg** (bloc) · x 933,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 939, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 944,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 950, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 955,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 961, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 966,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 972, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 977,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 983, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 988,5, y 387,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 994, y 387,5, 4 × 10 · fond `green` · rayon 1 · dimension fixe/fixe
                      - « 11 · Livré » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1006, y 385, 44 × 15
            - **box** (bloc) · x 269, y 451, 795 × 100 · flex ligne, espacement 14, marges internes 0, alignement stretch/start · dimension remplit/auto
              - **box** (bloc) · x 269, y 451, 28 × 100 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/fixe
                - **box** (bloc) · x 269, y 451, 28 × 28 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `purple` · rayon 14 · dimension fixe/fixe
                  - « 2 » — Geist Mono 12 / 600, interligne 1,2, couleur `#FFFFFF` — x 279, y 457,5, 8 × 15
                - **box** (bloc) · x 282, y 479, 2 × 72 · fond `border` · dimension fixe/remplit
              - **box** (bloc) · x 311, y 451, 753 × 75 · flex colonne, espacement 0, marges internes 0 0 16 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 451, 753 × 59 · flex colonne, espacement 7, marges internes 10 14 10 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
                  - **box** (bloc) · x 325, y 461, 725 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                    - « Route d'envoi des photos » — Geist 14 / 500, interligne 1,2, couleur `fg` — x 325, y 461, 165 × 17
                    - « EMIS-32 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 498, y 462,5, 49 × 14
                    - **box** (bloc) · x 980, y 462, 70 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                      - **dot** (pastille) · x 980, y 465,5, 8 × 8 · fond `purple` · dimension fixe/fixe
                      - « En review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 994, y 462, 56 × 15
                  - **box** (bloc) · x 325, y 485, 725 × 15 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/auto
                    - **box** (bloc) · x 325, y 485, 57 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                      - icône `pr` 13 px, `purple` — x 325, y 486, 13 × 13
                      - « #22 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 343, y 485, 22 × 15
                      - icône `circleCheck` 12 px, `green` — x 370, y 486,5, 12 × 12
                    - « 15:04 » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 394, y 485,5, 30 × 14
                    - **box** (bloc) · x 923,5, y 485, 126,5 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
                      - **segs** (bloc) · x 923,5, y 487,5, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                        - **seg** (bloc) · x 923,5, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 929, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 934,5, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 940, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 945,5, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 951, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 956,5, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 962, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 967,5, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 973, y 487,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 978,5, y 487,5, 4 × 10 · fond `brand` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 984, y 487,5, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                      - « 10 · Démo » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 996, y 485, 54 × 15
            - **box** (bloc) · x 269, y 551, 795 × 100 · flex ligne, espacement 14, marges internes 0, alignement stretch/start · dimension remplit/auto
              - **box** (bloc) · x 269, y 551, 28 × 100 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/fixe
                - **box** (bloc) · x 269, y 551, 28 × 28 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `blue` · rayon 14 · dimension fixe/fixe
                  - « 3 » — Geist Mono 12 / 600, interligne 1,2, couleur `#FFFFFF` — x 279, y 557,5, 8 × 15
                - **box** (bloc) · x 282, y 579, 2 × 72 · fond `border` · dimension fixe/remplit
              - **box** (bloc) · x 311, y 551, 753 × 78 · flex colonne, espacement 0, marges internes 0 0 16 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 551, 753 × 62 · flex colonne, espacement 7, marges internes 10 14 10 14, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
                  - **box** (bloc) · x 325, y 561, 725 × 20 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                    - « Écran d'envoi hors ligne » — Geist 14 / 500, interligne 1,2, couleur `fg` — x 325, y 562,5, 154 × 17
                    - « EMIS-33 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 487, y 564, 49 × 14
                    - **box** (bloc) · x 544, y 561, 167 × 20 · flex ligne, espacement 6, marges internes 3 8 3 8, alignement center/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 12
                      - **dot** (pastille) · x 552, y 568, 6 × 6 · fond `brand` · dimension fixe/fixe
                      - « session · T3 Code · 42 min » — Geist 11,5 / 500, interligne 1,2, couleur `brandText` — x 564, y 564, 139 × 14
                    - **box** (bloc) · x 986, y 563,5, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                      - **dot** (pastille) · x 986, y 567, 8 × 8 · fond `blue` · dimension fixe/fixe
                      - « En cours » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1000, y 563,5, 50 × 15
                  - **box** (bloc) · x 325, y 588, 725 × 15 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/auto
                    - **box** (bloc) · x 325, y 588, 170 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                      - icône `branch` 13 px, `blue` — x 325, y 589, 13 × 13
                      - « feat/envoi-hors-ligne » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 343, y 588, 152 × 15
                    - « 14:51 » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 507, y 588,5, 27 × 14
                    - **box** (bloc) · x 892,5, y 588, 157,5 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
                      - **segs** (bloc) · x 892,5, y 590,5, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                        - **seg** (bloc) · x 892,5, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 898, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 903,5, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 909, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 914,5, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 920, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 925,5, y 590,5, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 931, y 590,5, 4 × 10 · fond `brand` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 936,5, y 590,5, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 942, y 590,5, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 947,5, y 590,5, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                        - **seg** (bloc) · x 953, y 590,5, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                      - « 7 · Porte qualité » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 965, y 588, 85 × 15
            - **box** (bloc) · x 269, y 651, 795 × 100 · flex ligne, espacement 14, marges internes 0, alignement stretch/start · dimension remplit/auto
              - **box** (bloc) · x 269, y 651, 28 × 100 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/fixe
                - **box** (bloc) · x 269, y 651, 28 × 28 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `bg` · bordure 1 `border` · rayon 14 · dimension fixe/fixe
                  - « 4 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 279, y 657,5, 8 × 15
                - **box** (bloc) · x 282, y 679, 2 × 72 · fond `border` · dimension fixe/remplit
              - **box** (bloc) · x 311, y 651, 753 × 111 · flex colonne, espacement 0, marges internes 0 0 16 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 651, 753 × 95 · flex colonne, espacement 7, marges internes 10 14 10 14, alignement start/start · fond `muted` · bordure 1 `mfg` · rayon 8 · dimension remplit/auto
                  - **box** (bloc) · x 325, y 661, 725 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                    - « Tests E2E de l'envoi » — Geist 14 / 500, interligne 1,2, couleur `fg` — x 325, y 661, 129 × 17
                    - « EMIS-34 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 462, y 662,5, 49 × 14
                    - **box** (bloc) · x 998, y 662, 52 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                      - **ring** (pastille) · x 998, y 665,5, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                      - « À faire » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1012, y 662, 38 × 15
                  - **box** (bloc) · x 325, y 685, 725 × 15 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/auto
                    - **box** (bloc) · x 325, y 685, 103 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                      - icône `link` 12 px, `dim` — x 325, y 686,5, 12 × 12
                      - « attend EMIS-33 » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 342, y 685, 86 × 15
                    - **box** (bloc) · x 1039, y 685, 11 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
                      - « — » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 1039, y 685, 11 × 15
                  - **box** (bloc) · x 325, y 707, 725 × 29 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement center/start · dimension remplit/auto
                    - « Prochaine étape à livrer une fois EMIS-33 fusionné. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 325, y 716, 280 × 15
                    - **box** (bloc) · x 688, y 711, 184 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · fond `primary` · rayon 6
                      - icône `copy` 13 px, `pfg` — x 698, y 717, 13 × 13
                      - « Livrer la prochaine étape » — Geist 12,5 / 500, interligne 1,2, couleur `pfg` — x 717, y 716, 145 × 15
                    - **box** (bloc) · x 880, y 711,5, 170 × 24 · flex ligne, espacement 6, marges internes 5 9 5 9, alignement center/start · bordure 1 `border` · rayon 6
                      - « /full-delivery EMIS-34 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 889, y 716,5, 152 × 14
            - **box** (bloc) · x 269, y 751, 795 × 28 · flex ligne, espacement 14, marges internes 0, alignement stretch/start · dimension remplit/auto
              - **box** (bloc) · x 269, y 751, 28 × 28 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **box** (bloc) · x 269, y 751, 28 × 28 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `bg` · bordure 1 `border` · rayon 14 · dimension fixe/fixe
                  - « 5 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 279, y 757,5, 8 × 15
              - **box** (bloc) · x 311, y 751, 753 × 59 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 751, 753 × 59 · flex colonne, espacement 7, marges internes 10 14 10 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
                  - **box** (bloc) · x 325, y 761, 725 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                    - « Démo client » — Geist 14 / 500, interligne 1,2, couleur `fg` — x 325, y 761, 79 × 17
                    - « EMIS-35 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 412, y 762,5, 49 × 14
                    - **box** (bloc) · x 998, y 762, 52 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                      - **ring** (pastille) · x 998, y 765,5, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                      - « À faire » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1012, y 762, 38 × 15
                  - **box** (bloc) · x 325, y 785, 725 × 15 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/auto
                    - **box** (bloc) · x 325, y 785, 103 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                      - icône `link` 12 px, `dim` — x 325, y 786,5, 12 × 12
                      - « attend EMIS-34 » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 342, y 785, 86 × 15
                    - **box** (bloc) · x 1039, y 785, 11 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
                      - « — » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 1039, y 785, 11 × 15
        - **box** (bloc) · x 1092, y 71, 320 × 557 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension fixe/auto
          - **card / Sprint** (bloc) · x 1092, y 71, 320 × 139 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension fixe/auto
            - **box** (bloc) · x 1092, y 71, 320 × 40 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
              - icône `sprint` 15 px, `mfg` — x 1106, y 83,5, 15 × 15
              - « Sprint » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1129, y 83, 39 × 16
            - **line** (bloc) · x 1092, y 111, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 112, 320 × 33 · flex ligne, espacement 8, marges internes 9 14 9 14, alignement center/start · dimension remplit/auto
              - **sprint** (bloc) · x 1106, y 121, 46 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · fond `muted` · bordure 1 `border` · rayon 4
                - icône `sprint` 11 px, `fg` — x 1112, y 123, 11 × 11
                - « S42 » — Geist Mono 10,5 / 500, interligne 1,2, couleur `fg` — x 1127, y 122, 19 × 13
              - « Terrain hors ligne · 12–16 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1160, y 121, 163 × 15
              - icône `chevDown` 13 px, `dim` — x 1385, y 122, 13 × 13
            - **line** (bloc) · x 1092, y 145, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 146, 320 × 64 · flex ligne, espacement 8, marges internes 9 14 9 14, alignement start/start · dimension remplit/auto
              - icône `clockAlert` 14 px, `red` — x 1106, y 155, 14 × 14
              - **box** (bloc) · x 1128, y 155, 270 × 46 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
                - « 4 étapes restantes : ne tiendra pas dans S42. » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1128, y 155, 270 × 15
                - **box** (bloc) · x 1128, y 176, 243 × 25 · flex ligne, espacement 8, marges internes 0, alignement center/start
                  - **Button / outline** (bloc) · x 1128, y 176, 133 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                    - icône `sprint` 13 px, `fg` — x 1138, y 182, 13 × 13
                    - « Déplacer en S43 » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1157, y 181, 94 × 15
                  - « proposé par l'agent » — Geist 11,5 / 400, interligne 1,2, couleur `brandText` — x 1269, y 181,5, 102 × 14
          - **card / Dépendances** (bloc) · x 1092, y 224, 320 × 108 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension fixe/auto
            - **box** (bloc) · x 1092, y 224, 320 × 40 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
              - icône `link` 15 px, `mfg` — x 1106, y 236,5, 15 × 15
              - « Dépendances » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1129, y 236, 86 × 16
              - **Button / ghost** (bloc) · x 1299, y 233, 99 × 22 · flex ligne, espacement 6, marges internes 4 6 4 6, alignement center/center · rayon 6
                - icône `plus` 13 px, `mfg` — x 1305, y 237,5, 13 × 13
                - « Dépendance » — Geist 11,5 / 500, interligne 1,2, couleur `mfg` — x 1324, y 237, 68 × 14
            - **line** (bloc) · x 1092, y 264, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 265, 320 × 33 · flex ligne, espacement 8, marges internes 9 14 9 14, alignement center/start · dimension remplit/auto
              - « Attend » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1106, y 274, 56 × 15
              - « F3 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1170, y 274,5, 14 × 14
              - « Réaffecter un ISO » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1192, y 274, 101 × 15
              - icône `circleCheck` 13 px, `green` — x 1385, y 275, 13 × 13
            - **line** (bloc) · x 1092, y 298, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 299, 320 × 33 · flex ligne, espacement 8, marges internes 9 14 9 14, alignement center/start · dimension remplit/auto
              - « Débloque » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1106, y 308, 56 × 15
              - « F7 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1170, y 308,5, 14 × 14
              - « Rapport de chantier » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1192, y 308, 114 × 15
              - « S44 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1378, y 308,5, 20 × 14
          - **card / Questions** (bloc) · x 1092, y 346, 320 × 90 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension fixe/auto
            - **box** (bloc) · x 1092, y 346, 320 × 40 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
              - icône `question` 15 px, `mfg` — x 1106, y 358,5, 15 × 15
              - « Questions » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1129, y 358, 64 × 16
              - « 1 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 1201, y 358,5, 8 × 15
              - **Button / ghost** (bloc) · x 1318, y 355, 80 × 22 · flex ligne, espacement 6, marges internes 4 6 4 6, alignement center/center · rayon 6
                - icône `plus` 13 px, `mfg` — x 1324, y 359,5, 13 × 13
                - « Question » — Geist 11,5 / 500, interligne 1,2, couleur `mfg` — x 1343, y 359, 49 × 14
            - **line** (bloc) · x 1092, y 386, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 387, 320 × 49 · flex ligne, espacement 10, marges internes 9 14 9 14, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 1106, y 396, 292 × 31 · flex colonne, espacement 2, marges internes 0, alignement start/start · dimension remplit/auto
                - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1106, y 396, 292 × 15
                - « Q16 · Produit · hier · EMIS-34 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1106, y 413, 141 × 14
          - **card / Activité** (bloc) · x 1092, y 450, 320 × 130 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension fixe/auto
            - **box** (bloc) · x 1092, y 450, 320 × 40 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
              - icône `activity` 15 px, `mfg` — x 1106, y 462,5, 15 × 15
              - « Activité » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1129, y 462, 49 × 16
            - **line** (bloc) · x 1092, y 490, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 491, 320 × 29 · flex ligne, espacement 9, marges internes 7 14 7 14, alignement center/start · dimension remplit/auto
              - icône `pr` 13 px, `purple` — x 1106, y 499, 13 × 13
              - « PR #22 ouverte · EMIS-32 » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 1128, y 498, 228 × 15
              - « 15:04 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1365, y 498,5, 33 × 14
            - **line** (bloc) · x 1092, y 520, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 521, 320 × 29 · flex ligne, espacement 9, marges internes 7 14 7 14, alignement center/start · dimension remplit/auto
              - icône `flag` 13 px, `mfg` — x 1106, y 529, 13 × 13
              - « Étape 7 · Porte qualité · EMIS-33 » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 1128, y 528, 228 × 15
              - « 14:51 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1365, y 528,5, 33 × 14
            - **line** (bloc) · x 1092, y 550, 320 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1092, y 551, 320 × 29 · flex ligne, espacement 9, marges internes 7 14 7 14, alignement center/start · dimension remplit/auto
              - icône `merge` 13 px, `green` — x 1106, y 559, 13 × 13
              - « PR #19 fusionnée · EMIS-31 » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 1128, y 558, 241 × 15
              - « hier » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1378, y 558,5, 20 × 14
          - **box** (bloc) · x 1092, y 594, 320 × 34 · flex ligne, espacement 8, marges internes 0, alignement start/start · dimension remplit/auto
            - icône `lock` 13 px, `dim` — x 1092, y 594, 13 × 13
            - « Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery. » — Geist 11,5 / 400, interligne 1,45, couleur `dim` — x 1113, y 594, 299 × 34

## P4 · Tickets

Board `P4 · Tickets` (sombre) et `P4 · Tickets (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign » ; écran 213 de la page « 35 · Redesign Emis » du fichier « Kibo ».
Exports : `exports/proposition-tickets-dark.png` et `exports/proposition-tickets-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Tickets » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Tickets » (x 265, y 67)
34. « sprint S42 · 14 tickets dans 3 fonctionnalités » (x 352, y 79)
35. « Nouveau ticket » (x 1321, y 74)
36. « Tous les sprints » (x 277, y 112)
37. « S41 » (x 390, y 112)
38. « S42 » (x 452, y 112)
39. « S43 » (x 497, y 112)
40. « S44 » (x 542, y 112)
41. « À planifier » (x 587, y 112)
42. « Ouverts » (x 1098, y 112)
43. « Fonctionnalité » (x 1190, y 112)
44. « Activité récente » (x 1317, y 112)
45. « Clé » (x 279, y 154)
46. « Titre » (x 365, y 154)
47. « Fonctionnalité » (x 582, y 154)
48. « État » (x 820, y 154)
49. « Git et PR » (x 936, y 154)
50. « Livraison » (x 1144, y 154)
51. « Mis à jour » (x 1324, y 154)
52. « EMIS-33 » (x 279, y 190,5)
53. « Écran d'envoi hors ligne » (x 365, y 190)
54. « F5 · Envoyer les photos d'un tronçon » (x 603, y 191,5)
55. « En cours » (x 835, y 190,5)
56. « feat/envoi-hors-ligne » (x 954, y 190,5)
57. « 7 · Porte qualité » (x 1216,5, y 190,5)
58. « il y a 9 min » (x 1324, y 190,5)
59. « EMIS-45 » (x 279, y 231,5)
60. « Conflits de saisie » (x 365, y 231)
61. « F4 · Saisir un tronçon hors ligne » (x 603, y 232,5)
62. « En review » (x 835, y 231,5)
63. « #20 » (x 954, y 231,5)
64. « changements demandés » (x 981, y 231,5)
65. « 9 · Review » (x 1216,5, y 231,5)
66. « il y a 18 min » (x 1324, y 231,5)
67. « EMIS-32 » (x 279, y 272,5)
68. « Route d'envoi des photos » (x 365, y 272)
69. « F5 · Envoyer les photos d'un tronçon » (x 603, y 273,5)
70. « En review » (x 835, y 272,5)
71. « #22 » (x 954, y 272,5)
72. « 10 · Démo » (x 1216,5, y 272,5)
73. « il y a 1 h » (x 1324, y 272,5)
74. « EMIS-34 » (x 279, y 313,5)
75. « Tests E2E de l'envoi » (x 365, y 313)
76. « F5 · Envoyer les photos d'un tronçon » (x 603, y 314,5)
77. « À faire » (x 835, y 313,5)
78. « attend EMIS-33 » (x 953, y 313,5)
79. « — » (x 1144, y 313,5)
80. « hier » (x 1324, y 313,5)
81. « EMIS-35 » (x 279, y 354,5)
82. « Démo client » (x 365, y 354)
83. « F5 · Envoyer les photos d'un tronçon » (x 603, y 355,5)
84. « À faire » (x 835, y 354,5)
85. « attend EMIS-34 » (x 953, y 354,5)
86. « — » (x 1144, y 354,5)
87. « hier » (x 1324, y 354,5)
88. « EMIS-46 » (x 279, y 395,5)
89. « Démo client » (x 365, y 395)
90. « F4 · Saisir un tronçon hors ligne » (x 603, y 396,5)
91. « À faire » (x 835, y 395,5)
92. « — » (x 936, y 395,5)
93. « — » (x 1144, y 395,5)
94. « lun. » (x 1324, y 395,5)
95. « Terminés dans S42 » (x 316, y 432,5)
96. « 8 » (x 431, y 433)
97. « EMIS-21 » (x 279, y 469,5)
98. « Démo client » (x 365, y 469)
99. « F3 · Réaffecter un ISO » (x 603, y 470,5)
100. « Terminé » (x 835, y 469,5)
101. « #18 » (x 954, y 469,5)
102. « fusionnée » (x 981, y 469,5)
103. « 11 · Livré » (x 1216,5, y 469,5)
104. « il y a 2 h » (x 1324, y 469,5)
105. « EMIS-31 » (x 279, y 510,5)
106. « Stockage des photos sur MinIO » (x 365, y 510)
107. « F5 · Envoyer les photos d'un tronçon » (x 603, y 511,5)
108. « Terminé » (x 835, y 510,5)
109. « #19 » (x 954, y 510,5)
110. « fusionnée » (x 981, y 510,5)
111. « 11 · Livré » (x 1216,5, y 510,5)
112. « hier » (x 1324, y 510,5)
113. « EMIS-43 » (x 279, y 551,5)
114. « Synchro au retour du réseau » (x 365, y 551)
115. « F4 · Saisir un tronçon hors ligne » (x 603, y 552,5)
116. « Terminé » (x 835, y 551,5)
117. « #16 » (x 954, y 551,5)
118. « fusionnée » (x 981, y 551,5)
119. « 11 · Livré » (x 1216,5, y 551,5)
120. « mer. » (x 1324, y 551,5)
121. « EMIS-42 » (x 279, y 592,5)
122. « Formulaire de saisie » (x 365, y 592)
123. « F4 · Saisir un tronçon hors ligne » (x 603, y 593,5)
124. « Terminé » (x 835, y 592,5)
125. « #14 » (x 954, y 592,5)
126. « fusionnée » (x 981, y 592,5)
127. « 11 · Livré » (x 1216,5, y 592,5)
128. « mar. » (x 1324, y 592,5)
129. « Hors fonctionnalité » (x 300, y 629,5)
130. « 1 » (x 415, y 630)
131. « États tirés de git : branche poussée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step. » (x 286, y 665)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P4 · Tickets** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `fg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 329, 44 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 112 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Tickets » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 44 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 1199 × 951 · flex colonne, espacement 12, marges internes 18 24 18 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 1151 × 27 · flex ligne, espacement 10, marges internes 0, alignement end/start · dimension remplit/auto
          - « Tickets » — Geist 22 / 600, interligne 1,2, couleur `fg` — x 265, y 67, 77 × 27
          - « sprint S42 · 14 tickets dans 3 fonctionnalités » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 352, y 79, 252 × 15
          - **Button / default** (bloc) · x 1292, y 69, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `primary` · rayon 6
            - icône `plus` 13 px, `pfg` — x 1302, y 75, 13 × 13
            - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `pfg` — x 1321, y 74, 85 × 15
        - **box** (bloc) · x 265, y 106, 1151 × 27 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 106, 394 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
            - **box** (bloc) · x 267, y 108, 111 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « Tous les sprints » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 277, y 112, 91 × 15
            - **box** (bloc) · x 380, y 108, 43 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « S41 » — Geist Mono 12,5 / 500, interligne 1,2, couleur `mfg` — x 390, y 112, 23 × 15
            - **box** (bloc) · x 425, y 108, 60 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
              - icône `sprint` 12 px, `fg` — x 435, y 113,5, 12 × 12
              - « S42 » — Geist Mono 12,5 / 500, interligne 1,2, couleur `fg` — x 452, y 112, 23 × 15
            - **box** (bloc) · x 487, y 108, 43 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « S43 » — Geist Mono 12,5 / 500, interligne 1,2, couleur `mfg` — x 497, y 112, 23 × 15
            - **box** (bloc) · x 532, y 108, 43 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « S44 » — Geist Mono 12,5 / 500, interligne 1,2, couleur `mfg` — x 542, y 112, 23 × 15
            - **box** (bloc) · x 577, y 108, 80 × 23 · flex ligne, espacement 5, marges internes 4 10 4 10, alignement center/start · rayon 5
              - « À planifier » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 587, y 112, 60 × 15
          - **Button / outline** (bloc) · x 1069, y 107, 84 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
            - icône `circleCheck` 13 px, `fg` — x 1079, y 113, 13 × 13
            - « Ouverts » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1098, y 112, 45 × 15
          - **Button / outline** (bloc) · x 1161, y 107, 119 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
            - icône `package` 13 px, `fg` — x 1171, y 113, 13 × 13
            - « Fonctionnalité » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1190, y 112, 80 × 15
          - **Button / outline** (bloc) · x 1288, y 107, 128 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
            - icône `sort` 13 px, `fg` — x 1298, y 113, 13 × 13
            - « Activité récente » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1317, y 112, 89 × 15
        - **box** (bloc) · x 265, y 145, 1151 × 508 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
          - **box** (bloc) · x 265, y 145, 1151 × 32 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · fond `panel` · dimension remplit/fixe
            - **box** (bloc) · x 279, y 154, 74 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « Clé » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 279, y 154, 18 × 14
            - **box** (bloc) · x 365, y 154, 205 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
              - « Titre » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 365, y 154, 25 × 14
            - **box** (bloc) · x 582, y 154, 226 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « Fonctionnalité » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 582, y 154, 77 × 14
            - **box** (bloc) · x 820, y 154, 104 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « État » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 820, y 154, 22 × 14
            - **box** (bloc) · x 936, y 154, 196 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « Git et PR » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 936, y 154, 48 × 14
            - **box** (bloc) · x 1144, y 154, 168 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « Livraison » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 1144, y 154, 49 × 14
            - **box** (bloc) · x 1324, y 154, 78 × 14 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « Mis à jour » — Geist 11,5 / 500, interligne 1,2, couleur `dim` — x 1324, y 154, 53 × 14
          - **line** (bloc) · x 265, y 177, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 178, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 190,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 190,5, 51 × 15
            - **box** (bloc) · x 365, y 190, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Écran d'envoi hors ligne » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 190, 140 × 16
              - **dot** (pastille) · x 513, y 194,5, 7 × 7 · fond `brand` · dimension fixe/fixe · masqué en comparaison pixel (`PIXEL_MASKS.tickets`, x 509, y 191, 14 × 14 : sessions T3 Code, phase 26)
            - **box** (bloc) · x 582, y 190,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 190,5, 205 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 192,5, 11 × 11
                - « F5 · Envoyer les photos d'un tronçon » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 191,5, 178 × 13
            - **box** (bloc) · x 820, y 190,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 194, 8 × 8 · fond `blue` · dimension fixe/fixe
              - « En cours » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 190,5, 50 × 15
            - **box** (bloc) · x 936, y 190,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 190,5, 170 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `branch` 13 px, `blue` — x 936, y 191,5, 13 × 13
                - « feat/envoi-hors-ligne » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 190,5, 152 × 15
            - **box** (bloc) · x 1144, y 190,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 193, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 193, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 193, 4 × 10 · fond `brand` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 193, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 193, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 193, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 193, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
              - « 7 · Porte qualité » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 190,5, 85 × 15
            - **box** (bloc) · x 1324, y 190,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « il y a 9 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 190,5, 59 × 15
          - **line** (bloc) · x 265, y 218, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 219, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 231,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 231,5, 51 × 15
            - **box** (bloc) · x 365, y 231, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 231, 102 × 16
              - **dot** (pastille) · x 475, y 235,5, 7 × 7 · fond `brand` · dimension fixe/fixe · masqué en comparaison pixel (`PIXEL_MASKS.tickets`, x 471, y 232, 14 × 14 : sessions T3 Code, phase 26)
            - **box** (bloc) · x 582, y 231,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 231,5, 182 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 233,5, 11 × 11
                - « F4 · Saisir un tronçon hors ligne » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 232,5, 155 × 13
            - **box** (bloc) · x 820, y 231,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 235, 8 × 8 · fond `purple` · dimension fixe/fixe
              - « En review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 231,5, 56 × 15
            - **box** (bloc) · x 936, y 231,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 231,5, 197 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `pr` 13 px, `amber` — x 936, y 232,5, 13 × 13
                - « #20 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 231,5, 22 × 15
                - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 981, y 231,5, 135 × 15
                - icône `circleX` 12 px, `red` — x 1121, y 233, 12 × 12
            - **box** (bloc) · x 1144, y 231,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 234, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 234, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 234, 4 × 10 · fond `brand` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 234, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 234, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
              - « 9 · Review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 231,5, 56 × 15
            - **box** (bloc) · x 1324, y 231,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « il y a 18 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 231,5, 64 × 15
          - **line** (bloc) · x 265, y 259, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 260, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 272,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 272,5, 51 × 15
            - **box** (bloc) · x 365, y 272, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Route d'envoi des photos » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 272, 149 × 16
            - **box** (bloc) · x 582, y 272,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 272,5, 205 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 274,5, 11 × 11
                - « F5 · Envoyer les photos d'un tronçon » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 273,5, 178 × 13
            - **box** (bloc) · x 820, y 272,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 276, 8 × 8 · fond `purple` · dimension fixe/fixe
              - « En review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 272,5, 56 × 15
            - **box** (bloc) · x 936, y 272,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 272,5, 57 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `pr` 13 px, `purple` — x 936, y 273,5, 13 × 13
                - « #22 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 272,5, 22 × 15
                - icône `circleCheck` 12 px, `green` — x 981, y 274, 12 × 12
            - **box** (bloc) · x 1144, y 272,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 275, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 275, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 275, 4 × 10 · fond `brand` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 275, 4 × 10 · fond `border` · rayon 1 · dimension fixe/fixe
              - « 10 · Démo » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 272,5, 54 × 15
            - **box** (bloc) · x 1324, y 272,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « il y a 1 h » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 272,5, 43 × 15
          - **line** (bloc) · x 265, y 300, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 301, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 313,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-34 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 313,5, 51 × 15
            - **box** (bloc) · x 365, y 313, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Tests E2E de l'envoi » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 313, 117 × 16
            - **box** (bloc) · x 582, y 313,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 313,5, 205 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 315,5, 11 × 11
                - « F5 · Envoyer les photos d'un tronçon » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 314,5, 178 × 13
            - **box** (bloc) · x 820, y 313,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **ring** (pastille) · x 820, y 317, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 313,5, 38 × 15
            - **box** (bloc) · x 936, y 313,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 313,5, 103 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `link` 12 px, `dim` — x 936, y 315, 12 × 12
                - « attend EMIS-33 » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 953, y 313,5, 86 × 15
            - **box** (bloc) · x 1144, y 313,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - « — » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 1144, y 313,5, 11 × 15
            - **box** (bloc) · x 1324, y 313,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « hier » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 313,5, 21 × 15
          - **line** (bloc) · x 265, y 341, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 342, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 354,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-35 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 354,5, 51 × 15
            - **box** (bloc) · x 365, y 354, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 354, 72 × 16
            - **box** (bloc) · x 582, y 354,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 354,5, 205 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 356,5, 11 × 11
                - « F5 · Envoyer les photos d'un tronçon » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 355,5, 178 × 13
            - **box** (bloc) · x 820, y 354,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **ring** (pastille) · x 820, y 358, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 354,5, 38 × 15
            - **box** (bloc) · x 936, y 354,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 354,5, 103 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `link` 12 px, `dim` — x 936, y 356, 12 × 12
                - « attend EMIS-34 » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 953, y 354,5, 86 × 15
            - **box** (bloc) · x 1144, y 354,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - « — » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 1144, y 354,5, 11 × 15
            - **box** (bloc) · x 1324, y 354,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « hier » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 354,5, 21 × 15
          - **line** (bloc) · x 265, y 382, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 383, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 395,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-46 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 279, y 395,5, 51 × 15
            - **box** (bloc) · x 365, y 395, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 365, y 395, 72 × 16
            - **box** (bloc) · x 582, y 395,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 395,5, 182 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 397,5, 11 × 11
                - « F4 · Saisir un tronçon hors ligne » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 396,5, 155 × 13
            - **box** (bloc) · x 820, y 395,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **ring** (pastille) · x 820, y 399, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 835, y 395,5, 38 × 15
            - **box** (bloc) · x 936, y 395,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 395,5, 11 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - « — » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 936, y 395,5, 11 × 15
            - **box** (bloc) · x 1144, y 395,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - « — » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 1144, y 395,5, 11 × 15
            - **box** (bloc) · x 1324, y 395,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « lun. » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 395,5, 20 × 15
          - **line** (bloc) · x 265, y 423, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 424, 1151 × 32 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · fond `panel` · dimension remplit/fixe
            - icône `chevDown` 13 px, `dim` — x 279, y 433,5, 13 × 13
            - **dot** (pastille) · x 300, y 436, 8 × 8 · fond `green` · dimension fixe/fixe
            - « Terminés dans S42 » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 316, y 432,5, 107 × 15
            - « 8 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 431, y 433, 7 × 14
          - **line** (bloc) · x 265, y 456, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 457, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 469,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-21 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 279, y 469,5, 51 × 15
            - **box** (bloc) · x 365, y 469, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 365, y 469, 72 × 16
            - **box** (bloc) · x 582, y 469,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 469,5, 134 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 471,5, 11 × 11
                - « F3 · Réaffecter un ISO » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 470,5, 107 × 13
            - **box** (bloc) · x 820, y 469,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 473, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 835, y 469,5, 46 × 15
            - **box** (bloc) · x 936, y 469,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 469,5, 100 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `merge` 13 px, `green` — x 936, y 470,5, 13 × 13
                - « #18 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 469,5, 22 × 15
                - « fusionnée » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 981, y 469,5, 55 × 15
            - **box** (bloc) · x 1144, y 469,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 472, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 472, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 472, 4 × 10 · fond `green` · rayon 1 · dimension fixe/fixe
              - « 11 · Livré » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 469,5, 44 × 15
            - **box** (bloc) · x 1324, y 469,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 469,5, 46 × 15
          - **line** (bloc) · x 265, y 497, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 498, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 510,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-31 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 279, y 510,5, 51 × 15
            - **box** (bloc) · x 365, y 510, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Stockage des photos sur MinIO » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 365, y 510, 186 × 16
            - **box** (bloc) · x 582, y 510,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 510,5, 205 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 512,5, 11 × 11
                - « F5 · Envoyer les photos d'un tronçon » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 511,5, 178 × 13
            - **box** (bloc) · x 820, y 510,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 514, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 835, y 510,5, 46 × 15
            - **box** (bloc) · x 936, y 510,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 510,5, 117 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `merge` 13 px, `green` — x 936, y 511,5, 13 × 13
                - « #19 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 510,5, 22 × 15
                - « fusionnée » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 981, y 510,5, 55 × 15
                - icône `circleCheck` 12 px, `green` — x 1041, y 512, 12 × 12
            - **box** (bloc) · x 1144, y 510,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 513, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 513, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 513, 4 × 10 · fond `green` · rayon 1 · dimension fixe/fixe
              - « 11 · Livré » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 510,5, 44 × 15
            - **box** (bloc) · x 1324, y 510,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « hier » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 510,5, 21 × 15
          - **line** (bloc) · x 265, y 538, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 539, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 551,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-43 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 279, y 551,5, 51 × 15
            - **box** (bloc) · x 365, y 551, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Synchro au retour du réseau » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 365, y 551, 167 × 16
            - **box** (bloc) · x 582, y 551,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 551,5, 182 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 553,5, 11 × 11
                - « F4 · Saisir un tronçon hors ligne » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 552,5, 155 × 13
            - **box** (bloc) · x 820, y 551,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 555, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 835, y 551,5, 46 × 15
            - **box** (bloc) · x 936, y 551,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 551,5, 100 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `merge` 13 px, `green` — x 936, y 552,5, 13 × 13
                - « #16 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 551,5, 22 × 15
                - « fusionnée » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 981, y 551,5, 55 × 15
            - **box** (bloc) · x 1144, y 551,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 554, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 554, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 554, 4 × 10 · fond `green` · rayon 1 · dimension fixe/fixe
              - « 11 · Livré » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 551,5, 44 × 15
            - **box** (bloc) · x 1324, y 551,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « mer. » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 551,5, 24 × 15
          - **line** (bloc) · x 265, y 579, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 580, 1151 × 40 · flex ligne, espacement 12, marges internes 0 14 0 14, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 279, y 592,5, 74 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « EMIS-42 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 279, y 592,5, 51 × 15
            - **box** (bloc) · x 365, y 592, 205 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Formulaire de saisie » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 365, y 592, 119 × 16
            - **box** (bloc) · x 582, y 592,5, 226 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **fchip** (bloc) · x 582, y 592,5, 182 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                - icône `package` 11 px, `dim` — x 588, y 594,5, 11 × 11
                - « F4 · Saisir un tronçon hors ligne » — Geist 10,5 / 500, interligne 1,2, couleur `mfg` — x 603, y 593,5, 155 × 13
            - **box** (bloc) · x 820, y 592,5, 104 × 15 · flex ligne, espacement 7, marges internes 0, alignement center/start · dimension fixe/auto
              - **dot** (pastille) · x 820, y 596, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 835, y 592,5, 46 × 15
            - **box** (bloc) · x 936, y 592,5, 196 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 936, y 592,5, 100 × 15 · flex ligne, espacement 5, marges internes 0, alignement center/start
                - icône `merge` 13 px, `green` — x 936, y 593,5, 13 × 13
                - « #14 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 954, y 592,5, 22 × 15
                - « fusionnée » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 981, y 592,5, 55 × 15
            - **box** (bloc) · x 1144, y 592,5, 168 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 1144, y 595, 64,5 × 10 · flex ligne, espacement 1,5, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1144, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1149,5, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1155, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1160,5, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1166, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1171,5, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1177, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1182,5, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1188, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1193,5, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1199, y 595, 4 × 10 · fond `mfg` · rayon 1 · dimension fixe/fixe
                - **seg** (bloc) · x 1204,5, y 595, 4 × 10 · fond `green` · rayon 1 · dimension fixe/fixe
              - « 11 · Livré » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1216,5, y 592,5, 44 × 15
            - **box** (bloc) · x 1324, y 592,5, 78 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « mar. » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1324, y 592,5, 24 × 15
          - **line** (bloc) · x 265, y 620, 1151 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 621, 1151 × 32 · flex ligne, espacement 8, marges internes 0 14 0 14, alignement center/start · fond `panel` · dimension remplit/fixe
            - icône `chevRight` 13 px, `dim` — x 279, y 630,5, 13 × 13
            - « Hors fonctionnalité » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 300, y 629,5, 107 × 15
            - « 1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 630, 7 × 14
        - **box** (bloc) · x 265, y 665, 1151 × 14 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - icône `refresh` 13 px, `dim` — x 265, y 665,5, 13 × 13
          - « États tirés de git : branche poussée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 286, y 665, 703 × 14

## P5 · Graphe

Board `P5 · Graphe` (sombre) et `P5 · Graphe (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign » ; écran 214 de la page « 35 · Redesign Emis » du fichier « Kibo ».
Exports : `exports/proposition-graphe-dark.png` et `exports/proposition-graphe-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Graphe » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Regrouper : Fonctionnalités » (x 286, y 64,5)
34. « Colonnes : Sprints » (x 488, y 64,5)
35. « Livrées repliées » (x 638, y 64,5)
36. « Options » (x 773, y 64,5)
37. « 9 fonctionnalités · 13 dépendances entre étapes, 7 entre fonctionnalités » (x 1036, y 64,5)
38. « S41 » (x 273, y 108)
39. « Accès » (x 301, y 108)
40. « terminé » (x 255, y 125)
41. « S42 » (x 423, y 108)
42. « Terrain hors ligne » (x 451, y 108)
43. « en cours » (x 405, y 125)
44. « S43 » (x 713, y 108)
45. « Import et soudures » (x 741, y 108)
46. « prévu » (x 695, y 125)
47. « S44 » (x 973, y 108)
48. « Rapports » (x 1001, y 108)
49. « prévu » (x 955, y 125)
50. « À planifier » (x 1223, y 108)
51. « F1 » (x 263, y 176)
52. « 4/4 » (x 331, y 176)
53. « Se connecter avec Microsoft » (x 263, y 196)
54. « F3 » (x 415, y 176)
55. « 4/4 » (x 619, y 176)
56. « Réaffecter un ISO » (x 415, y 196)
57. « F6 » (x 705, y 176)
58. « 0/4 » (x 897, y 176)
59. « Importer les ISO depuis Excel » (x 705, y 196)
60. « Lecture du fichier Excel » (x 726, y 233)
61. « Contrôle des repères » (x 726, y 263)
62. « Écran d'import » (x 726, y 293)
63. « Démo client » (x 726, y 323)
64. « bloquée par Q14 » (x 722, y 348)
65. « F7 » (x 965, y 176)
66. « 0/5 » (x 1147, y 176)
67. « Rapport de chantier journalier » (x 965, y 196)
68. « Modèle du rapport » (x 986, y 233)
69. « Génération PDF » (x 986, y 263)
70. « Photos dans le rapport » (x 986, y 293)
71. « Envoi le soir » (x 986, y 323)
72. « Démo client » (x 986, y 353)
73. « F9 » (x 1215, y 176)
74. « 0/3 » (x 1357, y 176)
75. « Exporter le dossier client » (x 1215, y 196)
76. « Format du dossier » (x 1236, y 233)
77. « Archive ZIP » (x 1236, y 263)
78. « Démo client » (x 1236, y 293)
79. « F4 » (x 415, y 272)
80. « 3/5 » (x 637, y 272)
81. « Saisir un tronçon hors ligne » (x 415, y 292)
82. « Schéma local des tronçons » (x 436, y 329)
83. « Formulaire de saisie » (x 436, y 359)
84. « Synchro au retour du réseau » (x 436, y 389)
85. « Conflits de saisie » (x 436, y 419)
86. « Démo client » (x 436, y 449)
87. « F2 » (x 263, y 287)
88. « 5/5 » (x 331, y 287)
89. « Voir ses ISO affectés » (x 263, y 307)
90. « F8 » (x 705, y 412)
91. « 0/4 » (x 897, y 412)
92. « Valider les soudures par lot » (x 705, y 432)
93. « Statuts de soudure » (x 726, y 469)
94. « Sélection multiple » (x 726, y 499)
95. « Validation par lot » (x 726, y 529)
96. « Démo client » (x 726, y 559)
97. « F5 » (x 415, y 518)
98. « 1/5 » (x 637, y 518)
99. « Envoyer les photos d'un tronçon » (x 415, y 538)
100. « Stockage des photos sur MinIO » (x 436, y 575)
101. « Route d'envoi des photos » (x 436, y 605)
102. « Écran d'envoi hors ligne » (x 436, y 635)
103. « Tests E2E de l'envoi » (x 436, y 665)
104. « Démo client » (x 436, y 695)
105. « en retard · glisse en S43 » (x 432, y 720)
106. « À faire » (x 283, y 960)
107. « En cours » (x 346, y 960)
108. « En review » (x 420, y 960)
109. « Bloqué » (x 499, y 960)
110. « Fonctionnalité » (x 570, y 960)
111. « Colonne = sprint » (x 677, y 960)
112. « Session active » (x 790, y 960)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P5 · Graphe** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `fg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 393, 44 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 112 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Graphe » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 44 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 1199 × 46 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
        - **Button / outline** (bloc) · x 257, y 59,5, 194 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `package` 13 px, `fg` — x 267, y 65,5, 13 × 13
          - « Regrouper : Fonctionnalités » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 286, y 64,5, 155 × 15
        - **Button / outline** (bloc) · x 459, y 59,5, 142 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `sprint` 13 px, `fg` — x 469, y 65,5, 13 × 13
          - « Colonnes : Sprints » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 488, y 64,5, 103 × 15
        - **Button / outline** (bloc) · x 609, y 59,5, 127 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `circleCheck` 13 px, `fg` — x 619, y 65,5, 13 × 13
          - « Livrées repliées » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 638, y 64,5, 88 × 15
        - **Button / outline** (bloc) · x 744, y 59,5, 83 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `slidersHorizontal` 13 px, `fg` — x 754, y 65,5, 13 × 13
          - « Options » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 773, y 64,5, 44 × 15
        - « 9 fonctionnalités · 13 dépendances entre étapes, 7 entre fonctionnalités » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1036, y 64,5, 388 × 15
      - **line** (bloc) · x 241, y 95, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **canvas** (bloc) · x 241, y 96, 1199 × 904 · fond `canvas` · dimension remplit/remplit
        - **lane S41** (bloc) · x 241, y 96, 150 × 904 · fond `canvas`
        - icône `edges` 1199 px, `mfg` — x 241, y 96, 1199 × 904
        - **lane S42** (bloc) · x 391, y 96, 290 × 904 · fond `panel`
        - **lane S43** (bloc) · x 681, y 96, 260 × 904 · fond `canvas`
        - **lane S44** (bloc) · x 941, y 96, 250 × 904 · fond `panel`
        - **lane reserve** (bloc) · x 1191, y 96, 210 × 904 · fond `canvas`
        - **box** (bloc) · x 255, y 108, 82 × 31 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - **box** (bloc) · x 255, y 108, 82 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `sprint` 12 px, `dim` — x 255, y 109,5, 12 × 12
            - « S41 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 273, y 108, 22 × 15
            - « Accès » — Geist 12 / 600, interligne 1,2, couleur `mfg` — x 301, y 108, 36 × 15
          - « terminé » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 255, y 125, 39 × 14
        - **box** (bloc) · x 405, y 108, 145 × 31 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - **box** (bloc) · x 405, y 108, 145 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `sprint` 12 px, `fg` — x 405, y 109,5, 12 × 12
            - « S42 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 423, y 108, 22 × 15
            - « Terrain hors ligne » — Geist 12 / 600, interligne 1,2, couleur `fg` — x 451, y 108, 99 × 15
          - « en cours » — Geist 11 / 400, interligne 1,2, couleur `fg` — x 405, y 125, 44 × 14
        - **box** (bloc) · x 695, y 108, 155 × 31 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - **box** (bloc) · x 695, y 108, 155 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `sprint` 12 px, `dim` — x 695, y 109,5, 12 × 12
            - « S43 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 713, y 108, 22 × 15
            - « Import et soudures » — Geist 12 / 600, interligne 1,2, couleur `mfg` — x 741, y 108, 109 × 15
          - « prévu » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 695, y 125, 29 × 14
        - **box** (bloc) · x 955, y 108, 99 × 31 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - **box** (bloc) · x 955, y 108, 99 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `sprint` 12 px, `dim` — x 955, y 109,5, 12 × 12
            - « S44 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 973, y 108, 22 × 15
            - « Rapports » — Geist 12 / 600, interligne 1,2, couleur `mfg` — x 1001, y 108, 53 × 15
          - « prévu » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 955, y 125, 29 × 14
        - **box** (bloc) · x 1205, y 108, 77 × 15 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - **box** (bloc) · x 1205, y 108, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `inbox` 12 px, `dim` — x 1205, y 109,5, 12 × 12
            - « À planifier » — Geist 12 / 600, interligne 1,2, couleur `mfg` — x 1223, y 108, 59 × 15
        - **box** (bloc) · x 241, y 146, 1199 × 1 · fond `border`
        - **frame F1** (bloc) · x 253, y 166, 126 × 81 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 263, y 176, 106 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 263, y 176, 14 × 14
            - « 4/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 331, y 176, 20 × 14
            - icône `circleCheck` 12 px, `green` — x 357, y 177, 12 × 12
          - « Se connecter avec Microsoft » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 263, y 196, 106 × 30
          - **segs** (bloc) · x 263, y 232, 105 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 263, y 232, 24 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 290, y 232, 24 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 317, y 232, 24 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 344, y 232, 24 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
        - **frame F3** (bloc) · x 405, y 166, 262 × 66 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 415, y 176, 242 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 176, 14 × 14
            - « 4/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 619, y 176, 20 × 14
            - icône `circleCheck` 12 px, `green` — x 645, y 177, 12 × 12
          - « Réaffecter un ISO » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 415, y 196, 242 × 15
          - **segs** (bloc) · x 415, y 217, 241 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 415, y 217, 58 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 476, y 217, 58 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 537, y 217, 58 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 598, y 217, 58 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
        - **frame F6** (bloc) · x 695, y 166, 232 × 206 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 705, y 176, 212 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 705, y 176, 14 × 14
            - « 0/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 897, y 176, 20 × 14
          - « Importer les ISO depuis Excel » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 705, y 196, 212 × 15
          - **segs** (bloc) · x 705, y 217, 209 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 705, y 217, 50 × 5 · fond `red` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 758, y 217, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 811, y 217, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 864, y 217, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 705, y 228, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 713, y 236,5, 7 × 7 · fond `red` · dimension fixe/fixe
            - « Lecture du fichier Excel » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 233, 124 × 14
          - **box** (bloc) · x 705, y 258, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 266,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Contrôle des repères » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 263, 110 × 14
          - **box** (bloc) · x 705, y 288, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 296,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Écran d'import » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 293, 76 × 14
          - **box** (bloc) · x 705, y 318, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 326,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 323, 63 × 14
          - **box** (bloc) · x 705, y 348, 99 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start
            - icône `lock` 12 px, `red` — x 705, y 349, 12 × 12
            - « bloquée par Q14 » — Geist 11 / 400, interligne 1,2, couleur `red` — x 722, y 348, 82 × 14
        - **frame F7** (bloc) · x 955, y 166, 222 × 216 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 965, y 176, 202 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F7 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 965, y 176, 14 × 14
            - « 0/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1147, y 176, 20 × 14
          - « Rapport de chantier journalier » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 965, y 196, 202 × 15
          - **segs** (bloc) · x 965, y 217, 202 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 965, y 217, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1006, y 217, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1047, y 217, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1088, y 217, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1129, y 217, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 965, y 228, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 236,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Modèle du rapport » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 233, 97 × 14
          - **box** (bloc) · x 965, y 258, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 266,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Génération PDF » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 263, 83 × 14
          - **box** (bloc) · x 965, y 288, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 296,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Photos dans le rapport » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 293, 119 × 14
          - **box** (bloc) · x 965, y 318, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 326,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Envoi le soir » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 323, 64 × 14
          - **box** (bloc) · x 965, y 348, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 356,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 353, 63 × 14
        - **frame F9** (bloc) · x 1205, y 166, 182 × 156 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 1215, y 176, 162 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1215, y 176, 14 × 14
            - « 0/3 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1357, y 176, 20 × 14
          - « Exporter le dossier client » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1215, y 196, 162 × 15
          - **segs** (bloc) · x 1215, y 217, 162 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 1215, y 217, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1270, y 217, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1325, y 217, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 1215, y 228, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 236,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Format du dossier » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 233, 95 × 14
          - **box** (bloc) · x 1215, y 258, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 266,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Archive ZIP » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 263, 59 × 14
          - **box** (bloc) · x 1215, y 288, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 296,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 293, 63 × 14
        - **frame F4** (bloc) · x 405, y 262, 262 × 216 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 415, y 272, 242 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F4 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 272, 14 × 14
            - « 3/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 637, y 272, 20 × 14
          - « Saisir un tronçon hors ligne » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 415, y 292, 242 × 15
          - **segs** (bloc) · x 415, y 313, 242 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 415, y 313, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 464, y 313, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 513, y 313, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 562, y 313, 46 × 5 · fond `purple` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 611, y 313, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 415, y 324, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 332,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Schéma local des tronçons » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 329, 143 × 14
            - icône `merge` 11 px, `green` — x 638, y 330,5, 11 × 11
          - **box** (bloc) · x 415, y 354, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 362,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Formulaire de saisie » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 359, 105 × 14
            - icône `merge` 11 px, `green` — x 638, y 360,5, 11 × 11
          - **box** (bloc) · x 415, y 384, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 392,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Synchro au retour du réseau » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 389, 148 × 14
            - icône `merge` 11 px, `green` — x 638, y 390,5, 11 × 11
          - **box** (bloc) · x 415, y 414, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `brandLine` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 422,5, 7 × 7 · fond `purple` · dimension fixe/fixe
            - « Conflits de saisie » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 419, 90 × 14
            - **dot** (pastille) · x 626, y 423, 6 × 6 · fond `brand` · dimension fixe/fixe
            - icône `pr` 11 px, `amber` — x 638, y 420,5, 11 × 11
          - **box** (bloc) · x 415, y 444, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 452,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 449, 63 × 14
        - **frame F2** (bloc) · x 253, y 277, 126 × 81 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 263, y 287, 106 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 263, y 287, 14 × 14
            - « 5/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 331, y 287, 20 × 14
            - icône `circleCheck` 12 px, `green` — x 357, y 288, 12 × 12
          - « Voir ses ISO affectés » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 263, y 307, 106 × 30
          - **segs** (bloc) · x 263, y 343, 102 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 263, y 343, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 284, y 343, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 305, y 343, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 326, y 343, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 347, y 343, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
        - **frame F8** (bloc) · x 695, y 402, 232 × 186 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 705, y 412, 212 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F8 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 705, y 412, 14 × 14
            - « 0/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 897, y 412, 20 × 14
          - « Valider les soudures par lot » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 705, y 432, 212 × 15
          - **segs** (bloc) · x 705, y 453, 209 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 705, y 453, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 758, y 453, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 811, y 453, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 864, y 453, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 705, y 464, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 472,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Statuts de soudure » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 469, 100 × 14
          - **box** (bloc) · x 705, y 494, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 502,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Sélection multiple » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 499, 95 × 14
          - **box** (bloc) · x 705, y 524, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 532,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Validation par lot » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 529, 89 × 14
          - **box** (bloc) · x 705, y 554, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 562,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 559, 63 × 14
        - **frame F5** (bloc) · x 405, y 508, 262 × 236 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `red` dashed · rayon 10
          - **box** (bloc) · x 415, y 518, 242 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F5 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 518, 14 × 14
            - « 1/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 637, y 518, 20 × 14
          - « Envoyer les photos d'un tronçon » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 415, y 538, 242 × 15
          - **segs** (bloc) · x 415, y 559, 242 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 415, y 559, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 464, y 559, 46 × 5 · fond `purple` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 513, y 559, 46 × 5 · fond `blue` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 562, y 559, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 611, y 559, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 415, y 570, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 578,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Stockage des photos sur MinIO » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 575, 165 × 14
            - icône `merge` 11 px, `green` — x 638, y 576,5, 11 × 11
          - **box** (bloc) · x 415, y 600, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 608,5, 7 × 7 · fond `purple` · dimension fixe/fixe
            - « Route d'envoi des photos » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 605, 132 × 14
            - icône `pr` 11 px, `purple` — x 638, y 606,5, 11 × 11
          - **box** (bloc) · x 415, y 630, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `brandLine` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 638,5, 7 × 7 · fond `blue` · dimension fixe/fixe
            - « Écran d'envoi hors ligne » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 635, 124 × 14
            - **dot** (pastille) · x 626, y 639, 6 × 6 · fond `brand` · dimension fixe/fixe
            - icône `branch` 11 px, `blue` — x 638, y 636,5, 11 × 11
          - **box** (bloc) · x 415, y 660, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 668,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Tests E2E de l'envoi » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 665, 104 × 14
          - **box** (bloc) · x 415, y 690, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 698,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 695, 63 × 14
          - **box** (bloc) · x 415, y 720, 138 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start
            - icône `clockAlert` 12 px, `red` — x 415, y 721, 12 × 12
            - « en retard · glisse en S43 » — Geist 11 / 400, interligne 1,2, couleur `red` — x 432, y 720, 121 × 14
        - **legend** (bloc) · x 257, y 952, 621 × 30 · flex ligne, espacement 14, marges internes 8 12 8 12, alignement center/start · fond `card` · bordure 1 `border` · rayon 8
          - **box** (bloc) · x 269, y 960, 49 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **ring** (pastille) · x 269, y 963, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
            - « À faire » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 283, y 960, 35 × 14
          - **box** (bloc) · x 332, y 960, 60 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **dot** (pastille) · x 332, y 963, 8 × 8 · fond `blue` · dimension fixe/fixe
            - « En cours » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 346, y 960, 46 × 14
          - **box** (bloc) · x 406, y 960, 65 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **dot** (pastille) · x 406, y 963, 8 × 8 · fond `purple` · dimension fixe/fixe
            - « En review » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 420, y 960, 51 × 14
          - **box** (bloc) · x 485, y 960, 51 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **dot** (pastille) · x 485, y 963, 8 × 8 · fond `red` · dimension fixe/fixe
            - « Bloqué » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 499, y 960, 37 × 14
          - **box** (bloc) · x 550, y 960, 95 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **box** (bloc) · x 550, y 962, 14 × 10 · bordure 1 `mfg` dashed · rayon 3 · dimension fixe/fixe
            - « Fonctionnalité » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 570, y 960, 75 × 14
          - **box** (bloc) · x 659, y 960, 104 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - icône `sprint` 12 px, `mfg` — x 659, y 961, 12 × 12
            - « Colonne = sprint » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 677, y 960, 86 × 14
          - **box** (bloc) · x 777, y 960, 89 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start
            - **dot** (pastille) · x 777, y 963,5, 7 × 7 · fond `brand` · dimension fixe/fixe
            - « Session active » — Geist 11,5 / 400, interligne 1,2, couleur `mfg` — x 790, y 960, 76 × 14

## Phase 27

Boards de la phase 27 (spec §39, §39.6), relevés comme les précédents : `scripts/95-cotes.js` par board, puis `python3 scripts/cotes.py <dossier des JSON> --phase27`, qui remplace cette partie seulement. Rangées à partir de y = 8 000 (pas de 1 500 px). Mêmes tokens, polices et règles qu'en tête ; horloge figée au vendredi 16 octobre (S42), sauf la variante « En retard au 18 oct. » (dimanche, S42 terminé), données `emis-maquettes`. La barre repliée (`exports/proposition-barre-repliee-*.png`, 1 180 × 1 000) et le panneau de l'agent (`exports/proposition-agent-{question,recap}-*.png`, 340 × 1 000) servent de référence visuelle, sans cotes ni comparaison au pixel.

## P1 bis v3 · Vue d'ensemble

Board `P1 bis v3 · Vue d'ensemble` (sombre) et `P1 bis v3 · Vue d'ensemble (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-vue-ensemble-v3-dark.png` et `exports/proposition-vue-ensemble-v3-light.png`, 1440 × 1260 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 1183)
25. « AB » (x 21, y 1222)
26. « Adam Ben Mchichi » (x 48, y 1220,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Vue d'ensemble » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 671, y 16,5)
31. « Nouveau ticket » (x 844, y 16,5)
32. « Agent de projet » (x 982, y 16,5)
33. « Emis » (x 265, y 67)
34. « Suivi de chantier » (x 265, y 100)
35. « · » (x 372, y 100)
36. « galadrimteam/emis-suivi-chantier » (x 404, y 100,5)
37. « Fonctionnalités » (x 303, y 142)
38. « 3 » (x 283, y 162)
39. « livrées sur 9 » (x 307, y 174)
40. « 2 à risque » (x 364, y 195,5)
41. « Sprint en cours » (x 465,2, y 142)
42. « S42 » (x 445,2, y 162)
43. « Terrain ho… » (x 505,2, y 174)
44. « se termine aujourd'hui » (x 445,2, y 195,5)
45. « En cours » (x 627,4, y 142)
46. « 2 » (x 607,4, y 162)
47. « / 2 » (x 631,4, y 174)
48. « limite · bloquée : F6 » (x 620,4, y 195,5)
49. « En review » (x 789,6, y 142)
50. « 3 » (x 769,6, y 162)
51. « PR » (x 793,6, y 174)
52. « #20 · #22 · #23 » (x 769,6, y 195,5)
53. « Questions » (x 951,8, y 142)
54. « 3 » (x 931,8, y 162)
55. « ouvertes » (x 955,8, y 174)
56. « Q14 bloque F6 » (x 944,8, y 195,5)
57. « En ce moment » (x 302, y 261,5)
58. « 2 sessions T3 Code » (x 281, y 281,5)
59. « F5 » (x 454, y 252,5)
60. « EMIS-33 » (x 488, y 252,5)
61. « Écran d'envoi hors ligne » (x 547, y 252)
62. « 7 · Porte qualité » (x 859, y 252,5)
63. « 42 min » (x 1020, y 252,5)
64. « F4 » (x 454, y 289,5)
65. « EMIS-45 » (x 488, y 289,5)
66. « Conflits de saisie » (x 547, y 289)
67. « 9 · Review » (x 859, y 289,5)
68. « 18 min » (x 1023, y 289,5)
69. « Échéances » (x 304, y 349,5)
70. « fonctionnalités par sprint » (x 916, y 350,5)
71. « S42 » (x 525, y 390)
72. « 12 oct. » (x 553, y 390)
73. « S43 » (x 664, y 390)
74. « 19 oct. » (x 692, y 390)
75. « S44 » (x 803, y 390)
76. « 26 oct. » (x 831, y 390)
77. « S45 » (x 942, y 390)
78. « 2 nov. » (x 970, y 390)
79. « F4 » (x 281, y 419)
80. « Saisir un tronçon hors ligne » (x 304, y 419)
81. « F5 » (x 281, y 449)
82. « Envoyer les photos d'un tronçon » (x 304, y 449)
83. « bloquée · Q14 » (x 828, y 480)
84. « F6 » (x 281, y 479)
85. « Importer les ISO depuis Excel » (x 304, y 479)
86. « F8 » (x 281, y 509)
87. « Valider les soudures par lot » (x 304, y 509)
88. « F7 » (x 281, y 539)
89. « Rapport de chantier journalier » (x 304, y 539)
90. « aujourd'hui » (x 616,4, y 544)
91. « étape livrée » (x 299, y 578)
92. « en review » (x 397, y 578)
93. « en cours » (x 484, y 578)
94. « bloquée » (x 565, y 578)
95. « à faire » (x 644, y 578)
96. « glissement prévu » (x 713, y 578)
97. « Sprint S42 · Terrain hors ligne » (x 304, y 630,5)
98. « 12–16 oct. » (x 590, y 631,5)
99. « 2/2 en cours » (x 663, y 631,5)
100. « F3 » (x 281, y 673,5)
101. « Réaffecter un ISO » (x 317, y 673)
102. « livrée » (x 566, y 673,5)
103. « 4/4 » (x 720, y 673,5)
104. « F4 » (x 281, y 712,5)
105. « Saisir un tronçon hors ligne » (x 317, y 712)
106. « à risque » (x 566, y 712,5)
107. « 3/5 » (x 720, y 712,5)
108. « F5 » (x 281, y 751,5)
109. « Envoyer les photos d'un tronçon » (x 317, y 751)
110. « à risque » (x 566, y 751,5)
111. « 1/5 » (x 720, y 751,5)
112. « Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5. » (x 302, y 789)
113. « Prochaine à finir » (x 304, y 841,5)
114. « la plus avancée du sprint » (x 601, y 842,5)
115. « F4 » (x 281, y 875,5)
116. « Saisir un tronçon hors ligne » (x 306, y 874)
117. « 3/5 » (x 720, y 875,5)
118. « EMIS-45 » (x 297, y 902,5)
119. « Conflits de saisie » (x 356, y 902)
120. « changements demandés » (x 466, y 902,5)
121. « EMIS-46 » (x 297, y 924,5)
122. « Démo client » (x 356, y 924)
123. « Étape suivante » (x 293, y 963)
124. « /full-delivery EMIS-45 » (x 387, y 963)
125. « Copier » (x 685, y 963)
126. « Activité » (x 304, y 1032,5)
127. « git » (x 633, y 1033,5)
128. « full-delivery » (x 668, y 1033,5)
129. « 15:04 » (x 281, y 1075,5)
130. « PR #22 ouverte » (x 355, y 1075)
131. « EMIS-32 » (x 643, y 1075,5)
132. « F5 » (x 722, y 1075,5)
133. « 14:51 » (x 281, y 1114,5)
134. « Étape 7 · Porte qualité » (x 355, y 1114)
135. « EMIS-33 » (x 643, y 1114,5)
136. « F5 » (x 722, y 1114,5)
137. « 14:40 » (x 281, y 1153,5)
138. « Suivi mis à jour · lot n° 7 proposé » (x 355, y 1153)
139. « Agent de projet » (x 658, y 1153,5)
140. « 14:36 » (x 281, y 1192,5)
141. « PR #18 fusionnée · F3 livrée » (x 355, y 1192)
142. « EMIS-21 » (x 643, y 1192,5)
143. « F3 » (x 722, y 1192,5)
144. « En review » (x 814, y 630,5)
145. « 3 » (x 894, y 631,5)
146. « #22 » (x 818, y 672)
147. « Route d'envoi des photos » (x 848, y 672)
148. « EMIS-32 » (x 818, y 693)
149. « F5 » (x 897, y 693)
150. « CI verte » (x 836, y 713)
151. « #20 » (x 818, y 749)
152. « Conflits de saisie » (x 848, y 749)
153. « EMIS-45 » (x 818, y 770)
154. « F4 » (x 897, y 770)
155. « changements demandés » (x 836, y 790)
156. « #23 » (x 818, y 826)
157. « Passage à Expo SDK 54 » (x 848, y 826)
158. « EMIS-61 » (x 818, y 846)
159. « CI en cours » (x 835, y 865)
160. « Questions » (x 814, y 917,5)
161. « 3 » (x 898, y 918,5)
162. « Un ISO réaffecté garde-t-il ses photos ? » (x 791, y 959)
163. « F6 » (x 813, y 984)
164. « Q14 · Client · il y a 3 j » (x 840, y 984)
165. « bloquante » (x 965, y 984)
166. « Quota par affaire : 2 Go ou 5 Go ? » (x 791, y 1022)
167. « F5 » (x 813, y 1046)
168. « Q16 · Produit · hier » (x 840, y 1046)
169. « Un rapport par chef de chantier ou par affaire ? » (x 791, y 1083)
170. « F7 » (x 813, y 1125)
171. « Q17 · Client · il y a 2 h » (x 840, y 1125)
172. « Agent de projet » (x 1158, y 13)
173. « Suivi à jour · il y a 4 min » (x 1158, y 32)
174. « Résumé du jour » (x 1118, y 79)
175. « F3 est livrée : 3 fonctionnalités sur 9. » (x 1118, y 102)
176. « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » (x 1118, y 131)
177. « À valider » (x 1118, y 229)
178. « Lot n° 7 » (x 1132, y 264)
179. « 3 actions » (x 1357, y 264,5)
180. « Reporter F5 en S43 » (x 1158, y 302)
181. « 4 étapes restantes, S42 finit aujourd'hui » (x 1158, y 321)
182. « Planifier F9 en S44 » (x 1158, y 359)
183. « seule fonctionnalité à planifier » (x 1158, y 378)
184. « Relancer le client sur Q14 » (x 1158, y 416)
185. « bloque F6, prévue en S43 » (x 1158, y 435)
186. « Valider (3) » (x 1142, y 479)
187. « Refuser » (x 1227, y 479)
188. « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » (x 1139, y 525)
189. « Demander à l'agent de projet… » (x 1130, y 1217)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P1 bis v3 · Vue d'ensemble** (bloc) · x 0, y 0, 1440 × 1260 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1260 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1260 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `fg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 265, 96 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 1176, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 1183,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 1183, 69 × 16
      - **box** (bloc) · x 10, y 1208, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 1216, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 1222, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 1220,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 1221, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1260 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 858 × 1260 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 858 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 164 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 96 × 16
        - **box** (bloc) · x 651, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 651, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 671, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 815, y 11,5, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 825, y 17,5, 13 × 13
          - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 844, y 16,5, 85 × 15
        - **agent-button** (bloc) · x 951, y 11,5, 132 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 6
          - icône `bot` 15 px, `brand` — x 961, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `brandText` — x 982, y 16,5, 91 × 15
      - **line** (bloc) · x 241, y 48, 858 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 858 × 1211 · flex colonne, espacement 14, marges internes 18 24 24 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 810 × 49 · flex ligne, espacement 12, marges internes 0, alignement end/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 67, 370 × 49 · flex colonne, espacement 4, marges internes 0, alignement start/start
            - « Emis » — Geist 24 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 265, y 67, 55 × 29
            - **box** (bloc) · x 265, y 100, 370 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « Suivi de chantier » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 265, y 100, 99 × 16
              - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 372, y 100, 3 × 16
              - icône `github` 13 px, `mfg` — x 383, y 101,5, 13 × 13
              - « galadrimteam/emis-suivi-chantier » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 404, y 100,5, 231 × 15
        - **kpis** (bloc) · x 265, y 130, 810 × 92 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 283, y 142, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `package` 14 px, `mfg` — x 283, y 142,5, 14 × 14
              - « Fonctionnalités » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 303, y 142, 90 × 15
            - **box** (bloc) · x 283, y 162, 96 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 283, y 162, 18 × 28
              - « livrées sur 9 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 307, y 174, 72 × 16
            - **box** (bloc) · x 283, y 195, 125,2 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/fixe
              - **segs** (bloc) · x 283, y 200, 69 × 6 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 283, y 200, 5 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 291, y 200, 5 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 299, y 200, 5 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 307, y 200, 5 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 315, y 200, 5 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 323, y 200, 5 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 331, y 200, 5 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 339, y 200, 5 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 347, y 200, 5 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
              - « 2 à risque » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 364, y 195,5, 54 × 15
          - **vline** (bloc) · x 426,2, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 427,2, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 445,2, y 142, 109 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `sprint` 14 px, `mfg` — x 445,2, y 142,5, 14 × 14
              - « Sprint en cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 465,2, y 142, 89 × 15
            - **box** (bloc) · x 445,2, y 162, 126 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « S42 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 445,2, y 162, 54 × 28
              - « Terrain ho… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 505,2, y 174, 66 × 16
            - **box** (bloc) · x 445,2, y 195, 121 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « se termine aujourd'hui » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 445,2, y 195,5, 121 × 15
          - **vline** (bloc) · x 588,4, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 589,4, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 607,4, y 142, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `target` 14 px, `mfg` — x 607,4, y 142,5, 14 × 14
              - « En cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 627,4, y 142, 51 × 15
            - **box** (bloc) · x 607,4, y 162, 42 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 2 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 607,4, y 162, 18 × 28
              - « / 2 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 631,4, y 174, 18 × 16
            - **box** (bloc) · x 607,4, y 195, 120 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 607,4, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « limite · bloquée : F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 620,4, y 195,5, 107 × 15
          - **vline** (bloc) · x 750,6, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 751,6, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 769,6, y 142, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `pr` 14 px, `mfg` — x 769,6, y 142,5, 14 × 14
              - « En review » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 789,6, y 142, 57 × 15
            - **box** (bloc) · x 769,6, y 162, 41 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 769,6, y 162, 18 × 28
              - « PR » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 793,6, y 174, 17 × 16
            - **box** (bloc) · x 769,6, y 195, 79 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « #20 · #22 · #23 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 769,6, y 195,5, 79 × 15
          - **vline** (bloc) · x 912,8, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 913,8, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 931,8, y 142, 80 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `question` 14 px, `mfg` — x 931,8, y 142,5, 14 × 14
              - « Questions » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 951,8, y 142, 60 × 15
            - **box** (bloc) · x 931,8, y 162, 76 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 931,8, y 162, 18 × 28
              - « ouvertes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 955,8, y 174, 52 × 16
            - **box** (bloc) · x 931,8, y 195, 92 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 931,8, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « Q14 bloque F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 944,8, y 195,5, 79 × 15
        - **live** (bloc) · x 265, y 236, 810 × 86 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 236, 150 × 86 · flex colonne, espacement 4, marges internes 0 16 0 16, alignement start/center · dimension fixe/remplit
            - **box** (bloc) · x 281, y 261,5, 110 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **halo** (bloc) · x 281, y 263, 13 × 13 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6,5 · dimension fixe/fixe
                - **dot** (pastille) · x 284, y 266, 7 × 7 · fond `brand` · dimension fixe/fixe
              - « En ce moment » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 302, y 261,5, 89 × 16
            - « 2 sessions T3 Code » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 281,5, 107 × 15
          - **box** (bloc) · x 415, y 236, 1 × 86 · fond `brandLine` · dimension fixe/remplit
          - **box** (bloc) · x 416, y 236, 659 × 86 · flex colonne, espacement 0, marges internes 6 16 6 16, alignement start/start · dimension remplit/remplit
            - **box** (bloc) · x 432, y 242, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 251,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 251,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 254, 12 × 12
                  - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 252,5, 15 × 15
              - **box** (bloc) · x 488, y 252, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 252,5, 51 × 15
                - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 252, 143 × 16
              - **box** (bloc) · x 767, y 252,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 254, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 254, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 7 · Porte qualité » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 252,5, 88 × 15
              - **box** (bloc) · x 989, y 252,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 42 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1020, y 252,5, 39 × 15
            - **line** (bloc) · x 432, y 278, 627 × 1 · fond `brandLine` · dimension remplit/fixe
            - **box** (bloc) · x 432, y 279, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 288,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 288,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 291, 12 × 12
                  - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 289,5, 15 × 15
              - **box** (bloc) · x 488, y 289, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 289,5, 51 × 15
                - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 289, 105 × 16
              - **box** (bloc) · x 767, y 289,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 291, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 291, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 9 · Review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 289,5, 58 × 15
              - **box** (bloc) · x 989, y 289,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 18 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1023, y 289,5, 36 × 15
        - **card / Échéances** (bloc) · x 265, y 336, 810 × 267 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 265, y 336, 810 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
            - icône `calendar` 15 px, `mfg` — x 281, y 350,5, 15 × 15
            - « Échéances » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 349,5, 74 × 17
            - « fonctionnalités par sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 916, y 350,5, 143 × 15
          - **line** (bloc) · x 265, y 380, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **grid** (bloc) · x 265, y 381, 806 × 186 · dimension fixe/fixe
            - **box** (bloc) · x 515, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 516, y 381, 138 × 186 · fond `muted (50 %)`
            - **box** (bloc) · x 654, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 793, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 932, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 525, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S42 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 525, y 390, 22 × 15
              - « 12 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 553, y 390, 36 × 15
            - **box** (bloc) · x 664, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S43 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 664, y 390, 22 × 15
              - « 19 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 692, y 390, 36 × 15
            - **box** (bloc) · x 803, y 390, 66 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S44 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 803, y 390, 22 × 15
              - « 26 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 831, y 390, 38 × 15
            - **box** (bloc) · x 942, y 390, 60 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S45 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 942, y 390, 22 × 15
              - « 2 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 970, y 390, 32 × 15
            - **today** (bloc) · x 604,4, y 405, 2 × 162 · fond `fg`
            - **box** (bloc) · x 265, y 411, 806 × 1 · fond `soft`
            - **box** (bloc) · x 281, y 419, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 419, 15 × 15
              - « Saisir un tronçon hors ligne » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 419, 156 × 15
            - **box** (bloc) · x 525, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 573,8, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 598,2, y 421, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 622,6, y 421, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 441, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 449, 206 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 449, 15 × 15
              - « Envoyer les photos d'un tronçon » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 449, 183 × 15
            - **box** (bloc) · x 525, y 451, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 451, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 573,8, y 451, 21,4 × 12 · fond `blue` · rayon 2
            - **box** (bloc) · x 598,2, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 622,6, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 471, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start
              - **pill** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `lock` 12 px, `red` — x 811, y 481,5, 12 × 12
                - « bloquée · Q14 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 828, y 480, 75 × 15
            - **box** (bloc) · x 281, y 479, 191 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 479, 15 × 15
              - « Importer les ISO depuis Excel » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 479, 168 × 15
            - **box** (bloc) · x 664, y 481, 27,5 × 12 · fond `red` · rayon 2
            - **box** (bloc) · x 694,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 501, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 509, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F8 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 509, 15 × 15
              - « Valider les soudures par lot » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 509, 156 × 15
            - **box** (bloc) · x 664, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 694,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 531, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 539, 193 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F7 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 539, 15 × 15
              - « Rapport de chantier journalier » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 539, 170 × 15
            - **box** (bloc) · x 803, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 827,4, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 851,8, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 876,2, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 900,6, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 610,4, y 543, 76 × 17 · flex ligne, espacement 0, marges internes 1 6 1 6, alignement center/start · fond `primary` · rayon 4
              - « aujourd'hui » — Geist 12 / 600, interligne 1,2, couleur `pfg` — x 616,4, y 544, 64 × 15
          - **line** (bloc) · x 265, y 567, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 568, 810 × 35 · flex ligne, espacement 16, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
            - **box** (bloc) · x 281, y 578, 82 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 281, y 580,5, 12 × 10 · fond `fg` · rayon 2 · dimension fixe/fixe
              - « étape livrée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 299, y 578, 64 × 15
            - **box** (bloc) · x 379, y 578, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 379, y 580,5, 12 × 10 · fond `purple` · rayon 2 · dimension fixe/fixe
              - « en review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 397, y 578, 53 × 15
            - **box** (bloc) · x 466, y 578, 65 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 466, y 580,5, 12 × 10 · fond `blue` · rayon 2 · dimension fixe/fixe
              - « en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 484, y 578, 47 × 15
            - **box** (bloc) · x 547, y 578, 63 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 547, y 580,5, 12 × 10 · fond `red` · rayon 2 · dimension fixe/fixe
              - « bloquée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 565, y 578, 45 × 15
            - **box** (bloc) · x 626, y 578, 53 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 626, y 580,5, 12 × 10 · fond `border` · rayon 2 · dimension fixe/fixe
              - « à faire » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 644, y 578, 35 × 15
            - **box** (bloc) · x 695, y 578, 112 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 695, y 580,5, 12 × 10 · fond `redSoft` · bordure 1 `red` · rayon 2 · dimension fixe/fixe
              - « glissement prévu » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 713, y 578, 94 × 15
        - **box** (bloc) · x 265, y 617, 810 × 602 · flex ligne, espacement 16, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 617, 494 × 602 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension remplit/auto
            - **card / Sprint S42 · Terrain hors ligne** (bloc) · x 265, y 617, 494 × 197 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 617, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `sprint` 15 px, `mfg` — x 281, y 631,5, 15 × 15
                - « Sprint S42 · Terrain hors ligne » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 630,5, 197 × 17
                - « 12–16 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 590, y 631,5, 57 × 15
                - **pill** (bloc) · x 655, y 629,5, 88 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                  - « 2/2 en cours » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 663, y 631,5, 72 × 15
              - **line** (bloc) · x 265, y 661, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 662, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 673,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 673,5, 15 × 15
                - **box** (bloc) · x 317, y 673, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 317, y 673, 108 × 16
                - **box** (bloc) · x 541, y 671,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 671,5, 64 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `greenSoft` · rayon 10
                    - icône `circleCheck` 12 px, `green` — x 549, y 675, 12 × 12
                    - « livrée » — Geist 12 / 500, interligne 1,2, couleur `green` — x 566, y 673,5, 31 × 15
                - **box** (bloc) · x 637, y 677, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 677, 49 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 673,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 4/4 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 720, y 673,5, 23 × 15
              - **line** (bloc) · x 265, y 700, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 701, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 712,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 712,5, 15 × 15
                - **box** (bloc) · x 317, y 712, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 712, 167 × 16
                - **box** (bloc) · x 541, y 710,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 710,5, 78 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                    - icône `triangleAlert` 12 px, `amber` — x 549, y 714, 12 × 12
                    - « à risque » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 566, y 712,5, 45 × 15
                - **box** (bloc) · x 637, y 716, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 716, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 716, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 716, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 712,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 712,5, 23 × 15
              - **line** (bloc) · x 265, y 739, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 740, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 751,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 751,5, 15 × 15
                - **box** (bloc) · x 317, y 751, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 751, 195 × 16
                - **box** (bloc) · x 541, y 749,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 749,5, 78 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                    - icône `triangleAlert` 12 px, `amber` — x 549, y 753, 12 × 12
                    - « à risque » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 566, y 751,5, 45 × 15
                - **box** (bloc) · x 637, y 755, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 755, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 755, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 755, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 755, 10 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 751,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 1/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 751,5, 23 × 15
              - **line** (bloc) · x 265, y 778, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 779, 494 × 35 · flex ligne, espacement 8, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
                - icône `target` 13 px, `mfg` — x 281, y 790, 13 × 13
                - « Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 302, y 789, 441 × 15
            - **card / Prochaine à finir** (bloc) · x 265, y 828, 494 × 177 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 828, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `flag` 15 px, `mfg` — x 281, y 842,5, 15 × 15
                - « Prochaine à finir » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 841,5, 110 × 17
                - « la plus avancée du sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 601, y 842,5, 142 × 15
              - **box** (bloc) · x 265, y 872, 494 × 133 · flex colonne, espacement 10, marges internes 2 16 14 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 281, y 874, 462 × 18 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 875,5, 15 × 15
                  - « Saisir un tronçon hors ligne » — Geist 15 / 600, interligne 1,2, couleur `fg` — x 306, y 874, 197 × 18
                  - **segs** (bloc) · x 588, y 879, 122 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 588, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 613, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 638, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 879, 22 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 688, y 879, 22 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 875,5, 23 × 15
                - **box** (bloc) · x 281, y 902, 462 × 38 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 281, y 902, 320 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **dot** (pastille) · x 281, y 906, 8 × 8 · fond `purple` · dimension fixe/fixe
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 902,5, 51 × 15
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 902, 102 × 16
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 466, y 902,5, 135 × 15
                  - **box** (bloc) · x 281, y 924, 147 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 281, y 928, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                    - « EMIS-46 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 924,5, 51 × 15
                    - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 924, 72 × 16
                - **box** (bloc) · x 281, y 950, 462 × 41 · flex ligne, espacement 10, marges internes 8 10 8 12, alignement center/start · fond `muted` · rayon 8 · dimension remplit/auto
                  - « Étape suivante » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 293, y 963, 84 × 15
                  - « /full-delivery EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 387, y 963, 165 × 15
                  - **Button / outline** (bloc) · x 656, y 958, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                    - icône `copy` 13 px, `fg` — x 666, y 964, 13 × 13
                    - « Copier » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 685, y 963, 38 × 15
            - **card / Activité** (bloc) · x 265, y 1019, 494 × 200 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 1019, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `activity` 15 px, `mfg` — x 281, y 1033,5, 15 × 15
                - « Activité » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 1032,5, 53 × 17
                - **chip** (bloc) · x 627, y 1031,5, 27 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « git » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 633, y 1033,5, 15 × 15
                - **chip** (bloc) · x 662, y 1031,5, 81 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « full-delivery » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 668, y 1033,5, 69 × 15
              - **line** (bloc) · x 265, y 1063, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1064, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1075,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 15:04 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1075,5, 36 × 15
                - icône `pr` 14 px, `purple` — x 331, y 1076, 14 × 14
                - **box** (bloc) · x 355, y 1075, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #22 ouverte » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1075, 91 × 16
                - **box** (bloc) · x 633, y 1074,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1075,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1074,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1077, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1075,5, 15 × 15
              - **line** (bloc) · x 265, y 1102, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1103, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1114,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:51 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1114,5, 36 × 15
                - icône `flag` 14 px, `mfg` — x 331, y 1115, 14 × 14
                - **box** (bloc) · x 355, y 1114, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Étape 7 · Porte qualité » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1114, 130 × 16
                - **box** (bloc) · x 633, y 1113,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1114,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1113,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1116, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1114,5, 15 × 15
              - **line** (bloc) · x 265, y 1141, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1142, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1153,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:40 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1153,5, 36 × 15
                - icône `bot` 14 px, `brand` — x 331, y 1154, 14 × 14
                - **box** (bloc) · x 355, y 1153, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Suivi mis à jour · lot n° 7 proposé » — Geist 13 / 400, interligne 1,2, couleur `brandText` — x 355, y 1153, 192 × 16
                - **box** (bloc) · x 633, y 1153,5, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « Agent de projet » — Geist 12 / 400, interligne 1,2, couleur `brandText` — x 658, y 1153,5, 85 × 15
              - **line** (bloc) · x 265, y 1180, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1181, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1192,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:36 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1192,5, 36 × 15
                - icône `merge` 14 px, `green` — x 331, y 1193, 14 × 14
                - **box** (bloc) · x 355, y 1192, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #18 fusionnée · F3 livrée » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1192, 161 × 16
                - **box** (bloc) · x 633, y 1191,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-21 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1192,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1191,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1194, 12 × 12
                    - « F3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1192,5, 15 × 15
          - **box** (bloc) · x 775, y 617, 300 × 534 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension fixe/auto
            - **card / En review** (bloc) · x 775, y 617, 300 × 273 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 617, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `pr` 15 px, `mfg` — x 791, y 631,5, 15 × 15
                - « En review » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 630,5, 65 × 17
                - **box** (bloc) · x 887, y 631,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 894, y 631,5, 8 × 15
              - **line** (bloc) · x 775, y 661, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 662, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 672, 15 × 15
                - **box** (bloc) · x 818, y 672, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 672, 179 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #22 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 672, 24 × 16
                    - « Route d'envoi des photos » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 672, 149 × 16
                  - **box** (bloc) · x 818, y 692, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 693, 51 × 15
                    - **fchip** (bloc) · x 875, y 692, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 694,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 693, 15 × 15
                  - **box** (bloc) · x 818, y 713, 61 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleCheck` 12 px, `green` — x 818, y 714,5, 12 × 12
                    - « CI verte » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 836, y 713, 43 × 15
              - **line** (bloc) · x 775, y 738, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 739, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `amber` — x 791, y 749, 15 × 15
                - **box** (bloc) · x 818, y 749, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 749, 132 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 749, 24 × 16
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 749, 102 × 16
                  - **box** (bloc) · x 818, y 769, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 770, 51 × 15
                    - **fchip** (bloc) · x 875, y 769, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 771,5, 12 × 12
                      - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 770, 15 × 15
                  - **box** (bloc) · x 818, y 790, 153 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleX` 12 px, `red` — x 818, y 791,5, 12 × 12
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 836, y 790, 135 × 15
              - **line** (bloc) · x 775, y 815, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 816, 300 × 74 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 826, 15 × 15
                - **box** (bloc) · x 818, y 826, 241 × 54 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 826, 173 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #23 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 826, 24 × 16
                    - « Passage à Expo SDK 54 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 826, 143 × 16
                  - **box** (bloc) · x 818, y 846, 51 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-61 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 846, 51 × 15
                  - **box** (bloc) · x 818, y 865, 79 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 818, y 867, 11 × 11 · bordure 2 `amber` · dimension fixe/fixe
                    - « CI en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 835, y 865, 62 × 15
            - **card / Questions** (bloc) · x 775, y 904, 300 × 247 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 904, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `question` 15 px, `mfg` — x 791, y 918,5, 15 × 15
                - « Questions » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 917,5, 69 × 17
                - **box** (bloc) · x 891, y 918,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 898, y 918,5, 8 × 15
              - **line** (bloc) · x 775, y 948, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 949, 300 × 62 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 959, 268 × 42 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un ISO réaffecté garde-t-il ses photos ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 959, 268 × 18
                  - **box** (bloc) · x 791, y 982, 239 × 19 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 983, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 985,5, 12 × 12
                      - « F6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 984, 15 × 15
                    - « Q14 · Client · il y a 3 j » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 984, 111 × 15
                    - **pill** (bloc) · x 957, y 982, 73 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                      - « bloquante » — Geist 12 / 500, interligne 1,2, couleur `red` — x 965, y 984, 57 × 15
              - **line** (bloc) · x 775, y 1011, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1012, 300 × 60 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1022, 268 × 40 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1022, 268 × 18
                  - **box** (bloc) · x 791, y 1045, 147 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1045, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1047,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1046, 15 × 15
                    - « Q16 · Produit · hier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1046, 98 × 15
              - **line** (bloc) · x 775, y 1072, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1073, 300 × 78 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1083, 268 × 58 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un rapport par chef de chantier ou par affaire ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1083, 268 × 36
                  - **box** (bloc) · x 791, y 1124, 163 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1124, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1126,5, 12 × 12
                      - « F7 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1125, 15 × 15
                    - « Q17 · Client · il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1125, 114 × 15
    - **vline** (bloc) · x 1099, y 0, 1 × 1260 · fond `soft` · dimension fixe/remplit
    - **agent-panel** (bloc) · x 1100, y 0, 340 × 1260 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 1100, y 0, 340 × 60 · flex ligne, espacement 10, marges internes 0 18 0 18, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 1118, y 15, 30 × 30 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandSoft` · bordure 1 `brandLine` · rayon 15 · dimension fixe/fixe
          - icône `bot` 17 px, `brand` — x 1124,5, y 21,5, 17 × 17
        - **box** (bloc) · x 1158, y 13, 128 × 34 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - « Agent de projet » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 1158, y 13, 104 × 17
          - « Suivi à jour · il y a 4 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 32, 128 × 15
        - icône `more` 16 px, `mfg` — x 1380, y 22, 16 × 16
        - icône `x` 16 px, `mfg` — x 1406, y 22, 16 × 16
      - **line** (bloc) · x 1100, y 60, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 61, 340 × 149 · flex colonne, espacement 8, marges internes 18, alignement start/start · dimension remplit/auto
        - « Résumé du jour » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 79, 114 × 15
        - « F3 est livrée : 3 fonctionnalités sur 9. » — Geist 14 / 500, interligne 1,45, couleur `fg` — x 1118, y 102, 304 × 21
        - « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » — Geist 13 / 400, interligne 1,55, couleur `mfg` — x 1118, y 131, 304 × 61
      - **line** (bloc) · x 1100, y 210, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 211, 340 × 368 · flex colonne, espacement 10, marges internes 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 229, 304 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « À valider » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 229, 66 × 15
        - **box** (bloc) · x 1118, y 254, 304 × 257 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 1118, y 254, 304 × 36 · flex ligne, espacement 8, marges internes 10 14 10 14, alignement center/start · fond `brandSoft` · dimension remplit/auto
            - « Lot n° 7 » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 1132, y 264, 47 × 16
            - « 3 actions » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1357, y 264,5, 51 × 15
          - **line** (bloc) · x 1118, y 290, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 291, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 302, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 304,5, 11 × 11
            - **box** (bloc) · x 1158, y 302, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Reporter F5 en S43 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 302, 250 × 16
              - « 4 étapes restantes, S42 finit aujourd'hui » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 321, 250 × 15
          - **line** (bloc) · x 1118, y 347, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 348, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 359, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 361,5, 11 × 11
            - **box** (bloc) · x 1158, y 359, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Planifier F9 en S44 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 359, 250 × 16
              - « seule fonctionnalité à planifier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 378, 250 × 15
          - **line** (bloc) · x 1118, y 404, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 405, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 416, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 418,5, 11 × 11
            - **box** (bloc) · x 1158, y 416, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Relancer le client sur Q14 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 416, 250 × 16
              - « bloque F6, prévue en S43 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 435, 250 × 15
          - **line** (bloc) · x 1118, y 461, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 462, 304 × 49 · flex ligne, espacement 8, marges internes 12 14 12 14, alignement center/start · dimension remplit/auto
            - **Button / brand** (bloc) · x 1132, y 474, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `brandBtn` · rayon 6
              - « Valider (3) » — Geist 12 / 500, interligne 1,2, couleur `#FFFFFF` — x 1142, y 479, 57 × 15
            - **Button / outline** (bloc) · x 1217, y 474, 65 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
              - « Refuser » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1227, y 479, 45 × 15
        - **box** (bloc) · x 1118, y 521, 304 × 40 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement start/start · dimension remplit/auto
          - icône `refresh` 13 px, `mfg` — x 1118, y 525, 13 × 13
          - « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » — Geist 12 / 400, interligne 1,5, couleur `mfg` — x 1139, y 525, 283 × 36
      - **line** (bloc) · x 1100, y 1189, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 1190, 340 × 70 · flex colonne, espacement 0, marges internes 14 18 14 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 1204, 304 × 42 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 8 · dimension remplit/fixe
          - « Demander à l'agent de projet… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 1130, y 1217, 179 × 16
          - icône `send` 15 px, `mfg` — x 1395, y 1217,5, 15 × 15

## P1 bis v3 · En retard au 18 oct.

Board `P1 bis v3 · En retard au 18 oct.` (sombre) et `P1 bis v3 · En retard au 18 oct. (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-vue-ensemble-v3-retard-dark.png` et `exports/proposition-vue-ensemble-v3-retard-light.png`, 1440 × 1360 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 1283)
25. « AB » (x 21, y 1322)
26. « Adam Ben Mchichi » (x 48, y 1320,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Vue d'ensemble » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 671, y 16,5)
31. « Nouveau ticket » (x 844, y 16,5)
32. « Agent de projet » (x 982, y 16,5)
33. « Emis » (x 265, y 67)
34. « Suivi de chantier » (x 265, y 100)
35. « · » (x 372, y 100)
36. « galadrimteam/emis-suivi-chantier » (x 404, y 100,5)
37. « Fonctionnalités » (x 303, y 142)
38. « 3 » (x 283, y 162)
39. « livrées sur 9 » (x 307, y 174)
40. « 1 en retard » (x 301, y 195,5)
41. « Sprint en cours » (x 465,2, y 142)
42. « S42 » (x 445,2, y 162)
43. « Terrain ho… » (x 505,2, y 174)
44. « terminé le 16 oct. · reste 2 » (x 445,2, y 195,5)
45. « En cours » (x 627,4, y 142)
46. « 2 » (x 607,4, y 162)
47. « / 2 » (x 631,4, y 174)
48. « limite · bloquée : F6 » (x 620,4, y 195,5)
49. « En review » (x 789,6, y 142)
50. « 3 » (x 769,6, y 162)
51. « PR » (x 793,6, y 174)
52. « #20 · #22 · #23 » (x 769,6, y 195,5)
53. « Questions » (x 951,8, y 142)
54. « 3 » (x 931,8, y 162)
55. « ouvertes » (x 955,8, y 174)
56. « Q14 bloque F6 » (x 944,8, y 195,5)
57. « En ce moment » (x 302, y 261,5)
58. « 2 sessions T3 Code » (x 281, y 281,5)
59. « F5 » (x 454, y 252,5)
60. « EMIS-33 » (x 488, y 252,5)
61. « Écran d'envoi hors ligne » (x 547, y 252)
62. « 7 · Porte qualité » (x 859, y 252,5)
63. « 42 min » (x 1020, y 252,5)
64. « F4 » (x 454, y 289,5)
65. « EMIS-45 » (x 488, y 289,5)
66. « Conflits de saisie » (x 547, y 289)
67. « 9 · Review » (x 859, y 289,5)
68. « 18 min » (x 1023, y 289,5)
69. « Échéances » (x 304, y 349,5)
70. « fonctionnalités par sprint » (x 916, y 350,5)
71. « S42 » (x 525, y 390)
72. « 12 oct. » (x 553, y 390)
73. « S43 » (x 664, y 390)
74. « 19 oct. » (x 692, y 390)
75. « S44 » (x 803, y 390)
76. « 26 oct. » (x 831, y 390)
77. « S45 » (x 942, y 390)
78. « 2 nov. » (x 970, y 390)
79. « F4 » (x 281, y 419)
80. « Saisir un tronçon hors ligne » (x 304, y 419)
81. « F5 » (x 281, y 449)
82. « Envoyer les photos d'un tronçon » (x 304, y 449)
83. « glisse en S43 » (x 783,6, y 449)
84. « bloquée · Q14 » (x 828, y 480)
85. « F6 » (x 281, y 479)
86. « Importer les ISO depuis Excel » (x 304, y 479)
87. « F8 » (x 281, y 509)
88. « Valider les soudures par lot » (x 304, y 509)
89. « F7 » (x 281, y 539)
90. « Rapport de chantier journalier » (x 304, y 539)
91. « aujourd'hui » (x 656,1, y 544)
92. « étape livrée » (x 299, y 578)
93. « en review » (x 397, y 578)
94. « en cours » (x 484, y 578)
95. « bloquée » (x 565, y 578)
96. « à faire » (x 644, y 578)
97. « glissement prévu » (x 713, y 578)
98. « En retard » (x 304, y 630,5)
99. « 1 » (x 381, y 631,5)
100. « sprint terminé, étapes obligatoires restantes » (x 807, y 631,5)
101. « F5 » (x 281, y 673,5)
102. « Envoyer les photos d'un tronçon » (x 317, y 673)
103. « S42 » (x 655, y 673,5)
104. « · terminé le 16 oct. » (x 683, y 673,5)
105. « reste 4 étapes » (x 832, y 673,5)
106. « 1/5 » (x 1036, y 673,5)
107. « Sprint S42 · Terrain hors ligne » (x 304, y 727,5)
108. « terminé le 16 oct. · reste 2 » (x 517, y 728,5)
109. « 2/2 en cours » (x 679, y 728,5)
110. « F3 » (x 281, y 770,5)
111. « Réaffecter un ISO » (x 317, y 770)
112. « livrée » (x 566, y 770,5)
113. « 4/4 » (x 720, y 770,5)
114. « F4 » (x 281, y 809,5)
115. « Saisir un tronçon hors ligne » (x 317, y 809)
116. « en cours » (x 549, y 809,5)
117. « 3/5 » (x 720, y 809,5)
118. « F5 » (x 281, y 848,5)
119. « Envoyer les photos d'un tronçon » (x 317, y 848)
120. « en retard » (x 566, y 848,5)
121. « 1/5 » (x 720, y 848,5)
122. « Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5. » (x 302, y 886)
123. « Prochaine à finir » (x 304, y 938,5)
124. « la plus avancée du sprint » (x 601, y 939,5)
125. « F4 » (x 281, y 972,5)
126. « Saisir un tronçon hors ligne » (x 306, y 971)
127. « 3/5 » (x 720, y 972,5)
128. « EMIS-45 » (x 297, y 999,5)
129. « Conflits de saisie » (x 356, y 999)
130. « changements demandés » (x 466, y 999,5)
131. « EMIS-46 » (x 297, y 1021,5)
132. « Démo client » (x 356, y 1021)
133. « Étape suivante » (x 293, y 1060)
134. « /full-delivery EMIS-45 » (x 387, y 1060)
135. « Copier » (x 685, y 1060)
136. « Activité » (x 304, y 1129,5)
137. « git » (x 633, y 1130,5)
138. « full-delivery » (x 668, y 1130,5)
139. « 15:04 » (x 281, y 1172,5)
140. « PR #22 ouverte » (x 355, y 1172)
141. « EMIS-32 » (x 643, y 1172,5)
142. « F5 » (x 722, y 1172,5)
143. « 14:51 » (x 281, y 1211,5)
144. « Étape 7 · Porte qualité » (x 355, y 1211)
145. « EMIS-33 » (x 643, y 1211,5)
146. « F5 » (x 722, y 1211,5)
147. « 14:40 » (x 281, y 1250,5)
148. « Suivi mis à jour · lot n° 7 proposé » (x 355, y 1250)
149. « Agent de projet » (x 658, y 1250,5)
150. « 14:36 » (x 281, y 1289,5)
151. « PR #18 fusionnée · F3 livrée » (x 355, y 1289)
152. « EMIS-21 » (x 643, y 1289,5)
153. « F3 » (x 722, y 1289,5)
154. « En review » (x 814, y 727,5)
155. « 3 » (x 894, y 728,5)
156. « #22 » (x 818, y 769)
157. « Route d'envoi des photos » (x 848, y 769)
158. « EMIS-32 » (x 818, y 790)
159. « F5 » (x 897, y 790)
160. « CI verte » (x 836, y 810)
161. « #20 » (x 818, y 846)
162. « Conflits de saisie » (x 848, y 846)
163. « EMIS-45 » (x 818, y 867)
164. « F4 » (x 897, y 867)
165. « changements demandés » (x 836, y 887)
166. « #23 » (x 818, y 923)
167. « Passage à Expo SDK 54 » (x 848, y 923)
168. « EMIS-61 » (x 818, y 943)
169. « CI en cours » (x 835, y 962)
170. « Questions » (x 814, y 1014,5)
171. « 3 » (x 898, y 1015,5)
172. « Un ISO réaffecté garde-t-il ses photos ? » (x 791, y 1056)
173. « F6 » (x 813, y 1081)
174. « Q14 · Client · il y a 3 j » (x 840, y 1081)
175. « bloquante » (x 965, y 1081)
176. « Quota par affaire : 2 Go ou 5 Go ? » (x 791, y 1119)
177. « F5 » (x 813, y 1143)
178. « Q16 · Produit · hier » (x 840, y 1143)
179. « Un rapport par chef de chantier ou par affaire ? » (x 791, y 1180)
180. « F7 » (x 813, y 1222)
181. « Q17 · Client · il y a 2 h » (x 840, y 1222)
182. « Agent de projet » (x 1158, y 13)
183. « Suivi à jour · il y a 4 min » (x 1158, y 32)
184. « Résumé du jour » (x 1118, y 79)
185. « F3 est livrée : 3 fonctionnalités sur 9. » (x 1118, y 102)
186. « S42 est terminé depuis vendredi et F5 n'y a pas tenu : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » (x 1118, y 131)
187. « À valider » (x 1118, y 229)
188. « Lot n° 7 » (x 1132, y 264)
189. « 3 actions » (x 1357, y 264,5)
190. « Reporter F5 en S43 » (x 1158, y 302)
191. « 4 étapes restantes, S42 terminé le 16 oct. » (x 1158, y 321)
192. « Planifier F9 en S44 » (x 1158, y 359)
193. « seule fonctionnalité à planifier » (x 1158, y 378)
194. « Relancer le client sur Q14 » (x 1158, y 416)
195. « bloque F6, prévue en S43 » (x 1158, y 435)
196. « Valider (3) » (x 1142, y 479)
197. « Refuser » (x 1227, y 479)
198. « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » (x 1139, y 525)
199. « Demander à l'agent de projet… » (x 1130, y 1317)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P1 bis v3 · En retard au 18 oct.** (bloc) · x 0, y 0, 1440 × 1360 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1360 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1360 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `fg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 265, 96 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 1276, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 1283,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 1283, 69 × 16
      - **box** (bloc) · x 10, y 1308, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 1316, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 1322, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 1320,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 1321, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1360 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 858 × 1360 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 858 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 164 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 96 × 16
        - **box** (bloc) · x 651, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 651, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 671, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 815, y 11,5, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 825, y 17,5, 13 × 13
          - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 844, y 16,5, 85 × 15
        - **agent-button** (bloc) · x 951, y 11,5, 132 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 6
          - icône `bot` 15 px, `brand` — x 961, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `brandText` — x 982, y 16,5, 91 × 15
      - **line** (bloc) · x 241, y 48, 858 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 858 × 1311 · flex colonne, espacement 14, marges internes 18 24 24 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 810 × 49 · flex ligne, espacement 12, marges internes 0, alignement end/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 67, 370 × 49 · flex colonne, espacement 4, marges internes 0, alignement start/start
            - « Emis » — Geist 24 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 265, y 67, 55 × 29
            - **box** (bloc) · x 265, y 100, 370 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « Suivi de chantier » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 265, y 100, 99 × 16
              - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 372, y 100, 3 × 16
              - icône `github` 13 px, `mfg` — x 383, y 101,5, 13 × 13
              - « galadrimteam/emis-suivi-chantier » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 404, y 100,5, 231 × 15
        - **kpis** (bloc) · x 265, y 130, 810 × 92 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 283, y 142, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `package` 14 px, `mfg` — x 283, y 142,5, 14 × 14
              - « Fonctionnalités » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 303, y 142, 90 × 15
            - **box** (bloc) · x 283, y 162, 96 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 283, y 162, 18 × 28
              - « livrées sur 9 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 307, y 174, 72 × 16
            - **box** (bloc) · x 283, y 195, 77 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - icône `clockAlert` 12 px, `red` — x 283, y 197, 12 × 12
              - « 1 en retard » — Geist 12 / 500, interligne 1,2, couleur `red` — x 301, y 195,5, 59 × 15
          - **vline** (bloc) · x 426,2, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 427,2, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 445,2, y 142, 109 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `sprint` 14 px, `mfg` — x 445,2, y 142,5, 14 × 14
              - « Sprint en cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 465,2, y 142, 89 × 15
            - **box** (bloc) · x 445,2, y 162, 126 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « S42 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 445,2, y 162, 54 × 28
              - « Terrain ho… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 505,2, y 174, 66 × 16
            - **box** (bloc) · x 445,2, y 195, 140 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « terminé le 16 oct. · reste 2 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 445,2, y 195,5, 140 × 15
          - **vline** (bloc) · x 588,4, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 589,4, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 607,4, y 142, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `target` 14 px, `mfg` — x 607,4, y 142,5, 14 × 14
              - « En cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 627,4, y 142, 51 × 15
            - **box** (bloc) · x 607,4, y 162, 42 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 2 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 607,4, y 162, 18 × 28
              - « / 2 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 631,4, y 174, 18 × 16
            - **box** (bloc) · x 607,4, y 195, 120 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 607,4, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « limite · bloquée : F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 620,4, y 195,5, 107 × 15
          - **vline** (bloc) · x 750,6, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 751,6, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 769,6, y 142, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `pr` 14 px, `mfg` — x 769,6, y 142,5, 14 × 14
              - « En review » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 789,6, y 142, 57 × 15
            - **box** (bloc) · x 769,6, y 162, 41 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 769,6, y 162, 18 × 28
              - « PR » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 793,6, y 174, 17 × 16
            - **box** (bloc) · x 769,6, y 195, 79 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « #20 · #22 · #23 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 769,6, y 195,5, 79 × 15
          - **vline** (bloc) · x 912,8, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 913,8, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 931,8, y 142, 80 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `question` 14 px, `mfg` — x 931,8, y 142,5, 14 × 14
              - « Questions » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 951,8, y 142, 60 × 15
            - **box** (bloc) · x 931,8, y 162, 76 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 931,8, y 162, 18 × 28
              - « ouvertes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 955,8, y 174, 52 × 16
            - **box** (bloc) · x 931,8, y 195, 92 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 931,8, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « Q14 bloque F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 944,8, y 195,5, 79 × 15
        - **live** (bloc) · x 265, y 236, 810 × 86 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 236, 150 × 86 · flex colonne, espacement 4, marges internes 0 16 0 16, alignement start/center · dimension fixe/remplit
            - **box** (bloc) · x 281, y 261,5, 110 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **halo** (bloc) · x 281, y 263, 13 × 13 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6,5 · dimension fixe/fixe
                - **dot** (pastille) · x 284, y 266, 7 × 7 · fond `brand` · dimension fixe/fixe
              - « En ce moment » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 302, y 261,5, 89 × 16
            - « 2 sessions T3 Code » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 281,5, 107 × 15
          - **box** (bloc) · x 415, y 236, 1 × 86 · fond `brandLine` · dimension fixe/remplit
          - **box** (bloc) · x 416, y 236, 659 × 86 · flex colonne, espacement 0, marges internes 6 16 6 16, alignement start/start · dimension remplit/remplit
            - **box** (bloc) · x 432, y 242, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 251,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 251,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 254, 12 × 12
                  - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 252,5, 15 × 15
              - **box** (bloc) · x 488, y 252, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 252,5, 51 × 15
                - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 252, 143 × 16
              - **box** (bloc) · x 767, y 252,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 254, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 254, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 7 · Porte qualité » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 252,5, 88 × 15
              - **box** (bloc) · x 989, y 252,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 42 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1020, y 252,5, 39 × 15
            - **line** (bloc) · x 432, y 278, 627 × 1 · fond `brandLine` · dimension remplit/fixe
            - **box** (bloc) · x 432, y 279, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 288,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 288,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 291, 12 × 12
                  - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 289,5, 15 × 15
              - **box** (bloc) · x 488, y 289, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 289,5, 51 × 15
                - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 289, 105 × 16
              - **box** (bloc) · x 767, y 289,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 291, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 291, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 9 · Review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 289,5, 58 × 15
              - **box** (bloc) · x 989, y 289,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 18 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1023, y 289,5, 36 × 15
        - **card / Échéances** (bloc) · x 265, y 336, 810 × 267 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 265, y 336, 810 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
            - icône `calendar` 15 px, `mfg` — x 281, y 350,5, 15 × 15
            - « Échéances » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 349,5, 74 × 17
            - « fonctionnalités par sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 916, y 350,5, 143 × 15
          - **line** (bloc) · x 265, y 380, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **grid** (bloc) · x 265, y 381, 806 × 186 · dimension fixe/fixe
            - **box** (bloc) · x 515, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 516, y 381, 138 × 186 · fond `muted (50 %)`
            - **box** (bloc) · x 654, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 793, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 932, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 525, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S42 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 525, y 390, 22 × 15
              - « 12 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 553, y 390, 36 × 15
            - **box** (bloc) · x 664, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S43 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 664, y 390, 22 × 15
              - « 19 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 692, y 390, 36 × 15
            - **box** (bloc) · x 803, y 390, 66 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S44 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 803, y 390, 22 × 15
              - « 26 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 831, y 390, 38 × 15
            - **box** (bloc) · x 942, y 390, 60 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S45 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 942, y 390, 22 × 15
              - « 2 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 970, y 390, 32 × 15
            - **today** (bloc) · x 644,1, y 405, 2 × 162 · fond `fg`
            - **box** (bloc) · x 265, y 411, 806 × 1 · fond `soft`
            - **box** (bloc) · x 281, y 419, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 419, 15 × 15
              - « Saisir un tronçon hors ligne » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 419, 156 × 15
            - **box** (bloc) · x 525, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 573,8, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 598,2, y 421, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 622,6, y 421, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 441, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 449, 206 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 449, 15 × 15
              - « Envoyer les photos d'un tronçon » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 449, 183 × 15
            - **box** (bloc) · x 767,6, y 449, 92 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
              - icône `clockAlert` 12 px, `red` — x 767,6, y 450,5, 12 × 12
              - « glisse en S43 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 783,6, y 449, 76 × 15
            - **box** (bloc) · x 525, y 451, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 451, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 573,8, y 451, 21,4 × 12 · fond `blue` · rayon 2
            - **box** (bloc) · x 598,2, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 622,6, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 664, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 688,4, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 712,8, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 737,2, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 281, y 471, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start
              - **pill** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `lock` 12 px, `red` — x 811, y 481,5, 12 × 12
                - « bloquée · Q14 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 828, y 480, 75 × 15
            - **box** (bloc) · x 281, y 479, 191 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 479, 15 × 15
              - « Importer les ISO depuis Excel » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 479, 168 × 15
            - **box** (bloc) · x 664, y 481, 27,5 × 12 · fond `red` · rayon 2
            - **box** (bloc) · x 694,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 501, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 509, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F8 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 509, 15 × 15
              - « Valider les soudures par lot » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 509, 156 × 15
            - **box** (bloc) · x 664, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 694,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 531, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 539, 193 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F7 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 539, 15 × 15
              - « Rapport de chantier journalier » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 539, 170 × 15
            - **box** (bloc) · x 803, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 827,4, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 851,8, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 876,2, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 900,6, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 650,1, y 543, 76 × 17 · flex ligne, espacement 0, marges internes 1 6 1 6, alignement center/start · fond `primary` · rayon 4
              - « aujourd'hui » — Geist 12 / 600, interligne 1,2, couleur `pfg` — x 656,1, y 544, 64 × 15
          - **line** (bloc) · x 265, y 567, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 568, 810 × 35 · flex ligne, espacement 16, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
            - **box** (bloc) · x 281, y 578, 82 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 281, y 580,5, 12 × 10 · fond `fg` · rayon 2 · dimension fixe/fixe
              - « étape livrée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 299, y 578, 64 × 15
            - **box** (bloc) · x 379, y 578, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 379, y 580,5, 12 × 10 · fond `purple` · rayon 2 · dimension fixe/fixe
              - « en review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 397, y 578, 53 × 15
            - **box** (bloc) · x 466, y 578, 65 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 466, y 580,5, 12 × 10 · fond `blue` · rayon 2 · dimension fixe/fixe
              - « en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 484, y 578, 47 × 15
            - **box** (bloc) · x 547, y 578, 63 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 547, y 580,5, 12 × 10 · fond `red` · rayon 2 · dimension fixe/fixe
              - « bloquée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 565, y 578, 45 × 15
            - **box** (bloc) · x 626, y 578, 53 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 626, y 580,5, 12 × 10 · fond `border` · rayon 2 · dimension fixe/fixe
              - « à faire » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 644, y 578, 35 × 15
            - **box** (bloc) · x 695, y 578, 112 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 695, y 580,5, 12 × 10 · fond `redSoft` · bordure 1 `red` · rayon 2 · dimension fixe/fixe
              - « glissement prévu » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 713, y 578, 94 × 15
        - **card / En retard** (bloc) · x 265, y 617, 810 × 83 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 265, y 617, 810 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
            - icône `clockAlert` 15 px, `red` — x 281, y 631,5, 15 × 15
            - « En retard » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 630,5, 62 × 17
            - **box** (bloc) · x 374, y 631,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `redSoft` · rayon 9
              - « 1 » — Geist Mono 12 / 500, interligne 1,2, couleur `red` — x 381, y 631,5, 8 × 15
            - « sprint terminé, étapes obligatoires restantes » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 807, y 631,5, 252 × 15
          - **line** (bloc) · x 265, y 661, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 662, 810 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
            - **box** (bloc) · x 281, y 673,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 673,5, 15 × 15
            - **box** (bloc) · x 317, y 673, 310 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
              - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 673, 195 × 16
            - **box** (bloc) · x 637, y 673,5, 160 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension fixe/auto
              - icône `sprint` 12 px, `mfg` — x 637, y 675, 12 × 12
              - « S42 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 655, y 673,5, 22 × 15
              - « · terminé le 16 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 683, y 673,5, 99 × 15
            - **box** (bloc) · x 807, y 671,5, 118 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **pill** (bloc) · x 807, y 671,5, 114 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `clockAlert` 12 px, `red` — x 815, y 675, 12 × 12
                - « reste 4 étapes » — Geist 12 / 500, interligne 1,2, couleur `red` — x 832, y 673,5, 81 × 15
            - **box** (bloc) · x 935, y 677, 84 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **segs** (bloc) · x 935, y 677, 72 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 935, y 677, 12 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 950, y 677, 12 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 965, y 677, 12 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 980, y 677, 12 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 995, y 677, 12 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
            - **box** (bloc) · x 1029, y 673,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
              - « 1/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 1036, y 673,5, 23 × 15
        - **box** (bloc) · x 265, y 714, 810 × 602 · flex ligne, espacement 16, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 714, 494 × 602 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension remplit/auto
            - **card / Sprint S42 · Terrain hors ligne** (bloc) · x 265, y 714, 494 × 197 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 714, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `sprint` 15 px, `mfg` — x 281, y 728,5, 15 × 15
                - « Sprint S42 · Terrain hors ligne » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 727,5, 197 × 17
                - « terminé le 16 oct. · reste 2 » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 517, y 728,5, 146 × 15
                - **pill** (bloc) · x 671, y 726,5, 88 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                  - « 2/2 en cours » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 679, y 728,5, 72 × 15
              - **line** (bloc) · x 265, y 758, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 759, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 770,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 770,5, 15 × 15
                - **box** (bloc) · x 317, y 770, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 317, y 770, 108 × 16
                - **box** (bloc) · x 541, y 768,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 768,5, 64 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `greenSoft` · rayon 10
                    - icône `circleCheck` 12 px, `green` — x 549, y 772, 12 × 12
                    - « livrée » — Geist 12 / 500, interligne 1,2, couleur `green` — x 566, y 770,5, 31 × 15
                - **box** (bloc) · x 637, y 774, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 774, 49 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 774, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 774, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 774, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 774, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 770,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 4/4 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 720, y 770,5, 23 × 15
              - **line** (bloc) · x 265, y 797, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 798, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 809,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 809,5, 15 × 15
                - **box** (bloc) · x 317, y 809, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 809, 167 × 16
                - **box** (bloc) · x 541, y 807,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 807,5, 65 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `blueSoft` · rayon 10
                    - « en cours » — Geist 12 / 500, interligne 1,2, couleur `blue` — x 549, y 809,5, 49 × 15
                - **box** (bloc) · x 637, y 813, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 813, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 813, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 813, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 813, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 813, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 813, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 809,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 809,5, 23 × 15
              - **line** (bloc) · x 265, y 836, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 837, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 848,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 848,5, 15 × 15
                - **box** (bloc) · x 317, y 848, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 848, 195 × 16
                - **box** (bloc) · x 541, y 846,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 846,5, 84 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                    - icône `clockAlert` 12 px, `red` — x 549, y 850, 12 × 12
                    - « en retard » — Geist 12 / 500, interligne 1,2, couleur `red` — x 566, y 848,5, 51 × 15
                - **box** (bloc) · x 637, y 852, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 852, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 852, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 852, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 852, 10 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 852, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 852, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 848,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 1/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 848,5, 23 × 15
              - **line** (bloc) · x 265, y 875, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 876, 494 × 35 · flex ligne, espacement 8, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
                - icône `target` 13 px, `mfg` — x 281, y 887, 13 × 13
                - « Limite de 2 en cours atteinte : F6 attendra la fin de F4 ou de F5. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 302, y 886, 441 × 15
            - **card / Prochaine à finir** (bloc) · x 265, y 925, 494 × 177 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 925, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `flag` 15 px, `mfg` — x 281, y 939,5, 15 × 15
                - « Prochaine à finir » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 938,5, 110 × 17
                - « la plus avancée du sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 601, y 939,5, 142 × 15
              - **box** (bloc) · x 265, y 969, 494 × 133 · flex colonne, espacement 10, marges internes 2 16 14 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 281, y 971, 462 × 18 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 972,5, 15 × 15
                  - « Saisir un tronçon hors ligne » — Geist 15 / 600, interligne 1,2, couleur `fg` — x 306, y 971, 197 × 18
                  - **segs** (bloc) · x 588, y 976, 122 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 588, y 976, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 613, y 976, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 638, y 976, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 976, 22 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 688, y 976, 22 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 972,5, 23 × 15
                - **box** (bloc) · x 281, y 999, 462 × 38 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 281, y 999, 320 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **dot** (pastille) · x 281, y 1003, 8 × 8 · fond `purple` · dimension fixe/fixe
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 999,5, 51 × 15
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 999, 102 × 16
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 466, y 999,5, 135 × 15
                  - **box** (bloc) · x 281, y 1021, 147 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 281, y 1025, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                    - « EMIS-46 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 1021,5, 51 × 15
                    - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 1021, 72 × 16
                - **box** (bloc) · x 281, y 1047, 462 × 41 · flex ligne, espacement 10, marges internes 8 10 8 12, alignement center/start · fond `muted` · rayon 8 · dimension remplit/auto
                  - « Étape suivante » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 293, y 1060, 84 × 15
                  - « /full-delivery EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 387, y 1060, 165 × 15
                  - **Button / outline** (bloc) · x 656, y 1055, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                    - icône `copy` 13 px, `fg` — x 666, y 1061, 13 × 13
                    - « Copier » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 685, y 1060, 38 × 15
            - **card / Activité** (bloc) · x 265, y 1116, 494 × 200 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 1116, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `activity` 15 px, `mfg` — x 281, y 1130,5, 15 × 15
                - « Activité » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 1129,5, 53 × 17
                - **chip** (bloc) · x 627, y 1128,5, 27 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « git » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 633, y 1130,5, 15 × 15
                - **chip** (bloc) · x 662, y 1128,5, 81 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « full-delivery » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 668, y 1130,5, 69 × 15
              - **line** (bloc) · x 265, y 1160, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1161, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1172,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 15:04 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1172,5, 36 × 15
                - icône `pr` 14 px, `purple` — x 331, y 1173, 14 × 14
                - **box** (bloc) · x 355, y 1172, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #22 ouverte » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1172, 91 × 16
                - **box** (bloc) · x 633, y 1171,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1172,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1171,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1174, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1172,5, 15 × 15
              - **line** (bloc) · x 265, y 1199, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1200, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1211,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:51 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1211,5, 36 × 15
                - icône `flag` 14 px, `mfg` — x 331, y 1212, 14 × 14
                - **box** (bloc) · x 355, y 1211, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Étape 7 · Porte qualité » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1211, 130 × 16
                - **box** (bloc) · x 633, y 1210,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1211,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1210,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1213, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1211,5, 15 × 15
              - **line** (bloc) · x 265, y 1238, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1239, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1250,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:40 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1250,5, 36 × 15
                - icône `bot` 14 px, `brand` — x 331, y 1251, 14 × 14
                - **box** (bloc) · x 355, y 1250, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Suivi mis à jour · lot n° 7 proposé » — Geist 13 / 400, interligne 1,2, couleur `brandText` — x 355, y 1250, 192 × 16
                - **box** (bloc) · x 633, y 1250,5, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « Agent de projet » — Geist 12 / 400, interligne 1,2, couleur `brandText` — x 658, y 1250,5, 85 × 15
              - **line** (bloc) · x 265, y 1277, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1278, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1289,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:36 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1289,5, 36 × 15
                - icône `merge` 14 px, `green` — x 331, y 1290, 14 × 14
                - **box** (bloc) · x 355, y 1289, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #18 fusionnée · F3 livrée » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1289, 161 × 16
                - **box** (bloc) · x 633, y 1288,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-21 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1289,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1288,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1291, 12 × 12
                    - « F3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1289,5, 15 × 15
          - **box** (bloc) · x 775, y 714, 300 × 534 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension fixe/auto
            - **card / En review** (bloc) · x 775, y 714, 300 × 273 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 714, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `pr` 15 px, `mfg` — x 791, y 728,5, 15 × 15
                - « En review » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 727,5, 65 × 17
                - **box** (bloc) · x 887, y 728,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 894, y 728,5, 8 × 15
              - **line** (bloc) · x 775, y 758, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 759, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 769, 15 × 15
                - **box** (bloc) · x 818, y 769, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 769, 179 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #22 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 769, 24 × 16
                    - « Route d'envoi des photos » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 769, 149 × 16
                  - **box** (bloc) · x 818, y 789, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 790, 51 × 15
                    - **fchip** (bloc) · x 875, y 789, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 791,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 790, 15 × 15
                  - **box** (bloc) · x 818, y 810, 61 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleCheck` 12 px, `green` — x 818, y 811,5, 12 × 12
                    - « CI verte » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 836, y 810, 43 × 15
              - **line** (bloc) · x 775, y 835, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 836, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `amber` — x 791, y 846, 15 × 15
                - **box** (bloc) · x 818, y 846, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 846, 132 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 846, 24 × 16
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 846, 102 × 16
                  - **box** (bloc) · x 818, y 866, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 867, 51 × 15
                    - **fchip** (bloc) · x 875, y 866, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 868,5, 12 × 12
                      - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 867, 15 × 15
                  - **box** (bloc) · x 818, y 887, 153 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleX` 12 px, `red` — x 818, y 888,5, 12 × 12
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 836, y 887, 135 × 15
              - **line** (bloc) · x 775, y 912, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 913, 300 × 74 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 923, 15 × 15
                - **box** (bloc) · x 818, y 923, 241 × 54 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 923, 173 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #23 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 923, 24 × 16
                    - « Passage à Expo SDK 54 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 923, 143 × 16
                  - **box** (bloc) · x 818, y 943, 51 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-61 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 943, 51 × 15
                  - **box** (bloc) · x 818, y 962, 79 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 818, y 964, 11 × 11 · bordure 2 `amber` · dimension fixe/fixe
                    - « CI en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 835, y 962, 62 × 15
            - **card / Questions** (bloc) · x 775, y 1001, 300 × 247 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 1001, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `question` 15 px, `mfg` — x 791, y 1015,5, 15 × 15
                - « Questions » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 1014,5, 69 × 17
                - **box** (bloc) · x 891, y 1015,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 898, y 1015,5, 8 × 15
              - **line** (bloc) · x 775, y 1045, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1046, 300 × 62 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1056, 268 × 42 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un ISO réaffecté garde-t-il ses photos ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1056, 268 × 18
                  - **box** (bloc) · x 791, y 1079, 239 × 19 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1080, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1082,5, 12 × 12
                      - « F6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1081, 15 × 15
                    - « Q14 · Client · il y a 3 j » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1081, 111 × 15
                    - **pill** (bloc) · x 957, y 1079, 73 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                      - « bloquante » — Geist 12 / 500, interligne 1,2, couleur `red` — x 965, y 1081, 57 × 15
              - **line** (bloc) · x 775, y 1108, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1109, 300 × 60 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1119, 268 × 40 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1119, 268 × 18
                  - **box** (bloc) · x 791, y 1142, 147 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1142, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1144,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1143, 15 × 15
                    - « Q16 · Produit · hier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1143, 98 × 15
              - **line** (bloc) · x 775, y 1169, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1170, 300 × 78 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1180, 268 × 58 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un rapport par chef de chantier ou par affaire ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1180, 268 × 36
                  - **box** (bloc) · x 791, y 1221, 163 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1221, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1223,5, 12 × 12
                      - « F7 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1222, 15 × 15
                    - « Q17 · Client · il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1222, 114 × 15
    - **vline** (bloc) · x 1099, y 0, 1 × 1360 · fond `soft` · dimension fixe/remplit
    - **agent-panel** (bloc) · x 1100, y 0, 340 × 1360 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 1100, y 0, 340 × 60 · flex ligne, espacement 10, marges internes 0 18 0 18, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 1118, y 15, 30 × 30 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandSoft` · bordure 1 `brandLine` · rayon 15 · dimension fixe/fixe
          - icône `bot` 17 px, `brand` — x 1124,5, y 21,5, 17 × 17
        - **box** (bloc) · x 1158, y 13, 128 × 34 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - « Agent de projet » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 1158, y 13, 104 × 17
          - « Suivi à jour · il y a 4 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 32, 128 × 15
        - icône `more` 16 px, `mfg` — x 1380, y 22, 16 × 16
        - icône `x` 16 px, `mfg` — x 1406, y 22, 16 × 16
      - **line** (bloc) · x 1100, y 60, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 61, 340 × 149 · flex colonne, espacement 8, marges internes 18, alignement start/start · dimension remplit/auto
        - « Résumé du jour » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 79, 114 × 15
        - « F3 est livrée : 3 fonctionnalités sur 9. » — Geist 14 / 500, interligne 1,45, couleur `fg` — x 1118, y 102, 304 × 21
        - « S42 est terminé depuis vendredi et F5 n'y a pas tenu : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » — Geist 13 / 400, interligne 1,55, couleur `mfg` — x 1118, y 131, 304 × 61
      - **line** (bloc) · x 1100, y 210, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 211, 340 × 368 · flex colonne, espacement 10, marges internes 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 229, 304 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « À valider » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 229, 66 × 15
        - **box** (bloc) · x 1118, y 254, 304 × 257 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 1118, y 254, 304 × 36 · flex ligne, espacement 8, marges internes 10 14 10 14, alignement center/start · fond `brandSoft` · dimension remplit/auto
            - « Lot n° 7 » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 1132, y 264, 47 × 16
            - « 3 actions » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1357, y 264,5, 51 × 15
          - **line** (bloc) · x 1118, y 290, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 291, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 302, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 304,5, 11 × 11
            - **box** (bloc) · x 1158, y 302, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Reporter F5 en S43 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 302, 250 × 16
              - « 4 étapes restantes, S42 terminé le 16 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 321, 250 × 15
          - **line** (bloc) · x 1118, y 347, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 348, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 359, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 361,5, 11 × 11
            - **box** (bloc) · x 1158, y 359, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Planifier F9 en S44 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 359, 250 × 16
              - « seule fonctionnalité à planifier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 378, 250 × 15
          - **line** (bloc) · x 1118, y 404, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 405, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 416, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 418,5, 11 × 11
            - **box** (bloc) · x 1158, y 416, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Relancer le client sur Q14 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 416, 250 × 16
              - « bloque F6, prévue en S43 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 435, 250 × 15
          - **line** (bloc) · x 1118, y 461, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 462, 304 × 49 · flex ligne, espacement 8, marges internes 12 14 12 14, alignement center/start · dimension remplit/auto
            - **Button / brand** (bloc) · x 1132, y 474, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `brandBtn` · rayon 6
              - « Valider (3) » — Geist 12 / 500, interligne 1,2, couleur `#FFFFFF` — x 1142, y 479, 57 × 15
            - **Button / outline** (bloc) · x 1217, y 474, 65 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
              - « Refuser » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1227, y 479, 45 × 15
        - **box** (bloc) · x 1118, y 521, 304 × 40 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement start/start · dimension remplit/auto
          - icône `refresh` 13 px, `mfg` — x 1118, y 525, 13 × 13
          - « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » — Geist 12 / 400, interligne 1,5, couleur `mfg` — x 1139, y 525, 283 × 36
      - **line** (bloc) · x 1100, y 1289, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 1290, 340 × 70 · flex colonne, espacement 0, marges internes 14 18 14 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 1304, 304 × 42 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 8 · dimension remplit/fixe
          - « Demander à l'agent de projet… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 1130, y 1317, 179 × 16
          - icône `send` 15 px, `mfg` — x 1395, y 1317,5, 15 × 15

## P1 bis v3 · Pour commencer

Board `P1 bis v3 · Pour commencer` (sombre) et `P1 bis v3 · Pour commencer (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-vue-ensemble-v3-pour-commencer-dark.png` et `exports/proposition-vue-ensemble-v3-pour-commencer-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « Kanban » (x 59, y 329)
14. « Graphe » (x 59, y 361)
15. « Questions » (x 59, y 393)
16. « Kibo » (x 55, y 425)
17. « Gereco » (x 55, y 457)
18. « Rapid » (x 55, y 489)
19. « Paramètres » (x 41, y 923)
20. « AB » (x 21, y 962)
21. « Adam Ben Mchichi » (x 48, y 960,5)
22. « Emis » (x 277, y 16)
23. « / » (x 314, y 16)
24. « Vue d'ensemble » (x 329, y 16)
25. « Synchronisé · il y a 1 min » (x 1012, y 16,5)
26. « Nouveau ticket » (x 1185, y 16,5)
27. « Agent de projet » (x 1323, y 16,5)
28. « Emis » (x 265, y 67)
29. « client Emis SA » (x 286, y 100)
30. « · » (x 379, y 100)
31. « 6 sprints d'une semaine · du 19 oct. au 27 nov. 2026 » (x 390, y 100)
32. « Fonctionnalités » (x 303, y 142)
33. « 0 » (x 283, y 162)
34. « livrées sur 0 » (x 308, y 174)
35. « aucune pour l'instant » (x 283, y 195,5)
36. « Sprint en cours » (x 533,4, y 142)
37. « — » (x 513,4, y 162)
38. « S1 commence le lun. 19 oct. » (x 513,4, y 195,5)
39. « En cours » (x 763,8, y 142)
40. « 0 » (x 743,8, y 162)
41. « / 2 » (x 768,8, y 174)
42. « aucune en cours » (x 743,8, y 195,5)
43. « En review » (x 994,2, y 142)
44. « 0 » (x 974,2, y 162)
45. « PR » (x 999,2, y 174)
46. « aucune PR » (x 974,2, y 195,5)
47. « Questions » (x 1224,6, y 142)
48. « 0 » (x 1204,6, y 162)
49. « ouvertes » (x 1229,6, y 174)
50. « aucune question » (x 1204,6, y 195,5)
51. « Pour commencer » (x 304, y 249,5)
52. « 0/2 » (x 433, y 250,5)
53. « deux étapes pour suivre le projet » (x 897, y 250,5)
54. « Relier le dépôt » (x 311, y 295)
55. « Choisis le dossier du dépôt : branches, PR et CI remontent seuls. » (x 311, y 316)
56. « Choisir le dossier » (x 977, y 300)
57. « Créer une fonctionnalité » (x 311, y 363)
58. « Elle se livre de A à Z ; ses étapes deviennent EMIS-1, EMIS-2… » (x 311, y 384)
59. « Ouvrir le Planning » (x 974, y 368)
60. « Sprints » (x 1155, y 249,5)
61. « 6 » (x 1219, y 250,5)
62. « S1 » (x 1132, y 292,5)
63. « Sprint 1 » (x 1168, y 292)
64. « 19–23 oct. » (x 1340, y 292,5)
65. « S2 » (x 1132, y 331,5)
66. « Sprint 2 » (x 1168, y 331)
67. « 26–30 oct. » (x 1337, y 331,5)
68. « S3 » (x 1132, y 370,5)
69. « Sprint 3 » (x 1168, y 370)
70. « 2–6 nov. » (x 1351, y 370,5)
71. « S4 » (x 1132, y 409,5)
72. « Sprint 4 » (x 1168, y 409)
73. « 9–13 nov. » (x 1347, y 409,5)
74. « S5 » (x 1132, y 448,5)
75. « Sprint 5 » (x 1168, y 448)
76. « 16–20 nov. » (x 1338, y 448,5)
77. « S6 » (x 1132, y 487,5)
78. « Sprint 6 » (x 1168, y 487)
79. « 23–27 nov. » (x 1338, y 487,5)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P1 bis v3 · Pour commencer** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `fg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 265, 96 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
      - **nav / Kanban** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 43 × 16
      - **nav / Questions** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 60 × 16
      - **nav / Kibo** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 426,5, 13 × 13
        - **dot** (pastille) · x 39, y 429, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 425, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 458,5, 13 × 13
        - **dot** (pastille) · x 39, y 461, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 457, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 164 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 96 × 16
        - **box** (bloc) · x 992, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 992, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1012, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 1156, y 11,5, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 1166, y 17,5, 13 × 13
          - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1185, y 16,5, 85 × 15
        - **agent-button** (bloc) · x 1292, y 11,5, 132 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1302, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1323, y 16,5, 91 × 15
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 1199 × 951 · flex colonne, espacement 14, marges internes 18 24 24 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 429 × 49 · flex colonne, espacement 4, marges internes 0, alignement start/start
          - « Emis » — Geist 24 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 265, y 67, 55 × 29
          - **box** (bloc) · x 265, y 100, 429 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - icône `building` 13 px, `mfg` — x 265, y 101,5, 13 × 13
            - « client Emis SA » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 286, y 100, 85 × 16
            - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 379, y 100, 3 × 16
            - « 6 sprints d'une semaine · du 19 oct. au 27 nov. 2026 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 390, y 100, 304 × 16
        - **kpis** (bloc) · x 265, y 130, 1151 × 92 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 130, 229,4 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 283, y 142, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `package` 14 px, `mfg` — x 283, y 142,5, 14 × 14
              - « Fonctionnalités » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 303, y 142, 90 × 15
            - **box** (bloc) · x 283, y 162, 98 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 0 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 283, y 162, 19 × 28
              - « livrées sur 0 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 308, y 174, 73 × 16
            - **box** (bloc) · x 283, y 195, 115 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « aucune pour l'instant » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 283, y 195,5, 115 × 15
          - **vline** (bloc) · x 494,4, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 495,4, y 130, 229,4 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 513,4, y 142, 109 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `sprint` 14 px, `mfg` — x 513,4, y 142,5, 14 × 14
              - « Sprint en cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 533,4, y 142, 89 × 15
            - **box** (bloc) · x 513,4, y 162, 25 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « — » — Geist 28 / 600, interligne 1, couleur `faint`, interlettrage -0,5 — x 513,4, y 162, 25 × 28
            - **box** (bloc) · x 513,4, y 195, 150 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « S1 commence le lun. 19 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 513,4, y 195,5, 150 × 15
          - **vline** (bloc) · x 724,8, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 725,8, y 130, 229,4 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 743,8, y 142, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `target` 14 px, `mfg` — x 743,8, y 142,5, 14 × 14
              - « En cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 763,8, y 142, 51 × 15
            - **box** (bloc) · x 743,8, y 162, 43 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 0 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 743,8, y 162, 19 × 28
              - « / 2 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 768,8, y 174, 18 × 16
            - **box** (bloc) · x 743,8, y 195, 91 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « aucune en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 743,8, y 195,5, 91 × 15
          - **vline** (bloc) · x 955,2, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 956,2, y 130, 229,4 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 974,2, y 142, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `pr` 14 px, `mfg` — x 974,2, y 142,5, 14 × 14
              - « En review » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 994,2, y 142, 57 × 15
            - **box** (bloc) · x 974,2, y 162, 42 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 0 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 974,2, y 162, 19 × 28
              - « PR » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 999,2, y 174, 17 × 16
            - **box** (bloc) · x 974,2, y 195, 59 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « aucune PR » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 974,2, y 195,5, 59 × 15
          - **vline** (bloc) · x 1185,6, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 1186,6, y 130, 229,4 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1204,6, y 142, 80 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `question` 14 px, `mfg` — x 1204,6, y 142,5, 14 × 14
              - « Questions » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 1224,6, y 142, 60 × 15
            - **box** (bloc) · x 1204,6, y 162, 77 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 0 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 1204,6, y 162, 19 × 28
              - « ouvertes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 1229,6, y 174, 52 × 16
            - **box** (bloc) · x 1204,6, y 195, 91 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « aucune question » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1204,6, y 195,5, 91 × 15
        - **box** (bloc) · x 265, y 236, 1151 × 278 · flex ligne, espacement 16, marges internes 0, alignement start/start · dimension remplit/auto
          - **card / Pour commencer** (bloc) · x 265, y 236, 835 × 180 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
            - **box** (bloc) · x 265, y 236, 835 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
              - icône `flag` 15 px, `mfg` — x 281, y 250,5, 15 × 15
              - « Pour commencer » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 249,5, 114 × 17
              - **box** (bloc) · x 426, y 250,5, 36 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                - « 0/2 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 433, y 250,5, 22 × 15
              - « deux étapes pour suivre le projet » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 897, y 250,5, 187 × 15
            - **line** (bloc) · x 265, y 280, 835 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 265, y 281, 835 × 67 · flex ligne, espacement 12, marges internes 14 16 14 16, alignement start/start · dimension remplit/auto
              - **check** (bloc) · x 281, y 295, 18 × 18 · flex ligne, espacement 0, marges internes 0, alignement center/center · bordure 1 `border` · rayon 9 · dimension fixe/fixe
              - **box** (bloc) · x 311, y 295, 625 × 39 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 295, 92 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                  - « Relier le dépôt » — Geist 13,5 / 500, interligne 1,2, couleur `fg` — x 311, y 295, 92 × 17
                - « Choisis le dossier du dépôt : branches, PR et CI remontent seuls. » — Geist 12,5 / 400, interligne 1,4, couleur `mfg` — x 311, y 316, 625 × 18
              - **Button / outline** (bloc) · x 948, y 295, 136 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                - icône `folderOpen` 13 px, `fg` — x 958, y 301, 13 × 13
                - « Choisir le dossier » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 977, y 300, 97 × 15
            - **line** (bloc) · x 265, y 348, 835 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 265, y 349, 835 × 67 · flex ligne, espacement 12, marges internes 14 16 14 16, alignement start/start · dimension remplit/auto
              - **check** (bloc) · x 281, y 363, 18 × 18 · flex ligne, espacement 0, marges internes 0, alignement center/center · bordure 1 `border` · rayon 9 · dimension fixe/fixe
              - **box** (bloc) · x 311, y 363, 622 × 39 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 311, y 363, 153 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                  - « Créer une fonctionnalité » — Geist 13,5 / 500, interligne 1,2, couleur `fg` — x 311, y 363, 153 × 17
                - « Elle se livre de A à Z ; ses étapes deviennent EMIS-1, EMIS-2… » — Geist 12,5 / 400, interligne 1,4, couleur `mfg` — x 311, y 384, 622 × 18
              - **Button / outline** (bloc) · x 945, y 363, 139 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                - icône `sprint` 13 px, `fg` — x 955, y 369, 13 × 13
                - « Ouvrir le Planning » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 974, y 368, 100 × 15
          - **card / Sprints** (bloc) · x 1116, y 236, 300 × 278 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension fixe/auto
            - **box** (bloc) · x 1116, y 236, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
              - icône `sprint` 15 px, `mfg` — x 1132, y 250,5, 15 × 15
              - « Sprints » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 1155, y 249,5, 49 × 17
              - **box** (bloc) · x 1212, y 250,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                - « 6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 1219, y 250,5, 8 × 15
            - **line** (bloc) · x 1116, y 280, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 281, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 292,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S1 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 1132, y 292,5, 15 × 15
              - **box** (bloc) · x 1168, y 292, 162 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 1 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 292, 45 × 16
              - « 19–23 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1340, y 292,5, 60 × 15
            - **line** (bloc) · x 1116, y 319, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 320, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 331,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S2 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 1132, y 331,5, 15 × 15
              - **box** (bloc) · x 1168, y 331, 159 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 2 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 331, 48 × 16
              - « 26–30 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1337, y 331,5, 63 × 15
            - **line** (bloc) · x 1116, y 358, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 359, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 370,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 1132, y 370,5, 15 × 15
              - **box** (bloc) · x 1168, y 370, 173 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 3 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 370, 48 × 16
              - « 2–6 nov. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1351, y 370,5, 49 × 15
            - **line** (bloc) · x 1116, y 397, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 398, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 409,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 1132, y 409,5, 15 × 15
              - **box** (bloc) · x 1168, y 409, 169 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 4 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 409, 48 × 16
              - « 9–13 nov. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1347, y 409,5, 53 × 15
            - **line** (bloc) · x 1116, y 436, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 437, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 448,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 1132, y 448,5, 15 × 15
              - **box** (bloc) · x 1168, y 448, 160 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 5 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 448, 48 × 16
              - « 16–20 nov. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1338, y 448,5, 62 × 15
            - **line** (bloc) · x 1116, y 475, 300 × 1 · fond `soft` · dimension remplit/fixe
            - **box** (bloc) · x 1116, y 476, 300 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 1132, y 487,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - « S6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 1132, y 487,5, 15 × 15
              - **box** (bloc) · x 1168, y 487, 160 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                - « Sprint 6 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 1168, y 487, 47 × 16
              - « 23–27 nov. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1338, y 487,5, 62 × 15

## P6 · Nouveau projet

Board `P6 · Nouveau projet` (sombre) et `P6 · Nouveau projet (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-nouveau-projet-dark.png` et `exports/proposition-nouveau-projet-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Vue d'ensemble » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 671, y 16,5)
31. « Nouveau ticket » (x 844, y 16,5)
32. « Agent de projet » (x 982, y 16,5)
33. « Emis » (x 265, y 67)
34. « Suivi de chantier » (x 265, y 100)
35. « · » (x 372, y 100)
36. « galadrimteam/emis-suivi-chantier » (x 404, y 100,5)
37. « Fonctionnalités » (x 303, y 142)
38. « 3 » (x 283, y 162)
39. « livrées sur 9 » (x 307, y 174)
40. « Sprint en cours » (x 465,2, y 142)
41. « S42 » (x 445,2, y 162)
42. « finit ce soir » (x 505,2, y 174)
43. « Terrain hors ligne » (x 445,2, y 195,5)
44. « Ouvertes » (x 627,4, y 142)
45. « 2 » (x 607,4, y 162)
46. « sur 2 max » (x 631,4, y 174)
47. « limite » (x 618,4, y 195,5)
48. « · » (x 653,4, y 195,5)
49. « 1 bloquée » (x 671,4, y 195,5)
50. « En review » (x 789,6, y 142)
51. « 3 » (x 769,6, y 162)
52. « PR » (x 793,6, y 174)
53. « #20 · #22 · #23 » (x 769,6, y 195,5)
54. « Questions » (x 951,8, y 142)
55. « 3 » (x 931,8, y 162)
56. « ouvertes » (x 955,8, y 174)
57. « Q14 bloque F6 » (x 944,8, y 195,5)
58. « En ce moment » (x 302, y 261,5)
59. « 2 sessions T3 Code » (x 281, y 281,5)
60. « F5 » (x 454, y 252,5)
61. « EMIS-33 » (x 488, y 252,5)
62. « Écran d'envoi hors ligne » (x 547, y 252)
63. « 7 · Porte qualité » (x 859, y 252,5)
64. « 42 min » (x 1020, y 252,5)
65. « F4 » (x 454, y 289,5)
66. « EMIS-45 » (x 488, y 289,5)
67. « Conflits de saisie » (x 547, y 289)
68. « 9 · Review » (x 859, y 289,5)
69. « 18 min » (x 1023, y 289,5)
70. « Échéances » (x 304, y 349,5)
71. « fonctionnalités par sprint » (x 916, y 350,5)
72. « S42 » (x 525, y 390)
73. « 12 oct. » (x 553, y 390)
74. « S43 » (x 664, y 390)
75. « 19 oct. » (x 692, y 390)
76. « S44 » (x 803, y 390)
77. « 26 oct. » (x 831, y 390)
78. « S45 » (x 942, y 390)
79. « 2 nov. » (x 970, y 390)
80. « F4 » (x 281, y 419)
81. « Saisir un tronçon hors ligne » (x 304, y 419)
82. « F5 » (x 281, y 449)
83. « Envoyer les photos d'un tronçon » (x 304, y 449)
84. « glisse en S43 » (x 783,6, y 449)
85. « bloquée · Q14 » (x 828, y 480)
86. « F6 » (x 281, y 479)
87. « Importer les ISO depuis Excel » (x 304, y 479)
88. « F8 » (x 281, y 509)
89. « Valider les soudures par lot » (x 304, y 509)
90. « F7 » (x 281, y 539)
91. « Rapport de chantier journalier » (x 304, y 539)
92. « aujourd'hui » (x 616,4, y 544)
93. « étape livrée » (x 299, y 578)
94. « en review » (x 397, y 578)
95. « en cours » (x 484, y 578)
96. « bloquée » (x 565, y 578)
97. « à faire » (x 644, y 578)
98. « glissement prévu » (x 713, y 578)
99. « Sprint S42 · Terrain hors ligne » (x 304, y 630,5)
100. « 12–16 oct. » (x 589, y 631,5)
101. « 2/2 ouvertes » (x 662, y 631,5)
102. « F3 » (x 281, y 673,5)
103. « Réaffecter un ISO » (x 317, y 673)
104. « livrée » (x 566, y 673,5)
105. « 4/4 » (x 720, y 673,5)
106. « F4 » (x 281, y 712,5)
107. « Saisir un tronçon hors ligne » (x 317, y 712)
108. « ouverte » (x 549, y 712,5)
109. « 3/5 » (x 720, y 712,5)
110. « F5 » (x 281, y 751,5)
111. « Envoyer les photos d'un tronçon » (x 317, y 751)
112. « en retard » (x 566, y 751,5)
113. « 1/5 » (x 720, y 751,5)
114. « Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5. » (x 302, y 789)
115. « Prochaine à finir » (x 304, y 841,5)
116. « la plus avancée du sprint » (x 601, y 842,5)
117. « F4 » (x 281, y 875,5)
118. « Saisir un tronçon hors ligne » (x 306, y 874)
119. « 3/5 » (x 720, y 875,5)
120. « EMIS-45 » (x 297, y 902,5)
121. « Conflits de saisie » (x 356, y 902)
122. « changements demandés » (x 466, y 902,5)
123. « EMIS-46 » (x 297, y 924,5)
124. « Démo client » (x 356, y 924)
125. « Étape suivante » (x 293, y 963)
126. « /full-delivery EMIS-45 » (x 387, y 963)
127. « Copier » (x 685, y 963)
128. « Activité » (x 304, y 1032,5)
129. « git » (x 633, y 1033,5)
130. « full-delivery » (x 668, y 1033,5)
131. « 15:04 » (x 281, y 1075,5)
132. « PR #22 ouverte » (x 355, y 1075)
133. « EMIS-32 » (x 643, y 1075,5)
134. « F5 » (x 722, y 1075,5)
135. « 14:51 » (x 281, y 1114,5)
136. « Étape 7 · Porte qualité » (x 355, y 1114)
137. « EMIS-33 » (x 643, y 1114,5)
138. « F5 » (x 722, y 1114,5)
139. « 14:40 » (x 281, y 1153,5)
140. « Suivi mis à jour · lot n° 7 proposé » (x 355, y 1153)
141. « Agent de projet » (x 658, y 1153,5)
142. « 14:36 » (x 281, y 1192,5)
143. « PR #18 fusionnée · F3 livrée » (x 355, y 1192)
144. « EMIS-21 » (x 643, y 1192,5)
145. « F3 » (x 722, y 1192,5)
146. « En review » (x 814, y 630,5)
147. « 3 » (x 894, y 631,5)
148. « #22 » (x 818, y 672)
149. « Route d'envoi des photos » (x 848, y 672)
150. « EMIS-32 » (x 818, y 693)
151. « F5 » (x 897, y 693)
152. « CI verte » (x 836, y 713)
153. « #20 » (x 818, y 749)
154. « Conflits de saisie » (x 848, y 749)
155. « EMIS-45 » (x 818, y 770)
156. « F4 » (x 897, y 770)
157. « changements demandés » (x 836, y 790)
158. « #23 » (x 818, y 826)
159. « Passage à Expo SDK 54 » (x 848, y 826)
160. « EMIS-61 » (x 818, y 846)
161. « CI en cours » (x 835, y 865)
162. « Questions » (x 814, y 917,5)
163. « 3 » (x 898, y 918,5)
164. « Un ISO réaffecté garde-t-il ses photos ? » (x 791, y 959)
165. « F6 » (x 813, y 984)
166. « Q14 · Client · il y a 3 j » (x 840, y 984)
167. « bloquante » (x 965, y 984)
168. « Quota par affaire : 2 Go ou 5 Go ? » (x 791, y 1022)
169. « F5 » (x 813, y 1046)
170. « Q16 · Produit · hier » (x 840, y 1046)
171. « Un rapport par chef de chantier ou par affaire ? » (x 791, y 1083)
172. « F7 » (x 813, y 1125)
173. « Q17 · Client · il y a 2 h » (x 840, y 1125)
174. « Agent de projet » (x 1158, y 13)
175. « Suivi à jour · il y a 4 min » (x 1158, y 32)
176. « Résumé du jour » (x 1118, y 79)
177. « F3 est livrée : 3 fonctionnalités sur 9. » (x 1118, y 102)
178. « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » (x 1118, y 131)
179. « À valider » (x 1118, y 229)
180. « Lot n° 7 » (x 1132, y 264)
181. « 3 actions » (x 1357, y 264,5)
182. « Reporter F5 en S43 » (x 1158, y 302)
183. « 4 étapes restantes, S42 finit aujourd'hui » (x 1158, y 321)
184. « Planifier F9 en S44 » (x 1158, y 359)
185. « seule fonctionnalité à planifier » (x 1158, y 378)
186. « Relancer le client sur Q14 » (x 1158, y 416)
187. « bloque F6, prévue en S43 » (x 1158, y 435)
188. « Valider (3) » (x 1142, y 479)
189. « Refuser » (x 1227, y 479)
190. « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » (x 1139, y 525)
191. « Demander à l'agent de projet… » (x 1130, y 957)
192. « Nouveau projet » (x 484, y 193)
193. « Un projet suivi : ses pages et ses sprints sont créés aussitôt. » (x 484, y 221)
194. « Nom » (x 484, y 255)
195. « Emis » (x 496, y 287)
196. « Clé » (x 484, y 331)
197. « EMIS » (x 496, y 363)
198. « 2 à 6 lettres majuscules, unique. » (x 484, y 395)
199. « Client » (x 686, y 331)
200. « Emis SA » (x 698, y 363)
201. « Facultatif. Destinataire des questions client. » (x 686, y 395)
202. « Début du premier sprint » (x 484, y 430)
203. « 19/10/2026 » (x 496, y 462)
204. « Nombre de sprints » (x 806, y 430)
205. « 6 » (x 818, y 462)
206. « Durée d'un sprint » (x 484, y 506)
207. « 1 semaine » (x 508, y 531)
208. « 2 semaines » (x 611, y 531)
209. « 6 sprints d'une semaine · du 19 oct. au 27 nov. 2026 » (x 520, y 580)
210. « S1 » (x 498, y 606)
211. « 19–23 oct. » (x 521, y 606)
212. « S4 » (x 498, y 629)
213. « 9–13 nov. » (x 521, y 629)
214. « S2 » (x 647, y 606)
215. « 26–30 oct. » (x 670, y 606)
216. « S5 » (x 647, y 629)
217. « 16–20 nov. » (x 670, y 629)
218. « S3 » (x 796, y 606)
219. « 2–6 nov. » (x 819, y 606)
220. « S6 » (x 796, y 629)
221. « 23–27 nov. » (x 819, y 629)
222. « Dossier du dépôt » (x 484, y 674)
223. « Aucun dossier » (x 518, y 706)
224. « Choisir… » (x 887, y 706,5)
225. « Facultatif. Sans dossier, pas de suivi git. » (x 484, y 738)
226. « Annuler » (x 824, y 784)
227. « Créer » (x 908, y 784)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P6 · Nouveau projet** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `fg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 265, 96 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 858 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 858 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 164 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Vue d'ensemble » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 96 × 16
        - **box** (bloc) · x 651, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 651, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 671, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 815, y 11,5, 124 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 825, y 17,5, 13 × 13
          - « Nouveau ticket » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 844, y 16,5, 85 × 15
        - **agent-button** (bloc) · x 951, y 11,5, 132 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 6
          - icône `bot` 15 px, `brand` — x 961, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `brandText` — x 982, y 16,5, 91 × 15
      - **line** (bloc) · x 241, y 48, 858 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 241, y 49, 858 × 951 · flex colonne, espacement 14, marges internes 18 24 24 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 67, 810 × 49 · flex ligne, espacement 12, marges internes 0, alignement end/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 67, 370 × 49 · flex colonne, espacement 4, marges internes 0, alignement start/start
            - « Emis » — Geist 24 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 265, y 67, 55 × 29
            - **box** (bloc) · x 265, y 100, 370 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « Suivi de chantier » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 265, y 100, 99 × 16
              - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 372, y 100, 3 × 16
              - icône `github` 13 px, `mfg` — x 383, y 101,5, 13 × 13
              - « galadrimteam/emis-suivi-chantier » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 404, y 100,5, 231 × 15
        - **kpis** (bloc) · x 265, y 130, 810 × 92 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 283, y 142, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `package` 14 px, `mfg` — x 283, y 142,5, 14 × 14
              - « Fonctionnalités » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 303, y 142, 90 × 15
            - **box** (bloc) · x 283, y 162, 96 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 283, y 162, 18 × 28
              - « livrées sur 9 » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 307, y 174, 72 × 16
            - **box** (bloc) · x 283, y 195, 150 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **segs** (bloc) · x 283, y 200, 150 × 6 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 283, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 300, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 317, y 200, 14 × 6 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 334, y 200, 14 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 351, y 200, 14 × 6 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 368, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 385, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 402, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **seg** (bloc) · x 419, y 200, 14 × 6 · fond `border` · rayon 1,5 · dimension fixe/fixe
          - **vline** (bloc) · x 426,2, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 427,2, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 445,2, y 142, 109 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `sprint` 14 px, `mfg` — x 445,2, y 142,5, 14 × 14
              - « Sprint en cours » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 465,2, y 142, 89 × 15
            - **box** (bloc) · x 445,2, y 162, 126 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « S42 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 445,2, y 162, 54 × 28
              - « finit ce soir » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 505,2, y 174, 66 × 16
            - **box** (bloc) · x 445,2, y 195, 94 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « Terrain hors ligne » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 445,2, y 195,5, 94 × 15
          - **vline** (bloc) · x 588,4, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 589,4, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 607,4, y 142, 74 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `target` 14 px, `mfg` — x 607,4, y 142,5, 14 × 14
              - « Ouvertes » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 627,4, y 142, 54 × 15
            - **box** (bloc) · x 607,4, y 162, 84 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 2 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 607,4, y 162, 18 × 28
              - « sur 2 max » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 631,4, y 174, 60 × 16
            - **box** (bloc) · x 607,4, y 195, 116 × 16 · flex ligne, espacement 4, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 607,4, y 199,5, 7 × 7 · fond `amber` · dimension fixe/fixe
              - « limite » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 618,4, y 195,5, 31 × 15
              - « · » — Geist 12 / 400, interligne 1,2, couleur `faint` — x 653,4, y 195,5, 3 × 15
              - **dot** (pastille) · x 660,4, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « 1 bloquée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 671,4, y 195,5, 52 × 15
          - **vline** (bloc) · x 750,6, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 751,6, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 769,6, y 142, 77 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `pr` 14 px, `mfg` — x 769,6, y 142,5, 14 × 14
              - « En review » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 789,6, y 142, 57 × 15
            - **box** (bloc) · x 769,6, y 162, 41 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 769,6, y 162, 18 × 28
              - « PR » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 793,6, y 174, 17 × 16
            - **box** (bloc) · x 769,6, y 195, 79 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - « #20 · #22 · #23 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 769,6, y 195,5, 79 × 15
          - **vline** (bloc) · x 912,8, y 130, 1 × 92 · fond `soft` · dimension fixe/remplit
          - **box** (bloc) · x 913,8, y 130, 161,2 × 93 · flex colonne, espacement 5, marges internes 12 18 12 18, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 931,8, y 142, 80 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - icône `question` 14 px, `mfg` — x 931,8, y 142,5, 14 × 14
              - « Questions » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 951,8, y 142, 60 × 15
            - **box** (bloc) · x 931,8, y 162, 76 × 28 · flex ligne, espacement 6, marges internes 0, alignement end/start
              - « 3 » — Geist 28 / 600, interligne 1, couleur `fg`, interlettrage -0,5 — x 931,8, y 162, 18 × 28
              - « ouvertes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 955,8, y 174, 52 × 16
            - **box** (bloc) · x 931,8, y 195, 92 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension auto/fixe
              - **dot** (pastille) · x 931,8, y 199,5, 7 × 7 · fond `red` · dimension fixe/fixe
              - « Q14 bloque F6 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 944,8, y 195,5, 79 × 15
        - **live** (bloc) · x 265, y 236, 810 × 86 · flex ligne, espacement 0, marges internes 0, alignement stretch/start · fond `brandSoft` · bordure 1 `brandLine` · rayon 10 · dimension remplit/fixe
          - **box** (bloc) · x 265, y 236, 150 × 86 · flex colonne, espacement 4, marges internes 0 16 0 16, alignement start/center · dimension fixe/remplit
            - **box** (bloc) · x 281, y 261,5, 110 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **halo** (bloc) · x 281, y 263, 13 × 13 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6,5 · dimension fixe/fixe
                - **dot** (pastille) · x 284, y 266, 7 × 7 · fond `brand` · dimension fixe/fixe
              - « En ce moment » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 302, y 261,5, 89 × 16
            - « 2 sessions T3 Code » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 281,5, 107 × 15
          - **box** (bloc) · x 415, y 236, 1 × 86 · fond `brandLine` · dimension fixe/remplit
          - **box** (bloc) · x 416, y 236, 659 × 86 · flex colonne, espacement 0, marges internes 6 16 6 16, alignement start/start · dimension remplit/remplit
            - **box** (bloc) · x 432, y 242, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 251,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 251,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 254, 12 × 12
                  - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 252,5, 15 × 15
              - **box** (bloc) · x 488, y 252, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 252,5, 51 × 15
                - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 252, 143 × 16
              - **box** (bloc) · x 767, y 252,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 254, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 254, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 254, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 254, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 7 · Porte qualité » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 252,5, 88 × 15
              - **box** (bloc) · x 989, y 252,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 42 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1020, y 252,5, 39 × 15
            - **line** (bloc) · x 432, y 278, 627 × 1 · fond `brandLine` · dimension remplit/fixe
            - **box** (bloc) · x 432, y 279, 627 × 36 · flex ligne, espacement 12, marges internes 0, alignement center/start · dimension remplit/fixe
              - **box** (bloc) · x 432, y 288,5, 44 × 17 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                - **fchip** (bloc) · x 432, y 288,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `package` 12 px, `mfg` — x 438, y 291, 12 × 12
                  - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 454, y 289,5, 15 × 15
              - **box** (bloc) · x 488, y 289, 267 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 488, y 289,5, 51 × 15
                - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 547, y 289, 105 × 16
              - **box** (bloc) · x 767, y 289,5, 210 × 15 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension fixe/auto
                - **segs** (bloc) · x 767, y 291, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
                  - **seg** (bloc) · x 767, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 774, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 781, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 788, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 795, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 802, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 809, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 816, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 823, y 291, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 830, y 291, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 837, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                  - **seg** (bloc) · x 844, y 291, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
                - « 9 · Review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 859, y 289,5, 58 × 15
              - **box** (bloc) · x 989, y 289,5, 70 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                - « 18 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1023, y 289,5, 36 × 15
        - **card / Échéances** (bloc) · x 265, y 336, 810 × 267 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 265, y 336, 810 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
            - icône `calendar` 15 px, `mfg` — x 281, y 350,5, 15 × 15
            - « Échéances » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 349,5, 74 × 17
            - « fonctionnalités par sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 916, y 350,5, 143 × 15
          - **line** (bloc) · x 265, y 380, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **grid** (bloc) · x 265, y 381, 806 × 186 · dimension fixe/fixe
            - **box** (bloc) · x 515, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 516, y 381, 138 × 186 · fond `muted (50 %)`
            - **box** (bloc) · x 654, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 793, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 932, y 381, 1 × 186 · fond `soft`
            - **box** (bloc) · x 525, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S42 » — Geist Mono 12 / 600, interligne 1,2, couleur `fg` — x 525, y 390, 22 × 15
              - « 12 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 553, y 390, 36 × 15
            - **box** (bloc) · x 664, y 390, 64 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S43 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 664, y 390, 22 × 15
              - « 19 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 692, y 390, 36 × 15
            - **box** (bloc) · x 803, y 390, 66 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S44 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 803, y 390, 22 × 15
              - « 26 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 831, y 390, 38 × 15
            - **box** (bloc) · x 942, y 390, 60 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - « S45 » — Geist Mono 12 / 600, interligne 1,2, couleur `mfg` — x 942, y 390, 22 × 15
              - « 2 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 970, y 390, 32 × 15
            - **today** (bloc) · x 604,4, y 405, 2 × 162 · fond `fg`
            - **box** (bloc) · x 265, y 411, 806 × 1 · fond `soft`
            - **box** (bloc) · x 281, y 419, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 419, 15 × 15
              - « Saisir un tronçon hors ligne » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 419, 156 × 15
            - **box** (bloc) · x 525, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 573,8, y 421, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 598,2, y 421, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 622,6, y 421, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 441, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 449, 206 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 449, 15 × 15
              - « Envoyer les photos d'un tronçon » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 449, 183 × 15
            - **box** (bloc) · x 767,6, y 449, 92 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
              - icône `clockAlert` 12 px, `red` — x 767,6, y 450,5, 12 × 12
              - « glisse en S43 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 783,6, y 449, 76 × 15
            - **box** (bloc) · x 525, y 451, 21,4 × 12 · fond `fg` · rayon 2
            - **box** (bloc) · x 549,4, y 451, 21,4 × 12 · fond `purple` · rayon 2
            - **box** (bloc) · x 573,8, y 451, 21,4 × 12 · fond `blue` · rayon 2
            - **box** (bloc) · x 598,2, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 622,6, y 451, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 664, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 688,4, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 712,8, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 737,2, y 451, 21,4 × 12 · fond `redSoft` · bordure 1 `red` · rayon 2
            - **box** (bloc) · x 281, y 471, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start
              - **pill** (bloc) · x 803, y 478, 108 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `lock` 12 px, `red` — x 811, y 481,5, 12 × 12
                - « bloquée · Q14 » — Geist 12 / 500, interligne 1,2, couleur `red` — x 828, y 480, 75 × 15
            - **box** (bloc) · x 281, y 479, 191 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 479, 15 × 15
              - « Importer les ISO depuis Excel » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 479, 168 × 15
            - **box** (bloc) · x 664, y 481, 27,5 × 12 · fond `red` · rayon 2
            - **box** (bloc) · x 694,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 481, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 501, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 509, 179 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F8 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 509, 15 × 15
              - « Valider les soudures par lot » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 509, 156 × 15
            - **box** (bloc) · x 664, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 694,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 725, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 755,5, y 511, 27,5 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 281, y 531, 790 × 1 · fond `soft (60 %)`
            - **box** (bloc) · x 281, y 539, 193 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - « F7 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 539, 15 × 15
              - « Rapport de chantier journalier » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 304, y 539, 170 × 15
            - **box** (bloc) · x 803, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 827,4, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 851,8, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 876,2, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 900,6, y 541, 21,4 × 12 · fond `border` · rayon 2
            - **box** (bloc) · x 610,4, y 543, 76 × 17 · flex ligne, espacement 0, marges internes 1 6 1 6, alignement center/start · fond `primary` · rayon 4
              - « aujourd'hui » — Geist 12 / 600, interligne 1,2, couleur `pfg` — x 616,4, y 544, 64 × 15
          - **line** (bloc) · x 265, y 567, 810 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 265, y 568, 810 × 35 · flex ligne, espacement 16, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
            - **box** (bloc) · x 281, y 578, 82 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 281, y 580,5, 12 × 10 · fond `fg` · rayon 2 · dimension fixe/fixe
              - « étape livrée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 299, y 578, 64 × 15
            - **box** (bloc) · x 379, y 578, 71 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 379, y 580,5, 12 × 10 · fond `purple` · rayon 2 · dimension fixe/fixe
              - « en review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 397, y 578, 53 × 15
            - **box** (bloc) · x 466, y 578, 65 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 466, y 580,5, 12 × 10 · fond `blue` · rayon 2 · dimension fixe/fixe
              - « en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 484, y 578, 47 × 15
            - **box** (bloc) · x 547, y 578, 63 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 547, y 580,5, 12 × 10 · fond `red` · rayon 2 · dimension fixe/fixe
              - « bloquée » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 565, y 578, 45 × 15
            - **box** (bloc) · x 626, y 578, 53 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 626, y 580,5, 12 × 10 · fond `border` · rayon 2 · dimension fixe/fixe
              - « à faire » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 644, y 578, 35 × 15
            - **box** (bloc) · x 695, y 578, 112 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
              - **box** (bloc) · x 695, y 580,5, 12 × 10 · fond `redSoft` · bordure 1 `red` · rayon 2 · dimension fixe/fixe
              - « glissement prévu » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 713, y 578, 94 × 15
        - **box** (bloc) · x 265, y 617, 810 × 602 · flex ligne, espacement 16, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 617, 494 × 602 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension remplit/auto
            - **card / Sprint S42 · Terrain hors ligne** (bloc) · x 265, y 617, 494 × 197 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 617, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `sprint` 15 px, `mfg` — x 281, y 631,5, 15 × 15
                - « Sprint S42 · Terrain hors ligne » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 630,5, 197 × 17
                - « 12–16 oct. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 589, y 631,5, 57 × 15
                - **pill** (bloc) · x 654, y 629,5, 89 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `amberSoft` · rayon 10
                  - « 2/2 ouvertes » — Geist 12 / 500, interligne 1,2, couleur `amber` — x 662, y 631,5, 73 × 15
              - **line** (bloc) · x 265, y 661, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 662, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 673,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 673,5, 15 × 15
                - **box** (bloc) · x 317, y 673, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 317, y 673, 108 × 16
                - **box** (bloc) · x 541, y 671,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 671,5, 64 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `greenSoft` · rayon 10
                    - icône `circleCheck` 12 px, `green` — x 549, y 675, 12 × 12
                    - « livrée » — Geist 12 / 500, interligne 1,2, couleur `green` — x 566, y 673,5, 31 × 15
                - **box** (bloc) · x 637, y 677, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 677, 49 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 677, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 673,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 4/4 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 720, y 673,5, 23 × 15
              - **line** (bloc) · x 265, y 700, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 701, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 712,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 712,5, 15 × 15
                - **box** (bloc) · x 317, y 712, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 712, 167 × 16
                - **box** (bloc) · x 541, y 710,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 710,5, 59 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `blueSoft` · rayon 10
                    - « ouverte » — Geist 12 / 500, interligne 1,2, couleur `blue` — x 549, y 712,5, 43 × 15
                - **box** (bloc) · x 637, y 716, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 716, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 716, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 716, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 716, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 712,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 712,5, 23 × 15
              - **line** (bloc) · x 265, y 739, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 740, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 751,5, 26 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « F5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 751,5, 15 × 15
                - **box** (bloc) · x 317, y 751, 214 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 317, y 751, 195 × 16
                - **box** (bloc) · x 541, y 749,5, 86 × 19 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **pill** (bloc) · x 541, y 749,5, 84 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                    - icône `clockAlert` 12 px, `red` — x 549, y 753, 12 × 12
                    - « en retard » — Geist 12 / 500, interligne 1,2, couleur `red` — x 566, y 751,5, 51 × 15
                - **box** (bloc) · x 637, y 755, 66 × 8 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - **segs** (bloc) · x 637, y 755, 62 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 637, y 755, 10 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 650, y 755, 10 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 755, 10 × 8 · fond `blue` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 676, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 689, y 755, 10 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                - **box** (bloc) · x 713, y 751,5, 30 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/end · dimension fixe/auto
                  - « 1/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 751,5, 23 × 15
              - **line** (bloc) · x 265, y 778, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 779, 494 × 35 · flex ligne, espacement 8, marges internes 10 16 10 16, alignement center/start · fond `panel` · dimension remplit/auto
                - icône `target` 13 px, `mfg` — x 281, y 790, 13 × 13
                - « Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 302, y 789, 441 × 15
            - **card / Prochaine à finir** (bloc) · x 265, y 828, 494 × 177 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 828, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `flag` 15 px, `mfg` — x 281, y 842,5, 15 × 15
                - « Prochaine à finir » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 841,5, 110 × 17
                - « la plus avancée du sprint » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 601, y 842,5, 142 × 15
              - **box** (bloc) · x 265, y 872, 494 × 133 · flex colonne, espacement 10, marges internes 2 16 14 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 281, y 874, 462 × 18 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/auto
                  - « F4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 875,5, 15 × 15
                  - « Saisir un tronçon hors ligne » — Geist 15 / 600, interligne 1,2, couleur `fg` — x 306, y 874, 197 × 18
                  - **segs** (bloc) · x 588, y 879, 122 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                    - **seg** (bloc) · x 588, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 613, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 638, y 879, 22 × 8 · fond `fg` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 663, y 879, 22 × 8 · fond `purple` · rayon 1,5 · dimension fixe/fixe
                    - **seg** (bloc) · x 688, y 879, 22 × 8 · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - « 3/5 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 720, y 875,5, 23 × 15
                - **box** (bloc) · x 281, y 902, 462 × 38 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 281, y 902, 320 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **dot** (pastille) · x 281, y 906, 8 × 8 · fond `purple` · dimension fixe/fixe
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 902,5, 51 × 15
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 902, 102 × 16
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 466, y 902,5, 135 × 15
                  - **box** (bloc) · x 281, y 924, 147 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 281, y 928, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
                    - « EMIS-46 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 297, y 924,5, 51 × 15
                    - « Démo client » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 356, y 924, 72 × 16
                - **box** (bloc) · x 281, y 950, 462 × 41 · flex ligne, espacement 10, marges internes 8 10 8 12, alignement center/start · fond `muted` · rayon 8 · dimension remplit/auto
                  - « Étape suivante » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 293, y 963, 84 × 15
                  - « /full-delivery EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 387, y 963, 165 × 15
                  - **Button / outline** (bloc) · x 656, y 958, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
                    - icône `copy` 13 px, `fg` — x 666, y 964, 13 × 13
                    - « Copier » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 685, y 963, 38 × 15
            - **card / Activité** (bloc) · x 265, y 1019, 494 × 200 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 265, y 1019, 494 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `activity` 15 px, `mfg` — x 281, y 1033,5, 15 × 15
                - « Activité » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 304, y 1032,5, 53 × 17
                - **chip** (bloc) · x 627, y 1031,5, 27 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « git » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 633, y 1033,5, 15 × 15
                - **chip** (bloc) · x 662, y 1031,5, 81 × 19 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « full-delivery » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 668, y 1033,5, 69 × 15
              - **line** (bloc) · x 265, y 1063, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1064, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1075,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 15:04 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1075,5, 36 × 15
                - icône `pr` 14 px, `purple` — x 331, y 1076, 14 × 14
                - **box** (bloc) · x 355, y 1075, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #22 ouverte » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1075, 91 × 16
                - **box** (bloc) · x 633, y 1074,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1075,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1074,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1077, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1075,5, 15 × 15
              - **line** (bloc) · x 265, y 1102, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1103, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1114,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:51 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1114,5, 36 × 15
                - icône `flag` 14 px, `mfg` — x 331, y 1115, 14 × 14
                - **box** (bloc) · x 355, y 1114, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Étape 7 · Porte qualité » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1114, 130 × 16
                - **box** (bloc) · x 633, y 1113,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-33 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1114,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1113,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1116, 12 × 12
                    - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1114,5, 15 × 15
              - **line** (bloc) · x 265, y 1141, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1142, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1153,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:40 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1153,5, 36 × 15
                - icône `bot` 14 px, `brand` — x 331, y 1154, 14 × 14
                - **box** (bloc) · x 355, y 1153, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « Suivi mis à jour · lot n° 7 proposé » — Geist 13 / 400, interligne 1,2, couleur `brandText` — x 355, y 1153, 192 × 16
                - **box** (bloc) · x 633, y 1153,5, 110 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « Agent de projet » — Geist 12 / 400, interligne 1,2, couleur `brandText` — x 658, y 1153,5, 85 × 15
              - **line** (bloc) · x 265, y 1180, 494 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 265, y 1181, 494 × 38 · flex ligne, espacement 10, marges internes 10 16 10 16, alignement center/start · dimension remplit/fixe
                - **box** (bloc) · x 281, y 1192,5, 40 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
                  - « 14:36 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 281, y 1192,5, 36 × 15
                - icône `merge` 14 px, `green` — x 331, y 1193, 14 × 14
                - **box** (bloc) · x 355, y 1192, 268 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension remplit/auto
                  - « PR #18 fusionnée · F3 livrée » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 355, y 1192, 161 × 16
                - **box** (bloc) · x 633, y 1191,5, 110 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/end · dimension fixe/auto
                  - « EMIS-21 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 643, y 1192,5, 51 × 15
                  - **fchip** (bloc) · x 700, y 1191,5, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                    - icône `package` 12 px, `mfg` — x 706, y 1194, 12 × 12
                    - « F3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 722, y 1192,5, 15 × 15
          - **box** (bloc) · x 775, y 617, 300 × 534 · flex colonne, espacement 14, marges internes 0, alignement start/start · dimension fixe/auto
            - **card / En review** (bloc) · x 775, y 617, 300 × 273 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 617, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `pr` 15 px, `mfg` — x 791, y 631,5, 15 × 15
                - « En review » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 630,5, 65 × 17
                - **box** (bloc) · x 887, y 631,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 894, y 631,5, 8 × 15
              - **line** (bloc) · x 775, y 661, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 662, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 672, 15 × 15
                - **box** (bloc) · x 818, y 672, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 672, 179 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #22 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 672, 24 × 16
                    - « Route d'envoi des photos » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 672, 149 × 16
                  - **box** (bloc) · x 818, y 692, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-32 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 693, 51 × 15
                    - **fchip** (bloc) · x 875, y 692, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 694,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 693, 15 × 15
                  - **box** (bloc) · x 818, y 713, 61 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleCheck` 12 px, `green` — x 818, y 714,5, 12 × 12
                    - « CI verte » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 836, y 713, 43 × 15
              - **line** (bloc) · x 775, y 738, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 739, 300 × 76 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `amber` — x 791, y 749, 15 × 15
                - **box** (bloc) · x 818, y 749, 241 × 56 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 749, 132 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 749, 24 × 16
                    - « Conflits de saisie » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 749, 102 × 16
                  - **box** (bloc) · x 818, y 769, 100 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-45 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 770, 51 × 15
                    - **fchip** (bloc) · x 875, y 769, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 881, y 771,5, 12 × 12
                      - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 897, y 770, 15 × 15
                  - **box** (bloc) · x 818, y 790, 153 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - icône `circleX` 12 px, `red` — x 818, y 791,5, 12 × 12
                    - « changements demandés » — Geist 12 / 400, interligne 1,2, couleur `amber` — x 836, y 790, 135 × 15
              - **line** (bloc) · x 775, y 815, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 816, 300 × 74 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - icône `pr` 15 px, `purple` — x 791, y 826, 15 × 15
                - **box** (bloc) · x 818, y 826, 241 × 54 · flex colonne, espacement 4, marges internes 0, alignement start/start · dimension remplit/auto
                  - **box** (bloc) · x 818, y 826, 173 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « #23 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 818, y 826, 24 × 16
                    - « Passage à Expo SDK 54 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 848, y 826, 143 × 16
                  - **box** (bloc) · x 818, y 846, 51 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - « EMIS-61 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 818, y 846, 51 × 15
                  - **box** (bloc) · x 818, y 865, 79 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **ring** (pastille) · x 818, y 867, 11 × 11 · bordure 2 `amber` · dimension fixe/fixe
                    - « CI en cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 835, y 865, 62 × 15
            - **card / Questions** (bloc) · x 775, y 904, 300 × 247 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
              - **box** (bloc) · x 775, y 904, 300 × 44 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
                - icône `question` 15 px, `mfg` — x 791, y 918,5, 15 × 15
                - « Questions » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 814, y 917,5, 69 × 17
                - **box** (bloc) · x 891, y 918,5, 22 × 15 · flex ligne, espacement 0, marges internes 0 7 0 7, alignement center/start · fond `muted` · rayon 9
                  - « 3 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 898, y 918,5, 8 × 15
              - **line** (bloc) · x 775, y 948, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 949, 300 × 62 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 959, 268 × 42 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un ISO réaffecté garde-t-il ses photos ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 959, 268 × 18
                  - **box** (bloc) · x 791, y 982, 239 × 19 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 983, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 985,5, 12 × 12
                      - « F6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 984, 15 × 15
                    - « Q14 · Client · il y a 3 j » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 984, 111 × 15
                    - **pill** (bloc) · x 957, y 982, 73 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                      - « bloquante » — Geist 12 / 500, interligne 1,2, couleur `red` — x 965, y 984, 57 × 15
              - **line** (bloc) · x 775, y 1011, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1012, 300 × 60 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1022, 268 × 40 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1022, 268 × 18
                  - **box** (bloc) · x 791, y 1045, 147 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1045, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1047,5, 12 × 12
                      - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1046, 15 × 15
                    - « Q16 · Produit · hier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1046, 98 × 15
              - **line** (bloc) · x 775, y 1072, 300 × 1 · fond `soft` · dimension remplit/fixe
              - **box** (bloc) · x 775, y 1073, 300 × 78 · flex ligne, espacement 12, marges internes 10 16 10 16, alignement start/start · dimension remplit/auto
                - **box** (bloc) · x 791, y 1083, 268 × 58 · flex colonne, espacement 5, marges internes 0, alignement start/start · dimension remplit/auto
                  - « Un rapport par chef de chantier ou par affaire ? » — Geist 13 / 400, interligne 1,35, couleur `fg` — x 791, y 1083, 268 × 36
                  - **box** (bloc) · x 791, y 1124, 163 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
                    - **fchip** (bloc) · x 791, y 1124, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
                      - icône `package` 12 px, `mfg` — x 797, y 1126,5, 12 × 12
                      - « F7 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 813, y 1125, 15 × 15
                    - « Q17 · Client · il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 840, y 1125, 114 × 15
    - **vline** (bloc) · x 1099, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **agent-panel** (bloc) · x 1100, y 0, 340 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 1100, y 0, 340 × 60 · flex ligne, espacement 10, marges internes 0 18 0 18, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 1118, y 15, 30 × 30 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandSoft` · bordure 1 `brandLine` · rayon 15 · dimension fixe/fixe
          - icône `bot` 17 px, `brand` — x 1124,5, y 21,5, 17 × 17
        - **box** (bloc) · x 1158, y 13, 128 × 34 · flex colonne, espacement 2, marges internes 0, alignement start/start
          - « Agent de projet » — Geist 14 / 600, interligne 1,2, couleur `fg` — x 1158, y 13, 104 × 17
          - « Suivi à jour · il y a 4 min » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 32, 128 × 15
        - icône `more` 16 px, `mfg` — x 1380, y 22, 16 × 16
        - icône `x` 16 px, `mfg` — x 1406, y 22, 16 × 16
      - **line** (bloc) · x 1100, y 60, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 61, 340 × 149 · flex colonne, espacement 8, marges internes 18, alignement start/start · dimension remplit/auto
        - « Résumé du jour » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 79, 114 × 15
        - « F3 est livrée : 3 fonctionnalités sur 9. » — Geist 14 / 500, interligne 1,45, couleur `fg` — x 1118, y 102, 304 × 21
        - « S42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. » — Geist 13 / 400, interligne 1,55, couleur `mfg` — x 1118, y 131, 304 × 61
      - **line** (bloc) · x 1100, y 210, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 211, 340 × 368 · flex colonne, espacement 10, marges internes 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 229, 304 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « À valider » — Geist 12 / 600, interligne 1,2, couleur `mfg`, interlettrage 0,5, majuscules — x 1118, y 229, 66 × 15
        - **box** (bloc) · x 1118, y 254, 304 × 257 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 10 · dimension remplit/auto
          - **box** (bloc) · x 1118, y 254, 304 × 36 · flex ligne, espacement 8, marges internes 10 14 10 14, alignement center/start · fond `brandSoft` · dimension remplit/auto
            - « Lot n° 7 » — Geist 13 / 600, interligne 1,2, couleur `brandText` — x 1132, y 264, 47 × 16
            - « 3 actions » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1357, y 264,5, 51 × 15
          - **line** (bloc) · x 1118, y 290, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 291, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 302, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 304,5, 11 × 11
            - **box** (bloc) · x 1158, y 302, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Reporter F5 en S43 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 302, 250 × 16
              - « 4 étapes restantes, S42 finit aujourd'hui » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 321, 250 × 15
          - **line** (bloc) · x 1118, y 347, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 348, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 359, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 361,5, 11 × 11
            - **box** (bloc) · x 1158, y 359, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Planifier F9 en S44 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 359, 250 × 16
              - « seule fonctionnalité à planifier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 378, 250 × 15
          - **line** (bloc) · x 1118, y 404, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 405, 304 × 56 · flex ligne, espacement 10, marges internes 11 14 11 14, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 1132, y 416, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brandBtn` · rayon 4 · dimension fixe/fixe
              - icône `check` 11 px, `#FFFFFF` — x 1134,5, y 418,5, 11 × 11
            - **box** (bloc) · x 1158, y 416, 250 × 34 · flex colonne, espacement 3, marges internes 0, alignement start/start · dimension remplit/auto
              - « Relancer le client sur Q14 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1158, y 416, 250 × 16
              - « bloque F6, prévue en S43 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1158, y 435, 250 × 15
          - **line** (bloc) · x 1118, y 461, 304 × 1 · fond `soft` · dimension remplit/fixe
          - **box** (bloc) · x 1118, y 462, 304 × 49 · flex ligne, espacement 8, marges internes 12 14 12 14, alignement center/start · dimension remplit/auto
            - **Button / brand** (bloc) · x 1132, y 474, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `brandBtn` · rayon 6
              - « Valider (3) » — Geist 12 / 500, interligne 1,2, couleur `#FFFFFF` — x 1142, y 479, 57 × 15
            - **Button / outline** (bloc) · x 1217, y 474, 65 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
              - « Refuser » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1227, y 479, 45 × 15
        - **box** (bloc) · x 1118, y 521, 304 × 40 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement start/start · dimension remplit/auto
          - icône `refresh` 13 px, `mfg` — x 1118, y 525, 13 × 13
          - « Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides. » — Geist 12 / 400, interligne 1,5, couleur `mfg` — x 1139, y 525, 283 × 36
      - **line** (bloc) · x 1100, y 929, 340 × 1 · fond `soft` · dimension remplit/fixe
      - **box** (bloc) · x 1100, y 930, 340 × 70 · flex colonne, espacement 0, marges internes 14 18 14 18, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 1118, y 944, 304 × 42 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 8 · dimension remplit/fixe
          - « Demander à l'agent de projet… » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 1130, y 957, 179 × 16
          - icône `send` 15 px, `mfg` — x 1395, y 957,5, 15 × 15
  - **veil** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg (60 %)`
  - **dialog** (bloc) · x 460, y 169, 520 × 662 · flex colonne, espacement 18, marges internes 24, alignement start/start · fond `bg` · bordure 1 `border` · rayon 12
    - **box** (bloc) · x 484, y 193, 472 × 44 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
      - **box** (bloc) · x 484, y 193, 444 × 44 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
        - « Nouveau projet » — Geist 18 / 600, interligne 1,2, couleur `fg` — x 484, y 193, 132 × 22
        - « Un projet suivi : ses pages et ses sprints sont créés aussitôt. » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 484, y 221, 444 × 16
      - icône `x` 16 px, `mfg` — x 940, y 193, 16 × 16
    - **field / Nom** (bloc) · x 484, y 255, 472 × 58 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
      - **box** (bloc) · x 484, y 255, 29 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
        - « Nom » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 484, y 255, 29 × 16
      - **input** (bloc) · x 484, y 277, 472 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `mfg` · rayon 6 · dimension remplit/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 496, y 287, 29 × 16
    - **box** (bloc) · x 484, y 331, 472 × 81 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
      - **field / Clé** (bloc) · x 484, y 331, 190 × 81 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension fixe/auto
        - **box** (bloc) · x 484, y 331, 21 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - « Clé » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 484, y 331, 21 × 16
        - **input** (bloc) · x 484, y 353, 190 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
          - « EMIS » — Geist Mono 13 / 400, interligne 1,2, couleur `fg` — x 496, y 363, 32 × 16
        - « 2 à 6 lettres majuscules, unique. » — Geist 12 / 400, interligne 1,4, couleur `mfg` — x 484, y 395, 190 × 17
      - **field / Client** (bloc) · x 686, y 331, 270 × 81 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 686, y 331, 36 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - « Client » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 686, y 331, 36 × 16
        - **input** (bloc) · x 686, y 353, 270 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
          - « Emis SA » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 698, y 363, 49 × 16
        - « Facultatif. Destinataire des questions client. » — Geist 12 / 400, interligne 1,4, couleur `mfg` — x 686, y 395, 270 × 17
    - **box** (bloc) · x 484, y 430, 472 × 58 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
      - **field / Début du premier sprint** (bloc) · x 484, y 430, 310 × 58 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 484, y 430, 144 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - « Début du premier sprint » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 484, y 430, 144 × 16
        - **input** (bloc) · x 484, y 452, 310 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
          - « 19/10/2026 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 496, y 462, 71 × 16
          - icône `calendar` 14 px, `mfg` — x 768, y 463, 14 × 14
      - **field / Nombre de sprints** (bloc) · x 806, y 430, 150 × 58 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension fixe/auto
        - **box** (bloc) · x 806, y 430, 113 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - « Nombre de sprints » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 806, y 430, 113 × 16
        - **input** (bloc) · x 806, y 452, 150 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
          - « 6 » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 818, y 462, 8 × 16
          - **box** (bloc) · x 933, y 459, 11 × 22 · flex colonne, espacement 0, marges internes 0, alignement start/start
            - icône `chevUp` 11 px, `mfg` — x 933, y 459, 11 × 11
            - icône `chevDown` 11 px, `mfg` — x 933, y 470, 11 × 11
    - **field / Durée d'un sprint** (bloc) · x 484, y 506, 472 × 44 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
      - **box** (bloc) · x 484, y 506, 104 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
        - « Durée d'un sprint » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 484, y 506, 104 × 16
      - **box** (bloc) · x 484, y 528, 195 × 22 · flex ligne, espacement 20, marges internes 0, alignement center/start · dimension auto/fixe
        - **box** (bloc) · x 484, y 531, 83 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **radio** (bloc) · x 484, y 531, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · bordure 1,5 `fg` · rayon 8 · dimension fixe/fixe
            - **dot** (pastille) · x 488, y 535, 8 × 8 · fond `fg` · dimension fixe/fixe
          - « 1 semaine » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 508, y 531, 59 × 16
        - **box** (bloc) · x 587, y 531, 92 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **radio** (bloc) · x 587, y 531, 16 × 16 · flex ligne, espacement 0, marges internes 0, alignement center/center · bordure 1 `border` · rayon 8 · dimension fixe/fixe
          - « 2 semaines » — Geist 13 / 400, interligne 1,2, couleur `fg` — x 611, y 531, 68 × 16
    - **preview** (bloc) · x 484, y 568, 472 × 88 · flex colonne, espacement 10, marges internes 12 14 12 14, alignement start/start · fond `muted` · rayon 8 · dimension remplit/auto
      - **box** (bloc) · x 498, y 580, 444 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
        - icône `sprint` 14 px, `fg` — x 498, y 581, 14 × 14
        - « 6 sprints d'une semaine · du 19 oct. au 27 nov. 2026 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 520, y 580, 310 × 16
        - icône `chevUp` 14 px, `mfg` — x 928, y 581, 14 × 14
      - **box** (bloc) · x 498, y 606, 444 × 38 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
        - **box** (bloc) · x 498, y 606, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S1 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 498, y 606, 15 × 15
          - « 19–23 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 521, y 606, 57 × 15
        - **box** (bloc) · x 498, y 629, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S4 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 498, y 629, 15 × 15
          - « 9–13 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 521, y 629, 51 × 15
        - **box** (bloc) · x 647, y 606, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S2 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 647, y 606, 15 × 15
          - « 26–30 oct. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 670, y 606, 61 × 15
        - **box** (bloc) · x 647, y 629, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S5 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 647, y 629, 15 × 15
          - « 16–20 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 670, y 629, 59 × 15
        - **box** (bloc) · x 796, y 606, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S3 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 796, y 606, 15 × 15
          - « 2–6 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 819, y 606, 47 × 15
        - **box** (bloc) · x 796, y 629, 141 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension fixe/auto
          - « S6 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 796, y 629, 15 × 15
          - « 23–27 nov. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 819, y 629, 60 × 15
    - **field / Dossier du dépôt** (bloc) · x 484, y 674, 472 × 81 · flex colonne, espacement 6, marges internes 0, alignement start/start · dimension remplit/auto
      - **box** (bloc) · x 484, y 674, 104 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start
        - « Dossier du dépôt » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 484, y 674, 104 × 16
      - **input** (bloc) · x 484, y 696, 472 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `folder` 14 px, `dim` — x 496, y 707, 14 × 14
        - « Aucun dossier » — Geist 13 / 400, interligne 1,2, couleur `dim` — x 518, y 706, 85 × 16
        - **Button / outline** (bloc) · x 877, y 703,5, 67 × 21 · flex ligne, espacement 6, marges internes 3 10 3 10, alignement center/center · bordure 1 `border` · rayon 6
          - « Choisir… » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 887, y 706,5, 47 × 15
      - « Facultatif. Sans dossier, pas de suivi git. » — Geist 12 / 400, interligne 1,4, couleur `mfg` — x 484, y 738, 472 × 17
    - **box** (bloc) · x 484, y 773, 472 × 34 · flex ligne, espacement 8, marges internes 4 0 0 0, alignement center/end · dimension remplit/auto
      - **Button / outline** (bloc) · x 810, y 777, 76 × 30 · flex ligne, espacement 6, marges internes 7 14 7 14, alignement center/center · bordure 1 `border` · rayon 6
        - « Annuler » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 824, y 784, 48 × 16
      - **Button / brand** (bloc) · x 894, y 777, 62 × 30 · flex ligne, espacement 6, marges internes 7 14 7 14, alignement center/center · fond `brandBtn` · rayon 6
        - « Créer » — Geist 13 / 500, interligne 1,2, couleur `#FFFFFF` — x 908, y 784, 34 × 16

## P7 · Kanban

Board `P7 · Kanban` (sombre) et `P7 · Kanban (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-kanban-dark.png` et `exports/proposition-kanban-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Kanban » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Tous » (x 269, y 65,5)
34. « 41 » (x 303, y 66)
35. « Sprint courant · S42 » (x 339, y 65,5)
36. « 15 » (x 462, y 66)
37. « À reprendre » (x 516, y 65,5)
38. « 1 » (x 591, y 66)
39. « Étiquette : toutes » (x 647, y 65,5)
40. « 41 tickets · Tous » (x 1338, y 65,5)
41. « Backlog » (x 280, y 124,5)
42. « 0 » (x 336, y 125)
43. « À faire » (x 477, y 124,5)
44. « 20 » (x 524, y 125)
45. « EMIS-46 » (x 470, y 164)
46. « · » (x 524, y 164)
47. « F4 » (x 532, y 164)
48. « Démo · F4 » (x 470, y 186)
49. « facultative » (x 476, y 212)
50. « EMIS-51 » (x 470, y 256)
51. « · » (x 524, y 256)
52. « F6 » (x 532, y 256)
53. « Lecture du fichier Excel » (x 470, y 278)
54. « bloqué · Q14 » (x 491, y 304)
55. « EMIS-34 » (x 470, y 348)
56. « · » (x 524, y 348)
57. « F5 » (x 532, y 348)
58. « Tests E2E de l'envoi » (x 470, y 370)
59. « attend EMIS-33 » (x 476, y 396)
60. « EMIS-35 » (x 470, y 440)
61. « · » (x 524, y 440)
62. « F5 » (x 532, y 440)
63. « Démo · F5 » (x 470, y 462)
64. « attend EMIS-34 » (x 476, y 488)
65. « EMIS-52 » (x 470, y 532)
66. « · » (x 524, y 532)
67. « F6 » (x 532, y 532)
68. « Contrôle des repères » (x 470, y 554)
69. « EMIS-53 » (x 470, y 598)
70. « · » (x 524, y 598)
71. « F6 » (x 532, y 598)
72. « Écran d'import » (x 470, y 620)
73. « EMIS-54 » (x 470, y 664)
74. « · » (x 524, y 664)
75. « F6 » (x 532, y 664)
76. « Démo · F6 » (x 470, y 686)
77. « EMIS-71 » (x 470, y 730)
78. « · » (x 524, y 730)
79. « F8 » (x 532, y 730)
80. « Statuts de soudure » (x 470, y 752)
81. « EMIS-72 » (x 470, y 796)
82. « · » (x 524, y 796)
83. « F8 » (x 532, y 796)
84. « Sélection multiple » (x 470, y 818)
85. « EMIS-73 » (x 470, y 862)
86. « · » (x 524, y 862)
87. « F8 » (x 532, y 862)
88. « Validation par lot » (x 470, y 884)
89. « EMIS-74 » (x 470, y 928)
90. « · » (x 524, y 928)
91. « F8 » (x 532, y 928)
92. « Démo · F8 » (x 470, y 950)
93. « En cours » (x 674, y 124,5)
94. « 1 » (x 733, y 125)
95. « EMIS-33 » (x 667, y 164)
96. « · » (x 721, y 164)
97. « F5 » (x 729, y 164)
98. « Écran d'envoi hors ligne » (x 667, y 186)
99. « 7 · Porte qualité » (x 673, y 212)
100. « En review » (x 871, y 124,5)
101. « 3 » (x 936, y 125)
102. « EMIS-45 » (x 864, y 164)
103. « · » (x 918, y 164)
104. « F4 » (x 926, y 164)
105. « Conflits de saisie » (x 864, y 186)
106. « #20 » (x 885, y 212)
107. « changements demandés » (x 870, y 235)
108. « CI cassée » (x 885, y 258)
109. « 9 · Review » (x 870, y 281)
110. « EMIS-32 » (x 864, y 325)
111. « · » (x 918, y 325)
112. « F5 » (x 926, y 325)
113. « Route d'envoi des photos » (x 864, y 347)
114. « #22 » (x 885, y 389)
115. « 10 · Démo » (x 870, y 412)
116. « CI » (x 937, y 389)
117. « EMIS-61 » (x 864, y 456)
118. « Passage à Expo SDK 54 » (x 864, y 478)
119. « #23 » (x 885, y 504)
120. « CI en cours » (x 935, y 504)
121. « Bloqué » (x 1068, y 124,5)
122. « 0 » (x 1117, y 125)
123. « Terminé » (x 1265, y 124,5)
124. « 17 » (x 1320, y 125)
125. « EMIS-21 » (x 1258, y 164)
126. « · » (x 1312, y 164)
127. « F3 » (x 1320, y 164)
128. « Démo · F3 » (x 1258, y 186)
129. « #18 » (x 1279, y 212)
130. « EMIS-31 » (x 1258, y 256)
131. « · » (x 1312, y 256)
132. « F5 » (x 1320, y 256)
133. « Stockage des photos sur MinIO » (x 1258, y 278)
134. « #19 » (x 1279, y 320)
135. « EMIS-43 » (x 1258, y 364)
136. « · » (x 1312, y 364)
137. « F4 » (x 1320, y 364)
138. « Synchro au retour du réseau » (x 1258, y 386)
139. « #16 » (x 1279, y 428)
140. « EMIS-42 » (x 1258, y 472)
141. « · » (x 1312, y 472)
142. « F4 » (x 1320, y 472)
143. « Formulaire de saisie » (x 1258, y 494)
144. « #14 » (x 1279, y 520)
145. « EMIS-41 » (x 1258, y 564)
146. « · » (x 1312, y 564)
147. « F4 » (x 1320, y 564)
148. « Schéma local des tronçons » (x 1258, y 586)
149. « #12 » (x 1279, y 628)
150. « EMIS-20 » (x 1258, y 672)
151. « · » (x 1312, y 672)
152. « F3 » (x 1320, y 672)
153. « Écran de réaffectation » (x 1258, y 694)
154. « EMIS-19 » (x 1258, y 738)
155. « · » (x 1312, y 738)
156. « F3 » (x 1320, y 738)
157. « Route de réaffectation » (x 1258, y 760)
158. « EMIS-18 » (x 1258, y 804)
159. « · » (x 1312, y 804)
160. « F3 » (x 1320, y 804)
161. « Historique des affectations » (x 1258, y 826)
162. « EMIS-14 » (x 1258, y 886)
163. « · » (x 1312, y 886)
164. « F2 » (x 1320, y 886)
165. « Démo · F2 » (x 1258, y 908)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P7 · Kanban** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `fg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 361, 47 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 115 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 47 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **toolbar** (bloc) · x 241, y 49, 1199 × 48 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
        - **filter** (bloc) · x 257, y 59,5, 353 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
          - **box** (bloc) · x 259, y 61,5, 68 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
            - « Tous » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 269, y 65,5, 28 × 15
            - « 41 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 303, y 66, 14 × 14
          - **box** (bloc) · x 329, y 61,5, 157 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Sprint courant · S42 » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 339, y 65,5, 117 × 15
            - « 15 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 462, y 66, 14 × 14
          - **box** (bloc) · x 488, y 61,5, 120 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - icône `rotate` 12 px, `mfg` — x 498, y 67, 12 × 12
            - « À reprendre » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 516, y 65,5, 69 × 15
            - « 1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 591, y 66, 7 × 14
        - **Button / outline** (bloc) · x 618, y 60,5, 136 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `tag` 13 px, `fg` — x 628, y 66,5, 13 × 13
          - « Étiquette : toutes » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 647, y 65,5, 97 × 15
        - « 41 tickets · Tous » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1338, y 65,5, 86 × 15
      - **line** (bloc) · x 241, y 97, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **columns** (bloc) · x 241, y 98, 1199 × 902 · dimension remplit/remplit
        - **columns-row** (bloc) · x 253, y 110, 1174 × 878 · flex ligne, espacement 8, marges internes 0, alignement stretch/start
          - **column Backlog** (bloc) · x 253, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 261, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 265, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « Backlog » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 280, y 124,5, 49 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 336, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 416, y 125, 14 × 14
          - **column À faire** (bloc) · x 450, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 458, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 462, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 477, y 124,5, 40 × 15
              - « 20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 524, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 613, y 125, 14 × 14
            - **card EMIS-46** (bloc) · x 458, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-46 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 164, 14 × 14
              - « Démo · F4 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 186, 149 × 16
              - **badges** (bloc) · x 470, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 210, 67 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` dashed · rayon 4
                  - « facultative » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 212, 55 × 14
            - **card EMIS-51** (bloc) · x 458, y 246, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-51 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 256, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 256, 14 × 14
              - « Lecture du fichier Excel » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 278, 149 × 16
              - **badges** (bloc) · x 470, y 302, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 302, 90 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `lock` 11 px, `red` — x 476, y 305,5, 11 × 11
                  - « bloqué · Q14 » — Geist 11 / 500, interligne 1,2, couleur `red` — x 491, y 304, 63 × 14
            - **card EMIS-34** (bloc) · x 458, y 338, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 348, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-34 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 348, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 348, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 348, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 348, 14 × 14
              - « Tests E2E de l'envoi » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 370, 149 × 16
              - **badges** (bloc) · x 470, y 394, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 394, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-33 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 396, 81 × 14
            - **card EMIS-35** (bloc) · x 458, y 430, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 440, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-35 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 440, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 440, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 440, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 440, 14 × 14
              - « Démo · F5 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 462, 149 × 16
              - **badges** (bloc) · x 470, y 486, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 486, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-34 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 488, 81 × 14
            - **card EMIS-52** (bloc) · x 458, y 522, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 532, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-52 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 532, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 532, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 532, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 532, 14 × 14
              - « Contrôle des repères » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 554, 149 × 16
            - **card EMIS-53** (bloc) · x 458, y 588, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 598, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-53 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 598, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 598, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 598, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 598, 14 × 14
              - « Écran d'import » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 620, 149 × 16
            - **card EMIS-54** (bloc) · x 458, y 654, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 664, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-54 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 664, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 664, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 664, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 664, 14 × 14
              - « Démo · F6 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 686, 149 × 16
            - **card EMIS-71** (bloc) · x 458, y 720, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 730, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-71 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 730, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 730, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 730, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 730, 14 × 14
              - « Statuts de soudure » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 752, 149 × 16
            - **card EMIS-72** (bloc) · x 458, y 786, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 796, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-72 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 796, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 796, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 796, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 796, 14 × 14
              - « Sélection multiple » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 818, 149 × 16
            - **card EMIS-73** (bloc) · x 458, y 852, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 862, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-73 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 862, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 862, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 862, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 862, 14 × 14
              - « Validation par lot » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 884, 149 × 16
            - **card EMIS-74** (bloc) · x 458, y 918, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 928, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-74 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 928, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 928, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 928, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 928, 14 × 14
              - « Démo · F8 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 950, 149 × 16
          - **column En cours** (bloc) · x 647, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 655, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 659, y 128, 8 × 8 · fond `blue` · dimension fixe/fixe
              - « En cours » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 674, y 124,5, 52 × 15
              - « 1 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 733, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 810, y 125, 14 × 14
            - **card EMIS-33** (bloc) · x 655, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 667, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 667, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 721, y 164, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 729, y 164, 14 × 14
                - **halo** (bloc) · x 785, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 788, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 802, y 164, 14 × 14
              - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 667, y 186, 149 × 16
              - **badges** (bloc) · x 667, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 667, y 210, 125 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 7 · Porte qualité » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 673, y 212, 113 × 14
          - **column En review** (bloc) · x 844, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 852, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 856, y 128, 8 × 8 · fond `purple` · dimension fixe/fixe
              - « En review » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 871, y 124,5, 58 × 15
              - « 3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 936, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1007, y 125, 14 × 14
            - **card EMIS-45** (bloc) · x 852, y 154, 173 × 153 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 164, 14 × 14
                - **halo** (bloc) · x 982, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 985, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 999, y 164, 14 × 14
              - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 186, 149 × 16
              - **badges** (bloc) · x 864, y 210, 149 × 87 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 213,5, 11 × 11
                  - « #20 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 212, 20 × 14
                - **badge** (bloc) · x 864, y 233, 139 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `amberSoft` · rayon 4
                  - « changements demandés » — Geist 11 / 500, interligne 1,2, couleur `amber` — x 870, y 235, 127 × 14
                - **badge** (bloc) · x 864, y 256, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `circleX` 11 px, `red` — x 870, y 259,5, 11 × 11
                  - « CI cassée » — Geist 11 / 500, interligne 1,2, couleur `red` — x 885, y 258, 51 × 14
                - **badge** (bloc) · x 864, y 279, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 9 · Review » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 870, y 281, 66 × 14
            - **card EMIS-32** (bloc) · x 852, y 315, 173 × 123 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 325, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-32 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 325, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 325, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 325, 14 × 14
                - icône `more` 14 px, `dim` — x 999, y 325, 14 × 14
              - « Route d'envoi des photos » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 347, 149 × 32
              - **badges** (bloc) · x 864, y 387, 149 × 41 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 387, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 390,5, 11 × 11
                  - « #22 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 389, 20 × 14
                - **badge** (bloc) · x 864, y 410, 72 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 10 · Démo » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 870, y 412, 60 × 14
                - **badge** (bloc) · x 916, y 387, 38 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `circleCheck` 11 px, `green` — x 922, y 390,5, 11 × 11
                  - « CI » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 937, y 389, 11 × 14
            - **card EMIS-61** (bloc) · x 852, y 446, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 456, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-61 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 456, 49 × 14
                - icône `more` 14 px, `dim` — x 999, y 456, 14 × 14
              - « Passage à Expo SDK 54 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 478, 149 × 16
              - **badges** (bloc) · x 864, y 502, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 502, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 505,5, 11 × 11
                  - « #23 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 504, 20 × 14
                - **badge** (bloc) · x 916, y 502, 83 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - **ring** (pastille) · x 922, y 506,5, 9 × 9 · bordure 2 `amber` · dimension fixe/fixe
                  - « CI en cours » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 935, y 504, 58 × 14
          - **column Bloqué** (bloc) · x 1041, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1049, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1053, y 128, 8 × 8 · fond `red` · dimension fixe/fixe
              - « Bloqué » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1068, y 124,5, 42 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1117, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1204, y 125, 14 × 14
          - **column Terminé** (bloc) · x 1238, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1246, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1250, y 128, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1265, y 124,5, 48 × 15
              - « 17 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1320, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 1401, y 125, 14 × 14
            - **card EMIS-21** (bloc) · x 1246, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-21 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 164, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 164, 14 × 14
              - « Démo · F3 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 186, 149 × 16
              - **badges** (bloc) · x 1258, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 213,5, 11 × 11
                  - « #18 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 212, 20 × 14
            - **card EMIS-31** (bloc) · x 1246, y 246, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-31 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 256, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 256, 14 × 14
              - « Stockage des photos sur MinIO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 278, 149 × 32
              - **badges** (bloc) · x 1258, y 318, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 318, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 321,5, 11 × 11
                  - « #19 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 320, 20 × 14
            - **card EMIS-43** (bloc) · x 1246, y 354, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 364, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-43 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 364, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 364, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 364, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 364, 14 × 14
              - « Synchro au retour du réseau » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 386, 149 × 32
              - **badges** (bloc) · x 1258, y 426, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 426, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 429,5, 11 × 11
                  - « #16 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 428, 20 × 14
            - **card EMIS-42** (bloc) · x 1246, y 462, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 472, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-42 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 472, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 472, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 472, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 472, 14 × 14
              - « Formulaire de saisie » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 494, 149 × 16
              - **badges** (bloc) · x 1258, y 518, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 518, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 521,5, 11 × 11
                  - « #14 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 520, 20 × 14
            - **card EMIS-41** (bloc) · x 1246, y 554, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 564, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-41 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 564, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 564, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 564, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 564, 14 × 14
              - « Schéma local des tronçons » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 586, 149 × 32
              - **badges** (bloc) · x 1258, y 626, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 626, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 629,5, 11 × 11
                  - « #12 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 628, 20 × 14
            - **card EMIS-20** (bloc) · x 1246, y 662, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 672, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 672, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 672, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 672, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 672, 14 × 14
              - « Écran de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 694, 149 × 16
            - **card EMIS-19** (bloc) · x 1246, y 728, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 738, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-19 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 738, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 738, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 738, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 738, 14 × 14
              - « Route de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 760, 149 × 16
            - **card EMIS-18** (bloc) · x 1246, y 794, 173 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 804, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-18 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 804, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 804, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 804, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 804, 14 × 14
              - « Historique des affectations » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 826, 149 × 32
            - **card EMIS-14** (bloc) · x 1246, y 876, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 886, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-14 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 886, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 886, 3 × 14
                - « F2 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 886, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 886, 14 × 14
              - « Démo · F2 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 908, 149 × 16
        - **scroll-shadow** (bloc) · x 450, y 940, 189 × 6,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 1238, y 940, 189 × 6,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 450, y 946, 189 × 6,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 1238, y 946, 189 × 6,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 450, y 952, 189 × 6,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 1238, y 952, 189 × 6,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 450, y 958, 189 × 6,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 1238, y 958, 189 × 6,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 450, y 964, 189 × 6,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 1238, y 964, 189 × 6,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 450, y 970, 189 × 6,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 1238, y 970, 189 × 6,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 450, y 976, 189 × 6,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 1238, y 976, 189 × 6,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 450, y 982, 189 × 6,5 · fond `panel (90 %)`
        - **scroll-shadow** (bloc) · x 1238, y 982, 189 × 6,5 · fond `panel (90 %)`

## P8 · Fiche ticket

Board `P8 · Fiche ticket` (sombre) et `P8 · Fiche ticket (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-fiche-ticket-dark.png` et `exports/proposition-fiche-ticket-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Kanban » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Tous » (x 269, y 65,5)
34. « 41 » (x 303, y 66)
35. « Sprint courant · S42 » (x 339, y 65,5)
36. « 15 » (x 462, y 66)
37. « À reprendre » (x 516, y 65,5)
38. « 1 » (x 591, y 66)
39. « Étiquette : toutes » (x 647, y 65,5)
40. « 41 tickets · Tous » (x 1338, y 65,5)
41. « Backlog » (x 280, y 124,5)
42. « 0 » (x 336, y 125)
43. « À faire » (x 477, y 124,5)
44. « 20 » (x 524, y 125)
45. « EMIS-46 » (x 470, y 164)
46. « · » (x 524, y 164)
47. « F4 » (x 532, y 164)
48. « Démo · F4 » (x 470, y 186)
49. « facultative » (x 476, y 212)
50. « EMIS-51 » (x 470, y 256)
51. « · » (x 524, y 256)
52. « F6 » (x 532, y 256)
53. « Lecture du fichier Excel » (x 470, y 278)
54. « bloqué · Q14 » (x 491, y 304)
55. « EMIS-34 » (x 470, y 348)
56. « · » (x 524, y 348)
57. « F5 » (x 532, y 348)
58. « Tests E2E de l'envoi » (x 470, y 370)
59. « attend EMIS-33 » (x 476, y 396)
60. « EMIS-35 » (x 470, y 440)
61. « · » (x 524, y 440)
62. « F5 » (x 532, y 440)
63. « Démo · F5 » (x 470, y 462)
64. « attend EMIS-34 » (x 476, y 488)
65. « EMIS-52 » (x 470, y 532)
66. « · » (x 524, y 532)
67. « F6 » (x 532, y 532)
68. « Contrôle des repères » (x 470, y 554)
69. « EMIS-53 » (x 470, y 598)
70. « · » (x 524, y 598)
71. « F6 » (x 532, y 598)
72. « Écran d'import » (x 470, y 620)
73. « EMIS-54 » (x 470, y 664)
74. « · » (x 524, y 664)
75. « F6 » (x 532, y 664)
76. « Démo · F6 » (x 470, y 686)
77. « EMIS-71 » (x 470, y 730)
78. « · » (x 524, y 730)
79. « F8 » (x 532, y 730)
80. « Statuts de soudure » (x 470, y 752)
81. « EMIS-72 » (x 470, y 796)
82. « · » (x 524, y 796)
83. « F8 » (x 532, y 796)
84. « Sélection multiple » (x 470, y 818)
85. « EMIS-73 » (x 470, y 862)
86. « · » (x 524, y 862)
87. « F8 » (x 532, y 862)
88. « Validation par lot » (x 470, y 884)
89. « EMIS-74 » (x 470, y 928)
90. « · » (x 524, y 928)
91. « F8 » (x 532, y 928)
92. « Démo · F8 » (x 470, y 950)
93. « En cours » (x 674, y 124,5)
94. « 1 » (x 733, y 125)
95. « EMIS-33 » (x 667, y 164)
96. « · » (x 721, y 164)
97. « F5 » (x 729, y 164)
98. « Écran d'envoi hors ligne » (x 667, y 186)
99. « 7 · Porte qualité » (x 673, y 212)
100. « En review » (x 871, y 124,5)
101. « 3 » (x 936, y 125)
102. « EMIS-45 » (x 864, y 164)
103. « · » (x 918, y 164)
104. « F4 » (x 926, y 164)
105. « Conflits de saisie » (x 864, y 186)
106. « #20 » (x 885, y 212)
107. « changements demandés » (x 870, y 235)
108. « CI cassée » (x 885, y 258)
109. « 9 · Review » (x 870, y 281)
110. « EMIS-32 » (x 864, y 325)
111. « · » (x 918, y 325)
112. « F5 » (x 926, y 325)
113. « Route d'envoi des photos » (x 864, y 347)
114. « #22 » (x 885, y 389)
115. « 10 · Démo » (x 870, y 412)
116. « CI » (x 937, y 389)
117. « EMIS-61 » (x 864, y 456)
118. « Passage à Expo SDK 54 » (x 864, y 478)
119. « #23 » (x 885, y 504)
120. « CI en cours » (x 935, y 504)
121. « Bloqué » (x 1068, y 124,5)
122. « 0 » (x 1117, y 125)
123. « Terminé » (x 1265, y 124,5)
124. « 17 » (x 1320, y 125)
125. « EMIS-21 » (x 1258, y 164)
126. « · » (x 1312, y 164)
127. « F3 » (x 1320, y 164)
128. « Démo · F3 » (x 1258, y 186)
129. « #18 » (x 1279, y 212)
130. « EMIS-31 » (x 1258, y 256)
131. « · » (x 1312, y 256)
132. « F5 » (x 1320, y 256)
133. « Stockage des photos sur MinIO » (x 1258, y 278)
134. « #19 » (x 1279, y 320)
135. « EMIS-43 » (x 1258, y 364)
136. « · » (x 1312, y 364)
137. « F4 » (x 1320, y 364)
138. « Synchro au retour du réseau » (x 1258, y 386)
139. « #16 » (x 1279, y 428)
140. « EMIS-42 » (x 1258, y 472)
141. « · » (x 1312, y 472)
142. « F4 » (x 1320, y 472)
143. « Formulaire de saisie » (x 1258, y 494)
144. « #14 » (x 1279, y 520)
145. « EMIS-41 » (x 1258, y 564)
146. « · » (x 1312, y 564)
147. « F4 » (x 1320, y 564)
148. « Schéma local des tronçons » (x 1258, y 586)
149. « #12 » (x 1279, y 628)
150. « EMIS-20 » (x 1258, y 672)
151. « · » (x 1312, y 672)
152. « F3 » (x 1320, y 672)
153. « Écran de réaffectation » (x 1258, y 694)
154. « EMIS-19 » (x 1258, y 738)
155. « · » (x 1312, y 738)
156. « F3 » (x 1320, y 738)
157. « Route de réaffectation » (x 1258, y 760)
158. « EMIS-18 » (x 1258, y 804)
159. « · » (x 1312, y 804)
160. « F3 » (x 1320, y 804)
161. « Historique des affectations » (x 1258, y 826)
162. « EMIS-14 » (x 1258, y 886)
163. « · » (x 1312, y 886)
164. « F2 » (x 1320, y 886)
165. « Démo · F2 » (x 1258, y 908)
166. « EMIS-45 » (x 926, y 18,5)
167. « Copier /full-delivery EMIS-45 » (x 1115, y 18,5)
168. « Fermer » (x 1374, y 18,5)
169. « F4 » (x 926, y 72)
170. « · » (x 953, y 72)
171. « S42 » (x 980, y 72)
172. « · » (x 1009, y 72)
173. « PR #20 » (x 1036, y 72)
174. « Conflits de saisie » (x 904, y 104)
175. « En review » (x 928, y 152,5)
176. « AB » (x 1028, y 155)
177. « Adam » (x 1050, y 152,5)
178. « PR #20 » (x 938, y 199)
179. « · » (x 993, y 199)
180. « changements demandés » (x 1004, y 199)
181. « · » (x 1162, y 199)
182. « CI cassée » (x 1173, y 199)
183. « PR » (x 1324, y 199,5)
184. « Job » (x 1365, y 199,5)
185. « Détails » (x 904, y 241)
186. « Activité » (x 966, y 241)
187. « Suivi » (x 904, y 298)
188. « remonté de git, des PR et de full-delivery » (x 943, y 298,5)
189. « Branche » (x 904, y 331,5)
190. « feat/emis-45 » (x 1029, y 331,5)
191. « sur » (x 1125, y 331,5)
192. « dev » (x 1150, y 331,5)
193. « PR » (x 904, y 371,5)
194. « #20 » (x 1029, y 371,5)
195. « ouverte hier à 16:40 » (x 1058, y 371,5)
196. « Review » (x 904, y 411,5)
197. « changements demandés » (x 1016, y 412)
198. « 13:47 » (x 1155, y 411,5)
199. « CI » (x 904, y 451,5)
200. « CI cassée » (x 1031, y 452)
201. « job e2e · 11:58 » (x 1094, y 451,5)
202. « Session » (x 904, y 491,5)
203. « T3 Code · 18 min » (x 1028, y 491,5)
204. « Étape » (x 904, y 531,5)
205. « 9 · Review » (x 1098, y 531,5)
206. « · suivante : 10 · Démo » (x 1162, y 531,5)
207. « Description » (x 904, y 587)
208. « Deux saisies hors ligne du même tronçon : garder la plus récente et signaler l'autre au chef de chantier au retour du réseau. » (x 904, y 613)
209. « Dépendances » (x 904, y 691,5)
210. « Ajouter » (x 1364, y 692)
211. « Dépendances : aucune » (x 904, y 722)
212. « Questions » (x 904, y 774,5)
213. « 0 » (x 976, y 775)
214. « Poser une question » (x 1298, y 775)
215. « Aucune question sur ce ticket. » (x 904, y 805)
216. « Domaine » (x 926, y 853)
217. « Aucun » (x 989, y 853,5)
218. « Maquettes » (x 926, y 885)
219. « 0 » (x 1001, y 885,5)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P8 · Fiche ticket** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `fg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 361, 47 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 115 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 47 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **toolbar** (bloc) · x 241, y 49, 1199 × 48 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
        - **filter** (bloc) · x 257, y 59,5, 353 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
          - **box** (bloc) · x 259, y 61,5, 68 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
            - « Tous » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 269, y 65,5, 28 × 15
            - « 41 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 303, y 66, 14 × 14
          - **box** (bloc) · x 329, y 61,5, 157 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Sprint courant · S42 » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 339, y 65,5, 117 × 15
            - « 15 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 462, y 66, 14 × 14
          - **box** (bloc) · x 488, y 61,5, 120 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - icône `rotate` 12 px, `mfg` — x 498, y 67, 12 × 12
            - « À reprendre » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 516, y 65,5, 69 × 15
            - « 1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 591, y 66, 7 × 14
        - **Button / outline** (bloc) · x 618, y 60,5, 136 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `tag` 13 px, `fg` — x 628, y 66,5, 13 × 13
          - « Étiquette : toutes » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 647, y 65,5, 97 × 15
        - « 41 tickets · Tous » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1338, y 65,5, 86 × 15
      - **line** (bloc) · x 241, y 97, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **columns** (bloc) · x 241, y 98, 1199 × 902 · dimension remplit/remplit
        - **columns-row** (bloc) · x 253, y 110, 1174 × 878 · flex ligne, espacement 8, marges internes 0, alignement stretch/start
          - **column Backlog** (bloc) · x 253, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 261, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 265, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « Backlog » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 280, y 124,5, 49 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 336, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 416, y 125, 14 × 14
          - **column À faire** (bloc) · x 450, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 458, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 462, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 477, y 124,5, 40 × 15
              - « 20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 524, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 613, y 125, 14 × 14
            - **card EMIS-46** (bloc) · x 458, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-46 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 164, 14 × 14
              - « Démo · F4 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 186, 149 × 16
              - **badges** (bloc) · x 470, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 210, 67 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` dashed · rayon 4
                  - « facultative » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 212, 55 × 14
            - **card EMIS-51** (bloc) · x 458, y 246, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-51 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 256, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 256, 14 × 14
              - « Lecture du fichier Excel » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 278, 149 × 16
              - **badges** (bloc) · x 470, y 302, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 302, 90 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `lock` 11 px, `red` — x 476, y 305,5, 11 × 11
                  - « bloqué · Q14 » — Geist 11 / 500, interligne 1,2, couleur `red` — x 491, y 304, 63 × 14
            - **card EMIS-34** (bloc) · x 458, y 338, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 348, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-34 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 348, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 348, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 348, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 348, 14 × 14
              - « Tests E2E de l'envoi » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 370, 149 × 16
              - **badges** (bloc) · x 470, y 394, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 394, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-33 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 396, 81 × 14
            - **card EMIS-35** (bloc) · x 458, y 430, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 440, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-35 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 440, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 440, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 440, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 440, 14 × 14
              - « Démo · F5 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 462, 149 × 16
              - **badges** (bloc) · x 470, y 486, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 486, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-34 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 488, 81 × 14
            - **card EMIS-52** (bloc) · x 458, y 522, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 532, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-52 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 532, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 532, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 532, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 532, 14 × 14
              - « Contrôle des repères » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 554, 149 × 16
            - **card EMIS-53** (bloc) · x 458, y 588, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 598, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-53 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 598, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 598, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 598, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 598, 14 × 14
              - « Écran d'import » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 620, 149 × 16
            - **card EMIS-54** (bloc) · x 458, y 654, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 664, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-54 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 664, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 664, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 664, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 664, 14 × 14
              - « Démo · F6 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 686, 149 × 16
            - **card EMIS-71** (bloc) · x 458, y 720, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 730, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-71 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 730, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 730, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 730, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 730, 14 × 14
              - « Statuts de soudure » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 752, 149 × 16
            - **card EMIS-72** (bloc) · x 458, y 786, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 796, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-72 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 796, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 796, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 796, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 796, 14 × 14
              - « Sélection multiple » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 818, 149 × 16
            - **card EMIS-73** (bloc) · x 458, y 852, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 862, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-73 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 862, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 862, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 862, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 862, 14 × 14
              - « Validation par lot » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 884, 149 × 16
            - **card EMIS-74** (bloc) · x 458, y 918, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 928, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-74 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 928, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 928, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 928, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 928, 14 × 14
              - « Démo · F8 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 950, 149 × 16
          - **column En cours** (bloc) · x 647, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 655, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 659, y 128, 8 × 8 · fond `blue` · dimension fixe/fixe
              - « En cours » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 674, y 124,5, 52 × 15
              - « 1 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 733, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 810, y 125, 14 × 14
            - **card EMIS-33** (bloc) · x 655, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 667, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 667, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 721, y 164, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 729, y 164, 14 × 14
                - **halo** (bloc) · x 785, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 788, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 802, y 164, 14 × 14
              - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 667, y 186, 149 × 16
              - **badges** (bloc) · x 667, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 667, y 210, 125 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 7 · Porte qualité » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 673, y 212, 113 × 14
          - **column En review** (bloc) · x 844, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 852, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 856, y 128, 8 × 8 · fond `purple` · dimension fixe/fixe
              - « En review » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 871, y 124,5, 58 × 15
              - « 3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 936, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1007, y 125, 14 × 14
            - **card EMIS-45** (bloc) · x 852, y 154, 173 × 153 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 164, 14 × 14
                - **halo** (bloc) · x 982, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 985, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 999, y 164, 14 × 14
              - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 186, 149 × 16
              - **badges** (bloc) · x 864, y 210, 149 × 87 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 213,5, 11 × 11
                  - « #20 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 212, 20 × 14
                - **badge** (bloc) · x 864, y 233, 139 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `amberSoft` · rayon 4
                  - « changements demandés » — Geist 11 / 500, interligne 1,2, couleur `amber` — x 870, y 235, 127 × 14
                - **badge** (bloc) · x 864, y 256, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `circleX` 11 px, `red` — x 870, y 259,5, 11 × 11
                  - « CI cassée » — Geist 11 / 500, interligne 1,2, couleur `red` — x 885, y 258, 51 × 14
                - **badge** (bloc) · x 864, y 279, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 9 · Review » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 870, y 281, 66 × 14
            - **card EMIS-32** (bloc) · x 852, y 315, 173 × 123 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 325, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-32 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 325, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 325, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 325, 14 × 14
                - icône `more` 14 px, `dim` — x 999, y 325, 14 × 14
              - « Route d'envoi des photos » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 347, 149 × 32
              - **badges** (bloc) · x 864, y 387, 149 × 41 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 387, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 390,5, 11 × 11
                  - « #22 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 389, 20 × 14
                - **badge** (bloc) · x 864, y 410, 72 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 10 · Démo » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 870, y 412, 60 × 14
                - **badge** (bloc) · x 916, y 387, 38 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `circleCheck` 11 px, `green` — x 922, y 390,5, 11 × 11
                  - « CI » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 937, y 389, 11 × 14
            - **card EMIS-61** (bloc) · x 852, y 446, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 456, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-61 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 456, 49 × 14
                - icône `more` 14 px, `dim` — x 999, y 456, 14 × 14
              - « Passage à Expo SDK 54 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 478, 149 × 16
              - **badges** (bloc) · x 864, y 502, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 502, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 505,5, 11 × 11
                  - « #23 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 504, 20 × 14
                - **badge** (bloc) · x 916, y 502, 83 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - **ring** (pastille) · x 922, y 506,5, 9 × 9 · bordure 2 `amber` · dimension fixe/fixe
                  - « CI en cours » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 935, y 504, 58 × 14
          - **column Bloqué** (bloc) · x 1041, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1049, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1053, y 128, 8 × 8 · fond `red` · dimension fixe/fixe
              - « Bloqué » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1068, y 124,5, 42 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1117, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1204, y 125, 14 × 14
          - **column Terminé** (bloc) · x 1238, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1246, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1250, y 128, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1265, y 124,5, 48 × 15
              - « 17 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1320, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 1401, y 125, 14 × 14
            - **card EMIS-21** (bloc) · x 1246, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-21 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 164, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 164, 14 × 14
              - « Démo · F3 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 186, 149 × 16
              - **badges** (bloc) · x 1258, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 213,5, 11 × 11
                  - « #18 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 212, 20 × 14
            - **card EMIS-31** (bloc) · x 1246, y 246, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-31 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 256, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 256, 14 × 14
              - « Stockage des photos sur MinIO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 278, 149 × 32
              - **badges** (bloc) · x 1258, y 318, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 318, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 321,5, 11 × 11
                  - « #19 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 320, 20 × 14
            - **card EMIS-43** (bloc) · x 1246, y 354, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 364, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-43 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 364, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 364, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 364, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 364, 14 × 14
              - « Synchro au retour du réseau » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 386, 149 × 32
              - **badges** (bloc) · x 1258, y 426, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 426, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 429,5, 11 × 11
                  - « #16 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 428, 20 × 14
            - **card EMIS-42** (bloc) · x 1246, y 462, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 472, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-42 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 472, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 472, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 472, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 472, 14 × 14
              - « Formulaire de saisie » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 494, 149 × 16
              - **badges** (bloc) · x 1258, y 518, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 518, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 521,5, 11 × 11
                  - « #14 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 520, 20 × 14
            - **card EMIS-41** (bloc) · x 1246, y 554, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 564, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-41 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 564, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 564, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 564, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 564, 14 × 14
              - « Schéma local des tronçons » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 586, 149 × 32
              - **badges** (bloc) · x 1258, y 626, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 626, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 629,5, 11 × 11
                  - « #12 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 628, 20 × 14
            - **card EMIS-20** (bloc) · x 1246, y 662, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 672, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 672, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 672, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 672, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 672, 14 × 14
              - « Écran de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 694, 149 × 16
            - **card EMIS-19** (bloc) · x 1246, y 728, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 738, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-19 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 738, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 738, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 738, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 738, 14 × 14
              - « Route de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 760, 149 × 16
            - **card EMIS-18** (bloc) · x 1246, y 794, 173 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 804, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-18 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 804, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 804, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 804, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 804, 14 × 14
              - « Historique des affectations » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 826, 149 × 32
            - **card EMIS-14** (bloc) · x 1246, y 876, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 886, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-14 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 886, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 886, 3 × 14
                - « F2 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 886, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 886, 14 × 14
              - « Démo · F2 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 908, 149 × 16
        - **scroll-shadow** (bloc) · x 241, y 158, 189 × 5,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 241, y 158, 189 × 5,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 241, y 163, 189 × 5,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 241, y 163, 189 × 5,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 241, y 168, 189 × 5,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 241, y 168, 189 × 5,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 241, y 173, 189 × 5,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 241, y 173, 189 × 5,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 241, y 178, 189 × 5,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 241, y 178, 189 × 5,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 241, y 183, 189 × 5,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 241, y 183, 189 × 5,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 241, y 188, 189 × 5,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 241, y 188, 189 × 5,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 241, y 193, 189 × 5,5 · fond `panel (90 %)`
        - **scroll-shadow** (bloc) · x 241, y 193, 189 × 5,5 · fond `panel (90 %)`
  - **veil** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg (60 %)`
  - **sheet** (bloc) · x 880, y 0, 560 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `bg` · bordure 1 `border`
    - **box** (bloc) · x 880, y 0, 560 × 52 · flex ligne, espacement 8, marges internes 0 16 0 24, alignement center/start · dimension remplit/fixe
      - icône `ticket` 14 px, `mfg` — x 904, y 19, 14 × 14
      - « EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 18,5, 53 × 15
      - **Button / outline** (bloc) · x 1086, y 13,5, 205 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
        - icône `copy` 13 px, `fg` — x 1096, y 19,5, 13 × 13
        - « Copier /full-delivery EMIS-45 » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1115, y 18,5, 166 × 15
      - icône `link` 15 px, `mfg` — x 1299, y 18,5, 15 × 15
      - icône `more` 15 px, `mfg` — x 1322, y 18,5, 15 × 15
      - **Button / ghost** (bloc) · x 1345, y 13,5, 79 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · rayon 6
        - icône `x` 13 px, `mfg` — x 1355, y 19,5, 13 × 13
        - « Fermer » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 1374, y 18,5, 40 × 15
    - **line** (bloc) · x 880, y 52, 560 × 1 · fond `soft` · dimension remplit/fixe
    - **box** (bloc) · x 880, y 53, 560 × 947 · flex colonne, espacement 16, marges internes 18 24 18 24, alignement start/start · dimension remplit/remplit
      - **header-line** (bloc) · x 904, y 71, 177 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
        - **fchip** (bloc) · x 904, y 71, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
          - icône `package` 12 px, `mfg` — x 910, y 73,5, 12 × 12
          - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 926, y 72, 15 × 15
        - « · » — Geist 12,5 / 400, interligne 1,2, couleur `faint` — x 953, y 72, 3 × 15
        - icône `sprint` 12 px, `mfg` — x 962, y 73,5, 12 × 12
        - « S42 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 980, y 72, 23 × 15
        - « · » — Geist 12,5 / 400, interligne 1,2, couleur `faint` — x 1009, y 72, 3 × 15
        - icône `pr` 12 px, `purple` — x 1018, y 73,5, 12 × 12
        - « PR #20 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 1036, y 72, 45 × 15
      - « Conflits de saisie » — Geist 22 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 904, y 104, 176 × 27
      - **box** (bloc) · x 904, y 147, 190 × 26 · flex ligne, espacement 8, marges internes 0, alignement center/start
        - **box** (bloc) · x 904, y 148,5, 108 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · bordure 1 `border` · rayon 6
          - **dot** (pastille) · x 914, y 156, 8 × 8 · fond `purple` · dimension fixe/fixe
          - « En review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 928, y 152,5, 56 × 15
          - icône `chevDown` 12 px, `dim` — x 990, y 154, 12 × 12
        - **box** (bloc) · x 1020, y 147, 74 × 26 · flex ligne, espacement 6, marges internes 3 10 3 4, alignement center/start · bordure 1 `border` · rayon 6
          - **avatar** (bloc) · x 1024, y 150, 20 × 20 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 10 · dimension fixe/fixe
            - « AB » — Geist 8 / 600, interligne 1,2, couleur `fg` — x 1028, y 155, 12 × 10
          - « Adam » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1050, y 152,5, 34 × 15
      - **tracking-banner** (bloc) · x 904, y 189, 512 × 36 · flex ligne, espacement 8, marges internes 10 12 10 12, alignement center/start · fond `amberSoft` · bordure 1 `border` · rayon 8 · dimension remplit/auto
        - icône `pr` 14 px, `amber` — x 916, y 200, 14 × 14
        - « PR #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 938, y 199, 47 × 16
        - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 993, y 199, 3 × 16
        - « changements demandés » — Geist 13 / 500, interligne 1,2, couleur `amber` — x 1004, y 199, 150 × 16
        - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 1162, y 199, 3 × 16
        - « CI cassée » — Geist 13 / 500, interligne 1,2, couleur `red` — x 1173, y 199, 60 × 16
        - **box** (bloc) · x 1324, y 199,5, 33 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
          - « PR » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1324, y 199,5, 17 × 15
          - icône `external` 12 px, `mfg` — x 1345, y 201, 12 × 12
        - **box** (bloc) · x 1365, y 199,5, 39 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
          - « Job » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1365, y 199,5, 23 × 15
          - icône `external` 12 px, `mfg` — x 1392, y 201, 12 × 12
      - **tabs** (bloc) · x 904, y 241, 512 × 24 · flex ligne, espacement 18, marges internes 0, alignement center/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 241, 44 × 24 · flex colonne, espacement 6, marges internes 0, alignement start/start
          - « Détails » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 241, 44 × 16
          - **box** (bloc) · x 904, y 263, 44 × 2 · fond `fg` · dimension remplit/fixe
        - **box** (bloc) · x 966, y 241, 45 × 24 · flex colonne, espacement 6, marges internes 0, alignement start/start
          - « Activité » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 966, y 241, 45 × 16
      - **line** (bloc) · x 904, y 281, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Suivi** (bloc) · x 904, y 298, 512 × 256 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 298, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « Suivi » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 298, 31 × 16
          - « remonté de git, des PR et de full-delivery » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 943, y 298,5, 233 × 15
        - **box** (bloc) · x 904, y 324, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 331,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « Branche » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 331,5, 48 × 15
          - **box** (bloc) · x 1010, y 331,5, 406 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - icône `branch` 13 px, `blue` — x 1010, y 332,5, 13 × 13
            - « feat/emis-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 1029, y 331,5, 90 × 15
            - « sur » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1125, y 331,5, 19 × 15
            - « dev » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 1150, y 331,5, 23 × 15
        - **box** (bloc) · x 904, y 364, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 371,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « PR » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 371,5, 17 × 15
          - **box** (bloc) · x 1010, y 371,5, 406 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - icône `pr` 13 px, `purple` — x 1010, y 372,5, 13 × 13
            - « #20 » — Geist Mono 12,5 / 500, interligne 1,2, couleur `fg` — x 1029, y 371,5, 23 × 15
            - « ouverte hier à 16:40 » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1058, y 371,5, 113 × 15
        - **box** (bloc) · x 904, y 404, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 411,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « Review » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 411,5, 42 × 15
          - **box** (bloc) · x 1010, y 410, 406 × 18 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - **badge** (bloc) · x 1010, y 410, 139 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `amberSoft` · rayon 4
              - « changements demandés » — Geist 11 / 500, interligne 1,2, couleur `amber` — x 1016, y 412, 127 × 14
            - « 13:47 » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1155, y 411,5, 30 × 15
        - **box** (bloc) · x 904, y 444, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 451,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « CI » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 451,5, 13 × 15
          - **box** (bloc) · x 1010, y 450, 406 × 18 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - **badge** (bloc) · x 1010, y 450, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
              - icône `circleX` 11 px, `red` — x 1016, y 453,5, 11 × 11
              - « CI cassée » — Geist 11 / 500, interligne 1,2, couleur `red` — x 1031, y 452, 51 × 14
            - « job e2e · 11:58 » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1094, y 451,5, 80 × 15
        - **box** (bloc) · x 904, y 484, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 491,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « Session » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 491,5, 46 × 15
          - **box** (bloc) · x 1010, y 491,5, 406 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - **halo** (bloc) · x 1010, y 493, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
              - **dot** (pastille) · x 1013, y 496, 6 × 6 · fond `brand` · dimension fixe/fixe
            - « T3 Code · 18 min » — Geist 12,5 / 500, interligne 1,2, couleur `brandText` — x 1028, y 491,5, 95 × 15
        - **box** (bloc) · x 904, y 524, 512 × 30 · flex ligne, espacement 10, marges internes 0, alignement center/start · dimension remplit/fixe
          - **box** (bloc) · x 904, y 531,5, 96 × 15 · flex ligne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
            - « Étape » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 531,5, 33 × 15
          - **box** (bloc) · x 1010, y 531,5, 406 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - **segs** (bloc) · x 1010, y 533, 82 × 12 · flex ligne, espacement 2, marges internes 0, alignement center/start
              - **seg** (bloc) · x 1010, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1017, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1024, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1031, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1038, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1045, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1052, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1059, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1066, y 533, 5 × 12 · fond `mfg` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1073, y 533, 5 × 12 · fond `brand` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1080, y 533, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
              - **seg** (bloc) · x 1087, y 533, 5 × 12 · fond `border` · rayon 1 · dimension fixe/fixe
            - « 9 · Review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1098, y 531,5, 58 × 15
            - « · suivante : 10 · Démo » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1162, y 531,5, 120 × 15
      - **line** (bloc) · x 904, y 570, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Description** (bloc) · x 904, y 587, 512 × 67 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 587, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « Description » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 587, 72 × 16
        - « Deux saisies hors ligne du même tronçon : garder la plus récente et signaler l'autre au chef de chantier au retour du réseau. » — Geist 13 / 400, interligne 1,55, couleur `fg` — x 904, y 613, 512 × 41
      - **line** (bloc) · x 904, y 670, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Dépendances** (bloc) · x 904, y 687, 512 × 50 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 687, 512 × 25 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « Dépendances » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 691,5, 86 × 16
          - **Button / ghost** (bloc) · x 1335, y 687, 81 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · rayon 6
            - icône `plus` 13 px, `mfg` — x 1345, y 693, 13 × 13
            - « Ajouter » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 1364, y 692, 42 × 15
        - « Dépendances : aucune » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 722, 131 × 15
      - **line** (bloc) · x 904, y 753, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Questions** (bloc) · x 904, y 770, 512 × 50 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 770, 512 × 25 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « Questions » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 774,5, 64 × 16
          - « 0 » — Geist Mono 12 / 400, interligne 1,2, couleur `dim` — x 976, y 775, 8 × 15
          - **Button / ghost** (bloc) · x 1269, y 770, 147 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · rayon 6
            - icône `plus` 13 px, `mfg` — x 1279, y 776, 13 × 13
            - « Poser une question » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 1298, y 775, 108 × 15
        - « Aucune question sur ce ticket. » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 904, y 805, 173 × 15
      - **line** (bloc) · x 904, y 836, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Domaine** (bloc) · x 904, y 853, 512 × 16 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 853, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - icône `chevRight` 14 px, `dim` — x 904, y 854, 14 × 14
          - « Domaine » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 926, y 853, 55 × 16
          - « Aucun » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 989, y 853,5, 37 × 15
      - **section / Maquettes** (bloc) · x 904, y 885, 512 × 16 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 885, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - icône `chevRight` 14 px, `dim` — x 904, y 886, 14 × 14
          - « Maquettes » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 926, y 885, 67 × 16
          - « 0 » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1001, y 885,5, 9 × 15

## P8b · Fiche ticket, Activité

Board `P8b · Fiche ticket, Activité` (sombre) et `P8b · Fiche ticket, Activité (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-fiche-ticket-activite-dark.png` et `exports/proposition-fiche-ticket-activite-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Kanban » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Tous » (x 269, y 65,5)
34. « 41 » (x 303, y 66)
35. « Sprint courant · S42 » (x 339, y 65,5)
36. « 15 » (x 462, y 66)
37. « À reprendre » (x 516, y 65,5)
38. « 1 » (x 591, y 66)
39. « Étiquette : toutes » (x 647, y 65,5)
40. « 41 tickets · Tous » (x 1338, y 65,5)
41. « Backlog » (x 280, y 124,5)
42. « 0 » (x 336, y 125)
43. « À faire » (x 477, y 124,5)
44. « 20 » (x 524, y 125)
45. « EMIS-46 » (x 470, y 164)
46. « · » (x 524, y 164)
47. « F4 » (x 532, y 164)
48. « Démo · F4 » (x 470, y 186)
49. « facultative » (x 476, y 212)
50. « EMIS-51 » (x 470, y 256)
51. « · » (x 524, y 256)
52. « F6 » (x 532, y 256)
53. « Lecture du fichier Excel » (x 470, y 278)
54. « bloqué · Q14 » (x 491, y 304)
55. « EMIS-34 » (x 470, y 348)
56. « · » (x 524, y 348)
57. « F5 » (x 532, y 348)
58. « Tests E2E de l'envoi » (x 470, y 370)
59. « attend EMIS-33 » (x 476, y 396)
60. « EMIS-35 » (x 470, y 440)
61. « · » (x 524, y 440)
62. « F5 » (x 532, y 440)
63. « Démo · F5 » (x 470, y 462)
64. « attend EMIS-34 » (x 476, y 488)
65. « EMIS-52 » (x 470, y 532)
66. « · » (x 524, y 532)
67. « F6 » (x 532, y 532)
68. « Contrôle des repères » (x 470, y 554)
69. « EMIS-53 » (x 470, y 598)
70. « · » (x 524, y 598)
71. « F6 » (x 532, y 598)
72. « Écran d'import » (x 470, y 620)
73. « EMIS-54 » (x 470, y 664)
74. « · » (x 524, y 664)
75. « F6 » (x 532, y 664)
76. « Démo · F6 » (x 470, y 686)
77. « EMIS-71 » (x 470, y 730)
78. « · » (x 524, y 730)
79. « F8 » (x 532, y 730)
80. « Statuts de soudure » (x 470, y 752)
81. « EMIS-72 » (x 470, y 796)
82. « · » (x 524, y 796)
83. « F8 » (x 532, y 796)
84. « Sélection multiple » (x 470, y 818)
85. « EMIS-73 » (x 470, y 862)
86. « · » (x 524, y 862)
87. « F8 » (x 532, y 862)
88. « Validation par lot » (x 470, y 884)
89. « EMIS-74 » (x 470, y 928)
90. « · » (x 524, y 928)
91. « F8 » (x 532, y 928)
92. « Démo · F8 » (x 470, y 950)
93. « En cours » (x 674, y 124,5)
94. « 1 » (x 733, y 125)
95. « EMIS-33 » (x 667, y 164)
96. « · » (x 721, y 164)
97. « F5 » (x 729, y 164)
98. « Écran d'envoi hors ligne » (x 667, y 186)
99. « 7 · Porte qualité » (x 673, y 212)
100. « En review » (x 871, y 124,5)
101. « 3 » (x 936, y 125)
102. « EMIS-45 » (x 864, y 164)
103. « · » (x 918, y 164)
104. « F4 » (x 926, y 164)
105. « Conflits de saisie » (x 864, y 186)
106. « #20 » (x 885, y 212)
107. « changements demandés » (x 870, y 235)
108. « CI cassée » (x 885, y 258)
109. « 9 · Review » (x 870, y 281)
110. « EMIS-32 » (x 864, y 325)
111. « · » (x 918, y 325)
112. « F5 » (x 926, y 325)
113. « Route d'envoi des photos » (x 864, y 347)
114. « #22 » (x 885, y 389)
115. « 10 · Démo » (x 870, y 412)
116. « CI » (x 937, y 389)
117. « EMIS-61 » (x 864, y 456)
118. « Passage à Expo SDK 54 » (x 864, y 478)
119. « #23 » (x 885, y 504)
120. « CI en cours » (x 935, y 504)
121. « Bloqué » (x 1068, y 124,5)
122. « 0 » (x 1117, y 125)
123. « Terminé » (x 1265, y 124,5)
124. « 17 » (x 1320, y 125)
125. « EMIS-21 » (x 1258, y 164)
126. « · » (x 1312, y 164)
127. « F3 » (x 1320, y 164)
128. « Démo · F3 » (x 1258, y 186)
129. « #18 » (x 1279, y 212)
130. « EMIS-31 » (x 1258, y 256)
131. « · » (x 1312, y 256)
132. « F5 » (x 1320, y 256)
133. « Stockage des photos sur MinIO » (x 1258, y 278)
134. « #19 » (x 1279, y 320)
135. « EMIS-43 » (x 1258, y 364)
136. « · » (x 1312, y 364)
137. « F4 » (x 1320, y 364)
138. « Synchro au retour du réseau » (x 1258, y 386)
139. « #16 » (x 1279, y 428)
140. « EMIS-42 » (x 1258, y 472)
141. « · » (x 1312, y 472)
142. « F4 » (x 1320, y 472)
143. « Formulaire de saisie » (x 1258, y 494)
144. « #14 » (x 1279, y 520)
145. « EMIS-41 » (x 1258, y 564)
146. « · » (x 1312, y 564)
147. « F4 » (x 1320, y 564)
148. « Schéma local des tronçons » (x 1258, y 586)
149. « #12 » (x 1279, y 628)
150. « EMIS-20 » (x 1258, y 672)
151. « · » (x 1312, y 672)
152. « F3 » (x 1320, y 672)
153. « Écran de réaffectation » (x 1258, y 694)
154. « EMIS-19 » (x 1258, y 738)
155. « · » (x 1312, y 738)
156. « F3 » (x 1320, y 738)
157. « Route de réaffectation » (x 1258, y 760)
158. « EMIS-18 » (x 1258, y 804)
159. « · » (x 1312, y 804)
160. « F3 » (x 1320, y 804)
161. « Historique des affectations » (x 1258, y 826)
162. « EMIS-14 » (x 1258, y 886)
163. « · » (x 1312, y 886)
164. « F2 » (x 1320, y 886)
165. « Démo · F2 » (x 1258, y 908)
166. « EMIS-45 » (x 926, y 18,5)
167. « Copier /full-delivery EMIS-45 » (x 1115, y 18,5)
168. « Fermer » (x 1374, y 18,5)
169. « F4 » (x 926, y 72)
170. « · » (x 953, y 72)
171. « S42 » (x 980, y 72)
172. « · » (x 1009, y 72)
173. « PR #20 » (x 1036, y 72)
174. « Conflits de saisie » (x 904, y 104)
175. « En review » (x 928, y 152,5)
176. « AB » (x 1028, y 155)
177. « Adam » (x 1050, y 152,5)
178. « PR #20 » (x 938, y 199)
179. « · » (x 993, y 199)
180. « changements demandés » (x 1004, y 199)
181. « · » (x 1162, y 199)
182. « CI cassée » (x 1173, y 199)
183. « PR » (x 1324, y 199,5)
184. « Job » (x 1365, y 199,5)
185. « Détails » (x 904, y 241)
186. « Activité » (x 964, y 241)
187. « Chronologie » (x 904, y 298)
188. « journal du ticket : branche, PR, étapes, sessions, statut » (x 988, y 298,5)
189. « Session T3 Code ouverte » (x 940, y 327)
190. « 14:34 » (x 1386, y 327,5)
191. « Changements demandés sur PR #20 » (x 940, y 361)
192. « 13:47 » (x 1387, y 361,5)
193. « CI cassée sur PR #20 » (x 940, y 395)
194. « 11:58 » (x 1388, y 395,5)
195. « job e2e · voir le journal » (x 940, y 414)
196. « Étape 9 · Review » (x 940, y 446)
197. « hier 17:12 » (x 1366, y 446,5)
198. « PR #20 ouverte » (x 940, y 480)
199. « hier 16:40 » (x 1361, y 480,5)
200. « statut ⇒ En review » (x 940, y 499)
201. « Branche feat/emis-45 poussée » (x 940, y 531)
202. « mer. 10:05 » (x 1358, y 531,5)
203. « statut ⇒ En cours » (x 940, y 550)
204. « Anciens runs » (x 926, y 612)
205. « runs d'agents d'avant la phase 27, en lecture seule » (x 1015, y 612,5)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P8b · Fiche ticket, Activité** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `fg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 361, 47 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `mfg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 457, 60 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 115 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Kanban » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 47 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **toolbar** (bloc) · x 241, y 49, 1199 × 48 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
        - **filter** (bloc) · x 257, y 59,5, 353 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
          - **box** (bloc) · x 259, y 61,5, 68 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
            - « Tous » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 269, y 65,5, 28 × 15
            - « 41 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 303, y 66, 14 × 14
          - **box** (bloc) · x 329, y 61,5, 157 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Sprint courant · S42 » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 339, y 65,5, 117 × 15
            - « 15 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 462, y 66, 14 × 14
          - **box** (bloc) · x 488, y 61,5, 120 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · rayon 5
            - icône `rotate` 12 px, `mfg` — x 498, y 67, 12 × 12
            - « À reprendre » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 516, y 65,5, 69 × 15
            - « 1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 591, y 66, 7 × 14
        - **Button / outline** (bloc) · x 618, y 60,5, 136 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `tag` 13 px, `fg` — x 628, y 66,5, 13 × 13
          - « Étiquette : toutes » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 647, y 65,5, 97 × 15
        - « 41 tickets · Tous » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1338, y 65,5, 86 × 15
      - **line** (bloc) · x 241, y 97, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **columns** (bloc) · x 241, y 98, 1199 × 902 · dimension remplit/remplit
        - **columns-row** (bloc) · x 253, y 110, 1174 × 878 · flex ligne, espacement 8, marges internes 0, alignement stretch/start
          - **column Backlog** (bloc) · x 253, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 261, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 265, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « Backlog » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 280, y 124,5, 49 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 336, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 416, y 125, 14 × 14
          - **column À faire** (bloc) · x 450, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 458, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **ring** (pastille) · x 462, y 128, 8 × 8 · bordure 1,5 `dim` · dimension fixe/fixe
              - « À faire » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 477, y 124,5, 40 × 15
              - « 20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 524, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 613, y 125, 14 × 14
            - **card EMIS-46** (bloc) · x 458, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-46 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 164, 14 × 14
              - « Démo · F4 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 186, 149 × 16
              - **badges** (bloc) · x 470, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 210, 67 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` dashed · rayon 4
                  - « facultative » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 212, 55 × 14
            - **card EMIS-51** (bloc) · x 458, y 246, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-51 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 256, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 256, 14 × 14
              - « Lecture du fichier Excel » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 278, 149 × 16
              - **badges** (bloc) · x 470, y 302, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 302, 90 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `lock` 11 px, `red` — x 476, y 305,5, 11 × 11
                  - « bloqué · Q14 » — Geist 11 / 500, interligne 1,2, couleur `red` — x 491, y 304, 63 × 14
            - **card EMIS-34** (bloc) · x 458, y 338, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 348, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-34 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 348, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 348, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 348, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 348, 14 × 14
              - « Tests E2E de l'envoi » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 370, 149 × 16
              - **badges** (bloc) · x 470, y 394, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 394, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-33 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 396, 81 × 14
            - **card EMIS-35** (bloc) · x 458, y 430, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 440, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-35 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 440, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 440, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 440, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 440, 14 × 14
              - « Démo · F5 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 462, 149 × 16
              - **badges** (bloc) · x 470, y 486, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 470, y 486, 93 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « attend EMIS-34 » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 476, y 488, 81 × 14
            - **card EMIS-52** (bloc) · x 458, y 522, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 532, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-52 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 532, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 532, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 532, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 532, 14 × 14
              - « Contrôle des repères » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 554, 149 × 16
            - **card EMIS-53** (bloc) · x 458, y 588, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 598, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-53 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 598, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 598, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 598, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 598, 14 × 14
              - « Écran d'import » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 620, 149 × 16
            - **card EMIS-54** (bloc) · x 458, y 654, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 664, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-54 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 664, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 664, 3 × 14
                - « F6 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 664, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 664, 14 × 14
              - « Démo · F6 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 686, 149 × 16
            - **card EMIS-71** (bloc) · x 458, y 720, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 730, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-71 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 730, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 730, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 730, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 730, 14 × 14
              - « Statuts de soudure » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 752, 149 × 16
            - **card EMIS-72** (bloc) · x 458, y 786, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 796, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-72 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 796, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 796, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 796, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 796, 14 × 14
              - « Sélection multiple » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 818, 149 × 16
            - **card EMIS-73** (bloc) · x 458, y 852, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 862, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-73 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 862, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 862, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 862, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 862, 14 × 14
              - « Validation par lot » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 884, 149 × 16
            - **card EMIS-74** (bloc) · x 458, y 918, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 470, y 928, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-74 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 470, y 928, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 524, y 928, 3 × 14
                - « F8 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 532, y 928, 14 × 14
                - icône `more` 14 px, `dim` — x 605, y 928, 14 × 14
              - « Démo · F8 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 470, y 950, 149 × 16
          - **column En cours** (bloc) · x 647, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 655, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 659, y 128, 8 × 8 · fond `blue` · dimension fixe/fixe
              - « En cours » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 674, y 124,5, 52 × 15
              - « 1 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 733, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 810, y 125, 14 × 14
            - **card EMIS-33** (bloc) · x 655, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 667, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-33 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 667, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 721, y 164, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 729, y 164, 14 × 14
                - **halo** (bloc) · x 785, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 788, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 802, y 164, 14 × 14
              - « Écran d'envoi hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 667, y 186, 149 × 16
              - **badges** (bloc) · x 667, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 667, y 210, 125 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 7 · Porte qualité » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 673, y 212, 113 × 14
          - **column En review** (bloc) · x 844, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 852, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 856, y 128, 8 × 8 · fond `purple` · dimension fixe/fixe
              - « En review » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 871, y 124,5, 58 × 15
              - « 3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 936, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1007, y 125, 14 × 14
            - **card EMIS-45** (bloc) · x 852, y 154, 173 × 153 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `brandLine` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-45 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 164, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 164, 14 × 14
                - **halo** (bloc) · x 982, y 165, 12 × 12 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `brand (22 %)` · rayon 6 · dimension fixe/fixe
                  - **dot** (pastille) · x 985, y 168, 6 × 6 · fond `brand` · dimension fixe/fixe
                - icône `more` 14 px, `dim` — x 999, y 164, 14 × 14
              - « Conflits de saisie » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 186, 149 × 16
              - **badges** (bloc) · x 864, y 210, 149 × 87 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 213,5, 11 × 11
                  - « #20 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 212, 20 × 14
                - **badge** (bloc) · x 864, y 233, 139 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `amberSoft` · rayon 4
                  - « changements demandés » — Geist 11 / 500, interligne 1,2, couleur `amber` — x 870, y 235, 127 × 14
                - **badge** (bloc) · x 864, y 256, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `circleX` 11 px, `red` — x 870, y 259,5, 11 × 11
                  - « CI cassée » — Geist 11 / 500, interligne 1,2, couleur `red` — x 885, y 258, 51 × 14
                - **badge** (bloc) · x 864, y 279, 78 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 9 · Review » — Geist Mono 11 / 500, interligne 1,2, couleur `brandText` — x 870, y 281, 66 × 14
            - **card EMIS-32** (bloc) · x 852, y 315, 173 × 123 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 325, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-32 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 325, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 918, y 325, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 325, 14 × 14
                - icône `more` 14 px, `dim` — x 999, y 325, 14 × 14
              - « Route d'envoi des photos » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 347, 149 × 32
              - **badges** (bloc) · x 864, y 387, 149 × 41 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 387, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 390,5, 11 × 11
                  - « #22 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 389, 20 × 14
                - **badge** (bloc) · x 864, y 410, 72 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - « 10 · Démo » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 870, y 412, 60 × 14
                - **badge** (bloc) · x 916, y 387, 38 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `circleCheck` 11 px, `green` — x 922, y 390,5, 11 × 11
                  - « CI » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 937, y 389, 11 × 14
            - **card EMIS-61** (bloc) · x 852, y 446, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 864, y 456, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-61 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 864, y 456, 49 × 14
                - icône `more` 14 px, `dim` — x 999, y 456, 14 × 14
              - « Passage à Expo SDK 54 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 864, y 478, 149 × 16
              - **badges** (bloc) · x 864, y 502, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 864, y 502, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `pr` 11 px, `purple` — x 870, y 505,5, 11 × 11
                  - « #23 » — Geist Mono 11 / 500, interligne 1,2, couleur `fg` — x 885, y 504, 20 × 14
                - **badge** (bloc) · x 916, y 502, 83 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - **ring** (pastille) · x 922, y 506,5, 9 × 9 · bordure 2 `amber` · dimension fixe/fixe
                  - « CI en cours » — Geist 11 / 500, interligne 1,2, couleur `mfg` — x 935, y 504, 58 × 14
          - **column Bloqué** (bloc) · x 1041, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1049, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1053, y 128, 8 × 8 · fond `red` · dimension fixe/fixe
              - « Bloqué » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1068, y 124,5, 42 × 15
              - « 0 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1117, y 125, 7 × 14
              - icône `plus` 14 px, `dim` — x 1204, y 125, 14 × 14
          - **column Terminé** (bloc) · x 1238, y 110, 189 × 878 · flex colonne, espacement 8, marges internes 8, alignement start/start · fond `panel` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1246, y 118, 173 × 28 · flex ligne, espacement 7, marges internes 0 4 0 4, alignement center/start · dimension remplit/fixe
              - **dot** (pastille) · x 1250, y 128, 8 × 8 · fond `green` · dimension fixe/fixe
              - « Terminé » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1265, y 124,5, 48 × 15
              - « 17 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `dim` — x 1320, y 125, 14 × 14
              - icône `plus` 14 px, `dim` — x 1401, y 125, 14 × 14
            - **card EMIS-21** (bloc) · x 1246, y 154, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 164, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-21 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 164, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 164, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 164, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 164, 14 × 14
              - « Démo · F3 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 186, 149 × 16
              - **badges** (bloc) · x 1258, y 210, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 210, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 213,5, 11 × 11
                  - « #18 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 212, 20 × 14
            - **card EMIS-31** (bloc) · x 1246, y 246, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 256, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-31 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 256, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 256, 3 × 14
                - « F5 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 256, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 256, 14 × 14
              - « Stockage des photos sur MinIO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 278, 149 × 32
              - **badges** (bloc) · x 1258, y 318, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 318, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 321,5, 11 × 11
                  - « #19 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 320, 20 × 14
            - **card EMIS-43** (bloc) · x 1246, y 354, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 364, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-43 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 364, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 364, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 364, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 364, 14 × 14
              - « Synchro au retour du réseau » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 386, 149 × 32
              - **badges** (bloc) · x 1258, y 426, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 426, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 429,5, 11 × 11
                  - « #16 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 428, 20 × 14
            - **card EMIS-42** (bloc) · x 1246, y 462, 173 × 84 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 472, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-42 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 472, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 472, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 472, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 472, 14 × 14
              - « Formulaire de saisie » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 494, 149 × 16
              - **badges** (bloc) · x 1258, y 518, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 518, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 521,5, 11 × 11
                  - « #14 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 520, 20 × 14
            - **card EMIS-41** (bloc) · x 1246, y 554, 173 × 100 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 564, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-41 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 564, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 564, 3 × 14
                - « F4 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 564, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 564, 14 × 14
              - « Schéma local des tronçons » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 586, 149 × 32
              - **badges** (bloc) · x 1258, y 626, 149 × 18 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - **badge** (bloc) · x 1258, y 626, 47 × 18 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · bordure 1 `border` · rayon 4
                  - icône `merge` 11 px, `green` — x 1264, y 629,5, 11 × 11
                  - « #12 » — Geist Mono 11 / 500, interligne 1,2, couleur `mfg` — x 1279, y 628, 20 × 14
            - **card EMIS-20** (bloc) · x 1246, y 662, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 672, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-20 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 672, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 672, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 672, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 672, 14 × 14
              - « Écran de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 694, 149 × 16
            - **card EMIS-19** (bloc) · x 1246, y 728, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 738, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-19 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 738, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 738, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 738, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 738, 14 × 14
              - « Route de réaffectation » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 760, 149 × 16
            - **card EMIS-18** (bloc) · x 1246, y 794, 173 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 804, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-18 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 804, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 804, 3 × 14
                - « F3 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 804, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 804, 14 × 14
              - « Historique des affectations » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 826, 149 × 32
            - **card EMIS-14** (bloc) · x 1246, y 876, 173 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1258, y 886, 149 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start · dimension remplit/auto
                - « EMIS-14 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1258, y 886, 49 × 14
                - « · » — Geist 11,5 / 400, interligne 1,2, couleur `faint` — x 1312, y 886, 3 × 14
                - « F2 » — Geist Mono 11,5 / 400, interligne 1,2, couleur `mfg` — x 1320, y 886, 14 × 14
                - icône `more` 14 px, `dim` — x 1393, y 886, 14 × 14
              - « Démo · F2 » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 1258, y 908, 149 × 16
        - **scroll-shadow** (bloc) · x 450, y 940, 189 × 6,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 1238, y 940, 189 × 6,5 · fond `panel (11 %)`
        - **scroll-shadow** (bloc) · x 450, y 946, 189 × 6,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 1238, y 946, 189 × 6,5 · fond `panel (23 %)`
        - **scroll-shadow** (bloc) · x 450, y 952, 189 × 6,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 1238, y 952, 189 × 6,5 · fond `panel (34 %)`
        - **scroll-shadow** (bloc) · x 450, y 958, 189 × 6,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 1238, y 958, 189 × 6,5 · fond `panel (45 %)`
        - **scroll-shadow** (bloc) · x 450, y 964, 189 × 6,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 1238, y 964, 189 × 6,5 · fond `panel (56 %)`
        - **scroll-shadow** (bloc) · x 450, y 970, 189 × 6,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 1238, y 970, 189 × 6,5 · fond `panel (68 %)`
        - **scroll-shadow** (bloc) · x 450, y 976, 189 × 6,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 1238, y 976, 189 × 6,5 · fond `panel (79 %)`
        - **scroll-shadow** (bloc) · x 450, y 982, 189 × 6,5 · fond `panel (90 %)`
        - **scroll-shadow** (bloc) · x 1238, y 982, 189 × 6,5 · fond `panel (90 %)`
  - **veil** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg (60 %)`
  - **sheet** (bloc) · x 880, y 0, 560 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · fond `bg` · bordure 1 `border`
    - **box** (bloc) · x 880, y 0, 560 × 52 · flex ligne, espacement 8, marges internes 0 16 0 24, alignement center/start · dimension remplit/fixe
      - icône `ticket` 14 px, `mfg` — x 904, y 19, 14 × 14
      - « EMIS-45 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 926, y 18,5, 53 × 15
      - **Button / outline** (bloc) · x 1086, y 13,5, 205 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
        - icône `copy` 13 px, `fg` — x 1096, y 19,5, 13 × 13
        - « Copier /full-delivery EMIS-45 » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1115, y 18,5, 166 × 15
      - icône `link` 15 px, `mfg` — x 1299, y 18,5, 15 × 15
      - icône `more` 15 px, `mfg` — x 1322, y 18,5, 15 × 15
      - **Button / ghost** (bloc) · x 1345, y 13,5, 79 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · rayon 6
        - icône `x` 13 px, `mfg` — x 1355, y 19,5, 13 × 13
        - « Fermer » — Geist 12 / 500, interligne 1,2, couleur `mfg` — x 1374, y 18,5, 40 × 15
    - **line** (bloc) · x 880, y 52, 560 × 1 · fond `soft` · dimension remplit/fixe
    - **box** (bloc) · x 880, y 53, 560 × 947 · flex colonne, espacement 16, marges internes 18 24 18 24, alignement start/start · dimension remplit/remplit
      - **header-line** (bloc) · x 904, y 71, 177 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start
        - **fchip** (bloc) · x 904, y 71, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
          - icône `package` 12 px, `mfg` — x 910, y 73,5, 12 × 12
          - « F4 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 926, y 72, 15 × 15
        - « · » — Geist 12,5 / 400, interligne 1,2, couleur `faint` — x 953, y 72, 3 × 15
        - icône `sprint` 12 px, `mfg` — x 962, y 73,5, 12 × 12
        - « S42 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `mfg` — x 980, y 72, 23 × 15
        - « · » — Geist 12,5 / 400, interligne 1,2, couleur `faint` — x 1009, y 72, 3 × 15
        - icône `pr` 12 px, `purple` — x 1018, y 73,5, 12 × 12
        - « PR #20 » — Geist Mono 12,5 / 400, interligne 1,2, couleur `fg` — x 1036, y 72, 45 × 15
      - « Conflits de saisie » — Geist 22 / 600, interligne 1,2, couleur `fg`, interlettrage -0,3 — x 904, y 104, 176 × 27
      - **box** (bloc) · x 904, y 147, 190 × 26 · flex ligne, espacement 8, marges internes 0, alignement center/start
        - **box** (bloc) · x 904, y 148,5, 108 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · bordure 1 `border` · rayon 6
          - **dot** (pastille) · x 914, y 156, 8 × 8 · fond `purple` · dimension fixe/fixe
          - « En review » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 928, y 152,5, 56 × 15
          - icône `chevDown` 12 px, `dim` — x 990, y 154, 12 × 12
        - **box** (bloc) · x 1020, y 147, 74 × 26 · flex ligne, espacement 6, marges internes 3 10 3 4, alignement center/start · bordure 1 `border` · rayon 6
          - **avatar** (bloc) · x 1024, y 150, 20 × 20 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 10 · dimension fixe/fixe
            - « AB » — Geist 8 / 600, interligne 1,2, couleur `fg` — x 1028, y 155, 12 × 10
          - « Adam » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 1050, y 152,5, 34 × 15
      - **tracking-banner** (bloc) · x 904, y 189, 512 × 36 · flex ligne, espacement 8, marges internes 10 12 10 12, alignement center/start · fond `amberSoft` · bordure 1 `border` · rayon 8 · dimension remplit/auto
        - icône `pr` 14 px, `amber` — x 916, y 200, 14 × 14
        - « PR #20 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 938, y 199, 47 × 16
        - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 993, y 199, 3 × 16
        - « changements demandés » — Geist 13 / 500, interligne 1,2, couleur `amber` — x 1004, y 199, 150 × 16
        - « · » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 1162, y 199, 3 × 16
        - « CI cassée » — Geist 13 / 500, interligne 1,2, couleur `red` — x 1173, y 199, 60 × 16
        - **box** (bloc) · x 1324, y 199,5, 33 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
          - « PR » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1324, y 199,5, 17 × 15
          - icône `external` 12 px, `mfg` — x 1345, y 201, 12 × 12
        - **box** (bloc) · x 1365, y 199,5, 39 × 15 · flex ligne, espacement 4, marges internes 0, alignement center/start
          - « Job » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1365, y 199,5, 23 × 15
          - icône `external` 12 px, `mfg` — x 1392, y 201, 12 × 12
      - **tabs** (bloc) · x 904, y 241, 512 × 24 · flex ligne, espacement 18, marges internes 0, alignement center/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 241, 42 × 24 · flex colonne, espacement 6, marges internes 0, alignement start/start
          - « Détails » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 904, y 241, 42 × 16
        - **box** (bloc) · x 964, y 241, 49 × 24 · flex colonne, espacement 6, marges internes 0, alignement start/start
          - « Activité » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 964, y 241, 49 × 16
          - **box** (bloc) · x 964, y 263, 49 × 2 · fond `fg` · dimension remplit/fixe
      - **line** (bloc) · x 904, y 281, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Chronologie** (bloc) · x 904, y 298, 512 × 281 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 298, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - « Chronologie » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 904, y 298, 76 × 16
          - « journal du ticket : branche, PR, étapes, sessions, statut » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 988, y 298,5, 310 × 15
        - **box** (bloc) · x 904, y 324, 512 × 255 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 904, y 324, 512 × 34 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 324, 24 × 34 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 324, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `bot` 12 px, `brand` — x 910, y 330, 12 × 12
              - **rail-line** (bloc) · x 915,5, y 348, 1 × 10 · fond `border` · dimension fixe/fixe
            - **box** (bloc) · x 940, y 324, 476 × 33 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 327, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « Session T3 Code ouverte » — Geist 13 / 500, interligne 1,2, couleur `brandText` — x 940, y 327, 152 × 16
                - « 14:34 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1386, y 327,5, 30 × 15
          - **box** (bloc) · x 904, y 358, 512 × 34 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 358, 24 × 34 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 358, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `pr` 12 px, `amber` — x 910, y 364, 12 × 12
              - **rail-line** (bloc) · x 915,5, y 382, 1 × 10 · fond `border` · dimension fixe/fixe
            - **box** (bloc) · x 940, y 358, 476 × 33 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 361, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « Changements demandés sur PR #20 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 940, y 361, 222 × 16
                - « 13:47 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1387, y 361,5, 29 × 15
          - **box** (bloc) · x 904, y 392, 512 × 51 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 392, 24 × 50 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 392, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `circleX` 12 px, `red` — x 910, y 398, 12 × 12
              - **rail-line** (bloc) · x 915,5, y 416, 1 × 26 · fond `border` · dimension fixe/fixe
            - **box** (bloc) · x 940, y 392, 476 × 51 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 395, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « CI cassée sur PR #20 » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 940, y 395, 129 × 16
                - « 11:58 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1388, y 395,5, 28 × 15
              - « job e2e · voir le journal » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 940, y 414, 123 × 15
          - **box** (bloc) · x 904, y 443, 512 × 34 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 443, 24 × 34 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 443, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `flag` 12 px, `mfg` — x 910, y 449, 12 × 12
              - **rail-line** (bloc) · x 915,5, y 467, 1 × 10 · fond `border` · dimension fixe/fixe
            - **box** (bloc) · x 940, y 443, 476 × 33 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 446, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « Étape 9 · Review » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 940, y 446, 100 × 16
                - « hier 17:12 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1366, y 446,5, 50 × 15
          - **box** (bloc) · x 904, y 477, 512 × 51 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 477, 24 × 50 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 477, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `pr` 12 px, `purple` — x 910, y 483, 12 × 12
              - **rail-line** (bloc) · x 915,5, y 501, 1 × 26 · fond `border` · dimension fixe/fixe
            - **box** (bloc) · x 940, y 477, 476 × 51 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 480, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « PR #20 ouverte » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 940, y 480, 94 × 16
                - « hier 16:40 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1361, y 480,5, 55 × 15
              - « statut ⇒ En review » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 940, y 499, 103 × 15
          - **box** (bloc) · x 904, y 528, 512 × 51 · flex ligne, espacement 12, marges internes 0, alignement start/start · dimension remplit/auto
            - **box** (bloc) · x 904, y 528, 24 × 24 · flex colonne, espacement 0, marges internes 0, alignement center/start · dimension fixe/auto
              - **box** (bloc) · x 904, y 528, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · rayon 12 · dimension fixe/fixe
                - icône `branch` 12 px, `blue` — x 910, y 534, 12 × 12
            - **box** (bloc) · x 940, y 528, 476 × 51 · flex colonne, espacement 3, marges internes 3 0 14 0, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 940, y 531, 476 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
                - « Branche feat/emis-45 poussée » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 940, y 531, 190 × 16
                - « mer. 10:05 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1358, y 531,5, 58 × 15
              - « statut ⇒ En cours » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 940, y 550, 97 × 15
      - **line** (bloc) · x 904, y 595, 512 × 1 · fond `soft` · dimension remplit/fixe
      - **section / Anciens runs** (bloc) · x 904, y 612, 512 × 16 · flex colonne, espacement 10, marges internes 0, alignement start/start · dimension remplit/auto
        - **box** (bloc) · x 904, y 612, 512 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
          - icône `chevRight` 14 px, `dim` — x 904, y 613, 14 × 14
          - « Anciens runs » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 926, y 612, 81 × 16
          - « runs d'agents d'avant la phase 27, en lecture seule » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 1015, y 612,5, 285 × 15

## P9 · Questions

Board `P9 · Questions` (sombre) et `P9 · Questions (clair)`, page « Proposition » du fichier Penpot « Kibo · Redesign ».
Exports : `exports/proposition-questions-dark.png` et `exports/proposition-questions-light.png`, 1440 × 1000 px (échelle 1).

### Données affichées (ordre de lecture)

1. « Galadrim » (x 46, y 21)
2. « Rechercher » (x 40, y 55,5)
3. « ⌘K » (x 205, y 57)
4. « Accueil » (x 41, y 97)
5. « Mes tickets » (x 41, y 129)
6. « 6 » (x 215, y 130)
7. « Boîte de réception » (x 41, y 161)
8. « 2 » (x 215, y 162)
9. « Projets » (x 18, y 205)
10. « Emis » (x 55, y 233)
11. « Vue d'ensemble » (x 59, y 265)
12. « Planning » (x 59, y 297)
13. « S42 » (x 202, y 298)
14. « Tickets » (x 59, y 329)
15. « 24 » (x 208, y 330)
16. « Kanban » (x 59, y 361)
17. « Graphe » (x 59, y 393)
18. « Notes » (x 59, y 425)
19. « Questions » (x 59, y 457)
20. « 3 » (x 215, y 458)
21. « Kibo » (x 55, y 489)
22. « Gereco » (x 55, y 521)
23. « Rapid » (x 55, y 553)
24. « Paramètres » (x 41, y 923)
25. « AB » (x 21, y 962)
26. « Adam Ben Mchichi » (x 48, y 960,5)
27. « Emis » (x 277, y 16)
28. « / » (x 314, y 16)
29. « Questions » (x 329, y 16)
30. « Synchronisé · il y a 1 min » (x 1125, y 16,5)
31. « Agent de projet » (x 1300, y 16,5)
32. « 3 » (x 1402, y 17,5)
33. « Ouvertes » (x 269, y 67,5)
34. « Répondues » (x 345, y 67,5)
35. « Toutes » (x 433, y 67,5)
36. « Archivées » (x 495, y 67,5)
37. « Tous » (x 583, y 67,5)
38. « 3 » (x 617, y 68)
39. « Emis SA » (x 648, y 67,5)
40. « 2 » (x 702, y 68)
41. « Produit » (x 733, y 67,5)
42. « 1 » (x 782, y 68)
43. « Exporter pour le client (2) » (x 1123, y 67,5)
44. « Nouvelle question » (x 1312, y 67,5)
45. « 1 bloquante en tête · 3 ouvertes » (x 286, y 120)
46. « EMIS-51 » (x 265, y 156)
47. « Lecture du fichier Excel » (x 324, y 155,5)
48. « F6 » (x 501, y 156)
49. « Q14 » (x 279, y 194)
50. « Un ISO réaffecté garde-t-il ses photos ? » (x 310, y 193)
51. « bloquante » (x 599, y 194)
52. « Pour : Emis SA » (x 304, y 224)
53. « posée par » (x 417, y 224)
54. « AB » (x 484, y 227)
55. « Adam · il y a 3 j » (x 506, y 224)
56. « Votre réponse… » (x 291, y 262)
57. « Répondre » (x 1337, y 262,5)
58. « EMIS-34 » (x 265, y 321)
59. « Tests E2E de l'envoi » (x 324, y 320,5)
60. « F5 » (x 477, y 321)
61. « Q16 » (x 279, y 358)
62. « Quota par affaire : 2 Go ou 5 Go ? » (x 310, y 357)
63. « Pour : Produit » (x 304, y 387)
64. « posée par » (x 411, y 387)
65. « AB » (x 478, y 390)
66. « Adam · hier » (x 500, y 387)
67. « Votre réponse… » (x 291, y 425)
68. « Répondre » (x 1337, y 425,5)
69. « EMIS-81 » (x 265, y 484)
70. « Modèle du rapport » (x 324, y 483,5)
71. « F7 » (x 469, y 484)
72. « Q17 » (x 279, y 521)
73. « Un rapport par chef de chantier ou par affaire ? » (x 310, y 520)
74. « Pour : Emis SA » (x 304, y 550)
75. « posée par » (x 417, y 550)
76. « AB » (x 484, y 553)
77. « Adam · il y a 2 h » (x 506, y 550)
78. « Votre réponse… » (x 291, y 588)
79. « Répondre » (x 1337, y 588,5)
80. « Texte exporté » (x 868, y 108)
81. « 2 questions client » (x 1162, y 108,5)
82. « Questions pour Emis SA · 16 oct. 2026 » (x 880, y 144)
83. «   » (x 880, y 165)
84. « Q14 · Un ISO réaffecté garde-t-il ses photos ? » (x 880, y 186)
85. «    bloque « Importer les ISO depuis Excel », » (x 880, y 207)
86. « prévue semaine du 19 oct. · réponse souhaitée » (x 880, y 228)
87. « avant le 19 oct. » (x 880, y 249)
88. «   » (x 880, y 270)
89. « Q17 · Un rapport par chef de chantier ou par » (x 880, y 291)
90. « affaire ? » (x 880, y 312)
91. «    pour « Rapport de chantier journalier », prévue » (x 880, y 333)
92. « semaine du 26 oct. · réponse souhaitée avant le 26 » (x 880, y 354)
93. « oct. » (x 880, y 375)
94. « Les questions exportées sont marquées envoyées. » (x 868, y 415)
95. « Copier » (x 1212, y 415)
96. « 2 questions marquées envoyées » (x 1115, y 938,5)
97. « Annuler » (x 1331, y 939)

### Blocs

Coordonnées relatives au coin haut gauche de l'écran, en px. Couleurs en tokens (tableau en tête), sinon en hex sombre / clair.

- **P9 · Questions** (bloc) · x 0, y 0, 1440 × 1000 · fond `bg`
  - **root** (bloc) · x 0, y 0, 1440 × 1000 · flex ligne, espacement 0, marges internes 0, alignement stretch/start
    - **sidebar** (bloc) · x 0, y 0, 240 × 1000 · flex colonne, espacement 2, marges internes 12 10 12 10, alignement start/start · fond `panel` · dimension fixe/remplit
      - **box** (bloc) · x 10, y 12, 220 × 34 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - icône `logo` 22 px, `border` — x 16, y 18, 22 × 22
        - « Galadrim » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 46, y 21, 57 × 16
        - icône `chevDown` 13 px, `dim` — x 111, y 22,5, 13 × 13
        - icône `panelRight` 15 px, `dim` — x 209, y 21,5, 15 × 15
      - **box** (bloc) · x 10, y 48, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
        - icône `search` 14 px, `dim` — x 18, y 56, 14 × 14
        - « Rechercher » — Geist 12,5 / 400, interligne 1,2, couleur `dim` — x 40, y 55,5, 66 × 15
        - **chip** (bloc) · x 201, y 56, 21 × 14 · flex ligne, espacement 4, marges internes 1 4 1 4, alignement center/start · bordure 1 `border` · rayon 4
          - « ⌘K » — Geist Mono 10 / 400, interligne 1,2, couleur `dim` — x 205, y 57, 13 × 12
      - **nav / Accueil** (bloc) · x 10, y 90, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `home` 15 px, `mfg` — x 18, y 97,5, 15 × 15
        - « Accueil » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 97, 44 × 16
      - **nav / Mes tickets** (bloc) · x 10, y 122, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `ticket` 15 px, `mfg` — x 18, y 129,5, 15 × 15
        - « Mes tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 129, 69 × 16
        - « 6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 130, 7 × 14
      - **nav / Boîte de réception** (bloc) · x 10, y 154, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `inbox` 15 px, `mfg` — x 18, y 161,5, 15 × 15
        - « Boîte de réception » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 161, 109 × 16
        - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 162, 7 × 14
      - **box** (bloc) · x 10, y 200, 220 × 24 · flex ligne, espacement 0, marges internes 0 8 0 8, alignement center/start · dimension remplit/fixe
        - « Projets » — Geist 11 / 500, interligne 1,2, couleur `dim`, interlettrage 0,4, majuscules — x 18, y 205, 52 × 14
        - icône `plus` 13 px, `dim` — x 209, y 205,5, 13 × 13
      - **nav / Emis** (bloc) · x 10, y 226, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevDown` 13 px, `dim` — x 18, y 234,5, 13 × 13
        - **dot** (pastille) · x 39, y 237, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
        - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 233, 29 × 16
      - **nav / Vue d'ensemble** (bloc) · x 10, y 258, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `dashboard` 15 px, `mfg` — x 36, y 265,5, 15 × 15
        - « Vue d'ensemble » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 265, 94 × 16
      - **nav / Planning** (bloc) · x 10, y 290, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `sprint` 15 px, `mfg` — x 36, y 297,5, 15 × 15
        - « Planning » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 297, 53 × 16
        - « S42 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 202, y 298, 20 × 14
      - **nav / Tickets** (bloc) · x 10, y 322, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `list` 15 px, `mfg` — x 36, y 329,5, 15 × 15
        - « Tickets » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 329, 43 × 16
        - « 24 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 208, y 330, 14 × 14
      - **nav / Kanban** (bloc) · x 10, y 354, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `kanban` 15 px, `mfg` — x 36, y 361,5, 15 × 15
        - « Kanban » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 361, 46 × 16
      - **nav / Graphe** (bloc) · x 10, y 386, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `graph` 15 px, `mfg` — x 36, y 393,5, 15 × 15
        - « Graphe » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 393, 43 × 16
      - **nav / Notes** (bloc) · x 10, y 418, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `note` 15 px, `mfg` — x 36, y 425,5, 15 × 15
        - « Notes » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 59, y 425, 36 × 16
      - **nav / Questions** (bloc) · x 10, y 450, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 26, alignement center/start · fond `hover` · rayon 6 · dimension remplit/fixe
        - icône `question` 15 px, `fg` — x 36, y 457,5, 15 × 15
        - « Questions » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 59, y 457, 62 × 16
        - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 215, y 458, 7 × 14
      - **nav / Kibo** (bloc) · x 10, y 482, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 490,5, 13 × 13
        - **dot** (pastille) · x 39, y 493, 8 × 8 · fond `#6366F1` · dimension fixe/fixe
        - « Kibo » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 489, 27 × 16
      - **nav / Gereco** (bloc) · x 10, y 514, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 522,5, 13 × 13
        - **dot** (pastille) · x 39, y 525, 8 × 8 · fond `#84CC16` · dimension fixe/fixe
        - « Gereco » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 521, 43 × 16
      - **nav / Rapid** (bloc) · x 10, y 546, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `chevRight` 13 px, `dim` — x 18, y 554,5, 13 × 13
        - **dot** (pastille) · x 39, y 557, 8 × 8 · fond `#EC4899` · dimension fixe/fixe
        - « Rapid » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 55, y 553, 35 × 16
      - **nav / Paramètres** (bloc) · x 10, y 916, 220 × 30 · flex ligne, espacement 8, marges internes 0 8 0 8, alignement center/start · rayon 6 · dimension remplit/fixe
        - icône `settings` 15 px, `mfg` — x 18, y 923,5, 15 × 15
        - « Paramètres » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 41, y 923, 69 × 16
      - **box** (bloc) · x 10, y 948, 220 × 40 · flex ligne, espacement 8, marges internes 0 6 0 6, alignement center/start · dimension remplit/fixe
        - **avatar** (bloc) · x 16, y 956, 24 × 24 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 12 · dimension fixe/fixe
          - « AB » — Geist 10 / 600, interligne 1,2, couleur `fg` — x 21, y 962, 14 × 12
        - « Adam Ben Mchichi » — Geist 12,5 / 400, interligne 1,2, couleur `fg` — x 48, y 960,5, 107 × 15
        - icône `more` 14 px, `dim` — x 210, y 961, 14 × 14
    - **vline** (bloc) · x 240, y 0, 1 × 1000 · fond `soft` · dimension fixe/remplit
    - **main** (bloc) · x 241, y 0, 1199 × 1000 · flex colonne, espacement 0, marges internes 0, alignement start/start · dimension remplit/remplit
      - **topbar** (bloc) · x 241, y 0, 1199 × 48 · flex ligne, espacement 12, marges internes 0 16 0 20, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 261, y 16, 130 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - **dot** (pastille) · x 261, y 20, 8 × 8 · fond `#14B8A6` · dimension fixe/fixe
          - « Emis » — Geist 13 / 400, interligne 1,2, couleur `mfg` — x 277, y 16, 29 × 16
          - « / » — Geist 13 / 400, interligne 1,2, couleur `faint` — x 314, y 16, 7 × 16
          - « Questions » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 329, y 16, 62 × 16
        - **box** (bloc) · x 1105, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 1105, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 1125, y 16,5, 132 × 15
        - **agent-button** (bloc) · x 1269, y 11,5, 155 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/start · bordure 1 `border` · rayon 6
          - icône `bot` 15 px, `brand` — x 1279, y 16,5, 15 × 15
          - « Agent de projet » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 1300, y 16,5, 91 × 15
          - **box** (bloc) · x 1397, y 17,5, 17 × 13 · flex ligne, espacement 0, marges internes 0 5 0 5, alignement center/start · fond `brandBtn` · rayon 8
            - « 3 » — Geist Mono 10,5 / 600, interligne 1,2, couleur `#FFFFFF` — x 1402, y 17,5, 7 × 13
      - **line** (bloc) · x 241, y 48, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **toolbar** (bloc) · x 241, y 49, 1199 × 52 · flex ligne, espacement 8, marges internes 0 16 0 16, alignement center/start · dimension remplit/fixe
        - **box** (bloc) · x 257, y 61,5, 308 × 27 · flex ligne, espacement 2, marges internes 2, alignement center/start · fond `muted` · rayon 7
          - **box** (bloc) · x 259, y 63,5, 74 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · fond `bg` · bordure 1 `border` · rayon 5
            - « Ouvertes » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 269, y 67,5, 54 × 15
          - **box** (bloc) · x 335, y 63,5, 86 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Répondues » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 345, y 67,5, 66 × 15
          - **box** (bloc) · x 423, y 63,5, 60 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Toutes » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 433, y 67,5, 40 × 15
          - **box** (bloc) · x 485, y 63,5, 78 × 23 · flex ligne, espacement 0, marges internes 4 10 4 10, alignement center/start · rayon 5
            - « Archivées » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 495, y 67,5, 58 × 15
        - **box** (bloc) · x 573, y 63,5, 226 × 23 · flex ligne, espacement 4, marges internes 0, alignement center/start
          - **box** (bloc) · x 573, y 63,5, 61 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · bordure 1 `mfg` · rayon 6
            - « Tous » — Geist 12,5 / 500, interligne 1,2, couleur `fg` — x 583, y 67,5, 28 × 15
            - « 3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 617, y 68, 7 × 14
          - **box** (bloc) · x 638, y 63,5, 81 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · bordure 1 `border` · rayon 6
            - « Emis SA » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 648, y 67,5, 48 × 15
            - « 2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 702, y 68, 7 × 14
          - **box** (bloc) · x 723, y 63,5, 76 × 23 · flex ligne, espacement 6, marges internes 4 10 4 10, alignement center/start · bordure 1 `border` · rayon 6
            - « Produit » — Geist 12,5 / 500, interligne 1,2, couleur `mfg` — x 733, y 67,5, 43 × 15
            - « 1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 782, y 68, 7 × 14
        - **Button / outline** (bloc) · x 1094, y 62,5, 181 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `upload` 13 px, `fg` — x 1104, y 68,5, 13 × 13
          - « Exporter pour le client (2) » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1123, y 67,5, 142 × 15
        - **Button / default** (bloc) · x 1283, y 62,5, 141 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `primary` · rayon 6
          - icône `plus` 13 px, `pfg` — x 1293, y 68,5, 13 × 13
          - « Nouvelle question » — Geist 12 / 500, interligne 1,2, couleur `pfg` — x 1312, y 67,5, 102 × 15
      - **line** (bloc) · x 241, y 101, 1199 × 1 · fond `soft` · dimension remplit/fixe
      - **list** (bloc) · x 241, y 102, 1199 × 898 · flex colonne, espacement 20, marges internes 18 24 18 24, alignement start/start · dimension remplit/remplit
        - **box** (bloc) · x 265, y 120, 199 × 15 · flex ligne, espacement 8, marges internes 0, alignement center/start
          - icône `lock` 13 px, `red` — x 265, y 121, 13 × 13
          - « 1 bloquante en tête · 3 ouvertes » — Geist 12,5 / 400, interligne 1,2, couleur `mfg` — x 286, y 120, 178 × 15
        - **group EMIS-51** (bloc) · x 265, y 155, 1151 × 145 · flex colonne, espacement 8, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 155, 257 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - « EMIS-51 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 265, y 156, 51 × 15
            - « Lecture du fichier Excel » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 324, y 155,5, 147 × 16
            - **fchip** (bloc) · x 479, y 155, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
              - icône `package` 12 px, `mfg` — x 485, y 157,5, 12 × 12
              - « F6 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 501, y 156, 15 × 15
          - **question Q14** (bloc) · x 265, y 180, 1151 × 120 · flex colonne, espacement 10, marges internes 12 14 12 14, alignement start/start · fond `card` · bordure 1 `red` · rayon 10 · dimension remplit/auto
            - **box** (bloc) · x 279, y 192, 1123 × 19 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Q14 » — Geist Mono 12,5 / 600, interligne 1,2, couleur `red` — x 279, y 194, 23 × 15
              - « Un ISO réaffecté garde-t-il ses photos ? » — Geist 13,5 / 600, interligne 1,2, couleur `fg` — x 310, y 193, 256 × 17
              - **pill** (bloc) · x 574, y 192, 90 × 19 · flex ligne, espacement 5, marges internes 2 8 2 8, alignement center/start · fond `redSoft` · rayon 10
                - icône `lock` 12 px, `red` — x 582, y 195,5, 12 × 12
                - « bloquante » — Geist 12 / 500, interligne 1,2, couleur `red` — x 599, y 194, 57 × 15
              - icône `more` 15 px, `dim` — x 1387, y 194, 15 × 15
            - **box** (bloc) · x 279, y 221, 309 × 21 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **box** (bloc) · x 279, y 221, 130 × 21 · flex ligne, espacement 5, marges internes 3 8 3 8, alignement center/start · bordure 1 `border` · rayon 12
                - icône `user` 12 px, `mfg` — x 287, y 225,5, 12 × 12
                - « Pour : Emis SA » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 304, y 224, 81 × 15
                - icône `chevDown` 11 px, `dim` — x 390, y 226, 11 × 11
              - « posée par » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 417, y 224, 55 × 15
              - **avatar** (bloc) · x 480, y 222,5, 18 × 18 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 9 · dimension fixe/fixe
                - « AB » — Geist 7 / 600, interligne 1,2, couleur `fg` — x 484, y 227, 10 × 9
              - « Adam · il y a 3 j » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 506, y 224, 82 × 15
            - **box** (bloc) · x 279, y 252, 1123 × 36 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - **input** (bloc) · x 279, y 252, 1040 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
                - « Votre réponse… » — Geist 13 / 400, interligne 1,2, couleur `dim` — x 291, y 262, 91 × 16
              - **Button / soft** (bloc) · x 1327, y 257,5, 75 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `muted` · rayon 6
                - « Répondre » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1337, y 262,5, 55 × 15
        - **group EMIS-34** (bloc) · x 265, y 320, 1151 × 143 · flex colonne, espacement 8, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 320, 233 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - « EMIS-34 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 265, y 321, 51 × 15
            - « Tests E2E de l'envoi » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 324, y 320,5, 123 × 16
            - **fchip** (bloc) · x 455, y 320, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
              - icône `package` 12 px, `mfg` — x 461, y 322,5, 12 × 12
              - « F5 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 477, y 321, 15 × 15
          - **question Q16** (bloc) · x 265, y 345, 1151 × 118 · flex colonne, espacement 10, marges internes 12 14 12 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
            - **box** (bloc) · x 279, y 357, 1123 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Q16 » — Geist Mono 12,5 / 600, interligne 1,2, couleur `mfg` — x 279, y 358, 23 × 15
              - « Quota par affaire : 2 Go ou 5 Go ? » — Geist 13,5 / 600, interligne 1,2, couleur `fg` — x 310, y 357, 214 × 17
              - icône `more` 15 px, `dim` — x 1387, y 358, 15 × 15
            - **box** (bloc) · x 279, y 384, 283 × 21 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **box** (bloc) · x 279, y 384, 124 × 21 · flex ligne, espacement 5, marges internes 3 8 3 8, alignement center/start · bordure 1 `border` · rayon 12
                - icône `user` 12 px, `mfg` — x 287, y 388,5, 12 × 12
                - « Pour : Produit » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 304, y 387, 75 × 15
                - icône `chevDown` 11 px, `dim` — x 384, y 389, 11 × 11
              - « posée par » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 411, y 387, 55 × 15
              - **avatar** (bloc) · x 474, y 385,5, 18 × 18 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 9 · dimension fixe/fixe
                - « AB » — Geist 7 / 600, interligne 1,2, couleur `fg` — x 478, y 390, 10 × 9
              - « Adam · hier » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 500, y 387, 62 × 15
            - **box** (bloc) · x 279, y 415, 1123 × 36 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - **input** (bloc) · x 279, y 415, 1040 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
                - « Votre réponse… » — Geist 13 / 400, interligne 1,2, couleur `dim` — x 291, y 425, 91 × 16
              - **Button / soft** (bloc) · x 1327, y 420,5, 75 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `muted` · rayon 6
                - « Répondre » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1337, y 425,5, 55 × 15
        - **group EMIS-81** (bloc) · x 265, y 483, 1151 × 143 · flex colonne, espacement 8, marges internes 0, alignement start/start · dimension remplit/auto
          - **box** (bloc) · x 265, y 483, 225 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - « EMIS-81 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 265, y 484, 51 × 15
            - « Modèle du rapport » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 324, y 483,5, 115 × 16
            - **fchip** (bloc) · x 447, y 483, 43 × 17 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · bordure 1 `border` · rayon 4
              - icône `package` 12 px, `mfg` — x 453, y 485,5, 12 × 12
              - « F7 » — Geist Mono 12 / 500, interligne 1,2, couleur `mfg` — x 469, y 484, 15 × 15
          - **question Q17** (bloc) · x 265, y 508, 1151 × 118 · flex colonne, espacement 10, marges internes 12 14 12 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 10 · dimension remplit/auto
            - **box** (bloc) · x 279, y 520, 1123 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - « Q17 » — Geist Mono 12,5 / 600, interligne 1,2, couleur `mfg` — x 279, y 521, 23 × 15
              - « Un rapport par chef de chantier ou par affaire ? » — Geist 13,5 / 600, interligne 1,2, couleur `fg` — x 310, y 520, 303 × 17
              - icône `more` 15 px, `dim` — x 1387, y 521, 15 × 15
            - **box** (bloc) · x 279, y 547, 313 × 21 · flex ligne, espacement 8, marges internes 0, alignement center/start
              - **box** (bloc) · x 279, y 547, 130 × 21 · flex ligne, espacement 5, marges internes 3 8 3 8, alignement center/start · bordure 1 `border` · rayon 12
                - icône `user` 12 px, `mfg` — x 287, y 551,5, 12 × 12
                - « Pour : Emis SA » — Geist 12 / 400, interligne 1,2, couleur `fg` — x 304, y 550, 81 × 15
                - icône `chevDown` 11 px, `dim` — x 390, y 552, 11 × 11
              - « posée par » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 417, y 550, 55 × 15
              - **avatar** (bloc) · x 480, y 548,5, 18 × 18 · flex ligne, espacement 0, marges internes 0, alignement center/center · fond `muted` · bordure 1 `border` · rayon 9 · dimension fixe/fixe
                - « AB » — Geist 7 / 600, interligne 1,2, couleur `fg` — x 484, y 553, 10 × 9
              - « Adam · il y a 2 h » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 506, y 550, 86 × 15
            - **box** (bloc) · x 279, y 578, 1123 × 36 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
              - **input** (bloc) · x 279, y 578, 1040 × 36 · flex ligne, espacement 8, marges internes 0 12 0 12, alignement center/start · fond `bg` · bordure 1 `border` · rayon 6 · dimension remplit/fixe
                - « Votre réponse… » — Geist 13 / 400, interligne 1,2, couleur `dim` — x 291, y 588, 91 × 16
              - **Button / soft** (bloc) · x 1327, y 583,5, 75 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `muted` · rayon 6
                - « Répondre » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1337, y 588,5, 55 × 15
  - **export-preview** (bloc) · x 854, y 94, 420 × 355 · flex colonne, espacement 10, marges internes 14, alignement start/start · fond `card` · bordure 1 `border` · rayon 10
    - **box** (bloc) · x 868, y 108, 392 × 16 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
      - « Texte exporté » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 868, y 108, 86 × 16
      - « 2 questions client » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 1162, y 108,5, 98 × 15
    - **box** (bloc) · x 868, y 134, 392 × 266 · flex colonne, espacement 6, marges internes 10 12 10 12, alignement start/start · fond `muted` · rayon 6 · dimension remplit/auto
      - « Questions pour Emis SA · 16 oct. 2026 » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 144, 267 × 15
      - «   » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 165, 8 × 15
      - « Q14 · Un ISO réaffecté garde-t-il ses photos ? » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 186, 332 × 15
      - «    bloque « Importer les ISO depuis Excel », » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 207, 317 × 15
      - « prévue semaine du 19 oct. · réponse souhaitée » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 228, 324 × 15
      - « avant le 19 oct. » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 249, 116 × 15
      - «   » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 270, 8 × 15
      - « Q17 · Un rapport par chef de chantier ou par » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 291, 317 × 15
      - « affaire ? » — Geist Mono 12 / 400, interligne 1,2, couleur `fg` — x 880, y 312, 65 × 15
      - «    pour « Rapport de chantier journalier », prévue » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 333, 360 × 15
      - « semaine du 26 oct. · réponse souhaitée avant le 26 » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 354, 360 × 15
      - « oct. » — Geist Mono 12 / 400, interligne 1,2, couleur `mfg` — x 880, y 375, 29 × 15
    - **box** (bloc) · x 868, y 410, 392 × 25 · flex ligne, espacement 8, marges internes 0, alignement center/start · dimension remplit/auto
      - « Les questions exportées sont marquées envoyées. » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 868, y 415, 307 × 15
      - **Button / default** (bloc) · x 1183, y 410, 77 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · fond `primary` · rayon 6
        - icône `copy` 13 px, `pfg` — x 1193, y 416, 13 × 13
        - « Copier » — Geist 12 / 500, interligne 1,2, couleur `pfg` — x 1212, y 415, 38 × 15
  - **toast** (bloc) · x 1076, y 922, 323 × 49 · flex ligne, espacement 10, marges internes 12 14 12 14, alignement center/start · fond `card` · bordure 1 `border` · rayon 8
    - icône `circleCheck` 15 px, `green` — x 1090, y 939, 15 × 15
    - « 2 questions marquées envoyées » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1115, y 938,5, 196 × 16
    - **Button / outline** (bloc) · x 1321, y 934, 64 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
      - « Annuler » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1331, y 939, 44 × 15
