import re
import json
from bs4 import BeautifulSoup
from utils import logger


def normalize_skill(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def load_template(template_path: str) -> BeautifulSoup:
    with open(template_path, "r", encoding="utf-8") as f:
        return BeautifulSoup(f.read(), "html.parser")


def extract_cv_context(soup: BeautifulSoup) -> dict:
    """
    Extrait depuis le HTML les données nécessaires au prompt de l'agent :
    - CV_SKILLS_POOL (displayed + hidden + labels)
    - Bullets map {id:index → keywords}
    """
    context = {"skills_pool": {}, "bullets_map": {}}

    script_tag = soup.find("script")
    if script_tag and script_tag.string and "CV_SKILLS_POOL" in script_tag.string:
        match = re.search(r"window\.CV_SKILLS_POOL\s*=\s*(\{.*\})\s*;", script_tag.string, re.DOTALL)
        if not match:
            logger.warning(f"CV_SKILLS_POOL non trouvé — extrait : {script_tag.string[:200]}")
        else:
            raw = match.group(1)
            # Les clés de premier niveau (displayed/hidden/labels) ne sont pas
            # quotées en JS — on les quote pour obtenir du JSON valide.
            raw = re.sub(r'(?<=[{,\s])(displayed|hidden|labels)\s*:', r'"\1":', raw)
            try:
                context["skills_pool"] = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.warning(f"CV_SKILLS_POOL trouvé mais non parsable : {e}")

    for ul in soup.find_all("ul", class_="entry-bullets"):
        ul_id = ul.get("id", "")
        for i, li in enumerate(ul.find_all("li")):
            keywords = li.get("data-keywords", "")
            if ul_id and keywords:
                context["bullets_map"][f"{ul_id}:{i}"] = keywords

    return context


def apply_patch(soup: BeautifulSoup, patch: dict, cv_context: dict) -> BeautifulSoup:
    """
    Applique le JSON diff retourné par l'agent sur le HTML.

    patch = {
        "header_title": "...",
        "summary": "...",
        "highlight_skills": ["python", "django"],
        "inject_skills": {"tags-langages": ["fastapi"]},
        "rewrite_bullets": [{"ul_id": "...", "index": 0, "new_text": "...", "new_keywords": "..."}],
        "highlight_bullets": ["exp-olcr-bullets:0"],
        "soft_skills": ["Autonome", "Force de proposition", "Leadership"],
        "unmatched_skills": ["angular"]
    }
    """

    # 1. Header title
    if patch.get("header_title"):
        el = soup.find(id="cv-header-title")
        if el:
            el.string = patch["header_title"]
            logger.info(f"Header title → {patch['header_title']}")

    # 2. Summary
    if patch.get("summary"):
        el = soup.find(id="cv-summary")
        if el:
            el.string = patch["summary"]
            logger.info("Summary mis à jour")

    # 3. Réécriture des bullets
    rewrite_bullets = patch.get("rewrite_bullets", [])
    for rewrite in rewrite_bullets:
        ul_id = rewrite.get("ul_id")
        index = rewrite.get("index")
        new_text = rewrite.get("new_text")
        new_keywords = rewrite.get("new_keywords")

        if not all([ul_id, index is not None, new_text]):
            continue

        ul = soup.find(id=ul_id)
        if not ul:
            logger.warning(f"ul '{ul_id}' introuvable pour réécriture")
            continue

        items = ul.find_all("li")
        if index < len(items):
            li = items[index]
            li.string = new_text
            if new_keywords:
                li["data-keywords"] = new_keywords
            logger.info(f"Bullet réécrit — {ul_id}:{index}")

    # 4. Highlight skills
    highlighted_raw = patch.get("highlight_skills", [])
    highlighted_normalized = [normalize_skill(s) for s in highlighted_raw]

    for tag in soup.find_all("span", class_="tag"):
        skill = normalize_skill(tag.get("data-skill", ""))
        if skill in highlighted_normalized:
            classes = tag.get("class", [])
            if "highlighted" not in classes:
                tag["class"] = classes + ["highlighted"]

    logger.info(f"Compétences highlightées : {highlighted_normalized}")

    # 5. Inject skills
    inject_entries = patch.get("inject_skills", [])
    labels = cv_context.get("skills_pool", {}).get("labels", {})
    injected = []

    for entry in inject_entries:
        container_id = entry.get("container_id")
        skills = entry.get("skills", [])
        container = soup.find(id=container_id)
        if not container:
            logger.warning(f"Conteneur '{container_id}' introuvable pour injection")
            continue
        for skill_key in skills:
            existing = container.find(
                "span",
                attrs={"data-skill": lambda v: v and normalize_skill(v) == normalize_skill(skill_key)}
            )
            if existing:
                continue
            label = labels.get(skill_key, skill_key.replace("-", " ").title())
            new_tag = soup.new_tag("span", attrs={"class": "tag injected", "data-skill": skill_key})
            new_tag.string = label
            container.append(new_tag)
            injected.append(skill_key)

    logger.info(f"Compétences injectées : {injected}")

    # 6. Highlight bullets
    highlight_bullets = patch.get("highlight_bullets", [])
    highlighted_count = 0

    for ref in highlight_bullets:
        parts = ref.rsplit(":", 1)
        if len(parts) != 2:
            continue
        ul_id, index = parts[0], int(parts[1])
        ul = soup.find(id=ul_id)
        if not ul:
            continue
        items = ul.find_all("li")
        if index < len(items):
            li = items[index]
            classes = li.get("class", [])
            if "highlighted" not in classes:
                li["class"] = classes + ["highlighted"]
            highlighted_count += 1

    total_bullets = len(soup.find_all("li", attrs={"data-keywords": True}))
    logger.info(f"Bullets highlightées : {highlighted_count}/{total_bullets}")

    # 7. Soft skills
    soft_skills = patch.get("soft_skills", [])
    if soft_skills:
        ul = soup.find(id="cv-softskills")
        if not ul:
            logger.warning("cv-softskills introuvable")
        else:
            items = ul.find_all("li")
            last_item = items[-1] if items else None

            ul.clear()

            # Déduplique en conservant l'ordre
            seen = []
            for skill in soft_skills[:4]:
                if skill not in seen:
                    seen.append(skill)
                    li = soup.new_tag("li")
                    li.string = skill
                    ul.append(li)

            if last_item:
                ul.append(last_item)

            logger.info(f"Soft skills mis à jour : {soft_skills[:4]}")

    # 8. Log unmatched skills
    unmatched = patch.get("unmatched_skills", [])
    if unmatched:
        logger.warning(f"⚠ Compétences demandées non couvertes : {', '.join(unmatched)}")
        logger.warning("→ À toi de décider si tu les ajoutes au pool hidden dans le template")

    return soup


def write_output(soup: BeautifulSoup, output_path: str):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(str(soup))
    logger.info(f"Fichier généré : {output_path}")