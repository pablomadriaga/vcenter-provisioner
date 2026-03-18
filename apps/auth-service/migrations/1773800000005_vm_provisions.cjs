/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create vm_provisions table (idempotent)
  pgm.sql(`
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes (idempotent)
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_provisions_status ON vm_provisions(status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_provisions_requester ON vm_provisions(requester_id)`);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('vm_provisions');
};
