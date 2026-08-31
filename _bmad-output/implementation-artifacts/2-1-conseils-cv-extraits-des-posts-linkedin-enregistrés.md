# Story 2.1: Conseils CV extraits des posts LinkedIn enregistrés

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Chef,
I want que le MCP LinkedIn extraie de mes posts enregistrés (saved posts) les conseils applicables à mon CV,
so that j'améliore mon CV avec des conseils concrets, sans avoir à relire moi-même chaque post ni retomber sur les mêmes conseils à chaque relance.

## Acceptance Criteria

1. **Étant donné** les posts enregistrés par Chef sur `https://www.linkedin.com/my-items/saved-posts/`, **quand** Chef déclenche la récupération via le MCP LinkedIn (`get_saved_posts`), **alors** chaque conseil identifié et pertinent pour le CV est extrait avec le texte du conseil, sa source (auteur/post), et l'URL du post d'origine quand le MCP parvient à la capturer, dans un fichier `.md` sous `tools/linkedin-mcp/data/tips-linkedin/`.
2. **Étant donné** un post déjà traité lors d'un run précédent, **quand** le MCP est relancé, **alors** ce post n'est ni relu ni redupliqué dans le fichier de conseils, grâce à un fichier de suivi dédié (`tools/linkedin-mcp/data/tips-linkedin/posts-lus.md`) qui marque chaque post comme "Lu".
3. **Étant donné** le contrôle strict des permissions MCP (NFR2), **quand** cette extraction est exécutée, **alors** elle reste une action ponctuelle déclenchée manuellement par Chef — pas de polling automatique des posts enregistrés.
4. **Étant donné** qu'un post n'expose pas d'URL exploitable dans la réponse du MCP (voir Dev Notes — cas des posts 100% texte), **quand** ce post contient malgré tout un conseil pertinent, **alors** il est quand même consigné dans le fichier de conseils et dans le fichier de suivi, en utilisant son empreinte texte comme identifiant à la place de l'URL.

## Tasks / Subtasks

- [ ] Task 1 : Créer le mécanisme d'appel et de suivi (AC: #2, #3, #4)
  - [ ] Choisir le point d'entrée déclenché manuellement par Chef (skill Claude Code dans `.claude/skills/`, sur le modèle de `generate-cv`/`generate-detailled-cv` — voir Dev Notes) plutôt qu'un script backend automatisé, pour rester cohérent avec NFR3 (abonnement Pro) et NFR2 (pas de polling)
  - [ ] Lire `tools/linkedin-mcp/data/tips-linkedin/posts-lus.md` au démarrage pour construire la liste des empreintes déjà connues
  - [ ] Appeler `get_saved_posts` (paramètre `stop_fingerprints` alimenté par les empreintes lues) pour ne récupérer que les posts non encore traités
  - [ ] Gérer l'échec `ERR_TOO_MANY_REDIRECTS` observé lors du spike (voir Dev Notes) : ne pas boucler en retry immédiat, informer Chef que le MCP est temporairement indisponible
- [ ] Task 2 : Extraire et catégoriser les conseils CV (AC: #1, #4)
  - [ ] Distinguer, dans le texte renvoyé (`sections.saved_posts`), les posts pertinents pour le CV des posts hors sujet (offres d'emploi, contenu technique non lié au CV/carrière)
  - [ ] Pour chaque post pertinent, extraire : le conseil reformulé, l'auteur/source, l'URL si présente dans `references.saved_posts` (kind `feed_post`), sinon l'empreinte texte (~80 premiers caractères)
  - [ ] Ajouter chaque conseil au fichier `tools/linkedin-mcp/data/tips-linkedin/conseils-cv.md` (ou un fichier `.md` équivalent) sans dupliquer un conseil déjà présent
- [ ] Task 3 : Mettre à jour le fichier de suivi (AC: #2, #4)
  - [ ] Pour chaque post traité (pertinent ou non — un post hors sujet doit aussi être marqué "Lu" pour ne pas être re-scanné), ajouter une ligne `Post : [identifiant] Etat : Lu` dans `posts-lus.md`
- [ ] Task 4 : Vérification manuelle (AC: #1, #2, #3)
  - [ ] Relancer le mécanisme une seconde fois et confirmer qu'aucun post déjà marqué "Lu" ne réapparaît dans `conseils-cv.md` ou n'est retraité

## Dev Notes

- **Spike de test déjà réalisé (2026-08-30)** dans le cadre de la création de cette story — les fichiers `tools/linkedin-mcp/data/tips-linkedin/conseils-cv.md` et `tools/linkedin-mcp/data/tips-linkedin/posts-lus.md` existent déjà avec un premier lot de données réelles (4 conseils CV, ~16 posts tracés) produit manuellement en testant `get_saved_posts`. Ce ne sont **pas** des fichiers d'exemple vides : ils contiennent déjà de vraies données de Chef. L'implémentation de cette story doit les compléter/enrichir (et idéalement automatiser leur construction), pas les écraser sans vérifier leur contenu actuel.
- **`tools/linkedin-mcp/` ne contient que `data/`** (cookies, profil navigateur, traces) — aucun code source du serveur MCP dans ce repo ; c'est un serveur MCP externe déjà configuré et connecté. L'implémentation de cette story n'a donc pas à modifier le serveur MCP lui-même : elle doit consommer l'outil `mcp__mcp-server-linkedin__get_saved_posts` tel quel, depuis un skill Claude Code ou un script orchestrateur de ce repo.
- **Schéma de réponse de `get_saved_posts`** (confirmé par le test) : `{url, sections: {saved_posts: "<texte brut concaténé de tous les posts scrollés>"}, references: {saved_posts: [{kind: "feed_post"|"person", url?: string, text?: string}]}}`. Le texte brut mélange corps de post, commentaires en avant-plan et mini-profils des personnes ayant réagi — **le découpage naïf par lignes/regex ne suffit pas** pour isoler fiablement chaque post (vérifié pendant le spike : plusieurs marqueurs candidats de "début de post" — degré de connexion `• 2e`/`• 1er`, ancienneté `• 2 sem.`, `…voir plus` — apparaissent aussi pour des blocs qui ne sont pas de nouveaux posts). Prévoir soit un découpage plus robuste (ex. appels `num_posts=1` incrémentaux plutôt qu'un gros lot), soit accepter cette limite et documenter les entrées non confirmées.
- **Limite critique confirmée sur les URLs** : seuls les posts contenant une carte de lien/preview externe (offre d'emploi avec lien, document partagé) apparaissent avec un champ `url` exploitable dans `references.saved_posts` (kind `feed_post`). Sur les 14 posts du test, seuls 4 avaient un `url` capturé. Les posts 100% texte — qui sont justement la majorité des posts "conseils" — n'ont **aucune URL capturée**, uniquement leur contenu dans `sections.saved_posts`. **Conséquence directe sur la conception du fichier de suivi : ne pas concevoir le dédoublonnage autour d'un ID de post systématique.** Le paramètre `stop_fingerprints` de l'outil (les ~80 premiers caractères du texte d'un post) est le mécanisme de dédoublonnage prévu par l'outil lui-même — s'aligner dessus plutôt que d'inventer un autre système d'ID.
- **Échec reproduit en test** : un second appel à `get_saved_posts` peu après le premier (avec ou sans `stop_fingerprints`, y compris avec `num_posts=1`) a échoué avec `Page.goto: net::ERR_TOO_MANY_REDIRECTS`. Le premier appel avait fonctionné sans problème. **Confirmé de nouveau plusieurs jours après** (2026-08-30, checkpoint avant la 2.1b) — même erreur, cette fois de façon systématique sur plusieurs tentatives. Hypothèse : le runtime du MCP LinkedIn tourne dans un container cloud dédié (`linux-arm64-container`, visible dans les traces d'erreur) — LinkedIn tend à bloquer/challenger plus agressivement le trafic d'IP de datacenter. Ce n'est probablement pas un hoquet passager corrigible par un simple retry.
- **MISE À JOUR MAJEURE (2026-08-30) — mécanisme alternatif validé et recommandé** : face au blocage persistant de `get_saved_posts`, une session **chrome-devtools MCP** authentifiée manuellement par Chef (navigateur local, IP résidentielle, pas de blocage constaté) permet de :
  1. Naviguer sur `my-items/saved-posts/`, scroller et cliquer sur le bouton **"Afficher plus de résultats"** (que `get_saved_posts` ne sait pas déclencher) pour atteindre la fin réelle de la liste — validé en atteignant 47/47 posts enregistrés de Chef (contre 14-15 avec `get_saved_posts` seul).
  2. Pour n'importe quel post, cliquer sur son bouton "..." puis sur **"Copier le lien vers le post"**, puis lire `navigator.clipboard.readText()` via `evaluate_script` pour récupérer l'URL exacte `feed/update/urn:li:activity:...` — **y compris pour les posts 100 % texte sans carte de lien**, ce qui lève entièrement la limite décrite dans le point précédent sur les URLs. Recette qui marche bien : cibler le bouton par son `aria-label` (contient le nom de l'auteur) plutôt que par un `uid` de snapshot déjà pris — un `uid` devient vite obsolète après une interaction précédente (vécu pendant le spike : un clic sur un `uid` périmé a fait naviguer toute la page vers `/notifications/` par erreur).
  3. Ouvrir un post dans un nouvel onglet (`new_page` avec l'URL récupérée) pour lire les **commentaires**, souvent riches en conseils complémentaires que le corps du post seul ne contient pas (ex. post de Yacine Bouhamdane sur Malt : le post pose juste une question, ce sont 4 commentaires qui apportent le vrai contenu).
  - **Recommandation pour l'implémentation** : concevoir le mécanisme pour fonctionner avec `get_saved_posts` (chemin nominal, headless, pas d'action utilisateur) mais prévoir un mode alternatif/complémentaire piloté par chrome-devtools quand `get_saved_posts` échoue ou pour couvrir les posts sans URL — ce second mode suppose que Chef se connecte manuellement à LinkedIn dans le navigateur piloté par chrome-devtools (pas d'automatisation de la saisie d'identifiants).
- **NFR2** : usage manuel, ponctuel, ciblé sur `my-items/saved-posts/` uniquement — pas de surveillance de flux, pas d'extension vers d'autres endpoints du MCP sans décision explicite.
- **NFR3** : privilégier un skill Claude Code (abonnement Pro) plutôt qu'un appel API facturé pour la catégorisation/reformulation des conseils, sur le modèle de `.claude/skills/generate-cv/SKILL.md` et `.claude/skills/generate-detailled-cv/SKILL.md`.
- **NFR1** : confirmé — `tools/linkedin-mcp/data/` est entièrement exclu par `.gitignore` (racine, ligne 43 : `tools/linkedin-mcp/data/`). `conseils-cv.md` et `posts-lus.md` ne seront donc jamais commités en l'état, ce qui est cohérent puisqu'ils contiennent du contenu de posts de tiers. Ne pas déplacer ces fichiers hors de `data/` sans re-vérifier ce point.
- **TDD (Additional Requirements, AGENTS.md)** : si une partie déterministe est extraite en script (parsing du texte brut, calcul d'empreinte, écriture/dédoublonnage dans `posts-lus.md`), l'écrire en TDD. La partie catégorisation/reformulation des conseils (jugement sur la pertinence CV) reste du ressort du skill Claude Code et n'est pas testable unitairement de la même façon — vérification manuelle (Task 4) suffisante pour cette partie.

### Project Structure Notes

- Fichiers à créer/compléter : `tools/linkedin-mcp/data/tips-linkedin/conseils-cv.md`, `tools/linkedin-mcp/data/tips-linkedin/posts-lus.md` (existent déjà avec des données de spike, voir ci-dessus).
- Point d'entrée à créer probablement dans `.claude/skills/<nom-du-skill>/SKILL.md`, en cohérence avec les skills existants du repo.
- `tools/linkedin-mcp/data/` est déjà exclu en bloc par le `.gitignore` racine (ligne 43) — ce dossier contient aussi des secrets de session (`cookies.json`, `profile/`) qui ne doivent jamais être commités (NFR1). Aucune action git requise pour cette story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] (story divisée le 2026-08-30)
- [Source: _bmad-output/planning-artifacts/prds/prd-scrapp_web-2026-08-14/prd.md#FR-5, #FR-6, NFR2]
- Spike de test manuel réalisé le 2026-08-30 lors de la création de cette story (résultats intégrés ci-dessus et dans `tools/linkedin-mcp/data/tips-linkedin/`)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
