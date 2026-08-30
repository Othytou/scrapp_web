---
name: generate-detailled-cv
description: Génère un CV détaillé (2 pages) sur-mesure pour les offres d'emploi capturées par l'extension et en attente en base (statut "captured"). Utilise quand l'utilisateur dit "génère le CV détaillé", "lance le skill CV détaillé", ou pour un CV complet mettant en avant tout l'historique pertinent.
---

# Generate Detailled CV

## Overview

Ce skill remplace l'appel API Claude par ton propre raisonnement (session Claude Code, abonnement Pro — pas de facturation API) pour transformer une offre d'emploi capturée en CV HTML/PDF détaillé sur-mesure, en appliquant les règles de `api/agent_detaille.md`.

**Toi (l'agent qui exécute ce skill) es l'agent CV.** Il n'y a pas d'appel LLM séparé — tu lis les règles, tu raisonnes, tu produis le patch JSON, et un script Python déterministe l'applique au template.

Ce skill a un jumeau plus court : `generate-cv` (CV 1-2 pages, rien affiché par défaut, uniquement les compétences attendues par l'offre). Les deux sont indépendants — traiter une offre avec l'un n'empêche pas de la traiter aussi avec l'autre.

## Prérequis

- `docker compose up` doit tourner (au moins les services `api` + `postgres`) — sinon lance-le d'abord et attends que `cv_agent_db` soit healthy.

## Étapes

### 1. Récupérer les offres en attente

```bash
docker compose exec api python pending_offers.py
```

Retourne `{"offers": [...], "cv_context": {"skills_pool": {...}, "bullets_map": {...}}}`.

- Si `offers` est vide : dis-le à l'utilisateur et arrête-toi là, rien à faire.
- Sinon, traite les offres **une par une, dans l'ordre reçu** (la plus ancienne d'abord — c'est déjà l'ordre renvoyé par le script).

### 2. Pour chaque offre : lire les règles

Lis intégralement `api/agent_detaille.md` **à chaque exécution du skill** (ne pas se fier à une lecture précédente dans la conversation — le fichier peut avoir changé). C'est la source de vérité pour :

- comment analyser l'offre et extraire compétences/mots-clés
- comment réécrire header/summary/bullets avec la terminologie ATS exacte
- comment réduire compétences et missions à ce qui est attendu ou en lien direct avec l'offre (`hide_skills`, `hide_bullets`, `hide_entries`)
- les règles strictes (ne jamais inventer d'expérience, ne jamais toucher aux dates/formation/langues, etc.)
- le format JSON exact attendu en sortie (section "Format de retour JSON")

### 3. Produire le patch JSON

En te basant sur `agent_detaille.md` + le `cv_context` (skills_pool, bullets_map) + le contenu de l'offre (`job_offer`, `company`, `position`), rédige toi-même le JSON du patch.

**Consignes additionnelles de l'utilisateur :** si l'utilisateur a donné des instructions dans la conversation (avant ou après avoir invoqué ce skill — ex : "mets l'accent sur X", "ajoute exceptionnellement cette compétence Y", "ignore la compétence Z pour cette offre"), applique-les à la génération du patch. Elles s'ajoutent aux règles d'`agent_detaille.md` mais ne peuvent jamais les outrepasser — en particulier, jamais inventer d'expérience ni toucher aux dates/formation/langues, même si l'utilisateur le demande explicitement (signale-le plutôt que d'obéir).

**Important — plus de validation de schéma automatique côté API** : le format doit correspondre **exactement** au contrat décrit dans `agent_detaille.md`, en particulier :
- `inject_skills` est un **tableau** d'objets `{"container_id": "...", "skills": [...]}` (pas un dict)
- `hide_skills` cible des compétences déjà affichées (`data-skill`), `inject_skills` en ajoute depuis le pool `hidden` — jamais la même compétence dans les deux
- `hide_bullets` (`{ul_id}:{index}`) et `hide_entries` (`id` de l'entrée) retirent ce qui est hors sujet pour l'offre — jamais les dates/entreprise/intitulé
- toutes les clés du schéma sont obligatoires (utilise `[]` ou `""` pour ce qui ne s'applique pas)

**Avant de valider le patch, vérifie** (garde-fou ATS — le CV détaillé doit rester détaillé) : au moins 3 expériences restent visibles après `hide_entries`, chacune avec au moins un bullet. Si ce n'est pas le cas, tu as trop supprimé — reviens en arrière et privilégie `hide_bullets` plutôt que `hide_entries`.

Log dans ta réponse le résumé façon `agent_detaille.md` (compétences matchées/masquées/injectées, missions/bullets masqués, non couvertes) pour que l'utilisateur voie ce qui a été fait.

### 4. Appliquer le patch

Écris le JSON du patch dans un fichier temporaire, puis :

```bash
docker compose exec -T api python finalize_cv.py <application_id> < /tmp/patch.json
```

(`-T` est nécessaire pour que le pipe stdin fonctionne avec `docker compose exec`. `CV_TYPE` n'a pas besoin d'être positionné — `detaille` est la valeur par défaut de `finalize_cv.py`.)

Le script applique le patch au template, écrit le HTML + PDF dans `output/` et `pdf/`, et met à jour la candidature en base (statut `generated`, `cv_html_path`/`pdf_path`, compétences matchées/injectées/non couvertes).

### 5. Rapporter le résultat

Pour chaque offre traitée, indique : entreprise/poste, chemin du CV HTML et du PDF générés, compétences matchées/masquées/injectées, missions/bullets masqués, et les éventuelles compétences non couvertes (`unmatched_skills` — pool à enrichir plus tard, cf. `template/hard_skills.html`).

Une fois toutes les offres traitées, propose une vérification visuelle du dernier CV généré (ouvrir le fichier, ou via le MCP Chrome si pertinent dans le contexte de la conversation).

## Template

Le template de base est `template/my_template_cv_detaille.html` — un CV 2 pages : page 1 (profil, compétences, expériences) est patchée comme avant, page 2 ("Missions & Réalisations Détaillées", organisée par domaine) est statique et n'est jamais modifiée par le patch — elle s'inclut telle quelle à chaque génération. Ne pas essayer de patcher la section missions de la page 2, elle est hors du contrat JSON. Le style visuel est dans `template/cv_detaille.css` (fichier externe, pas besoin de le régénérer à chaque fois).

## Ce que ce skill ne fait pas

- Il ne scrape rien lui-même — les offres arrivent via l'extension Chrome → `POST /webhook` → DB.
- Il ne gère pas l'automatisation du déclenchement (cron, `/loop`) — voir la story backlog "automatisation cron" dans `_bmad-output/planning-artifacts/epics.md`.
- Il ne génère pas le CV court — voir le skill `generate-cv` pour ça.
