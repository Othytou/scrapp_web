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

### Story 2.1: Analyse de profil expert et conseils applicables

En tant que Chef,
Je veux soumettre le profil LinkedIn (ou Malt) d'un expert reconnu dans mon domaine et recevoir une liste de conseils concrets,
Afin d'appliquer ces conseils à mon propre LinkedIn, mon profil Malt, ou mon CV.

**Critères d'acceptation :**

**Étant donné** un profil LinkedIn public d'un expert reconnu dans un domaine pertinent
**Quand** Chef soumet ce profil via le MCP LinkedIn
**Alors** l'analyse porte uniquement sur le contenu public du profil (titre, résumé, expériences mises en avant, posts publics) — jamais de données privées
**Et** Chef reçoit une liste de conseils concrets, chacun étiqueté selon où l'appliquer (LinkedIn, Malt, ou CV)

**Étant donné** le profil LinkedIn de Chef affiche plusieurs casquettes professionnelles (Full-Stack, DevOps, Réseau, IA/Data)
**Quand** les conseils sont générés
**Alors** ils restent cohérents avec cette multi-casquette plutôt que de supposer un profil mono-domaine

**Étant donné** l'appel au MCP LinkedIn pour cette analyse
**Quand** la requête est effectuée
**Alors** elle reste ponctuelle et ciblée sur le profil demandé — pas de polling automatique, pas d'accès étendu au-delà de ce profil (NFR2)

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
