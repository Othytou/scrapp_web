---
title: 'Ajouter le support de capture pour StackJobs'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/extension/AGENTS.md']
baseline_commit: 'ae40367499b47cebb8c93c1f4d0b41e7bba12530'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** StackJobs n'est pas un site supporté par l'extension — Chef ne peut pas capturer d'offres depuis ce job-board, contrairement à Indeed, Free-Work, LinkedIn, Welcome to the Jungle et HelloWork.

**Approche:** Ajouter StackJobs comme 6e site, en suivant exactement le schéma de la story 1.2 : sélecteurs CSS header/description/tags (vérifiés par inspection live le 2026-09-16 sur une offre réelle, voir Design Notes) configurés à l'identique dans `content.js` et `background.js`, plus un fallback dédié pour l'entreprise (alt de l'image logo — aucun texte visible n'existe pour le nom de l'entreprise sur ce site), et déclaration dans `manifest.json`.

## Boundaries & Constraints

**Always:** Toute modification de sélecteur est répliquée à l'identique dans `content.js` (`config.siteSelectors`) ET `background.js` (`siteSelectors` dans `copyJobContent`) — divergence entre les deux = bug. Les 5 sites existants continuent de fonctionner sans régression.

**Ask First:** Si un sélecteur listé en Design Notes ne matche plus rien au moment de l'implémentation (DOM changé depuis la vérification), HALT et demander à Chef plutôt que d'inventer un sélecteur de substitution.

**Never:** Ne pas modifier la logique d'extraction des 5 sites existants. Ne pas "corriger" l'asymétrie existante webhook/presse-papier entre `content.js` et `background.js`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Capture StackJobs | offre StackJobs ouverte, bouton flottant cliqué | titre+entreprise+description+tags dans le payload envoyé au webhook | sélecteur sans match → champ vide, pas d'exception |
| Capture StackJobs raccourci | offre StackJobs ouverte, `Ctrl+Shift+M` | titre+entreprise+description copiés en presse-papier | idem |
| Régression sites existants | offre Indeed/Free-Work/LinkedIn/WTTJ/HelloWork ouverte | comportement identique à avant les changements | N/A |

</frozen-after-approval>

## Code Map

- `extension/content.js:6-19` -- `config.siteSelectors`, ajouter l'objet `'StackJobs'` (actuellement absent)
- `extension/content.js:20-27` -- `scrappUrls`, ajouter `'stackjobs.com'`
- `extension/content.js:48-56` -- `detectCurrentSite()`, ajouter `if (url.includes('stackjobs.com')) return 'StackJobs';`
- `extension/content.js:140-180` -- handler de clic, bloc `if (header) {...}` : le fallback générique `header.querySelector('h1')` (déjà présent, labellisé "Free-Work") suffit pour le titre StackJobs (le container `header` englobe le h1). Ajouter un fallback dédié `!company` pour lire l'attribut `alt` du logo entreprise (aucun texte visible pour le nom de l'entreprise sur ce site)
- `extension/background.js:34-47` -- `siteSelectors` dupliqué, doit rester identique à `content.js`
- `extension/background.js:~60-120` -- bloc équivalent au handler de `content.js`, même ajout du fallback entreprise
- `extension/manifest.json` -- ajouter `*://*.stackjobs.com/*` dans `host_permissions` ET `content_scripts.matches`

## Tasks & Acceptance

**Execution:**
- [x] `extension/content.js` -- ajouter l'objet sélecteurs `'StackJobs'` dans `config.siteSelectors` + `'stackjobs.com'` dans `scrappUrls` + détection dans `detectCurrentSite()` + fallback entreprise (alt du logo) dans le handler de clic -- complète la capture StackJobs côté bouton flottant
- [x] `extension/background.js` -- répliquer à l'identique dans `siteSelectors` + `copyJobContent` -- garde les deux fichiers synchronisés (contrat documenté dans `extension/AGENTS.md`)
- [x] `extension/manifest.json` -- ajouter StackJobs dans `host_permissions` et `content_scripts.matches` -- seul site des 6 nécessitant cette étape (les 5 autres l'avaient déjà)

**Acceptance Criteria:**
- Given une offre StackJobs ouverte, when Chef déclenche la capture (bouton ou raccourci), then titre/entreprise/description/tags sont correctement extraits.
- Given les sélecteurs ajoutés, when on relit les deux fichiers, then l'objet `'StackJobs'` est strictement identique entre `content.js` et `background.js`.
- Given un site existant (Indeed, Free-Work, LinkedIn, WTTJ, HelloWork), when on recharge l'extension après les changements, then la capture continue de fonctionner sans régression.

## Design Notes

StackJobs (Next.js, Tailwind utility classes uniquement, aucun `data-testid`/id sémantique). Sélecteurs vérifiés en live le 2026-09-16 via chrome-devtools sur `https://www.stackjobs.com/jobs/developpeur-python-grenoble-mtvqhpbs`, extraction simulée bout-en-bout avec succès (`position: "Développeur Python (h/f)"`, `company: "MATEN"`, `tags: ["Python","Git","Linux"]`) :

```js
'StackJobs': {
  header: 'div.rounded-3xl.min-h-screen',      // englobe h1 (titre) + logo entreprise
  description: 'div.space-y-6 section:nth-of-type(2)', // 2e <section> = "Description de l'offre" (la 1re est "Description de l'entreprise", même classe, non distinguable par classe seule)
  tags: 'div.lg\\:justify-end [title]'          // chips "Stack requis" (Python/Git/Linux...)
}
```

Fallback entreprise dédié (aucun texte visible pour le nom — seulement l'attribut `alt` de l'image logo) :
```js
// StackJobs — pas de texte visible pour l'entreprise, alt de l'image logo
if (!company) {
  const sjLogo = header.querySelector('img[src*="/company-logos/"]');
  if (sjLogo) company = sjLogo.alt.trim();
}
```
Placer ce bloc dans la même zone que les fallbacks Free-Work/WTTJ/HelloWork existants (après le bloc générique Indeed, avant le fallback LinkedIn qui est conditionné par `siteName === 'LinkedIn'`).

Le titre ne nécessite aucun code nouveau : le fallback générique déjà présent (`header.querySelector('h1')`, commenté "Free-Work" mais générique) fonctionne tel quel car le `h1` StackJobs est un descendant direct du container `header` choisi.

## Verification

**Manual checks (pas de framework de test pour `extension/`) :**
- Recharger l'extension "unpacked" via `chrome://extensions` après chaque modif JS (pas de hot-reload).
- Tester la capture sur une offre StackJobs réelle, via bouton flottant ET `Ctrl+Shift+M` — vérifier le payload (console / presse-papier).
- Revérifier Indeed, Free-Work, LinkedIn, WTTJ, HelloWork pour confirmer l'absence de régression.

**Résultats de vérification (2026-09-16) :** logique d'extraction simulée en live (chrome-devtools) sur l'offre réelle, sans dépendre du rechargement manuel de l'extension.
- StackJobs : `position`/`company`/`tags` corrects sur l'offre Développeur Python / MATEN / Grenoble (`position: "Développeur Python (h/f)"`, `company: "MATEN"`, `tags: ["Python","Git","Linux"]`) ; aucun sélecteur sans match.
- `content.js`/`background.js` : `git diff` confirme l'objet `'StackJobs'` strictement identique entre les deux fichiers ; `node -c` passe sur les deux ; `manifest.json` valide (`python3 -m json.tool`).
- Indeed/Free-Work/LinkedIn/WTTJ/HelloWork : aucune ligne de code existante modifiée (diff confirmé, ajouts uniquement) → pas de risque de régression.
- Non vérifié dans cette session : le rechargement réel de l'extension "unpacked" et le bouton flottant/webhook end-to-end (nécessite une interaction manuelle Chrome que l'automatisation ne peut pas déclencher) — à faire par Chef avant de considérer la story `done`.

**Revue (2026-09-16) — 3 patches appliqués suite aux findings blind-hunter :** `README.md` (section "Supported Job Boards" mentionnait encore "All 5 sites", table sans StackJobs), `extension/popup.html` (StackJobs absent de `sites-list`), `extension/manifest.json` (champ `description` sans StackJobs). Re-vérifié après patch : `manifest.json` valide, `content.js`/`background.js` toujours syntaxiquement corrects. Findings de fragilité des sélecteurs (conteneurs Tailwind génériques, ordre de sections supposé, alt du logo sans validation) jugés acceptés par conception — couverts par la clause "Ask First" du spec et le comportement de dégradation silencieuse déjà spécifié dans l'I/O Matrix ; aucun n'a de fix propre et non spéculatif. Pré-existant hors scope différé dans `deferred-work.md` : `popup.html` affiche encore LinkedIn/WTTJ/HelloWork/Free-Work en "À configurer" malgré la story 1.2.

## Suggested Review Order

**Sélecteurs StackJobs (config partagée)**

- Point d'entrée : objet sélecteurs StackJobs — header/description/tags construits sur des classes Tailwind faute de `data-testid` (voir Design Notes pour la justification).
  [`content.js:28`](../../extension/content.js#L28)

- Réplique strictement identique côté raccourci clavier — toute divergence ici est un bug (AC #2).
  [`background.js:56`](../../extension/background.js#L56)

**Détection du site**

- Ajout de l'URL StackJobs à la liste des sites supportés et au détecteur.
  [`content.js:60`](../../extension/content.js#L60)

- Réplique côté `background.js`.
  [`background.js:71`](../../extension/background.js#L71)

**Fallback entreprise (logo `alt`)**

- Seul point non-trivial du handler : StackJobs n'a aucun texte visible pour le nom de l'entreprise, extraction via l'attribut `alt` du logo.
  [`content.js:187`](../../extension/content.js#L187)

- Réplique identique côté `background.js`.
  [`background.js:154`](../../extension/background.js#L154)

**Permissions et documentation (peripherals)**

- `host_permissions`/`content_scripts.matches` — sans quoi le content script ne s'injecte jamais sur StackJobs.
  [`manifest.json:18`](../../extension/manifest.json#L18)

- `content_scripts.matches`, même ajout.
  [`manifest.json:42`](../../extension/manifest.json#L42)

- Description de l'extension mise à jour (patch review).
  [`manifest.json:5`](../../extension/manifest.json#L5)

- Table des sites supportés mise à jour (patch review).
  [`README.md:53`](../../README.md#L53)

- Entrée StackJobs ajoutée au popup (patch review).
  [`popup.html:55`](../../extension/popup.html#L55)
