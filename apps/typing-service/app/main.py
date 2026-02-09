import os
import signal
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
    models.Base.metadata.create_all(bind=database.engine)
    print("Database tables initialized.")

    db = database.SessionLocal()
    try:
        seed_default_vm_classes(db)
    finally:
        db.close()

    yield

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

@app.post("/templates", response_model=schemas.TypificationTemplateResponse)
def create_template(template: schemas.TypificationTemplateCreate, db: Session = Depends(database.get_db)):
    existing_name = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.name.ilike(template.name),
        models.TypificationTemplate.is_active == True
    ).first()

    if existing_name:
        raise HTTPException(
            status_code=400,
            detail=f"Name '{template.name}' already exists. Please use a different name."
        )

    existing_prefix = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.prefijo1.ilike(template.prefijo1),
        models.TypificationTemplate.prefijo2.ilike(template.prefijo2),
        models.TypificationTemplate.is_active == True
    ).first()

    if existing_prefix:
        raise HTTPException(
            status_code=400,
            detail=f"Combination '{template.prefijo1}-{template.prefijo2}' already exists. Try different prefixes like '{template.prefijo1}-ALT' or 'ALT-{template.prefijo2}'."
        )
    
    db_template = models.TypificationTemplate(
        name=template.name,
        prefijo1=template.prefijo1,
        prefijo2=template.prefijo2,
        seq_digits=template.seq_digits
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    
    # Initialize counter
    db_counter = models.TypificationCounter(template_id=db_template.id, current_value=0)
    db.add(db_counter)
    db.commit()
    
    return db_template

@app.get("/templates", response_model=List[schemas.TypificationTemplateResponse])
def list_templates(db: Session = Depends(database.get_db)):
    return db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.is_active == True
    ).all()

@app.put("/templates/{template_id}", response_model=schemas.TypificationTemplateResponse)
def update_template(template_id: int, update_data: schemas.TypificationTemplateUpdate, db: Session = Depends(database.get_db)):
    template = db.query(models.TypificationTemplate).filter(models.TypificationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Marcar la actual como inactiva y crear nueva
    template.is_active = False
    template.edit_reason = update_data.edit_reason
    
    new_template = models.TypificationTemplate(
        name=f"{template.name} (v{template_id}-{int(datetime.now().timestamp())})",
        prefijo1=update_data.prefijo1 if update_data.prefijo1 else template.prefijo1,
        prefijo2=update_data.prefijo2 if update_data.prefijo2 else template.prefijo2,
        seq_digits=update_data.seq_digits if update_data.seq_digits else template.seq_digits
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    # Copy counter
    db_counter = db.query(models.TypificationCounter).filter(
        models.TypificationCounter.template_id == template_id
    ).first()
    if db_counter:
        new_counter = models.TypificationCounter(
            template_id=new_template.id,
            current_value=db_counter.current_value
        )
        db.add(new_counter)
        db.commit()
    
    return new_template

@app.post("/generate-name/{template_id}", response_model=schemas.VMNamePreview)
def preview_name(template_id: int, request_body: schemas.VMNamePreviewRequest, db: Session = Depends(database.get_db)):
    """
    Generate a VM name preview based on template and manual value.
    Accepts manual_value in request body for better API design.
    """
    template = db.query(models.TypificationTemplate).filter(
        models.TypificationTemplate.id == template_id,
        models.TypificationTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    manual_value = request_body.manual_value
    
    if not manual_value or not manual_value.isalnum():
        raise HTTPException(
            status_code=400,
            detail="Manual value must contain only letters and numbers"
        )
    
    counter = db.query(models.TypificationCounter).filter(
        models.TypificationCounter.template_id == template_id
    ).first()
    
    next_val = (counter.current_value + 1) if counter else 1
    seq_str = str(next_val).zfill(template.seq_digits)
    
    full_name = f"{template.prefijo1}-{template.prefijo2}-{manual_value}-{seq_str}"
    
    if counter:
        counter.current_value = next_val
        counter.updated_at = func.now()
    else:
        new_counter = models.TypificationCounter(
            template_id=template_id,
            current_value=next_val
        )
        db.add(new_counter)
    db.commit()
    
    return schemas.VMNamePreview(
        full_name=full_name,
        segments=[template.prefijo1, template.prefijo2, manual_value, seq_str],
        next_seq=next_val
    )

@app.get("/")
async def root():
    return {"message": "vCenter Provisioner: Typing Engine (Staff Grade) is active."}

# ============ VM CLASSES ENDPOINTS ============

@app.get("/vm-classes", response_model=List[schemas.VMClassResponseSimple])
def list_vm_classes(db: Session = Depends(database.get_db)):
    """Listar todas las VM Classes activas."""
    return db.query(models.VMClass).filter(models.VMClass.is_active == True).all()

@app.get("/vm-classes/{vm_class_id}", response_model=schemas.VMClassResponse)
def get_vm_class(vm_class_id: int, db: Session = Depends(database.get_db)):
    """Obtener una VM Class por ID."""
    vm_class = db.query(models.VMClass).filter(
        models.VMClass.id == vm_class_id,
        models.VMClass.is_active == True
    ).first()
    
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM Class not found")
    
    return vm_class

@app.post("/vm-classes", response_model=schemas.VMClassResponse, status_code=status.HTTP_201_CREATED)
def create_vm_class(vm_class: schemas.VMClassCreate, db: Session = Depends(database.get_db)):
    """Crear una nueva VM Class."""
    existing = db.query(models.VMClass).filter(
        models.VMClass.name.ilike(vm_class.name),
        models.VMClass.is_active == True
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"VM Class '{vm_class.name}' already exists. Please use a different name or edit the existing one."
        )
    
    db_vm_class = models.VMClass(
        name=vm_class.name,
        description=vm_class.description,
        cpu_cores=vm_class.cpu_cores,
        memory_mb=vm_class.memory_mb,
        storage_gb=vm_class.storage_gb,
        cpu_reservation_percent=vm_class.cpu_reservation_percent,
        memory_reservation_percent=vm_class.memory_reservation_percent,
        provisioning_type=vm_class.provisioning_type,
        storage_policy=vm_class.storage_policy,
        created_by="admin"  # Por ahora hardcodeado
    )
    
    db.add(db_vm_class)
    db.commit()
    db.refresh(db_vm_class)
    
    return db_vm_class

@app.put("/vm-classes/{vm_class_id}", response_model=schemas.VMClassResponse)
def update_vm_class(vm_class_id: int, update_data: schemas.VMClassUpdate, db: Session = Depends(database.get_db)):
    """Actualizar una VM Class (si no está bloqueada)."""
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == vm_class_id).first()
    
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM Class not found")
    
    if not vm_class.is_active:
        raise HTTPException(status_code=400, detail="VM Class is not active")
    
    if vm_class.is_locked:
        raise HTTPException(status_code=403, detail="VM Class is locked and cannot be edited")
    
    if update_data.name and update_data.name.lower() != vm_class.name.lower():
        existing = db.query(models.VMClass).filter(
            models.VMClass.name.ilike(update_data.name),
            models.VMClass.is_active == True,
            models.VMClass.id != vm_class_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"VM Class '{update_data.name}' already exists. Please use a different name."
            )
    
    # Actualizar campos
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(vm_class, key, value)
    
    db.commit()
    db.refresh(vm_class)
    
    return vm_class

@app.delete("/vm-classes/{vm_class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vm_class(vm_class_id: int, db: Session = Depends(database.get_db)):
    """Eliminar (soft delete) una VM Class."""
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == vm_class_id).first()
    
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM Class not found")
    
    if vm_class.is_locked:
        raise HTTPException(status_code=403, detail="VM Class is locked and cannot be deleted")
    
    vm_class.is_active = False
    db.commit()
    
    return None

@app.post("/vm-classes/{vm_class_id}/lock", response_model=schemas.VMClassResponse)
def lock_vm_class(vm_class_id: int, db: Session = Depends(database.get_db), user_role: str = Header(None, alias="X-User-Role")):
    """Bloquear una VM Class (solo admin)."""
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can lock VM classes")
    
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == vm_class_id).first()
    
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM Class not found")
    
    vm_class.is_locked = True
    db.commit()
    db.refresh(vm_class)
    
    return vm_class

@app.post("/vm-classes/{vm_class_id}/unlock", response_model=schemas.VMClassResponse)
def unlock_vm_class(vm_class_id: int, db: Session = Depends(database.get_db), user_role: str = Header(None, alias="X-User-Role")):
    """Desbloquear una VM Class (solo admin)."""
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can unlock VM classes")
    
    vm_class = db.query(models.VMClass).filter(models.VMClass.id == vm_class_id).first()
    
    if not vm_class:
        raise HTTPException(status_code=404, detail="VM Class not found")
    
    vm_class.is_locked = False
    db.commit()
    db.refresh(vm_class)
    
    return vm_class

# ============ SEED DEFAULT VM CLASSES ============

def seed_default_vm_classes(db: Session):
    """Crear VM Classes por defecto si no existen."""
    default_classes = [
        {
            "name": "Gold",
            "description": "Alto rendimiento para producción",
            "cpu_cores": 8,
            "memory_mb": 16384,
            "storage_gb": 500,
            "cpu_reservation_percent": 50,
            "memory_reservation_percent": 50,
            "provisioning_type": "thick",
            "storage_policy": "Gold-Policy"
        },
        {
            "name": "Silver",
            "description": "Balanceado para desarrollo",
            "cpu_cores": 4,
            "memory_mb": 8192,
            "storage_gb": 200,
            "cpu_reservation_percent": 25,
            "memory_reservation_percent": 25,
            "provisioning_type": "thin",
            "storage_policy": "Silver-Policy"
        },
        {
            "name": "Bronze",
            "description": "Económico para testing",
            "cpu_cores": 2,
            "memory_mb": 4096,
            "storage_gb": 50,
            "cpu_reservation_percent": 0,
            "memory_reservation_percent": 0,
            "provisioning_type": "thin",
            "storage_policy": "Bronze-Policy"
        }
    ]
    
    for cls_data in default_classes:
        existing = db.query(models.VMClass).filter(
            models.VMClass.name == cls_data["name"],
            models.VMClass.is_active == True
        ).first()
        
        if not existing:
            db_vm_class = models.VMClass(**cls_data, created_by="system")
            db.add(db_vm_class)
            print(f"Created default VM Class: {cls_data['name']}")
    
    db.commit()
