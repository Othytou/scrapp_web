"""
Script CLI utilisé par le skill Claude Code `generate-cv`.
Applique un patch JSON (produit par le skill) au template CV, écrit le
HTML + PDF, et met à jour la candidature en base (statut "generated").

Usage : python finalize_cv.py <application_id>   (le patch JSON arrive sur stdin)
"""
import asyncio
import json
import os
import sys

from sqlalchemy import select

from database import AsyncSessionLocal
from models import Application
from html_patcher import load_template, extract_cv_context, apply_patch, write_output
from utils import build_output_filename, logger

TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", "./template/my_template_cv_detaille.html")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./output")
PDF_DIR = os.getenv("PDF_DIR", "./pdf")
# "detaille" (defaut) ou "court" — decide quelles colonnes Application sont mises a jour.
CV_TYPE = os.getenv("CV_TYPE", "detaille")
# "fr" (defaut) ou "en" — decide uniquement le prefixe du fichier de sortie (cv_/dc_ vs resume_/sp_).
CV_LANG = os.getenv("CV_LANG", "fr")


# Dérivé de TEMPLATE_PATH (pas de __file__) : seul moyen fiable de retrouver template/ en local et en Docker.
def _pagination_script_path() -> str:
    return os.path.join(os.path.dirname(TEMPLATE_PATH), "pagination.js")


async def generate_pdf(html_path: str, pdf_dir: str, filename: str, cv_type: str) -> str:
    """
    Génère le PDF à partir du HTML déjà patché.

    CV_TYPE == "court" : Playwright/Chromium + pagination.js (WeasyPrint perd du
    contenu sur ce layout Grid multi-page, voir spec-fix-cv-court-pdf-pagination.md).
    Toute autre valeur : WeasyPrint inchangé.
    """
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_filename = filename.replace(".html", ".pdf")
    pdf_path = os.path.join(pdf_dir, pdf_filename)

    if cv_type == "court":
        await _generate_pdf_via_playwright(html_path, pdf_path)
    else:
        from weasyprint import HTML

        HTML(filename=html_path).write_pdf(pdf_path)

    return pdf_path


async def _generate_pdf_via_playwright(html_path: str, pdf_path: str) -> None:
    from playwright.async_api import async_playwright

    with open(_pagination_script_path(), "r", encoding="utf-8") as f:
        pagination_script = f.read()

    async with async_playwright() as p:
        # --no-sandbox : requis, le container tourne en root et le sandbox Chromium
        # par defaut echoue dans ce contexte.
        browser = await p.chromium.launch(args=["--no-sandbox"])
        try:
            page = await browser.new_page()
            await page.goto(f"file://{os.path.abspath(html_path)}")
            # Le contrat `.page{height:297mm;overflow:hidden}` que pagination.js
            # mesure n'existe qu'en media print.
            await page.emulate_media(media="print")
            # Polices Google Fonts chargées de façon asynchrone : attendre leur
            # chargement avant de mesurer, sinon les hauteurs mesurées sont fausses.
            await page.evaluate("document.fonts.ready")
            await page.add_script_tag(content=pagination_script)
            await page.evaluate("window.paginateCV()")
            await page.pdf(path=pdf_path, print_background=True, prefer_css_page_size=True)
        finally:
            await browser.close()


async def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: finalize_cv.py <application_id>"}))
        sys.exit(1)

    application_id = int(sys.argv[1])
    patch = json.loads(sys.stdin.read())

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Application).where(Application.id == application_id))
        application = result.scalar_one_or_none()
        if application is None:
            print(json.dumps({"error": f"Application {application_id} introuvable"}))
            sys.exit(1)

        soup = load_template(TEMPLATE_PATH)
        cv_context = extract_cv_context(soup)
        patched_soup = apply_patch(soup, patch, cv_context)

        # Préfixe ("cv_"/"dc_"/"resume_"/"sp_") différencie type ET langue sans sous-dossier séparé —
        # garde output/ et pdf/ à plat pour que le <link> relatif vers ../template/*.css reste valide.
        filename = build_output_filename(application.company, CV_TYPE, CV_LANG)
        output_path = os.path.join(OUTPUT_DIR, filename)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        write_output(patched_soup, output_path)

        try:
            pdf_path = await generate_pdf(output_path, PDF_DIR, filename, CV_TYPE)
        except Exception as exc:
            logger.error(f"Echec de generation du PDF ({output_path}) : {exc}")
            print(json.dumps({"error": f"Echec de generation du PDF : {exc}"}))
            sys.exit(1)

        application.status = "generated"
        if CV_TYPE == "court":
            application.cv_html_path_court = output_path
            application.pdf_path_court = pdf_path
        else:
            application.cv_html_path = output_path
            application.pdf_path = pdf_path
        application.highlight_skills = patch.get("highlight_skills", [])
        application.inject_skills = patch.get("inject_skills", [])
        application.unmatched_skills = patch.get("unmatched_skills", [])
        await session.commit()

        logger.info(f"Application #{application.id} finalisée — {filename}")

        print(json.dumps({
            "status": "ok",
            "application_id": application.id,
            "cv_html": output_path,
            "cv_pdf": pdf_path,
        }, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
