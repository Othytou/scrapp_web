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

TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", "./template/template_cv_detaille.html")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./output")
PDF_DIR = os.getenv("PDF_DIR", "./pdf")


def generate_pdf(html_path: str, pdf_dir: str, filename: str) -> str:
    from weasyprint import HTML

    os.makedirs(pdf_dir, exist_ok=True)
    pdf_filename = filename.replace(".html", ".pdf")
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    HTML(filename=html_path).write_pdf(pdf_path)
    return pdf_path


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

        filename = build_output_filename(application.company, application.position)
        output_path = os.path.join(OUTPUT_DIR, filename)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        write_output(patched_soup, output_path)

        pdf_path = generate_pdf(output_path, PDF_DIR, filename)

        application.status = "generated"
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
