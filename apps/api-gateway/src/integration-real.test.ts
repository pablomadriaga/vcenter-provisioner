import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const TYPING_SERVICE_URL = process.env.TYPING_SERVICE_URL || 'http://localhost:8000';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8080';

describe('Integration Tests: Gateway ↔ Auth', () => {
    let authToken: string;
    let testUserId: string;

    test('should register a new user via Gateway', async () => {
        const response = await axios.post(`${GATEWAY_URL}/auth/register`, {
            username: `integrationtest_${Date.now()}`,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`,
            role: 'operator'
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('message');
        expect(response.data).toHaveProperty('user');
        expect(response.data.user).toHaveProperty('id');
    });

    test('should login with valid credentials via Gateway', async () => {
        const username = `integrationtest_login_${Date.now()}`;

        await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`,
            role: 'operator'
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data).toHaveProperty('token');
        expect(loginResponse.data).toHaveProperty('user');
        
        authToken = loginResponse.data.token;
        testUserId = loginResponse.data.user.id;
    });

    test('should verify token via Gateway', async () => {
        const response = await axios.get(`${GATEWAY_URL}/auth/verify`, {
            headers: { Authorization: authToken }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('valid');
        expect(response.data).toHaveProperty('payload');
        expect(response.data.payload).toHaveProperty('id');
        expect(response.data.payload).toHaveProperty('username');
    });

    test('should reject invalid token via Gateway', async () => {
        try {
            await axios.get(`${GATEWAY_URL}/auth/verify`, {
                headers: { Authorization: 'Bearer invalid-token-xyz123' }
            });
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.response.status).toBe(401);
        }
    });

    test('should reject request without token on protected route', async () => {
        try {
            await axios.get(`${GATEWAY_URL}/typing/health`);
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.response.status).toBe(401);
        }
    });
});

describe('Integration Tests: Gateway → Typing Service (with Auth)', () => {
    let authToken: string;

    beforeAll(async () => {
        const username = `integrationtest_typing_${Date.now()}`;

        const registerResponse = await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`,
            role: 'operator'
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        authToken = loginResponse.data.token;
    });

    test('should access typing service health check with valid token', async () => {
        const response = await axios.get(`${GATEWAY_URL}/typing/health`, {
            headers: { Authorization: authToken }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
    });

    test('should create a typification template via Gateway', async () => {
        const timestamp = Date.now();
        const response = await axios.post(`${GATEWAY_URL}/typing/templates`, {
            name: `Integration Test Template ${timestamp}`,
            description: 'Template created by integration tests',
            prefijo1: `TEST${timestamp.toString().slice(-3)}`,
            prefijo2: `INT${timestamp.toString().slice(-2)}`,
            seq_digits: 3
        }, {
            headers: { Authorization: authToken }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('prefijo1');
        expect(response.data).toHaveProperty('prefijo2');
    });

    test('should list templates via Gateway', async () => {
        const response = await axios.get(`${GATEWAY_URL}/typing/templates`, {
            headers: { Authorization: authToken }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
    });
});

describe('Integration Tests: Gateway → Orchestrator (with Auth)', () => {
    let authToken: string;
    let templateId: string;

    beforeAll(async () => {
        const username = `integrationtest_orch_${Date.now()}`;

        const registerResponse = await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`,
            role: 'operator'
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        authToken = loginResponse.data.token;

        const timestamp = Date.now();
        const templateResponse = await axios.post(`${GATEWAY_URL}/typing/templates`, {
            name: `Orchestrator Integration Template ${timestamp}`,
            description: 'Template for orchestrator integration tests',
            prefijo1: `ORCH${timestamp.toString().slice(-2)}`,
            prefijo2: `TST${timestamp.toString().slice(-3)}`,
            seq_digits: 3
        }, {
            headers: { Authorization: authToken }
        });

        templateId = templateResponse.data.id;
    });

    test('should access orchestrator status endpoint with valid token', async () => {
        try {
            const response = await axios.get(`${GATEWAY_URL}/provision/status/test-job-id`, {
                headers: { Authorization: authToken }
            });

            expect(response.status).toBe(404);
        } catch (error: any) {
            expect(error.response.status).toBe(404);
        }
    });

    test('should submit VM provisioning request via Gateway', async () => {
        const response = await axios.post(`${GATEWAY_URL}/provision/provision`, {
            template_id: templateId,
            manual_value: 'testvm',
            vcenter_datacenter: 'DC01',
            vcenter_cluster: 'Cluster01',
            vcenter_resource_pool: 'Resources',
            specs: {
                cpu: 2,
                ram: 4096,
                storage: 100
            }
        }, {
            headers: { Authorization: authToken }
        });

        expect(response.status).toBe(202);
        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('status');
        expect(response.data.status).toBe('PENDING');

        return response.data.id;
    });

    test('should poll job status via Gateway', async () => {
        const provisionResponse = await axios.post(`${GATEWAY_URL}/provision/provision`, {
            template_id: templateId,
            manual_value: 'pollvm',
            vcenter_datacenter: 'DC01',
            vcenter_cluster: 'Cluster01',
            vcenter_resource_pool: 'Resources'
        }, {
            headers: { Authorization: authToken }
        });

        const jobId = provisionResponse.data.id;

        await new Promise(resolve => setTimeout(resolve, 100));

        const statusResponse = await axios.get(`${GATEWAY_URL}/provision/status/${jobId}`, {
            headers: { Authorization: authToken }
        });

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.data).toHaveProperty('id');
        expect(statusResponse.data).toHaveProperty('status');
        expect(['PENDING', 'INFRA_CREATING', 'READY', 'FAILED']).toContain(statusResponse.data.status);
    });
});

describe('Integration Tests: Full End-to-End Flow', () => {
    test('should complete full flow: Register → Login → Create Template → Provision VM', async () => {
        const timestamp = Date.now();

        const registerResponse = await axios.post(`${GATEWAY_URL}/auth/register`, {
            username: `fullflow_${timestamp}`,
            password: 'TestPassword123!',
            email: `fullflow_${timestamp}@example.com`,
            role: 'operator'
        });

        expect(registerResponse.status).toBe(200);

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username: `fullflow_${timestamp}`,
            password: 'TestPassword123!'
        });

        expect(loginResponse.status).toBe(200);
        const authToken = loginResponse.data.token;

        const templateResponse = await axios.post(`${GATEWAY_URL}/typing/templates`, {
            name: `Full Flow Template ${timestamp}`,
            description: 'Template for full end-to-end flow test',
            prefijo1: `FULL${timestamp.toString().slice(-2)}`,
            prefijo2: `FLOW${timestamp.toString().slice(-3)}`,
            seq_digits: 4
        }, {
            headers: { Authorization: authToken }
        });

        expect(templateResponse.status).toBe(200);
        const templateId = templateResponse.data.id;

        const provisionResponse = await axios.post(`${GATEWAY_URL}/provision/provision`, {
            template_id: templateId,
            manual_value: 'fullvm',
            vcenter_datacenter: 'DC01',
            vcenter_cluster: 'Cluster01',
            vcenter_resource_pool: 'Resources',
            specs: {
                cpu: 1,
                ram: 2048,
                storage: 50
            }
        }, {
            headers: { Authorization: authToken }
        });

        expect(provisionResponse.status).toBe(202);
        expect(provisionResponse.data).toHaveProperty('id');
        const jobId = provisionResponse.data.id;

        await new Promise(resolve => setTimeout(resolve, 100));

        const statusResponse = await axios.get(`${GATEWAY_URL}/provision/status/${jobId}`, {
            headers: { Authorization: authToken }
        });

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.data).toHaveProperty('id');
        expect(statusResponse.data.id).toBe(jobId);
    });
});

describe('Integration Tests: Error Handling', () => {
    test('should handle authentication failure gracefully', async () => {
        try {
            await axios.get(`${GATEWAY_URL}/typing/templates`, {
                headers: { Authorization: 'Bearer invalid-token' }
            });
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.response.status).toBe(401);
            expect(error.response.data).toHaveProperty('error');
        }
    });

    test('should handle invalid provisioning request', async () => {
        const username = `errorhandling_${Date.now()}`;

        const registerResponse = await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `error_${Date.now()}@example.com`,
            role: 'operator'
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        const authToken = loginResponse.data.token;

        try {
            await axios.post(`${GATEWAY_URL}/provision/provision`, {
                template_id: 'non-existent-template-id',
                manual_values: {},
                vcenter_datacenter: 'DC01'
            }, {
                headers: { Authorization: authToken }
            });
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.response.status).toBe(400);
        }
    });
});

describe('Integration Tests: Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
        const username = `concurrent_${Date.now()}`;

        await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `concurrent_${Date.now()}@example.com`,
            role: 'operator'
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        const authToken = loginResponse.data.token;

        const timestamp = Date.now();
        const templateResponse = await axios.post(`${GATEWAY_URL}/typing/templates`, {
            name: `Concurrent Test Template ${timestamp}`,
            description: 'Template for concurrent request testing',
            prefijo1: `CONC${timestamp.toString().slice(-2)}`,
            prefijo2: `TST${timestamp.toString().slice(-3)}`,
            seq_digits: 3
        }, {
            headers: { Authorization: authToken }
        });

        const templateId = templateResponse.data.id;

        const requests = Array(5).fill(null).map((_, i) => 
            axios.post(`${GATEWAY_URL}/provision/provision`, {
                template_id: templateId,
                manual_value: `concurrent${i}`,
                vcenter_datacenter: 'DC01',
                vcenter_cluster: 'Cluster01',
                vcenter_resource_pool: 'Resources'
            }, {
                headers: { Authorization: authToken }
            })
        );

        const responses = await Promise.allSettled(requests);
        
        responses.forEach((response, i) => {
            if (response.status === 'fulfilled') {
                expect(response.value.status).toBe(202);
                expect(response.value.data).toHaveProperty('id');
            } else {
                expect(false).toBe(true);
            }
        });
    });
});
