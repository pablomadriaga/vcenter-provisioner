exports.up = (pgm) => {
  // 1. FK: custom_charts.user_id → users.id (CASCADE — si se borra usuario, sus charts tambien)
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_custom_charts_user_id') THEN
        ALTER TABLE custom_charts ADD CONSTRAINT fk_custom_charts_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  // 2. FK: provision_logs.vm_class_id → vm_classes.id (SET NULL — el log se conserva aunque se borre la clase)
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_provision_logs_vm_class_id') THEN
        ALTER TABLE provision_logs ADD CONSTRAINT fk_provision_logs_vm_class_id
          FOREIGN KEY (vm_class_id) REFERENCES vm_classes(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 3. FK: provision_logs.vcenter_id → vcenter_connections.id (SET NULL)
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_provision_logs_vcenter_id') THEN
        ALTER TABLE provision_logs ADD CONSTRAINT fk_provision_logs_vcenter_id
          FOREIGN KEY (vcenter_id) REFERENCES vcenter_connections(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 4. vm_classes.created_by VARCHAR → created_by_id INTEGER FK (ON DELETE SET NULL)
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vm_classes' AND column_name = 'created_by_id'
      ) THEN
        ALTER TABLE vm_classes ADD COLUMN created_by_id INTEGER
          REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  pgm.sql(`
    UPDATE vm_classes
    SET created_by_id = (SELECT id FROM users WHERE username = 'admin')
    WHERE created_by_id IS NULL
  `);
  pgm.sql(`ALTER TABLE vm_classes DROP COLUMN IF EXISTS created_by`);

  // 5. CHECK constraint en users.role — valores conocidos
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_role') THEN
        ALTER TABLE users ADD CONSTRAINT ck_users_role
          CHECK (role IN ('administrator', 'admin', 'operator'));
      END IF;
    END $$;
  `);

  // 6. Dropear tablas de knex — vestigio de migration system anterior
  pgm.sql(`DROP TABLE IF EXISTS knex_migrations_lock`);
  pgm.sql(`DROP TABLE IF EXISTS knex_migrations`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE custom_charts DROP CONSTRAINT IF EXISTS fk_custom_charts_user_id`);
  pgm.sql(`ALTER TABLE provision_logs DROP CONSTRAINT IF EXISTS fk_provision_logs_vm_class_id`);
  pgm.sql(`ALTER TABLE provision_logs DROP CONSTRAINT IF EXISTS fk_provision_logs_vcenter_id`);
  pgm.sql(`ALTER TABLE vm_classes DROP CONSTRAINT IF EXISTS vm_classes_created_by_id_fkey`);
  pgm.sql(`ALTER TABLE vm_classes ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)`);
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role`);
};
