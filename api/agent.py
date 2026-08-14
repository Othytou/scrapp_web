# OBSOLÈTE — n'est plus appelé par le flux actuel (main.py ne fait plus
# que capturer l'offre en base). La génération du CV se fait maintenant via
# le skill Claude Code `.claude/skills/generate-cv/`, qui tourne sur
# l'abonnement Claude Pro plutôt que sur l'API Anthropic facturée au token.
# Gardé tel quel (testé, fonctionnel) en filet de secours — voir api/AGENTS.md.

import json
import os
from anthropic import Anthropic

from utils import logger

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic()
    return _client


def load_agent_instructions() -> str:
    instructions_path = os.path.join(os.path.dirname(__file__), "agent.md")
    with open(instructions_path, "r", encoding="utf-8") as f:
        return f.read()


def build_cv_context_block(cv_context: dict) -> str:
    skills_pool = cv_context.get("skills_pool", {})
    bullets_map = cv_context.get("bullets_map", {})

    return f"""## Contexte CV
Compétences displayed : {json.dumps(skills_pool.get('displayed', []), ensure_ascii=False)}
Compétences hidden : {json.dumps(skills_pool.get('hidden', []), ensure_ascii=False)}
Bullets : {json.dumps(bullets_map, ensure_ascii=False)}

Note : compare les compétences de l'offre en ignorant la casse et les variantes
(ex: PostgreSQL = postgresql, Node.js = nodejs, CI/CD = cicd)."""


def build_offer_block(payload: dict) -> str:
    return f"""## Offre
Entreprise : {payload.get('company', 'Non précisé')}
Poste : {payload.get('position', 'Non précisé')}
URL : {payload.get('url', '')}

{payload['job_offer']}"""


def build_user_message(payload: dict, cv_context: dict) -> list[dict]:
    """
    Le contexte CV est identique à chaque appel (même template) — mis en cache.
    Seule l'offre varie d'un appel à l'autre — hors cache.
    """
    return [
        {
            "type": "text",
            "text": build_cv_context_block(cv_context),
            "cache_control": {"type": "ephemeral"},
        },
        {
            "type": "text",
            "text": build_offer_block(payload),
        },
    ]


PATCH_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "header_title": {"type": "string"},
        "summary": {"type": "string"},
        "highlight_skills": {"type": "array", "items": {"type": "string"}},
        "inject_skills": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "container_id": {"type": "string"},
                    "skills": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["container_id", "skills"],
                "additionalProperties": False,
            },
        },
        "highlight_bullets": {"type": "array", "items": {"type": "string"}},
        "rewrite_bullets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ul_id": {"type": "string"},
                    "index": {"type": "integer"},
                    "new_text": {"type": "string"},
                    "new_keywords": {"type": "string"},
                },
                "required": ["ul_id", "index", "new_text", "new_keywords"],
                "additionalProperties": False,
            },
        },
        "soft_skills": {"type": "array", "items": {"type": "string"}},
        "unmatched_skills": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "header_title",
        "summary",
        "highlight_skills",
        "inject_skills",
        "highlight_bullets",
        "rewrite_bullets",
        "soft_skills",
        "unmatched_skills",
    ],
    "additionalProperties": False,
}


def run_agent(payload: dict, cv_context: dict) -> dict:
    logger.info(f"Agent démarré — {payload.get('company')} / {payload.get('position')}")

    system_prompt = load_agent_instructions()
    user_content = build_user_message(payload, cv_context)

    response = _get_client().messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={"format": {"type": "json_schema", "schema": PATCH_JSON_SCHEMA}},
        messages=[{"role": "user", "content": user_content}],
    )

    text_block = next((b for b in response.content if b.type == "text"), None)
    if text_block is None:
        raise ValueError("L'agent n'a retourné aucun bloc texte exploitable")

    try:
        patch = json.loads(text_block.text)
    except json.JSONDecodeError as e:
        logger.error(f"Erreur parsing JSON agent : {e}")
        logger.error(f"Réponse brute : {text_block.text}")
        raise ValueError(f"L'agent n'a pas retourné un JSON valide : {e}")

    logger.info(f"Patch reçu — skills matchés : {patch.get('highlight_skills', [])}")
    return patch
