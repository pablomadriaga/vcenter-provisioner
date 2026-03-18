/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create vm_classes table (idempotent)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vm_classes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description VARCHAR(500),
      cpu_cores INTEGER NOT NULL,
      memory_mb INTEGER NOT NULL,
      storage_gb INTEGER NOT NULL,
      cpu_reservation_percent INTEGER DEFAULT 0,
      memory_reservation_percent INTEGER DEFAULT 0,
      provisioning_type VARCHAR(10) NOT NULL,
      storage_policy VARCHAR(100) NOT NULL,
      is_locked BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add check constraints (idempotent)
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (cpu_cores BETWEEN 1 AND 256)`);
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (memory_mb BETWEEN 512 AND 524288)`);
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (storage_gb BETWEEN 10 AND 10000)`);
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (cpu_reservation_percent BETWEEN 0 AND 100)`);
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (memory_reservation_percent BETWEEN 0 AND 100)`);
  pgm.sql(`ALTER TABLE vm_classes ADD CHECK (provisioning_type IN ('thin', 'thick'))`);

  // Create indexes (idempotent)
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vm_classes_active ON vm_classes(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vm_classes_locked ON vm_classes(is_locked)`);

  // Insert default vm_classes
  pgm.sql(`
    INSERT INTO vm_classes (name, description, cpu_cores, memory_mb, storage_gb, cpu_reservation_percent, memory_reservation_percent, provisioning_type, storage_policy, created_by) VALUES
    ('Gold', 'Alto rendimiento para producción', 8, 16384, 500, 50, 50, 'thick', 'Gold-Policy', 'system'),
    ('Silver', 'Balanceado para desarrollo', 4, 8192, 200, 25, 25, 'thin', 'Silver-Policy', 'system'),
    ('Bronze', 'Económico para testing', 2, 4096, 50, 0, 0, 'thin', 'Bronze-Policy', 'system'),
    ('Micro', 'Para servicios pequeños', 1, 512, 10, 0, 0, 'thin', 'Standard-Policy', 'system')
    ON CONFLICT (name) DO NOTHING
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('vm_classes');
};
