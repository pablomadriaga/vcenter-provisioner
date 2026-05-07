import knex, { Knex } from 'knex';

let db: Knex | null = null;

export function getDb(): Knex {
    if (!db) {
        const connectionString = process.env.DB_URL;
        if (!connectionString) {
            throw new Error('DB_URL environment variable is required');
        }
        db = knex({
            client: 'pg',
            connection: connectionString,
            pool: { min: 2, max: 10 },
        });
    }
    return db;
}

export async function closeDb(): Promise<void> {
    if (db) {
        await db.destroy();
        db = null;
    }
}

export interface VCenterConnectionRow {
    id: number;
    name: string;
    url: string;
    connection_type: string;
    encrypted_credential: string;
    is_active: boolean;
    default_datacenter: string | null;
    default_cluster: string | null;
    created_by: number | null;
    created_at: Date;
    updated_at: Date;
}

export const VCenterConnectionRepository = {
    async findAll(activeOnly: boolean = true): Promise<VCenterConnectionRow[]> {
        const database = getDb();
        let query = database('vcenter_connections')
            .select('*')
            .orderBy('name', 'asc');

        if (activeOnly) {
            query = query.where('is_active', true);
        }

        return query;
    },

    async findById(id: number): Promise<VCenterConnectionRow | undefined> {
        const database = getDb();
        return database('vcenter_connections')
            .select('*')
            .where('id', id)
            .first();
    },

    async create(data: {
        name: string;
        url: string;
        connection_type: string;
        encrypted_credential: string;
        default_datacenter?: string | null;
        default_cluster?: string | null;
        created_by?: number;
    }): Promise<VCenterConnectionRow> {
        const database = getDb();
        const [result] = await database('vcenter_connections')
            .insert(data)
            .returning('*');
        return result;
    },

    async update(id: number, data: {
        name?: string;
        url?: string;
        connection_type?: string;
        encrypted_credential?: string;
        default_datacenter?: string | null;
        default_cluster?: string | null;
        is_active?: boolean;
    }): Promise<VCenterConnectionRow | undefined> {
        const database = getDb();
        const updateData = { ...data, updated_at: new Date() };
        const [result] = await database('vcenter_connections')
            .where('id', id)
            .update(updateData)
            .returning('*');
        return result;
    },

    async softDelete(id: number): Promise<boolean> {
        const database = getDb();
        const result = await database('vcenter_connections')
            .where('id', id)
            .update({ is_active: false, updated_at: new Date() });
        return result > 0;
    },

    async getEncryptedCredential(id: number): Promise<string | undefined> {
        const database = getDb();
        const result = await database('vcenter_connections')
            .select('encrypted_credential')
            .where('id', id)
            .first();
        return result?.encrypted_credential;
    },
};

export interface AuditRow {
    id: number;
    connection_id: number;
    action: string;
    performed_by: number | null;
    performed_at: Date;
    details: Record<string, unknown>;
}

export const AuditRepository = {
    async log(connection_id: number, action: string, performed_by: number, details?: Record<string, unknown>): Promise<void> {
        const database = getDb();
        await database('vcenter_credentials_audit').insert({
            connection_id,
            action,
            performed_by,
            details: details || {},
        });
    },

    async getByConnection(connection_id: number): Promise<AuditRow[]> {
        const database = getDb();
        return database('vcenter_credentials_audit')
            .select('*')
            .where('connection_id', connection_id)
            .orderBy('performed_at', 'desc');
    },
};
