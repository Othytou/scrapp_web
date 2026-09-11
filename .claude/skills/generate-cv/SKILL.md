---
name: generate-cv
description: Génère un CV court (1-2 pages) sur-mesure pour les offres d'emploi capturées par l'extension et en attente en base (statut "captured") — n'affiche que les compétences attendues ou directement liées à l'offre, pas d'inventaire complet. En français par défaut (préfixe `cv_`), bascule en anglais (préfixe `resume_`) si l'offre est en anglais ou sur demande explicite. Utilise quand l'utilisateur dit "génère le CV", "génère le CV court", "lance le skill CV", "traite les offres en attente", "génère le CV en anglais"/"resume", ou juste après avoir copié une offre.
---

# Generate CV (court)

## Overview

Ce skill remplace l'appel API Claude par ton propre raisonnement (session Claude Code, abonnement Pro — pas de facturation API) pour transformer une offre d'emploi capturée en CV HTML/PDF **court** sur-mesure, en appliquant les règles de `api/agent_court.md`.

**Toi (l'agent qui exécute ce skill) es l'agent CV.** Il n'y a pas d'appel LLM séparé — tu lis les règles, tu raisonnes, tu produis le patch JSON, et un script Python déterministe l'applique au template.

**Différence avec `generate-detailled-cv` :** le CV détaillé affiche un inventaire large de compétences par défaut et retire ce qui est hors sujet. Ce skill fait l'inverse — rien n'est affiché par défaut, tu construis la liste de compétences visibles uniquement à partir de ce que l'offre attend ou de ce qui y est directement lié. Les deux skills sont indépendants — traiter une offre avec l'un n'empêche pas de la traiter aussi avec l'autre (chemins et colonnes DB séparés).

## Prérequis

- `docker compose up` doit tourner (au moins les services `api` + `postgres`) — sinon lance-le d'abord et attends que `cv_agent_db` soit healthy.

## Étapes

### 1. Récupérer les offres en attente

```bash
docker compose exec -e TEMPLATE_PATH=template/my_template_cv_court.html api python pending_offers.py
```

`TEMPLATE_PATH` doit pointer sur le template court — sinon `pending_offers.py` lit par défaut le pool du CV détaillé, ce qui n'a pas de sens ici (les deux templates n'ont pas le même `CV_SKILLS_POOL`).

Retourne `{"offers": [...], "cv_context": {"skills_pool": {...}, "bullets_map": {...}}}` — ici `skills_pool.displayed` est vide, `skills_pool.hidden` contient les ~230 compétences de référence (cf. `template/hard_skills.html`) disponibles pour injection.

- Si `offers` est vide : dis-le à l'utilisateur et arrête-toi là, rien à faire.
- Sinon, traite les offres **une par une, dans l'ordre reçu** (la plus ancienne d'abord — c'est déjà l'ordre renvoyé par le script).

### 1b. Déterminer la langue du CV, pour chaque offre

Par défaut, le CV est en français. Passe en anglais dans l'un de ces deux cas :
- l'utilisateur l'a demandé explicitement dans la conversation (ex. "génère-le en anglais", "fais un CV anglais pour celle-ci") ;
- le texte de l'offre (`job_offer`) est manifestement rédigé en anglais.

Dans le doute (offre courte, mélange de langues), reste sur le français — ne bascule en anglais que si c'est net.

Selon la langue retenue pour cette offre :

| Langue | `TEMPLATE_PATH` | `CV_LANG` |
|---|---|---|
| Français (défaut) | `template/my_template_cv_court.html` | `fr` |
| Anglais | `template/my_template_cv_court_en.html` | `en` |

Ces deux templates ont exactement la même structure (ids, `data-company`, nombre de bullets, `CV_SKILLS_POOL` avec les mêmes clés) — seul le contenu visible change de langue. Le patch JSON se construit et s'applique exactement pareil dans les deux cas.

### 2. Pour chaque offre : lire les règles

Lis intégralement `api/agent_court.md` **à chaque exécution du skill** (ne pas se fier à une lecture précédente dans la conversation — le fichier peut avoir changé). C'est la source de vérité pour :

- comment analyser l'offre et extraire compétences/mots-clés
- quelles compétences injecter (et lesquelles éviter pour ne pas surcharger le CV)
- comment réduire les missions à l'essentiel pour tenir sur 1-2 pages (`hide_bullets`, `hide_entries`)
- les règles strictes (ne jamais inventer d'expérience, ne jamais toucher aux dates/formation/langues, etc.)
- le format JSON exact attendu en sortie (section "Format de retour JSON")

### 3. Produire le patch JSON

En te basant sur `agent_court.md` + le `cv_context` (skills_pool, bullets_map) + le contenu de l'offre (`job_offer`, `company`, `position`), rédige toi-même le JSON du patch.

**Langue :** `header_title`, `summary` et tout `rewrite_bullets` doivent être rédigés dans la langue choisie à l'étape 1b — jamais un mélange des deux langues sur un même CV. Sur le template anglais, les libellés fixes (titres de section, formation, mois) sont déjà traduits ; toi tu ne touches que le contenu patchable, dans la même langue.

**Consignes additionnelles de l'utilisateur :** si l'utilisateur a donné des instructions dans la conversation (avant ou après avoir invoqué ce skill — ex : "ajoute exceptionnellement cette compétence Y absente de mon CV", "ignore telle compétence pour cette offre"), applique-les à la génération du patch. Elles s'ajoutent aux règles d'`agent_court.md` mais ne peuvent jamais les outrepasser — en particulier, jamais inventer d'expérience ni toucher aux dates/formation/langues, même si l'utilisateur le demande explicitement (signale-le plutôt que d'obéir).

**Important :**
- `inject_skills` est un **tableau** d'objets `{"container_id": "...", "skills": [...]}` (pas un dict) — voir `agent_court.md` pour la table des `container_id` par catégorie
- N'injecte que ce qui est attendu ou en lien direct avec l'offre — ne remplis pas le CV pour "faire complet", ce n'est pas l'objectif de ce template
- Une catégorie sans injection disparaît automatiquement du CV final (géré par `html_patcher.py`), donc n'hésite pas à laisser des catégories entièrement vides
- toutes les clés du schéma sont obligatoires (utilise `[]` ou `""` pour ce qui ne s'applique pas)

**Avant de valider le patch, vérifie** (garde-fou ATS — un CV court doit rester dense, pas vide) : au moins 3 expériences restent visibles après `hide_entries`, chacune avec au moins un bullet. Si ce n'est pas le cas, tu as trop supprimé — reviens en arrière et privilégie `hide_bullets` (retirer des bullets précis) plutôt que `hide_entries` (supprimer une mission entière).

**Deuxième vérification obligatoire, avant de valider le patch — pas après :** relis la liste des expériences visibles et, pour chacune, confirme explicitement dans ton raisonnement qu'elle comporte soit un bullet déjà chiffré, soit un `rewrite_bullets` qui en ajoute un (règle de l'étape 6 / `agent_court.md` étape 8, "Chiffrer au moins un bullet par expérience"). Une expérience visible sans aucun bullet chiffré ni justification explicite ("aucun ordre de grandeur crédible ne se dégage") est un patch incomplet — ne le valide pas tel quel.

Log dans ta réponse le résumé façon `agent_court.md` (compétences injectées, missions/bullets masqués, non couvertes) pour que l'utilisateur voie ce qui a été fait.

### 4. Appliquer le patch

Écris le JSON du patch dans un fichier temporaire, puis (remplace `TEMPLATE_PATH` selon la langue choisie à l'étape 1b — `my_template_cv_court.html` en français, `my_template_cv_court_en.html` en anglais) :

```bash
docker compose exec -T -e TEMPLATE_PATH=template/my_template_cv_court.html -e CV_TYPE=court -e CV_LANG=fr api python finalize_cv.py <application_id> < /tmp/patch.json
```

Les 3 variables d'environnement sont **toutes nécessaires** :
- `TEMPLATE_PATH` : sinon le patch part sur le template détaillé
- `CV_TYPE=court` : indique à `finalize_cv.py` d'écrire dans `cv_html_path_court`/`pdf_path_court` plutôt que dans les colonnes du CV détaillé — sans ça, générer les deux types de CV pour la même offre écraserait l'un avec l'autre en base
- `CV_LANG` (`fr` ou `en`, doit correspondre au `TEMPLATE_PATH` choisi) : décide le préfixe du fichier — `cv_*` en français, `resume_*` en anglais (le CV détaillé utilise `dc_*`/`sp_*`) — pour ne jamais écraser une autre langue/type de la même offre

Ne pas positionner `OUTPUT_DIR`/`PDF_DIR` — les deux types de CV restent dans `output/`/`pdf/` à plat, pour que le lien vers `../template/cv_court.css` reste valide (`cv_court.css` est partagé entre les templates français et anglais, pas besoin de le dupliquer).

(`-T` est nécessaire pour que le pipe stdin fonctionne avec `docker compose exec`.)

Le script applique le patch au template, écrit le HTML + PDF dans `output/` et `pdf/` (fichiers `cv_*.html`/`cv_*.pdf` en français, `resume_*.html`/`resume_*.pdf` en anglais), et met à jour la candidature en base (statut `generated`, `cv_html_path_court`/`pdf_path_court`).

### 5. Rapporter le résultat

Pour chaque offre traitée, indique : entreprise/poste, chemin du CV HTML et du PDF générés, compétences injectées, missions/bullets masqués, et les éventuelles compétences non couvertes (`unmatched_skills` — cf. `template/hard_skills.html` pour la liste de référence).

Une fois toutes les offres traitées, propose une vérification visuelle du dernier CV généré (ouvrir le fichier, ou via le MCP Chrome si pertinent dans le contexte de la conversation).

## Template

Le template de base est `template/my_template_cv_court.html` (anglais : `template/my_template_cv_court_en.html`, cf. étape 1b) — un CV 1-2 pages : tous les groupes de compétences (`Langages & Frameworks`, `Backend & API`, `Réseau & Automatisation`, `IA / Data`, `Architecture`, `DevOps & Cloud`, `Monitoring & Observability`, `Sécurité & DevSecOps`, `Outils & Qualité`, `Systèmes & Réseaux`, `Securité (Cyber)`) démarrent vides — le patch les peuple entièrement via `inject_skills`. Les deux templates partagent exactement les mêmes ids/`data-company`/clés `CV_SKILLS_POOL`, seuls les libellés fixes et le contenu par défaut changent de langue. Le style visuel est dans `template/cv_court.css` (fichier externe partagé par les deux langues, pas besoin de le régénérer à chaque fois).

## Ce que ce skill ne fait pas

- Il ne scrape rien lui-même — les offres arrivent via l'extension Chrome → `POST /webhook` → DB.
- Il ne gère pas l'automatisation du déclenchement (cron, `/loop`) — voir la story backlog "automatisation cron" dans `_bmad-output/planning-artifacts/epics.md`.
- Il ne génère pas le CV détaillé — voir le skill `generate-detailled-cv` pour ça.
