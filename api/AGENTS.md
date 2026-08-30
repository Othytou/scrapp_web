<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## api/

Backend FastAPI : `/webhook` enregistre l'offre en base (statut `captured`). La génération du CV n'est PAS faite ici — elle est faite par deux skills Claude Code indépendants (racine du repo), qui tournent sur l'abonnement Claude Pro, pas sur l'API Anthropic facturée.

## Where things are

- Webhook (capture uniquement) : `main.py`
- Deux skills de génération, sur le **même** pool d'offres captées (`pending_offers.py`), colonnes DB et fichiers de sortie séparés :
  - **CV court** — skill `.claude/skills/generate-cv/` → lit `agent_court.md` → template `template/my_template_cv_court.html` (rien affiché par défaut, tout vient de `inject_skills`) → `finalize_cv.py` avec `TEMPLATE_PATH=template/my_template_cv_court.html` et `CV_TYPE=court` → écrit `output/*_court.html`/`pdf/*_court.pdf`, colonnes `cv_html_path_court`/`pdf_path_court`
  - **CV détaillé** — skill `.claude/skills/generate-detailled-cv/` → lit `agent_detaille.md` → template `template/my_template_cv_detaille.html` (2 pages, inventaire large affiché par défaut, réduit via `hide_skills`/`hide_bullets`/`hide_entries` si hors sujet) → `finalize_cv.py` (défaut, pas de `CV_TYPE`) → écrit `output/*.html`/`pdf/*.pdf`, colonnes `cv_html_path`/`pdf_path`
  - Les deux écrivent leur patch JSON eux-mêmes (pas d'appel LLM séparé) et appliquent via `html_patcher.py`
- Référence unique des compétences autorisées pour les deux : `template/hard_skills.html` (11 catégories). Toute compétence hors de cette liste va dans `unmatched_skills`, jamais injectée.
- Page 2 du CV détaillé ("Missions & Réalisations Détaillées", organisée par domaine) reste statique, jamais touchée par le patch, contrairement aux expériences de la page 1 (`exp-N-bullets`) qui le sont pour les deux templates.
- **Convention de nommage des templates :** tout fichier contenant de vraies infos personnelles est préfixé `my_template_` (`my_template_cv_detaille.html`, `my_template_cv_court.html`, `my_template_cv_2.html` — ancien template 1 page, réutilisé comme base du CV court, plus référencé par `TEMPLATE_PATH`) et exclu de Git par le motif unique `/template/my_template_*` dans `.gitignore` — pas besoin d'ajouter une ligne par fichier. Les fichiers sans ce préfixe (`template_cv_detaille.html`, `template_cv_court.html`) sont génériques et committables (placeholders type "Votre nom"). Tout nouveau template avec de vraies infos doit suivre ce préfixe dès sa création.
- Styles externalisés : `template/cv_detaille.css` et `template/cv_court.css` (un fichier par template, pas régénéré à chaque génération de CV). Le `<link>` doit rester `../template/xxx.css` et `OUTPUT_DIR`/`PDF_DIR` ne doivent PAS être modifiés (les deux CV restent à plat dans `output/`/`pdf/`, différenciés par suffixe `_court`) — sinon le chemin relatif casse.
- `agent.py` (appel API Anthropic, structured outputs + prompt caching) existe encore et est testé, mais **n'est plus appelé par le flux actuel** — lit maintenant `agent_detaille.md` (mis à jour lors du split court/détaillé). À garder comme fallback ou à supprimer, au choix de l'utilisateur.
- Modèles DB : `models.py` (`Application` — statuts `captured → generated → sent → ...`, colonnes CV court/détaillé séparées ; `ApplicationEvent`)
- Migrations : `db/migrations/` (Alembic, non fiable — voir Known pitfalls ; les colonnes `cv_html_path_court`/`pdf_path_court` ont été ajoutées par `ALTER TABLE` direct, pas par une migration versionnée)

## Running and verifying

- Tests : `docker compose exec api pytest` (pas de `pytest` en local).
- Génération de CV manuelle : invoquer le skill `generate-cv` (court) ou `generate-detailled-cv` (pas un test automatisé — nécessite une offre réelle en base).

## Conventions that differ from defaults

- Accès DB entièrement async (asyncpg + SQLAlchemy `AsyncSession`) — jamais de session sync.
- Le contrat JSON du patch est défini dans `agent_court.md`/`agent_detaille.md` (section "Format de retour JSON", identique dans les deux) — `inject_skills` est un tableau `{container_id, skills}`, pas un dict. `html_patcher.py`, `finalize_cv.py` et les deux skills doivent rester synchronisés si ce schéma change.

## Known pitfalls

- `init_db.sh` lance `alembic init db/migrations` sans condition à chaque démarrage du container ; `db/migrations/` existe déjà avec du contenu, donc ça échoue à tout redémarrage après le premier (bug confirmé, pas encore corrigé au 2026-08-14).
- `alembic.ini` : `script_location` doit rester `db/migrations` (relatif à `api/`), pas `../db/migrations` — déjà corrigé une fois (commit `1003e82`), ne pas réintroduire.
- `pending_offers.py` et `finalize_cv.py` importent directement `database.py`/`models.py`/`html_patcher.py` (pas de package) — ils doivent être exécutés depuis `/app` (cwd du container), jamais via `python -m`.

<!-- /bmad:context -->
