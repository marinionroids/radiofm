import asyncio
import os
from datetime import datetime

from bson import ObjectId

from config import settings
from db import get_stations, get_recordings

_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT)


async def record_job(schedule_id: str, station_id: str, duration_minutes: int):
    async with _semaphore:
        await _do_record(schedule_id, station_id, duration_minutes)


async def _do_record(schedule_id: str, station_id: str, duration_minutes: int):
    stations_coll = get_stations()
    recordings_coll = get_recordings()

    station = await stations_coll.find_one({"_id": ObjectId(station_id)})
    if not station or not station.get("enabled", False):
        return

    now = datetime.utcnow()
    safe_name = station["name"].replace(" ", "_").replace("/", "_")
    filename = f"{safe_name}_{now.strftime('%Y%m%d_%H%M%S')}.mp3"
    filepath = os.path.join(settings.RECORDINGS_DIR, filename)

    duration_seconds = duration_minutes * 60

    recording_doc = {
        "station_id": station_id,
        "schedule_id": schedule_id,
        "filename": filename,
        "filepath": filepath,
        "started_at": now,
        "status": "recording",
        "size_bytes": None,
        "duration_seconds": None,
        "ended_at": None,
        "error_message": None,
        "telegram_sent_at": None,
        "telegram_file_id": None,
        "telegram_status": None,
        "telegram_error": None,
    }

    result = await recordings_coll.insert_one(recording_doc)
    recording_id = str(result.inserted_id)

    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i", station["url"],
            "-t", str(duration_seconds),
            "-c:a", "libmp3lame",
            "-b:a", "128k",
            filepath,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        _stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="replace")[-500:] if stderr else "Unknown ffmpeg error"
            await recordings_coll.update_one(
                {"_id": ObjectId(recording_id)},
                {"$set": {"status": "failed", "error_message": error_msg, "ended_at": datetime.utcnow()}},
            )
            return

        file_size = os.path.getsize(filepath)
        duration = await _get_audio_duration(filepath)

        await recordings_coll.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {
                "status": "completed",
                "size_bytes": file_size,
                "duration_seconds": duration,
                "ended_at": datetime.utcnow(),
            }},
        )

        from telegram import send_audio
        await send_audio(filepath, filename, recording_id)

    except Exception as e:
        await recordings_coll.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {"status": "failed", "error_message": str(e), "ended_at": datetime.utcnow()}},
        )


async def _get_audio_duration(filepath: str) -> float:
    try:
        process = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            filepath,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        return float(stdout.decode().strip())
    except Exception:
        return 0.0
