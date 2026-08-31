---
name: lk-scrapp-experiences
description: Recherche des profils LinkedIn dans un métier donné (dev, data, sécurité, DevOps, ...) selon une combinaison de filtres (secteur, entreprise, poste, compétence, durée, localisation, nombre max de profils), et extrait les missions réalisées qui sont qualitatives et détaillées dans tools/linkedin-mcp/data/missions-realisees/missions-[branche].md. Utilise quand l'utilisateur dit "lk-scrapp-experiences", "scrapp-experiences", "cherche des missions [métier/secteur]" (ex. "cherche des missions data chez Airbus", "trouve des missions DevOps secteur logistique"), ou demande de constituer un corpus de missions réalisées à partir de profils LinkedIn.
---

# LK Scrapp Experiences

## Overview

Ce skill recherche des profils LinkedIn publics correspondant à une combinaison de filtres, et en extrait les missions professionnelles qui sont suffisamment qualitatives et détaillées pour être réutilisées comme corpus de référence (enrichissement CV, positionnement freelance). Contrairement à un scraping généraliste, il ne retient que les missions avec une description concrète et une stack technique identifiable — les entrées vagues sont ignorées.

**Pas de restriction de secteur ou d'entreprise fixe** : tous les filtres ci-dessous sont optionnels et combinables librement.

## Filtres

| Filtre | Exemples | Usage |
|---|---|---|
| `secteur` | bancaire, communication, logistique, éditeur de logiciel | Ajouté aux mots-clés de recherche |
| `entreprise` | SG, LCL, Airbus | Ajouté aux mots-clés de recherche (et/ou `current_company` si l'URN est connu — voir Étape 2) |
| `poste` | développeur, DevOps, data analyste, data engineer | Ajouté aux mots-clés de recherche ; sert aussi à déterminer la branche (Étape 5) |
| `competence` | Python, CI/CD, Kubernetes, ELK | Ajouté aux mots-clés de recherche |
| `duree` | ≥1 mois, ≥1 an | Filtre appliqué après coup sur la durée affichée de chaque mission (pas un paramètre d'API) |
| `localisation` | France, Lyon, Angleterre, Arabie Saoudite, Japon | Mappé sur le paramètre `location` de `search_people` |
| `max_profils` | 3, 10, 100 | Borne le nombre de profils vérifiés sur ce run. **Défaut si absent : 10** (cohérence NFR2 — pas de scraping massif implicite) |

Aucun filtre n'est obligatoire — si l'utilisateur ne donne qu'un métier ("cherche des missions data"), lance la recherche avec ce seul mot-clé et le `max_profils` par défaut.

## Étapes

### 1. Résoudre les filtres depuis la demande

Extrait de la demande de l'utilisateur les filtres présents parmi ceux du tableau ci-dessus. Ne demande une clarification que si la demande est totalement vide de métier/secteur/entreprise (rien à rechercher).

### 2. Rechercher des profils

Construis une chaîne `keywords` à partir de `poste` + `competence` + `entreprise` + `secteur` (les combiner en langage naturel, ex. `"data engineer Airbus Python"`), et appelle :

```
mcp__mcp-server-linkedin__search_people(keywords=..., location=<localisation ou omis>)
```

- `current_company` de cet outil n'accepte qu'un URN numérique (pas un nom d'entreprise en clair) — il faudrait d'abord résoudre l'URN via `get_company_profile`. Sauf si l'entreprise est déjà connue par son URN dans une session précédente, il est plus simple et suffisant d'inclure le nom de l'entreprise dans `keywords`.
- Arrête-toi dès que tu as identifié `max_profils` candidats pertinents (ne fais pas défiler la recherche plus que nécessaire).

**Fallback si le MCP bloque** (ex. `No valid LinkedIn session is available in Docker`, logs `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`) : bascule sans interrompre la tâche sur `mcp__chrome-devtools__*`, en naviguant directement vers `https://www.linkedin.com/search/results/people/?keywords=<keywords urlencodés>` (session Chrome déjà authentifiée de l'utilisateur). Signale brièvement à l'utilisateur comment relancer la session MCP LinkedIn, sans attendre cette action. Voir `AGENTS.md` (racine, section "LinkedIn MCP — fallback Chrome DevTools MCP") pour le comportement complet déjà validé.

### 3. Traiter les profils un par un — jamais en lot

**Règle impérative : le traitement est séquentiel et incrémental, profil par profil.** Pour chaque profil (dans la limite de `max_profils`), exécute entièrement les sous-étapes 3a à 3d **avant de passer au profil suivant**. N'accumule jamais les missions de plusieurs profils en mémoire pour les écrire toutes à la fin — si `max_profils` est élevé (ex. 100) et que le MCP ou la session s'interrompt en cours de route, tout ce qui n'a pas encore été écrit sur disque est perdu. Écrire au fil de l'eau garantit que seul le travail réellement en cours (le profil courant) peut être perdu, jamais les profils déjà traités.

#### 3a. Récupérer les missions du profil courant

```
mcp__mcp-server-linkedin__get_person_profile(linkedin_username=..., sections="experience")
```

**Fallback chrome-devtools** : si le MCP bloque, ouvre directement `https://www.linkedin.com/in/<slug>/details/experience/` — cette page liste l'intégralité des expériences et contourne la troncature de la page profil principale (pattern déjà validé lors du test manuel de cette story).

#### 3b. Filtrer la qualité et la durée

Pour chaque mission listée dans `experience` de ce profil :

- **Écarte** les missions sans description concrète (juste un intitulé de poste, sans détail sur ce qui a été fait) ou sans stack technique identifiable — même si le poste correspond au filtre recherché.
- Si `duree` est fourni, écarte les missions dont la durée affichée (ex. "1 an 2 mois") est inférieure au seuil demandé.
- Ne retiens que les missions qui passeraient un contrôle qualité humain — en cas de doute sur le niveau de détail, écarte plutôt que d'inclure.
- Si aucune mission du profil ne passe ce filtre, passe directement à l'étape 3d (rien à écrire pour ce profil, mais il compte quand même dans `max_profils`).

#### 3c. Déterminer la branche et écrire immédiatement

Pour chaque mission retenue de ce profil :

- Déduis la branche métier (`dev`, `devops`, `data`, `securite`, ...) à partir du `poste`/`competence` recherchés ou, à défaut, du titre du profil / de l'intitulé de la mission. N'utilise pas de liste fermée de branches — une nouvelle branche crée simplement un nouveau fichier.
- Fichier cible : `tools/linkedin-mcp/data/missions-realisees/missions-<branche>.md`. S'il existe déjà, **lis-le d'abord en entier** puis ajoute à la suite (append) — ne l'écrase jamais. S'il est nouveau, ouvre-le par un court chapeau (2-3 lignes) expliquant les filtres utilisés pour ce run, sur le modèle de l'en-tête existant de `missions-dev.md`.
- Avant d'écrire, vérifie qu'aucune entrée existante ne référence déjà la même URL de profil source pour le même intitulé de mission ; si c'est le cas, ne la ré-écris pas.
- **Écris la mission sur disque dès qu'elle est validée** — ne pas attendre d'avoir traité d'autres profils. Respecte le format déjà en place :

```markdown
## N. <Nom> — <Intitulé de la mission> chez <Entreprise>

**Poste :** ...
**Entreprise / secteur :** ...
**Durée :** ...

**Mission :** <description concrète, réalisations>

**Stack technique :** ...

**Profil source :** <Nom> — "<titre du profil>" — <URL profil> (détail expérience : <URL>/details/experience/)

---
```

#### 3d. Rapporter ce profil avant de continuer

Une fois le profil courant traité (missions écrites ou aucune mission retenue), affiche à l'utilisateur un point court avant de passer au profil suivant : nom du profil, nombre de missions retenues pour ce profil (et fichier(s) `missions-*.md` concerné(s)), ou raison si rien n'a été retenu. Puis enchaîne sur le profil suivant jusqu'à épuisement de la liste ou de `max_profils`.

### 4. Rapporter la synthèse finale

Une fois tous les profils traités, indique un récapitulatif global : filtres appliqués, nombre total de profils vérifiés, nombre total de missions retenues (et écartées pour manque de détail), fichier(s) `missions-*.md` modifié(s) ou créé(s) au global.

## Garde-fous

- **Résilience** : l'écriture est incrémentale, profil par profil (étape 3) — jamais un unique lot écrit à la fin. Une interruption (MCP, session, erreur) en cours de run ne fait perdre que le profil en cours de traitement, jamais les précédents.
- **NFR2** : action ponctuelle et manuelle uniquement — n'invoque jamais ce skill de façon répétée en boucle ou sans déclenchement explicite de l'utilisateur, quel que soit `max_profils`.
- **NFR1** : `tools/linkedin-mcp/data/` est entièrement gitignoré (`.gitignore` racine) — aucune contrepartie `.example.md` à créer pour les fichiers `missions-*.md`.
- **NFR3** : ce skill s'exécute dans ta propre session (abonnement Claude Pro) — pas d'appel API Anthropic facturé.

## Ce que ce skill ne fait pas

- Il ne surveille pas LinkedIn en continu — chaque run est une action explicite bornée par `max_profils`.
- Il n'écrit jamais de mission dont le contenu ne peut pas être justifié par ce qui est affiché sur le profil (pas d'invention ni d'extrapolation).
- Il ne modifie pas `api/` ni `extension/` — uniquement des fichiers sous `tools/linkedin-mcp/data/missions-realisees/`.
