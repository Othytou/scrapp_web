# Story 2.1b: Conseils Malt / freelance extraits des posts LinkedIn enregistrés

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Chef,
I want que le MCP LinkedIn extraie de mes posts enregistrés les conseils applicables à mon profil Malt et à ma pratique freelance (prospection, TJM, positionnement),
so that j'améliore mon profil Malt et ma stratégie freelance avec des conseils concrets.

## Acceptance Criteria

1. **Étant donné** les posts enregistrés par Chef sur `https://www.linkedin.com/my-items/saved-posts/`, **quand** Chef déclenche la récupération via le MCP LinkedIn, **alors** chaque conseil identifié et pertinent pour Malt ou la pratique freelance est extrait avec le texte du conseil, sa source, et l'URL du post d'origine quand disponible, dans `tools/linkedin-mcp/data/tips-linkedin/conseils-malt.md` (spécifique à la plateforme Malt) ou `conseils-freelance.md` (freelance général, hors plateforme) selon le sujet — les deux fichiers existent déjà (voir Dev Notes).
2. **Étant donné** que la Story 2.1 met déjà en place le mécanisme de récupération et de suivi des posts lus, **quand** cette story est implémentée, **alors** elle réutilise ce même mécanisme (appel MCP, fichier de suivi par empreinte, gestion de l'échec `ERR_TOO_MANY_REDIRECTS`) plutôt que d'en recréer un nouveau — seuls la catégorisation et le dossier de sortie diffèrent.
3. **Étant donné** le contrôle strict des permissions MCP (NFR2), **quand** cette extraction est exécutée, **alors** elle reste une action ponctuelle déclenchée manuellement par Chef — pas de polling automatique des posts enregistrés.
4. **Étant donné** un post déjà lu par la Story 2.1 (car pertinent pour le CV, ou écarté car non pertinent), **quand** la Story 2.1b scanne le même lot de posts, **alors** ce post n'est pas retraité si un conseil Malt/freelance en a déjà été extrait ni redupliqué — un même post peut toutefois alimenter les deux fichiers de conseils (CV **et** Malt/freelance) s'il contient un conseil pertinent pour les deux volets.

## Tasks / Subtasks

- [ ] Task 1 : Étendre le mécanisme de la Story 2.1 (AC: #2, #3)
  - [ ] Réutiliser le point d'appel `get_saved_posts` + fichier de suivi par empreinte déjà mis en place par la Story 2.1 (ne pas dupliquer le code/skill d'appel MCP)
  - [ ] Décider si le fichier de suivi des posts lus est partagé entre 2.1 et 2.1b (un seul `posts-lus.md` commun, AC #4) ou séparé par volet — trancher lors de l'implémentation en fonction de ce qui existe déjà après la Story 2.1
- [ ] Task 2 : Extraire et catégoriser les conseils Malt / freelance (AC: #1, #4)
  - [ ] Distinguer les posts pertinents pour Malt/freelance (prospection, tarification/TJM, positionnement, mise en avant du profil Malt) des posts hors sujet
  - [ ] Compléter `tools/linkedin-mcp/data/tips-linkedin/conseils-malt.md` et `conseils-freelance.md` (déjà créés et déjà alimentés avec un premier lot réel — voir Dev Notes) au même format que `conseils-cv.md` (conseil, source, URL ou empreinte)
- [ ] Task 3 (backlog, ne pas faire avant le reste) : Analyser le profil Emmanuel Bismuth
  - [ ] Emmanuel Bismuth ("Expert SEO GEO | Le Goat Malt | +400 missions Malt", auteur de la formation
    payante "La Bible Malt") est identifié comme commentateur récurrent et référence citée par d'autres
    (ex. Chlomo Buff : "Emmanuel Bismuth est spécialisé dedans") sur le sujet Malt, dans les
    commentaires du post Yacine Bouhamdane — voir `conseils-malt.md` §1 et §1bis
  - [ ] Analyser son profil LinkedIn public (posts, résumé) pour en extraire les conseils Malt qu'il
    partage gratuitement (hors vente de sa formation), dans l'esprit de FR5 du PRD ("analyse de profil
    d'un expert reconnu dans un domaine") — rester sur du contenu public, ne pas s'inscrire à sa
    formation payante dans ce cadre
  - [ ] Croiser avec la mise en garde déjà notée dans `conseils-malt.md` §1bis sur les "coachs Malt" —
    rester critique sur un contenu qui sert aussi d'argumentaire commercial pour sa propre offre
  - [ ] Explicitement demandé par Chef le 2026-08-30 : à ajouter au backlog de cette story, ne pas
    exécuter avant que le reste de la story ne soit traité
- [ ] Task 4 : Vérification manuelle (AC: #1, #2, #3, #4)
  - [ ] Relancer le mécanisme et confirmer qu'un post déjà marqué "Lu" par la Story 2.1 n'est pas re-scanné pour rien, mais peut toujours être réutilisé pour en tirer un conseil Malt/freelance s'il est pertinent pour ce volet

## Dev Notes

- **Checkpoint réalisé le 2026-08-30 en avance de l'implémentation formelle de cette story** : `conseils-malt.md` et `conseils-freelance.md` existent déjà dans `tools/linkedin-mcp/data/tips-linkedin/` avec un premier lot réel de conseils (pas des fichiers vides) — 3 conseils Malt (dont un lu via une session chrome-devtools, avec commentaires) et 4 conseils freelance généraux. L'implémentation doit les compléter/enrichir, pas les écraser. La structure de dossier a aussi changé depuis la première rédaction de cette story : `tips-cv/` a été renommé `tips-linkedin/` et regroupe maintenant les trois fichiers de conseils (CV, Malt, freelance) plutôt que d'avoir un dossier séparé par volet.
- **Mécanisme de récupération élargi pendant ce checkpoint** : au-delà de `get_saved_posts` (qui reste bloqué par `ERR_TOO_MANY_REDIRECTS` de façon persistante — voir Story 2.1), une session chrome-devtools MCP authentifiée manuellement par Chef a permis d'atteindre 47/47 posts enregistrés (fin de liste réelle, via le bouton "Afficher plus de résultats") et de capturer l'URL exacte de n'importe quel post (y compris texte, sans carte de lien) via "..." > "Copier le lien vers le post" + lecture du presse-papier. Cette story doit réutiliser ce mécanisme au même titre que celui de la Story 2.1 — voir le détail complet dans les Dev Notes de [[2-1-conseils-cv-extraits-des-posts-linkedin-enregistrés]].
- **Cette story dépend de la Story 2.1** : elle réutilise le mécanisme d'appel MCP et de suivi des posts déjà construit par [[2-1-conseils-cv-extraits-des-posts-linkedin-enregistrés]] plutôt que d'en créer un nouveau. Lire le fichier de cette story avant de démarrer l'implémentation — toutes les contraintes techniques (limite sur la capture d'URL, échec `ERR_TOO_MANY_REDIRECTS`, format `stop_fingerprints`) s'appliquent identiquement ici et ne sont pas répétées en détail.
- **Déjà versé dans `conseils-freelance.md` / `conseils-malt.md`** (à ne pas re-extraire) : Rémy Théroux (prospection = discipline, pas méthode secrète), Bryan KANEB x2 (positionnement Malt d'un profil junior ; visibilité comme vrai débloqueur d'une première mission), Youri Novikov (profil LinkedIn lisible suffit), Théo Dorp (7 services admin freelance), Yacine Bouhamdane + commentaires (Malt = vitrine de crédibilité, pas canal actif), Noam Hakoune (optimisation profil Malt → visibilité x69), François Aubeut (repositionnement Malt d'un junior sous-payé). Reste à couvrir par cette story : les posts déjà scannés mais marqués "hors sujet" dans `posts-lus.md` méritent une relecture avec la focale Malt/freelance spécifiquement, au cas où un angle ait été manqué lors du premier passage (fait avec une focale CV).
- **Catégorisation CV vs Malt/freelance volontairement laissée ouverte** (voir Note dans `epics.md`) : certains conseils (ex. négociation appuyée par un document de résultats chiffrés) sont pertinents pour les deux volets. Pas de règle stricte imposée par cette story — l'implémentation peut dupliquer un conseil dans les deux fichiers si pertinent, plutôt que de forcer un classement exclusif.
- **NFR2/NFR3/NFR1** : identiques à la Story 2.1 (usage ponctuel et manuel du MCP, skill Claude Code plutôt qu'API facturée, `tools/linkedin-mcp/data/` déjà exclu du Git via `.gitignore` racine ligne 43).

### Project Structure Notes

- Fichier(s) à créer : `tools/linkedin-mcp/data/tips-malt/` (dossier à créer, nom à confirmer, ex. `conseils-malt.md`), suivant le même format que `tools/linkedin-mcp/data/tips-cv/conseils-cv.md`.
- Pas de nouveau point d'entrée à créer si celui de la Story 2.1 est conçu pour être réutilisable (ex. un skill unique qui catégorise en CV **et** Malt/freelance en un seul passage) — à évaluer en priorité avant de dupliquer un skill.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1b] (créée le 2026-08-30 par division de la Story 2.1 initiale)
- [Source: _bmad-output/planning-artifacts/prds/prd-scrapp_web-2026-08-14/prd.md#FR-5, #FR-6, NFR2]
- [[2-1-conseils-cv-extraits-des-posts-linkedin-enregistrés]] — story dont celle-ci réutilise le mécanisme technique

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
