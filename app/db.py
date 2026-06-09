from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

_client: AsyncIOMotorClient | None = None
_db = None


async def init_db():
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGO_URI)
    _db = _client[settings.MONGO_DB]


async def close_db():
    if _client:
        _client.close()


def get_stations():
    return _db.stations


def get_schedules():
    return _db.schedules


def get_recordings():
    return _db.recordings
