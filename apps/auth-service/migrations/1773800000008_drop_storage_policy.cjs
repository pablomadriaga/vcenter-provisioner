/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Remove storage_policy column from vm_classes (it will be selected per-vcenter at VM creation time)
  pgm.sql(`ALTER TABLE vm_classes DROP COLUMN IF EXISTS storage_policy`);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE vm_classes ADD COLUMN storage_policy VARCHAR(100) NOT NULL DEFAULT 'Gold-Policy'`);
};
