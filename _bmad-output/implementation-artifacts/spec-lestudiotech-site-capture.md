---
title: 'Ajouter le support de capture pour Le Studio Tech'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/extension/AGENTS.md']
baseline_commit: 'b76be13475acbc761d7838cd7ef3de3895f44356'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le Studio Tech (`app.lestudiotech.com`, plateforme de missions freelance) n'est pas un site supporté par l'extension — Chef ne peut pas y capturer d'offres, contrairement aux 6 sites déjà configurés.

**Approach:** Ajouter Le Studio Tech comme 7e site, comme pour 1.2 / StackJobs : sélecteurs `header`/`description` vérifiés en live le 2026-09-21 sur les 3 offres d'exemple (voir Design Notes), configurés à l'identique dans `content.js` et `background.js`, déclaration dans `manifest.json`. Le bloc de métadonnées (localisation, TJM, télétravail, expérience, démarrage) est capturé avec la description. Le site n'affiche jamais le nom du client final (anonymisé) : `company` = titre du poste (`position`), ce qui donne un nom de fichier CV exploitable et distinct par offre (`cv_dba-developpeur-sql-git_<candidat>.html` via `build_output_filename`).

## Boundaries & Constraints

**Always:** Toute modification de sélecteur est répliquée à l'identique dans `content.js` (`config.siteSelectors`) ET `background.js` (`siteSelectors` dans `copyJobContent`). Les 6 sites existants continuent de fonctionner sans régression.

**Ask First:** Si un sélecteur des Design Notes ne matche plus rien à l'implémentation (DOM changé), HALT et demander à Chef plutôt que d'inventer un sélecteur.

**Never:** Ne pas modifier la logique d'extraction des 6 sites existants (ajouts uniquement). Ne pas "corriger" l'asymétrie webhook/presse-papier entre `content.js` et `background.js`. Ne pas laisser `company` vide (`api/utils.py:57` produirait `cv__<candidat>.html`) ni la fixer à "Le Studio Tech" (toutes les offres écraseraient le même fichier). Ne pas modifier `api/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Capture bouton | offre `/workspace/missions/<uuid>` ouverte, bouton flottant cliqué | payload webhook : `position` = h1, `company` = `position`, `job_offer` = métadonnées + description | sélecteur sans match → champ vide, pas d'exception |
| Capture raccourci | idem, `Ctrl+Shift+M` | mêmes valeurs copiées en presse-papier | idem |
| Page hors offre | `/workspace/missions/search` ou autre page de l'app | aucun bouton (aucun match `description`) | N/A |
| Régression | offre Indeed/Free-Work/LinkedIn/WTTJ/HelloWork/StackJobs | comportement identique à avant | N/A |

</frozen-after-approval>

## Code Map

- `extension/content.js:6-34` -- `config.siteSelectors`, ajouter `'Le Studio Tech'` après `'StackJobs'`
- `extension/content.js:36-43` -- `scrappUrls`, ajouter `'lestudiotech.com'`
- `extension/content.js:52-63` -- `detectCurrentSite()`, ajouter la détection
- `extension/content.js:194-203` -- bloc LinkedIn conditionné par `siteName` : y placer, au même niveau (hors `if (header)`), `company = position` pour Le Studio Tech
- `extension/background.js:34-72` -- `siteSelectors` + `supportedSites` dupliqués, à garder identiques
- `extension/background.js:161-170` -- bloc LinkedIn équivalent, même ajout `company = position`
- `extension/manifest.json:16,39,5` -- `host_permissions`, `content_scripts.matches`, `description`
- `extension/popup.html:55` -- liste des sites (entrée StackJobs à dupliquer)
- `README.md:44-53` -- "All 6 sites" et table des sites supportés
- `api/utils.py:57`, `api/finalize_cv.py:105` -- lecture seule : le nom de fichier CV est le slug de `application.company`

## Tasks & Acceptance

**Execution:**
- [x] `extension/content.js` -- objet sélecteurs, `scrappUrls`, `detectCurrentSite()`, `company = position` -- capture côté bouton flottant
- [x] `extension/background.js` -- répliquer à l'identique (`siteSelectors`, `supportedSites`, `company = position`) -- capture côté raccourci, contrat de `extension/AGENTS.md`
- [x] `extension/manifest.json` -- `*://app.lestudiotech.com/*` dans `host_permissions` ET `content_scripts.matches`, mettre à jour `description` -- sans quoi le content script ne s'injecte pas
- [x] `extension/popup.html`, `README.md` -- entrée Le Studio Tech, "All 7 sites" -- éviter la dérive doc constatée en review StackJobs

**Acceptance Criteria:**
- Given une offre Le Studio Tech ouverte, when Chef capture (bouton ou raccourci), then `position`, `company` (= `position`) et `job_offer` (métadonnées + description) sont extraits, et le CV généré est nommé d'après le slug du poste.
- Given `content.js` et `background.js`, when on les compare, then l'objet `'Le Studio Tech'` est strictement identique.
- Given un site existant, when l'extension est rechargée, then la capture fonctionne sans régression (diff = ajouts uniquement).

## Design Notes

Le site est une SPA Tailwind sans `data-testid`. Sélecteurs vérifiés en live via chrome-devtools sur les 3 offres d'exemple (structure identique) ; extraction simulée avec la chaîne de fallbacks existante : `position: "Devops"` (le h1 ; le h2 ajoute un suffixe secteur), aucun faux positif des fallbacks entreprise des autres sites :

```js
'Le Studio Tech': {
  header: 'main:has(h1)', // <main> contenant le h1 (titre) ; ceux du footer n'en ont pas
  // 2 blocs concaténés dans l'ordre du DOM : métadonnées puis description (id "campaign-<uuid>" variable → préfixe)
  description: '[id^="campaign-"] > div:nth-child(2), main div.overflow-hidden > div.px-4.py-5 > div.text-sm.text-gray-900'
}
```

Aucun tag structuré n'existe sur ce site (pas de clé `tags`). Le titre utilise le fallback générique `header.querySelector('h1')` déjà présent — aucun code de titre nouveau.

## Verification

**Manual checks (pas de framework de test pour `extension/`) :**
- `node -c extension/content.js && node -c extension/background.js` et `python3 -m json.tool extension/manifest.json` -- expected: succès.
- `git diff` -- expected: objet `'Le Studio Tech'` identique entre les deux fichiers, ajouts uniquement.
- Recharger l'extension unpacked, capturer les 3 offres d'exemple (bouton + `Ctrl+Shift+M`) et vérifier le payload -- à faire par Chef (interaction Chrome non automatisable).

**Résultats de vérification (2026-09-21) :** logique d'extraction rejouée en live (chrome-devtools, session connectée) sur les 3 offres d'exemple : `position`/`company` = "Développeur Python/Angular", "Développeur front", "Devops" ; 2 blocs capturés (métadonnées + description, 1782 à 1979 caractères). Page `/workspace/missions/search` : 14 cartes `campaign-…` mais 0 match des sélecteurs, donc aucun bouton. `node -c` OK sur les deux JS, `manifest.json` valide, objet `'Le Studio Tech'` identique entre `content.js` et `background.js`, aucune ligne existante supprimée hors virgules de fin. Slug : `cv_dba-developpeur-sql-git_candidat.html` via `build_output_filename`. Le site exige une connexion (redirection `/auth/signin` hors session). Non vérifié : rechargement réel de l'extension, bouton flottant et webhook de bout en bout — à faire par Chef.

**Revue (2026-09-21) — 3 relecteurs (Blind Hunter, Edge Case Hunter, Verification Gap), 3 patches appliqués :** garde `!company` supprimée (les fallbacks des autres sites s'exécutent avant et ne sont pas bornés par site — un faux positif aurait écarté `company = position`) ; commentaire de `header` corrigé (`<main>` contenant le h1) ; affirmation « distinct par offre » corrigée dans les commentaires et le README (deux offres au titre identique, ou identique sur les 40 premiers caractères — troncature de `slugify` — partagent le même fichier CV). Écartés : `company = position` (décision de Chef), duplication `content.js`/`background.js` (contrat `extension/AGENTS.md`), fragilité des sélecteurs Tailwind (couverte par « Ask First »), `:has()` (déjà utilisé par WTTJ/HelloWork), `includes()` sur l'URL (pattern existant des 6 autres sites), absence de tests (pas de framework pour `extension/`, site derrière connexion).

## Suggested Review Order

**Sélecteurs Le Studio Tech (config partagée)**

- Point d'entrée : header par `main:has(h1)`, description = métadonnées + description concaténées, sans `data-testid`.
  [`content.js:33`](../../extension/content.js#L33)

- Réplique strictement identique côté raccourci clavier — toute divergence est un bug.
  [`background.js:61`](../../extension/background.js#L61)

**Titre du poste → `company` (nom du CV généré)**

- Seul point de logique : le slug de `company` nomme le fichier CV, le client est anonymisé.
  [`content.js:214`](../../extension/content.js#L214)

- Même règle côté `background.js`.
  [`background.js:180`](../../extension/background.js#L180)

**Détection du site**

- URL ajoutée à la liste des sites supportés et au détecteur.
  [`content.js:48`](../../extension/content.js#L48)
  [`content.js:67`](../../extension/content.js#L67)

- Réplique dans `supportedSites`.
  [`background.js:77`](../../extension/background.js#L77)

**Permissions et documentation (peripherals)**

- `host_permissions` : sans cela, le raccourci ne s'injecte pas sur le site.
  [`manifest.json:19`](../../extension/manifest.json#L19)

- `content_scripts.matches`, même ajout : le bouton flottant en dépend.
  [`manifest.json:44`](../../extension/manifest.json#L44)

- Table des sites supportés et limite du nom de fichier CV.
  [`README.md:54`](../../README.md#L54)

- Entrée du popup.
  [`popup.html:58`](../../extension/popup.html#L58)
