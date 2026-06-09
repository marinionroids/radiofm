from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from config import settings
from db import get_schedules

scheduler = AsyncIOScheduler(timezone=settings.TZ)

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def load_schedules():
    schedules_coll = get_schedules()
    async for doc in schedules_coll.find({"enabled": True}):
        add_job(
            str(doc["_id"]),
            doc["station_id"],
            doc["minute"],
            doc["hour"],
            doc["day_of_week"],
            doc["duration_minutes"],
        )


def add_job(schedule_id: str, station_id: str, minute: int, hour: int, day_of_week: int, duration_minutes: int):
    day_name = DAYS[day_of_week]
    trigger = CronTrigger(day_of_week=day_name, hour=hour, minute=minute, timezone=settings.TZ)
    scheduler.add_job(
        _run_job,
        trigger=trigger,
        id=f"schedule_{schedule_id}",
        args=[schedule_id, station_id, duration_minutes],
        replace_existing=True,
    )


def remove_job(schedule_id: str):
    job_id = f"schedule_{schedule_id}"
    job = scheduler.get_job(job_id)
    if job:
        scheduler.remove_job(job_id)


def get_job_next_run(schedule_id: str):
    job = scheduler.get_job(f"schedule_{schedule_id}")
    if job and job.next_run_time:
        return job.next_run_time
    return None


async def _run_job(schedule_id: str, station_id: str, duration_minutes: int):
    from recorder import record_job
    await record_job(schedule_id, station_id, duration_minutes)
