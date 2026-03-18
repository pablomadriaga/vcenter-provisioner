import { CredentialManager } from './credentialManager.js';
import { VCenterConnectionRepository, AuditRepository, VCenterConnectionRow } from './database.js';
import {
    CreateVCenterConnection,
    UpdateVCenterConnection,
    DecryptedConnection,
    TestConnectionResult,
} from '../types/index.js';

export class VCenterConfigService {
    private credentialManager: CredentialManager;

    constructor(masterKey: string) {
        this.credentialManager = new CredentialManager(masterKey);
    }

    async listConnections(activeOnly: boolean = true): Promise<DecryptedConnection[]> {
        const connections = await VCenterConnectionRepository.findAll(activeOnly);
        return connections.map((conn: VCenterConnectionRow) => this.mapToDecrypted(conn));
    }

    async getConnection(id: number): Promise<DecryptedConnection | null> {
        const connection = await VCenterConnectionRepository.findById(id);
        if (!connection) return null;
        return this.mapToDecrypted(connection);
    }

    async createConnection(
        data: CreateVCenterConnection & { credential: string },
        performedBy: number
    ): Promise<DecryptedConnection> {
        if (!data.credential.includes(':')) {
            throw new Error('Invalid credential format. Expected: username:password (or user@domain:password)');
        }

        const encrypted = this.credentialManager.encrypt(data.credential);

        const connection = await VCenterConnectionRepository.create({
            name: data.name,
            url: data.url,
            connection_type: 'basic',
            encrypted_credential: encrypted,
            default_datacenter: data.default_datacenter || null,
            default_cluster: data.default_cluster || null,
            created_by: performedBy,
        });

        await AuditRepository.log(connection.id, 'created', performedBy, {
            name: data.name,
            url: data.url,
        });

        return this.mapToDecrypted(connection);
    }

    async updateConnection(
        id: number,
        data: UpdateVCenterConnection & { credential?: string },
        performedBy: number
    ): Promise<DecryptedConnection | null> {
        if (data.credential && !data.credential.includes(':')) {
            throw new Error('Invalid credential format. Expected: username:password (or user@domain:password)');
        }

        const updateData: any = { ...data };
        if (data.credential) {
            updateData.encrypted_credential = this.credentialManager.encrypt(data.credential);
        }

        const connection = await VCenterConnectionRepository.update(id, updateData);
        if (!connection) return null;

        await AuditRepository.log(connection.id, 'updated', performedBy, {
            name: connection.name,
            updated_fields: Object.keys(data),
        });

        return this.mapToDecrypted(connection);
    }

    async deleteConnection(id: number, performedBy: number): Promise<boolean> {
        const connection = await VCenterConnectionRepository.findById(id);
        if (!connection) return false;

        const deleted = await VCenterConnectionRepository.softDelete(id);
        if (deleted) {
            await AuditRepository.log(id, 'deactivated', performedBy, {
                name: connection.name,
            });
        }

        return deleted;
    }

    async testConnection(id: number): Promise<TestConnectionResult> {
        const connection = await VCenterConnectionRepository.findById(id);
        if (!connection) {
            return { success: false, message: 'Connection not found' };
        }

        const encrypted = await VCenterConnectionRepository.getEncryptedCredential(id);
        if (!encrypted) {
            return { success: false, message: 'No credential stored' };
        }

        const credential = this.credentialManager.decrypt(encrypted);

        if (!credential.includes(':')) {
            return {
                success: false,
                message: 'Invalid credential format. Expected: username:password (or user@domain:password)',
            };
        }

        const base64Auth = Buffer.from(credential).toString('base64');
        const startTime = Date.now();

        try {
            const response = await fetch(`${connection.url}/rest/com/vmware/cis`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${base64Auth}`,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            });

            const latency = Date.now() - startTime;

            if (response.ok || response.status === 401) {
                return {
                    success: true,
                    message: 'Connection successful (authenticated)',
                    latency_ms: latency,
                };
            }

            return {
                success: false,
                message: `Connection failed: ${response.statusText}`,
                latency_ms: latency,
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'TimeoutError') {
                return {
                    success: false,
                    message: 'Connection timeout (10s)',
                };
            }
            return {
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    async getAuditLog(connectionId: number) {
        return AuditRepository.getByConnection(connectionId);
    }

    private mapToDecrypted(conn: VCenterConnectionRow): DecryptedConnection {
        return {
            id: conn.id,
            name: conn.name,
            url: conn.url,
            connection_type: conn.connection_type as 'token' | 'basic',
            is_active: conn.is_active,
            default_datacenter: conn.default_datacenter,
            default_cluster: conn.default_cluster,
            created_by: conn.created_by,
            created_at: conn.created_at.toISOString(),
            updated_at: conn.updated_at.toISOString(),
        };
    }
}

export const createVCenterConfigService = (masterKey: string) => {
    return new VCenterConfigService(masterKey);
};
