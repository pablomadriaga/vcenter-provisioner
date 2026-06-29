import path from 'path';
import { type Knex } from 'knex';

const config = {
  client: 'pg' as const,
  connection: process.env.DB_URL || 'postgresql://antigravity:password123@localhost:5432/vcenter_provisioner',
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './migrations',
    loadExtensions: ['.js', '.ts']
  },
  seeds: {
    directory: './seeds'
  },
};

export default config satisfies Knex.Config;
