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
