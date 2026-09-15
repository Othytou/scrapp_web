# Epic 1 Context: Génération de CV ciblée (cœur du pipeline)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Chef capture une offre d'emploi depuis n'importe quel job-board supporté et obtient, via le pipeline capture → génération → finalisation, un CV ciblé et ATS-optimisé sans réécriture manuelle. Ce pipeline (capture multi-site + génération sur abonnement Pro) est déjà fonctionnel en production ; cet epic ne couvre que le delta restant : retravailler visuellement le template CV détaillé sans casser le contrat de patch existant, et compléter le support de capture pour les job-boards encore manquants.

## Stories

- Story 1.1: Reformatage visuel du template CV
- Story 1.2: Compléter le support des sites de capture restants (LinkedIn, Welcome to the Jungle, HelloWork)

## Requirements & Constraints

- La capture d'une offre n'importe quel site supporté doit l'enregistrer en base avec le statut initial `captured`, sans déclencher d'appel LLM au moment de la capture.
- Le skill `generate-cv` tourne sur l'abonnement Claude Pro (skill Claude Code), jamais via un appel API Anthropic facturé ; le patch qu'il produit doit respecter le schéma JSON existant. Le HTML/PDF généré est écrit dans `output/`/`pdf/`, et le statut de l'offre passe à `generated`.
- Le reformatage du template CV détaillé doit préserver tous les ids/data-attributes consommés par `html_patcher.py`, sauf décision explicite contraire documentée en préparation détaillée de la story — le pipeline complet (génération → patch → HTML/PDF) doit continuer à produire un CV valide après le reformatage.
- Ajouter un nouveau job-board ne doit requérir que de la configuration de sélecteurs CSS (header/description/tags) côté extension, sans modification du backend.
- Aucune vraie donnée personnelle ne doit être committée dans Git ; tout fichier créé avec de vraies informations doit avoir une contrepartie générique committable (`*.example.html`) créée au moment même de sa création.

## Technical Decisions

- Les sélecteurs de site sont dupliqués à deux endroits et doivent rester synchronisés : `extension/content.js` (`config.siteSelectors`, utilisé par le flux de capture au bouton flottant qui appelle le webhook) et `extension/background.js` (`siteSelectors`, utilisé par le raccourci `Ctrl+Shift+M`, qui copie en presse-papier plutôt que d'appeler le webhook).
- Ajouter un job-board impose aussi de mettre à jour `extension/manifest.json` (`host_permissions` et `content_scripts.matches`) — sans ça le content script ne s'injecte pas sur le nouveau site.
- Le contrat du patch JSON (défini dans `agent.md`, section "Format de retour JSON") représente `inject_skills` comme un tableau d'objets `{container_id, skills}`, pas un dict ; `html_patcher.py`, `finalize_cv.py` et le skill `generate-cv` doivent rester synchronisés sur ce schéma — point de vigilance si le reformatage du template touche au markup patché.
