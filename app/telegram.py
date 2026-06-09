import httpx
import os
from datetime import datetime

from bson import ObjectId

from config import settings
from db import get_recordings


def _api_url(path: str) -> str:
    return f"{settings.TELEGRAM_API_URL}/bot{settings.TELEGRAM_BOT_TOKEN}{path}"


async def logout_public_api():
    """Log bot out from api.telegram.org so the local server takes over."""
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/logOut"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            r = await client.post(url)
            print(f"[telegram] logOut from public API: status={r.status_code}, response={r.text[:100]}")
    except Exception as e:
        print(f"[telegram] logOut failed (may already be logged out): {e}")


async def send_audio(filepath: str, filename: str, recording_id: str):
    recordings_coll = get_recordings()

    print(f"[telegram] Sending {filename} ({os.path.getsize(filepath)} bytes) to chat {settings.TELEGRAM_CHAT_ID}")

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

        print(f"[telegram] API response status={response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"[telegram] API result: ok={result.get('ok')}, description={result.get('description', 'N/A')}")
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
                print(f"[telegram] Successfully sent, file_id={file_id}")
            else:
                error_desc = result.get("description", "Unknown error")
                print(f"[telegram] API error: {error_desc}")
                await recordings_coll.update_one(
                    {"_id": ObjectId(recording_id)},
                    {"$set": {
                        "telegram_status": "failed",
                        "telegram_error": error_desc,
                    }},
                )
        else:
            error_msg = f"HTTP {response.status_code}: {response.text[:300]}"
            print(f"[telegram] HTTP error: {error_msg}")
            await recordings_coll.update_one(
                {"_id": ObjectId(recording_id)},
                {"$set": {
                    "telegram_status": "failed",
                    "telegram_error": error_msg,
                }},
            )
    except Exception as e:
        print(f"[telegram] Exception: {e}")
        await recordings_coll.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {
                "telegram_status": "failed",
                "telegram_error": str(e),
            }},
        )
