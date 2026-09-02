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


def build_output_filename(company: str) -> str:
    """
    Construit le nom du fichier HTML de sortie.
    ex: cv_la-poste_<CANDIDATE_SLUG>.html
    """
    company_slug = slugify(company)
    return f"cv_{company_slug}_{CANDIDATE_SLUG}.html"
