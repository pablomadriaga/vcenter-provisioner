"""Stats Service Models

SQLAlchemy models for provision_logs and custom_charts tables.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, JSON,
    UniqueConstraint, Index, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
import os

Base = declarative_base()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://antigravity:password123@db:5432/vcenter_provisioner"
)


class ProvisionLog(Base):
    """Tracks all provisioning operations."""
    __tablename__ = 'provision_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(100), nullable=False, index=True)
    vm_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)  # PENDING, SUCCESS, FAILED
    vm_class_id = Column(Integer, nullable=True)
    vm_class_name = Column(String(100), nullable=True)
    vcenter_id = Column(Integer, nullable=True)
    vcenter_name = Column(String(255), nullable=True)
    error_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('job_id', name='uq_provision_logs_job_id'),
        Index('idx_provision_logs_status', 'status'),
        Index('idx_provision_logs_created_at', 'created_at'),
        Index('idx_provision_logs_vm_class', 'vm_class_id'),
        Index('idx_provision_logs_vcenter', 'vcenter_id'),
    )


class CustomChart(Base):
    """User saved chart configurations."""
    __tablename__ = 'custom_charts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    chart_type = Column(String(50), nullable=False)  # line, bar, area, pie
    metric = Column(String(100), nullable=False)  # provisions, success_rate, etc.
    group_by = Column(String(100), nullable=True)  # vm_class, vcenter, hourly, daily
    timeframe = Column(String(50), nullable=False, default='7d')
    filters = Column(JSON, nullable=True)
    is_public = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


# Database engine and session
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine, checkfirst=True)
