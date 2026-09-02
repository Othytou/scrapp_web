---
title: 'Génération d''expériences CV personnalisées (generate-mission-cv)'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '14496fc01cb9fa2f851a34ba66bdc5e7dc3b3282'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le corpus `missions-realisees/` et la table `hard-skills-missions.md` contiennent de quoi rédiger une expérience CV convaincante pour une mission réelle de Chef, mais aujourd'hui il doit composer et intégrer cette expérience à la main, sans aide pour choisir la formulation, les hard skills à mettre en avant, ni pour l'intégrer proprement dans les templates CV.

**Approach:** Un nouveau skill `generate-mission-cv` génère un brouillon d'expérience pour un client réel (fourni par Chef), inspiré du corpus de missions et de la table de couverture des hard skills, que Chef valide puis fait intégrer explicitement dans les templates CV court/détaillé.

## Boundaries & Constraints

**Always:**
- Client/employeur toujours réel et fourni par Chef — jamais de mission entièrement fictive.
- Un fichier par client : `tools/linkedin-mcp/data/missions-generees/<client-slug>.md`. Une nouvelle mission pour un client déjà présent (ex. "CIC DevOps" après "CIC dev Python") s'ajoute comme nouvelle entrée numérotée dans le même fichier — jamais un nouveau fichier, jamais d'écrasement des entrées déjà présentes (même logique d'append que `missions-realisees/missions-*.md`).
- Chaque entrée porte un champ `**ETAT :**` juste après `**Mission:**` (avant les réalisations/bullets) : `Brouillon — ne pas utiliser comme référence pour la génération de CV` par défaut ; passe à `Validé — intégré le JJ/MM/AAAA` une fois que Chef valide et que l'intégration template a eu lieu pour cette entrée.
- `hard-skills-missions.md` consultée pour la pertinence des hard skills, sans filtrer par statut (Couvert/Partiel/À traiter tous éligibles).
- Intégration dans `template/my_template_cv_court.html` / `template/my_template_cv_detaille.html` uniquement sur demande explicite de Chef après validation du brouillon — jamais automatique.
- Intégration respectant les conventions de markup existantes : `.entry`/`id="exp-N"`/`data-company`/`entry-bullets` (`data-keywords`) pour la page patchable ; `.mission-block`/`.mission-item` pour la section statique page 2 du CV détaillé.
- Jamais de modification des dates/entreprise/intitulé d'une expérience déjà présente dans un template — seul l'ajout de nouvelles entrées est permis.
- Pas de nouvel appel MCP LinkedIn déclenché automatiquement (NFR2) — signaler à Chef si le corpus est insuffisant.

**Ask First:** Confirmation explicite du brouillon à intégrer avant toute écriture dans un template. Si le corpus ne couvre pas le secteur/contexte demandé, demander à Chef s'il veut relancer `lk-scrapp-experiences` séparément plutôt que le faire automatiquement.

**Never:** Inventer ou modifier le client/employeur fourni par Chef. Écrire directement dans `api/agent_detaille.md`/`api/agent_court.md`. Toucher au CSS ou à la structure des templates au-delà de l'ajout d'entrées/mission-items. Déclencher `lk-scrapp-experiences` soi-même.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Génération simple | "génère une mission chez CIC, dev Python" | `missions-generees/cic.md` créé, entrée `## 1.` avec `**ETAT :** Brouillon...`, sources citées | N/A |
| Deuxième mission même client | `cic.md` existant (entrée #1) + demande "CIC DevOps" | Nouvelle entrée `## 2.` ajoutée à la fin de `cic.md`, l'entrée #1 intacte | N/A |
| Hard skill absent tel quel | Mission de référence en Node.js, hard skill réel visé = Python | Substitution de stack équivalente, mentionnée explicitement dans le brouillon | N/A |
| Corpus insuffisant | Aucune mission pertinente pour le secteur/hard skill visé | Signalé à Chef, pas d'appel à `lk-scrapp-experiences` | Message clair + suggestion de relance manuelle |
| Intégration après validation | "valide et intègre la mission CIC dev Python" | Ajout d'une entrée `.entry` (page patchable) et/ou `.mission-item` (page 2) dans les templates | Si le brouillon est introuvable, signaler sans rien modifier |

</frozen-after-approval>

## Code Map

- `.claude/skills/lk-scrapp-experiences/SKILL.md` -- pattern single-file skill à suivre (frontmatter + étapes)
- `.claude/skills/lk-hard-skill-missions/SKILL.md` -- pattern de lecture de `missions-realisees/`, matching mot-entier (~L49) et édition incrémentale ligne à ligne (Cas B, ~L202), réutilisables comme référence
- `tools/linkedin-mcp/data/missions-realisees/missions-*.md` -- corpus source (lecture seule), entrées `## N. Titre` avec Poste/Entreprise/Durée/Mission/Stack technique/Profil source
- `tools/linkedin-mcp/data/hard-skills-missions.md` -- table de référence (lecture seule), colonnes Hard skill/Catégorie/Missions/Statut/Cible mission/Références
- `tools/linkedin-mcp/data/missions-generees/<client-slug>.md` -- NOUVEAU, un fichier par client, entrées numérotées append-only à l'image de `missions-realisees/missions-*.md` (gitignoré via `tools/linkedin-mcp/data/`, `.gitignore:46`)
- `.claude/skills/generate-mission-cv/SKILL.md` -- NOUVEAU, single-file comme `.claude/skills/generate-cv/SKILL.md`
- `template/my_template_cv_court.html:139-146` -- structure `.entry`/`id="exp-N"`/`data-company`/`entry-bullets` (page patchable, CV court)
- `template/my_template_cv_detaille.html:221-260` -- même structure côté CV détaillé (page 1, patchable)
- `template/my_template_cv_detaille.html:413-437` -- structure `.mission-block`/`.mission-header`/`.mission-item` (page 2 statique "Missions & Réalisations Détaillées")
- `api/agent_detaille.md:195-207` -- règle "ne jamais inventer de nouvelles expériences ou entreprises" du pipeline de patch existant ; ce skill ne la viole pas (client toujours réel, intégration = action manuelle distincte)

## Tasks & Acceptance

**Execution:**
- [x] `.claude/skills/generate-mission-cv/SKILL.md` -- créer le skill (frontmatter avec exemples d'invocation + étapes : sélection des missions de référence, consultation `hard-skills-missions.md`, composition du brouillon, écriture, puis étape d'intégration séparée sur demande) -- cœur de la story
- [x] `tools/linkedin-mcp/data/missions-generees/` -- premier brouillon réel généré lors de la vérification manuelle -- preuve de fonctionnement

**Acceptance Criteria:** (reprises de `epics.md` Story 2.5)
- Given le nom d'un client réel + contexte de mission, when Chef invoque `generate-mission-cv`, then une entrée numérotée est ajoutée/créée dans `missions-generees/<client-slug>.md` avec `**ETAT:** Brouillon...`, avec traçabilité des missions sources
- Given un même client avec plusieurs missions distinctes demandées séparément, when chacune est générée, then chacune devient une nouvelle entrée numérotée dans le même fichier, sans écraser les entrées déjà présentes
- Given la table `hard-skills-missions.md`, when le brouillon est composé, then les hard skills pertinents sont considérés quel que soit leur statut
- Given un brouillon validé par Chef, when Chef demande explicitement l'intégration, then le skill ajoute l'expérience dans les templates réels selon les conventions de markup existantes -- jamais automatique
- Given un corpus insuffisant pour le contexte demandé, when le skill ne trouve rien de pertinent, then il le signale à Chef sans invoquer `lk-scrapp-experiences` lui-même

## Spec Change Log

**2026-09-03 — Implémentation initiale.** Skill `generate-mission-cv` créé en single-file (miroir de `generate-cv/SKILL.md`), en deux actions strictement séparées : génération (par défaut) et intégration template (uniquement sur demande explicite postérieure, jamais enchaînée). Nouveau skill rendu trackable via `.gitignore` (ajout de `!.claude/skills/generate-mission-cv` à la liste blanche existante — sans quoi la règle générale `.claude/skills/*` l'aurait laissé non versionné, comme pour les 4 autres skills single-file du projet).

Vérification manuelle live (preuve de fonctionnement, cf. Tasks & Acceptance) : génération réelle de `tools/linkedin-mcp/data/missions-generees/cic.md` pour le client CIC (repris tel quel de l'exemple du frozen Intent/I/O Matrix), en deux passes séparées — entrée `## 1.` (dev Python, avec substitution de stack explicite Python nu → Django pour cibler un hard skill "Cible mission = Oui" À traiter) puis, dans un second temps, ajout de l'entrée `## 2.` (DevOps) par édition ciblée (append), sans réécriture du fichier. Vérifié par comparaison de checksum (`md5`) des 41 premières lignes du fichier avant/après le second ajout : identique — confirme que l'entrée `## 1.` (y compris son `**ETAT :**`) reste intacte. Les deux entrées citent leurs missions de référence (`missions-dev.md#7`, `missions-dev.md#4`, `missions-devops.md#5`, `missions-devops.md#4`) et les lignes `hard-skills-missions.md` consultées, tous statuts confondus.

L'étape 2 (Intégration dans `my_template_cv_court.html`/`my_template_cv_detaille.html`) n'a délibérément **pas** été exercée en conditions réelles lors de cette implémentation : le frozen Intent classe explicitement cette action en "Ask First" (confirmation du brouillon avant toute écriture template) et "Never" pour toute intégration non explicitement demandée — écrire dans les templates réels de Chef sans qu'il ait validé un brouillon précis violerait cette frontière. La logique d'intégration (numérotation `exp-N` indépendante par fichier, comparaison de stack pour le choix du `.mission-block` cible, mise à jour ciblée du champ `**ETAT :**` uniquement) est documentée dans le skill (étape 2) mais reste à exercer en direct lors d'une prochaine demande d'intégration réelle de Chef.

**2026-09-03 — Matrix Test Audit (ligne "Corpus insuffisant").** Ligne non exercée par le sous-agent d'implémentation initiale — comblée directement : skill invoqué en conditions réelles avec `client: CIC`, `contexte: blockchain / smart contracts Solidity` (confirmé absent de `missions-realisees/*.md` et de `hard_skills.html`/`hard-skills-missions.md` par recherche exhaustive avant le test). Comportement observé conforme à l'étape 1c : aucune écriture dans `cic.md` (checksum `md5` identique avant/après : `1b750babb996f4937418af0ac96432f9`), le skill signale le manque de corpus plutôt que d'inventer une mission ou de déclencher `lk-scrapp-experiences` lui-même. Les deux entrées existantes (`## 1.`, `## 2.`) restent intactes. La ligne "Intégration après validation" reste volontairement non exercée pour la raison exposée ci-dessus (frontière Ask First/Never — touche des templates de production sans demande réelle de Chef) ; à couvrir lors d'une prochaine demande d'intégration authentique.

## Design Notes

Choix du `.mission-block` cible (page 2) : comparer la stack de la nouvelle mission au `mission-domain-sub` des blocs existants (ex. "Python · Pandas · NumPy · Scikit-learn · PostgreSQL") — recouvrement majoritaire → ajouter un `.mission-item` dans ce bloc ; sinon créer un nouveau `.mission-block`. Exemple validé avec Chef : une mission SIRH (`missions-dev.md#1`, Django/PostgreSQL) peut être rattachée à un bloc Python existant plutôt qu'un nouveau domaine, si la stack recouvre suffisamment.

Slug : kebab-case sur le nom du client uniquement (ex. "CIC" → "cic") — le contexte de mission (ex. "dev Python") ne sert qu'au titre de l'entrée numérotée, pas au nom de fichier, puisqu'un client n'a qu'un seul fichier.

Champ `**ETAT:**` : place juste après `**Mission:**`, avant les bullets de réalisations (voir exemple fourni par Chef). Deux valeurs possibles — `Brouillon — ne pas utiliser comme référence pour la génération de CV` (par défaut) et `Validé — intégré le JJ/MM/AAAA` (mis à jour par le skill au moment de l'intégration template, jamais avant). Une fois `Validé`, l'entrée redevient elle-même une référence légitime pour de futures générations (au même titre que `missions-realisees/`).

## Verification

**Manual checks (if no CLI):**
- Invoquer `generate-mission-cv` avec un client réel + contexte ; vérifier la création de `missions-generees/<client-slug>.md` avec une entrée `## 1.` portant `**ETAT:** Brouillon...` et les sources citées.
- Relancer avec le même client, un contexte différent ; vérifier qu'une entrée `## 2.` s'ajoute dans le même fichier, sans toucher à l'entrée `## 1.`.
- Demander une mission dont le hard skill réel visé est absent tel quel des missions de référence mais dont une stack équivalente y figure (ex. référence en Node.js, hard skill visé = Python) ; vérifier que le brouillon effectue la substitution et la mentionne explicitement, plutôt qu'une substitution silencieuse.
- Demander une mission pour un secteur/hard skill sans aucune mission pertinente dans le corpus ; vérifier que le skill le signale clairement à Chef sans écrire de brouillon et sans invoquer `lk-scrapp-experiences` lui-même.
- Après validation d'un brouillon, déclencher l'intégration ; vérifier dans `my_template_cv_court.html` et `my_template_cv_detaille.html` qu'une nouvelle entrée `.entry` et/ou `.mission-item` apparaît avec un markup cohérent, sans rien modifier d'existant.

## Suggested Review Order

**Séparation stricte génération / intégration (cœur du frozen Intent)**

- Les deux actions du skill, jamais enchaînées implicitement.
  [`SKILL.md:91`](../../.claude/skills/generate-mission-cv/SKILL.md#L91)

- Garde-fou "jamais d'intégration automatique" explicite.
  [`SKILL.md:156`](../../.claude/skills/generate-mission-cv/SKILL.md#L156)

**Sélection des références et corpus insuffisant**

- Garde-fou anti-fragmentation : avant de créer un nouveau fichier client, vérifie qu'un fichier existant ne désigne pas déjà le même client réel sous une autre graphie.
  [`SKILL.md:34`](../../.claude/skills/generate-mission-cv/SKILL.md#L34)

- Une entrée `Brouillon` n'est jamais une référence valide ; seule une entrée `Validé` l'est.
  [`SKILL.md:42`](../../.claude/skills/generate-mission-cv/SKILL.md#L42)

- Signalement du corpus insuffisant (arrêt total) sans déclencher `lk-scrapp-experiences` (NFR2), distingué de l'insuffisance partielle (ne bloque pas, hard skill précis simplement flaggé).
  [`SKILL.md:44`](../../.claude/skills/generate-mission-cv/SKILL.md#L44)

**Format d'entrée et champ `**ETAT :**`**

- Placement du champ juste après `**Mission :**`, avant les bullets.
  [`SKILL.md:54`](../../.claude/skills/generate-mission-cv/SKILL.md#L54)

**Intégration template (logique documentée, non exercée en direct — cf. Spec Change Log)**

- Garde-fou anti-doublon : refuse de ré-intégrer silencieusement une entrée déjà `Validé`, demande confirmation à Chef.
  [`SKILL.md:97`](../../.claude/skills/generate-mission-cv/SKILL.md#L97)

- Garde-fou Durée placeholder : bloque l'intégration tant que `**Durée :**` reste "À préciser", pour ne jamais écrire ce texte dans un template en production.
  [`SKILL.md:103`](../../.claude/skills/generate-mission-cv/SKILL.md#L103)

- Numérotation `exp-N` indépendante par fichier.
  [`SKILL.md:109`](../../.claude/skills/generate-mission-cv/SKILL.md#L109)

- Insertion en fin de section sans toucher aux entrées déjà présentes.
  [`SKILL.md:129`](../../.claude/skills/generate-mission-cv/SKILL.md#L129)

- Choix du `.mission-block` cible par comparaison de stack (recouvrement majoritaire, avec renvoi à Chef en cas d'égalité).
  [`SKILL.md:136`](../../.claude/skills/generate-mission-cv/SKILL.md#L136)

- Mise à jour ciblée du champ `**ETAT :**` uniquement, après écriture de **toutes** les cibles demandées avec succès (jamais sur intégration partielle).
  [`SKILL.md:145`](../../.claude/skills/generate-mission-cv/SKILL.md#L145)

**Preuve d'exécution réelle**

- Story 2.5 telle qu'approuvée, source des AC opérationnalisées par ce spec.
  [`epics.md`](../planning-artifacts/epics.md)

- Brouillon réel généré (2 entrées, client CIC) — cf. Spec Change Log pour le détail de la vérification par checksum.
  [`missions-generees/cic.md:1`](../../tools/linkedin-mcp/data/missions-generees/cic.md#L1)

**Périphériques**

- Nouveau skill rendu trackable (miroir de `lk-scrapp-experiences`/`lk-hard-skill-missions`).
  [`.gitignore:41`](../../.gitignore#L41)
