exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      jti TEXT PRIMARY KEY,
      blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)`);
};

exports.down = (pgm) => {
  pgm.dropTable('token_blacklist');
};
