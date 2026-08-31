---
baseline_commit: 0005403902c2f5847db4450da9285cb7bb9691f7
---

# Story 2.3: Corpus de missions professionnelles multi-secteurs, extraites de profils LinkedIn (skill `lk-scrapp-experiences`)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Chef,
I want un skill `lk-scrapp-experiences` qui recherche des profils LinkedIn dans un métier donné (dev, data, sécurité, DevOps, ...) selon une combinaison de filtres, et en extraie les missions réalisées lorsqu'elles sont qualitatives et détaillées,
so that je dispose d'un corpus de références concrètes de missions professionnelles, tous secteurs confondus, réutilisable pour enrichir mon CV et affiner mon positionnement freelance — sans me limiter au seul secteur bancaire.

## Acceptance Criteria

1. **Étant donné** un skill dédié nommé `lk-scrapp-experiences`, **quand** Chef l'invoque avec une combinaison de filtres parmi : Secteur (bancaire, communication, logistique, éditeur de logiciel, ...), Entreprise (SG, LCL, Airbus, ...), Poste (développeur, DevOps, data analyste, data engineer, ...), Compétence (Python, CI/CD, Kubernetes, ELK, ...), Durée des missions (ex. ≥1 mois, ≥1 an), Localisation du profil (France, Lyon, Angleterre, Arabie Saoudite, Japon, ...), et un nombre maximal de profils à vérifier (ex. 3, 10, 100), **alors** le skill utilise le MCP LinkedIn (`search_people`, `get_person_profile`) — avec fallback chrome-devtools si le MCP bloque — pour trouver des profils correspondant à la combinaison de filtres fournie, dans la limite du nombre maximal de profils demandé. Tous les filtres sont optionnels et combinables ; en l'absence de `max_profils` explicite, appliquer un plafond raisonnable par défaut (ex. 10) pour rester cohérent avec NFR2.
2. **Étant donné** un profil trouvé et ses missions listées, **quand** le skill évalue chaque mission, **alors** seules les missions jugées qualitatives et suffisamment détaillées (description concrète, stack technique identifiable) sont retenues — les entrées trop vagues ou non vérifiables sont ignorées et non écrites.
3. **Étant donné** une mission retenue, **quand** elle est enregistrée, **alors** elle est classée par branche métier dans `tools/linkedin-mcp/data/missions-realisees/missions-[branche].md` (un fichier par branche, créé à la volée selon les profils trouvés — pas de liste de branches fermée), structurée à l'identique du précédent manuel `missions-dev.md` (titre, poste, entreprise/secteur, durée, description de la mission, stack technique, profil source avec URL), enrichie des filtres identifiés quand disponibles (secteur, entreprise, compétences).
4. **Étant donné** le contrôle strict des permissions MCP (NFR2), **quand** ce scraping est exécuté, **alors** il reste une action ponctuelle déclenchée manuellement par Chef, borné par le paramètre `max_profils` — pas de scraping massif ni de polling automatique.
5. **Étant donné** des fichiers `missions-[branche].md` déjà alimentés (ex. `missions-dev.md`, `missions-devops.md`, `mission-data.md` — précédent manuel de la Story 2.3 initiale, scope bancaire), **quand** le skill est relancé avec de nouveaux filtres, **alors** il complète/étend ces fichiers existants sans les écraser ni dupliquer une mission déjà présente pour le même profil source.

## Tasks / Subtasks

- [x] Task 1 : Créer le skill `lk-scrapp-experiences` (AC: #1)
  - [x] Nouveau fichier `.claude/skills/lk-scrapp-experiences/SKILL.md`, structure single-file à l'image de `.claude/skills/generate-cv/SKILL.md` (frontmatter `name`/`description`, puis étapes)
  - [x] Définir la syntaxe d'invocation avec les filtres nommés (secteur, entreprise, poste, competence, duree, localisation, max_profils) — tous optionnels, combinables ; documenter la valeur par défaut de `max_profils` (ex. 10) si non fournie
  - [x] Description du skill (frontmatter) doit lister des exemples de déclenchement en langage naturel (ex. "cherche des missions data chez Airbus", "lk-scrapp-experiences secteur:logistique poste:devops max:5")
- [x] Task 2 : Recherche de profils via MCP LinkedIn, avec fallback (AC: #1)
  - [x] Utiliser `mcp__mcp-server-linkedin__search_people` puis `mcp__mcp-server-linkedin__get_person_profile` pour chaque profil trouvé, dans la limite de `max_profils`
  - [x] Si le MCP bloque (session invalide, `ERR_TOO_MANY_REDIRECTS` — voir Dev Notes), basculer sans interrompre la tâche sur `mcp__chrome-devtools__*` en réutilisant les patterns d'URL déjà validés (`/search/results/people/?keywords=...`, `/in/<slug>/details/experience/`) — comportement déjà documenté dans `AGENTS.md` racine, à appliquer tel quel
  - [x] Traduire les filtres (secteur, entreprise, poste, compétence, localisation) en requête `keywords`/paramètres de recherche adaptés à l'outil utilisé (MCP natif ou URL de recherche LinkedIn)
- [x] Task 3 : Filtrer la qualité des missions et déterminer la branche (AC: #2, #3)
  - [x] Pour chaque mission trouvée dans `experience`, écarter les entrées sans description concrète ou sans stack technique identifiable
  - [x] Appliquer le filtre `duree` quand fourni (comparer à la durée affichée du poste, ex. "1 an 2 mois")
  - [x] Déterminer la branche métier (dev, devops, data, sécurité, ...) à partir du poste/de la compétence recherchés ou du titre du profil — ne pas figer une liste fermée de branches
- [x] Task 4 : Écrire/compléter `tools/linkedin-mcp/data/missions-realisees/missions-[branche].md` (AC: #3, #5)
  - [x] Si le fichier de la branche existe déjà (ex. `missions-dev.md`), l'ouvrir et append en respectant sa structure existante plutôt que de l'écraser
  - [x] Dédupliquer par profil source (URL LinkedIn) + intitulé de mission avant d'écrire
  - [x] Conserver le format déjà en place dans `missions-dev.md` : titre de section, poste, entreprise/secteur, durée, description, stack technique, profil source avec URL
- [x] Task 5 : Vérification manuelle (AC: #1, #2, #4)
  - [x] Relancer le skill avec au moins une combinaison de filtres hors secteur bancaire (ex. secteur logistique ou éditeur de logiciel) pour confirmer que le skill n'est plus limité aux banques
  - [x] Confirmer que `max_profils` est bien respecté (ne pas dépasser la limite demandée)
  - [x] Confirmer qu'aucune mission vague/non détaillée n'est écrite

## Dev Notes

- **Aucune implémentation de skill n'existe encore pour ce flux** : le contenu actuel de `missions-dev.md`/`missions-devops.md`/`mission-data.md` a été produit manuellement (tool calls directs en session), sans skill formalisé. Cette story crée le premier skill réel — il n'y a pas de code existant à faire évoluer, seulement un format de sortie à respecter (voir `tools/linkedin-mcp/data/missions-realisees/missions-dev.md`).
- **Élargissement de scope (2026-08-31)** : cette story remplace la version initiale (scope banque uniquement, nom provisoire `/scrapp-profil-lk`). Le nom retenu est `lk-scrapp-experiences`. Ne pas restreindre la recherche à un secteur ou une liste d'entreprises fixe — tous les filtres (secteur, entreprise, poste, compétence, durée, localisation, max_profils) sont optionnels et combinables librement.
- **Précédent manuel à généraliser, pas à écraser** : `missions-dev.md` contient déjà 4 missions réelles (scope bancaire, LCL/BNP Paribas/Natixis/Société Générale). Le nouveau skill doit pouvoir continuer à alimenter ce fichier (branche `dev`) au même titre que tout autre fichier de branche à créer, sans dupliquer ces 4 entrées si le même profil ressort d'une recherche future.
- **Incohérence de nommage à noter** : le fichier existant `mission-data.md` est au singulier (`mission-`) alors que `missions-dev.md`/`missions-devops.md` sont au pluriel — probable erreur du test manuel initial. Décider lors de l'implémentation si on renomme en `missions-data.md` pour cohérence (impact : un seul fichier, gitignoré donc pas de contrepartie `.example.md` à gérer, cf. NFR1) ou si on conserve tel quel — trancher au moment de coder plutôt que de rouvrir la question ici.
- **Fallback MCP LinkedIn → chrome-devtools (déjà en place, à réutiliser tel quel)** : voir `AGENTS.md` racine, section "LinkedIn MCP — fallback Chrome DevTools MCP" (lignes 29-33). En résumé : si le MCP LinkedIn bloque (ex. `No valid LinkedIn session is available in Docker`, logs `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`), basculer sans interrompre sur `mcp__chrome-devtools__*` (session Chrome de l'utilisateur déjà authentifiée), signaler brièvement à l'utilisateur comment relancer la session MCP LinkedIn, et continuer en parallèle. Ce fallback a déjà été exercé avec succès lors du test manuel de cette story (voir note dans `missions-dev.md`) : recherche via URL `/search/results/people/?keywords=...`, puis lecture de chaque profil via `/in/<slug>/details/experience/` (contourne la troncature de la page profil principale).
- **Serveur MCP LinkedIn** : conteneur Docker défini dans `.mcp.json` (`linkedin-mcp-local:saved-posts`), monte `./tools/linkedin-mcp/data` → `/home/pwuser/.linkedin-mcp`. Outils pertinents pour cette story : `mcp__mcp-server-linkedin__search_people`, `mcp__mcp-server-linkedin__get_person_profile`.
- **Mécanisme de suivi par empreinte (Story 2.1)** : [[2-1-conseils-cv-extraits-des-posts-linkedin-enregistrés]] a mis en place un fichier de suivi (`posts-lus.md`) pour éviter de retraiter un même post. Un mécanisme analogue (suivi par URL de profil déjà scrappé) peut être pertinent ici pour éviter de re-scanner un profil déjà présent dans un fichier de branche — à évaluer à l'implémentation, non imposé par les AC.
- **NFR1 (confidentialité)** : `tools/linkedin-mcp/data/` est entièrement gitignoré (`.gitignore` racine, ligne 43) — aucune contrepartie `.example.md` nécessaire pour les fichiers `missions-*.md`.
- **NFR2 (permissions MCP)** : action manuelle et ponctuelle uniquement, bornée par `max_profils` — pas de polling, pas de scraping de masse même avec un `max_profils` élevé demandé explicitement par Chef (le skill exécute la demande, il ne doit juste jamais tourner en continu ou sans déclenchement explicite).
- **NFR3 (coût)** : skill Claude Code (abonnement Pro), pas d'appel API Anthropic facturé — à l'image de `generate-cv`/`generate-detailled-cv`.
- **Pas de changement backend/API** : cette story ne touche ni `api/` ni `extension/` — uniquement un nouveau skill Claude Code et des fichiers de données sous `tools/linkedin-mcp/data/`.

### Project Structure Notes

- Nouveau fichier skill : `.claude/skills/lk-scrapp-experiences/SKILL.md` (pattern single-file, cf. `.claude/skills/generate-cv/SKILL.md`).
- Fichiers de données : `tools/linkedin-mcp/data/missions-realisees/missions-[branche].md` — dossier déjà existant, fichiers `missions-dev.md`/`missions-devops.md`/`mission-data.md` déjà présents (à compléter, pas remplacer).
- Aucun fichier `api/` ou `extension/` à modifier pour cette story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: AGENTS.md#LinkedIn MCP — fallback Chrome DevTools MCP]
- [Source: .mcp.json] — configuration du serveur MCP LinkedIn (Docker)
- [Source: tools/linkedin-mcp/data/missions-realisees/missions-dev.md] — précédent manuel (format de sortie à respecter, scope bancaire à généraliser)
- [[2-1-conseils-cv-extraits-des-posts-linkedin-enregistrés]] — mécanisme d'appel MCP et de suivi déjà établi sur un flux voisin (conseils depuis saved posts)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Tasks 1-4 : skill `.claude/skills/lk-scrapp-experiences/SKILL.md` créé (frontmatter + filtres + étapes de recherche/filtrage qualité/écriture avec dédup et append).
- Task 5 (vérification manuelle, avec accord explicite de l'utilisateur) : skill invoqué en conditions réelles avec les filtres `poste: ingénieur sécurité informatique / RSSI`, `secteur: éditeur de logiciel`, `max_profils: 3`.
  - `search_people` (MCP) a fonctionné directement. `get_person_profile` (MCP) a échoué avec `ERR_TOO_MANY_REDIRECTS` (comportement déjà connu, cf. Dev Notes) — bascule sur le fallback chrome-devtools comme prévu par le skill, sans interruption de la tâche. Fallback confirmé fonctionnel.
  - 3 profils vérifiés (limite `max_profils` respectée) : Nicolas C. (ncampy), Claude Costantini, Guillaume Moirod.
  - 6 missions qualitatives retenues et écrites ; plusieurs missions vagues ou hors filtre rencontrées en cours de route ont été écartées (ex. rôles DSI/COO/Program Manager de Claude Costantini sans lien sécurité/devops ou secteur éditeur logiciel, projets clients courts de Guillaume Moirod chez Sopra Steria/CNP Assurances/SOFTEAM) — confirme le filtre qualité de la Task 3.
  - Nouvelle branche créée : `tools/linkedin-mcp/data/missions-realisees/missions-securite.md` (3 missions, secteur non-bancaire confirmé — Kosmiq IT, SOLWARE GROUP, Eureka Education) — démontre l'AC #1 (élargissement hors banque) et l'AC #5 (nouvelle branche créée à la volée).
  - Branche existante complétée : `tools/linkedin-mcp/data/missions-realisees/missions-devops.md` (3 missions ajoutées par append, sans écraser le header ni les futures entrées — Citégestion, Datanumia, Tinubu Square, toutes secteur éditeur logiciel) — démontre l'AC #5 (append sans écrasement). L'en-tête du fichier a aussi été mis à jour pour retirer la mention "en banque" désormais inexacte (fichier ouvert initialement en scope bancaire, généralisé ici).
  - Aucun doublon introduit : les 6 missions sont sur des profils/postes non présents dans les fichiers `missions-*.md` existants avant ce run.

### File List

- `.claude/skills/lk-scrapp-experiences/SKILL.md` (nouveau)
- `tools/linkedin-mcp/data/missions-realisees/missions-securite.md` (nouveau — gitignoré, cf. NFR1)
- `tools/linkedin-mcp/data/missions-realisees/missions-devops.md` (modifié — gitignoré, cf. NFR1)

## Change Log

- 2026-08-31 : Implémentation initiale — skill `lk-scrapp-experiences` créé, vérifié en conditions réelles (3 profils, filtres poste=RSSI/sécurité + secteur=éditeur de logiciel, max_profils=3). Fallback chrome-devtools exercé avec succès suite à un blocage MCP LinkedIn sur `get_person_profile`. Story passée en `review`.
- 2026-08-31 : Retour utilisateur post-review — le skill traitait les profils en lot (recherche puis écriture groupée en fin de run), risquant de perdre tout le travail déjà fait en cas d'interruption sur un run à `max_profils` élevé. `SKILL.md` révisé : traitement strictement séquentiel et incrémental (étape 3 restructurée en 3a-3d), une mission est écrite sur disque dès qu'elle est validée, et un point de statut est donné à l'utilisateur après chaque profil plutôt qu'un seul rapport final. N'affecte aucun des fichiers `missions-*.md` déjà écrits lors de la vérification manuelle.
