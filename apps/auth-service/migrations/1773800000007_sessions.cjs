exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      is_active BOOLEAN DEFAULT true NOT NULL
    )
  `);
  
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active)`);
};

exports.down = (pgm) => {
  pgm.dropTable('sessions');
};
