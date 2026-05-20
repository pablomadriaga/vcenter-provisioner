from sqlalchemy import Column, Integer, String, JSON, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String(20), default="operator")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TypificationTemplate(Base):
    __tablename__ = "typification_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    prefijo1 = Column(String(50), nullable=False)  # Primer prefijo
    prefijo2 = Column(String(50), nullable=False)  # Segundo prefijo
    seq_digits = Column(Integer, nullable=False)      # Dígitos de secuencia (1-4)
    is_active = Column(Boolean, default=True)         # Para identificar huérfanas
    edit_reason = Column(String(255))                # Razón de edición (cuando no está activa)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TypificationCounter(Base):
    __tablename__ = "typification_counters"
    template_id = Column(Integer, ForeignKey("typification_templates.id"), primary_key=True)
    current_value = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class VMProvision(Base):
    __tablename__ = "vm_provisions"
    id = Column(Integer, primary_key=True)
    vm_name = Column(String(255), unique=True, nullable=False)
    template_id = Column(Integer, ForeignKey("typification_templates.id"))
    requester_id = Column(Integer, ForeignKey("users.id"))
    vcenter_datacenter = Column(String(100))
    vcenter_cluster = Column(String(100))
    vcenter_resource_pool = Column(String(100))
    status = Column(String(20), default="pending")
    specs = Column(JSON)
    error_log = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class VMClass(Base):
    __tablename__ = "vm_classes"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500))
    cpu_cores = Column(Integer, nullable=False)
    memory_mb = Column(Integer, nullable=False)
    storage_gb = Column(Integer, nullable=False)
    cpu_reservation_percent = Column(Integer, default=0)
    memory_reservation_percent = Column(Integer, default=0)
    provisioning_type = Column(String(10), nullable=False)  # 'thin' o 'thick'
    is_locked = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
