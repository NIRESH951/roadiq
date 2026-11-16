"""Database tables. Every record carries `source`: 'demo' (seeded illustration) or 'live' (real data)."""

from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Road(Base):
    __tablename__ = "roads"
    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    road_class: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(10), default="demo")


class RoadSegment(Base):
    __tablename__ = "road_segments"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    road_code: Mapped[str] = mapped_column(ForeignKey("roads.code"))
    index: Mapped[int] = mapped_column(Integer)
    x1: Mapped[float] = mapped_column(Float)
    z1: Mapped[float] = mapped_column(Float)
    x2: Mapped[float] = mapped_column(Float)
    z2: Mapped[float] = mapped_column(Float)
    width: Mapped[float] = mapped_column(Float, default=8.0)
    survey_tracked: Mapped[bool] = mapped_column(Boolean, default=True)
    waterlogging_reports: Mapped[int] = mapped_column(Integer, default=0)
    drainage_complaints: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="demo")


class ContextLocation(Base):
    __tablename__ = "context_locations"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(160))
    x: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    axis: Mapped[str | None] = mapped_column(String(2), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="demo")


class Inspection(Base):
    __tablename__ = "inspections"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    segment_id: Mapped[str] = mapped_column(ForeignKey("road_segments.id"))
    inspected_on: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(40), default="vehicle camera")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="demo")


class Defect(Base):
    __tablename__ = "defects"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    segment_id: Mapped[str] = mapped_column(ForeignKey("road_segments.id"))
    inspection_id: Mapped[str | None] = mapped_column(ForeignKey("inspections.id"), nullable=True)
    damage_type: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[float] = mapped_column(Float)
    visual_severity: Mapped[float] = mapped_column(Float)
    t: Mapped[float] = mapped_column(Float)
    lane: Mapped[float] = mapped_column(Float, default=0.0)
    detected_on: Mapped[date] = mapped_column(Date)
    bbox: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [x, y, w, h], normalised 0-1
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    annotated_image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="demo")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class Repair(Base):
    __tablename__ = "repairs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    defect_id: Mapped[str] = mapped_column(ForeignKey("defects.id"))
    submitted_on: Mapped[date] = mapped_column(Date)
    verified_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32))  # submitted | pending_verification | verified
    crew: Mapped[str | None] = mapped_column(String(120), nullable=True)
    after_image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="demo")
