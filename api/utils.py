import os
import re
import unicodedata
import logging

# ── Logger ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CV Agent] %(levelname)s — %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("cv_agent")


# ── Slugify ───────────────────────────────────────────────────────────────────

def slugify(value: str, max_length: int = 40) -> str:
    """
    Convertit une chaîne en slug URL-safe.
    ex: "La Poste" → "la-poste"
    ex: "Développeur Python & Django" → "developpeur-python-django"
    """
    value = str(value)
    # Normalise les accents
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    # Minuscules
    value = value.lower()
    # Remplace tout ce qui n'est pas alphanumérique par un tiret
    value = re.sub(r"[^a-z0-9]+", "-", value)
    # Supprime les tirets en début/fin
    value = value.strip("-")
    # Tronque
    return value[:max_length]


CANDIDATE_SLUG = os.getenv("CANDIDATE_SLUG", "candidat")


PREFIX_BY_TYPE_AND_LANG = {
    ("court", "fr"): "cv",
    ("court", "en"): "resume",
    ("detaille", "fr"): "dc",
    ("detaille", "en"): "sp",
}


def build_output_filename(company: str, cv_type: str = "detaille", language: str = "fr") -> str:
    """
    Construit le nom du fichier HTML de sortie — préfixe différencie type ET langue :
    "cv_"/"resume_" pour le court (FR/EN), "dc_"/"sp_" (dossier de compétences /
    skill portfolio) pour le détaillé (FR/EN).
    ex: cv_la-poste_<CANDIDATE_SLUG>.html / resume_la-poste_<CANDIDATE_SLUG>.html
    """
    prefix = PREFIX_BY_TYPE_AND_LANG[(cv_type if cv_type == "court" else "detaille", language)]
    company_slug = slugify(company)
    return f"{prefix}_{company_slug}_{CANDIDATE_SLUG}.html"
