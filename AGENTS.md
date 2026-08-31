<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## scrapp_web

Pipeline personnel de candidature : une extension Chrome copie une offre d'emploi, une API FastAPI génère un CV HTML/PDF sur-mesure via un agent LLM, et suit les candidatures en base. Deux composants : `api/` (Python/FastAPI) et `extension/` (Manifest V3) — chacun a son propre `AGENTS.md`.

## Policy

- Ne jamais modifier `.env` — modifier `.env.example` à la place. Si `.env` lui-même doit changer, le dire à l'utilisateur, qui s'en charge.
- Ne jamais `git commit` ni `git push` (local ou prod) — l'utilisateur s'en charge exclusivement. Lire l'historique/les logs est permis.
- Ne jamais committer de CV avec de vraies données personnelles (`output/*.html`, `pdf/*.pdf`, `template/my_template_*` — déjà exclus via `.gitignore`, motif unique couvrant tout fichier préfixé `my_template_`). Tout nouveau modèle de CV avec de vraies infos doit être créé sous ce préfixe **dès sa création**, et être accompagné d'une version générique committable au nom "normal" (sans préfixe, style "Votre nom", "Votre poste"...).
- TDD préféré dès que possible pour les nouveaux développements.
- Après chaque fonctionnalité développée, vérifier plutôt que de supposer que ça marche — mais **le MCP chrome-devtools ne charge pas l'extension** (l'instance Chrome pilotée par MCP refuse les extensions, testé et confirmé le 2026-08-14). L'utilisateur teste l'extension lui-même dans son navigateur habituel ; côté agent, vérifier le backend directement (curl/scripts contre l'API, tests pytest) plutôt que de retenter le chargement via MCP.

## Where things are

- Backend Python/FastAPI : `api/AGENTS.md`
- Extension Chrome : `extension/AGENTS.md`
- Flux principal : extension → `POST /webhook` (`api/main.py`, capture uniquement) → skill Claude Code `generate-cv` (court) ou `generate-detailled-cv` (raisonne, produit le patch) → `api/html_patcher.py` (patch du template) → `output/` + `pdf/`. `api/agent.py` (appel API Anthropic) existe encore mais n'est plus dans le flux actuel — voir `api/AGENTS.md`.

## Running and verifying

- `docker compose up --build` depuis la racine lance API + Postgres + pgAdmin (ports 9000, 5432, 5050) — seul workflow de dev pour `api/`, pas d'usage local du `.venv` racine.
- L'extension se charge séparément en "unpacked" dans Chrome (voir `extension/AGENTS.md`).

<!-- /bmad:context -->

## LinkedIn MCP — fallback Chrome DevTools MCP

- Si le MCP LinkedIn (`mcp__mcp-server-linkedin__*`) bloque (ex. `No valid LinkedIn session is available in Docker` — la session Docker a expiré/est invalide, cf. logs serveur type `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`), **ne pas arrêter la tâche en cours** : basculer directement sur le MCP chrome-devtools (`mcp__chrome-devtools__*`) pour continuer le scraping LinkedIn via le Chrome piloté par MCP (session déjà connectée de l'utilisateur dans son navigateur habituel).
- Envoyer dans le chat une indication courte de ce que l'utilisateur peut faire pour relancer la session du MCP LinkedIn (ex. relancer le `--login` du serveur linkedin-mcp), **sans attendre cette action** — continuer la tâche en parallèle avec chrome-devtools.
- En scrapant via chrome-devtools, noter les URLs exactes des pages visitées (profils, recherches, listes d'employés d'entreprise) pour pouvoir les rouvrir directement lors des prochaines sessions sans répéter la recherche.
