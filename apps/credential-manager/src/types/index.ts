import { z } from 'zod';

export const ConnectionType = z.enum(['token', 'basic']);
export type ConnectionType = z.infer<typeof ConnectionType>;

export const VCenterConnectionSchema = z.object({
    id: z.number(),
    name: z.string().min(1).max(100),
    url: z.string().url().max(500),
    connection_type: ConnectionType,
    is_active: z.boolean(),
    default_datacenter: z.string().nullable().optional(),
    default_cluster: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const CreateVCenterConnectionSchema = z.object({
    name: z.string().min(1).max(100),
    url: z.string().url().max(500),
    connection_type: ConnectionType.default('token'),
    credential: z.string().min(1),
    default_datacenter: z.string().max(100).optional(),
    default_cluster: z.string().max(100).optional(),
});

export const UpdateVCenterConnectionSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().max(500).optional(),
    connection_type: ConnectionType.optional(),
    credential: z.string().min(1).optional(),
    default_datacenter: z.string().max(100).nullable().optional(),
    default_cluster: z.string().max(100).nullable().optional(),
    is_active: z.boolean().optional(),
});

export type VCenterConnection = z.infer<typeof VCenterConnectionSchema>;
export type CreateVCenterConnection = z.infer<typeof CreateVCenterConnectionSchema>;
export type UpdateVCenterConnection = z.infer<typeof UpdateVCenterConnectionSchema>;

export interface DecryptedConnection {
    id: number;
    name: string;
    url: string;
    connection_type: 'token' | 'basic';
    is_active: boolean;
    default_datacenter: string | null;
    default_cluster: string | null;
    created_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface TestConnectionResult {
    success: boolean;
    message: string;
    latency_ms?: number;
}
