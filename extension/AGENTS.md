<!-- bmad:context -->
<!-- Verified 2026-08-14 against 4c86e9d. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## extension/

Extension Chrome/Brave Manifest V3. Copie une offre d'emploi depuis un site supporté et l'envoie en `POST` vers `http://localhost:9000/webhook`.

## Where things are

- Config des sites supportés : `background.js` → objets `siteSelectors` + `supportedSites`. LinkedIn, Welcome to the Jungle et HelloWork ont des sélecteurs vides ("À compléter") — c'est là qu'on les ajoute.
- Permissions/hosts : `manifest.json` — toute nouvelle offre de site doit être ajoutée à la fois dans `host_permissions` et `content_scripts.matches`.

## Running and verifying

- Chargement "unpacked" via `chrome://extensions` (mode développeur) en pointant sur `extension/` — pas de hot-reload, recharger après chaque modif JS.

<!-- /bmad:context -->
