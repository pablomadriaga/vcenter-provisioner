"""Stats Service - vCenter Provisioner

Provides metrics and analytics for provisioning operations.
"""
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, desc, and_, case
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict

from .models import ProvisionLog, CustomChart, get_db
from .config import settings
from .routes import router

# FastAPI graceful shutdown: uvicorn handles SIGTERM automatically
# Cleanup is done in the lifespan context manager below

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic — schemas gestionados por vcenter-provisioner-migrations Job
    print("Stats service started")
    yield
    # Shutdown logic - cleanup resources
    print("Shutting down gracefully...")
    # Close any open connections here

app = FastAPI(
    title="vCenter Provisioner: Stats & Analytics",
    description="Metrics and analytics for provisioning operations",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ============ Pydantic Models ===========

class ProvisionLogCreate(BaseModel):
    """Schema for creating a provision log entry."""
    job_id: str
    vm_name: str
    status: str  # PENDING, SUCCESS, FAILED
    vm_class_id: Optional[int] = None
    vm_class_name: Optional[str] = None
    vcenter_id: Optional[int] = None
    vcenter_name: Optional[str] = None
    error_reason: Optional[str] = None


@app.post("/api/provision-logs")
async def create_provision_log(log: ProvisionLogCreate):
    """Receive provision logs from vm-orchestrator (internal)."""
    db = next(get_db())
    try:
        entry = ProvisionLog(
            job_id=log.job_id,
            vm_name=log.vm_name,
            status=log.status,
            vm_class_id=log.vm_class_id,
            vm_class_name=log.vm_class_name,
            vcenter_id=log.vcenter_id,
            vcenter_name=log.vcenter_name,
            error_reason=log.error_reason,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return {"id": entry.id, "status": "created"}
    except Exception as e:
        db.rollback()
        print(f"Error creating provision log: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

# ... rest of the file continues
