from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StationCreate(BaseModel):
    name: str
    url: str


class StationUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    enabled: Optional[bool] = None


class ScheduleCreate(BaseModel):
    station_id: str
    day_of_week: int = Field(ge=0, le=6)
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)
    duration_minutes: int = Field(ge=1, le=360)
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    station_id: Optional[str] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    hour: Optional[int] = Field(None, ge=0, le=23)
    minute: Optional[int] = Field(None, ge=0, le=59)
    duration_minutes: Optional[int] = Field(None, ge=1, le=360)
    enabled: Optional[bool] = None
