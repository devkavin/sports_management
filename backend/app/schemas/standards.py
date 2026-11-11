from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

PositiveNumber = Annotated[float, Field(gt=0, le=1e9, allow_inf_nan=False)]
PositiveId = Annotated[int, Field(gt=0, strict=True)]


class StandardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=255)
    exercise_id: PositiveId
    metric: Literal["duration", "split", "watts", "distance"]
    comparison: Literal["at_most", "at_least"]
    target_value: PositiveNumber
    stretch_value: PositiveNumber | None = None
    protocol_distance_m: Annotated[int, Field(gt=0, le=1_000_000_000)] | None = None
    protocol_duration_sec: PositiveNumber | None = None
    audience: Literal["club", "athletes", "schedules"] = "club"
    athlete_ids: list[PositiveId] = Field(default_factory=list, max_length=10000)
    schedule_ids: list[PositiveId] = Field(default_factory=list, max_length=10000)
    effective_from: date | None = None
    effective_until: date | None = None
    result_max_age_days: int = Field(default=90, ge=1, le=3650, strict=True)
    notes: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def valid_rules(self):
        if (self.protocol_distance_m is None) == (self.protocol_duration_sec is None):
            raise ValueError("Specify exactly one protocol distance or duration")
        direction = "at_most" if self.metric in ("duration", "split") else "at_least"
        if self.comparison != direction:
            raise ValueError(f"{self.metric} requires {direction}")
        if self.metric in ("duration", "split") and self.protocol_distance_m is None:
            raise ValueError("Duration and split require a distance protocol")
        if self.metric == "distance" and self.protocol_duration_sec is None:
            raise ValueError("Distance requires a duration protocol")
        if self.stretch_value is not None and ((direction == "at_most" and self.stretch_value >= self.target_value)
                or (direction == "at_least" and self.stretch_value <= self.target_value)):
            raise ValueError("Stretch must be more demanding than target")
        if self.effective_from and self.effective_until and self.effective_until < self.effective_from:
            raise ValueError("Effective end must be on or after start")
        if self.audience == "club" and (self.athlete_ids or self.schedule_ids):
            raise ValueError("Club audience cannot contain selected IDs")
        if self.audience == "athletes" and (not self.athlete_ids or self.schedule_ids):
            raise ValueError("Athlete audience requires only athlete IDs")
        if self.audience == "schedules" and (not self.schedule_ids or self.athlete_ids):
            raise ValueError("Schedule audience requires only schedule IDs")
        self.athlete_ids = sorted(set(self.athlete_ids))
        self.schedule_ids = sorted(set(self.schedule_ids))
        return self


class StandardUpdate(StandardCreate):
    version: PositiveId


class StandardArchive(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: bool = Field(strict=True)
    version: PositiveId


class StandardOut(StandardCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    version: int
    archived: bool
    created_at: datetime
    updated_at: datetime


class StandardEvaluation(BaseModel):
    athlete_id: int
    athlete_name: str
    status: Literal["meets", "below", "stretch", "no_result", "inactive"]
    value: float | None = None
    result_id: int | None = None
    recorded_date: datetime | None = None
