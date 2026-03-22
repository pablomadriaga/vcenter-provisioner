import { describe, test, expect } from 'vitest';
import axios from 'axios';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

describe('PROXY TEST: /auth/me endpoint routing', () => {
    test('TEST 1: Auth service /me works directly', async () => {
        const username = `proxytest_direct_${Date.now()}`;

        await axios.post(`${AUTH_SERVICE_URL}/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`
        });

        const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/login`, {
            username,
            password: 'TestPassword123!'
        }, {
            withCredentials: true
        });

        expect(loginResponse.status).toBe(200);
        const cookies = loginResponse.headers['set-cookie'];
        console.log('Auth service login cookies:', cookies);
    });

    test('TEST 2: Gateway /auth/me should return user (PROXY TEST)', async () => {
        const username = `proxytest_gateway_${Date.now()}`;

        await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        }, {
            withCredentials: true
        });

        expect(loginResponse.status).toBe(200);
        const cookies = loginResponse.headers['set-cookie'];
        console.log('Gateway login cookies:', cookies);
        console.log('Cookie jar:', loginResponse.request.jar);

        // Now test /auth/me with the cookie
        try {
            const meResponse = await axios.get(`${GATEWAY_URL}/auth/me`, {
                withCredentials: true
            });
            console.log('/auth/me response:', meResponse.status, meResponse.data);
            expect(meResponse.status).toBe(200);
            expect(meResponse.data).toHaveProperty('user');
        } catch (error: any) {
            console.log('/auth/me FAILED:', error.response?.status, error.response?.data);
            console.log('Request URL was:', error.config?.url);
            throw error;
        }
    });

    test('TEST 3: Gateway /auth/verify with session cookie', async () => {
        const username = `proxytest_verify_${Date.now()}`;

        await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        }, {
            withCredentials: true
        });

        // Test /auth/verify with POST (session cookie)
        try {
            const verifyResponse = await axios.post(`${GATEWAY_URL}/auth/verify`, 
                {},
                {
                    withCredentials: true
                }
            );
            console.log('/auth/verify (POST with cookie) response:', verifyResponse.status, verifyResponse.data);
            expect(verifyResponse.status).toBe(200);
        } catch (error: any) {
            console.log('/auth/verify FAILED:', error.response?.status, error.response?.data);
            throw error;
        }
    });

    test('TEST 4: Gateway /auth/verify with Bearer token', async () => {
        const username = `proxytest_bearer_${Date.now()}`;

        await axios.post(`${GATEWAY_URL}/auth/register`, {
            username,
            password: 'TestPassword123!',
            email: `test_${Date.now()}@example.com`
        });

        const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
            username,
            password: 'TestPassword123!'
        });

        const token = loginResponse.data.token;

        // Test /auth/verify with Bearer token
        try {
            const verifyResponse = await axios.get(`${GATEWAY_URL}/auth/verify`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('/auth/verify (Bearer) response:', verifyResponse.status, verifyResponse.data);
            expect(verifyResponse.status).toBe(200);
        } catch (error: any) {
            console.log('/auth/verify (Bearer) FAILED:', error.response?.status, error.response?.data);
            throw error;
        }
    });
});
