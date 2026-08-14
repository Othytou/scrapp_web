"""
Script CLI utilisé par le skill Claude Code `generate-cv`.
Liste les offres capturées mais pas encore traitées (statut "captured"),
plus le contexte CV courant (pool de compétences + bullets), en un seul appel.

Usage : python pending_offers.py
"""
import asyncio
import json
import os

from sqlalchemy import select

from database import AsyncSessionLocal
from models import Application
from html_patcher import load_template, extract_cv_context

TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", "./template/template_cv_detaille.html")


async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Application)
            .where(Application.status == "captured")
            .order_by(Application.created_at.asc())
        )
        applications = result.scalars().all()

    offers = [
        {
            "id": application.id,
            "company": application.company,
            "position": application.position,
            "url": application.url,
            "job_offer": application.job_offer,
        }
        for application in applications
    ]

    soup = load_template(TEMPLATE_PATH)
    cv_context = extract_cv_context(soup)

    print(json.dumps({"offers": offers, "cv_context": cv_context}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
