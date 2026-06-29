import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://antigravity:password123@db:5432/vcenter_provisioner")

engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def setup_db():
    from app import models
    from sqlalchemy import text
    
    models.Base.metadata.create_all(bind=engine)
    
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM typification_counters"))
        conn.execute(text("DELETE FROM typification_templates"))
        conn.execute(text("DELETE FROM vm_classes"))
        conn.commit()
    
    yield

@pytest.fixture
def client(setup_db):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "active" in response.json()["message"]

def test_create_template_success(client):
    response = client.post("/templates", json={
        "name": "test-tpl",
        "prefijo1": "pre1",
        "prefijo2": "pre2",
        "seq_digits": 3
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["name"] == "test-tpl"
    assert data["prefijo1"] == "pre1"
    assert data["prefijo2"] == "pre2"
    assert data["seq_digits"] == 3
    assert data["is_active"] == True

def test_create_template_duplicate_prefixes(client):
    response1 = client.post("/templates", json={
        "name": "template-1",
        "prefijo1": "pre1",
        "prefijo2": "pre2",
        "seq_digits": 3
    })
    assert response1.status_code == 200

    response2 = client.post("/templates", json={
        "name": "template-2",
        "prefijo1": "pre1",
        "prefijo2": "pre2",
        "seq_digits": 4
    })
    assert response2.status_code == 400
    assert "already exists" in response2.json()["detail"].lower()

def test_create_template_invalid_prefix(client):
    response = client.post("/templates", json={
        "name": "test-tpl",
        "prefijo1": "pre1-con-guiones",
        "prefijo2": "pre2",
        "seq_digits": 3
    })
    assert response.status_code == 422

def test_create_template_invalid_seq_digits(client):
    response = client.post("/templates", json={
        "name": "test-tpl",
        "prefijo1": "pre1",
        "prefijo2": "pre2",
        "seq_digits": 7
    })
    assert response.status_code == 422

def test_list_templates(client):
    response = client.get("/templates")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_generate_name_valid(client):
    response = client.post("/templates", json={
        "name": "test-tpl-gen",
        "prefijo1": "PROD",
        "prefijo2": "SRV",
        "seq_digits": 4
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    preview_response = client.post(f"/generate-name/{template_id}", json={"manual_value": "app1"})
    assert preview_response.status_code == 200
    data = preview_response.json()
    assert data["full_name"] == "PROD-SRV-app1-0001"

def test_generate_name_invalid_template(client):
    preview_response = client.post("/generate-name/9999", json={"manual_value": "app1"})
    assert preview_response.status_code == 404

def test_generate_name_invalid_manual_value(client):
    response = client.post("/templates", json={
        "name": "test-tpl-invalid",
        "prefijo1": "PROD",
        "prefijo2": "SRV",
        "seq_digits": 4
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    preview_response = client.post(f"/generate-name/{template_id}", json={"manual_value": "app-1!"})
    assert preview_response.status_code == 422

def test_update_template_success(client):
    response = client.post("/templates", json={
        "name": "test-tpl-upd",
        "prefijo1": "PRE1",
        "prefijo2": "PRE2",
        "seq_digits": 3
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    update_response = client.put(f"/templates/{template_id}", json={
        "prefijo1": "PRE1UPDATED",
        "prefijo2": "PRE2",
        "seq_digits": 4,
        "edit_reason": "Testing update functionality"
    })
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["prefijo1"] == "PRE1UPDATED"
    assert data["seq_digits"] == 4

def test_update_template_invalid_reason(client):
    response = client.post("/templates", json={
        "name": "test-tpl-reason",
        "prefijo1": "PRE1",
        "prefijo2": "PRE2",
        "seq_digits": 3
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    update_response = client.put(f"/templates/{template_id}", json={
        "prefijo1": "PRE1-UPDATED",
        "edit_reason": "short"
    })
    assert update_response.status_code == 422

def test_sequential_generation(client):
    response = client.post("/templates", json={
        "name": "seq-test",
        "prefijo1": "SEQ",
        "prefijo2": "TEST",
        "seq_digits": 3
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    names = []
    for i in range(3):
        preview_response = client.post(f"/generate-name/{template_id}", json={"manual_value": f"vm{i}"})
        assert preview_response.status_code == 200
        names.append(preview_response.json()["full_name"])

    assert names[0] == "SEQ-TEST-vm0-001"
    assert names[1] == "SEQ-TEST-vm1-002"
    assert names[2] == "SEQ-TEST-vm2-003"

def test_rfc1123_compliance(client):
    response = client.post("/templates", json={
        "name": "rfc-test",
        "prefijo1": "TEST",
        "prefijo2": "VM",
        "seq_digits": 4
    })
    assert response.status_code == 200
    template_id = response.json()["id"]

    preview_response = client.post(f"/generate-name/{template_id}", json={"manual_value": "production"})
    assert preview_response.status_code == 200
    full_name = preview_response.json()["full_name"]
    assert len(full_name) <= 63
    assert all(c.isalnum() or c == '-' for c in full_name)

def test_create_vm_class_success(client):
    response = client.post("/vm-classes", json={
        "name": "Gold-Test",
        "description": "Test VM class",
        "cpu_cores": 8,
        "memory_mb": 16384,
        "storage_gb": 500,
        "cpu_reservation_percent": 50,
        "memory_reservation_percent": 50,
        "provisioning_type": "thick",
        "storage_policy": "Gold-Policy"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Gold-Test"
    assert data["cpu_cores"] == 8

def test_create_vm_class_duplicate_name(client):
    response1 = client.post("/vm-classes", json={
        "name": "Gold-Duplicate",
        "description": "First class",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response1.status_code == 201

    response2 = client.post("/vm-classes", json={
        "name": "Gold-Duplicate",
        "description": "Duplicate class",
        "cpu_cores": 2,
        "memory_mb": 4096,
        "storage_gb": 100,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response2.status_code == 400
    assert "already exists" in response2.json()["detail"].lower()

def test_create_vm_class_invalid_provisioning_type(client):
    response = client.post("/vm-classes", json={
        "name": "Test-Class",
        "description": "Test",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "invalid",
        "storage_policy": "Standard"
    })
    assert response.status_code == 422

def test_list_vm_classes(client):
    response = client.get("/vm-classes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_vm_class_by_id(client):
    response = client.post("/vm-classes", json={
        "name": "Test-Class-ById",
        "description": "Test",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    get_response = client.get(f"/vm-classes/{class_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Test-Class-ById"

def test_get_vm_class_not_found(client):
    get_response = client.get("/vm-classes/9999")
    assert get_response.status_code == 404

def test_update_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Update-Test",
        "description": "Original description",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    update_response = client.put(f"/vm-classes/{class_id}", json={
        "name": "Update-Test-Updated",
        "description": "Updated description",
        "cpu_cores": 8
    })
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Update-Test-Updated"
    assert data["cpu_cores"] == 8

def test_update_locked_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Locked-Class",
        "description": "To be locked",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    lock_response = client.post(f"/vm-classes/{class_id}/lock", headers={"X-User-Role": "admin"})
    assert lock_response.status_code == 200

    update_response = client.put(f"/vm-classes/{class_id}", json={
        "description": "Trying to update locked"
    })
    assert update_response.status_code == 403
    assert "locked" in update_response.json()["detail"].lower()

def test_lock_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Lock-Test",
        "description": "To be locked",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    lock_response = client.post(f"/vm-classes/{class_id}/lock", headers={"X-User-Role": "admin"})
    assert lock_response.status_code == 200
    assert lock_response.json()["is_locked"] == True

def test_unlock_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Unlock-Test",
        "description": "To be unlocked",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    lock_response = client.post(f"/vm-classes/{class_id}/lock", headers={"X-User-Role": "admin"})
    assert lock_response.status_code == 200

    unlock_response = client.post(f"/vm-classes/{class_id}/unlock", headers={"X-User-Role": "admin"})
    assert unlock_response.status_code == 200
    assert unlock_response.json()["is_locked"] == False

def test_delete_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Delete-Test",
        "description": "To be deleted",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    delete_response = client.delete(f"/vm-classes/{class_id}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/vm-classes/{class_id}")
    assert get_response.status_code == 404

def test_delete_locked_vm_class(client):
    response = client.post("/vm-classes", json={
        "name": "Delete-Locked",
        "description": "Locked, cannot delete",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    lock_response = client.post(f"/vm-classes/{class_id}/lock", headers={"X-User-Role": "admin"})
    assert lock_response.status_code == 200

    delete_response = client.delete(f"/vm-classes/{class_id}")
    assert delete_response.status_code == 403
    assert "locked" in delete_response.json()["detail"].lower()

def test_lock_vm_class_non_admin(client):
    response = client.post("/vm-classes", json={
        "name": "NonAdmin-Lock",
        "description": "Test",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    lock_response = client.post(f"/vm-classes/{class_id}/lock", headers={"X-User-Role": "operator"})
    assert lock_response.status_code == 403

def test_unlock_vm_class_non_admin(client):
    response = client.post("/vm-classes", json={
        "name": "NonAdmin-Unlock",
        "description": "Test",
        "cpu_cores": 4,
        "memory_mb": 8192,
        "storage_gb": 200,
        "provisioning_type": "thin",
        "storage_policy": "Standard"
    })
    assert response.status_code == 201
    class_id = response.json()["id"]

    unlock_response = client.post(f"/vm-classes/{class_id}/unlock", headers={"X-User-Role": "operator"})
    assert unlock_response.status_code == 403
