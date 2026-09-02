---
name: lk-hard-skill-missions
description: Construit/actualise une table de suivi (une ligne par hard skill du référentiel `template/hard_skills.html`) indiquant combien de missions du corpus `missions-realisees/missions-*.md` mettent en valeur chaque hard skill, et son statut (Couvert/Partiel/À traiter). Peut ensuite invoquer `lk-scrapp-experiences` de façon ciblée pour combler un hard skill précis (ou un petit lot choisi). Utilise quand l'utilisateur dit "lk-hard-skill-missions", "quels hard skills manquent de missions", "actualise la table des hard skills", "combler [hard skill] dans la table missions", ou demande où concentrer l'effort de scraping de missions.
---

# LK Hard Skill Missions

## Overview

Ce skill répond à une question simple pour Chef : **quels hard skills de mon référentiel n'ont pas (ou peu) de preuve concrète de mission dans mon corpus ?** Il ne scrape rien lui-même — il scanne d'abord ce qui existe déjà (`missions-realisees/missions-*.md`), construit/actualise une table de suivi, puis, si Chef le demande explicitement pour un hard skill précis (ou un petit lot qu'il choisit), invoque `lk-scrapp-experiences` (`competence: <hard skill>`) pour aller chercher de nouvelles missions.

**Fichiers concernés :**
- `template/hard_skills.html` — référentiel source (lecture seule, ne jamais modifier).
- `tools/linkedin-mcp/data/missions-realisees/missions-*.md` — corpus source (lecture seule pour ce skill ; c'est `lk-scrapp-experiences` qui y écrit).
- `tools/linkedin-mcp/data/hard-skills-missions.md` — la table que ce skill construit/actualise (gitignoré, comme tout `tools/linkedin-mcp/data/`).

**Ce que ce skill ne fait pas :**
- Il ne réimplémente pas de logique de scraping — toute nouvelle recherche LinkedIn passe par `lk-scrapp-experiences`, invoqué tel quel (ne pas modifier `.claude/skills/lk-scrapp-experiences/SKILL.md`).
- Il ne déclenche jamais `lk-scrapp-experiences` automatiquement sur l'ensemble des hard skills sous le seuil — un hard skill (ou un lot explicitement choisi par Chef) à la fois (NFR2, cohérence avec `lk-scrapp-experiences`).
- Il ne duplique jamais le texte d'une mission dans la table — uniquement des références courtes `missions-[branche].md#N`.
- Il ne touche ni `api/` ni `extension/`.

## Étape 1 — Charger et éclater le référentiel `template/hard_skills.html`

Lis le fichier en entier. Il est structuré en groupes `<div class="skill-group-title">Nom du groupe ... <div> ligne1 ligne2 ... </div></div>` — chaque ligne à l'intérieur est soit un hard skill unique, soit un regroupement de plusieurs hard skills.

**Règle de split (ne jamais séparer sur l'espace seul) :**

1. Sépare toujours chaque ligne sur la virgule `,` (ex. "Django, FastAPI, Flask" → 3 lignes).
2. Pour un `/` **entouré d'au moins un espace** (` / `, `/ `, ` /`) : sépare — c'est un "OU" délibéré entre éléments distincts (ex. "Jest / Vitest", "OpenAPI / Swagger", "ETL / ELT", "ELB / ALB", "KPI / Metrics", "Selenium / Playwright / Cypress", "Tests fonctionnels / E2E", "CVE / CVSS").
3. Pour un `/` **sans espace autour** : par défaut, ne sépare pas (c'est un terme composé unique, ex. "SQL Server" n'a pas de `/` mais illustre le principe — pour le `/` sans espace, l'exemple de référence est **"CI/CD"**, cité tel quel dans les notes de conception comme nom de hard skill entier à faire correspondre par regex, donc jamais éclaté). Exceptions confirmées à garder entières : `CI/CD`, `TCP/IP`, `HTTP/HTTPS`, `A/B Testing`, `DAST/SAST`, `IDS/IPS`, `LAN/WAN`.
   Seule exception connue qui **doit** être éclatée malgré l'absence d'espace : `Netmiko/NAPALM` (exemple explicite de l'intent de ce spec — deux outils distincts et reconnaissables individuellement, à la différence d'un sigle composé comme CI/CD).
   Si une nouvelle ligne `/`-sans-espace apparaît un jour dans `hard_skills.html` et n'est dans aucune des deux listes ci-dessus, **ne l'éclate pas par défaut** (comportement sûr par défaut) et signale-le à Chef pour trancher.
4. Ne sépare jamais sur l'espace seul : "SQL Server", "API REST", "Load Balancing", "Windows Server", "Security Groups", etc. restent entiers.

Le nom de groupe (`skill-group-title`) devient la colonne **Catégorie** de chaque hard skill qu'il contient.

**Résultat attendu avec le référentiel actuel (~227 lignes brutes) : 239 hard skills individuels** après éclatement (11 catégories). Si ce nombre change fortement lors d'un futur run, c'est probablement que `hard_skills.html` a été modifié — pas une erreur du skill.

## Étape 2 — Scanner le corpus `missions-realisees/missions-*.md`

Pour chaque fichier `missions-*.md` (lister d'abord le dossier, ne pas supposer une liste fixe de branches — trier les fichiers par ordre alphabétique et conserver cet ordre pour les références, voir Étape 4), repère chaque entrée numérotée `## N. ...` et, à l'intérieur, le champ **`**Stack technique :**`** exact (jusqu'au prochain champ en gras `**...**`, ou jusqu'au séparateur `---`, ou jusqu'à la fin du fichier).

Si le dossier `missions-realisees/` n'existe pas encore ou ne contient aucun fichier `missions-*.md` (tout début du corpus) : ce n'est pas une erreur — toutes les hard skills obtiennent simplement 0 mission et le statut "À traiter" à la construction initiale.

- **Seul le champ "Stack technique" compte** — c'est la règle du spec. Une entrée qui n'a pas ce champ exact (ex. un champ nommé différemment comme "Stack récurrente") n'est **pas** prise en compte dans le matching, même si son contenu est équivalent. Si tu rencontres ce cas, signale-le explicitement à Chef dans le rapport (il peut alors renommer le champ dans l'entrée source s'il veut qu'elle compte).
- Une entrée sans aucun champ Stack technique (résumé sous forme de tableau multi-missions, par exemple) est traitée comme "aucune contribution" pour toutes les hard skills, mais reste comptée comme une entrée du corpus dans ton rapport de scan.

## Étape 3 — Matching mot-entier insensible à la casse

Pour chaque hard skill individuel (nom exact tel qu'il apparaît après éclatement à l'étape 1), recherche sa présence dans le texte "Stack technique" de chaque entrée, avec une frontière de mot stricte pour éviter les faux positifs de sous-chaîne (ex. "Java" ne doit jamais matcher dans "JavaScript").

Un simple `\b...\b` regex ne suffit pas pour tous les noms : certains hard skills commencent ou finissent par un caractère qui n'est pas un caractère de mot (`C++`, `Domain-Driven Design (DDD)`), ce qui casse `\b`. Utilise plutôt un lookaround explicite sur "caractère alphanumérique adjacent" :

```python
import re

def word_boundary_pattern(skill_name: str) -> re.Pattern:
    esc = re.escape(skill_name)  # échappe /, ., +, (, ), etc.
    return re.compile(r"(?<![A-Za-zÀ-ÿ0-9])" + esc + r"(?![A-Za-zÀ-ÿ0-9])", re.IGNORECASE)
```

Une entrée matche un hard skill si `word_boundary_pattern(skill).search(stack_text)` est vrai. Une même entrée peut matcher plusieurs hard skills simultanément (c'est attendu — une entrée "Docker, Kubernetes, Java" contribue à 3 hard skills).

## Étape 4 — Construire (première fois) ou actualiser (fois suivantes) la table

### Cas A — `tools/linkedin-mcp/data/hard-skills-missions.md` n'existe pas encore (construction initiale)

C'est la seule situation où une écriture complète du fichier est légitime (il n'y a rien à préserver). Calcule les 239 lignes (étapes 1-3) et écris le fichier en une fois, avec ce format :

```markdown
# Suivi missions par hard skill

Table générée/actualisée par le skill `lk-hard-skill-missions`. Une ligne par hard skill individuel
(regroupements virgule/slash de `template/hard_skills.html` éclatés). Association calculée par
recherche mot-entier insensible à la casse sur le champ **Stack technique** de chaque entrée
`missions-realisees/missions-*.md` (les entrées sans ce champ exact ne sont pas prises en compte).

Statut : **Couvert** (≥ 3 missions) / **Partiel** (1-2) / **À traiter** (0). Pour combler un hard
skill "À traiter" ou "Partiel", demander explicitement d'invoquer
`lk-scrapp-experiences competence:<hard skill>` (jamais automatique).

| Hard skill | Catégorie | Missions | Statut | Références |
|---|---|---:|---|---|
| Python | Langages & Frameworks | 2 | Partiel | missions-dev.md#1, missions-dev.md#4 |
...
```

Ordonne les lignes par catégorie (ordre du référentiel `hard_skills.html`), puis par ordre d'apparition dans le groupe — c'est stable d'un run à l'autre et facilite la relecture par Chef.

**Ordre des références (colonne "Références")** : toujours trier par nom de fichier `missions-*.md` (ordre alphabétique, celui de `glob.glob` trié), puis par numéro d'entrée croissant au sein d'un même fichier. Cet ordre doit être identique que la ligne soit produite par le script de référence (construction initiale) ou par une édition ciblée (Cas B) — ne jamais simplement ajouter la nouvelle référence à la fin de la liste existante sans re-trier.

Un script de référence (déterministe, à écrire dans un fichier temporaire et exécuter via Bash plutôt que de recompter 239 lignes à la main) :

```python
#!/usr/bin/env python3
import re, glob, os

REPO_ROOT = "."  # adapter au cwd réel
HARD_SKILLS_HTML = os.path.join(REPO_ROOT, "template/hard_skills.html")
MISSIONS_DIR = os.path.join(REPO_ROOT, "tools/linkedin-mcp/data/missions-realisees")
OUTPUT = os.path.join(REPO_ROOT, "tools/linkedin-mcp/data/hard-skills-missions.md")

SLASH_NOSPACE_KEEP_WHOLE = {"CI/CD", "TCP/IP", "HTTP/HTTPS", "A/B Testing", "DAST/SAST", "IDS/IPS", "LAN/WAN"}
SLASH_SPLIT_NO_SPACE = {"Netmiko/NAPALM"}
# NOTE : split_line() ne gère pas le cas (actuellement absent du référentiel) d'un même segment
# virgule mélangeant un "/" espacé et un "/" non-espacé (ex. "CI/CD / DevOps") — si ce cas
# apparaît un jour, le découpage automatique n'est pas fiable ; traiter la ligne manuellement.

def split_line(raw):
    raw = raw.strip()
    if not raw:
        return []
    result = []
    for part in [p.strip() for p in raw.split(",") if p.strip()]:
        if part in SLASH_SPLIT_NO_SPACE:
            result.extend(s.strip() for s in part.split("/"))
        elif part in SLASH_NOSPACE_KEEP_WHOLE:
            result.append(part)
        elif re.search(r"\s/\s|\s/|/\s", part):
            result.extend(s.strip() for s in re.split(r"\s*/\s*", part) if s.strip())
        elif "/" in part:
            # Slash sans espace, pas dans les listes connues : ne pas éclater par défaut,
            # mais le signaler pour que Chef tranche (ne doit rien faire silencieusement).
            print(f"[lk-hard-skill-missions] Terme slash-sans-espace inconnu, gardé entier : {part!r} "
                  f"— ajoute-le à SLASH_SPLIT_NO_SPACE ou SLASH_NOSPACE_KEEP_WHOLE si besoin.")
            result.append(part)
        else:
            result.append(part)
    return result

def parse_hard_skills(path):
    with open(path, encoding="utf-8") as f:
        html = f.read()
    skills, seen = [], set()
    for b in re.split(r'<div class="skill-group-title">', html)[1:]:
        parts = b.split("\n", 1)
        title_line, rest = parts[0], (parts[1] if len(parts) > 1 else "")
        category = title_line.strip()
        for line in rest.split("\n"):
            line = line.strip()
            if not line or line.startswith("<div") or line.startswith("</div"):
                continue
            for name in split_line(line):
                key = (category, name)
                if key not in seen:
                    seen.add(key)
                    skills.append(key)
    return skills

ENTRY_RE = re.compile(r"^## (\d+)\.", re.MULTILINE)
STACK_FIELD_RE = re.compile(r"\*\*Stack technique\s*:\*\*\s*(.+?)(?=\n\*\*|\n---|\Z)", re.DOTALL)

def parse_missions(missions_dir):
    entries = []
    for path in sorted(glob.glob(os.path.join(missions_dir, "missions-*.md"))):
        branch_file = os.path.basename(path)
        content = open(path, encoding="utf-8").read()
        matches = list(ENTRY_RE.finditer(content))
        for i, m in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
            block = content[m.start():end]
            stack_m = STACK_FIELD_RE.search(block)
            stack_text = " ".join(stack_m.group(1).split()) if stack_m else None
            entries.append((branch_file, m.group(1), stack_text))
    return entries

def word_boundary_pattern(name):
    return re.compile(r"(?<![A-Za-zÀ-ÿ0-9])" + re.escape(name) + r"(?![A-Za-zÀ-ÿ0-9])", re.IGNORECASE)

skills = parse_hard_skills(HARD_SKILLS_HTML)
entries = parse_missions(MISSIONS_DIR)

rows = []
for category, name in skills:
    pattern = word_boundary_pattern(name)
    refs = [f"{b}#{n}" for b, n, s in entries if s and pattern.search(s)]
    count = len(refs)
    status = "Couvert" if count >= 3 else ("Partiel" if count >= 1 else "À traiter")
    rows.append((category, name, count, status, refs))

intro = (
    "Table générée/actualisée par le skill `lk-hard-skill-missions`. Une ligne par hard skill "
    "individuel (regroupements virgule/slash de `template/hard_skills.html` éclatés). Association "
    "calculée par recherche mot-entier insensible à la casse sur le champ **Stack technique** de "
    "chaque entrée `missions-realisees/missions-*.md` (les entrées sans ce champ exact ne sont pas "
    "prises en compte).\n\n"
    "Statut : **Couvert** (≥ 3 missions) / **Partiel** (1-2) / **À traiter** (0). Pour combler un "
    "hard skill \"À traiter\" ou \"Partiel\", demander explicitement d'invoquer "
    "`lk-scrapp-experiences competence:<hard skill>` (jamais automatique)."
)
lines = ["# Suivi missions par hard skill", "", intro, "",
         "| Hard skill | Catégorie | Missions | Statut | Références |", "|---|---|---:|---|---|"]
for category, name, count, status, refs in rows:
    lines.append(f"| {name} | {category} | {count} | {status} | {', '.join(refs) if refs else '—'} |")

open(OUTPUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(f"{len(rows)} hard skills — {sum(1 for r in rows if r[3]=='Couvert')} Couvert, "
      f"{sum(1 for r in rows if r[3]=='Partiel')} Partiel, {sum(1 for r in rows if r[3]=='À traiter')} À traiter")
```

### Cas B — la table existe déjà (rafraîchissement / mise à jour ciblée)

**Ne jamais réécrire le fichier en entier dans ce cas** — même pour un rafraîchissement global demandé par Chef. Procède hard skill par hard skill (même principe de résilience incrémentale que `lk-scrapp-experiences` qui traite profil par profil) :

0. Si le fichier existe mais est vide, tronqué, ou ne contient pas de tableau Markdown reconnaissable (pas de ligne `| Hard skill | Catégorie | ...`) : informe Chef que le fichier semble corrompu/vide, puis traite-le comme le Cas A (reconstruction complète) plutôt que d'échouer ou d'improviser une structure.
1. Lis d'abord la table existante en entier.
2. Pour chaque hard skill dont le compte doit être recalculé (soit tous, pour un rafraîchissement complet demandé explicitement ; soit seulement celui/ceux que Chef vient de faire combler via `lk-scrapp-experiences`) : ré-applique le matching de l'étape 3 sur l'ensemble du corpus actuel pour ce hard skill précis, recalcule `Missions`/`Statut`/`Références`.
3. Si la ligne recalculée diffère de la ligne actuelle, remplace **uniquement cette ligne** (édition ciblée, ex. via l'outil Edit sur la chaîne exacte de l'ancienne ligne) — jamais une réécriture globale du fichier. Si rien ne change pour ce hard skill, ne touche pas la ligne.
4. Si un rafraîchissement global est demandé (ex. après avoir ajouté plusieurs missions en une session), traite les hard skills un par un dans cet esprit plutôt qu'en une seule passe qui réécrit tout — une interruption en cours de route ne doit faire perdre que la ligne en cours d'édition, jamais les précédentes déjà mises à jour.

## Étape 5 — Combler un écart sur demande explicite de Chef

Ce skill ne scanne/affiche jamais tout seul une invitation à scraper — **c'est toujours Chef qui déclenche**, pour un hard skill précis ou un petit lot qu'il choisit lui-même (jamais l'ensemble des hard skills sous le seuil automatiquement — NFR2).

Quand Chef demande de combler un hard skill (ex. "comble Jenkins", "trouve des missions pour SonarQube et Trivy") :

1. **Valide d'abord le(s) nom(s) demandé(s)** contre la table (ou, si elle n'existe pas encore, contre le référentiel éclaté de l'étape 1). Si un nom ne correspond à aucun hard skill connu (typo probable), ne lance pas de recherche LinkedIn pour ce nom — signale-le à Chef et propose le(s) nom(s) le(s) plus proche(s) trouvé(s) dans la table, ou demande une correction.
2. **Garde-fou sur la taille du lot** : si le lot validé dépasse 5 hard skills en une seule demande, ne lance pas tout automatiquement — indique à Chef le volume de recherches LinkedIn que cela représenterait (un run `lk-scrapp-experiences` complet par hard skill) et demande confirmation explicite avant de continuer, ou suggère de procéder par lots plus petits. Ceci s'applique même si Chef a explicitement demandé "tous les hard skills à traiter" ou une liste large — une demande explicite mais non bornée reproduirait le scraping massif que NFR2 vise à éviter.
3. Pour chaque hard skill validé du lot, invoque `lk-scrapp-experiences` avec `competence: <hard skill>` (les autres filtres de `lk-scrapp-experiences` — `poste`, `secteur`, `max_profils`, etc. — restent à la discrétion de Chef s'il les précise ; sinon laisse `lk-scrapp-experiences` appliquer ses propres défauts).
4. `lk-scrapp-experiences` écrit lui-même dans `missions-realisees/missions-[branche].md` (potentiellement un nouveau fichier de branche). Ne réimplémente jamais cette logique ici. **Si l'invocation échoue ou s'interrompt** (erreur, session LinkedIn inutilisable même avec le fallback chrome-devtools) : signale l'échec explicitement à Chef pour ce hard skill — ne le confonds pas avec le cas "0 nouvelle mission trouvée" (point 6), ce sont deux situations différentes.
5. Une fois `lk-scrapp-experiences` terminé (que des missions aient été trouvées ou non), relis les fichiers `missions-*.md` concernés et ré-applique le matching (étape 3) **uniquement pour le(s) hard skill(s) du lot demandé**, puis mets à jour leur(s) ligne(s) via une édition ciblée (Cas B de l'étape 4).
6. **Si 0 nouvelle mission n'a été trouvée ou rattachée** : le statut reste inchangé (Partiel/À traiter selon le compte précédent) — signale-le explicitement à Chef dans le rapport plutôt que de laisser croire que le run a échoué silencieusement ou que la table a été mise à jour sans effet réel.

## Étape 6 — Rapporter

À la fin de chaque exécution (construction initiale, rafraîchissement, ou comblement ciblé), indique à Chef :
- Nombre total de hard skills dans la table, et répartition Couvert / Partiel / À traiter.
- Pour un comblement ciblé : hard skill(s) demandé(s), nombre de nouvelles missions trouvées et rattachées, nouveau statut, et signalement explicite si le statut n'a pas bougé faute de résultat, si un nom demandé était invalide, ou si `lk-scrapp-experiences` a échoué pour un hard skill du lot.
- Entrées `missions-*.md` rencontrées sans champ "Stack technique" exact (non prises en compte dans le matching), s'il y en a — pour que Chef puisse les corriger s'il le souhaite.

## Design Notes

- Le nom de hard skill affiché dans la table est **exactement** celui du référentiel après éclatement (pas de reformulation, pas de normalisation de casse) — c'est ce nom qui sert de `competence:` pour `lk-scrapp-experiences`.
- La table ne duplique jamais le texte d'une mission — uniquement `missions-[branche].md#N`. Le détail reste dans `missions-realisees/`.
- Le seuil de statut est fixe : Couvert ≥ 3, Partiel 1-2, À traiter 0 (jamais un simple booléen).
