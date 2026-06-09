import os

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from db import get_recordings, get_stations
from scheduler import scheduler

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.get("")
async def list_recordings(page: int = 1, per_page: int = 20):
    skip = (page - 1) * per_page
    total = await get_recordings().count_documents({})
    cursor = get_recordings().find().sort("started_at", -1).skip(skip).limit(per_page)

    recordings = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        station = await get_stations().find_one({"_id": ObjectId(doc["station_id"])})
        doc["station_name"] = station["name"] if station else "Unknown"
        recordings.append(doc)

    return {
        "recordings": recordings,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{recording_id}/download")
async def download_recording(recording_id: str):
    recording = await get_recordings().find_one({"_id": ObjectId(recording_id)})
    if not recording:
        raise HTTPException(404, "Recording not found")

    filepath = recording.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        filepath,
        media_type="audio/mpeg",
        filename=recording.get("filename", "recording.mp3"),
    )


@router.post("/{recording_id}/send-telegram")
async def resend_telegram(recording_id: str):
    recording = await get_recordings().find_one({"_id": ObjectId(recording_id)})
    if not recording:
        raise HTTPException(404, "Recording not found")

    filepath = recording.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(404, "File not found on disk")

    from telegram import send_audio
    await send_audio(filepath, recording.get("filename", "recording.mp3"), recording_id)
    return {"ok": True}


@router.get("/stats/summary")
async def get_stats():
    recordings_coll = get_recordings()

    total = await recordings_coll.count_documents({})

    size_pipeline = [
        {"$match": {"size_bytes": {"$ne": None}}},
        {"$group": {"_id": None, "total_size": {"$sum": "$size_bytes"}}},
    ]
    size_result = await recordings_coll.aggregate(size_pipeline).to_list(1)
    total_size = size_result[0]["total_size"] if size_result else 0

    duration_pipeline = [
        {"$match": {"duration_seconds": {"$ne": None}}},
        {"$group": {"_id": None, "total_duration": {"$sum": "$duration_seconds"}}},
    ]
    dur_result = await recordings_coll.aggregate(duration_pipeline).to_list(1)
    total_duration = dur_result[0]["total_duration"] if dur_result else 0

    jobs = scheduler.get_jobs()
    next_runs = []
    for job in jobs:
        if job.next_run_time:
            next_runs.append({
                "job_id": job.id,
                "next_run": job.next_run_time.isoformat(),
            })
    next_runs.sort(key=lambda x: x["next_run"])

    return {
        "total_recordings": total,
        "total_size_bytes": total_size,
        "total_duration_seconds": round(total_duration, 1),
        "next_runs": next_runs[:5],
    }
