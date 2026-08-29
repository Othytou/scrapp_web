---
title: "scrapp_web — Pipeline personnel de candidature CV"
status: draft
created: 2026-08-14
updated: 2026-08-14
---

# PRD: scrapp_web — Pipeline personnel de candidature CV
*Working title — confirmer.*

## 0. Objet du document

Ce PRD cadre le développement de scrapp_web sur trois epics (CV, LinkedIn, CRM). Il sert de référence unique pour Chef, pilote solo du projet, et de base pour la création des epics/stories qui suivront (`bmad-create-epics-and-stories`). Vocabulaire ancré au Glossaire (§3) ; exigences fonctionnelles regroupées par feature (§4) ; hypothèses taguées `[ASSUMPTION]` inline et indexées en §10.

## 1. Vision

scrapp_web est un pipeline personnel qui transforme une offre d'emploi vue en ligne en un CV sur-mesure, optimisé ATS, en quelques minutes plutôt qu'en réécriture manuelle à chaque candidature. Une extension Chrome capture l'offre, un skill Claude Code (sur abonnement Pro, sans facturation API) l'analyse et patche un template de CV détaillé, sans intervention manuelle sur le contenu.

Le projet s'étend maintenant dans deux directions : une intelligence LinkedIn (analyse de profils d'experts reconnus pour en tirer des conseils applicables, et extraction d'offres directement depuis des posts LinkedIn) et un CRM enrichi donnant une vraie visibilité sur les candidatures envoyées et leurs réponses.

Le succès se mesure d'abord qualitativement — ce pipeline aide-t-il concrètement à décrocher une mission ou un poste ? Si c'est le cas, deux directions futures sont envisagées : élargir à d'autres types de CV (dont une variante CDI plus courte), et, à plus long terme, explorer une commercialisation — les deux restent hors scope v1.

## 2. Target User

### 2.1 Jobs To Be Done

- En tant que candidat freelance/multi-domaines (Full-Stack, DevOps, Réseau, IA/Data), je veux un CV réécrit et optimisé ATS pour chaque offre sans y passer du temps à chaque fois.
- Je veux comprendre comment des profils publics reconnus (LinkedIn, Malt) dans mon domaine communiquent, pour en tirer des conseils applicables à mon propre profil et à mon CV.
- Je veux une vue fiable de mes candidatures et de mes taux de réponse pour ajuster ma stratégie dans la durée.

### 2.2 Non-Users (v1)

Pas d'autres utilisateurs que Chef — outil strictement personnel. La commercialisation est une direction future explicitement hors scope v1 (voir §6).

### 2.3 Key User Journeys

- **UJ-1.** Chef voit une offre intéressante, la copie depuis l'extension, et récupère un CV ciblé en quelques minutes sans réécrire le contenu à la main.
- **UJ-2.** Chef fait analyser le profil d'un expert reconnu de son domaine (LinkedIn ou Malt) et applique un conseil concret qui en ressort — sur son propre LinkedIn, son profil Malt, ou son CV.
- **UJ-3.** Après plusieurs semaines de candidatures, Chef consulte le CRM pour voir quel type d'offre obtient le plus de réponses et ajuste ses candidatures suivantes en conséquence.

## 3. Glossaire

- **Offre (Application)** — une candidature capturée en base. Statuts : `captured` → `generated` → `sent` → `no_response` / `positive` / `negative` / `interview`.
- **Skill de génération** (`generate-cv`) — skill Claude Code qui lit `agent.md`, raisonne sur l'offre et le contexte CV, produit le patch, appelle `finalize_cv.py`. Ne fait aucun appel API Anthropic facturé.
- **Patch** — objet JSON décrivant les modifications à appliquer au template (header, résumé, compétences highlightées/injectées, bullets réécrits, soft skills, compétences non couvertes).
- **Template détaillé** — `template/template_cv_detaille.html`, CV 2 pages : profil (patché) + missions détaillées par domaine (statique).
- **Pool de compétences (CV_SKILLS_POOL)** — `displayed` / `hidden` / `labels`, dictionnaire des compétences du CV et de leurs libellés.
- **MCP LinkedIn** — serveur MCP non officiel donnant un accès en lecture à des données LinkedIn.
- **Profil expert** — profil LinkedIn ou Malt d'une personne reconnue dans un domaine, analysé pour en tirer des conseils.
- **Conseil (advice item)** — recommandation concrète issue de l'analyse d'un profil expert, étiquetée selon où l'appliquer (LinkedIn, Malt, CV).

## 4. Features

### 4.1 Génération de CV ciblée (Epic 1 — cœur du pipeline)

**Description :** Couvre le pipeline déjà fonctionnel (capture → génération → finalisation) et son évolution prévue (reformatage du template, complétion du support multi-sites). Realizes UJ-1.

#### FR-1 : Capture d'offre multi-sites

L'utilisateur peut copier une offre depuis un site supporté (Indeed, Free-Work configurés ; LinkedIn, Welcome to the Jungle, HelloWork à compléter) et la voir enregistrée en base sans intervention manuelle.

**Consequences (testable):**
- Statut initial `captured` à la capture.
- Aucun appel LLM déclenché au moment de la capture (le webhook ne fait que l'enregistrement).

#### FR-2 : Génération de CV sur abonnement Pro

L'utilisateur peut déclencher le skill `generate-cv` pour transformer toute offre en attente en CV HTML + PDF adapté, sans appel API facturé.

**Consequences (testable):**
- Le patch produit respecte le schéma défini dans `agent.md`.
- Le HTML et le PDF sont écrits dans `output/` et `pdf/` ; le statut de l'offre passe à `generated`.

#### FR-3 : Reformatage du template CV

Le template CV peut être retravaillé visuellement sans casser le contrat de patch existant.

`[ASSUMPTION: la story de reformatage (numéro provisoire 1.6, possiblement scindée en 1.6b/1.6c pendant le dev) préserve les ids/data-attributes utilisés par html_patcher.py sauf décision explicite contraire — sinon le pipeline de patch casse]`

**Out of Scope:**
- Le contenu précis du reformatage — décidé à la création de la story, pas dans ce PRD.

#### FR-4 : Ajout de nouveaux sites job-board

L'utilisateur peut ajouter le support d'un nouveau site (sélecteurs CSS header/description/tags) sans modifier le backend.

**Consequences (testable):**
- La config des sélecteurs est dupliquée entre `content.js` et `background.js` — toute modification doit être répliquée dans les deux (point de vigilance déjà documenté dans `extension/AGENTS.md`).

**Feature-specific NFRs:**
- Aucune donnée personnelle réelle (CV avec vraies infos) ne doit être committée dans Git. Tout nouveau template contenant de vraies informations doit avoir une contrepartie générique (`*.example.html`) committable créée **au moment même** de sa création — pas après coup. (Voir §5 Contraintes.)

### 4.2 Intelligence LinkedIn (Epic 2)

**Description :** Analyse de profils d'experts reconnus (LinkedIn, Malt) pour en tirer des conseils applicables, et extraction d'offres directement depuis des posts LinkedIn. Démarre après stabilisation de l'Epic 1. Realizes UJ-2 ; FR-7 fait le pont avec UJ-1/Epic 1.

#### FR-5 : Analyse de profil expert

L'utilisateur peut soumettre un profil LinkedIn (ou Malt, via données croisées) d'un expert reconnu dans un domaine et obtenir une analyse via le MCP LinkedIn.

`[ASSUMPTION: l'analyse porte sur le contenu public du profil — titre, résumé, expériences mises en avant, posts publics — jamais de données privées]`

#### FR-6 : Liste de conseils applicables

L'utilisateur reçoit une liste de conseils concrets issus de l'analyse, chaque conseil étiqueté selon où l'appliquer (LinkedIn, Malt, ou CV).

**Consequences (testable):**
- Les conseils tiennent compte du fait que l'utilisateur peut afficher plusieurs "casquettes" professionnelles sur son propre LinkedIn — ils restent cohérents avec cette multi-casquette plutôt que de supposer un profil mono-domaine.

#### FR-7 : Extraction d'offre depuis un post LinkedIn

L'utilisateur peut soumettre un post LinkedIn (ex : annonce de mission freelance dans le feed) et en extraire automatiquement les informations structurées (stack technique, lieu, télétravail, date de démarrage, TJM, contact), au même titre qu'une offre de job board classique.

**Consequences (testable):**
- Alimente le même pipeline de capture que le webhook existant (statut `captured`) — source additionnelle, pas un remplacement.

**Feature-specific NFRs:**
- **Contrôle strict des permissions MCP dès le départ.** Le serveur MCP LinkedIn n'obtient que le strict nécessaire (lecture de profils/posts ciblés) — pas de polling automatique, pas d'accès étendu — tant que les besoins réels et les limites (rate limit, détection, ToS) ne sont pas mieux compris. Toute extension de permissions nécessite une décision explicite ultérieure.

**Notes:** `[NOTE FOR PM]` Le mécanisme technique exact de FR-7 (soumission manuelle d'un lien vs surveillance d'un feed) a des implications ToS différentes — à trancher au design de la story, pas ici (voir §8 Open Questions).

### 4.3 CRM & Analytics (Epic 3)

**Description :** Vue consolidée sur les candidatures et leurs réponses, construite sur le CRM Postgres existant. Démarre après l'Epic 2. Realizes UJ-3.

#### FR-8 : Vue consolidée des candidatures

L'utilisateur peut consulter une vue exploitable de ses candidatures (statuts, dates, taux de réponse) au-delà des endpoints bruts actuels (`/applications`, `/stats`).

`[ASSUMPTION: "vraie vue" signifie une visualisation exploitable (dashboard/tableau), pas nécessairement de nouveaux endpoints JSON seuls — à confirmer à la création des stories]`

#### FR-9 : Suivi enrichi des réponses

Le suivi de statut capture explicitement si et quand une réponse a été reçue à une candidature, pas seulement le statut final.

`[ASSUMPTION: extension du modèle Application/ApplicationEvent existant plutôt que nouvelle table]`

**Notes:** `[NOTE FOR PM]` Le but de cet epic n'est pas d'optimiser une métrique fixe dès maintenant, mais de collecter des données fiables pour en tirer des statistiques et des leçons plus tard (voir §7).

## 5. Contraintes et Guardrails

### Confidentialité
- **Aucune vraie donnée personnelle dans Git.** Tout fichier contenant de vraies informations (nom, contact, historique professionnel réel) est exclu du suivi Git dès sa création, avec une contrepartie générique (`*.example.html`) committable si une référence structurelle doit être versionnée. Leçon tirée d'un incident réel du 2026-08-14 : repo public, vraies infos committées puis poussées avant détection et correction.
- Le dépôt GitHub (`Othytou/web_plugin_job_copier_multi_sites`) est **public** — toute donnée committée y est immédiatement visible.

### Sécurité (usage MCP / ToS)
- Le MCP LinkedIn est un serveur non officiel — usage prudent et minimal obligatoire (voir FR-7). Pas de polling automatique, pas d'extension de permissions sans décision explicite.

### Coût
- Le pipeline de génération CV n'utilise pas l'API Anthropic facturée (skill Claude Code sur abonnement Pro). Toute nouvelle feature impliquant un LLM suit par défaut le même principe, sauf justification explicite (ex : volume dépassant les limites de l'abonnement Pro).

## 6. Non-Goals (Explicit)

- Pas de multi-utilisateur / SaaS en v1 — outil strictement personnel.
- Pas de commercialisation en v1 — direction future si le projet fait ses preuves, mais aucune décision produit/pricing/architecture ne doit l'anticiper prématurément.
- Pas d'automatisation "always-on" du déclenchement du skill en v1 — reste manuel ou piloté en session ; l'automatisation cron est documentée comme story séparée (`epics.md` existant), pas un engagement v1.
- Pas d'usage intensif/automatisé du MCP LinkedIn (polling, scraping de masse) — usage ponctuel et ciblé tant que les limites ne sont pas validées.

## 7. MVP Scope

### 7.1 In Scope
- Epic 1 : pipeline de génération complet (déjà fonctionnel) + reformatage du template + complétion des sélecteurs multi-sites.
- Epic 2 (après stabilisation Epic 1) : analyse de profil expert + liste de conseils + extraction d'offres depuis un post LinkedIn.
- Epic 3 (après Epic 2) : vue CRM enrichie sur candidatures et réponses.
- Une doc de fin d'epic à chaque epic complété (voir §8, mécanisme à confirmer).

### 7.2 Out of Scope for MVP
- CV court "CDI" (variante allégée du template détaillé) — différé, dépend du succès du CV détaillé actuel.
- Pré-scoring léger (Haiku) avant génération complète — différé (roadmap existante).
- Automatisation cron du skill — story documentée séparément, pas engagée en v1.
- Commercialisation / ouverture multi-utilisateurs — direction future explicitement hors scope.

## 8. Success Metrics

Stakes personnelles — pas de métrique quantitative figée pour l'instant, par choix : l'Epic 3 collecte d'abord les données fiables avant d'optimiser vers une cible.

**Primary**
- **SM-1** : Le pipeline aide concrètement à décrocher une mission ou un poste — mesure qualitative, pas de cible chiffrée pour l'instant. Valide FR-1 à FR-9 indirectement.

**Secondary**
- **SM-2** : Les statuts de candidature et les réponses sont systématiquement et fidèlement enregistrés — condition préalable à toute analyse future. Valide FR-9.

**Counter-metrics (à ne pas optimiser)**
- **SM-C1** : Le volume de candidatures envoyées ne doit pas être optimisé au détriment de leur pertinence (score ATS, adéquation réelle au poste) — l'objectif est des candidatures ciblées, pas du volume. Contrebalance une possible sur-optimisation de SM-1 par le seul volume.

## 9. Open Questions

1. Contenu précis du reformatage du CV (story 1.6+) — à définir à la création de la story.
2. Périmètre exact de "vue réelle" côté CRM (dashboard visuel, nouveaux endpoints, ou les deux) — à affiner à la création des stories de l'Epic 3.
3. Mécanisme technique de FR-7 (soumission manuelle d'un lien de post vs surveillance d'un feed) — implications ToS différentes, à trancher au design de la story.
4. Doc de fin d'epic — format et contenu exacts (candidat naturel : skill `bmad-retrospective`) à confirmer à la première clôture d'epic.
5. Portabilité du skill `generate-cv` vers une autre IA que Claude — évoquée pendant la création des stories Epic 1 (2026-08-14). Le raisonnement (lecture `agent.md` + template + offre → patch JSON) n'a rien de spécifique à Claude Code, mais deux conditions doivent tenir : le patch produit doit respecter exactement le schéma existant (`inject_skills` en tableau, etc.) pour que `html_patcher.py`/`finalize_cv.py` le consomment sans casse, et l'avantage coût de NFR3 (pas d'API facturée) ne tient que si l'IA alternative tourne aussi sur un abonnement plat équivalent. Piste non engagée, pas de story associée pour l'instant — à explorer si besoin (ex. continuité si l'abonnement Pro change).

## 10. Assumptions Index

- §4.1 FR-3 — le reformatage CV préserve les ids/data-attributes du contrat de patch, sauf décision contraire explicite.
- §4.2 FR-5 — l'analyse de profil porte sur du contenu public uniquement.
- §4.3 FR-8 — "vraie vue" = visualisation exploitable, pas nécessairement de nouveaux endpoints JSON seuls.
- §4.3 FR-9 — extension du modèle existant plutôt que nouvelle table.
