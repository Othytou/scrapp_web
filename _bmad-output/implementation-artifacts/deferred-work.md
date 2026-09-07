## Deferred from: code review of 2-3-corpus-de-missions-multi-secteurs-scrapp-experiences (2026-09-01)

- Aucun mécanisme de re-vérification (test automatisé ou autre) ne permet de contrôler dans la durée que la dédup, le filtre qualité et l'écriture incrémentale décrits dans `lk-scrapp-experiences/SKILL.md` fonctionnent réellement. La seule preuve actuelle est la note de vérification manuelle de la Task 5 de la story, et les fichiers de sortie (`tools/linkedin-mcp/data/missions-realisees/*.md`) sont gitignorés donc invisibles dans tout futur diff — une régression future sur `SKILL.md` (dédup, écriture incrémentale) ne serait détectée par rien. Pré-existant : ce pattern (skill LLM + vérification manuelle unique + données gitignorées) est commun à toutes les stories de ce type dans ce projet (ex. `generate-cv`), pas spécifique à cette story.

## Deferred from: code review of 2-4-couverture-missions-par-hard-skill-lk-hard-skill-missions (2026-09-02)

- source_spec: `_bmad-output/implementation-artifacts/2-4-couverture-missions-par-hard-skill-lk-hard-skill-missions.md`
  summary: `lk-hard-skill-missions` ne gère aucun synonyme/abréviation de hard skill (ex. JS/JavaScript, K8s/Kubernetes, Postgres/PostgreSQL) — le matching est un nom exact uniquement.
  evidence: Si une mission liste "K8s" au lieu de "Kubernetes" dans son Stack technique, elle ne sera jamais comptée pour le hard skill "Kubernetes", sans qu'aucun signal n'alerte Chef du sous-comptage — risque de sous-estimer silencieusement la couverture réelle.
- source_spec: `_bmad-output/implementation-artifacts/2-4-couverture-missions-par-hard-skill-lk-hard-skill-missions.md`
  summary: Aucune détection de dérive entre la table `hard-skills-missions.md` et le référentiel `template/hard_skills.html` si ce dernier change (skill ajouté, renommé, supprimé).
  evidence: Le Cas B (rafraîchissement) ne recalcule que les hard skills déjà présents dans la table — un nouveau skill ajouté à `hard_skills.html` n'apparaîtra dans la table qu'après une reconstruction complète (Cas A), jamais signalée automatiquement.
- source_spec: `_bmad-output/implementation-artifacts/2-4-couverture-missions-par-hard-skill-lk-hard-skill-missions.md`
  summary: Le comportement de dédup par `(catégorie, nom)` — une même compétence listée dans deux catégories produirait deux lignes distinctes — n'a jamais été explicitement discuté ni confirmé comme voulu.
  evidence: Non observé sur les 239 lignes actuelles (aucune collision constatée), mais reste un choix de conception implicite du script de référence plutôt qu'une décision produit actée avec Chef.

## Deferred from: code review of fix-cv-court-pdf-pagination, iteration 2 (2026-09-06)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: `pagination.js` (algorithme réécrit en itération 2) n'a aucun signal de non-convergence exploité côté Python — si `MAX_ITERATIONS` (200) est atteint, `console.warn` est émis côté navigateur mais `finalize_cv.py` continue et rapporte `"status": "ok"` malgré une pagination incomplète.
  evidence: Surfacé par 2 des 3 reviewers (blind-hunter, edge-case-hunter) — improbable en pratique (200 itérations suppose un CV extrêmement long ou une unité seule plus haute qu'une page entière), mais aucun garde-fou ne le détecterait si ça arrivait.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: Aucun timeout explicite sur `page.goto()`/`page.evaluate("document.fonts.ready")`/`page.pdf()` dans `_generate_pdf_via_playwright` — et si les Google Fonts sont inaccessibles (réseau bloqué/lent), `document.fonts.ready` peut se résoudre avec des polices de repli sans erreur, faussant silencieusement les mesures de hauteur utilisées par `pagination.js`.
  evidence: Surfacé par 2 des 3 reviewers — dépendance réseau non gardée, mais non observée en pratique dans cet environnement (Docker avec accès réseau normal).

## Deferred from: code review of fix-cv-court-pdf-pagination, iteration 1 (2026-09-06)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: `api/script.py` appelle encore directement `weasyprint.HTML(...).write_pdf()` de façon autonome — une fois Playwright généralisé, ce script devient une deuxième voie de génération PDF divergente de `finalize_cv.py`.
  evidence: Surfacé par la revue de code (reviewer verification-gap) — pré-existant, non touché par ce spec, mais l'incohérence grandit à mesure que `finalize_cv.py` s'éloigne de WeasyPrint.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: `template/pagination.js` ne repagine que `.col-right` — si le contenu de `.col-left` (sidebar) dépasse un jour la hauteur d'une page, il serait silencieusement clippé (`overflow:hidden`) sans page de continuation.
  evidence: Surfacé par la revue (edge-case-hunter) — improbable en pratique vu les règles anti-surcharge d'`agent_court.md` (peu de compétences injectées), mais non gardé par du code.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: Un bloc "plain" (ex. `.summary`) ou une unité `.entry`/`.edu-entry` unique plus haute qu'une page entière reste tronquée silencieusement (`overflow:hidden`), sans page supplémentaire ni log.
  evidence: Limite assumée explicitement dans les commentaires de `pagination.js` — cas hors scope de ce spec (contenu extrême, non observé sur les CV réels à ce jour).
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: `Dockerfile` fait deux passes `apt-get` distinctes (une implicite via `playwright install --with-deps`, une explicite pour `libpango`) sans nettoyage du cache apt — image plus lourde que nécessaire.
  evidence: Surfacé par la revue (blind-hunter) — optimisation de build, aucun impact fonctionnel.

## Deferred from: fix-cv-court-pdf-pagination (2026-09-06)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-cv-court-pdf-pagination.md`
  summary: Appliquer le même mécanisme de pagination JS (Playwright + `template/pagination.js`) et le même nettoyage CSS à `template/cv_detaille.css` (CV détaillé), qui partage le pattern `.body{display:grid}` + `.section{break-inside:avoid}` identique et donc le même risque de contenu perdu en PDF multi-page.
  evidence: Spec découpé pour rester sous le seuil de 1600 tokens (poids réel ~2500 tokens avant découpe) — le CV détaillé n'a pas encore de bug confirmé (contrairement au cas #12 sur le CV court), donc pas urgent de le traiter dans la même passe d'implémentation ; à traiter une fois le mécanisme validé sur le CV court.

## Deferred from: code review of 2-5-generation-experiences-cv-generate-mission-cv (2026-09-03)

- source_spec: `_bmad-output/implementation-artifacts/2-5-generation-experiences-cv-generate-mission-cv.md`
  summary: L'Étape 2 (intégration dans `my_template_cv_court.html`/`my_template_cv_detaille.html`) de `generate-mission-cv` n'a jamais été exercée en conditions réelles — seule l'Étape 1 (génération de brouillon) a été testée en direct.
  evidence: Le frozen Intent interdit explicitement toute intégration non demandée explicitement par Chef (Ask First / Never automatique) — l'exercer pendant l'implémentation aurait écrit dans les templates CV de production sans demande réelle. À couvrir la première fois que Chef demande une intégration authentique (numérotation `exp-N`, choix du `.mission-block` cible, mise à jour ciblée de l'ETAT).
- source_spec: `_bmad-output/implementation-artifacts/2-5-generation-experiences-cv-generate-mission-cv.md`
  summary: `hard-skills-missions.md` (table produite par `lk-hard-skill-missions`, Story 2.4) ne se resynchronise jamais automatiquement quand une entrée `missions-generees/<client-slug>.md` passe à `Validé` et devient une référence légitime au même titre que `missions-realisees/`.
  evidence: `lk-hard-skill-missions` ne scanne aujourd'hui que `missions-realisees/missions-*.md` — une mission validée via `generate-mission-cv` peut mettre en avant un hard skill sans que la table de couverture (2.4) ne s'en trouve jamais mise à jour, laissant la table dériver silencieusement de la réalité du corpus. Hors scope de 2.5 (toucherait le skill `lk-hard-skill-missions` d'une autre story) — à traiter comme extension éventuelle de 2.4 plutôt que par 2.5.
