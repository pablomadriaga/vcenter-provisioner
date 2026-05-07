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

from .models import ProvisionLog, CustomChart, init_db, get_db
from .config import settings
from .routes import router

# FastAPI graceful shutdown: uvicorn handles SIGTERM automatically
# Cleanup is done in the lifespan context manager below

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    init_db()
    print("Stats service started - database initialized")
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

# In-memory stats data for testing and development
stats_data = {
    "total_provisions": 0,
    "successful": 0,
    "failed": 0,
    "last_update": None
}

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

# ... rest of the file continues
