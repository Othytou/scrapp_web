<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## scrapp_web

Pipeline personnel de candidature : une extension Chrome copie une offre d'emploi, une API FastAPI génère un CV HTML/PDF sur-mesure via un agent LLM, et suit les candidatures en base. Deux composants : `api/` (Python/FastAPI) et `extension/` (Manifest V3) — chacun a son propre `AGENTS.md`.

## Policy

- Ne jamais modifier `.env` — modifier `.env.example` à la place. Si `.env` lui-même doit changer, le dire à l'utilisateur, qui s'en charge.
- Ne jamais `git commit` ni `git push` (local ou prod) — l'utilisateur s'en charge exclusivement. Lire l'historique/les logs est permis.
- Ne jamais committer de CV avec de vraies données personnelles (`output/*.html`, `pdf/*.pdf`, `template/template_cv_2.html` — déjà exclus via `.gitignore`). Tout nouveau modèle de CV doit être accompagné d'une version template générique committable ("Votre nom", "Votre poste"...).
- TDD préféré dès que possible pour les nouveaux développements.
- Après chaque fonctionnalité développée, vérifier plutôt que de supposer que ça marche — mais **le MCP chrome-devtools ne charge pas l'extension** (l'instance Chrome pilotée par MCP refuse les extensions, testé et confirmé le 2026-08-14). L'utilisateur teste l'extension lui-même dans son navigateur habituel ; côté agent, vérifier le backend directement (curl/scripts contre l'API, tests pytest) plutôt que de retenter le chargement via MCP.

## Where things are

- Backend Python/FastAPI : `api/AGENTS.md`
- Extension Chrome : `extension/AGENTS.md`
- Flux principal : extension → `POST /webhook` (`api/main.py`) → `api/agent.py` (appel LLM) → `api/html_patcher.py` (patch du template) → `output/` + `pdf/`

## Running and verifying

- `docker compose up --build` depuis la racine lance API + Postgres + pgAdmin (ports 9000, 5432, 5050) — seul workflow de dev pour `api/`, pas d'usage local du `.venv` racine.
- L'extension se charge séparément en "unpacked" dans Chrome (voir `extension/AGENTS.md`).

<!-- /bmad:context -->
