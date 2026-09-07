---
title: 'Pagination PDF du CV court via navigateur headless (Playwright) — remplace WeasyPrint'
type: 'feature'
created: '2026-09-06'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: '5ed60ff4f683fef05a009e22859ffdc0fb51ab6a'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le PDF du CV court (candidature #12) perd sa section "Expériences professionnelles" (pages blanches / contenu absent) dès qu'elle dépasse une page — confirmé via `pdftotext`. Cause : WeasyPrint (moteur PDF actuel, sans JS) fragmente mal un layout CSS Grid multi-page combiné à `break-inside:avoid` sur un bloc plus haut qu'une page. Un premier correctif CSS pur (float) a été tenté et abandonné : il corrigeait le bug mais introduisait un compromis visuel (voir Spec Change Log).

**Approche :** Remplacer WeasyPrint par un navigateur headless (Playwright, Chromium) qui exécute un script JS de pagination avant `page.pdf()` — repris de `oldfile.blade.php` (`checkCardOverflow`/`create_page`/`getParentHierarchy`, système Puppeteer déjà éprouvé par l'utilisateur) : mesurer la hauteur réelle rendue de chaque "unité" (`.entry`, `.edu-entry`), et déplacer celles qui dépassent la page courante vers un nouveau `<div class="page">` cloné, jusqu'à stabilisation. Scope limité au CV court (`template/cv_court.css`) — le CV détaillé partage le même risque mais est traité séparément (`deferred-work.md`).

## Boundaries & Constraints

**Always:** Aucune modification de `template/my_template_cv_court.html` (gitignoré, appartient à l'utilisateur) — le script de pagination fonctionne uniquement via les classes déjà présentes dans le DOM existant. Ne pas toucher à `template/cv_detaille.css` ni `template/my_template_cv_detaille.html` dans ce spec. Le rendu d'un CV qui tient déjà sur une seule page ne doit pas changer visuellement. `.col-left` (sidebar) n'apparaît que sur la première page ; les pages générées par la pagination ne contiennent que la continuation de `.col-right`, en pleine largeur.

**Ask First:** Si le passage à Chromium (build Docker, taille d'image, temps de build) s'avère bloquant en pratique (échec d'installation, incompatibilité avec l'image `python:3.13-slim`) — HALT et proposer une alternative avant d'abandonner.

**Never:** Ne pas ajouter de header/footer/numérotation de page répétée (présent dans `oldfile.blade.php` mais non demandé) — le header du CV reste uniquement sur la page 1. Ne pas tenter de résoudre le cas d'un titre de section orphelin en bas de page (nice-to-have, hors scope). Ne pas modifier `html_patcher.py` ni le format du patch JSON — la pagination s'exécute après, sur le HTML déjà patché. Ne pas toucher `template/cv_detaille.css`/`my_template_cv_detaille.html`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CV court multi-page (cas #12) | 6 entrées visibles | PDF N pages, aucune page blanche, chaque entreprise + "Formation et Certification" apparaissent dans `pdftotext` | N/A |
| CV court tenant sur 1 page | Peu d'entrées | PDF 1 page, sidebar + expériences + formation identiques à l'ancien rendu WeasyPrint correct | N/A |
| Chromium échoue à démarrer (image mal construite) | `playwright install` non exécuté | `finalize_cv.py` échoue avec une erreur explicite, pas un PDF silencieusement vide | Log clair + exit non-zéro |

</frozen-after-approval>

## Code Map

- `api/finalize_cv.py:27-34` -- `generate_pdf()` appelle `weasyprint.HTML(...).write_pdf()` -- **CRITIQUE (trouvé en revue, itération 1) :** un premier essai a rendu cette fonction générique (Playwright pour tous les `CV_TYPE`), mais `pagination.js` mesure `getBoundingClientRect()` contre une limite de page capturée une seule fois au début (`getPageContentBottom(firstPage)`) -- ça suppose `.page` en hauteur FIXE (`height:297mm;overflow:hidden`, le nouveau contrat CSS de `cv_court.css`). Testé empiriquement contre le template détaillé inchangé (`.page{min-height:297mm}`, pas de cap) : `.page` grandit avec son contenu, la limite capturée devient obsolète dès le 2e item, et le résultat est incohérent (7 pages au lieu de ~2, page finale blanche). **Donc : `generate_pdf()` doit BRANCHER sur `CV_TYPE`** -- `court` utilise le nouveau pipeline Playwright + `pagination.js` ; toute autre valeur (`detaille`, le défaut) continue d'appeler `weasyprint.HTML(...).write_pdf()` EXACTEMENT comme avant ce spec (zéro changement de comportement, pas seulement "CSS non touché" mais "code path non touché"). Garder l'import `weasyprint` (toujours utilisé par `api/script.py` par ailleurs).
- `api/requirements.txt` -- ajouter `playwright` (pas de version fixée, cohérent avec `anthropic`/`pytest` déjà non pinnés)
- `api/Dockerfile:6-13` -- après `pip install`, ajouter `playwright install --with-deps chromium` pour que le binaire soit présent dans l'image
- `template/cv_court.css:83-87` -- `.body{display:grid}` reste correct pour LA PREMIÈRE page (une seule page = un seul contexte grid, pas de fragmentation à gérer)
- `template/cv_court.css:183-187` -- `.section{break-inside:avoid;page-break-inside:avoid;}` -- retirer ces 2 lignes (n'a plus lieu d'être, potentiel piège si un calcul JS est imprécis)
- `template/cv_court.css:33-40` -- `.page{min-height:297mm}` -- passer en `height:297mm; overflow:hidden` (filet de sécurité) + `break-after:page` sur `.page` sauf le dernier. **Scoper ce changement (`height`/`overflow:hidden`) à `@media print` uniquement**, pas à la règle `.page` de base -- trouvé en revue (blind-hunter) : appliqué hors `@media print`, ça clippe aussi l'aperçu navigateur normal (screen), masquant les bugs de pagination pendant le développement. Playwright appelle `page.emulate_media(media="print")` avant la mesure, donc le contrat `@media print` est bien celui utilisé par `pagination.js` -- aucune perte de garantie.
- `oldfile.blade.php:93-165` -- référence algorithmique (`checkCardOverflow`, `create_page`, `getParentHierarchy`, `getElementsEndY`) -- à adapter, PAS copier tel quel (pas de header/footer/page-numbering ici ; unités à pagineer = `.entry`/`.edu-entry` au lieu de `.card`)
- **Nouveau fichier** `template/pagination.js` -- script de pagination, injecté par Playwright via `page.add_script_tag()` puis exécuté via `page.evaluate()` avant `page.pdf()` -- ne fait PAS partie du HTML servi aux utilisateurs (ouverture navigateur directe du `.html` généré reste un rendu simple, une seule page/scroll continu, comme aujourd'hui). Écrit de façon générique (basé sur les classes `.page/.body/.col-left/.col-right/.section/.section-title/.entry/.edu-entry`, communes aux deux templates) pour être réutilisable tel quel quand `cv_detaille.css` sera traité (voir `deferred-work.md`).
- `pdf/cv_hexagone-digitale_candidat_court.pdf` / `output/cv_hexagone-digitale_candidat_court.html` -- cas de test réel (candidature #12) pour vérifier le fix
- **(2026-09-07)** `template/pagination.js:114-130` -- traitement `.section-nosplit` (voir Spec Change Log) : section entière déplacée en bloc si elle déborde et tient sur une page pleine, sinon fallback sur le découpage par unité. `template/my_template_cv_court.html`/`my_template_cv_detaille.html` -- classe `section-nosplit` ajoutée sur la `<section>` "Formation et Certification" (pas sur "Expériences professionnelles").

## Tasks & Acceptance

**Execution:**
- [x] `api/requirements.txt`, `api/Dockerfile` -- ajouter Playwright + installation Chromium -- prérequis pour exécuter du JS avant impression PDF
- [x] `template/pagination.js` (nouveau) -- algorithme de pagination basé sur `getBoundingClientRect`, ciblant `.entry`/`.edu-entry` comme unités insécables, clonant `.page > .body > .col-right > .section` (sans `.col-left`) pour les pages de continuation
- [x] `api/finalize_cv.py` -- `generate_pdf()` **branchée sur `CV_TYPE`** : `court` → nouveau pipeline Playwright (ouvrir le HTML en `file://`, `page.emulate_media(media="print")`, attendre `document.fonts.ready`, injecter + exécuter `pagination.js`, puis `page.pdf()`) ; toute autre valeur → conserver l'appel `weasyprint.HTML(...).write_pdf()` inchangé (voir Code Map)
- [x] `template/cv_court.css` -- nettoyer `.section{break-inside}` devenu obsolète ; `.page{height:297mm;overflow:hidden}` + `break-after:page`, scopés à `@media print` uniquement (voir Code Map)

**Acceptance Criteria:**
- Given le HTML déjà patché de la candidature #12, when on régénère le PDF via `finalize_cv.py` (`CV_TYPE=court`), then `pdftotext -layout` montre les 6 entreprises + "Formation et Certification", zéro page blanche.
- Given un CV court dont le contenu tient sur une seule page, when on génère le PDF, then le rendu est visuellement identique à l'ancien rendu WeasyPrint correct (pas de régression sur le cas simple).
- Given `docker compose build api`, when le build se termine, then Chromium est installé et `playwright.chromium.launch()` réussit dans le container.
- Given `CV_TYPE=detaille` (le défaut), when on génère un PDF, then le code exécuté est exactement l'ancien chemin `weasyprint.HTML(...).write_pdf()` (aucun appel à Playwright/`pagination.js`) -- vérifié en lisant le code, pas seulement en observant le PDF produit.
- Given le rendu navigateur normal (pas d'impression) d'un CV court, when on ouvre le HTML généré, then `.page` n'est pas coupé (`overflow:hidden` ne s'applique qu'en contexte impression).

## Spec Change Log

- **2026-09-07** -- Renegotiation (demande explicite de Chef, en direct) : la ligne "Never" de ce spec excluait volontairement "le cas d'un titre de section orphelin en bas de page (nice-to-have, hors scope)". Chef a explicitement demandé de le traiter pour la section "Formation et Certification" : titre + toutes les entrées doivent rester un bloc atomique — si le bloc entier ne tient pas dans la page courante, il bascule intact en page suivante (jamais coupé unité par unité, contrairement à "Expériences professionnelles" qui peut légitimement s'étaler sur plusieurs pages). Amendment : `template/my_template_cv_court.html`/`my_template_cv_detaille.html` marquent cette section via une classe `section-nosplit` (ajoutée sur la `<section>`, pas sur `.section` générique) ; `pagination.js` traite toute section `.section-nosplit` comme un bloc unique — mesure sa hauteur totale (`getBoundingClientRect`), et si elle déborde la page courante ET tient sur une page A4 pleine, la déplace intacte (titre inclus) vers une continuation ; fallback sur le découpage unité par unité si le bloc est plus haut qu'une page entière (cas non rencontré en pratique avec 5 formations). Testé empiriquement en régénérant le PDF réel de la candidature Econocom Factory (`output/cv_econocom-factory_othmane_lakbiri_court.html` → PDF via le pipeline Playwright inchangé) : `pdftoppm` confirme "Formation et Certification" entièrement sur la page 2, page 1 s'arrête proprement après LMWEB, zéro gap. KEEP : le reste de l'algorithme (découpage par unité pour les sections normales, un seul débordement traité par appel, continuation toujours en fin de document) inchangé.
- **2026-09-06** -- Finding: le premier correctif (float CSS pur dans `template/cv_court.css`, sans dépendance JS) corrigeait bien le bug rapporté (vérifié via `pdftotext`) mais laissait un compromis visuel sur la première entrée de page 1 (bloc date/entreprise empilé au lieu d'être à côté du titre), dû à une limite de WeasyPrint (les enfants `display:grid` n'évitent pas un flottant ancêtre, contrairement aux navigateurs). Amendment: remplacement complet de l'approche — abandon de WeasyPrint au profit de Playwright + script de pagination JS mesurant le rendu réel (fourni par l'utilisateur, `oldfile.blade.php`, système Puppeteer déjà utilisé par le passé). Le fix CSS float a été reverté (`git checkout -- template/cv_court.css`). KEEP: le diagnostic initial (cause racine = fragmentation Grid/break-inside sur bloc > 1 page) reste valide et motive la nouvelle approche.
- **2026-09-06** -- Finding: le spec initial (Playwright + pagination.js appliqués aux deux templates court+détaillé) pesait ~2500 tokens, au-dessus du seuil de 1600. Amendment: split — ce spec ne couvre plus que le CV court ; l'application à `cv_detaille.css` est déférée dans `deferred-work.md`. KEEP: le choix technique (Playwright, algorithme générique basé sur les classes communes aux deux templates) reste valable et prépare l'extension future.
- **2026-09-06** (revue, itération 1) -- Finding (bad_spec, confirmé empiriquement) : la première implémentation avait rendu `generate_pdf()` générique (Playwright pour tout `CV_TYPE`), exactement comme demandé par le Code Map d'origine. Mais testé directement contre `template/my_template_cv_detaille.html` (non modifié, `.page{min-height:297mm}` sans cap) : le PDF produit passe de ~2 pages attendues à 7 pages avec une page finale blanche -- `pagination.js` capture la limite de page une seule fois (`getPageContentBottom`) en supposant une hauteur FIXE, hypothèse fausse pour un `.page` en `min-height` qui grandit avec son contenu. Amendment : `generate_pdf()` doit brancher explicitement sur `CV_TYPE` -- seul `court` utilise le nouveau pipeline, toute autre valeur garde l'ancien appel WeasyPrint inchangé (voir Code Map/Tasks amendés). Deux améliorations low-risk repérées par la même revue sont intégrées à la re-dérivation : scoper `.page{height:297mm;overflow:hidden}` à `@media print` (sinon ça clippe aussi l'aperçu navigateur normal), et attendre `document.fonts.ready` avant `paginateCV()` (polices Google Fonts chargées de façon asynchrone). Code reverté à `baseline_commit` avant re-dérivation. KEEP : l'algorithme `pagination.js` lui-même (flatten/replay, mesure réelle via `getBoundingClientRect`) a été validé comme correct sur le CV court dans cette même itération -- à conserver tel quel, seul le point de branchement `CV_TYPE` dans `finalize_cv.py` et les deux réglages CSS/JS ci-dessus doivent changer.

## Design Notes

Pourquoi Playwright plutôt que continuer à patcher WeasyPrint : WeasyPrint n'exécute aucun JavaScript et a un support de fragmentation Grid/Flexbox multi-page limité — aucune combinaison de CSS pur trouvée ne reproduit fidèlement la mise en page originale sur plusieurs pages. Playwright pilote un vrai Chromium : la pagination se décide en mesurant le DOM réellement rendu (comme le faisait `oldfile.blade.php` avec Puppeteer), donc aucune dépendance aux heuristiques de fragmentation CSS d'un moteur PDF. Une fois le contenu pré-découpé en plusieurs `<div class="page">` dont chacune tient garantie dans une hauteur A4, l'impression PDF elle-même redevient triviale (`break-after:page` entre chaque `.page`, plus besoin de `break-inside:avoid`).

## Verification

**Commands:**
- `docker compose build api` -- expected: build réussi, Chromium installé
- `docker compose exec -T -e TEMPLATE_PATH=template/my_template_cv_court.html -e CV_TYPE=court api python finalize_cv.py 12 < patch.json` -- expected: régénère le PDF sans erreur
- `docker compose exec api pdftotext -layout pdf/cv_hexagone-digitale_candidat_court.pdf -` -- expected: toutes les entreprises + "Formation et Certification" présentes, aucune page vide
- `docker compose exec api pdftoppm -png -r 100 pdf/cv_hexagone-digitale_candidat_court.pdf /tmp/cv_page` -- inspection visuelle : page 1 (sidebar + début expériences) et pages suivantes (pleine largeur) sans chevauchement

**Manual checks (if no CLI):**
- Régénérer un CV existant qui tient sur une seule page (ex. une candidature avec peu de compétences/bullets injectés) et vérifier qu'il reste sur 1 page, visuellement identique à avant
- Lire `generate_pdf()` et confirmer que la branche `CV_TYPE != "court"` appelle bien `weasyprint.HTML(...).write_pdf()` sans passer par Playwright/`pagination.js` -- puis régénérer un PDF détaillé réel (`TEMPLATE_PATH=template/my_template_cv_detaille.html`, `CV_TYPE=detaille`) et vérifier via `pdftotext`/`pdfinfo` que le nombre de pages et le contenu restent cohérents avec le comportement WeasyPrint d'avant ce spec (pas de saut à 7 pages, pas de page finale blanche)

## Suggested Review Order

**Branchement CV_TYPE (le fix du bad_spec d'itération 1)**

- Point d'entrée : `generate_pdf` bascule Playwright (`court`) vs WeasyPrint inchangé (tout le reste) -- la garantie centrale de ce spec.
  [`finalize_cv.py:36`](../../api/finalize_cv.py#L36)

- Le chemin WeasyPrint (`else`) est resté un appel identique à l'ancien code, jamais touché pour `detaille`.
  [`finalize_cv.py:56`](../../api/finalize_cv.py#L56)

- Erreur Playwright désormais loggée + PDF jamais rapporté "ok" silencieusement en cas d'échec.
  [`finalize_cv.py:118`](../../api/finalize_cv.py#L118)

- Test de régression épinglant ce branchement (a déjà cassé une fois en itération 1).
  [`test_finalize_cv.py:7`](../../api/tests/test_finalize_cv.py#L7)

**Algorithme de pagination (nouveau fichier)**

- Cœur de l'algorithme : un seul débordement traité par appel, scindé par `.section` (pas par page entière) pour ne jamais mélanger deux sections sur une page de continuation -- bug trouvé et corrigé en itération 2 de revue.
  [`pagination.js:103`](../../template/pagination.js#L103)

- Les nouvelles pages sont toujours ajoutées en fin de document, jamais juste après la page source -- sinon une même page qui déborde deux fois (Expériences puis Formation) inverserait l'ordre des continuations.
  [`pagination.js:71`](../../template/pagination.js#L71)

- Reconstruction de la chaîne de conteneurs (`.body > .col-right > .section`, sans `.col-left`) pour une unité en débordement.
  [`pagination.js:48`](../../template/pagination.js#L48)

**Contrat CSS requis par l'algorithme**

- `.page` en hauteur fixe + `overflow:hidden` (filet de sécurité) + saut de page entre chaque `.page`, scopé à `@media print` uniquement pour ne pas affecter l'aperçu navigateur.
  [`cv_court.css:332`](../../template/cv_court.css#L332)

**Infrastructure (Playwright/Chromium)**

- Installation de Chromium dans l'image Docker.
  [`Dockerfile:7`](../../api/Dockerfile#L7)

- Ajout de la dépendance `playwright`.
  [`requirements.txt:26`](../../api/requirements.txt#L26)
