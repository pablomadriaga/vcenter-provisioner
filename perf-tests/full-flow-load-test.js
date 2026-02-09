import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const fullFlowErrors = new Rate('full_flow_errors');
const fullFlowLatency = new Trend('full_flow_latency');
const fullFlowCounter = new Counter('full_flow_total');

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '2m', target: 10 },     // Stay at 10 users
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 50 },     // Stay at 50 users
        { duration: '30s', target: 0 },     // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000'], // 95% of requests must complete below 2s
        'full_flow_errors': ['rate<0.1'],     // Error rate must be less than 10%
        'full_flow_latency': ['avg<1000'],    // Average latency must be below 1s
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export function setup() {
    // Register test user and create template
    const uniqueId = Math.floor(Math.random() * 1000000);
    const username = `fullflow_load_${uniqueId}`;
    const email = `fullflow_load_${uniqueId}@example.com`;
    
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
        name: `Full Flow Template ${uniqueId}`,
        description: 'Template for full flow load testing',
        segments: [
            { name: 'location', pattern: 'AR', required: true, example: 'AR' },
            { name: 'environment', pattern: 'FULL', required: true, example: 'FULL' },
            { name: 'application', pattern: 'TEST', required: true, example: 'TEST' },
            { name: 'role', pattern: 'BE', required: true, example: 'BE' }
        ]
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    
    const templateId = templateRes.json('id');
    
    return { username, templateId };
}

export default function(data) {
    const startTime = Date.now();
    let token;
    let success = true;
    
    // Step 1: Login
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username: data.username,
        password: 'LoadTest123!',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    if (!check(loginRes, { 'login successful': (r) => r.status === 200 })) {
        success = false;
    }
    
    token = loginRes.json('token');
    
    // Step 2: Verify token
    if (success) {
        const verifyRes = http.get(`${BASE_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!check(verifyRes, { 'verify successful': (r) => r.status === 200 })) {
            success = false;
        }
    }
    
    // Step 3: List templates
    if (success) {
        const templatesRes = http.get(`${BASE_URL}/typing/templates`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!check(templatesRes, { 'list templates successful': (r) => r.status === 200 })) {
            success = false;
        }
    }
    
    // Step 4: Submit provisioning request
    if (success) {
        const provisionRes = http.post(`${BASE_URL}/provision/provision`, JSON.stringify({
            template_id: data.templateId,
            manual_values: {
                location: 'AR',
                environment: 'FULL',
                application: 'TEST',
                role: 'BE'
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
        
        if (!check(provisionRes, { 'provision successful': (r) => r.status === 202 })) {
            success = false;
        }
        
        // Step 5: Check job status
        if (provisionRes.status === 202) {
            const jobId = provisionRes.json('job_id');
            sleep(0.1); // Brief pause to allow job processing
            
            const statusRes = http.get(`${BASE_URL}/provision/status/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            
            check(statusRes, { 'status check successful': (r) => r.status === 200 });
        }
    }
    
    const latency = Date.now() - startTime;
    fullFlowErrors.add(!success);
    fullFlowLatency.add(latency);
    fullFlowCounter.add(1);
    
    sleep(2);
}

export function teardown(data) {
    // Optional: Cleanup
}
