/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create vcenter_connections table (idempotent)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vcenter_connections (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      url VARCHAR(500) NOT NULL,
      connection_type VARCHAR(20) DEFAULT 'token' NOT NULL,
      encrypted_credential TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      default_datacenter VARCHAR(100),
      default_cluster VARCHAR(100),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create vcenter_credentials_audit table (idempotent)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vcenter_credentials_audit (
      id SERIAL PRIMARY KEY,
      connection_id INTEGER REFERENCES vcenter_connections(id),
      action VARCHAR(50) NOT NULL,
      performed_by INTEGER REFERENCES users(id),
      performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      details JSONB
    )
  `);

  // Add indexes (idempotent)
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vcenter_connections_active ON vcenter_connections(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vcenter_audit_connection ON vcenter_credentials_audit(connection_id)`);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('vcenter_credentials_audit');
  pgm.dropTable('vcenter_connections');
};
