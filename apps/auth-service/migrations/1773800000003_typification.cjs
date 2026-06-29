/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create typification_templates table (idempotent)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS typification_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      prefijo1 VARCHAR(50) DEFAULT 'SRV' NOT NULL,
      prefijo2 VARCHAR(50) DEFAULT 'DEV' NOT NULL,
      seq_digits INTEGER DEFAULT 3 NOT NULL,
      is_active BOOLEAN DEFAULT true,
      edit_reason VARCHAR(255),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create typification_counters table (idempotent)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS typification_counters (
      template_id INTEGER REFERENCES typification_templates(id) PRIMARY KEY,
      current_value INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default templates
  pgm.sql(`
    INSERT INTO typification_templates (name, description, prefijo1, prefijo2, seq_digits, created_by) VALUES
    ('Servidores de Producción', 'Plantilla para VMs de producción', 'PROD', 'SRV', 4, (SELECT id FROM users WHERE username = 'admin')),
    ('Servidores de Desarrollo', 'Plantilla para VMs de desarrollo', 'DEV', 'SRV', 3, (SELECT id FROM users WHERE username = 'admin')),
    ('Bases de Datos', 'Plantilla para VMs de bases de datos', 'PROD', 'DB', 4, (SELECT id FROM users WHERE username = 'admin')),
    ('Testing QA', 'Plantillas para testing de QA', 'QA', 'TEST', 3, (SELECT id FROM users WHERE username = 'admin'))
    ON CONFLICT (name) DO NOTHING
  `);

  // Initialize counters for templates
  pgm.sql(`
    INSERT INTO typification_counters (template_id, current_value)
    SELECT id, 0 FROM typification_templates
    ON CONFLICT (template_id) DO NOTHING
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('typification_counters');
  pgm.dropTable('typification_templates');
};
