import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const provisionErrors = new Rate('provision_errors');
const provisionLatency = new Trend('provision_latency');
const provisionCounter = new Counter('provision_total');

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 10 },     // Stay at 10 users
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 50 },     // Stay at 50 users
        { duration: '30s', target: 0 },     // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<1000'], // 95% of requests must complete below 1s
        'provision_errors': ['rate<0.05'],     // Error rate must be less than 5%
        'provision_latency': ['avg<500'],      // Average latency must be below 500ms
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export function setup() {
    // Register test user and create template
    const uniqueId = Math.floor(Math.random() * 1000000);
    const username = `provision_load_${uniqueId}`;
    const email = `provision_load_${uniqueId}@example.com`;
    
    // Register user
    const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
        username,
        password: 'LoadTest123!',
        email,
        role: 'operator'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    // Login to get token
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username,
        password: 'LoadTest123!',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    const token = loginRes.json('token');
    
    // Create template
    const templateRes = http.post(`${BASE_URL}/typing/templates`, JSON.stringify({
        name: `Load Test Template ${uniqueId}`,
        description: 'Template for load testing',
        segments: [
            { name: 'location', pattern: 'AR', required: true, example: 'AR' },
            { name: 'environment', pattern: 'LOAD', required: true, example: 'LOAD' },
            { name: 'application', pattern: 'TEST', required: true, example: 'TEST' },
            { name: 'role', pattern: 'API', required: true, example: 'API' }
        ]
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    
    const templateId = templateRes.json('id');
    
    return { username, token, templateId };
}

export default function(data) {
    // Login to get fresh token
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username: data.username,
        password: 'LoadTest123!',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    const token = loginRes.json('token');
    
    // Submit provisioning request
    const provisionRes = http.post(`${BASE_URL}/provision/provision`, JSON.stringify({
        template_id: data.templateId,
        manual_values: {
            location: 'AR',
            environment: 'LOAD',
            application: 'TEST',
            role: 'API'
        },
        vcenter_datacenter: 'DC01',
        vcenter_cluster: 'Cluster01',
        vcenter_resource_pool: 'Resources',
        specs: {
            cpu: 1,
            memory_mb: 1024,
            disk_gb: 20
        }
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    
    const success = check(provisionRes, {
        'provision successful': (r) => r.status === 202,
        'has job_id': (r) => r.json('job_id') !== undefined,
        'status is pending': (r) => r.json('status') === 'pending',
    });
    
    provisionErrors.add(!success);
    provisionLatency.add(provisionRes.timings.duration);
    provisionCounter.add(1);
    
    sleep(1);
}

export function teardown(data) {
    // Optional: Cleanup
}
