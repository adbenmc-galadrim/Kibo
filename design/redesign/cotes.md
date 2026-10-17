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
| Geist | 12 | 500 | 1,2 | 27 |
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

Rayons relevés (px) : 1 (183), 1,5 (37), 2 (71), 3 (1), 4 (39), 5 (8), 6 (129), 6,5 (1), 7 (2), 8 (29), 9 (2), 10 (29), 12 (6), 14 (5), 15 (1).

Espacements flex relevés (px) : 0 (145), 1,5 (10), 2 (16), 3 (25), 4 (47), 5 (37), 6 (171), 7 (15), 8 (177), 9 (3), 10 (25), 12 (33), 14 (12), 16 (2), 18 (1), 28 (1).

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
30. « Synchronisé · il y a 1 min » (x 988, y 16,5)
31. « Nouveau sprint » (x 1161, y 16,5)
32. « Agent de projet » (x 1300, y 16,5)
33. « 3 » (x 1402, y 17,5)
34. « Planning » (x 265, y 67)
35. « 3 fonctionnalités livrées sur 9 · 1 à planifier » (x 368, y 79)
36. « Ouvertes : 2 / 2 » (x 1140, y 74)
37. « Colonnes » (x 1282, y 73)
38. « Bandes » (x 1359, y 73)
39. « S41 » (x 277, y 120)
40. « Accès » (x 307, y 120)
41. « 5–9 oct. » (x 277, y 141,5)
42. « terminé » (x 423, y 142)
43. « 2/2 livrées » (x 387, y 161)
44. « F1 » (x 306, y 199)
45. « livrée » (x 428, y 199)
46. « Se connecter avec Microsoft » (x 287, y 221)
47. « F2 » (x 306, y 283)
48. « livrée » (x 428, y 283)
49. « Voir ses ISO affectés » (x 287, y 305)
50. « S42 » (x 503, y 120)
51. « Terrain hors ligne » (x 533, y 120)
52. « 12–16 oct. » (x 503, y 141,5)
53. « en cours » (x 644, y 142)
54. « 1/3 livrées » (x 613, y 161)
55. « F3 » (x 532, y 199)
56. « livrée » (x 654, y 199)
57. « Réaffecter un ISO » (x 513, y 221)
58. « 4/4 étapes » (x 513, y 261)
59. « F4 » (x 532, y 306,5)
60. « ouverte » (x 639, y 307)
61. « Saisir un tronçon hors ligne » (x 513, y 330)
62. « 3/5 étapes » (x 513, y 370)
63. « EMIS-45 » (x 636, y 370)
64. « F5 » (x 532, y 415,5)
65. « en retard » (x 632, y 416)
66. « Envoyer les photos d'un tronçon » (x 513, y 439)
67. « 1/5 étapes » (x 513, y 495)
68. « EMIS-33 » (x 636, y 495)
69. « F5 ne tiendra pas : 4 étapes restantes » (x 528, y 535)
70. « S43 » (x 729, y 120)
71. « Import et soudures » (x 759, y 120)
72. « 19–23 oct. » (x 729, y 140)
73. « 2 prévues » (x 867, y 140)
74. « F6 » (x 758, y 179,5)
75. « bloquée · Q14 » (x 837, y 180)
76. « Importer les ISO depuis Excel » (x 739, y 203)
77. « 0/4 étapes » (x 739, y 259)
78. « suivante : EMIS-51 » (x 816, y 259)
79. « F8 » (x 758, y 303)
80. « Valider les soudures par lot » (x 739, y 325)
81. « 0/4 étapes » (x 739, y 365)
82. « suivante : EMIS-71 » (x 817, y 365)
83. « S44 » (x 955, y 120)
84. « Rapports » (x 985, y 120)
85. « 26–30 oct. » (x 955, y 140)
86. « 1 prévue » (x 1102, y 140)
87. « F7 » (x 984, y 178)
88. « Rapport de chantier journalier » (x 965, y 200)
89. « 0/5 étapes » (x 965, y 256)
90. « suivante : EMIS-81 » (x 1042, y 256)
91. « Déposer pour planifier en S44 » (x 966, y 343,5)
92. « 26–30 oct. » (x 1022, y 364,5)
93. « À planifier » (x 1201, y 120)
94. « Glisse une fonctionnalité vers un sprint » (x 1181, y 140)
95. « F9 » (x 1210, y 178)
96. « Exporter le dossier client » (x 1191, y 200)
97. « 0/3 étapes » (x 1191, y 240)
98. « suivante : EMIS-91 » (x 1268, y 240)
99. « Une fonctionnalité sans sprint n'apparaît ni dans les échéances ni dans la limite d'ouvertes. » (x 1183, y 282)
100. « étape livrée » (x 283, y 968)
101. « en review » (x 377, y 968)
102. « en cours » (x 460, y 968)
103. « bloquée » (x 538, y 968)
104. « à faire » (x 613, y 968)
105. « · une case par étape, dans l'ordre des dépendances » (x 660, y 968)
106. « F9 » (x 1004, y 399)
107. « Exporter le dossier client » (x 985, y 421)

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
        - **box** (bloc) · x 968, y 16,5, 152 × 15 · flex ligne, espacement 6, marges internes 0, alignement center/start
          - icône `github` 14 px, `dim` — x 968, y 17, 14 × 14
          - « Synchronisé · il y a 1 min » — Geist 12 / 400, interligne 1,2, couleur `dim` — x 988, y 16,5, 132 × 15
        - **Button / outline** (bloc) · x 1132, y 11,5, 125 × 25 · flex ligne, espacement 6, marges internes 5 10 5 10, alignement center/center · bordure 1 `border` · rayon 6
          - icône `plus` 13 px, `fg` — x 1142, y 17,5, 13 × 13
          - « Nouveau sprint » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 1161, y 16,5, 86 × 15
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
          - **col S41** (bloc) · x 265, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 275, y 118, 194 × 61 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 277, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S41 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 277, y 120, 24 × 16
                - « Accès » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 307, y 120, 39 × 16
              - **box** (bloc) · x 277, y 140, 190 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 5–9 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 277, y 141,5, 44 × 14
                - **chip** (bloc) · x 401, y 140, 66 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `greenSoft` · rayon 4
                  - icône `circleCheck` 12 px, `green` — x 407, y 142,5, 12 × 12
                  - « terminé » — Geist 10,5 / 500, interligne 1,2, couleur `green` — x 423, y 142, 38 × 13
              - **box** (bloc) · x 277, y 161, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - **bar** (bloc) · x 277, y 166,5, 104 × 3 · flex ligne, espacement 0, marges internes 0, alignement start/start · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - **fill** (bloc) · x 277, y 166,5, 104 × 3 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - « 2/2 livrées » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 387, y 161, 54 × 14
            - **feature F1** (bloc) · x 275, y 189, 194 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 287, y 199, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 287, y 199,5, 13 × 13
                - « F1 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 306, y 199, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 409, y 199,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 428, y 199, 29 × 14
              - « Se connecter avec Microsoft » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 287, y 221, 170 × 32
            - **feature F2** (bloc) · x 275, y 273, 194 × 58 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 287, y 283, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 287, y 283,5, 13 × 13
                - « F2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 306, y 283, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 409, y 283,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 428, y 283, 29 × 14
              - « Voir ses ISO affectés » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 287, y 305, 170 × 16
          - **col S42** (bloc) · x 491, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `card` · bordure 1 `mfg` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 501, y 118, 194 × 61 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 503, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S42 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 503, y 120, 24 × 16
                - « Terrain hors ligne » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 533, y 120, 107 × 16
              - **box** (bloc) · x 503, y 140, 190 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 12–16 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 503, y 141,5, 52 × 14
                - **chip** (bloc) · x 638, y 140, 55 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `muted` · rayon 4
                  - « en cours » — Geist 10,5 / 500, interligne 1,2, couleur `fg` — x 644, y 142, 43 × 13
              - **box** (bloc) · x 503, y 161, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - **bar** (bloc) · x 503, y 166,5, 104 × 3 · flex ligne, espacement 0, marges internes 0, alignement start/start · fond `border` · rayon 1,5 · dimension fixe/fixe
                  - **fill** (bloc) · x 503, y 166,5, 35 × 3 · fond `green` · rayon 1,5 · dimension fixe/fixe
                - « 1/3 livrées » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 613, y 161, 51 × 14
            - **feature F3** (bloc) · x 501, y 189, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 513, y 199, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 513, y 199,5, 13 × 13
                - « F3 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 532, y 199, 14 × 14
                - icône `circleCheck` 13 px, `green` — x 635, y 199,5, 13 × 13
                - « livrée » — Geist 11,5 / 400, interligne 1,2, couleur `green` — x 654, y 199, 29 × 14
              - « Réaffecter un ISO » — Geist 13 / 500, interligne 1,2, couleur `mfg` — x 513, y 221, 170 × 16
              - **segs** (bloc) · x 513, y 245, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 513, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 556, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 599, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 642, y 245, 40 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 513, y 261, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 4/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 513, y 261, 58 × 14
            - **feature F4** (bloc) · x 501, y 295, 194 × 99 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 513, y 305, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 513, y 307, 13 × 13
                - « F4 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 532, y 306,5, 14 × 14
                - **chip** (bloc) · x 633, y 305, 50 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `blueSoft` · rayon 4
                  - « ouverte » — Geist 10,5 / 500, interligne 1,2, couleur `blue` — x 639, y 307, 38 × 13
              - « Saisir un tronçon hors ligne » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 513, y 330, 170 × 16
              - **segs** (bloc) · x 513, y 354, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 513, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 547, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 581, y 354, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 615, y 354, 31 × 8 · fond `purple` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 649, y 354, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 513, y 370, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 3/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 513, y 370, 59 × 14
                - **dot** (pastille) · x 624, y 374, 6 × 6 · fond `brand` · dimension fixe/fixe
                - « EMIS-45 » — Geist Mono 11 / 400, interligne 1,2, couleur `brandText` — x 636, y 370, 47 × 14
            - **feature F5** (bloc) · x 501, y 404, 194 × 115 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `red` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 513, y 414, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 513, y 416, 13 × 13
                - « F5 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 532, y 415,5, 14 × 14
                - **chip** (bloc) · x 610, y 414, 73 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `clockAlert` 12 px, `red` — x 616, y 416,5, 12 × 12
                  - « en retard » — Geist 10,5 / 500, interligne 1,2, couleur `red` — x 632, y 416, 45 × 13
              - « Envoyer les photos d'un tronçon » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 513, y 439, 170 × 32
              - **segs** (bloc) · x 513, y 479, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 513, y 479, 31 × 8 · fond `fg` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 547, y 479, 31 × 8 · fond `purple` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 581, y 479, 31 × 8 · fond `blue` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 615, y 479, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 649, y 479, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 513, y 495, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 1/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 513, y 495, 56 × 14
                - **dot** (pastille) · x 624, y 499, 6 × 6 · fond `brand` · dimension fixe/fixe
                - « EMIS-33 » — Geist Mono 11 / 400, interligne 1,2, couleur `brandText` — x 636, y 495, 47 × 14
            - **box** (bloc) · x 501, y 529, 194 × 40 · flex ligne, espacement 6, marges internes 6 8 6 8, alignement center/start · fond `redSoft` · rayon 6 · dimension remplit/auto
              - icône `clockAlert` 13 px, `red` — x 509, y 542,5, 13 × 13
              - « F5 ne tiendra pas : 4 étapes restantes » — Geist 11,5 / 400, interligne 1,2, couleur `red` — x 528, y 535, 159 × 28
          - **col S43** (bloc) · x 717, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 727, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 729, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S43 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 729, y 120, 24 × 16
                - « Import et soudures » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 759, y 120, 118 × 16
              - **box** (bloc) · x 729, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 19–23 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 729, y 140, 55 × 14
                - « 2 prévues » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 867, y 140, 52 × 14
            - **feature F6** (bloc) · x 727, y 168, 194 × 115 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 739, y 178, 170 × 17 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 739, y 180, 13 × 13
                - « F6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 758, y 179,5, 14 × 14
                - **chip** (bloc) · x 815, y 178, 94 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
                  - icône `lock` 12 px, `red` — x 821, y 180,5, 12 × 12
                  - « bloquée · Q14 » — Geist 10,5 / 500, interligne 1,2, couleur `red` — x 837, y 180, 66 × 13
              - « Importer les ISO depuis Excel » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 739, y 203, 170 × 32
              - **segs** (bloc) · x 739, y 243, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 739, y 243, 40 × 8 · fond `red` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 782, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 825, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 868, y 243, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 739, y 259, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 739, y 259, 59 × 14
                - « suivante : EMIS-51 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 816, y 259, 93 × 14
            - **feature F8** (bloc) · x 727, y 293, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 739, y 303, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 739, y 303,5, 13 × 13
                - « F8 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 758, y 303, 14 × 14
              - « Valider les soudures par lot » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 739, y 325, 170 × 16
              - **segs** (bloc) · x 739, y 349, 169 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 739, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 782, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 825, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 868, y 349, 40 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 739, y 365, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/4 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 739, y 365, 59 × 14
                - « suivante : EMIS-71 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 817, y 365, 92 × 14
          - **col S44** (bloc) · x 943, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · fond `panel` · bordure 1 `border` · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 953, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 955, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « S44 » — Geist Mono 13 / 600, interligne 1,2, couleur `fg` — x 955, y 120, 24 × 16
                - « Rapports » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 985, y 120, 58 × 16
              - **box** (bloc) · x 955, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 26–30 oct. » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 955, y 140, 58 × 14
                - « 1 prévue » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1102, y 140, 43 × 14
            - **feature F7** (bloc) · x 953, y 168, 194 × 112 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 965, y 178, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 965, y 178,5, 13 × 13
                - « F7 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 984, y 178, 14 × 14
              - « Rapport de chantier journalier » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 965, y 200, 170 × 32
              - **segs** (bloc) · x 965, y 240, 167 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 965, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 999, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1033, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1067, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1101, y 240, 31 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 965, y 256, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/5 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 965, y 256, 59 × 14
                - « suivante : EMIS-81 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1042, y 256, 93 × 14
            - **dropzone** (bloc) · x 953, y 290, 194 × 120 · flex colonne, espacement 6, marges internes 0, alignement center/center · fond `muted` · bordure 1 `fg` dashed · rayon 8 · dimension remplit/fixe
              - icône `sprint` 16 px, `fg` — x 1042, y 321,5, 16 × 16
              - « Déposer pour planifier en S44 » — Geist 12 / 500, interligne 1,2, couleur `fg` — x 966, y 343,5, 168 × 15
              - « 26–30 oct. » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1022, y 364,5, 56 × 14
          - **col reserve** (bloc) · x 1169, y 108, 214 × 846 · flex colonne, espacement 10, marges internes 10, alignement start/start · bordure 1 `border` dashed · rayon 10 · dimension fixe/remplit
            - **box** (bloc) · x 1179, y 118, 194 × 40 · flex colonne, espacement 4, marges internes 2 2 4 2, alignement start/start · dimension remplit/auto
              - **box** (bloc) · x 1181, y 120, 190 × 16 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `inbox` 14 px, `mfg` — x 1181, y 121, 14 × 14
                - « À planifier » — Geist 13 / 600, interligne 1,2, couleur `fg` — x 1201, y 120, 64 × 16
              - **box** (bloc) · x 1181, y 140, 190 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « Glisse une fonctionnalité vers un sprint » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1181, y 140, 204 × 14
            - **feature F9** (bloc) · x 1179, y 168, 194 × 96 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `border` · rayon 8 · dimension remplit/auto
              - **box** (bloc) · x 1191, y 178, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - icône `grip` 13 px, `faint` — x 1191, y 178,5, 13 × 13
                - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1210, y 178, 14 × 14
              - « Exporter le dossier client » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 1191, y 200, 170 × 16
              - **segs** (bloc) · x 1191, y 224, 168 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
                - **seg** (bloc) · x 1191, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1248, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
                - **seg** (bloc) · x 1305, y 224, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
              - **box** (bloc) · x 1191, y 240, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
                - « 0/3 étapes » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 1191, y 240, 59 × 14
                - « suivante : EMIS-91 » — Geist 11 / 400, interligne 1,2, couleur `dim` — x 1268, y 240, 93 × 14
            - **box** (bloc) · x 1179, y 274, 194 × 67 · flex colonne, espacement 6, marges internes 8 4 8 4, alignement start/start · dimension remplit/auto
              - « Une fonctionnalité sans sprint n'apparaît ni dans les échéances ni dans la limite d'ouvertes. » — Geist 11,5 / 400, interligne 1,45, couleur `dim` — x 1183, y 282, 186 × 51
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
  - **dragging F9** (bloc) · x 973, y 389, 194 × 74 · flex colonne, espacement 8, marges internes 10 12 10 12, alignement start/start · fond `card` · bordure 1 `fg` · rayon 8
    - **box** (bloc) · x 985, y 399, 170 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
      - icône `grip` 13 px, `mfg` — x 985, y 399,5, 13 × 13
      - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1004, y 399, 14 × 14
    - « Exporter le dossier client » — Geist 13 / 500, interligne 1,2, couleur `fg` — x 985, y 421, 170 × 16
    - **segs** (bloc) · x 985, y 445, 168 × 8 · flex ligne, espacement 3, marges internes 0, alignement center/start
      - **seg** (bloc) · x 985, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
      - **seg** (bloc) · x 1042, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
      - **seg** (bloc) · x 1099, y 445, 54 × 8 · fond `border` · rayon 2 · dimension fixe/fixe
  - icône `grab` 22 px, `fg` — x 1137, y 433, 22 × 22

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
35. « Fonctionnalité · F5 · EMIS-30 » (x 291, y 72)
36. « S42 » (x 478, y 73)
37. « en retard » (x 533, y 73)
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
89. « Attend » (x 1106, y 274)
90. « F3 » (x 1170, y 274,5)
91. « Réaffecter un ISO » (x 1192, y 274)
92. « Débloque » (x 1106, y 308)
93. « F7 » (x 1170, y 308,5)
94. « Rapport de chantier » (x 1192, y 308)
95. « S44 » (x 1378, y 308,5)
96. « Questions » (x 1129, y 358)
97. « 1 » (x 1201, y 358,5)
98. « Quota par affaire : 2 Go ou 5 Go ? » (x 1106, y 396)
99. « Q16 · Produit · hier · EMIS-34 » (x 1106, y 413)
100. « Activité » (x 1129, y 462)
101. « PR #22 ouverte · EMIS-32 » (x 1128, y 498)
102. « 15:04 » (x 1365, y 498,5)
103. « Étape 7 · Porte qualité · EMIS-33 » (x 1128, y 528)
104. « 14:51 » (x 1365, y 528,5)
105. « PR #19 fusionnée · EMIS-31 » (x 1128, y 558)
106. « hier » (x 1378, y 558,5)
107. « Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery. » (x 1113, y 594)

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
          - **box** (bloc) · x 269, y 71, 315 × 17 · flex ligne, espacement 8, marges internes 0, alignement center/start
            - icône `package` 14 px, `mfg` — x 269, y 72,5, 14 × 14
            - « Fonctionnalité · F5 · EMIS-30 » — Geist 12 / 400, interligne 1,2, couleur `mfg` — x 291, y 72, 158 × 15
            - **sprint** (bloc) · x 457, y 72, 46 × 15 · flex ligne, espacement 4, marges internes 1 6 1 6, alignement center/start · fond `muted` · bordure 1 `border` · rayon 4
              - icône `sprint` 11 px, `fg` — x 463, y 74, 11 × 11
              - « S42 » — Geist Mono 10,5 / 500, interligne 1,2, couleur `fg` — x 478, y 73, 19 × 13
            - **chip** (bloc) · x 511, y 71, 73 × 17 · flex ligne, espacement 4, marges internes 2 6 2 6, alignement center/start · fond `redSoft` · rayon 4
              - icône `clockAlert` 12 px, `red` — x 517, y 73,5, 12 × 12
              - « en retard » — Geist 10,5 / 500, interligne 1,2, couleur `red` — x 533, y 73, 45 × 13
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
36. « 9 fonctionnalités · 13 dépendances entre étapes, 7 entre fonctionnalités » (x 1036, y 64,5)
37. « S41 » (x 273, y 108)
38. « Accès » (x 301, y 108)
39. « terminé » (x 255, y 125)
40. « S42 » (x 423, y 108)
41. « Terrain hors ligne » (x 451, y 108)
42. « en cours » (x 405, y 125)
43. « S43 » (x 713, y 108)
44. « Import et soudures » (x 741, y 108)
45. « prévu » (x 695, y 125)
46. « S44 » (x 973, y 108)
47. « Rapports » (x 1001, y 108)
48. « prévu » (x 955, y 125)
49. « À planifier » (x 1223, y 108)
50. « F1 » (x 263, y 176)
51. « 4/4 » (x 331, y 176)
52. « Se connecter avec Microsoft » (x 263, y 196)
53. « F3 » (x 415, y 176)
54. « 4/4 » (x 619, y 176)
55. « Réaffecter un ISO » (x 415, y 196)
56. « F6 » (x 705, y 226)
57. « 0/4 » (x 897, y 226)
58. « Importer les ISO depuis Excel » (x 705, y 246)
59. « Lecture du fichier Excel » (x 726, y 283)
60. « Contrôle des repères » (x 726, y 313)
61. « Écran d'import » (x 726, y 343)
62. « Démo client » (x 726, y 373)
63. « bloquée par Q14 » (x 722, y 398)
64. « F4 » (x 415, y 286)
65. « 3/5 » (x 637, y 286)
66. « Saisir un tronçon hors ligne » (x 415, y 306)
67. « Schéma local des tronçons » (x 436, y 343)
68. « Formulaire de saisie » (x 436, y 373)
69. « Synchro au retour du réseau » (x 436, y 403)
70. « Conflits de saisie » (x 436, y 433)
71. « Démo client » (x 436, y 463)
72. « F2 » (x 263, y 296)
73. « 5/5 » (x 331, y 296)
74. « Voir ses ISO affectés » (x 263, y 316)
75. « F8 » (x 705, y 446)
76. « 0/4 » (x 897, y 446)
77. « Valider les soudures par lot » (x 705, y 466)
78. « Statuts de soudure » (x 726, y 503)
79. « Sélection multiple » (x 726, y 533)
80. « Validation par lot » (x 726, y 563)
81. « Démo client » (x 726, y 593)
82. « F7 » (x 965, y 506)
83. « 0/5 » (x 1147, y 506)
84. « Rapport de chantier journalier » (x 965, y 526)
85. « Modèle du rapport » (x 986, y 563)
86. « Génération PDF » (x 986, y 593)
87. « Photos dans le rapport » (x 986, y 623)
88. « Envoi le soir » (x 986, y 653)
89. « Démo client » (x 986, y 683)
90. « F9 » (x 1215, y 506)
91. « 0/3 » (x 1357, y 506)
92. « Exporter le dossier client » (x 1215, y 526)
93. « Format du dossier » (x 1236, y 563)
94. « Archive ZIP » (x 1236, y 593)
95. « Démo client » (x 1236, y 623)
96. « F5 » (x 415, y 566)
97. « 1/5 » (x 637, y 566)
98. « Envoyer les photos d'un tronçon » (x 415, y 586)
99. « Stockage des photos sur MinIO » (x 436, y 623)
100. « Route d'envoi des photos » (x 436, y 653)
101. « Écran d'envoi hors ligne » (x 436, y 683)
102. « Tests E2E de l'envoi » (x 436, y 713)
103. « Démo client » (x 436, y 743)
104. « en retard · glisse en S43 » (x 432, y 768)
105. « À faire » (x 283, y 960)
106. « En cours » (x 346, y 960)
107. « En review » (x 420, y 960)
108. « Bloqué » (x 499, y 960)
109. « Fonctionnalité » (x 570, y 960)
110. « Colonne = sprint » (x 677, y 960)
111. « Session active » (x 790, y 960)

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
        - **frame F6** (bloc) · x 695, y 216, 232 × 206 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 705, y 226, 212 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F6 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 705, y 226, 14 × 14
            - « 0/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 897, y 226, 20 × 14
          - « Importer les ISO depuis Excel » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 705, y 246, 212 × 15
          - **segs** (bloc) · x 705, y 267, 209 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 705, y 267, 50 × 5 · fond `red` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 758, y 267, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 811, y 267, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 864, y 267, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 705, y 278, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 713, y 286,5, 7 × 7 · fond `red` · dimension fixe/fixe
            - « Lecture du fichier Excel » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 283, 124 × 14
          - **box** (bloc) · x 705, y 308, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 316,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Contrôle des repères » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 313, 110 × 14
          - **box** (bloc) · x 705, y 338, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 346,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Écran d'import » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 343, 76 × 14
          - **box** (bloc) · x 705, y 368, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 376,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 373, 63 × 14
          - **box** (bloc) · x 705, y 398, 99 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start
            - icône `lock` 12 px, `red` — x 705, y 399, 12 × 12
            - « bloquée par Q14 » — Geist 11 / 400, interligne 1,2, couleur `red` — x 722, y 398, 82 × 14
        - **frame F4** (bloc) · x 405, y 276, 262 × 216 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 415, y 286, 242 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F4 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 286, 14 × 14
            - « 3/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 637, y 286, 20 × 14
          - « Saisir un tronçon hors ligne » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 415, y 306, 242 × 15
          - **segs** (bloc) · x 415, y 327, 242 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 415, y 327, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 464, y 327, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 513, y 327, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 562, y 327, 46 × 5 · fond `purple` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 611, y 327, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 415, y 338, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 346,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Schéma local des tronçons » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 343, 143 × 14
            - icône `merge` 11 px, `green` — x 638, y 344,5, 11 × 11
          - **box** (bloc) · x 415, y 368, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 376,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Formulaire de saisie » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 373, 105 × 14
            - icône `merge` 11 px, `green` — x 638, y 374,5, 11 × 11
          - **box** (bloc) · x 415, y 398, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 406,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Synchro au retour du réseau » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 403, 148 × 14
            - icône `merge` 11 px, `green` — x 638, y 404,5, 11 × 11
          - **box** (bloc) · x 415, y 428, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `brandLine` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 436,5, 7 × 7 · fond `purple` · dimension fixe/fixe
            - « Conflits de saisie » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 433, 90 × 14
            - **dot** (pastille) · x 626, y 437, 6 × 6 · fond `brand` · dimension fixe/fixe
            - icône `pr` 11 px, `amber` — x 638, y 434,5, 11 × 11
          - **box** (bloc) · x 415, y 458, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 466,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 463, 63 × 14
        - **frame F2** (bloc) · x 253, y 286, 126 × 81 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 263, y 296, 106 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F2 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 263, y 296, 14 × 14
            - « 5/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 331, y 296, 20 × 14
            - icône `circleCheck` 12 px, `green` — x 357, y 297, 12 × 12
          - « Voir ses ISO affectés » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 263, y 316, 106 × 30
          - **segs** (bloc) · x 263, y 352, 102 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 263, y 352, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 284, y 352, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 305, y 352, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 326, y 352, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 347, y 352, 18 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
        - **frame F8** (bloc) · x 695, y 436, 232 × 186 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 705, y 446, 212 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F8 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 705, y 446, 14 × 14
            - « 0/4 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 897, y 446, 20 × 14
          - « Valider les soudures par lot » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 705, y 466, 212 × 15
          - **segs** (bloc) · x 705, y 487, 209 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 705, y 487, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 758, y 487, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 811, y 487, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 864, y 487, 50 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 705, y 498, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 506,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Statuts de soudure » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 503, 100 × 14
          - **box** (bloc) · x 705, y 528, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 536,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Sélection multiple » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 533, 95 × 14
          - **box** (bloc) · x 705, y 558, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 566,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Validation par lot » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 563, 89 × 14
          - **box** (bloc) · x 705, y 588, 212 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 713, y 596,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 726, y 593, 63 × 14
        - **frame F7** (bloc) · x 955, y 496, 222 × 216 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 965, y 506, 202 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F7 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 965, y 506, 14 × 14
            - « 0/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1147, y 506, 20 × 14
          - « Rapport de chantier journalier » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 965, y 526, 202 × 15
          - **segs** (bloc) · x 965, y 547, 202 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 965, y 547, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1006, y 547, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1047, y 547, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1088, y 547, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1129, y 547, 38 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 965, y 558, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 566,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Modèle du rapport » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 563, 97 × 14
          - **box** (bloc) · x 965, y 588, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 596,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Génération PDF » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 593, 83 × 14
          - **box** (bloc) · x 965, y 618, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 626,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Photos dans le rapport » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 623, 119 × 14
          - **box** (bloc) · x 965, y 648, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 656,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Envoi le soir » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 653, 64 × 14
          - **box** (bloc) · x 965, y 678, 202 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 973, y 686,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 986, y 683, 63 × 14
        - **frame F9** (bloc) · x 1205, y 496, 182 × 156 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `mfg` dashed · rayon 10
          - **box** (bloc) · x 1215, y 506, 162 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F9 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 1215, y 506, 14 × 14
            - « 0/3 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 1357, y 506, 20 × 14
          - « Exporter le dossier client » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 1215, y 526, 162 × 15
          - **segs** (bloc) · x 1215, y 547, 162 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 1215, y 547, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1270, y 547, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 1325, y 547, 52 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 1215, y 558, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 566,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Format du dossier » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 563, 95 × 14
          - **box** (bloc) · x 1215, y 588, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 596,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Archive ZIP » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 593, 59 × 14
          - **box** (bloc) · x 1215, y 618, 162 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 1223, y 626,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 1236, y 623, 63 × 14
        - **frame F5** (bloc) · x 405, y 556, 262 × 236 · flex colonne, espacement 6, marges internes 10, alignement start/start · fond `bg` · bordure 1 `red` dashed · rayon 10
          - **box** (bloc) · x 415, y 566, 242 × 14 · flex ligne, espacement 6, marges internes 0, alignement center/start · dimension remplit/auto
            - « F5 » — Geist Mono 11 / 400, interligne 1,2, couleur `dim` — x 415, y 566, 14 × 14
            - « 1/5 » — Geist Mono 11 / 400, interligne 1,2, couleur `mfg` — x 637, y 566, 20 × 14
          - « Envoyer les photos d'un tronçon » — Geist 12,5 / 600, interligne 1,2, couleur `fg` — x 415, y 586, 242 × 15
          - **segs** (bloc) · x 415, y 607, 242 × 5 · flex ligne, espacement 3, marges internes 0, alignement center/start
            - **seg** (bloc) · x 415, y 607, 46 × 5 · fond `fg` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 464, y 607, 46 × 5 · fond `purple` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 513, y 607, 46 × 5 · fond `blue` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 562, y 607, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
            - **seg** (bloc) · x 611, y 607, 46 × 5 · fond `border` · rayon 1 · dimension fixe/fixe
          - **box** (bloc) · x 415, y 618, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 626,5, 7 × 7 · fond `green` · dimension fixe/fixe
            - « Stockage des photos sur MinIO » — Geist 11,5 / 400, interligne 1,2, couleur `dim` — x 436, y 623, 165 × 14
            - icône `merge` 11 px, `green` — x 638, y 624,5, 11 × 11
          - **box** (bloc) · x 415, y 648, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 656,5, 7 × 7 · fond `purple` · dimension fixe/fixe
            - « Route d'envoi des photos » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 653, 132 × 14
            - icône `pr` 11 px, `purple` — x 638, y 654,5, 11 × 11
          - **box** (bloc) · x 415, y 678, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `brandLine` · rayon 6 · dimension remplit/auto
            - **dot** (pastille) · x 423, y 686,5, 7 × 7 · fond `blue` · dimension fixe/fixe
            - « Écran d'envoi hors ligne » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 683, 124 × 14
            - **dot** (pastille) · x 626, y 687, 6 × 6 · fond `brand` · dimension fixe/fixe
            - icône `branch` 11 px, `blue` — x 638, y 684,5, 11 × 11
          - **box** (bloc) · x 415, y 708, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 716,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Tests E2E de l'envoi » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 713, 104 × 14
          - **box** (bloc) · x 415, y 738, 242 × 24 · flex ligne, espacement 6, marges internes 5 8 5 8, alignement center/start · fond `card` · bordure 1 `border` · rayon 6 · dimension remplit/auto
            - **ring** (pastille) · x 423, y 746,5, 7 × 7 · bordure 1,5 `dim` · dimension fixe/fixe
            - « Démo client » — Geist 11,5 / 400, interligne 1,2, couleur `fg` — x 436, y 743, 63 × 14
          - **box** (bloc) · x 415, y 768, 138 × 14 · flex ligne, espacement 5, marges internes 0, alignement center/start
            - icône `clockAlert` 12 px, `red` — x 415, y 769, 12 × 12
            - « en retard · glisse en S43 » — Geist 11 / 400, interligne 1,2, couleur `red` — x 432, y 768, 121 × 14
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
