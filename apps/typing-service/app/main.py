"""Typing Service - vCenter Provisioner"""
import os
import sys
from typing import List
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from . import models, schemas, database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    models.Base.metadata.create_all(bind=database.engine)
    print("Database tables initialized.")
    db = database.SessionLocal()
    try:
        seed_default_vm_classes(db)
    finally:
        db.close()
    print("Typing service started")
    yield
    # Shutdown logic - cleanup resources
    print("Shutting down gracefully...")
    # Close any open connections here

app = FastAPI(title="vCenter Provisioner: Typing Service", lifespan=lifespan)

# 12-Factor: Config via Env Vars
PORT = int(os.getenv("PORT", 8000))
CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*")

# Register CORS
origins = ["*"] if CORS_ORIGINS == "*" else CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

def seed_default_vm_classes(db: Session):
    """Seed default VM classes if none exist"""
    from .database import SessionLocal
    try:
        count = db.query(models.VMClass).count()
        if count == 0:
            # Add default VM classes here
            pass
    except Exception as e:
        print(f"Error seeding VM classes: {e}")

# ... rest of the routes ...
