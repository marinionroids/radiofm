import httpx
from datetime import datetime

from bson import ObjectId

from config import settings
from db import get_recordings


def _api_url(path: str) -> str:
    return f"{settings.TELEGRAM_API_URL}/bot{settings.TELEGRAM_BOT_TOKEN}{path}"


async def send_audio(filepath: str, filename: str, recording_id: str):
    recordings_coll = get_recordings()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
            with open(filepath, "rb") as f:
                response = await client.post(
                    _api_url("/sendAudio"),
                    data={
                        "chat_id": settings.TELEGRAM_CHAT_ID,
                        "title": filename,
                        "performer": "RadioFM",
                    },
                    files={
                        "audio": (filename, f, "audio/mpeg"),
                    },
                )

        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                file_id = result["result"].get("audio", {}).get("file_id", "")
                await recordings_coll.update_one(
                    {"_id": ObjectId(recording_id)},
                    {"$set": {
                        "telegram_sent_at": datetime.utcnow(),
                        "telegram_file_id": file_id,
                        "telegram_status": "sent",
                        "telegram_error": None,
                    }},
                )
            else:
                await recordings_coll.update_one(
                    {"_id": ObjectId(recording_id)},
                    {"$set": {
                        "telegram_status": "failed",
                        "telegram_error": result.get("description", "Unknown error"),
                    }},
                )
        else:
            await recordings_coll.update_one(
                {"_id": ObjectId(recording_id)},
                {"$set": {
                    "telegram_status": "failed",
                    "telegram_error": f"HTTP {response.status_code}: {response.text[:200]}",
                }},
            )
    except Exception as e:
        await recordings_coll.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {
                "telegram_status": "failed",
                "telegram_error": str(e),
            }},
        )
