from datetime import date, datetime
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.models import SchedulePhase

PositiveId = Annotated[int, Field(gt=0, strict=True)]


class PlanPhase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=255)
    phase: SchedulePhase
    start_date: date = Field(ge=date(1000, 1, 1))
    end_date: date = Field(ge=date(1000, 1, 1))
    goals: str = Field(default="", max_length=10000)
    schedule_ids: list[PositiveId] = Field(default_factory=list, max_length=10000)

    @model_validator(mode="after")
    def validate_window(self):
        if self.end_date < self.start_date:
            raise ValueError("Phase end must be on or after start")
        self.schedule_ids = sorted(set(self.schedule_ids))
        return self


class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=10000)
    phases: list[PlanPhase] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_phases(self):
        self.phases = sorted(self.phases, key=lambda p: (p.start_date, p.end_date))
        for previous, current in zip(self.phases, self.phases[1:]):
            if current.start_date <= previous.end_date:
                raise ValueError("Inclusive phase windows cannot overlap")
        return self


class PlanUpdate(PlanCreate):
    version: PositiveId


class PlanArchive(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: bool = Field(strict=True)
    version: PositiveId


class PlanOut(PlanCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    club_id: int
    archived: bool
    version: int
    created_at: datetime
    updated_at: datetime
