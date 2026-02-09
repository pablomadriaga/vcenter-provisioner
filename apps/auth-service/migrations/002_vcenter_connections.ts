import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('vcenter_connections', (table) => {
        table.increments('id').primary();
        table.string('name', 100).notNullable();
        table.string('url', 500).notNullable();
        table.string('connection_type', 20).notNullable().defaultTo('token');
        table.text('encrypted_credential').notNullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.string('default_datacenter', 100);
        table.string('default_cluster', 100);
        table.integer('created_by').references('users.id');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('vcenter_credentials_audit', (table) => {
        table.increments('id').primary();
        table.integer('connection_id').references('vcenter_connections.id');
        table.string('action', 50).notNullable();
        table.integer('performed_by').references('users.id');
        table.timestamp('performed_at').defaultTo(knex.fn.now());
        table.jsonb('details');
    });

    await knex.schema.table('vcenter_connections', (table) => {
        table.index(['is_active'], 'idx_vcenter_connections_active');
    });
    await knex.schema.table('vcenter_credentials_audit', (table) => {
        table.index(['connection_id'], 'idx_vcenter_audit_connection');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('vcenter_credentials_audit');
    await knex.schema.dropTableIfExists('vcenter_connections');
}
