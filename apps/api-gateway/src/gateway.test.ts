import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { createServer } from './index.js';

vi.mock('axios');
const mockedAxios = axios as any;

describe('API Gateway Integration Tests', () => {
    let server: any;

    const AUTH_SERVICE_URL = 'http://auth-service:3001';

    beforeAll(async () => {
        server = await createServer({ logger: false });
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Health Check', () => {
        test('GET /health should return 200 with status ok', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ status: 'ok', service: 'gateway' });
        });

        test('GET / should return gateway info message', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/',
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                message: 'vCenter Provisioner: API Gateway (Staff Grade) active.'
            });
        });
    });

    describe('CORS Headers', () => {
        test('should include CORS headers in response', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.headers['access-control-allow-origin']).toBe('*');
        });
    });

    describe('JWT Authentication Middleware', () => {
        test('should reject request without Authorization header', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/typing/health',
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).toEqual({
                error: 'Unauthorized',
                details: 'Invalid or missing token'
            });
        });

        test('should reject request with invalid token', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Invalid token'));

            const response = await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer invalid-token'
                }
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).toEqual({
                error: 'Unauthorized',
                details: 'Invalid or missing token'
            });
        });

        test('should call auth service to verify token', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'admin' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${AUTH_SERVICE_URL}/verify`,
                { headers: { Authorization: 'Bearer valid-token' } }
            );
        });

        test('should attach user info from auth service to request', async () => {
            const mockUser = { id: 1, username: 'admin', role: 'admin' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: { authorization: 'Bearer admin-token' }
            });

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${AUTH_SERVICE_URL}/verify`,
                { headers: { Authorization: 'Bearer admin-token' } }
            );
        });
    });

    describe('Protected Routes Configuration', () => {
        test('should have typing service routes configured', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalled();
        });

        test('should have orchestrator routes configured', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/provision/status/test-job',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${AUTH_SERVICE_URL}/verify`,
                { headers: { Authorization: 'Bearer valid-token' } }
            );
        });
    });

    describe('Error Handling', () => {
        test('should return 404 for non-existent routes', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/non-existent-route',
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('Concurrent Requests', () => {
        test('should handle concurrent requests with authentication', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            const requests = [
                server.inject({
                    method: 'GET',
                    url: '/typing/health',
                    headers: { authorization: 'Bearer token1' }
                }),
                server.inject({
                    method: 'GET',
                    url: '/provision/status/job1',
                    headers: { authorization: 'Bearer token2' }
                }),
                server.inject({
                    method: 'GET',
                    url: '/typing/health',
                    headers: { authorization: 'Bearer token3' }
                })
            ];

            const responses = await Promise.all(requests);

            expect(mockedAxios.get).toHaveBeenCalledTimes(3);
        });
    });

    describe('Authorization Header Handling', () => {
        test('should handle Authorization header without Bearer prefix', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${AUTH_SERVICE_URL}/verify`,
                { headers: { Authorization: 'valid-token' } }
            );
        });

        test('should handle Authorization header with Bearer prefix', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${AUTH_SERVICE_URL}/verify`,
                { headers: { Authorization: 'Bearer valid-token' } }
            );
        });
    });

    describe('Authentication Error Scenarios', () => {
        test('should handle network errors when calling auth service', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            const response = await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).toEqual({
                error: 'Unauthorized',
                details: 'Invalid or missing token'
            });
        });

        test('should handle timeout errors when calling auth service', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Timeout'));

            const response = await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('Middleware Execution', () => {
        test('should execute authentication middleware before protected routes', async () => {
            const mockUser = { id: 1, username: 'testuser', role: 'operator' };
            mockedAxios.get.mockResolvedValue({
                data: { decoded: mockUser }
            });

            await server.inject({
                method: 'GET',
                url: '/typing/health',
                headers: {
                    authorization: 'Bearer valid-token'
                }
            });

            expect(mockedAxios.get).toHaveBeenCalled();
        });
    });
});
