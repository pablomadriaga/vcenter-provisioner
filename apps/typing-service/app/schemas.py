from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional
from datetime import datetime

def validate_alphanumeric(value: str) -> str:
    """Validar que el valor solo contenga letras y números."""
    if not value:
        raise ValueError('Value cannot be empty')
    if not value.isalnum():
        raise ValueError('Only letters and numbers are allowed')
    return value

class TypificationTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    prefijo1: str = Field(..., min_length=1, max_length=50)
    prefijo2: str = Field(..., min_length=1, max_length=50)
    seq_digits: int = Field(..., ge=1, le=4)  # Solo 1-4 dígitos

    @field_validator('prefijo1', 'prefijo2')
    @classmethod
    def validate_prefixes(cls, v: str) -> str:
        return validate_alphanumeric(v)

class TypificationTemplateCreate(TypificationTemplateBase):
    pass

class TypificationTemplateUpdate(BaseModel):
    prefijo1: Optional[str] = Field(None, min_length=1, max_length=50)
    prefijo2: Optional[str] = Field(None, min_length=1, max_length=50)
    seq_digits: Optional[int] = Field(None, ge=1, le=4)
    edit_reason: str = Field(..., min_length=10, max_length=255)  # Razón obligatoria

    @field_validator('prefijo1', 'prefijo2')
    @classmethod
    def validate_prefixes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_alphanumeric(v)
        return v

class TypificationTemplateResponse(TypificationTemplateBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class VMProvisionRequest(BaseModel):
    template_id: int
    manual_value: str  # Solo un valor manual
    vcenter_datacenter: str
    vcenter_cluster: str
    vcenter_resource_pool: str
    specs: dict

    @field_validator('manual_value')
    @classmethod
    def validate_manual_value(cls, v: str) -> str:
        return validate_alphanumeric(v)

class VMNamePreview(BaseModel):
    full_name: str
    segments: List[str]
    next_seq: int

class VMNamePreviewRequest(BaseModel):
    manual_value: str = Field(..., min_length=1, max_length=50, description="Manual value for VM naming")
    
    @field_validator('manual_value')
    @classmethod
    def validate_manual_value(cls, v: str) -> str:
        return validate_alphanumeric(v)  # Mostrar cuál será el siguiente número

# ============ VM CLASS SCHEMAS ============

class VMClassBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    cpu_cores: int = Field(..., ge=1, le=256)
    memory_mb: int = Field(..., ge=512, le=524288)
    storage_gb: int = Field(..., ge=10, le=10000)
    cpu_reservation_percent: int = Field(default=0, ge=0, le=100)
    memory_reservation_percent: int = Field(default=0, ge=0, le=100)
    provisioning_type: str = Field(..., pattern='^(thin|thick)$')

class VMClassCreate(VMClassBase):
    pass

class VMClassUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    cpu_cores: int | None = Field(None, ge=1, le=256)
    memory_mb: int | None = Field(None, ge=512, le=524288)
    storage_gb: int | None = Field(None, ge=10, le=10000)
    cpu_reservation_percent: int | None = Field(None, ge=0, le=100)
    memory_reservation_percent: int | None = Field(None, ge=0, le=100)
    provisioning_type: str | None = Field(None, pattern='^(thin|thick)$')

class VMClassResponse(VMClassBase):
    id: int
    is_locked: bool
    is_active: bool
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

class VMClassResponseSimple(BaseModel):
    id: int
    name: str
    description: str | None
    cpu_cores: int
    memory_mb: int
    storage_gb: int
    provisioning_type: str
    is_locked: bool

    model_config = ConfigDict(from_attributes=True)
