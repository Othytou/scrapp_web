from bs4 import BeautifulSoup

from html_patcher import apply_patch, extract_cv_context


def _soup_with_container():
    return BeautifulSoup('<div id="tags-container-id"></div>', "html.parser")


def test_apply_patch_injects_skills_from_inject_skills_entries():
    soup = _soup_with_container()
    patch = {
        "inject_skills": [
            {"container_id": "tags-container-id", "skills": ["redux"]}
        ]
    }
    cv_context = {"skills_pool": {"labels": {"redux": "Redux"}}}

    result = apply_patch(soup, patch, cv_context)

    injected = result.find("span", attrs={"data-skill": "redux"})
    assert injected is not None
    assert injected.text == "Redux"
    assert "injected" in injected.get("class", [])


def test_apply_patch_ignores_unknown_container_id():
    soup = _soup_with_container()
    patch = {
        "inject_skills": [
            {"container_id": "does-not-exist", "skills": ["redux"]}
        ]
    }
    cv_context = {"skills_pool": {"labels": {}}}

    result = apply_patch(soup, patch, cv_context)

    assert result.find("span", attrs={"data-skill": "redux"}) is None


def test_apply_patch_handles_empty_inject_skills():
    soup = _soup_with_container()
    result = apply_patch(soup, {"inject_skills": []}, {"skills_pool": {}})

    assert result.find("span") is None


def test_extract_cv_context_parses_skills_pool():
    html = """
    <script>
    window.CV_SKILLS_POOL = {
        displayed: ["python", "django"],
        hidden: ["fastapi"],
        labels: {"fastapi": "FastAPI"}
    };
    </script>
    """
    soup = BeautifulSoup(html, "html.parser")

    context = extract_cv_context(soup)

    assert context["skills_pool"]["displayed"] == ["python", "django"]
    assert context["skills_pool"]["hidden"] == ["fastapi"]
    assert context["skills_pool"]["labels"] == {"fastapi": "FastAPI"}


def test_extract_cv_context_handles_missing_script_gracefully():
    soup = BeautifulSoup("<div>no script here</div>", "html.parser")

    context = extract_cv_context(soup)

    assert context["skills_pool"] == {}
    assert context["bullets_map"] == {}
