import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from './server.js';
import db from './db.js';

// Add at least one test to prevent empty test file failure
describe('Integration Test Suite', () => {
    test('test framework setup', () => {
        expect(true).toBe(true);
    });
});

let server: FastifyInstance;

beforeAll(async () => {
    server = await createServer();
    await server.ready();
});

afterAll(async () => {
    await server.close();
});

describe('Auth Service Integration Tests', () => {
    beforeAll(async () => {
        // Clean up test users before running tests
        const dbInstance = db;
        await dbInstance('users').where({ username: 'testuser' }).del();
        await dbInstance('users').where({ username: 'duplicate' }).del();
        await dbInstance('users').where({ username: 'validuser' }).del();
        await dbInstance('users').where({ username: 'invaliduser' }).del();
        await dbInstance('users').where({ username: 'testauth' }).del();
        await dbInstance('users').where({ username: 'missinguser' }).del();
        await dbInstance('users').where({ username: 'emptypassword' }).del();
        await dbInstance('users').where({ username: 'testuser2' }).del();
        await dbInstance('users').where({ username: 'concurrent1' }).del();
        await dbInstance('users').where({ username: 'concurrent2' }).del();
    });
    describe('GET /health', () => {
        test('should return 200 with status ok', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ status: 'ok' });
        });
    });

    describe('POST /register', () => {
        test('should register a new user successfully', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'testuser',
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.message).toBe('User registered');
            expect(body.user).toHaveProperty('id');
            expect(body.user.username).toBe('testuser');
            expect(body.user.role).toBe('operator');
        });

        test('should reject duplicate username', async () => {
            // Register first time
            await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'duplicate',
                    password: 'password123',
                },
            });

            // Try registering again
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'duplicate',
                    password: 'password456',
                },
            });

            expect(response.statusCode).toBe(409);
            expect(response.json().error).toBe('Username already exists');
        });

        test('should reject invalid password (too short)', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'validuser',
                    password: '123', // Less than 6 chars
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should reject invalid username (too short)', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'ab', // Less than 3 chars
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });
    });

    describe('POST /login', () => {
        beforeAll(async () => {
            // Seed a user for login tests
            await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'loginuser',
                    password: 'mypassword',
                },
            });
        });

        test('should login with valid credentials', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: 'loginuser',
                    password: 'mypassword',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.token).toBeDefined();
            expect(typeof body.token).toBe('string');
            expect(body.user.username).toBe('loginuser');
        });

        test('should reject invalid password', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: 'loginuser',
                    password: 'wrongpassword',
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid credentials');
        });

        test('should reject non-existent user', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: 'nonexistent',
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid credentials');
        });
    });

    describe('POST /verify', () => {
        let validToken: string;

        beforeAll(async () => {
            // Get a valid token
            const loginResponse = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: 'loginuser',
                    password: 'mypassword',
                },
            });
            validToken = loginResponse.json().token;
        });

        test('should verify valid JWT token', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/verify',
                payload: {
                    token: validToken,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.valid).toBe(true);
            expect(body.payload).toHaveProperty('username');
            expect(body.payload.username).toBe('loginuser');
        });

        test('should reject invalid token', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/verify',
                payload: {
                    token: 'invalid.jwt.token',
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid or expired token');
        });

        test('should reject expired token', async () => {
            // Create a token that's already expired (exp in the past)
            const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

            const response = await server.inject({
                method: 'POST',
                url: '/verify',
                payload: {
                    token: expiredToken,
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid or expired token');
        });

        test('should reject missing token in Authorization header', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/verify',
                headers: {
                    'Authorization': 'Bearer ',
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('No token provided');
        });
    });

    describe('GET /', () => {
        test('should return service info message', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/',
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.message).toBe('vCenter Provisioner: Identity & Auth Service active.');
        });
    });

    describe('POST /register - additional validation', () => {
        test('should reject missing username', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should reject missing password', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: 'validuser',
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should reject empty payload', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {},
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });
    });

    describe('POST /login - additional validation', () => {
        test('should reject missing username', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should reject missing password', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: 'validuser',
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should reject empty payload', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {},
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().error).toBe('Invalid input');
        });

        test('should handle JSON parse error', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                headers: {
                    'Content-Type': 'application/json',
                },
                payload: 'invalid json',
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('POST /register - extra fields', () => {
        test('should accept extra fields without error', async () => {
            const username = `extrauser-${Date.now()}`;
            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username,
                    password: 'password123',
                    extra_field: 'ignored',
                    another_field: 123,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.message).toBe('User registered');
        });
    });

    describe('End-to-End Login Flow', () => {
        let registeredUsername: string;
        let registeredPassword: string;

        test('register new user', async () => {
            registeredUsername = `e2euser-${Date.now()}`;
            registeredPassword = 'e2epassword123';

            const response = await server.inject({
                method: 'POST',
                url: '/register',
                payload: {
                    username: registeredUsername,
                    password: registeredPassword,
                },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().message).toBe('User registered');
        });

        test('login with registered credentials', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: registeredUsername,
                    password: registeredPassword,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.token).toBeDefined();
            expect(typeof body.token).toBe('string');
            expect(body.user.username).toBe(registeredUsername);
        });

        test('verify the received token', async () => {
            const loginResponse = await server.inject({
                method: 'POST',
                url: '/login',
                payload: {
                    username: registeredUsername,
                    password: registeredPassword,
                },
            });

            const { token } = loginResponse.json();

            const verifyResponse = await server.inject({
                method: 'POST',
                url: '/verify',
                payload: { token },
            });

            expect(verifyResponse.statusCode).toBe(200);
            const verifyBody = verifyResponse.json();
            expect(verifyBody.valid).toBe(true);
            expect(verifyBody.payload.username).toBe(registeredUsername);
        });
    });

    describe('Token Expiration', () => {
        test('should reject expired token', async () => {
            const jwt = await import('jsonwebtoken');
            const expiredToken = jwt.sign(
                { id: 999, username: 'expireduser', role: 'operator' },
                'test-secret',
                { expiresIn: '-1h' } // Expired 1 hour ago
            );

            const response = await server.inject({
                method: 'POST',
                url: '/verify',
                payload: { token: expiredToken },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid or expired token');
        });
    });

    describe('Concurrent Login Requests', () => {
        test('should handle multiple concurrent login requests', async () => {
            // Register multiple users
            const usernames: string[] = [];
            for (let i = 0; i < 5; i++) {
                const username = `concurrentuser-${Date.now()}-${i}`;
                usernames.push(username);
                await server.inject({
                    method: 'POST',
                    url: '/register',
                    payload: { username, password: 'password123' },
                });
            }

            // Concurrent login requests
            const loginPromises = usernames.map(username =>
                server.inject({
                    method: 'POST',
                    url: '/login',
                    payload: { username, password: 'password123' },
                })
            );

            const responses = await Promise.all(loginPromises);

            // All should succeed
            responses.forEach((response, index) => {
                expect(response.statusCode).toBe(200);
                const body = response.json();
                expect(body.token).toBeDefined();
                expect(body.user.username).toBe(usernames[index]);
            });
        });
    });

    describe('Password Hashing Integration', () => {
        test('should hash password during registration', async () => {
            const username = `hashuser-${Date.now()}`;
            const plainPassword = 'plainpassword123';

            await server.inject({
                method: 'POST',
                url: '/register',
                payload: { username, password: plainPassword },
            });

            // Login should verify hashed password
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: { username, password: plainPassword },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.token).toBeDefined();
        });

        test('should not match different password', async () => {
            const username = `nomatchuser-${Date.now()}`;

            await server.inject({
                method: 'POST',
                url: '/register',
                payload: { username, password: 'originalpassword' },
            });

            // Try to login with different password
            const response = await server.inject({
                method: 'POST',
                url: '/login',
                payload: { username, password: 'differentpassword' },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().error).toBe('Invalid credentials');
        });
    });
});

