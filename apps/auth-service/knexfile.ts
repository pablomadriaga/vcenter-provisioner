import type { Knex } from 'knex';

export default {
  client: 'pg',
  connection: process.env.DB_URL || 'postgresql://antigravity:password123@db:5432/vcenter_provisioner',
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations',
  },
} satisfies Knex.Config;
