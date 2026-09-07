"""
Script one-off : comme pending_offers.py mais cible une application précise
par id, quel que soit son statut (utile pour retraiter une offre déjà
"generated").

Usage : python offer_by_id.py <application_id>
"""
import asyncio
import json
import os
import sys

from sqlalchemy import select

from database import AsyncSessionLocal
from models import Application
from html_patcher import load_template, extract_cv_context

TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", "./template/my_template_cv_detaille.html")


async def main():
    application_id = int(sys.argv[1])

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Application).where(Application.id == application_id)
        )
        application = result.scalar_one_or_none()

    if application is None:
        print(json.dumps({"error": f"Application {application_id} introuvable"}))
        sys.exit(1)

    offer = {
        "id": application.id,
        "company": application.company,
        "position": application.position,
        "url": application.url,
        "job_offer": application.job_offer,
    }

    soup = load_template(TEMPLATE_PATH)
    cv_context = extract_cv_context(soup)

    print(json.dumps({"offers": [offer], "cv_context": cv_context}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
