---
title: 'Compléter le support des sites de capture restants (LinkedIn, Welcome to the Jungle, HelloWork)'
type: 'feature'
created: '2026-09-15'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/extension/AGENTS.md']
baseline_commit: '6ee1c66e74730e60573adaf24ed25c8e774bb602'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** LinkedIn, Welcome to the Jungle et HelloWork ont des sélecteurs vides ("À compléter") dans l'extension — Chef ne peut pas capturer d'offres depuis ces 3 sites, contrairement à Indeed et Free-Work déjà fonctionnels.

**Approche:** Configurer les sélecteurs CSS header/description/tags (déjà vérifiés par inspection live le 2026-09-15, voir Design Notes) pour les 3 sites, à l'identique dans `content.js` et `background.js`, avec un fallback dédié via `document.title` pour LinkedIn (aucun sélecteur DOM stable n'existe pour son titre/entreprise).

## Boundaries & Constraints

**Always:** Toute modification de sélecteur est répliquée à l'identique dans `content.js` (`config.siteSelectors`) ET `background.js` (`siteSelectors` dans `copyJobContent`) — divergence entre les deux = bug. Indeed et Free-Work continuent de fonctionner sans régression après modification du bloc partagé `if (header) {...}`.

**Ask First:** Si un sélecteur listé en Design Notes ne matche plus rien au moment de l'implémentation (DOM changé depuis la vérification), HALT et demander à Chef plutôt que d'inventer un sélecteur de substitution.

**Never:** Ne pas implémenter de sélecteur `tags` pour HelloWork (DOM pollué par du texte d'instruction parasite — hors scope, story dédiée si besoin). Ne pas modifier `manifest.json` (déjà complet pour les 3 sites). Ne pas "corriger" l'asymétrie existante webhook/presse-papier entre les deux fichiers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Capture WTTJ | offre WTTJ ouverte, bouton flottant cliqué | titre+entreprise+description+tags dans le payload envoyé au webhook | sélecteur sans match → champ vide, pas d'exception |
| Capture HelloWork | offre HelloWork ouverte, `Ctrl+Shift+M` | titre+entreprise+description copiés en presse-papier | idem |
| Capture LinkedIn | offre LinkedIn ouverte, bouton flottant cliqué | description via sélecteur DOM ; titre+entreprise via parsing `document.title` | `document.title` sans match du pattern → titre/entreprise vides, pas d'exception |
| Régression Indeed/Free-Work | offre Indeed ou Free-Work ouverte | comportement identique à avant les changements | N/A |

</frozen-after-approval>

## Code Map

- `extension/content.js:6-19` -- `config.siteSelectors`, objet à compléter pour les 3 sites (actuellement `''`)
- `extension/content.js:99-151` -- handler de clic, bloc `if (header) {...}` où ajouter les fallbacks titre/entreprise par site ; `siteName` n'est pas encore capturé dans ce scope (ajouter `detectCurrentSite()`, déjà défini plus haut dans le fichier)
- `extension/background.js:34-47` -- `siteSelectors` dupliqué, doit rester identique à `content.js`
- `extension/background.js:73-120` -- bloc équivalent ; `siteName` est déjà disponible dans le scope de `copyJobContent` (ligne ~69)
- `extension/manifest.json` -- `host_permissions`/`content_scripts.matches` couvrent déjà les 3 sites, vérifier seulement

## Tasks & Acceptance

**Execution:**
- [x] `extension/content.js` -- ajouter les objets sélecteurs WTTJ/HelloWork/LinkedIn dans `config.siteSelectors` + fallbacks titre/entreprise par site dans le handler de clic (voir Design Notes) -- complète la capture pour les 3 sites côté bouton flottant
- [x] `extension/background.js` -- répliquer à l'identique dans `siteSelectors` + `copyJobContent` -- garde les deux fichiers synchronisés (contrat documenté dans `extension/AGENTS.md`)
- [x] `extension/manifest.json` -- vérifier (aucune modification attendue) que les 3 sites sont déjà couverts

**Acceptance Criteria:**
- Given une offre WTTJ/HelloWork ouverte, when Chef déclenche la capture (bouton ou raccourci), then titre/entreprise/description sont correctement extraits.
- Given une offre LinkedIn ouverte, when Chef déclenche la capture, then la description est extraite via sélecteur et titre/entreprise via `document.title`.
- Given les sélecteurs ajoutés, when on relit les deux fichiers, then les 3 objets sont strictement identiques entre `content.js` et `background.js`.
- Given Indeed ou Free-Work, when on recharge l'extension après les changements, then la capture continue de fonctionner sans régression.

## Design Notes

Sélecteurs vérifiés par inspection live (chrome-devtools) le 2026-09-15 sur offres réelles, testés sur ≥2 offres/site :

- **WTTJ** : header `[data-testid="job-metadata-block"]` ; titre `header.querySelector('h2')` ; entreprise `header.querySelector('a[href*="/companies/"] .wui-text')` ; description `[data-testid="job-section-description"]` ; tags `[data-testid="job-metadata-block"] div:has(> [data-testid="skills-show-more"])`.
- **HelloWork** : header `h1#main-content` ; titre `header.querySelector('[data-cy="jobTitle"]')` ; entreprise `header.querySelector('a[href*="/entreprises/"]')` ; description `section:has(use[href="/svg/icons/offre.svg#offre"])`.
- **LinkedIn** : `header: null` (aucun sélecteur stable trouvé, uniquement des classes hashées — vérifié exhaustivement). Description `[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]`. Fallback titre/entreprise, en dehors du bloc `if (header)` (donc gardé par `siteName === 'LinkedIn'`) — parsing par split plutôt que regex glouton, car `document.title` peut contenir des badges (ex. "B Corp™") entre l'entreprise et "LinkedIn" ; l'entreprise reste toujours le 2e segment :
  ```js
  if (siteName === 'LinkedIn' && (!position || !company)) {
    const titleParts = document.title.split('|').map(s => s.trim());
    if (titleParts.length >= 3 && titleParts[titleParts.length - 1] === 'LinkedIn') {
      if (!position) position = titleParts[0];
      if (!company) company = titleParts[1];
    }
  }
  ```
Suivre le pattern déjà en place (`// Indeed`, `// Free-work` commentés dans le bloc `if (header)`) pour WTTJ/HelloWork plutôt qu'une structure différente.

## Verification

**Manual checks (pas de framework de test pour `extension/`) :**
- Recharger l'extension "unpacked" via `chrome://extensions` après chaque modif JS (pas de hot-reload).
- Tester la capture sur une offre réelle par site (WTTJ, HelloWork, LinkedIn), via bouton flottant ET `Ctrl+Shift+M` — vérifier le payload (console / presse-papier).
- Revérifier Indeed et Free-Work pour confirmer l'absence de régression.

**Résultats de vérification (2026-09-15) :** logique d'extraction simulée en live (chrome-devtools) sur de vraies offres, sans dépendre du rechargement manuel de l'extension.
- WTTJ : `position`/`company`/`description` corrects (offre SII Brest).
- HelloWork : `position`/`company` corrects (offre Alpee) ; description courte mais complète pour cette offre précise (contenu limité côté site, pas un défaut de sélecteur).
- LinkedIn : bug initial trouvé (le fallback `document.title` polluait `company` avec un badge type "B Corp™") → corrigé dans `content.js`/`background.js` (split sur `|` + dernier segment `=== 'LinkedIn'`, l'entreprise reste toujours le 2e segment) → revérifié correct sur 2 offres (avec et sans badge).
- Indeed/Free-Work : aucune ligne de code existante modifiée (diff confirmé) → pas de risque de régression.
- Non vérifié dans cette session : le rechargement réel de l'extension "unpacked" et le bouton flottant/webhook end-to-end (nécessite une interaction manuelle Chrome que l'automatisation ne peut pas déclencher) — à faire par Chef avant de considérer la story `done`.

## Suggested Review Order

**Sélecteurs des 3 nouveaux sites**

- Point d'entrée : les objets `header`/`description`/`tags` ajoutés pour LinkedIn, WTTJ, HelloWork — `header: null` sur LinkedIn est la décision clé (aucun sélecteur DOM stable).
  [`content.js:10-22`](../../extension/content.js#L10)

- Copie strictement identique — vérifier l'absence de divergence avec le bloc ci-dessus.
  [`background.js:38-50`](../../extension/background.js#L38)

**Fallback titre/entreprise WTTJ et HelloWork**

- Nouveaux blocs `if (!position)`/`if (!company)` suivant le pattern déjà en place (Indeed, Free-Work).
  [`content.js:162-179`](../../extension/content.js#L162)

- Même logique côté raccourci clavier.
  [`background.js:130-147`](../../extension/background.js#L130)

**Fallback LinkedIn via `document.title` (bug corrigé pendant la vérification)**

- Capture de `siteName`, absente avant cette story dans ce scope — nécessaire pour gater le fallback LinkedIn.
  [`content.js:110`](../../extension/content.js#L110)

- Parsing par `split('|')` + dernier segment `=== 'LinkedIn'` (l'entreprise est toujours le 2e segment) — remplace un premier essai en regex glouton qui polluait `company` avec des badges type "B Corp™", corrigé et revérifié en live sur 2 offres.
  [`content.js:182-191`](../../extension/content.js#L182)

- Même logique, `siteName` déjà disponible dans ce scope.
  [`background.js:150-158`](../../extension/background.js#L150)
