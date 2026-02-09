-- vCenter Provisioner: Initial Schema (Staff Grade)
-- Generated: 2026-02-04
-- Purpose: Base de datos limpia para desarrollo local

-- =============================================================================
-- 1. USUARIOS Y AUTENTICACIÓN
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'operator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usuario admin por defecto (password: password123)
-- Hash bcrypt generado con cost=10
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'admin')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

-- Usuario operador de prueba (password: operator123)
INSERT INTO users (username, password_hash, role) VALUES
('operator', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'operator')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

-- Usuario operador de prueba con email (password: operator123)
INSERT INTO users (username, password_hash, role) VALUES
('operator@antigravity.local', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'operator')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

-- Usuario operador de prueba (password: operator123)
INSERT INTO users (username, password_hash, role) VALUES
('operator', '$2b$12$91pMqjE7J7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F', 'operator')
ON CONFLICT (username) DO NOTHING;

-- Usuario operador de prueba (password: operator123)
INSERT INTO users (username, password_hash, role) VALUES
('operator@antigravity.local', '$2b$12$91pMqjE7J7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F', 'operator')
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- 2. TIPIFICACIÓN (TP-Haki Motor)
-- =============================================================================

CREATE TABLE IF NOT EXISTS typification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    prefijo1 VARCHAR(50) NOT NULL DEFAULT 'SRV',
    prefijo2 VARCHAR(50) NOT NULL DEFAULT 'DEV',
    seq_digits INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    edit_reason VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contador para segmentos secuenciales (por template)
CREATE TABLE IF NOT EXISTS typification_counters (
    template_id INTEGER REFERENCES typification_templates(id) PRIMARY KEY,
    current_value INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Templates de ejemplo
INSERT INTO typification_templates (name, description, prefijo1, prefijo2, seq_digits, created_by) VALUES
('Servidores de Producción', 'Plantilla para VMs de producción', 'PROD', 'SRV', 4, 1),
('Servidores de Desarrollo', 'Plantilla para VMs de desarrollo', 'DEV', 'SRV', 3, 1),
('Bases de Datos', 'Plantilla para VMs de bases de datos', 'PROD', 'DB', 4, 1),
('Testing QA', 'Plantillas para testing de QA', 'QA', 'TEST', 3, 1)
ON CONFLICT (name) DO NOTHING;

-- Inicializar contadores para los templates
INSERT INTO typification_counters (template_id, current_value)
SELECT id, 0 FROM typification_templates
ON CONFLICT (template_id) DO NOTHING;

-- =============================================================================
-- 3. CLASES DE VMs (FLAVORS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS vm_classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    cpu_cores INTEGER NOT NULL CHECK (cpu_cores BETWEEN 1 AND 256),
    memory_mb INTEGER NOT NULL CHECK (memory_mb BETWEEN 512 AND 524288),
    storage_gb INTEGER NOT NULL CHECK (storage_gb BETWEEN 10 AND 10000),
    cpu_reservation_percent INTEGER DEFAULT 0 CHECK (cpu_reservation_percent BETWEEN 0 AND 100),
    memory_reservation_percent INTEGER DEFAULT 0 CHECK (memory_reservation_percent BETWEEN 0 AND 100),
    provisioning_type VARCHAR(10) NOT NULL CHECK (provisioning_type IN ('thin', 'thick')),
    storage_policy VARCHAR(100) NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- VM Classes por defecto
INSERT INTO vm_classes (name, description, cpu_cores, memory_mb, storage_gb, cpu_reservation_percent, memory_reservation_percent, provisioning_type, storage_policy, created_by) VALUES
('Gold', 'Alto rendimiento para producción', 8, 16384, 500, 50, 50, 'thick', 'Gold-Policy', 'system'),
('Silver', 'Balanceado para desarrollo', 4, 8192, 200, 25, 25, 'thin', 'Silver-Policy', 'system'),
('Bronze', 'Económico para testing', 2, 4096, 50, 0, 0, 'thin', 'Bronze-Policy', 'system'),
('Micro', 'Para servicios pequeños', 1, 512, 10, 0, 0, 'thin', 'Standard-Policy', 'system')
ON CONFLICT (name) DO NOTHING;

-- Índices para VM Classes
CREATE INDEX IF NOT EXISTS idx_vm_classes_active ON vm_classes(is_active);
CREATE INDEX IF NOT EXISTS idx_vm_classes_locked ON vm_classes(is_locked);

-- =============================================================================
-- 4. PROVISIÓN DE VMs (AUDIT & STATE)
-- =============================================================================

CREATE TABLE IF NOT EXISTS vm_provisions (
    id SERIAL PRIMARY KEY,
    vm_name VARCHAR(255) UNIQUE NOT NULL,
    template_id INTEGER REFERENCES typification_templates(id),
    requester_id INTEGER REFERENCES users(id),
    vcenter_datacenter VARCHAR(100),
    vcenter_cluster VARCHAR(100),
    vcenter_resource_pool VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    specs JSONB,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para monitoreo y estadísticas
CREATE INDEX IF NOT EXISTS idx_provisions_status ON vm_provisions(status);
CREATE INDEX IF NOT EXISTS idx_provisions_requester ON vm_provisions(requester_id);

-- =============================================================================
-- 5. AUDIT LOG (OPCIONAL - PARA FUTURO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =============================================================================
-- NOTAS
-- =============================================================================
-- Para modificar la contraseña del admin:
-- UPDATE users SET password_hash = '$2b$12$...' WHERE username = 'admin@antigravity.local';
--
-- Para agregar nuevos usuarios manualmente:
-- INSERT INTO users (username, password_hash, role) VALUES ('user@domain.com', '$2b$12$...', 'operator');
