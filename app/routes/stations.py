from bson import ObjectId
from fastapi import APIRouter, HTTPException

from config import settings
from db import get_stations, get_schedules
from models import StationCreate, StationUpdate
from scheduler import remove_job

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("")
async def list_stations():
    stations = []
    async for doc in get_stations().find().sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        stations.append(doc)
    return stations


@router.post("")
async def create_station(data: StationCreate):
    doc = data.model_dump()
    doc["enabled"] = True
    doc["created_at"] = settings.utc_now()
    result = await get_stations().insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{station_id}")
async def update_station(station_id: str, data: StationUpdate):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields to update")
    result = await get_stations().update_one(
        {"_id": ObjectId(station_id)}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Station not found")
    doc = await get_stations().find_one({"_id": ObjectId(station_id)})
    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/{station_id}")
async def delete_station(station_id: str):
    schedules_coll = get_schedules()
    async for schedule in schedules_coll.find({"station_id": station_id}):
        remove_job(str(schedule["_id"]))
    await schedules_coll.delete_many({"station_id": station_id})

    result = await get_stations().delete_one({"_id": ObjectId(station_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Station not found")
    return {"ok": True}
