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
    ): Promise<DecryptedConnection> {
        const connection = await VCenterConnectionRepository.findById(id);
        if (!connection) {
            throw new Error('Connection not found');
        }

        const updateData: any = {
            name: data.name,
            url: data.url,
            default_datacenter: data.default_datacenter || null,
            default_cluster: data.default_cluster || null,
        };

        if (data.credential) {
            if (!data.credential.includes(':')) {
                throw new Error('Invalid credential format. Expected: username:password (or user@domain:password)');
            }
            updateData.encrypted_credential = this.credentialManager.encrypt(data.credential);
        }

        await VCenterConnectionRepository.update(id, updateData);

        await AuditRepository.log(id, 'updated', performedBy, {
            updates: updateData,
        });

        return this.mapToDecrypted(connection);
    }

    async deleteConnection(id: number, performedBy: number): Promise<boolean> {
        const connection = await VCenterConnectionRepository.findById(id);
        if (!connection) {
            return false;
        }

        await VCenterConnectionRepository.softDelete(id);
        await AuditRepository.log(id, 'deleted', performedBy, {});

        return true;
    }

    async testConnection(id: number, options: { allowInsecure?: boolean } = {}): Promise<TestConnectionResult> {
        // Validación de entrada
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
        const allowInsecure = options.allowInsecure || false;

        try {
            // 1. Importar módulos HTTPS para conexión segura
            const https = await import('node:https');
            
            // 2. Crear agente HTTPS con validación condicional
            const agent = new https.Agent({ 
                rejectUnauthorized: !allowInsecure 
            });

            // 3. Registrar uso de modo insecure para auditoría
            if (allowInsecure) {
                console.log(`WARNING: Insecure connection used for vCenter ID ${id} - cert validation bypassed`);
            }

            // 4. Paso 1: Obtener token de sesión
            const sessionToken = await this.getSessionToken(connection.url, base64Auth, agent);

            // 5. Paso 2: Probar conexión con token obtenido
            await this.testVCenterConnection(connection.url, sessionToken, agent);

            return {
                success: true,
                message: `Connection successful${allowInsecure ? ' (cert validation bypassed)' : ''}`,
                latency_ms: Date.now() - startTime,
            };
        } catch (error) {
            const latency = Date.now() - startTime;
            
            // Manejo específico de errores de timeout
            if (error instanceof Error && error.name === 'TimeoutError') {
                return {
                    success: false,
                    message: 'Connection timeout (10s)',
                    latency_ms: latency,
                };
            }
            
            // Manejo de errores HTTP específicos
            if (error instanceof Error && error.message.includes('HTTP')) {
                return {
                    success: false,
                    message: error.message,
                    latency_ms: latency,
                };
            }
            
            // Manejo de errores inesperados
            return {
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                latency_ms: latency,
            };
        }
    }

    private async getSessionToken(
        url: string, 
        base64Auth: string, 
        agent: any
    ): Promise<string> {
        const https = await import('node:https');
        return new Promise((resolve, reject) => {
            const sessionUrl = new URL(`${url}/api/session`);
            
            const req = https.request({
                hostname: sessionUrl.hostname,
                port: sessionUrl.port || 443,
                path: sessionUrl.pathname + sessionUrl.search,
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${base64Auth}`,
                    'Content-Type': 'application/json',
                },
                agent: agent,
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 201) {
                        try {
                            const token = JSON.parse(data);
                            resolve(token);
                        } catch (parseError: any) {
                            reject(new Error(`Failed to parse session token: ${parseError.message}`));
                        }
                    } else {
                        reject(new Error(`Failed to obtain session token: HTTP ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error: any) => {
                reject(new Error(`Connection failed: ${error.message}`));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Connection timeout (10s)'));
            });

            req.end();
        });
    }

    private async testVCenterConnection(
        baseUrl: string, 
        sessionToken: string, 
        agent: any
    ): Promise<void> {
        const https = await import('node:https');
        return new Promise((resolve, reject) => {
            const testUrl = new URL(`${baseUrl}/api/vcenter/vm`);
            
            const req = https.request({
                hostname: testUrl.hostname,
                port: testUrl.port || 443,
                path: testUrl.pathname + testUrl.search,
                method: 'GET',
                headers: {
                    'vmware-api-session-id': sessionToken,
                    'Content-Type': 'application/json',
                },
                agent: agent,
            }, (res: any) => {
                if (res.statusCode && (res.statusCode >= 200 && res.statusCode < 300)) {
                    resolve();
                } else {
                    reject(new Error(`Connection failed: HTTP ${res.statusCode}`));
                }
            });

            req.on('error', (error: any) => {
                reject(new Error(`Connection failed: ${error.message}`));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Connection timeout (10s)'));
            });

            req.end();
        });
    }

    async getAuditLog(connectionId: number) {
        return AuditRepository.getByConnection(connectionId);
    }

    async testConnectionWithCredentials(url: string, credential: string, options: { allowInsecure: boolean }): Promise<{ success: boolean; message: string }> {
        try {
            const https = await import('node:https');
            
            // Crear agente HTTPS
            const agent = new https.Agent({
                rejectUnauthorized: !options.allowInsecure
            });

            // Obtener token de sesión
            const sessionToken = await this.getSessionToken(url, credential, agent);
            
            // Probar conexión
            await this.testVCenterConnection(url, sessionToken, agent);
            
            // Registrar auditoría (opcional)
            console.log(`Connection test successful for ${url}`);
            
            return {
                success: true,
                message: `Conexión exitosa a ${url}`
            };
        } catch (error: any) {
            console.error(`Connection test failed for ${url}:`, error.message);
            return {
                success: false,
                message: error.message || 'Connection failed'
            };
        }
    }

    async getDatacenters(url: string, credential: string, options: { allowInsecure: boolean }): Promise<any[]> {
        try {
            const https = await import('node:https');
            
            // Crear agente HTTPS
            const agent = new https.Agent({
                rejectUnauthorized: !options.allowInsecure
            });

            // Obtener token de sesión
            const sessionToken = await this.getSessionToken(url, credential, agent);
            
            // Obtener datacenters
            return new Promise((resolve, reject) => {
                const testUrl = new URL(`${url}/api/vcenter/datacenter`);
                
                const req = https.request({
                    hostname: testUrl.hostname,
                    port: testUrl.port || 443,
                    path: testUrl.pathname + testUrl.search,
                    method: 'GET',
                    headers: {
                        'vmware-api-session-id': sessionToken,
                        'Content-Type': 'application/json',
                    },
                    agent: agent,
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const result = JSON.parse(data);
                                resolve(result.value || []);
                            } catch (parseError: any) {
                                reject(new Error(`Failed to parse datacenters: ${parseError.message}`));
                            }
                        } else {
                            reject(new Error(`Failed to get datacenters: HTTP ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', (error: any) => {
                    reject(new Error(`Connection failed: ${error.message}`));
                });

                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Connection timeout (10s)'));
                });

                req.end();
            });
        } catch (error: any) {
            console.error(`Failed to get datacenters from ${url}:`, error.message);
            throw error;
        }
    }

    async getClusters(url: string, credential: string, datacenter?: string, options: { allowInsecure: boolean } = { allowInsecure: false }): Promise<any[]> {
        try {
            const https = await import('node:https');
            
            // Crear agente HTTPS
            const agent = new https.Agent({
                rejectUnauthorized: !options.allowInsecure
            });

            // Obtener token de sesión
            const sessionToken = await this.getSessionToken(url, credential, agent);
            
            // Construir URL con filtro de datacenter si se proporciona
            let clusterUrl = `${url}/api/vcenter/cluster`;
            if (datacenter) {
                clusterUrl += `?datacenters=${encodeURIComponent(datacenter)}`;
            }
            
            // Obtener clusters
            return new Promise((resolve, reject) => {
                const testUrl = new URL(clusterUrl);
                
                const req = https.request({
                    hostname: testUrl.hostname,
                    port: testUrl.port || 443,
                    path: testUrl.pathname + (testUrl.search || ''),
                    method: 'GET',
                    headers: {
                        'vmware-api-session-id': sessionToken,
                        'Content-Type': 'application/json',
                    },
                    agent: agent,
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const result = JSON.parse(data);
                                resolve(result.value || []);
                            } catch (parseError: any) {
                                reject(new Error(`Failed to parse clusters: ${parseError.message}`));
                            }
                        } else {
                            reject(new Error(`Failed to get clusters: HTTP ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', (error: any) => {
                    reject(new Error(`Connection failed: ${error.message}`));
                });

                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Connection timeout (10s)'));
                });

                req.end();
            });
        } catch (error: any) {
            console.error(`Failed to get clusters from ${url}:`, error.message);
            throw error;
        }
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