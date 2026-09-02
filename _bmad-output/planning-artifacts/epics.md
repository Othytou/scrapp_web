---
stepsCompleted: ["requirements-extracted", "requirements-confirmed", "epics-approved", "stories-created", "validated"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-scrapp_web-2026-08-14/prd.md"
  - "AGENTS.md"
  - "extension/AGENTS.md"
  - "api/AGENTS.md"
note: "Remplace l'ancien epics.md lightweight (pré-PRD) — la story cron qu'il contenait est reprise en item backlog sous Epic 1 (voir Additional Requirements)."
---

# scrapp_web - Epic Breakdown

## Overview

Ce document décompose en epics et stories les exigences du PRD `prd-scrapp_web-2026-08-14`, complétées par le contexte technique des trois `AGENTS.md` du repo (tenant lieu d'Architecture.md, absente pour ce projet brownfield personnel).

## Requirements Inventory

### Functional Requirements

FR1: Capture d'offre multi-sites — l'utilisateur peut copier une offre depuis un site supporté (Indeed, Free-Work configurés ; LinkedIn, Welcome to the Jungle, HelloWork à compléter) et la voir enregistrée en base sans intervention manuelle. Statut initial `captured` ; aucun appel LLM déclenché à la capture.

FR2: Génération de CV sur abonnement Pro — l'utilisateur peut déclencher le skill `generate-cv` pour transformer toute offre en attente en CV HTML + PDF adapté, sans appel API facturé. Le patch respecte le schéma `agent.md` ; HTML/PDF écrits dans `output/`/`pdf/` ; statut de l'offre passe à `generated`.

FR3: Reformatage du template CV — le template CV peut être retravaillé visuellement sans casser le contrat de patch existant (préserve les ids/data-attributes utilisés par `html_patcher.py`, sauf décision contraire explicite).

FR4: Ajout de nouveaux sites job-board — l'utilisateur peut ajouter le support d'un nouveau site (sélecteurs CSS header/description/tags) sans modifier le backend.

FR5: Analyse de profil expert — l'utilisateur peut soumettre un profil LinkedIn (ou Malt, via données croisées) d'un expert reconnu dans un domaine et obtenir une analyse via le MCP LinkedIn, portant uniquement sur du contenu public.

FR6: Liste de conseils applicables — l'utilisateur reçoit une liste de conseils concrets issus de l'analyse, étiquetés selon où l'appliquer (LinkedIn, Malt, ou CV), cohérents avec la possibilité de plusieurs casquettes professionnelles sur son propre LinkedIn.

FR7: Extraction d'offre depuis un post LinkedIn — l'utilisateur peut soumettre un post LinkedIn (ex : annonce de mission freelance) et en extraire automatiquement les informations structurées (stack technique, lieu, télétravail, date de démarrage, TJM, contact). Alimente le même pipeline de capture que le webhook existant (statut `captured`).

FR8: Vue consolidée des candidatures — l'utilisateur peut consulter une vue exploitable de ses candidatures (statuts, dates, taux de réponse) au-delà des endpoints bruts actuels (`/applications`, `/stats`).

FR9: Suivi enrichi des réponses — le suivi de statut capture explicitement si et quand une réponse a été reçue à une candidature, pas seulement le statut final.

### NonFunctional Requirements

NFR1 (Confidentialité) : Aucune vraie donnée personnelle ne doit être committée dans Git. Tout fichier avec de vraies informations doit avoir une contrepartie générique (`*.example.html`) committable, créée **au moment même** de sa création.

NFR2 (Sécurité / ToS MCP) : Contrôle strict des permissions du MCP LinkedIn dès le départ — lecture ciblée uniquement, pas de polling automatique, pas d'extension de permissions sans décision explicite ultérieure.

NFR3 (Coût) : Le pipeline de génération CV, et par défaut toute nouvelle feature impliquant un LLM, utilise l'abonnement Claude Pro (skill Claude Code) plutôt que l'API Anthropic facturée, sauf justification explicite (ex : volume dépassant les limites de l'abonnement).

### Additional Requirements

*(issues des trois `AGENTS.md`, en l'absence d'Architecture.md formelle)*

- Ne jamais modifier `.env` directement — modifier `.env.example` à la place ; si `.env` lui-même doit changer, le signaler à l'utilisateur qui s'en charge.
- Ne jamais `git commit` ni `git push` (local ou prod) — reste exclusivement à l'utilisateur.
- TDD préféré dès que possible pour les nouveaux développements.
- Le MCP chrome-devtools ne charge pas l'extension Chrome (confirmé 2026-08-14) — la vérification de l'extension reste manuelle côté utilisateur ; côté agent, vérifier le backend directement (curl, pytest) plutôt que de retenter le chargement via MCP.
- Sélecteurs de site dupliqués entre `extension/content.js` (`config.siteSelectors`) et `extension/background.js` (`siteSelectors`, raccourci `Ctrl+Shift+M`, n'appelle pas le webhook) — toute config de site doit être répliquée dans les deux.
- Nouveau site job-board : `extension/manifest.json` (`host_permissions` + `content_scripts.matches`) doit aussi être mis à jour, en plus des sélecteurs.
- Contrat du patch JSON (`agent.md`, section "Format de retour JSON") : `inject_skills` est un **tableau** `{container_id, skills}`, pas un dict — `html_patcher.py`, `finalize_cv.py` et le skill `generate-cv` doivent rester synchronisés si ce schéma change.
- Accès DB entièrement async (asyncpg + SQLAlchemy `AsyncSession`) — jamais de session sync.
- Backlog différé (repris de l'ancien `epics.md`, hors scope v1 — voir PRD §6) : automatisation cron du déclenchement du skill `generate-cv` en mode headless (`claude -p`), pour faire tourner le pipeline sans session interactive ouverte. Non engagée en v1.
- Pitfall connu, non bloquant sauf story touchant aux migrations : `init_db.sh` relance `alembic init db/migrations` sans condition à chaque démarrage du container, ce qui échoue après le premier démarrage.

### UX Design Requirements

Aucun document UX formel pour ce projet. Décision explicite (2026-08-14) : pas de spec UX pour l'instant ; à réévaluer au cas par cas sur les stories Epic 3 (CRM) si le besoin se fait sentir, sans obligation.

### FR Coverage Map

```
FR1: Epic 1 - Capture d'offre multi-sites
FR2: Epic 1 - Génération de CV sur abonnement Pro
FR3: Epic 1 - Reformatage du template CV
FR4: Epic 1 - Ajout de nouveaux sites job-board
FR5: Epic 2 - Analyse de profil expert
FR6: Epic 2 - Liste de conseils applicables
FR7: Epic 2 - Extraction d'offre depuis un post LinkedIn
FR8: Epic 3 - Vue consolidée des candidatures
FR9: Epic 3 - Suivi enrichi des réponses
```

## Epic List

### Epic 1: Génération de CV ciblée (cœur du pipeline)
Chef capture une offre depuis n'importe quel job-board supporté et obtient un CV ciblé, ATS-optimisé, sans réécriture manuelle. Couvre la capture multi-sites, la génération sur abonnement Pro, le reformatage visuel du template, et l'ajout de nouveaux sites.
**FRs covered:** FR1, FR2, FR3, FR4
**Statut :** pipeline FR1/FR2 déjà fonctionnel en prod — les stories de cet epic ne couvrent que le delta restant (FR3, FR4).

### Epic 2: Intelligence LinkedIn
Chef analyse le profil d'experts reconnus pour en tirer des conseils applicables (LinkedIn, Malt, CV), et peut transformer un post LinkedIn repéré dans son feed en offre capturée au même titre qu'un job-board classique.
**FRs covered:** FR5, FR6, FR7
**Dépendance :** démarre après stabilisation de l'Epic 1 (séquencement produit — FR7 alimente le pipeline de capture déjà existant, pas de dépendance technique vers un epic futur).

### Epic 3: CRM & Analytics
Chef consulte une vue exploitable de ses candidatures et de leurs réponses pour ajuster sa stratégie dans la durée, construite sur le CRM Postgres (`Application`/`ApplicationEvent`) déjà en place.
**FRs covered:** FR8, FR9
**Dépendance :** démarre après l'Epic 2 (ordre de priorité produit, pas une dépendance technique dure).

## Epic 1: Génération de CV ciblée (cœur du pipeline)

Chef capture une offre depuis n'importe quel job-board supporté et obtient un CV ciblé, ATS-optimisé, sans réécriture manuelle. Le pipeline capture → génération → finalisation (FR1, FR2) est déjà fonctionnel en production ; les stories ci-dessous ne couvrent que le delta restant.

### Story 1.1: Reformatage visuel du template CV

En tant que Chef,
Je veux retravailler la mise en page visuelle du template CV détaillé (`template/template_cv_detaille.html`),
Afin que le CV généré ait une présentation repensée, sans perdre la capacité du pipeline à le patcher automatiquement.

**Critères d'acceptation :**

**Étant donné** le template CV détaillé actuel avec ses ids/data-attributes utilisés par `html_patcher.py`
**Quand** le reformatage visuel est appliqué
**Alors** tous les ids/data-attributes consommés par `html_patcher.py` restent présents et fonctionnels, sauf décision explicite contraire documentée lors de la préparation détaillée de la story
**Et** le pipeline complet (génération → patch → HTML/PDF) continue de produire un CV valide après le reformatage

**Note :** Contenu précis du reformatage (mise en page, sections, style) volontairement non détaillé — décision à prendre lors de la préparation détaillée de la story, après recherche de Chef sur les formats de CV (cf. PRD §9, Open Question 1).

### Story 1.2: Compléter le support des sites de capture restants (LinkedIn, Welcome to the Jungle, HelloWork)

En tant que Chef,
Je veux que l'extension capture les offres depuis LinkedIn, Welcome to the Jungle et HelloWork au même titre qu'Indeed et Free-Work,
Afin de pouvoir capturer une offre depuis n'importe lequel de ces sites sans étape manuelle supplémentaire.

**Critères d'acceptation :**

**Étant donné** une page d'offre ouverte sur l'un des trois sites (LinkedIn, Welcome to the Jungle, HelloWork)
**Quand** Chef déclenche la capture (bouton flottant ou raccourci `Ctrl+Shift+M`)
**Alors** les sélecteurs CSS header/description (et tags si le site en expose) sont configurés pour ce site, de façon identique dans `content.js` (`config.siteSelectors`) et `background.js` (`siteSelectors`)
**Et** l'offre est correctement extraite et envoyée au webhook avec statut `captured` (chemin bouton flottant), ou copiée en presse-papier (chemin raccourci)

**Étant donné** un nouveau site est ajouté aux sélecteurs
**Quand** l'extension est rechargée dans Chrome
**Alors** `manifest.json` (`host_permissions` et `content_scripts.matches`) inclut aussi ce site — sans ça le content script ne s'injecte pas

**Et** les 3 sites sont couverts par cette story unique (effort réduit par site — 2-3 sélecteurs CSS chacun) ; chaque site reste vérifiable indépendamment au fur et à mesure de l'implémentation.

## Epic 2: Intelligence LinkedIn

Chef analyse le profil d'experts reconnus pour en tirer des conseils applicables (LinkedIn, Malt, CV), et peut transformer un post LinkedIn repéré dans son feed en offre capturée au même titre qu'un job-board classique.

### Story 2.1: Conseils CV extraits des posts LinkedIn enregistrés

En tant que Chef,
Je veux que le MCP LinkedIn extraie de mes posts enregistrés (saved posts) les conseils applicables à mon CV,
Afin d'améliorer mon CV avec des conseils concrets, sans avoir à relire moi-même chaque post ni retomber sur les mêmes conseils à chaque relance.

**Critères d'acceptation :**

**Étant donné** les posts enregistrés par Chef sur `https://www.linkedin.com/my-items/saved-posts/`
**Quand** Chef déclenche la récupération via le MCP LinkedIn (`get_saved_posts`)
**Alors** chaque conseil identifié et pertinent pour le CV est extrait avec le texte du conseil, sa source, et l'URL du post d'origine quand le MCP parvient à la capturer, dans un fichier `.md` sous `tools/linkedin-mcp/data/tips-cv/`

**Étant donné** un post déjà traité lors d'un run précédent
**Quand** le MCP est relancé
**Alors** ce post n'est ni relu ni redupliqué dans le fichier de conseils, grâce à un fichier de suivi dédié (`tools/linkedin-mcp/data/tips-cv/posts-lus.md`) qui marque chaque post comme "Lu"

**Étant donné** le contrôle strict des permissions MCP (NFR2)
**Quand** cette extraction est exécutée
**Alors** elle reste une action ponctuelle déclenchée manuellement par Chef — pas de polling automatique des posts enregistrés

**Note (2026-08-30) :** Story initiale ("Analyse de profil expert et conseils applicables") divisée en deux : cette story couvre uniquement le volet CV (FR5/FR6) ; la Story 2.1b couvre le volet Malt/freelance. L'approche technique retenue s'appuie sur les posts déjà enregistrés par Chef plutôt que sur la soumission ponctuelle du profil d'un expert nommé — choix validé par un spike de test manuel (`get_saved_posts` fonctionne et renvoie du contenu exploitable ; voir Dev Notes de la story détaillée pour les limites constatées, notamment sur la capture de l'URL de chaque post).

### Story 2.1b: Conseils Malt / freelance extraits des posts LinkedIn enregistrés

En tant que Chef,
Je veux que le MCP LinkedIn extraie de mes posts enregistrés les conseils applicables à mon profil Malt et à ma pratique freelance (prospection, TJM, positionnement),
Afin d'améliorer mon profil Malt et ma stratégie freelance avec des conseils concrets.

**Critères d'acceptation :**

**Étant donné** les posts enregistrés par Chef sur `https://www.linkedin.com/my-items/saved-posts/`
**Quand** Chef déclenche la récupération via le MCP LinkedIn
**Alors** chaque conseil identifié et pertinent pour Malt ou la pratique freelance est extrait avec le texte du conseil, sa source, et l'URL du post d'origine quand disponible, dans un fichier `.md` dédié sous `tools/linkedin-mcp/data/` (ex. `tips-malt/`)

**Étant donné** que la Story 2.1 met déjà en place le mécanisme de récupération et de suivi des posts lus
**Quand** cette story est implémentée
**Alors** elle réutilise ce même mécanisme (appel MCP, fichier de suivi par empreinte) plutôt que d'en recréer un nouveau — seuls la catégorisation et le dossier de sortie diffèrent

**Étant donné** le contrôle strict des permissions MCP (NFR2)
**Quand** cette extraction est exécutée
**Alors** elle reste une action ponctuelle déclenchée manuellement par Chef — pas de polling automatique des posts enregistrés

**Note (2026-08-30) :** Story créée par division de la Story 2.1 initiale (voir note ci-dessus). Contenu précis des règles de catégorisation CV vs Malt/freelance volontairement non détaillé davantage — à affiner lors de la préparation détaillée si certains posts sont ambigus (ex. un conseil de négociation applicable aux deux volets).

### Story 2.2: Extraction d'offre depuis un post LinkedIn

En tant que Chef,
Je veux soumettre manuellement un post LinkedIn contenant une annonce de mission freelance et en extraire les informations structurées,
Afin que cette offre alimente le même pipeline de capture que les job-boards classiques, sans ressaisie manuelle.

**Critères d'acceptation :**

**Étant donné** un post LinkedIn public contenant une annonce de mission (ex. repéré dans le feed)
**Quand** Chef soumet le lien ou le contenu du post
**Alors** les informations structurées sont extraites : stack technique, lieu, télétravail, date de démarrage, TJM, contact

**Étant donné** l'extraction réussie d'un post
**Quand** l'offre est enregistrée
**Alors** elle suit le même pipeline de capture que le webhook existant — statut initial `captured`, source additionnelle et non un remplacement

**Étant donné** le contrôle strict des permissions MCP (NFR2)
**Quand** Chef soumet un post
**Alors** la soumission est manuelle (lien ou contenu fourni explicitement par Chef) — pas de surveillance automatique du feed, pour limiter le risque ToS

**Note :** Choix "soumission manuelle" fait par défaut, en cohérence avec NFR2 (pas de polling). Le PRD (§9 Q3) laissait ce mécanisme ouvert entre soumission manuelle et surveillance de feed — à corriger si une autre approche est voulue.

### Story 2.3: Corpus de missions professionnelles multi-secteurs, extraites de profils LinkedIn (skill `lk-scrapp-experiences`)

En tant que Chef,
Je veux un skill `lk-scrapp-experiences` qui recherche des profils LinkedIn dans un métier donné (dev, data, sécurité, DevOps, ...) selon une combinaison de filtres, et en extraie les missions réalisées lorsqu'elles sont qualitatives et détaillées,
Afin de disposer d'un corpus de références concrètes de missions professionnelles, tous secteurs confondus, réutilisable pour enrichir mon CV et affiner mon positionnement freelance — sans me limiter au seul secteur bancaire.

**Critères d'acceptation :**

**Étant donné** un skill dédié nommé `lk-scrapp-experiences`
**Quand** Chef l'invoque avec une combinaison de filtres parmi : Secteur (bancaire, communication, logistique, éditeur de logiciel, ...), Entreprise (SG, LCL, Airbus, ...), Poste (développeur, DevOps, data analyste, data engineer, ...), Compétence (Python, CI/CD, Kubernetes, ELK, ...), Durée des missions (ex. ≥1 mois, ≥1 an), Localisation du profil (France, Lyon, Angleterre, Arabie Saoudite, Japon, ...), et un nombre maximal de profils à vérifier (ex. 3, 10, 100)
**Alors** le skill utilise le MCP LinkedIn (`search_people`, `get_person_profile` — avec fallback chrome-devtools si le MCP bloque, cf. note ci-dessous) pour trouver des profils correspondant à la combinaison de filtres fournie, dans la limite du nombre maximal de profils demandé

**Étant donné** un profil trouvé et ses missions listées
**Quand** le skill évalue chaque mission
**Alors** seules les missions jugées qualitatives et suffisamment détaillées (description concrète, stack technique identifiable) sont retenues — les entrées trop vagues ou non vérifiables sont ignorées

**Étant donné** une mission retenue
**Quand** elle est enregistrée
**Alors** elle est classée par branche métier dans `tools/linkedin-mcp/data/missions-realisees/missions-[branche].md` (un fichier par branche, ex. `missions-dev.md`, `missions-devops.md`, `missions-data.md`, `missions-securite.md` — créé à la volée selon les profils trouvés, pas de liste de branches fermée), structurée sur le modèle déjà en place dans `missions-dev.md` (poste, entreprise/secteur, durée, description de la mission, stack technique, profil source avec URL) — un format plus détaillé que celui des fichiers `tips-linkedin/`, adapté au contenu plus riche d'une mission professionnelle

**Étant donné** le contrôle strict des permissions MCP (NFR2)
**Quand** ce scraping est exécuté
**Alors** il reste une action ponctuelle déclenchée manuellement par Chef, borné par le paramètre de nombre maximal de profils — pas de scraping massif ni de polling automatique

**Note (2026-08-31, révisée) :** Story initialement scopée au seul secteur bancaire, élargie à la demande de Chef pour couvrir tout secteur/métier via un système de filtres combinables (secteur, entreprise, poste, compétence, durée, localisation, nombre max de profils) et renommée autour du skill `lk-scrapp-experiences` (remplace le nom provisoire `/scrapp-profil-lk`). Reste dans l'esprit de FR5 (analyse de profils publics), appliquée à la constitution d'un corpus de missions professionnelles réutilisables plutôt qu'à des conseils génériques. Décidée directement par Chef, sans passer par extraction PRD formelle. Un premier test manuel (3 profils, secteur bancaire, volet dev uniquement) a été effectué avant cet élargissement — voir `tools/linkedin-mcp/data/missions-realisees/missions-dev.md` (dossier gitignoré via `tools/linkedin-mcp/data/`, donc pas de contrepartie `.example.md` nécessaire — cf. NFR1).

**Note (2026-08-31) — fallback MCP LinkedIn → chrome-devtools :** Le MCP LinkedIn (Docker) a bloqué durant ce premier test (`No valid LinkedIn session is available in Docker` — session invalidée, logs serveur `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`). Le test a été mené intégralement via le MCP chrome-devtools à la place (session LinkedIn déjà authentifiée dans le profil Chrome dédié), en naviguant directement sur les URLs de recherche (`/search/results/people/?keywords=...`) et de détail d'expérience (`/in/<slug>/details/experience/`) plutôt que via les tool calls `search_people`/`get_person_profile`. Règle de fallback ajoutée dans `AGENTS.md` (racine) : quand le MCP LinkedIn bloque, basculer sur chrome-devtools sans interrompre la tâche, et signaler à l'utilisateur comment relancer la session LinkedIn MCP en parallèle.

### Story 2.4: Couverture missions par hard skill (skill `lk-hard-skill-missions`)

En tant que Chef,
Je veux un skill qui vérifie, pour chaque hard skill de mon référentiel (`template/hard_skills.html`), le nombre de missions qui le mettent en valeur dans mon corpus (`missions-realisees/`), et qui peut relancer `lk-scrapp-experiences` ciblé sur un hard skill sous-représenté,
Afin d'identifier rapidement mes hard skills les moins valorisés et de combler l'écart mission par mission, plutôt que de deviner au hasard lesquels manquent de preuves concrètes.

**Critères d'acceptation :**

**Étant donné** le référentiel `template/hard_skills.html` (~227 hard skills répartis en catégories — Langages & Frameworks, Backend & API, DevOps & Cloud, Sécurité & DevSecOps, etc. —, certaines lignes regroupant plusieurs skills séparés par virgule, ex. "Django, FastAPI, Flask")
**Quand** le skill `lk-hard-skill-missions` est invoqué (première construction ou rafraîchissement)
**Alors** il construit/actualise une table de suivi dans `tools/linkedin-mcp/data/hard-skills-missions.md`, une ligne par hard skill individuel (les regroupements virgule sont éclatés en lignes séparées), avec au minimum : nom du hard skill (tel que référencé dans `hard_skills.html`), catégorie d'origine, nombre de missions rattachées, statut, et références courtes vers les missions rattachées (fichier + numéro d'entrée dans `missions-realisees/missions-[branche].md`, ex. `missions-devops.md#3`)

**Étant donné** les fichiers `missions-realisees/missions-*.md` déjà existants
**Quand** la table est construite ou actualisée
**Alors** le skill associe d'abord les missions déjà présentes à chaque hard skill en recherchant sa mention dans le champ "Stack technique" de chaque entrée, avant toute nouvelle recherche LinkedIn — une même mission peut être rattachée à plusieurs hard skills simultanément

**Étant donné** un hard skill avec moins de 3 missions rattachées
**Quand** Chef consulte la table et demande explicitement de combler l'écart pour ce hard skill (ou un petit lot de hard skills qu'il choisit lui-même)
**Alors** le skill invoque `lk-scrapp-experiences` avec `competence: <hard skill>` pour ce(s) hard skill(s) précisément — jamais de déclenchement automatique sur l'ensemble des hard skills sous le seuil, pour rester cohérent avec NFR2 (pas de scraping massif)

**Étant donné** une nouvelle mission trouvée et rattachée à un hard skill
**Quand** la table de suivi est mise à jour
**Alors** la mise à jour se fait ligne par ligne, sans réécriture intégrale du fichier, pour ne pas perdre la progression déjà enregistrée si le run est interrompu — même principe de résilience incrémentale que `lk-scrapp-experiences`

**Étant donné** le nombre de missions rattachées à un hard skill
**Quand** son statut est affiché dans la table
**Alors** il utilise un nom de statut explicite et distinct selon le seuil : **Couvert** (≥ 3 missions), **Partiel** (1-2 missions), **À traiter** (0 mission) — pas de booléen fait/pas fait

**Note (2026-09-02) :** Story ajoutée à la demande de Chef, en complément direct de la Story 2.3 — réutilise le corpus `missions-realisees/` et le skill `lk-scrapp-experiences` plutôt que de créer un nouveau mécanisme de scraping. Décisions actées avec Chef : (1) table Markdown plutôt que sections détaillées par hard skill — 227 entrées en prose seraient illisibles, et le détail des missions vit déjà dans `missions-realisees/`, la table n'a besoin que de pointer vers ces entrées ; (2) nom du skill `lk-hard-skill-missions` (préfixe `lk-` désormais standard pour les skills LinkedIn de ce projet, cf. Story 2.3).

## Epic 3: CRM & Analytics

Chef consulte une vue exploitable de ses candidatures et de leurs réponses pour ajuster sa stratégie dans la durée, construite sur le CRM Postgres (`Application`/`ApplicationEvent`) déjà en place.

### Story 3.1: Suivi enrichi des réponses aux candidatures

En tant que Chef,
Je veux que le statut d'une candidature capture explicitement si et quand une réponse a été reçue,
Afin de disposer de données fiables sur mes candidatures pour en tirer des statistiques et des leçons plus tard.

**Critères d'acceptation :**

**Étant donné** une candidature envoyée (statut `sent`)
**Quand** une réponse est reçue (positive, négative, entretien, ou absence de réponse après un délai)
**Alors** le modèle `Application`/`ApplicationEvent` existant est étendu pour enregistrer explicitement la date et la nature de cette réponse — pas de nouvelle table créée

**Étant donné** l'historique des candidatures déjà en base
**Quand** cette extension est déployée
**Alors** les candidatures existantes restent valides (migration Alembic non destructive)

### Story 3.2: Vue consolidée des candidatures

En tant que Chef,
Je veux consulter une vue exploitable de mes candidatures (statuts, dates, taux de réponse),
Afin d'ajuster ma stratégie de candidature dans la durée, au-delà des endpoints bruts actuels.

**Critères d'acceptation :**

**Étant donné** les candidatures et leurs événements enregistrés en base (y compris le suivi enrichi de la Story 3.1)
**Quand** Chef consulte la vue CRM
**Alors** il voit une visualisation exploitable (dashboard ou tableau) — pas seulement les endpoints JSON bruts (`/applications`, `/stats`)

**Étant donné** cette vue
**Quand** Chef l'utilise pour ajuster sa stratégie
**Alors** elle expose au minimum : statuts par candidature, dates clés, taux de réponse global et par type d'offre

**Note :** Périmètre exact (dashboard visuel vs nouveaux endpoints vs les deux) laissé ouvert par le PRD (§9 Q2) — je pars ici sur une visualisation exploitable comme minimum ; à corriger si un format précis est voulu (page web, export, CLI...).
