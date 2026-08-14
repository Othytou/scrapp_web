<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## extension/

Extension Chrome/Brave Manifest V3. Copie une offre d'emploi depuis un site supporté et l'envoie en `POST` vers `http://localhost:9000/webhook`.

## Where things are

- Config des sites supportés : dupliquée dans **deux fichiers** — `content.js` (`config.siteSelectors`, chemin bouton flottant, envoie au webhook) et `background.js` (`siteSelectors` dans `copyJobContent`, chemin raccourci clavier `Ctrl+Shift+M`, copie presse-papier uniquement — n'appelle PAS le webhook, asymétrie existante). Toute modif de sélecteur doit être répliquée dans les deux. LinkedIn, Welcome to the Jungle et HelloWork ont des sélecteurs vides ("À compléter") — c'est là qu'on les ajoute.
- Un site peut exposer une clé `tags` (sélecteur CSS) dans son objet de config en plus de `header`/`description` — si le site tague déjà l'offre avec ses propres mots-clés (ex: encadré de tags Free-Work), c'est plus fiable que l'extraction depuis le texte libre. Le texte des tags est préfixé à `job_offer` sous la forme `Compétences taguées par le site : ...`.
- Permissions/hosts : `manifest.json` — toute nouvelle offre de site doit être ajoutée à la fois dans `host_permissions` et `content_scripts.matches`.

## Running and verifying

- Chargement "unpacked" via `chrome://extensions` (mode développeur) en pointant sur `extension/` — pas de hot-reload, recharger après chaque modif JS.

<!-- /bmad:context -->
