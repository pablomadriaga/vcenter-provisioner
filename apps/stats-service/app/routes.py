"""Stats Service Routes - vCenter Provisioner
Provides metrics and analytics for provisioning operations.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc, and_, case
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from .models import ProvisionLog, get_db

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
async def get_summary(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """Get stats summary for the last N days."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Single query for all summary stats
    result = db.query(
        func.count(ProvisionLog.id).label('total'),
        func.sum(case((ProvisionLog.status == 'SUCCESS', 1), else_=0)).label('successful'),
        func.sum(case((ProvisionLog.status == 'FAILED', 1), else_=0)).label('failed')
    ).filter(
        ProvisionLog.created_at >= cutoff_date
    ).first()
    
    total = result.total or 0
    successful = result.successful or 0
    failed = result.failed or 0
    
    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "success_rate": round((successful / total * 100), 2) if total > 0 else 0.0
    }


@router.get("/recent")
async def get_recent(
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get recent provisioning operations."""
    results = db.query(ProvisionLog).order_by(
        desc(ProvisionLog.created_at)
    ).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "job_id": r.job_id,
            "vm_name": r.vm_name,
            "status": r.status,
            "vm_class": r.vm_class_name,
            "vcenter": r.vcenter_name,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in results
    ]


@router.get("/by-vmclass")
async def get_by_vmclass(db: Session = Depends(get_db)):
    """Get stats grouped by VM class."""
    results = db.query(
        ProvisionLog.vm_class_name,
        func.count(ProvisionLog.id).label('count'),
        func.sum(case((ProvisionLog.status == 'SUCCESS', 1), else_=0)).label('success'),
        func.sum(case((ProvisionLog.status == 'FAILED', 1), else_=0)).label('failed')
    ).filter(
        ProvisionLog.vm_class_name.isnot(None)
    ).group_by(
        ProvisionLog.vm_class_name
    ).all()
    
    return [
        {
            "vm_class": r.vm_class_name,
            "count": r.count,
            "success": r.success,
            "failed": r.failed
        }
        for r in results
    ]


@router.get("/by-vcenter")
async def get_by_vcenter(db: Session = Depends(get_db)):
    """Get stats grouped by vCenter."""
    results = db.query(
        ProvisionLog.vcenter_name,
        func.count(ProvisionLog.id).label('count'),
        func.sum(case((ProvisionLog.status == 'SUCCESS', 1), else_=0)).label('success'),
        func.sum(case((ProvisionLog.status == 'FAILED', 1), else_=0)).label('failed')
    ).filter(
        ProvisionLog.vcenter_name.isnot(None)
    ).group_by(
        ProvisionLog.vcenter_name
    ).all()
    
    return [
        {
            "vcenter": r.vcenter_name,
            "count": r.count,
            "success": r.success,
            "failed": r.failed
        }
        for r in results
    ]


@router.get("/timeline")
async def get_timeline(
    timeframe: str = Query(default="7d"),
    db: Session = Depends(get_db)
):
    """Get timeline data for charts."""
    # Parse timeframe
    days = int(timeframe.replace('d', '')) if 'd' in timeframe else 7
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Group by day and status
    results = db.query(
        func.date(ProvisionLog.created_at).label('date'),
        func.count(ProvisionLog.id).label('count'),
        ProvisionLog.status
    ).filter(
        ProvisionLog.created_at >= cutoff_date
    ).group_by(
        func.date(ProvisionLog.created_at),
        ProvisionLog.status
    ).all()
    
    # Transform to timeline format
    timeline = {}
    for row in results:
        date_str = str(row.date)
        if date_str not in timeline:
            timeline[date_str] = {"date": date_str, "success": 0, "failed": 0}
        if row.status == 'SUCCESS':
            timeline[date_str]["success"] = row.count
        elif row.status == 'FAILED':
            timeline[date_str]["failed"] = row.count
    
    return sorted(timeline.values(), key=lambda x: x["date"])


@router.get("/hourly")
async def get_hourly(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """Get hourly distribution of provisions."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    results = db.query(
        func.extract('hour', ProvisionLog.created_at).label('hour'),
        func.count(ProvisionLog.id).label('count')
    ).filter(
        ProvisionLog.created_at >= cutoff_date
    ).group_by(
        func.extract('hour', ProvisionLog.created_at)
    ).order_by('hour').all()
    
    return [
        {"hour": int(r.hour), "count": r.count}
        for r in results
    ]


@router.get("/failures")
async def get_failures(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recent failure reasons."""
    results = db.query(
        ProvisionLog.error_reason,
        func.count(ProvisionLog.id).label('count')
    ).filter(
        ProvisionLog.status == 'FAILED',
        ProvisionLog.error_reason.isnot(None)
    ).group_by(
        ProvisionLog.error_reason
    ).order_by(
        desc('count')
    ).limit(limit).all()
    
    return [
        {"reason": r.error_reason, "count": r.count}
        for r in results
    ]
