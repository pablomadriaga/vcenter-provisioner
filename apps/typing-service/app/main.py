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

# ============ VM Classes Routes ============

@app.get("/vm-classes")
async def list_vm_classes(db: Session = Depends(database.get_db)):
    """List all VM classes."""
    return db.query(models.VMClass).all()


@app.post("/vm-classes")
async def create_vm_class(data: schemas.VMClassCreate, db: Session = Depends(database.get_db)):
    """Create new VM class."""
    try:
        new_class = models.VMClass(
            name=data.name,
            description=data.description,
            cpu_cores=data.cpu_cores,
            memory_mb=data.memory_mb,
            storage_gb=data.storage_gb,
            cpu_reservation_percent=data.cpu_reservation_percent,
            memory_reservation_percent=data.memory_reservation_percent,
            provisioning_type=data.provisioning_type,
            is_locked=False,
            is_active=True,
            created_by="admin"
        )
        db.add(new_class)
        db.commit()
        db.refresh(new_class)
        return new_class
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating VM class: {e}")


@app.get("/vm-classes/{class_id}")
async def get_vm_class(class_id: int, db: Session = Depends(database.get_db)):
    """Get VM class by ID."""
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == class_id).first()
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM class not found")
    return vm_class


@app.put("/vm-classes/{class_id}")
async def update_vm_class(
    class_id: int,
    data: schemas.VMClassUpdate,
    db: Session = Depends(database.get_db)
):
    """Update VM class."""
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == class_id).first()
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM class not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vm_class, key, value)
    
    try:
        db.commit()
        db.refresh(vm_class)
        return vm_class
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error updating VM class: {e}")


@app.delete("/vm-classes/{class_id}")
async def delete_vm_class(class_id: int, db: Session = Depends(database.get_db)):
    """Delete VM class (soft delete by setting is_active=False)."""
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == class_id).first()
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM class not found")
    
    try:
        vm_class.is_active = False
        db.commit()
        return {"message": "VM class deactivated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error deleting VM class: {e}")


# ============ Templates Routes ============

@app.get("/templates")
async def list_templates(db: Session = Depends(database.get_db)):
    """List all templates."""
    return db.query(models.TypificationTemplate).all()


@app.post("/templates")
async def create_template(data: schemas.TypificationTemplateCreate, db: Session = Depends(database.get_db)):
    """Create new template."""
    try:
        new_template = models.TypificationTemplate(
            name=data.name,
            prefijo1=data.prefijo1,
            prefijo2=data.prefijo2,
            seq_digits=data.seq_digits,
            is_active=True,
            created_by=1  # TODO: get from JWT
        )
        db.add(new_template)
        
        # Create counter
        counter = models.TypificationCounter(
            template_id=new_template.id,
            current_value=0
        )
        db.add(counter)
        db.commit()
        db.refresh(new_template)
        return new_template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating template: {e}")


@app.get("/templates/{template_id}")
async def get_template(template_id: int, db: Session = Depends(database.get_db)):
    """Get template by ID."""
    template = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@app.put("/templates/{template_id}")
async def update_template(
    template_id: int,
    data: schemas.TypificationTemplateUpdate,
    db: Session = Depends(database.get_db)
):
    """Update template."""
    template = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = data.model_dump(exclude_unset=True)
    if "edit_reason" in update_data:
        template.edit_reason = update_data.pop("edit_reason")
    
    for key, value in update_data.items():
        setattr(template, key, value)
    
    try:
        db.commit()
        db.refresh(template)
        return template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error updating template: {e}")


@app.delete("/templates/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(database.get_db)):
    """Delete template (soft delete)."""
    template = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        template.is_active = False
        db.commit()
        return {"message": "Template deactivated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error deleting template: {e}")
