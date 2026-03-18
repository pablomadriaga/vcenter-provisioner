/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create users table if not exists (idempotent - handles init.sql creating it first)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) DEFAULT 'operator' NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default users (password: password123 for admin, operator123 for others)
  pgm.sql(`
    INSERT INTO users (username, password_hash, role) VALUES
    ('admin', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'admin'),
    ('operator', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'operator'),
    ('operator@antigravity.local', '$2b$10$Efr3JR3Lt9qzceoBlZ9d1efJE8C7xf0nWxjaw2XRmrFAfepwyxe26', 'operator')
    ON CONFLICT (username) DO NOTHING
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('users');
};
