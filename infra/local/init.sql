-- vCenter Provisioner: Minimal Initial Schema
-- Purpose: Solo usuarios mínimos para inicialización
-- NOTA: El schema completo está en migraciones (node-pg-migrate)

-- =============================================================================
-- USUARIOS BÁSICOS (mínimo necesario)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'operator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usuario admin por defecto (password: password123)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'admin')
ON CONFLICT (username) DO NOTHING;
