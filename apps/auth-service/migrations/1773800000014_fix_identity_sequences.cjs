exports.up = (pgm) => {
  pgm.sql(`
    DO $$ DECLARE
      rec RECORD;
      seq_name TEXT;
      max_id BIGINT;
    BEGIN
      FOR rec IN
        SELECT c.table_schema, c.table_name
        FROM information_schema.columns c
        JOIN pg_class t ON t.relname = c.table_name
        JOIN pg_namespace n ON n.nspname = c.table_schema AND n.oid = t.relnamespace
        WHERE c.is_identity = 'YES' AND c.column_name = 'id'
      LOOP
        seq_name := pg_get_serial_sequence(
          rec.table_schema || '.' || rec.table_name, 'id');
        IF seq_name IS NULL THEN
          RAISE NOTICE 'Skipped %.%: no sequence found', rec.table_schema, rec.table_name;
          CONTINUE;
        END IF;
        EXECUTE format('SELECT MAX(id) FROM %I.%I', rec.table_schema, rec.table_name) INTO max_id;
        IF max_id IS NOT NULL AND max_id > 0 THEN
          EXECUTE format('SELECT setval(%L, %s)', seq_name, max_id);
          RAISE NOTICE 'Fixed %: setval(%) → nextval = %', seq_name, max_id, max_id + 1;
        ELSE
          RAISE NOTICE 'Skipped %: empty table, identity starts at 1', seq_name;
        END IF;
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Nothing to revert — sequences cannot be "un-fixed"
};
