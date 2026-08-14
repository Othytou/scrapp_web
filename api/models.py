from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(255))
    position: Mapped[str] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_offer: Mapped[str] = mapped_column(Text)

    cv_html_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Résultat de l'analyse agent
    highlight_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    inject_skills: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    unmatched_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Statut candidature
    status: Mapped[str] = mapped_column(
        String(50),
        default="captured"
        # captured → generated → sent → no_response / positive / negative / interview
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    events: Mapped[list["ApplicationEvent"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    status: Mapped[str] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application: Mapped["Application"] = relationship(back_populates="events")
