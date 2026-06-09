from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from db import init_db, close_db
from routes.stations import router as stations_router
from routes.schedules import router as schedules_router
from routes.recordings import router as recordings_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    from telegram import logout_public_api
    await logout_public_api()
    from scheduler import scheduler, load_schedules
    await load_schedules()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
    await close_db()


app = FastAPI(title="RadioFM", lifespan=lifespan)

app.include_router(stations_router, prefix="/api")
app.include_router(schedules_router, prefix="/api")
app.include_router(recordings_router, prefix="/api")

app.mount("/", StaticFiles(directory="static", html=True), name="static")
