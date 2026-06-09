from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from db import get_schedules, get_stations
from models import ScheduleCreate, ScheduleUpdate
from scheduler import add_job, remove_job

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _cron_expr(minute: int, hour: int, day_of_week: int) -> str:
    return f"{minute} {hour} * * {day_of_week}"


@router.get("")
async def list_schedules():
    schedules = []
    async for doc in get_schedules().find().sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        station = await get_stations().find_one({"_id": ObjectId(doc["station_id"])})
        doc["station_name"] = station["name"] if station else "Unknown"
        schedules.append(doc)
    return schedules


@router.post("")
async def create_schedule(data: ScheduleCreate):
    station = await get_stations().find_one({"_id": ObjectId(data.station_id)})
    if not station:
        raise HTTPException(404, "Station not found")

    doc = data.model_dump()
    doc["cron_expression"] = _cron_expr(data.minute, data.hour, data.day_of_week)
    doc["created_at"] = datetime.utcnow()

    result = await get_schedules().insert_one(doc)
    schedule_id = str(result.inserted_id)
    doc["_id"] = schedule_id

    if doc["enabled"]:
        add_job(schedule_id, doc["station_id"], doc["minute"], doc["hour"], doc["day_of_week"], doc["duration_minutes"])

    doc["station_name"] = station["name"]
    return doc


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: str, data: ScheduleUpdate):
    existing = await get_schedules().find_one({"_id": ObjectId(schedule_id)})
    if not existing:
        raise HTTPException(404, "Schedule not found")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields to update")

    await get_schedules().update_one(
        {"_id": ObjectId(schedule_id)}, {"$set": update_data}
    )

    remove_job(schedule_id)
    updated = await get_schedules().find_one({"_id": ObjectId(schedule_id)})
    if updated["enabled"]:
        add_job(
            schedule_id,
            updated["station_id"],
            updated["minute"],
            updated["hour"],
            updated["day_of_week"],
            updated["duration_minutes"],
        )

    updated["_id"] = str(updated["_id"])
    station = await get_stations().find_one({"_id": ObjectId(updated["station_id"])})
    updated["station_name"] = station["name"] if station else "Unknown"
    return updated


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str):
    remove_job(schedule_id)
    result = await get_schedules().delete_one({"_id": ObjectId(schedule_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Schedule not found")
    return {"ok": True}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    schedule = await get_schedules().find_one({"_id": ObjectId(schedule_id)})
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    new_enabled = not schedule.get("enabled", True)
    await get_schedules().update_one(
        {"_id": ObjectId(schedule_id)}, {"$set": {"enabled": new_enabled}}
    )

    if new_enabled:
        add_job(
            schedule_id,
            schedule["station_id"],
            schedule["minute"],
            schedule["hour"],
            schedule["day_of_week"],
            schedule["duration_minutes"],
        )
    else:
        remove_job(schedule_id)

    return {"enabled": new_enabled}
