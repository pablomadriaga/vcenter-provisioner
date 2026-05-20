exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vcenter_connections_active_name
    ON vcenter_connections(name)
    WHERE is_active = true
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_vcenter_connections_active_name`);
};
