# Epic 2 Context: Intelligence LinkedIn

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Chef veut tirer parti de son activité LinkedIn (posts enregistrés, profils publics d'experts) pour obtenir des conseils concrets applicables à son CV et à sa pratique freelance (Malt), constituer un corpus réutilisable de missions professionnelles réelles tous secteurs confondus, suivre la couverture de ses hard skills par ce corpus, et transformer une annonce de mission repérée sur un post LinkedIn en offre capturée au même titre qu'un job-board classique. L'ensemble s'appuie sur le MCP LinkedIn en lecture ciblée et manuelle uniquement (jamais de polling), en cohérence avec les contraintes ToS du projet.

## Stories

- Story 2.1: Conseils CV extraits des posts LinkedIn enregistrés
- Story 2.1b: Conseils Malt / freelance extraits des posts LinkedIn enregistrés
- Story 2.2: Extraction d'offre depuis un post LinkedIn
- Story 2.3: Corpus de missions professionnelles multi-secteurs (skill `lk-scrapp-experiences`)
- Story 2.4: Couverture missions par hard skill (skill `lk-hard-skill-missions`)

## Requirements & Constraints

- Toute analyse de profil LinkedIn porte uniquement sur du contenu public.
- Les conseils extraits doivent être étiquetés selon où les appliquer (CV vs Malt/freelance) — l'utilisateur peut porter plusieurs casquettes professionnelles.
- L'extraction d'une offre depuis un post LinkedIn doit produire les mêmes champs structurés qu'attendu par le pipeline existant : stack technique, lieu, télétravail, date de démarrage, TJM, contact.
- Contrôle strict des permissions MCP (NFR2) : chaque action de scraping/extraction reste ponctuelle et déclenchée manuellement — jamais de polling automatique, jamais de surveillance de feed en continu, jamais de scraping massif non borné (un nombre max de profils explicite est requis quand applicable).
- Aucune vraie donnée personnelle committée (NFR1) : les dossiers de sortie de ces skills vivent sous `tools/linkedin-mcp/data/`, gitignorés — pas de contrepartie `.example.md` nécessaire tant que ce dossier reste exclu de Git.
- Par défaut, ces skills tournent sur l'abonnement Claude Pro (skills Claude Code), pas sur l'API Anthropic facturée, sauf justification explicite de volume (NFR3).
- Une offre extraite d'un post LinkedIn est une source additionnelle au pipeline de capture, jamais un remplacement du webhook existant ; statut initial `captured`, identique aux offres job-board.

## Technical Decisions

- Le MCP LinkedIn expose les tool calls pertinents pour cet epic : `get_saved_posts` (2.1/2.1b), `search_people` et `get_person_profile` (2.3).
- **Fallback obligatoire** : si le MCP LinkedIn bloque (ex. session Docker invalide — `No valid LinkedIn session is available in Docker`, logs `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`), basculer sans interrompre la tâche sur le MCP chrome-devtools (session Chrome de l'utilisateur déjà authentifiée), en naviguant directement les URLs LinkedIn pertinentes (recherche `/search/results/people/?keywords=...`, détail `/in/<slug>/details/experience/`). Signaler en parallèle à l'utilisateur comment relancer la session du MCP LinkedIn, sans attendre cette action. Noter les URLs exactes visitées pour pouvoir les rouvrir sans répéter la recherche.
- Convention de nommage des skills LinkedIn de ce projet : préfixe `lk-` (ex. `lk-scrapp-experiences`, `lk-hard-skill-missions`).
- Mécanisme de suivi/déduplication : chaque skill qui traite des posts/profils tient un fichier de suivi dédié pour ne jamais retraiter un élément déjà vu (ex. `tools/linkedin-mcp/data/tips-cv/posts-lus.md`, marquage "Lu"). La Story 2.1b réutilise explicitement le mécanisme mis en place par 2.1 plutôt que d'en recréer un.
- Résilience incrémentale : les fichiers de suivi/corpus (missions, table hard skills) doivent être mis à jour ligne par ligne, jamais réécrits intégralement, pour ne pas perdre la progression si un run est interrompu.
- Emplacements de sortie sous `tools/linkedin-mcp/data/` : `tips-cv/` (2.1), `tips-malt/` ou équivalent (2.1b), `missions-realisees/missions-[branche].md` — un fichier par branche métier, créé à la volée, structuré (poste, entreprise/secteur, durée, description, stack technique, profil source avec URL) (2.3), `hard-skills-missions.md` — table une ligne par hard skill individuel, regroupements virgule éclatés (2.4).
- Story 2.4 s'appuie sur le référentiel `template/hard_skills.html` (~227 hard skills catégorisés) comme source de vérité des noms/catégories, et sur le corpus `missions-realisees/` déjà produit par 2.3 (association d'abord par recherche textuelle dans le champ "Stack technique" existant, avant toute nouvelle recherche LinkedIn). Statuts de couverture à 3 paliers explicites : Couvert (≥3), Partiel (1-2), À traiter (0).
- Story 2.2 : une offre extraite doit être enregistrée via le même chemin que le webhook existant (`captured`, modèle `Application`) — pas de nouveau statut ni de table séparée.

## Cross-Story Dependencies

- Story 2.1b dépend techniquement de 2.1 : elle réutilise le même mécanisme d'appel MCP et de fichier de suivi par empreinte ; seuls la catégorisation et le dossier de sortie diffèrent.
- Story 2.4 dépend du corpus produit par 2.3 (`missions-realisees/`) et relance ce même skill (`lk-scrapp-experiences`, paramètre `competence: <hard skill>`) pour combler un écart — jamais de déclenchement automatique en masse sur tous les hard skills sous le seuil.
- Story 2.2 alimente le pipeline de capture déjà en place (Epic 1 / webhook `POST /webhook`, modèle `Application`) sans le modifier.
- Au niveau de l'epic : démarrage après stabilisation de l'Epic 1 — séquencement produit choisi par Chef, pas une dépendance technique dure.
