<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## api/

Backend FastAPI : `/webhook` enregistre l'offre en base (statut `captured`). La génération du CV n'est PAS faite ici — elle est faite par le skill Claude Code `generate-cv` (racine du repo), qui tourne sur l'abonnement Claude Pro, pas sur l'API Anthropic facturée.

## Where things are

- Webhook (capture uniquement) : `main.py`
- Génération du CV : skill `.claude/skills/generate-cv/` → lit `agent.md` (règles ATS) → écrit le patch JSON lui-même (pas d'appel LLM séparé) → `pending_offers.py` (liste les offres en attente + contexte CV) et `finalize_cv.py` (applique le patch via `html_patcher.py`, écrit HTML/PDF, met à jour la DB)
- Template actif : `template/template_cv_detaille.html` (2 pages — page 1 patchée comme avant, page 2 "Missions" statique, jamais touchée par le patch). `template/template_cv_2.html` (1 page, ancien template) reste sur disque mais n'est plus référencé par `TEMPLATE_PATH`.
- `agent.py` (appel API Anthropic, structured outputs + prompt caching) existe encore et est testé, mais **n'est plus appelé par le flux actuel** — remplacé par le skill pour éviter la facturation API. À garder comme fallback ou à supprimer, au choix de l'utilisateur.
- Modèles DB : `models.py` (`Application` — statuts `captured → generated → sent → ...`, `ApplicationEvent`)
- Migrations : `db/migrations/` (Alembic)

## Running and verifying

- Tests : `docker compose exec api pytest` (pas de `pytest` en local).
- Génération de CV manuelle : invoquer le skill `generate-cv` (pas un test automatisé — nécessite une offre réelle en base).

## Conventions that differ from defaults

- Accès DB entièrement async (asyncpg + SQLAlchemy `AsyncSession`) — jamais de session sync.
- Le contrat JSON du patch est défini dans `agent.md` (section "Format de retour JSON") — `inject_skills` est un tableau `{container_id, skills}`, pas un dict. `html_patcher.py`, `finalize_cv.py` et le skill `generate-cv` doivent rester synchronisés si ce schéma change.

## Known pitfalls

- `init_db.sh` lance `alembic init db/migrations` sans condition à chaque démarrage du container ; `db/migrations/` existe déjà avec du contenu, donc ça échoue à tout redémarrage après le premier (bug confirmé, pas encore corrigé au 2026-08-14).
- `alembic.ini` : `script_location` doit rester `db/migrations` (relatif à `api/`), pas `../db/migrations` — déjà corrigé une fois (commit `1003e82`), ne pas réintroduire.
- `pending_offers.py` et `finalize_cv.py` importent directement `database.py`/`models.py`/`html_patcher.py` (pas de package) — ils doivent être exécutés depuis `/app` (cwd du container), jamais via `python -m`.

<!-- /bmad:context -->
