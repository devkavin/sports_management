from sqlalchemy import Column, Integer, String, Double, Boolean, Date, DateTime, ForeignKey, JSON, Text
from app.core.database import Base
from app.models.operations import utcnow


class PerformanceStandard(Base):
    __tablename__ = "performance_standards"
    id = Column(Integer, primary_key=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    metric = Column(String(16), nullable=False)
    comparison = Column(String(16), nullable=False)
    target_value = Column(Double, nullable=False)
    stretch_value = Column(Double, nullable=True)
    protocol_distance_m = Column(Integer, nullable=True)
    protocol_duration_sec = Column(Double, nullable=True)
    audience = Column(String(16), nullable=False)
    athlete_ids = Column(JSON, nullable=False)
    schedule_ids = Column(JSON, nullable=False)
    effective_from = Column(Date, nullable=True)
    effective_until = Column(Date, nullable=True)
    result_max_age_days = Column(Integer, nullable=False, default=90)
    notes = Column(Text, nullable=True)
    archived = Column(Boolean, nullable=False, default=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    __mapper_args__ = {"version_id_col": version}
