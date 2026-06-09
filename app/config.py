import os

import pytz
from dotenv import load_dotenv

load_dotenv()


def _validate_tz(tz: str) -> str:
    try:
        pytz.timezone(tz)
        return tz
    except pytz.exceptions.UnknownTimeZoneError:
        print(f"WARNING: Unknown timezone '{tz}', falling back to UTC")
        return "UTC"


class Settings:
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://mongo:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "radiofm")
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_API_URL: str = os.getenv("TELEGRAM_API_URL", "http://telegram-bot-api:8081")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")
    RECORDINGS_DIR: str = os.getenv("RECORDINGS_DIR", "/recordings")
    TZ: str = _validate_tz(os.getenv("TZ", "UTC"))
    MAX_DURATION_MINUTES: int = 360
    MAX_CONCURRENT: int = 3


settings = Settings()
