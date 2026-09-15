# Story 1.2: Compléter le support des sites de capture restants (LinkedIn, Welcome to the Jungle, HelloWork)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que Chef,
Je veux que l'extension capture les offres depuis LinkedIn, Welcome to the Jungle et HelloWork au même titre qu'Indeed et Free-Work,
Afin de pouvoir capturer une offre depuis n'importe lequel de ces sites sans étape manuelle supplémentaire.

## Acceptance Criteria

1. **Étant donné** une page d'offre ouverte sur Welcome to the Jungle **quand** Chef déclenche la capture (bouton flottant ou `Ctrl+Shift+M`) **alors** le titre du poste, l'entreprise et la description sont extraits correctement et envoyés au webhook (bouton) ou copiés en presse-papier (raccourci).
2. **Étant donné** une page d'offre ouverte sur HelloWork **quand** Chef déclenche la capture **alors** le titre du poste, l'entreprise et la description sont extraits correctement et envoyés/copiés.
3. **Étant donné** une page d'offre ouverte sur LinkedIn **quand** Chef déclenche la capture **alors** la description est extraite correctement, et le titre du poste + l'entreprise sont extraits via un fallback dédié (voir Dev Notes — aucun sélecteur CSS fiable n'existe sur ce site).
4. **Étant donné** les sélecteurs ci-dessus **alors** ils sont configurés de façon strictement identique dans `content.js` (`config.siteSelectors`) et `background.js` (`siteSelectors` dans `copyJobContent`) — toute divergence entre les deux fichiers est un bug.
5. **Étant donné** `manifest.json` **alors** `host_permissions` et `content_scripts.matches` couvrent déjà les 3 sites (vérifié pré-existant — ne rien reformuler, juste confirmer que rien n'est cassé après les changements JS).
6. Les 3 sites sont vérifiables indépendamment : la capture peut être testée et validée sur un site sans attendre que les deux autres soient terminés.

## Tasks / Subtasks

- [ ] Task 1 — Welcome to the Jungle (AC: #1, #4)
  - [ ] Dans `content.js` (`config.siteSelectors`) ET `background.js` (`siteSelectors`), remplacer `'Welcome to the Jungle': ''` par :
    ```js
    'Welcome to the Jungle': {
      header: '[data-testid="job-metadata-block"]',
      description: '[data-testid="job-section-description"]',
      tags: '[data-testid="job-metadata-block"] div:has(> [data-testid="skills-show-more"])'
    }
    ```
  - [ ] Ajouter le cas d'extraction titre/entreprise pour ce site dans les DEUX fichiers, dans le bloc `if (header) { ... }` existant (à côté du fallback Free-Work déjà présent) :
    ```js
    // Welcome to the Jungle
    if (!position) {
      const wttjTitle = header.querySelector('h2');
      if (wttjTitle) position = wttjTitle.innerText.trim();
    }
    if (!company) {
      const wttjCompany = header.querySelector('a[href*="/companies/"] .wui-text');
      if (wttjCompany) company = wttjCompany.innerText.trim();
    }
    ```
  - [ ] Recharger l'extension et tester sur une offre WTTJ réelle (ex: `https://www.welcometothejungle.com/fr/companies/<slug>/jobs/<slug>`) via le bouton flottant ET via `Ctrl+Shift+M` — vérifier titre, entreprise, description, tags dans le payload copié.

- [ ] Task 2 — HelloWork (AC: #2, #4)
  - [ ] Dans les DEUX fichiers, remplacer `'HelloWork': ''` par :
    ```js
    'HelloWork': {
      header: 'h1#main-content',
      description: 'section:has(use[href="/svg/icons/offre.svg#offre"])'
    }
    ```
  - [ ] Ajouter le cas d'extraction titre/entreprise pour ce site dans le bloc `if (header) { ... }` des DEUX fichiers :
    ```js
    // HelloWork
    if (!position) {
      const hwTitle = header.querySelector('[data-cy="jobTitle"]');
      if (hwTitle) position = hwTitle.innerText.trim();
    }
    if (!company) {
      const hwCompany = header.querySelector('a[href*="/entreprises/"]');
      if (hwCompany) company = hwCompany.innerText.trim();
    }
    ```
  - [ ] Ne pas implémenter de sélecteur `tags` pour HelloWork dans cette story — le DOM des compétences (`ul[aria-labelledby="candidate-skills-intro"] input[name="Label"]`) mélange l'attribut `value` utile avec un texte d'instruction parasite ("Coche ou décoche cette compétence…") dans le texte visible du `<li>`, ce qui demanderait une logique de nettoyage non couverte par les ACs. À traiter dans une story dédiée si Chef le souhaite.
  - [ ] Recharger l'extension et tester sur une offre HelloWork réelle (ex: `https://www.hellowork.com/fr-fr/emplois/<id>.html`) via bouton flottant ET raccourci.

- [ ] Task 3 — LinkedIn (AC: #3, #4)
  - [ ] Dans les DEUX fichiers, remplacer `'LinkedIn': ''` par :
    ```js
    'LinkedIn': {
      header: null,
      description: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]'
    }
    ```
  - [ ] LinkedIn n'a **aucun** sélecteur CSS stable pour le bloc titre+entreprise (uniquement des classes hashées générées au build — confirmé par inspection exhaustive de tous les attributs `data-*` de la zone). Ajouter un fallback dédié basé sur `document.title`, qui suit le format stable `"{Titre du poste} | {Entreprise} | LinkedIn"`.
    - Dans `content.js`, dans le handler de clic, capturer `const siteName = detectCurrentSite();` en début de handler (pas encore disponible dans ce scope), puis ajouter, en dehors du bloc `if (header) { ... }` (puisque `header` sera `null` pour LinkedIn) :
      ```js
      if (siteName === 'LinkedIn' && (!position || !company)) {
        const titleMatch = document.title.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn/);
        if (titleMatch) {
          if (!position) position = titleMatch[1].trim();
          if (!company) company = titleMatch[2].trim();
        }
      }
      ```
    - Dans `background.js`, `siteName` existe déjà dans le scope de `copyJobContent` — ajouter le même bloc, en dehors du `if (header) { ... }`.
  - [ ] Recharger l'extension et tester sur une offre LinkedIn réelle (ex: `https://www.linkedin.com/jobs/view/<id>/`) via bouton flottant ET raccourci — vérifier que titre/entreprise viennent bien du fallback `document.title` et que la description est complète.

- [ ] Task 4 — Vérification finale (AC: #5, #6)
  - [ ] Confirmer que `manifest.json` (`host_permissions` + `content_scripts.matches`) couvre déjà les 3 sites — aucune modification attendue ici, juste une vérification après les changements JS (voir Dev Notes).
  - [ ] Recharger l'extension une dernière fois et valider les 5 sites (Indeed, Free-Work, WTTJ, HelloWork, LinkedIn) pour s'assurer qu'aucune régression n'a été introduite sur les sites déjà fonctionnels.

## Dev Notes

- **Duplication obligatoire et dangereuse** : la config des sélecteurs est dupliquée entre `content.js` (`config.siteSelectors`, chemin bouton flottant → webhook) et `background.js` (`siteSelectors` dans `copyJobContent`, chemin raccourci clavier → presse-papier uniquement, **n'appelle pas le webhook** — asymétrie déjà existante, ne pas la "corriger" dans cette story, hors scope). Toute modification de sélecteur doit être répliquée à l'identique dans les deux fichiers. C'est le principal point de vigilance documenté dans `extension/AGENTS.md`.
- **`manifest.json` est déjà complet** pour les 3 sites (`host_permissions` et `content_scripts.matches` incluent déjà `linkedin.com`, `welcometothejungle.com`, `hellowork.com`) — ne pas le modifier, seulement vérifier qu'il n'y a pas de régression après les changements JS. Ne pas réinventer ce qui est déjà fait.
- **Sélecteurs vérifiés par inspection live (chrome-devtools) le 2026-09-15, sur des offres réelles publiques** — pas de HTML fourni par l'utilisateur nécessaire, ces sélecteurs ont été testés et confirmés fonctionnels sur au moins 2 offres par site :
  - **Welcome to the Jungle** : `data-testid` stables. `[data-testid="job-metadata-block"] h2` = titre, `[data-testid="job-metadata-block"] a[href*="/companies/"] .wui-text` = entreprise (classe design-system `.wui-text` stable, à distinguer des classes `sc-xxxxx` hashées voisines à éviter), `[data-testid="job-section-description"]` = description.
  - **HelloWork** : `h1#main-content` contient deux enfants distincts (pas du texte brut à splitter) : `[data-cy="jobTitle"]` (span, titre) et un lien `a[href*="/entreprises/"]` (entreprise). Description via `section:has(use[href="/svg/icons/offre.svg#offre"])` — ancrage sur l'icône SVG du `<h2>` de section car aucun `data-testid`/classe stable n'existe sur les `<section>` elles-mêmes ; un sélecteur positionnel (`:nth-of-type`) échoue silencieusement, ne pas l'utiliser.
  - **LinkedIn** : structure "Server-Driven UI" (SDUI). Seule la description a un ancrage stable (`data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"`). Le top-card titre/entreprise n'a **aucun** attribut sémantique (ni `data-testid`, ni `data-sdui-component`, ni id, ni classe stable) — vérifié exhaustivement sur tous les attributs `data-*` de la zone. Le fallback `document.title` est nécessaire et suffisant, pas une solution de contournement fragile — c'est le seul point d'ancrage fiable disponible sur ce site.
- **Sélecteurs modernes `:has()`** : utilisés pour HelloWork (description) et WTTJ (tags). Supporté nativement par Chrome/Brave (moteur Chromium) depuis la version 105 — cohérent avec le contexte MV3 déjà utilisé (`clipboardWrite`, `chrome.scripting`), aucune polyfill nécessaire.
- **Pattern déjà établi dans le code** : le bloc `if (header) { ... }` de `content.js`/`background.js` contient déjà une chaîne de fallbacks site-spécifiques commentés (`// Indeed`, `// Free-work — fallback si Indeed n'a rien trouvé`) avec des conditions `if (!position)` / `if (!company)`. Suivre exactement ce pattern pour WTTJ et HelloWork plutôt que de créer une structure différente (switch/case, objets de config séparés, etc.) — cohérence avec le style existant.
- Aucun framework de test pour `extension/` — vérification manuelle uniquement : recharger l'extension "unpacked" via `chrome://extensions` après chaque modif JS (pas de hot-reload), voir `extension/AGENTS.md`.

### Project Structure Notes

- Fichiers modifiés : `extension/content.js`, `extension/background.js`. Aucun nouveau fichier à créer.
- `extension/manifest.json` : vérification seule, pas de modification attendue.
- Alignement avec la structure existante : les 3 nouveaux sites suivent exactement le même pattern d'objet `{ header, description, tags? }` que `Indeed` et `Free-Work` déjà en place — sauf LinkedIn où `header: null` est un cas volontairement différent (voir Dev Notes), documenté explicitement plutôt qu'un sélecteur inventé pour "faire comme les autres".

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — user story et critères d'acceptation d'origine.
- [Source: extension/AGENTS.md] — point de vigilance duplication content.js/background.js, convention `tags`.
- [Source: _bmad-output/planning-artifacts/prds/prd-scrapp_web-2026-08-14/prd.md] — FR couvrant la capture multi-sites (§4.1, ligne ~60 et ~88).
- Sélecteurs CSS vérifiés par inspection live chrome-devtools MCP le 2026-09-15 sur offres publiques réelles (Welcome to the Jungle, HelloWork, LinkedIn) — non issus d'une documentation externe, à re-vérifier si ces sites changent significativement leur DOM dans le futur.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
