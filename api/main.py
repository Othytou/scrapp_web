from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import init_db, get_db
from models import Application, ApplicationEvent
from utils import logger


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("DB initialisée")
    yield

app = FastAPI(title="CV Agent API", lifespan=lifespan)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://",
        "chrome-extension://ebnkclahmmgkdiebmhfnmmponnjmldpf",
        # "brave-browsers://ebnkclahmmgkdiebmhfnmmponnjmldpf",
        # os.getenv("NGROK_URL", ""),
    ],
    # allow_origins=["*"],
    # allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    job_offer: str
    company: str
    position: str
    url: str | None = None


class StatusUpdate(BaseModel):
    status: str
    note: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/webhook")
async def handle_webhook(payload: WebhookPayload, db: AsyncSession = Depends(get_db)):
    """
    Point d'entrée principal.
    Reçoit l'offre depuis l'extension Chrome et l'enregistre (statut "captured").
    La génération du CV est faite séparément par le skill Claude Code
    (voir .claude/skills/generate-cv) — pas d'appel LLM ici.
    """
    logger.info(f"Offre capturée — {payload.company} / {payload.position}")

    application = Application(
        company=payload.company,
        position=payload.position,
        url=payload.url,
        job_offer=payload.job_offer,
        status="captured",
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    logger.info(f"Application #{application.id} enregistrée — en attente de génération")

    return {
        "status": "ok",
        "application_id": application.id,
    }


@app.get("/applications")
async def list_applications(db: AsyncSession = Depends(get_db)):
    """Liste toutes les candidatures."""
    result = await db.execute(select(Application).order_by(Application.created_at.desc()))
    applications = result.scalars().all()
    return applications


@app.get("/applications/{application_id}")
async def get_application(application_id: int, db: AsyncSession = Depends(get_db)):
    """Détail d'une candidature."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    return application


@app.patch("/applications/{application_id}/status")
async def update_status(
    application_id: int,
    body: StatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Met à jour le statut d'une candidature et log l'event."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    application.status = body.status
    event = ApplicationEvent(
        application_id=application.id,
        status=body.status,
        note=body.note
    )
    db.add(event)
    await db.commit()

    logger.info(f"Application #{application_id} → statut : {body.status}")
    return {"status": "ok", "new_status": body.status}


@app.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Stats globales des candidatures."""
    from sqlalchemy import func
    result = await db.execute(
        select(Application.status, func.count(Application.id))
        .group_by(Application.status)
    )
    rows = result.all()
    stats = {row[0]: row[1] for row in rows}
    total = sum(stats.values())
    return {
        "total": total,
        "by_status": stats,
        "response_rate": round(
            (stats.get("positive", 0) + stats.get("negative", 0) + stats.get("interview", 0))
            / total * 100, 1
        ) if total > 0 else 0
    }

