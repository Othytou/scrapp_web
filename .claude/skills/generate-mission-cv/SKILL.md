---
name: generate-mission-cv
description: Génère un brouillon d'expérience CV pour un client réel (fourni par Chef), inspiré du corpus de missions réalisées (`missions-realisees/missions-*.md`) et de la table `hard-skills-missions.md`, écrit dans `tools/linkedin-mcp/data/missions-generees/<client-slug>.md`. Sur demande explicite ultérieure de Chef, intègre un brouillon validé dans `template/my_template_cv_court.html` / `template/my_template_cv_detaille.html`. Utilise quand l'utilisateur dit "generate-mission-cv", "génère une mission chez <client>", "génère-mission-cv client:<client> contexte:<contexte>", "valide et intègre la mission <client> <contexte>", ou demande de rédiger/intégrer une expérience CV sur-mesure pour un client réel.
---

# Generate Mission CV

## Overview

Ce skill a deux actions bien séparées, jamais déclenchées ensemble implicitement :

1. **Génération** (par défaut) : à partir d'un client réel + d'un contexte de mission fournis par Chef, compose un brouillon d'expérience CV crédible, inspiré du corpus `missions-realisees/` et de la table `hard-skills-missions.md`, et l'écrit dans `tools/linkedin-mcp/data/missions-generees/<client-slug>.md`.
2. **Intégration** (uniquement sur demande explicite de Chef, après qu'il a validé un brouillon) : ajoute l'expérience dans les templates CV réels (`template/my_template_cv_court.html` / `template/my_template_cv_detaille.html`) selon les conventions de markup existantes.

**Le client/employeur est toujours réel et fourni par Chef — jamais de mission entièrement fictive.** Le corpus sert à calibrer la formulation, le niveau de détail et les ordres de grandeur, pas à inventer le client.

## Fichiers concernés

- `tools/linkedin-mcp/data/missions-realisees/missions-*.md` — corpus source (lecture seule).
- `tools/linkedin-mcp/data/hard-skills-missions.md` — table de référence (lecture seule) ; tous statuts (Couvert/Partiel/À traiter) sont éligibles, ne jamais filtrer dessus.
- `tools/linkedin-mcp/data/missions-generees/<client-slug>.md` — un fichier par client, entrées numérotées append-only, écrit/actualisé par ce skill (gitignoré via `tools/linkedin-mcp/data/`, comme `missions-realisees/`).
- `template/my_template_cv_court.html` et `template/my_template_cv_detaille.html` (page 1 patchable + page 2 statique) — modifiés uniquement à l'étape 2 (Intégration), jamais à l'étape 1.

## Étape 1 — Génération du brouillon

### 1a. Résoudre la demande

Extrait de la demande de Chef : le **client réel** (obligatoire — sans client, demande une clarification, ne procède pas) et le **contexte de mission** (poste, stack, secteur — obligatoire lui aussi : sans lui, le skill n'a aucune base pour choisir les missions de référence ni titrer l'entrée, demande une clarification et ne procède pas), plus toute info factuelle fournie (durée, chiffres, contraintes spécifiques). N'invente jamais le client ni son secteur d'activité.

### 1b. Résoudre le fichier cible

Slug = kebab-case du **nom du client uniquement**, normalisé : retire apostrophes/accents, retire les suffixes légaux courants s'ils sont présents (SA, SAS, SARL, SASU, etc.), passe en minuscules, remplace les espaces par des tirets (ex. "CIC" → `cic`, "Crédit Agricole" → `credit-agricole`, "L'Oréal" → `loreal`, "Dupont SAS" → `dupont`). Le contexte de mission ne sert jamais au nom de fichier, un client n'a qu'un seul fichier `tools/linkedin-mcp/data/missions-generees/<slug>.md`.

- **Avant de créer un nouveau fichier** : liste d'abord `tools/linkedin-mcp/data/missions-generees/` et regarde si un fichier existant (en-tête, champs `**Entreprise :**` de ses entrées) semble déjà référencer ce même client réel sous une autre graphie (ex. "Crédit Agricole" vs "Crédit Agricole CIB", "CA" vs "Crédit Agricole"). Si un doute raisonnable existe, **ne crée pas silencieusement un second fichier** — demande à Chef de confirmer s'il s'agit bien du même client (auquel cas utiliser le fichier existant) ou d'un client réellement distinct.
- Si le fichier cible existe déjà : **lis-le en entier** avant toute écriture. N'écrase jamais une entrée existante — une nouvelle mission pour ce client s'ajoute toujours comme nouvelle entrée numérotée à la fin (même logique d'append que `missions-realisees/missions-*.md`).
- Si le fichier n'existe pas (et qu'aucun fichier existant ne semble référencer le même client sous une autre graphie) : crée le dossier `tools/linkedin-mcp/data/missions-generees/` si besoin, et ouvre le nouveau fichier par un court chapeau (2-3 lignes) sur le modèle de l'en-tête de `missions-realisees/missions-dev.md` (fichier alimenté par ce skill, brouillons à valider avant usage CV).
- Le numéro `N` de la nouvelle entrée est le plus grand numéro déjà présent dans le fichier + 1. Si le fichier existe mais ne contient aucune entrée `## N.` reconnaissable (vide, corrompu, ou modifié manuellement) — même fallback que le Cas B de `lk-hard-skill-missions/SKILL.md` — traite-le comme n'ayant aucune entrée : `N = 1`.

### 1c. Sélectionner les missions de référence

- Cherche dans `missions-realisees/missions-*.md` les entrées dont le poste/la stack/le secteur recoupent le contexte demandé.
- Consulte aussi `tools/linkedin-mcp/data/missions-generees/<slug>.md` lui-même : une entrée déjà présente avec `**ETAT :** Validé — intégré le ...` est une référence légitime au même titre que `missions-realisees/` (relit son contenu). **Une entrée encore `Brouillon` n'est jamais une référence valide** — ignore-la pour la sélection (même logique que "ne pas utiliser comme référence pour la génération de CV" inscrite dans le champ ETAT lui-même).
- Consulte `hard-skills-missions.md` pour les hard skills pertinents au contexte demandé (par catégorie/nom), **sans filtrer par statut** — Couvert, Partiel et À traiter sont tous éligibles à être mentionnés/mis en avant dans le brouillon. **Si ce fichier n'existe pas du tout** (ex. le skill `lk-hard-skill-missions` n'a jamais été exécuté) : ce n'est pas bloquant, continue en t'appuyant uniquement sur `missions-realisees/` pour la sélection des références, mais signale explicitement dans le rapport final (1f) que la table `hard-skills-missions.md` était absente — ne saute jamais cette source silencieusement.
- **Corpus insuffisant (arrêt total)** : si **rien du tout** n'est pertinent (aucune mission de référence utilisable dans `missions-realisees/`/entrées `Validé`, et aucun hard skill du secteur/contexte demandé dans `hard-skills-missions.md`), **arrête-toi et signale-le clairement à Chef** — quels filtres/contexte ont été cherchés, ce qui manque — puis propose explicitement de relancer `lk-scrapp-experiences` **manuellement** (donne la commande/l'invocation suggérée). Ne déclenche jamais `lk-scrapp-experiences` toi-même dans ce skill.
- **Insuffisance partielle (ne bloque pas)** : si le contexte/secteur a des missions de référence exploitables mais que le **hard skill précis demandé** n'a de correspondance directe ni de substitution plausible nulle part dans le corpus (missions-realisees/ ni hard-skills-missions.md), ne t'arrête pas — compose le brouillon avec ce qui est effectivement pertinent, et signale explicitement dans le rapport (1f) que ce hard skill précis n'a pas pu être mis en avant faute de référence exploitable. L'arrêt total (paragraphe précédent) ne s'applique que si rien n'est exploitable du tout pour le contexte demandé.

### 1d. Composer le brouillon

- **Poste / Entreprise** : intitulé du contexte demandé, client réel fourni par Chef — jamais reformulé en un autre client.
- **Durée** : utilise ce que Chef a fourni. S'il n'a rien précisé, écris `**Durée :** À préciser (non fournie par Chef)` plutôt que d'inventer une durée plausible — signale-le dans ton rapport final (1f) pour que Chef la complète s'il le souhaite ; ce n'est pas bloquant pour générer le reste du brouillon.
- **Mission** : rédige une description concrète inspirée du style et du niveau de détail des missions de référence sélectionnées (1c), adaptée au client/contexte réels — jamais un copier-coller de la mission source avec juste le nom du client changé.
- **Substitution de stack** : si le hard skill réellement visé est absent tel quel des missions de référence mais qu'une stack équivalente y figure (ex. référence en Node.js, hard skill visé = Python), fais la substitution et **mentionne-la explicitement** dans le brouillon (ex. "stack équivalente à une mission de référence initialement réalisée en Node.js, adaptée ici en Python") — jamais une substitution silencieuse.
- **Réalisations / bullets** : reprends le niveau de détail des missions de référence (concret, stack identifiable). Pour un chiffre, ne le reprends que s'il reste plausible dans le contexte réel du client — un seul bullet chiffré suffit, ne force jamais un chiffre sur chaque ligne (même règle que `agent_detaille.md` section calibration).
- **Champ `**ETAT :**`** : place-le juste après le champ `**Mission :**` (avant les bullets de réalisations), valeur par défaut `Brouillon — ne pas utiliser comme référence pour la génération de CV`.
- **`**Stack technique :**`** : liste la stack réellement mise en avant dans ce brouillon (nom de champ exact, pour rester cohérent avec le matching de `lk-hard-skill-missions` si ce brouillon devient une référence validée plus tard).
- **`**Missions de référence :**`** : cite les sources utilisées (`missions-[branche].md#N`, entrées `missions-generees/<slug>.md#N` déjà Validé le cas échéant, et/ou lignes de `hard-skills-missions.md` consultées) — traçabilité obligatoire, jamais un brouillon sans source citée.

Format d'entrée :

```markdown
## N. <Titre de la mission> chez <Client>

**Poste :** <intitulé>
**Entreprise :** <Client>
**Durée :** <fournie par Chef, ou "À préciser (non fournie par Chef)">

**Mission :** <description concrète, adaptée du corpus de référence>
**ETAT :** Brouillon — ne pas utiliser comme référence pour la génération de CV

Réalisations :
- ...
- ...

**Stack technique :** ...

**Missions de référence :** missions-dev.md#3, missions-data.md#7, hard-skills-missions.md (Python, Django)

---
```

### 1e. Écrire l'entrée

Écris (append, jamais d'écrasement) l'entrée `## N. ...` à la fin de `tools/linkedin-mcp/data/missions-generees/<slug>.md`, entrées précédentes intactes.

### 1f. Rapporter à Chef

Indique : fichier créé/modifié, numéro d'entrée, sources citées, toute substitution de stack effectuée, tout champ laissé "À préciser", l'absence de `hard-skills-missions.md` le cas échéant (1c), et tout hard skill précisément demandé qui n'a pas pu être mis en avant faute de référence exploitable (insuffisance partielle, 1c). Rappelle explicitement que ce brouillon n'est pas intégré aux templates et ne le sera que sur sa demande explicite après validation.

## Étape 2 — Intégration (uniquement sur demande explicite après validation)

**Ne jamais enchaîner automatiquement après l'étape 1** — l'intégration n'a lieu que si Chef le demande explicitement dans un tour séparé (ex. "valide et intègre la mission CIC dev Python"), après avoir eu l'occasion de relire le brouillon.

### 2a. Localiser le brouillon

Repère l'entrée visée dans `missions-generees/<slug>.md` (par client + contexte, ou numéro d'entrée explicite). **Si le brouillon est introuvable, signale-le sans rien modifier** (ni template, ni fichier de missions générées).

**Garde-fou ETAT déjà `Validé`** : avant d'aller plus loin, vérifie le champ `**ETAT :**` de l'entrée trouvée. Si elle porte déjà `Validé — intégré le ...`, **arrête-toi et demande confirmation explicite à Chef** avant de continuer — une ré-intégration silencieuse écrirait un `.entry`/`.mission-item` en double dans les templates déjà à jour. Ne procède que si Chef confirme explicitement vouloir ré-intégrer malgré tout.

### 2b. Confirmer avant d'écrire

Avant toute écriture dans un template, obtiens confirmation explicite de Chef sur le contenu exact du brouillon à intégrer (Ask First) — si la demande d'intégration ne précise pas déjà clairement quelle entrée et quel(s) template(s) (court/détaillé/les deux, page 2 incluse ou non), demande-le.

**Garde-fou Durée placeholder** : si le champ `**Durée :**` de l'entrée est encore `À préciser (non fournie par Chef)`, **ne procède pas à l'intégration** — ce texte littéral se retrouverait autrement écrit dans un template CV en production. Demande d'abord à Chef la durée réelle, et ne reprends l'intégration qu'une fois ce champ renseigné (mets aussi à jour le champ dans `missions-generees/<slug>.md` avant d'intégrer).

### 2c. Intégrer dans la page patchable (`.entry`)

Pour chaque template ciblé (`template/my_template_cv_court.html` et/ou `template/my_template_cv_detaille.html`, page 1) :

- Lis le fichier en entier, repère le plus grand `id="exp-N"` existant dans la section "Expériences professionnelles" — le nouvel id est `exp-<N+1>` (numérotation propre à chaque fichier, indépendante entre les deux templates). **Si la section "Expériences professionnelles" (ou sa balise de fermeture) est introuvable dans le template** — structure inattendue, template modifié entre-temps — **arrête-toi et signale-le à Chef sans rien écrire** (même logique que "brouillon introuvable" en 2a).
- `data-company` : version compacte du slug client (minuscules, sans séparateur, cohérent avec les valeurs déjà en place comme `karbonalpha`, `pragmatiq`).
- Construit le bloc en respectant strictement le markup existant :

```html
<div class="entry" id="exp-<N+1>" data-company="<slug-compact>">
	<div class="entry-meta">
		<div class="entry-period"><période></div>
		<div class="entry-company"><Client></div>
		<!-- entry-sector / entry-location optionnels, seulement si pertinents -->
	</div>
	<div class="entry-body">
		<div class="entry-title" id="exp-<N+1>-title"><Poste></div>
		<ul class="entry-bullets" id="exp-<N+1>-bullets">
			<li data-keywords="...">...</li>
		</ul>
	</div>
</div>
```

- Insère ce bloc en fin de la section "Expériences professionnelles" (juste avant `</section>`), **sans toucher aux entrées déjà présentes** (dates, entreprise, intitulé, bullets existants intacts).
- `data-keywords` par bullet : mots-clés courts en minuscules, cohérents avec le style déjà en place (voir entrées existantes).

### 2d. Intégrer dans la page 2 (`.mission-block` / `.mission-item`) — CV détaillé uniquement

Uniquement si Chef le demande pour le CV détaillé (page 2 "Missions & Réalisations Détaillées") :

- Compare la stack technique du brouillon au `mission-domain-sub` de chaque `.mission-block` existant.
- **Recouvrement majoritaire** avec un bloc existant → ajoute un nouveau `.mission-item` à l'intérieur de ce bloc (ne duplique pas le `.mission-header`), sur le modèle des `.mission-item` déjà présents (`mission-title` + `mission-columns` avec `mission-bullets`, ou une seule liste si le contenu est plus court).
- **Recouvrement à peu près égal entre deux blocs existants** (aucun des deux ne se dégage clairement) → ne tranche jamais arbitrairement, demande à Chef quel `.mission-block` cibler avant d'écrire.
- **Sinon** (aucun recouvrement majoritaire ni égalité ambiguë) → crée un nouveau `.mission-block` complet (`mission-header` avec `mission-domain` + `mission-domain-sub`, puis un `.mission-item`), à la suite des blocs existants, sans modifier les blocs déjà présents.

### 2e. Mettre à jour l'ETAT du brouillon

**Une intégration peut viser plusieurs cibles** (CV court, CV détaillé page 1, page 2 `.mission-block`/`.mission-item` — selon ce que Chef a demandé en 2b). Ne passe l'ETAT à `Validé` **que si toutes les cibles demandées ont été écrites avec succès**. Si une cible échoue en cours de route (structure introuvable, écriture échouée...) alors qu'une ou plusieurs autres ont déjà réussi : **laisse l'ETAT à `Brouillon`**, rapporte précisément à Chef quelles cibles ont réussi et laquelle a échoué, et demande-lui comment procéder (réessayer la cible en échec, se contenter des cibles réussies, ou annuler) — ne marque jamais `Validé` sur une intégration partielle ou incertaine.

Une fois — et seulement une fois — toutes les cibles demandées écrites avec succès, édite **uniquement la ligne `**ETAT :**` de cette entrée précise** dans `missions-generees/<slug>.md` (édition ciblée, jamais une réécriture du fichier) : `Validé — intégré le JJ/MM/AAAA` (date du jour). Ne touche à aucune autre entrée du fichier.

### 2f. Rapporter à Chef

Indique : template(s) modifié(s), id `exp-N` (et/ou nom du `.mission-block`/`.mission-item`) ajouté(s), contenu exact inséré, et l'état final de l'ETAT — `Validé` si toutes les cibles ont réussi, ou `Brouillon` (inchangé) avec le détail des cibles réussies/échouées si l'intégration est restée partielle (2e).

## Garde-fous

- **Jamais de client/employeur inventé ou modifié** — toujours celui fourni par Chef, jamais substitué même si le corpus de référence n'en parle pas.
- **Jamais d'écrasement** d'une entrée existante dans `missions-generees/<slug>.md` — uniquement des ajouts en fin de fichier.
- **Jamais de modification des dates/entreprise/intitulé** d'une expérience déjà présente dans un template — seul l'ajout de nouvelles entrées est permis.
- **Jamais d'intégration automatique** — l'étape 2 n'a lieu que sur demande explicite de Chef, jamais enchaînée après l'étape 1.
- **Jamais d'appel à `lk-scrapp-experiences`** depuis ce skill (NFR2) — en cas de corpus insuffisant, le signaler et proposer une relance manuelle, sans la déclencher.
- **Jamais d'écriture directe** dans `api/agent_detaille.md` / `api/agent_court.md`.
- **Jamais de modification du CSS** ni de la structure des templates au-delà de l'ajout d'entrées/`mission-item`s (pas de nouvelle classe, nouvel attribut, nouvelle section).

## Ce que ce skill ne fait pas

- Il ne scrape rien lui-même — il consomme le corpus déjà constitué par `lk-scrapp-experiences` (et `lk-hard-skill-missions` pour la table de couverture).
- Il n'intègre jamais un brouillon aux templates sans demande explicite postérieure à sa génération.
- Il ne touche jamais `api/` ni `extension/`.
