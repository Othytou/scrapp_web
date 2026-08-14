import json
from unittest.mock import MagicMock, patch

import pytest

import agent


def test_build_cv_context_block_includes_skills_and_bullets():
    cv_context = {
        "skills_pool": {"displayed": ["python"], "hidden": ["fastapi"]},
        "bullets_map": {"exp-0-bullets:0": "python,docker"},
    }

    block = agent.build_cv_context_block(cv_context)

    assert "python" in block
    assert "fastapi" in block
    assert "exp-0-bullets:0" in block


def test_build_user_message_caches_cv_context_but_not_offer():
    payload = {
        "company": "Acme",
        "position": "Dev Backend",
        "url": "https://example.com/offre",
        "job_offer": "Recherche développeur Python/Django",
    }
    cv_context = {"skills_pool": {"displayed": [], "hidden": []}, "bullets_map": {}}

    blocks = agent.build_user_message(payload, cv_context)

    assert len(blocks) == 2
    assert blocks[0]["cache_control"] == {"type": "ephemeral"}
    assert "Contexte CV" in blocks[0]["text"]
    assert "cache_control" not in blocks[1]
    assert "Acme" in blocks[1]["text"]
    assert "Recherche développeur Python/Django" in blocks[1]["text"]


def _mock_response(patch_dict: dict):
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = json.dumps(patch_dict)
    response = MagicMock()
    response.content = [text_block]
    return response


EXAMPLE_PATCH = {
    "header_title": "Backend · Python",
    "summary": "Résumé. Disponible immédiatement.",
    "highlight_skills": ["python"],
    "inject_skills": [],
    "highlight_bullets": [],
    "rewrite_bullets": [],
    "soft_skills": ["Autonome", "Force de proposition"],
    "unmatched_skills": [],
}


def test_run_agent_sends_expected_request_shape_and_returns_patch():
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _mock_response(EXAMPLE_PATCH)

    with patch.object(agent, "_get_client", return_value=mock_client):
        payload = {
            "company": "Acme",
            "position": "Dev Backend",
            "url": "https://example.com",
            "job_offer": "Python, Docker, FastAPI",
        }
        cv_context = {"skills_pool": {"displayed": [], "hidden": []}, "bullets_map": {}}

        result = agent.run_agent(payload, cv_context)

    assert result == EXAMPLE_PATCH

    _, kwargs = mock_client.messages.create.call_args
    assert kwargs["model"] == agent.ANTHROPIC_MODEL
    assert kwargs["output_config"]["format"]["type"] == "json_schema"
    assert kwargs["output_config"]["format"]["schema"] == agent.PATCH_JSON_SCHEMA
    assert kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert kwargs["messages"][0]["role"] == "user"


def test_run_agent_raises_when_no_text_block_returned():
    mock_client = MagicMock()
    response = MagicMock()
    response.content = []
    mock_client.messages.create.return_value = response

    with patch.object(agent, "_get_client", return_value=mock_client):
        with pytest.raises(ValueError):
            agent.run_agent(
                {"company": "Acme", "position": "Dev", "url": "", "job_offer": "..."},
                {"skills_pool": {}, "bullets_map": {}},
            )


def test_run_agent_raises_on_invalid_json():
    mock_client = MagicMock()
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "not valid json"
    response = MagicMock()
    response.content = [text_block]
    mock_client.messages.create.return_value = response

    with patch.object(agent, "_get_client", return_value=mock_client):
        with pytest.raises(ValueError):
            agent.run_agent(
                {"company": "Acme", "position": "Dev", "url": "", "job_offer": "..."},
                {"skills_pool": {}, "bullets_map": {}},
            )
