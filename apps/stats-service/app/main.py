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
from pydantic import BaseModel, Field

from .models import ProvisionLog, CustomChart, init_db, get_db
from .config import settings

# Initialize database
init_db()

app = FastAPI(
    title="vCenter Provisioner: Stats & Analytics",
    description="Metrics and analytics for provisioning operations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Pydantic Models ============

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


class CustomChartCreate(BaseModel):
    """Schema for creating a custom chart."""
    user_id: int
    name: str
    chart_type: str  # line, bar, area, pie
    metric: str
    group_by: Optional[str] = None
    timeframe: str = "7d"
    filters: Optional[Dict[str, Any]] = None
    is_public: bool = False


class CustomChartResponse(CustomChartCreate):
    """Schema for custom chart response."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StatsSummary(BaseModel):
    """Summary statistics response."""
    total_provisions: int
    successful: int
    failed: int
    success_rate: float
    last_update: Optional[datetime] = None


class TimelinePoint(BaseModel):
    """Single point in time series data."""
    timestamp: str
    total: int
    successful: int
    failed: int


class VMClassStats(BaseModel):
    """VM Class usage statistics."""
    vm_class_id: Optional[int]
    vm_class_name: Optional[str]
    count: int
    success_count: int
    fail_count: int
    success_rate: float


class vCenterStats(BaseModel):
    """vCenter usage statistics."""
    vcenter_id: Optional[int]
    vcenter_name: Optional[str]
    count: int
    success_count: int
    fail_count: int
    success_rate: float


class HourlyDistribution(BaseModel):
    """Hourly distribution of provisions."""
    hour: int
    count: int


# ============ Dependencies ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background collector on app startup."""
    init_db()
    yield


# ============ API Endpoints ============

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "stats-service"}


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {"message": "vCenter Provisioner: Stats Service is active."}


@app.post("/api/provision-logs", status_code=201)
async def create_provision_log(
    log: ProvisionLogCreate,
    db: Session = Depends(get_db)
):
    """Create a new provision log entry (called by vm-orchestrator)."""
    try:
        db_log = ProvisionLog(
            job_id=log.job_id,
            vm_name=log.vm_name,
            status=log.status,
            vm_class_id=log.vm_class_id,
            vm_class_name=log.vm_class_name,
            vcenter_id=log.vcenter_id,
            vcenter_name=log.vcenter_name,
            error_reason=log.error_reason,
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return {"id": db_log.id, "status": "created"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/stats/summary", response_model=StatsSummary)
async def get_stats_summary(
    days: int = Query(default=7, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get summary statistics for provisions."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    total = db.query(func.count(ProvisionLog.id)).filter(
        ProvisionLog.created_at >= cutoff
    ).scalar() or 0
    
    successful = db.query(func.count(ProvisionLog.id)).filter(
        and_(
            ProvisionLog.created_at >= cutoff,
            ProvisionLog.status == 'READY'
        )
    ).scalar() or 0
    
    failed = db.query(func.count(ProvisionLog.id)).filter(
        and_(
            ProvisionLog.created_at >= cutoff,
            ProvisionLog.status == 'FAILED'
        )
    ).scalar() or 0
    
    success_rate = (successful / total * 100) if total > 0 else 0.0
    
    last_log = db.query(ProvisionLog).order_by(
        desc(ProvisionLog.created_at)
    ).first()
    
    return StatsSummary(
        total_provisions=total,
        successful=successful,
        failed=failed,
        success_rate=round(success_rate, 2),
        last_update=last_log.created_at if last_log else None
    )


@app.get("/stats/timeline", response_model=List[TimelinePoint])
async def get_timeline(
    timeframe: str = Query(default="7d", description="1h, 24h, 7d, 30d"),
    db: Session = Depends(get_db)
):
    """Get time series data for provisions."""
    now = datetime.utcnow()
    
    if timeframe == "1h":
        cutoff = now - timedelta(hours=1)
        interval_minutes = 5
    elif timeframe == "24h":
        cutoff = now - timedelta(days=1)
        interval_minutes = 60
    elif timeframe == "7d":
        cutoff = now - timedelta(days=7)
        interval_minutes = 360  # 6 hours
    else:  # 30d
        cutoff = now - timedelta(days=30)
        interval_minutes = 1440  # 24 hours
    
    logs = db.query(ProvisionLog).filter(
        ProvisionLog.created_at >= cutoff
    ).order_by(ProvisionLog.created_at).all()
    
    # Aggregate by time buckets
    buckets = {}
    current = cutoff
    while current <= now:
        bucket_key = current.strftime("%Y-%m-%d %H:%M")
        buckets[bucket_key] = {"total": 0, "successful": 0, "failed": 0}
        current += timedelta(minutes=interval_minutes)
    
    for log in logs:
        bucket_key = log.created_at.strftime("%Y-%m-%d %H:%M")
        if bucket_key in buckets:
            buckets[bucket_key]["total"] += 1
            if log.status == "READY":
                buckets[bucket_key]["successful"] += 1
            else:
                buckets[bucket_key]["failed"] += 1
    
    return [
        TimelinePoint(
            timestamp=k,
            total=v["total"],
            successful=v["successful"],
            failed=v["failed"]
        )
        for k, v in sorted(buckets.items())
    ]


@app.get("/stats/by-vmclass", response_model=List[VMClassStats])
async def get_stats_by_vmclass(
    db: Session = Depends(get_db)
):
    """Get provision statistics grouped by VM Class."""
    results = db.query(
        ProvisionLog.vm_class_id,
        ProvisionLog.vm_class_name,
        func.count(ProvisionLog.id).label('count'),
        func.sum(case((ProvisionLog.status == 'READY', 1), else_=0)).label('success_count'),
        func.sum(case((ProvisionLog.status == 'FAILED', 1), else_=0)).label('fail_count'),
    ).group_by(
        ProvisionLog.vm_class_id,
        ProvisionLog.vm_class_name
    ).all()
    
    return [
        VMClassStats(
            vm_class_id=r.vm_class_id,
            vm_class_name=r.vm_class_name,
            count=r.count,
            success_count=r.success_count or 0,
            fail_count=r.fail_count or 0,
            success_rate=round((r.success_count or 0) / r.count * 100, 2) if r.count > 0 else 0.0
        )
        for r in results
    ]


@app.get("/stats/by-vcenter", response_model=List[vCenterStats])
async def get_stats_by_vcenter(
    db: Session = Depends(get_db)
):
    """Get provision statistics grouped by vCenter."""
    results = db.query(
        ProvisionLog.vcenter_id,
        ProvisionLog.vcenter_name,
        func.count(ProvisionLog.id).label('count'),
        func.sum(case((ProvisionLog.status == 'READY', 1), else_=0)).label('success_count'),
        func.sum(case((ProvisionLog.status == 'FAILED', 1), else_=0)).label('fail_count'),
    ).group_by(
        ProvisionLog.vcenter_id,
        ProvisionLog.vcenter_name
    ).all()
    
    return [
        vCenterStats(
            vcenter_id=r.vcenter_id,
            vcenter_name=r.vcenter_name,
            count=r.count,
            success_count=r.success_count or 0,
            fail_count=r.fail_count or 0,
            success_rate=round((r.success_count or 0) / r.count * 100, 2) if r.count > 0 else 0.0
        )
        for r in results
    ]


@app.get("/stats/hourly", response_model=List[HourlyDistribution])
async def get_hourly_distribution(
    days: int = Query(default=7),
    db: Session = Depends(get_db)
):
    """Get provisions distribution by hour of day."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    results = db.query(
        func.extract('hour', ProvisionLog.created_at).label('hour'),
        func.count(ProvisionLog.id).label('count')
    ).filter(
        ProvisionLog.created_at >= cutoff
    ).group_by(
        func.extract('hour', ProvisionLog.created_at)
    ).all()
    
    return [
        HourlyDistribution(hour=int(r.hour), count=r.count)
        for r in results
    ]


@app.get("/stats/failures")
async def get_failure_reasons(
    limit: int = Query(default=10),
    db: Session = Depends(get_db)
):
    """Get top failure reasons."""
    results = db.query(
        ProvisionLog.error_reason,
        func.count(ProvisionLog.id).label('count')
    ).filter(
        and_(
            ProvisionLog.status == 'FAILED',
            ProvisionLog.error_reason.isnot(None)
        )
    ).group_by(
        ProvisionLog.error_reason
    ).order_by(
        desc('count')
    ).limit(limit).all()
    
    return [
        {"reason": r.error_reason or "Unknown", "count": r.count}
        for r in results
    ]


class RecentProvision(BaseModel):
    """Recent provision entry."""
    id: int
    job_id: str
    vm_name: str
    status: str
    vm_class_name: Optional[str]
    vcenter_name: Optional[str]
    created_at: datetime


@app.get("/stats/recent", response_model=List[RecentProvision])
async def get_recent_provisions(
    limit: int = Query(default=5, le=20),
    db: Session = Depends(get_db)
):
    """Get most recent provisions with status."""
    results = db.query(
        ProvisionLog.id,
        ProvisionLog.job_id,
        ProvisionLog.vm_name,
        ProvisionLog.status,
        ProvisionLog.vm_class_name,
        ProvisionLog.vcenter_name,
        ProvisionLog.created_at
    ).order_by(
        desc(ProvisionLog.created_at)
    ).limit(limit).all()
    
    return [
        RecentProvision(
            id=r.id,
            job_id=r.job_id,
            vm_name=r.vm_name,
            status=r.status,
            vm_class_name=r.vm_class_name,
            vcenter_name=r.vcenter_name,
            created_at=r.created_at
        )
        for r in results
    ]


# ============ Custom Charts API ============

@app.post("/api/custom-charts", response_model=CustomChartResponse, status_code=201)
async def create_custom_chart(
    chart: CustomChartCreate,
    db: Session = Depends(get_db)
):
    """Create a new custom chart configuration."""
    db_chart = CustomChart(
        user_id=chart.user_id,
        name=chart.name,
        chart_type=chart.chart_type,
        metric=chart.metric,
        group_by=chart.group_by,
        timeframe=chart.timeframe,
        filters=chart.filters,
        is_public=chart.is_public,
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    return db_chart


@app.get("/api/custom-charts", response_model=List[CustomChartResponse])
async def get_custom_charts(
    user_id: int = Query(..., description="User ID to filter charts"),
    db: Session = Depends(get_db)
):
    """Get custom charts for a user."""
    charts = db.query(CustomChart).filter(
        CustomChart.user_id == user_id
    ).order_by(desc(CustomChart.created_at)).all()
    return charts


@app.get("/api/custom-charts/{chart_id}", response_model=CustomChartResponse)
async def get_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific custom chart."""
    chart = db.query(CustomChart).filter(CustomChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart


@app.delete("/api/custom-charts/{chart_id}", status_code=204)
async def delete_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db)
):
    """Delete a custom chart."""
    chart = db.query(CustomChart).filter(CustomChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    db.delete(chart)
    db.commit()
    return None
