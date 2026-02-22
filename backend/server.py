import asyncio
import os
import logging
from pathlib import Path
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from db import client
from routes.admin import router as admin_router
from routes.public import router as public_router
from routes.client import router as client_router
from routes.payments import router as payments_router
from routes.reminders import router as reminders_router, reminder_scheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Silwer Lining Photography API")

# Include all routers with /api prefix
app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(client_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(reminders_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler_task = None

@app.on_event("startup")
async def startup_event():
    global scheduler_task
    scheduler_task = asyncio.create_task(reminder_scheduler())
    logger.info("Background reminder scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    global scheduler_task
    if scheduler_task:
        scheduler_task.cancel()
    client.close()
