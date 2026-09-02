---
title: 'Couverture missions par hard skill (lk-hard-skill-missions)'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '3f7bc49a627a67d7516099de73c30bf8ea0eb5bf'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le corpus de missions (`missions-realisees/`) n'indique pas quels hard skills du référentiel (`template/hard_skills.html`, ~227 skills) manquent de preuves concrètes de mission — Chef ne sait pas où concentrer l'effort de scraping.

**Approach:** Un nouveau skill `lk-hard-skill-missions` construit/actualise une table de suivi (un hard skill par ligne, statut Couvert/Partiel/À traiter), en scannant d'abord les missions existantes, puis en relançant `lk-scrapp-experiences` ciblé sur un hard skill (ou petit lot choisi par Chef) sous le seuil de 3 missions.

## Boundaries & Constraints

**Always:**
- Un hard skill individuel par ligne — les regroupements virgule OU slash dans `hard_skills.html` (ex. "Django, FastAPI, Flask", "Netmiko/NAPALM", "Jest / Vitest") sont éclatés ; les noms composés sans délimiteur (ex. "SQL Server", "API REST", "Load Balancing") restent entiers.
- Association hard skill ↔ mission par correspondance mot-entier insensible à la casse sur le champ "Stack technique" de chaque entrée `missions-*.md` — jamais une simple sous-chaîne (ex. "Java" ne doit pas matcher "JavaScript").
- Table mise à jour ligne par ligne / incrémentalement, jamais réécrite intégralement.
- Toute nouvelle recherche LinkedIn passe par `lk-scrapp-experiences` (`competence: <hard skill>`) — ce skill ne réimplémente pas de logique de scraping.
- Un hard skill (ou lot explicitement choisi par Chef) à la fois — jamais un déclenchement automatique sur l'ensemble des hard skills sous le seuil (NFR2).

**Ask First:** Aucune — la Story 2.4 (`epics.md`) et ses AC couvrent déjà les décisions produit ; ce spec ne fait qu'opérationnaliser.

**Never:** Ne pas dupliquer le texte des missions dans la table (uniquement des références courtes vers `missions-[branche].md#N`) ; ne pas modifier `lk-scrapp-experiences/SKILL.md` ; ne pas toucher `api/` ni `extension/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Construction initiale | Table absente | Table créée avec les ~227 hard skills, comptage/statut calculés depuis `missions-*.md` existants | N/A |
| Hard skill déjà couvert (≥3) | 3+ missions déjà matchées | Statut "Couvert", pas d'appel à `lk-scrapp-experiences` | N/A |
| Combler un hard skill sur demande | Chef demande de combler "Jenkins" | Invoque `lk-scrapp-experiences competence:Jenkins`, met à jour la ligne | Si 0 nouvelle mission trouvée, statut reste "Partiel"/"À traiter", le signaler explicitement |
| Ligne `hard_skills.html` multi-skills | "Django, FastAPI, Flask" ou "Jest / Vitest" | Éclatée en lignes individuelles distinctes | N/A |
| Faux positif substring | Stack technique contient "JavaScript" | Ne compte pas comme match pour le hard skill "Java" | N/A |

</frozen-after-approval>

## Code Map

- `template/hard_skills.html` -- source de vérité des hard skills (227 entrées, 11 groupes `skill-group-title`, lignes à éclater sur `,` et/ou `/`, jamais sur l'espace)
- `tools/linkedin-mcp/data/missions-realisees/missions-*.md` -- corpus existant à scanner (champ "Stack technique" de chaque entrée numérotée `## N. ...`)
- `.claude/skills/lk-scrapp-experiences/SKILL.md` -- skill réutilisé tel quel pour combler un écart (paramètre `competence`) ; ne pas modifier
- `.claude/skills/lk-hard-skill-missions/SKILL.md` -- NOUVEAU, single-file comme `.claude/skills/generate-cv/SKILL.md`
- `tools/linkedin-mcp/data/hard-skills-missions.md` -- NOUVEAU, table de suivi (gitignoré via `tools/linkedin-mcp/data/`, cf. NFR1)
- `_bmad-output/planning-artifacts/epics.md` -- Story 2.4, source des AC (référence, ne pas modifier ici)

## Tasks & Acceptance

**Execution:**
- [x] `.claude/skills/lk-hard-skill-missions/SKILL.md` -- créer le skill (frontmatter + étapes : parser `hard_skills.html`, scanner `missions-*.md`, construire/actualiser la table, invoquer `lk-scrapp-experiences` sur demande ciblée) -- cœur de la story
- [x] `tools/linkedin-mcp/data/hard-skills-missions.md` -- initialiser la table lors du premier run réel -- preuve de fonctionnement

**Acceptance Criteria:** (reprises de `epics.md` Story 2.4 — voir ce fichier pour le détail complet)
- Given `hard_skills.html`, when le skill construit/actualise la table, then une ligne par hard skill individuel avec nom, catégorie, nb missions, statut, références courtes
- Given les fichiers `missions-*.md` existants, when la table est construite, then l'association se fait d'abord par recherche mot-entier dans "Stack technique", avant toute recherche LinkedIn
- Given un hard skill sous 3 missions, when Chef demande de combler l'écart pour ce hard skill (ou un petit lot choisi), then `lk-scrapp-experiences competence:<hard skill>` est invoqué -- jamais automatiquement sur l'ensemble
- Given une nouvelle mission rattachée, when la table est mise à jour, then la mise à jour est incrémentale (pas de réécriture intégrale)
- Given le nombre de missions rattachées, when le statut est affiché, then il vaut Couvert (≥3) / Partiel (1-2) / À traiter (0)

## Spec Change Log

**2026-09-02 — Implémentation initiale.** Résolution d'une ambiguïté du frozen Intent / Design Notes : la règle générale "séparer sur `,` OU `/`" entre en conflit avec l'exemple des Design Notes citant `CI/CD` comme nom de hard skill entier (non éclaté) à faire correspondre par regex, alors que l'Intent cite explicitement `Netmiko/NAPALM` comme devant être éclaté — les deux sont des `/` sans espace. Résolu par une liste explicite documentée dans `.claude/skills/lk-hard-skill-missions/SKILL.md` (étape 1) : un `/` entouré d'espace(s) est toujours éclaté (OU délibéré, ex. "Jest / Vitest", "CVE / CVSS") ; un `/` sans espace reste entier par défaut (comportement sûr), avec `Netmiko/NAPALM` comme seule exception connue à éclater. Résultat : 239 hard skills individuels après éclatement (vs ~227 lignes brutes du référentiel) — l'écart vient des regroupements virgule/slash réellement éclatés, l'approximation "~227" du spec désignant le nombre de lignes brutes avant éclatement (confirmé : `template/hard_skills.html` contient exactement 227 lignes brutes).

Autre écart constaté : la section Verification cite "Java" comme exemple de hard skill déjà bien couvert par le corpus (`missions-dev.md`/`missions-devops.md`) — or `template/hard_skills.html` ne contient pas d'entrée "Java" (seulement "JavaScript"). Le skill ne l'ajoute pas (le référentiel est une source de vérité externe à ne pas modifier ici) ; "Docker" et "Kubernetes", également cités, sont bien présents et affichent les statuts attendus (Couvert / Partiel).

**2026-09-02 — Vérification live du scénario "combler un hard skill sur demande" (Matrix Test Audit).** Ce scénario n'avait pas été exercé lors de l'implémentation initiale (aucun appel LinkedIn réel effectué). Avec l'accord explicite de Chef, test réel sur le hard skill `SonarQube` (Partiel, 1 mission) : MCP LinkedIn indisponible (`ERR_TOO_MANY_REDIRECTS` sur `search_people`), fallback chrome-devtools exercé avec succès (comme prévu par `lk-scrapp-experiences`). 1 profil vérifié (Paul FOUMANE, SysOps Data chez EDF) → 1 mission qualitative retenue, écrite dans `missions-realisees/missions-data.md` (première entrée de ce fichier, jusqu'ici vide). Table `hard-skills-missions.md` mise à jour par édition ciblée de la seule ligne `SonarQube` (1 → 2 missions, reste Partiel) — confirme le comportement d'édition incrémentale (pas de réécriture globale) et le fait qu'un statut inchangé est correctement reflété plutôt que forcé à "Couvert". Note : par design (étape 5 du skill), seule la ligne du hard skill demandé est recalculée — les autres hard skills présents dans le stack technique de cette nouvelle mission (Terraform, Kubernetes, Kafka, GCP, CI/CD, NoSQL, etc.) ne sont pas mis à jour automatiquement ; ils le seront lors d'un rafraîchissement global ou d'une demande ciblée les concernant.

**2026-09-02 — Boucle de revue de code (3 couches parallèles).** 11 findings retenus après triage (dédup + lecture du code source, pas seulement du diff) :
- **Patch (corrigés dans `SKILL.md` et/ou `hard-skills-missions.md`)** : référence de tri des colonnes "Références" ajoutée (glob-trié, comme le script) + réordonnancement de la ligne SonarQube pour correspondre ; robustesse de `parse_hard_skills` (plus de crash `ValueError` si un bloc de groupe n'a pas de retour à la ligne) ; le script signale désormais (`print`) tout terme `/`-sans-espace inconnu au lieu de rester silencieux ; caveat documenté pour le cas (actuellement inexistant) d'un segment mélangeant `/` espacé et non-espacé ; Cas B gère désormais un fichier table vide/corrompu (fallback Cas A) ; Étape 5 valide maintenant le(s) nom(s) de hard skill demandé(s) avant tout appel LinkedIn (protection typo) ; Étape 5 ajoute un garde-fou explicite sur la taille de lot (>5 hard skills demandés en une fois → confirmation requise, y compris si Chef demande explicitement "tout traiter", pour rester dans l'esprit NFR2) ; Étape 5 distingue désormais "0 mission trouvée" d'un échec propre de `lk-scrapp-experiences` ; Étape 2 précise le cas corpus vide/inexistant (0 mission partout, pas une erreur).
- **Vérification directe de la ligne matrix "Faux positif substring"** (jusqu'ici non exercée sur données réelles faute d'entrée "Java" dans le référentiel) : test unitaire direct de `word_boundary_pattern` — confirmé `Java` ne matche pas dans "...JavaScript..." (False) et matche bien dans "Java, Spring Boot" (True) ; `SQL` ne matche pas dans "...MySQL, MariaDB." (False) et matche dans "SQL, PostgreSQL" (True). Ferme la lacune de vérification sans fabriquer de fausses données corpus.
- **Rafraîchissement complet re-calculé et appliqué** (script relancé localement, aucun nouvel appel LinkedIn) suite à l'ajout de la mission SonarQube/EDF : `Kubernetes` (2→3, franchit le seuil, devient Couvert), `Terraform` (3→4, reste Couvert), `Kafka` (0→1, devient Partiel). Un diff complet table-vs-régénération-script confirme ensuite 0 écart restant sur les 239 lignes.
- **Deferred (voir `deferred-work.md`)** : pas de gestion des synonymes/abréviations de hard skill (JS/JavaScript, K8s/Kubernetes, Postgres/PostgreSQL) ; pas de détection de dérive du référentiel `hard_skills.html` (skill ajouté/renommé/supprimé) dans le temps ; comportement de dédup par `(catégorie, nom)` (une même compétence dans 2 catégories = 2 lignes) jamais explicitement discuté comme voulu.
- **Rejeté (bruit / faux positifs vérifiés)** : "C" matchant dans "C++"/"C#" (aucun hard skill "C" seul dans le référentiel) ; incohérence apparente "~227 vs 239" entre epics.md et SKILL.md (epics.md annonce déjà des regroupements, pas une contradiction) ; formats alternatifs du champ Stack technique (déjà géré par design — champ différemment nommé = exclu et signalé) ; imprécisions de la classe de caractères accentués (aucun impact réel, aucun hard skill concerné) ; "spec incomplet / balise non fermée" et "aucune preuve d'exécution" (faux positifs dus à un extrait tronqué fourni à un des reviewers — le fichier réel est complet et l'exécution réelle est vérifiée) ; "dates incohérentes avec la date du jour" (2026-09-02 est bien la date réelle du jour).

## Design Notes

Matching robuste : regex mot-entier insensible à la casse sur le nom exact du hard skill (échapper les caractères spéciaux : `/`, `.`, `+`, `(`, `)` — ex. "CI/CD", "Node.js", "C++", "OAuth 2.0") contre le champ "Stack technique" complet de chaque entrée. Pas besoin de pré-découper en tokens : la frontière de mot suffit à éviter les faux positifs (`\bJava\b` ne matche pas "JavaScript").

Split de `hard_skills.html` : séparer chaque ligne sur `,` OU `/`, puis nettoyer les espaces de chaque segment — ne jamais séparer sur l'espace seul (ex. "SQL Server", "Load Balancing", "API REST" doivent rester entiers).

## Verification

**Manual checks (if no CLI):**
- Exécuter le skill une fois, vérifier que `hard-skills-missions.md` contient bien ~227 lignes (nombre de hard skills individuels après éclatement des regroupements) et que des hard skills déjà bien présents dans le corpus existant (ex. "Docker", "Kubernetes", "Java" d'après `missions-dev.md`/`missions-devops.md`) affichent le bon statut.
- Vérifier manuellement qu'un hard skill absent du corpus (statut "À traiter") déclenche bien `lk-scrapp-experiences` quand on demande explicitement de le combler.

## Suggested Review Order

**Règle de découpage du référentiel (source de la plupart des décisions de conception)**

- Point d'entrée : la règle de split virgule/slash, cœur de la logique de parsing.
  [`SKILL.md:23`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L23)

- Le script de référence traduit cette règle en code, avec le signalement des cas slash inconnus.
  [`SKILL.md:80`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L80)

**Matching mot-entier (garde-fou anti-faux-positif)**

- Regex à lookaround explicite plutôt que `\b` simple, pour gérer `C++`/`(DDD)`.
  [`SKILL.md:49`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L49)

- Implémentation du script de référence, vérifiée en direct (Java/JavaScript, SQL/MySQL).
  [`SKILL.md:168`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L168)

**Construction vs. mise à jour incrémentale (résilience)**

- Cas A : écriture complète, seule situation légitime (rien à préserver).
  [`SKILL.md:65`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L65)

- Cas B : édition ligne par ligne uniquement, jamais de réécriture globale — ajout du fallback fichier vide/corrompu.
  [`SKILL.md:202`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L202)

**Comblement ciblé (frontière NFR2)**

- Validation du nom demandé, garde-fou de taille de lot, distinction échec vs 0-résultat.
  [`SKILL.md:212`](../../.claude/skills/lk-hard-skill-missions/SKILL.md#L212)

**Preuve d'exécution réelle**

- Story 2.4 telle qu'approuvée, source des AC opérationnalisées par ce spec.
  [`epics.md:233`](../planning-artifacts/epics.md#L233)

- Première mission réelle du fichier (test live du scénario "combler", cf. Spec Change Log).
  [`missions-data.md:15`](../../tools/linkedin-mcp/data/missions-realisees/missions-data.md#L15)

- Table générée, recalculée et vérifiée sans écart contre le script de référence.
  [`hard-skills-missions.md:1`](../../tools/linkedin-mcp/data/hard-skills-missions.md#L1)

**Périphériques**

- Nouveau skill rendu trackable (miroir de `lk-scrapp-experiences`).
  [`.gitignore:40`](../../.gitignore#L40)
