import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const authErrors = new Rate('auth_errors');
const authLatency = new Trend('auth_latency');

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 10 },     // Stay at 10 users
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 50 },     // Stay at 50 users
        { duration: '30s', target: 0 },     // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
        'auth_errors': ['rate<0.1'],       // Error rate must be less than 10%
        'auth_latency': ['avg<300'],        // Average latency must be below 300ms
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export function setup() {
    // Register a test user for authentication
    const uniqueId = Math.floor(Math.random() * 1000000);
    const username = `loadtest_user_${uniqueId}`;
    const email = `loadtest_${uniqueId}@example.com`;
    
    const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
        username,
        password: 'LoadTest123!',
        email,
        role: 'operator'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(registerRes, {
        'registration successful': (r) => r.status === 200,
    });
    
    return { username };
}

export default function(data) {
    // Login with the registered user
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username: data.username,
        password: 'LoadTest123!',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    const success = check(loginRes, {
        'login successful': (r) => r.status === 200,
        'has token': (r) => r.json('token') !== undefined,
        'has user': (r) => r.json('user') !== undefined,
    });
    
    authErrors.add(!success);
    authLatency.add(loginRes.timings.duration);
    
    // Verify token
    if (success) {
        const token = loginRes.json('token');
        const verifyRes = http.get(`${BASE_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        check(verifyRes, {
            'verify successful': (r) => r.status === 200,
        });
    }
    
    sleep(1);
}

export function teardown(data) {
    // Optional: Cleanup test user
}
