-- Seed: Usuarios por defecto
-- Usuario: admin / password123

INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    -- bcrypt hash de 'password123' (cost=10)
    '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26',
    'admin'
)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;

-- Usuario operador de prueba / password123
INSERT INTO users (username, password_hash, role)
VALUES (
    'operator',
    '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26',
    'operator'
)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
