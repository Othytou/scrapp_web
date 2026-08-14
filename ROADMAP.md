# Roadmap — scrapp_web

Vue d'ensemble rapide. Détail complet des idées et de la synthèse : [_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html](_bmad-output/brainstorming/brainstorm-cv-auto-pipeline-2026-08-14/brainstorm.html)

## ✅ En place

- Extension Chrome Manifest V3 — copie d'offre multi-sites (Indeed configuré ; LinkedIn, Welcome to the Jungle, HelloWork, Free-Work à compléter/partiels)
- Webhook FastAPI (`api/main.py`) — réception offre → génération CV
- Agent CV (`api/agent.py` + `api/agent.md`) — actuellement sur Ollama/Qwen3.5, patch JSON (highlight/inject/rewrite skills et bullets)
- Génération PDF (WeasyPrint) — fonctionnelle
- CRM Postgres — suivi candidatures, statuts, stats de réponse
- Contexte agent (`AGENTS.md` + enfants `api/`, `extension/`) — pour que les futures sessions n'aient pas à tout relire

## 🔜 En cours / prochain

- [ ] **Bascule Ollama → Claude Sonnet 5** — résout lenteur + qualité (priorité immédiate, on l'attaque maintenant)
  - Structured outputs (`output_config.format`) à la place du parsing JSON manuel
  - Prompt caching sur `agent.md` + contexte CV (skills pool, bullets map)

## 📋 Planifié (issu du brainstorm)

- [ ] **Pré-scoring léger** (Claude Haiku 4.5) — match rapide offre/CV avant de lancer la génération complète
- [ ] **CV détaillé "freelance" vs CV court "CDI"** — missions détaillées avec métriques/méthodes pour le détaillé, template court 1-2 pages pour le CDI ; templates adaptables par domaine (Data, Cyber, Dev, DevOps)
- [ ] **MCP LinkedIn** (feature annexe, architecture séparée du cœur génération CV) — récupération d'offres sans copier-coller manuel + conseils recruteurs/personnalités du secteur. À poser avec prudence côté ToS (usage non-officiel, éviter le polling en continu)

## 🧹 Dette technique connue

- [ ] Bug `init_db.sh` / `alembic init` sur redémarrage de container (voir `api/AGENTS.md` → Known pitfalls) — reporté

## 💡 Pistes plus lointaines (non planifiées)

Issues du brainstorm, à réévaluer plus tard : refonte du CV en briques d'expérience atomiques composables, détection de cohérence CV/profil LinkedIn, boucle post-entretien (brief + rétro-apprentissage sur les candidatures qui ont marché). Détail dans le keepsake HTML lié en haut de ce fichier.
