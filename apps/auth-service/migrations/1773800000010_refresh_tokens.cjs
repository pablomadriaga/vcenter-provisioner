exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      refresh_token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      is_used BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);
};

exports.down = (pgm) => {
  pgm.dropTable('refresh_tokens');
};
