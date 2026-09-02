---
name: lk-scrapp-experiences
description: Recherche des profils LinkedIn dans un métier donné (dev, data, sécurité, DevOps, ...) selon une combinaison de filtres (secteur, entreprise, poste, compétence, durée, localisation, nombre max de profils), et extrait les missions réalisées qui sont qualitatives et détaillées dans tools/linkedin-mcp/data/missions-realisees/missions-[branche].md. Utilise quand l'utilisateur dit "lk-scrapp-experiences", "scrapp-experiences", "cherche des missions [métier/secteur]" (ex. "cherche des missions data chez Airbus", "trouve des missions DevOps secteur logistique", "lk-scrapp-experiences secteur:logistique poste:devops max:5"), ou demande de constituer un corpus de missions réalisées à partir de profils LinkedIn.
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
| `poste` | développeur, DevOps, data analyste, data engineer | Ajouté aux mots-clés de recherche ; sert aussi à déterminer la branche (Étape 3c) |
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

**Fallback si le MCP bloque** (ex. `No valid LinkedIn session is available in Docker`, logs `Feed auth check failed: net::ERR_TOO_MANY_REDIRECTS`) : bascule sans interrompre la tâche sur `mcp__chrome-devtools__*`, en naviguant directement vers `https://www.linkedin.com/search/results/people/?keywords=<keywords urlencodés>` (session Chrome déjà authentifiée de l'utilisateur). Si `localisation` est fourni, ajoute-le aux `keywords` urlencodés du fallback (ex. `... Lyon`) — l'URL de recherche simple n'a pas d'équivalent direct au paramètre `location` de `search_people`, donc sans cet ajout le filtre de localisation serait silencieusement perdu en mode fallback. Signale brièvement à l'utilisateur comment relancer la session MCP LinkedIn, sans attendre cette action. Voir `AGENTS.md` (racine, section "LinkedIn MCP — fallback Chrome DevTools MCP") pour le comportement complet déjà validé.

**Si la recherche (MCP ou fallback) ne retourne aucun candidat** : ne termine pas silencieusement — indique-le explicitement à l'utilisateur avec les filtres utilisés, et suggère d'élargir un ou plusieurs filtres (secteur, compétence, localisation) plutôt que de conclure le run sans explication.

### 3. Traiter les profils un par un — jamais en lot

**Règle impérative : le traitement est séquentiel et incrémental, profil par profil.** Pour chaque profil (dans la limite de `max_profils`), exécute entièrement les sous-étapes 3a à 3d **avant de passer au profil suivant**. N'accumule jamais les missions de plusieurs profils en mémoire pour les écrire toutes à la fin — si `max_profils` est élevé (ex. 100) et que le MCP ou la session s'interrompt en cours de route, tout ce qui n'a pas encore été écrit sur disque est perdu. Écrire au fil de l'eau garantit que seul le travail réellement en cours (le profil courant) peut être perdu, jamais les profils déjà traités.

#### 3a. Récupérer les missions du profil courant

```
mcp__mcp-server-linkedin__get_person_profile(linkedin_username=..., sections="experience")
```

**Fallback chrome-devtools** : si le MCP bloque, ouvre directement `https://www.linkedin.com/in/<slug>/details/experience/` — cette page liste l'intégralité des expériences et contourne la troncature de la page profil principale (pattern déjà validé lors du test manuel de cette story).

**Si les deux voies échouent** (MCP et fallback chrome-devtools tous les deux en échec, ou profil privé/inaccessible sans section expérience exploitable) : n'invente rien et ne bloque pas le run — compte ce profil dans `max_profils`, note-le comme "profil inaccessible" dans le point de statut de l'étape 3d, et passe au profil suivant. Si tous les profils de la liste échouent ainsi, indique-le clairement dans la synthèse finale (étape 4) plutôt que de rendre un récapitulatif vide sans explication.

#### 3b. Filtrer la qualité et la durée

Pour chaque mission listée dans `experience` de ce profil :

- **Écarte** les missions sans description concrète (juste un intitulé de poste, sans détail sur ce qui a été fait) ou sans stack technique identifiable — même si le poste correspond au filtre recherché.
  - *Exemple qui passe* : "Pilotage de la migration cloud (EKS, Terraform), équipe de 5, réduction du time-to-market" (description concrète + stack + résultat).
  - *Exemple qui ne passe pas* : "Développeur chez Airbus, 2020-2022" (aucune description de ce qui a été fait, aucune stack).
- **Priorise une donnée chiffrée explicite** (%, volume, durée gagnée, nombre de serveurs/scripts/utilisateurs...) quand le profil en fournit une — ces missions serviront de référence de calibration pour insérer des ordres de grandeur réalistes et crédibles dans les CV générés (cf. `agent_court.md`/`agent_detaille.md`). Une mission concrète mais sans chiffre reste retenue si elle est par ailleurs suffisamment détaillée, mais le niveau d'exigence sur le détail global doit être plus strict qu'auparavant : privilégie les missions qui donnent assez de contexte (volumétrie, échelle, contrainte) pour qu'un chiffre plausible s'en déduise, même si le profil ne l'a pas écrit noir sur blanc.
  - *Exemple qui passe mieux* : "Automatisation de 15+ scripts Python, réduction de 60% du temps consacré aux tâches manuelles" (chiffre explicite, directement calibrable).
  - *Exemple qui passe mais moins prioritaire* : "Automatisation d'opérations réseau récurrentes via des scripts Python" (concret, stack identifiable, mais aucun ordre de grandeur — utile pour la phrasing, pas pour calibrer un chiffre).
- Si `secteur` et/ou `entreprise` sont fournis, vérifie que le contexte de la mission (nom de l'entreprise, description du secteur d'activité dans le profil) correspond raisonnablement au filtre demandé — écarte une mission dont l'employeur contredit clairement le `secteur` demandé (ex. filtre "éditeur de logiciel" mais l'employeur de la mission est un établissement scolaire, une banque, ou une administration sans lien avec l'édition logicielle), même si elle est par ailleurs qualitative.
- Si `duree` est fourni, écarte les missions dont la durée affichée (ex. "1 an 2 mois") est inférieure au seuil demandé. Pour une mission toujours en cours ("... - aujourd'hui"), calcule la durée écoulée jusqu'à aujourd'hui pour la comparaison. Si la durée affichée est absente ou non interprétable (ex. simple plage d'années sans mois), n'applique pas le filtre `duree` à cette mission plutôt que de deviner — laisse les autres critères de qualité décider.
- Ne retiens que les missions qui passeraient un contrôle qualité humain — en cas de doute sur le niveau de détail, écarte plutôt que d'inclure.
- Si aucune mission du profil ne passe ces filtres, passe directement à l'étape 3d (rien à écrire pour ce profil, mais il compte quand même dans `max_profils`).

#### 3c. Déterminer la branche et écrire immédiatement

Pour chaque mission retenue de ce profil :

- Déduis la branche métier (`dev`, `devops`, `data`, `securite`, ...) à partir du `poste`/`competence` recherchés ou, à défaut, du titre du profil / de l'intitulé de la mission. N'utilise pas de liste fermée de branches — une nouvelle branche crée simplement un nouveau fichier.
- **Normalise le nom de branche avant de choisir un fichier** : minuscules, sans accent, un seul mot ou mot composé simple (ex. "sécurité" → `securite`, "data engineering" → `data`). Liste d'abord les fichiers déjà présents dans `tools/linkedin-mcp/data/missions-realisees/` et réutilise un fichier existant si son nom correspond à la même branche normalisée — ne crée jamais un second fichier pour la même branche sous une graphie différente (ex. `missions-sécurité.md` alors que `missions-securite.md` existe déjà).
- Fichier cible : `tools/linkedin-mcp/data/missions-realisees/missions-<branche>.md`. S'il existe déjà, **lis-le d'abord en entier** puis ajoute à la suite (append) — ne l'écrase jamais. S'il est nouveau, ouvre-le par un court chapeau (2-3 lignes) expliquant les filtres utilisés pour ce run, sur le modèle de l'en-tête existant de `missions-dev.md`.
- Avant d'écrire, normalise l'URL du profil source (protocole `https://`, sans slash final, sans paramètre de tracking) puis vérifie qu'aucune entrée existante ne référence déjà cette URL normalisée pour le même intitulé de mission ; si c'est le cas, ne la ré-écris pas.
- Le numéro `N` de la nouvelle entrée est le plus grand numéro déjà présent dans le fichier, + 1 (numéro 1 si le fichier ne contient encore aucune entrée).
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

Une fois tous les profils traités, indique un récapitulatif global : filtres appliqués, nombre total de profils vérifiés, nombre total de missions retenues (et écartées pour manque de détail ou d'incohérence secteur), fichier(s) `missions-*.md` modifié(s) ou créé(s) au global. Si des profils étaient vérifiés mais qu'aucune mission n'a finalement été retenue (0 sur l'ensemble du run), dis-le explicitement et suggère d'élargir un ou plusieurs filtres plutôt que de laisser un récapitulatif silencieusement vide.

## Garde-fous

- **Résilience** : l'écriture est incrémentale, profil par profil (étape 3) — jamais un unique lot écrit à la fin. Une interruption (MCP, session, erreur) en cours de run ne fait perdre que le profil en cours de traitement, jamais les précédents.
- **NFR2** : action ponctuelle et manuelle uniquement — n'invoque jamais ce skill de façon répétée en boucle ou sans déclenchement explicite de l'utilisateur, quel que soit `max_profils`.
- **NFR1** : `tools/linkedin-mcp/data/` est entièrement gitignoré (`.gitignore` racine) — aucune contrepartie `.example.md` à créer pour les fichiers `missions-*.md`.
- **NFR3** : ce skill s'exécute dans ta propre session (abonnement Claude Pro) — pas d'appel API Anthropic facturé.

## Ce que ce skill ne fait pas

- Il ne surveille pas LinkedIn en continu — chaque run est une action explicite bornée par `max_profils`.
- Il n'écrit jamais de mission dont le contenu ne peut pas être justifié par ce qui est affiché sur le profil (pas d'invention ni d'extrapolation).
- Il ne modifie pas `api/` ni `extension/` — uniquement des fichiers sous `tools/linkedin-mcp/data/missions-realisees/`.
