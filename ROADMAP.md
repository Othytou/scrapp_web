# Roadmap — scrapp_web

Vue d'ensemble rapide. Détail complet des idées et de la synthèse : [_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html](_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html)

## ✅ En place

- Extension Chrome Manifest V3 — copie d'offre multi-sites (Indeed configuré ; LinkedIn, Welcome to the Jungle, HelloWork, Free-Work à compléter/partiels)
- Webhook FastAPI (`api/main.py`) — capture l'offre en base (statut `captured`), rien d'autre
- **Génération de CV via skill Claude Code** (`.claude/skills/generate-cv/`) — tourne sur l'abonnement Claude Pro, pas sur l'API facturée. Lit `agent.md`, raisonne lui-même, applique le patch via `pending_offers.py` + `finalize_cv.py`
- Bug corrigé : `extract_cv_context` ne parsait jamais `CV_SKILLS_POOL` (skills_pool toujours vide) — fixé, avec tests
- Génération PDF (WeasyPrint) — fonctionnelle
- CRM Postgres — suivi candidatures, statuts (`captured → generated → sent → ...`), stats de réponse
- Suite de tests (`api/tests/`, pytest dans le container) + Contexte agent (`AGENTS.md` + enfants `api/`, `extension/`)
- `api/agent.py` (appel API Claude Sonnet 5, structured outputs + prompt caching) — construit et testé, mais **non utilisé par le flux actuel** (remplacé par le skill pour éviter la facturation API), gardé en l'état à trancher plus tard
- **CV détaillé 2 pages** (`template/template_cv_detaille.html`) — devenu le template de base : page 1 profil/expériences (patchée comme avant), page 2 missions détaillées par domaine (statique, jamais patchée). Ancien `template_cv_2.html` (1 page) conservé sur disque mais plus référencé.
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
