/** @type {import('node-pg-migrate').MigrateConfig} */
module.exports = {
  db: {
    // Connection string - can also be set via DATABASE_URL env var
    connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  },
  // Migration files directory
  migrationsDir: 'migrations',
  // Table to store migration history
  migrationsTable: 'pgmigrations',
  // Schema (default: public)
  schema: 'public',
  // Direction: up or down
  direction: 'up',
};
