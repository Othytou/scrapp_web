# Roadmap — scrapp_web

Vue d'ensemble rapide. Détail complet des idées et de la synthèse : [_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html](_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html)

## ✅ En place

- Extension Chrome Manifest V3 — copie d'offre multi-sites (Indeed configuré ; LinkedIn, Welcome to the Jungle, HelloWork, Free-Work à compléter/partiels)
- Webhook FastAPI (`api/main.py`) — capture l'offre en base (statut `captured`), rien d'autre
- **Génération de CV via deux skills Claude Code indépendants** — tournent sur l'abonnement Claude Pro, pas sur l'API facturée, sur le même pool d'offres captées (`pending_offers.py`), colonnes DB et fichiers de sortie séparés :
  - `.claude/skills/generate-cv/` (CV court, 1-2 pages) — lit `agent_court.md`, rien affiché par défaut, uniquement les compétences attendues par l'offre (`inject_skills`)
  - `.claude/skills/generate-detailled-cv/` (CV détaillé, 2 pages) — lit `agent_detaille.md`, inventaire large affiché par défaut, réduit aux compétences/missions pertinentes (`hide_skills`/`hide_bullets`/`hide_entries`) pour ne pas surcharger
  - Les deux raisonnent eux-mêmes et appliquent le patch via `finalize_cv.py`
- Bug corrigé : `extract_cv_context` ne parsait jamais `CV_SKILLS_POOL` (skills_pool toujours vide) — fixé, avec tests
- Génération PDF (WeasyPrint) — fonctionnelle
- CRM Postgres — suivi candidatures, statuts (`captured → generated → sent → ...`), stats de réponse, chemins CV court/détaillé trackés séparément (`cv_html_path[_court]`/`pdf_path[_court]`)
- Suite de tests (`api/tests/`, pytest dans le container) + Contexte agent (`AGENTS.md` + enfants `api/`, `extension/`)
- `api/agent.py` (appel API Claude Sonnet 5, structured outputs + prompt caching) — construit et testé, mais **non utilisé par le flux actuel** (remplacé par les skills pour éviter la facturation API), gardé en l'état à trancher plus tard
- **CV détaillé 2 pages** (`template/my_template_cv_detaille.html`, générique committable : `template/template_cv_detaille.html`) — page 1 profil/expériences (patchée), page 2 missions détaillées par domaine (statique, jamais patchée)
- **CV court 1-2 pages** (`template/my_template_cv_court.html`, générique committable : `template/template_cv_court.html`) — basé sur l'ancien `template_cv_2.html` (renommé `my_template_cv_2.html`, plus référencé par défaut), tout le contenu visible vient du patch
- **Référence unique des compétences** : `template/hard_skills.html` (11 catégories) — seule source pour ce qui peut être injecté sur les deux CV
- **Convention de nommage perso vs générique** : tout fichier avec de vraies infos est préfixé `my_template_`, exclu de Git par un motif unique (`/template/my_template_*`) — pas besoin d'ajouter une ligne par fichier à chaque nouveau template
- **Free-Work — tags de compétences structurés** — `content.js` + `background.js` capturent l'encadré de tags du site (plus fiable que l'extraction depuis le texte libre) et le préfixent à `job_offer`. Pattern réutilisable (`tags` selector) pour d'autres sites.

## 📋 Planifié (issu du brainstorm)

- [ ] **Automatisation du déclenchement du skill** — épic *Claude et amélioration IA*, story *Mettre en place un cron* dans [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) : cron + `claude -p` headless (abonnement Pro, indépendant d'une session ouverte), alternative à `/loop` en session interactive
- [ ] **Pré-scoring léger** (Claude Haiku 4.5) — match rapide offre/CV avant de lancer la génération complète
- [ ] **CV court "CDI" (1-2 pages)** — variante courte du CV détaillé, sans la page missions ; templates adaptables par domaine (Data, Cyber, Dev, DevOps)
- [ ] **MCP LinkedIn** (feature annexe, architecture séparée du cœur génération CV) — récupération d'offres sans copier-coller manuel + conseils recruteurs/personnalités du secteur. À poser avec prudence côté ToS (usage non-officiel, éviter le polling en continu)

## 🧹 Dette technique connue

- [ ] Bug `init_db.sh` / `alembic init` sur redémarrage de container (voir `api/AGENTS.md` → Known pitfalls) — reporté

## 💡 Pistes plus lointaines (non planifiées)

Issues du brainstorm, à réévaluer plus tard : refonte du CV en briques d'expérience atomiques composables, détection de cohérence CV/profil LinkedIn, boucle post-entretien (brief + rétro-apprentissage sur les candidatures qui ont marché). Détail dans le keepsake HTML lié en haut de ce fichier.
