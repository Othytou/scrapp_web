<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## api/

Backend FastAPI : reçoit l'offre via webhook, appelle l'agent CV, patch le template HTML, persiste en Postgres (async SQLAlchemy).

## Where things are

- Point d'entrée : `main.py` → `agent.py` (appel LLM) → `html_patcher.py` (patch BeautifulSoup) → `utils.py` (slugify/logger)
- Prompt système de l'agent CV / règles ATS : `agent.md` — c'est là qu'on ajuste comment le LLM réécrit le CV, pas dans `agent.py`
- Modèles DB : `models.py` (`Application`, `ApplicationEvent`)
- Migrations : `db/migrations/` (Alembic)

## Running and verifying

- Aucune suite de tests pour l'instant — TDD est l'objectif pour les nouveaux devs ; les tests devront tourner dans le container (`docker compose exec api ...`), pas de `pytest` en local.

## Conventions that differ from defaults

- Accès DB entièrement async (asyncpg + SQLAlchemy `AsyncSession`) — jamais de session sync.
- Le contrat JSON entre la sortie de `agent.py` et `html_patcher.py` est défini dans `agent.md` (section "Format de retour JSON") — garder les deux synchronisés si le schéma du patch change.

## Known pitfalls

- `init_db.sh` lance `alembic init db/migrations` sans condition à chaque démarrage du container ; `db/migrations/` existe déjà avec du contenu, donc ça échoue à tout redémarrage après le premier (bug confirmé, pas encore corrigé au 2026-08-14).
- `alembic.ini` : `script_location` doit rester `db/migrations` (relatif à `api/`), pas `../db/migrations` — déjà corrigé une fois (commit `1003e82`), ne pas réintroduire.

<!-- /bmad:context -->
