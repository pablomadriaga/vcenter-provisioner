import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = 'https://vc-ui.playground.net';
const MONITORING_SVC = 'http://monitoring-service:8082';

const errorRate = new Rate('errors');

const PROBE_PAYLOADS = [
  { source: 'k6-test', target: 'api-gateway', latency_ms: 2, status: 'up' },
  { source: 'k6-test', target: 'auth-service', latency_ms: 5, status: 'up' },
  { source: 'k6-test', target: 'typing-service', latency_ms: 3, status: 'up' },
  { source: 'k6-test', target: 'vm-orchestrator', latency_ms: 15, status: 'up' },
  { source: 'k6-test', target: 'vcenter-operations', latency_ms: 8, status: 'up' },
  { source: 'k6-test', target: 'credential-manager', latency_ms: 1, status: 'up' },
  { source: 'k6-test', target: 'stats-service', latency_ms: 4, status: 'up' },
  { source: 'k6-test', target: 'provisioner-ui', latency_ms: 0, status: 'up' },
];

export let options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<200'],
  },
};

export function setup() {
  let loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username: 'admin',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login success': (r) => r.status === 200 });
  let token = loginRes.json('token');

  let healthRes = http.get(`${BASE_URL}/dashboard/monitoring/services-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(healthRes, { 'services-status reachable': (r) => r.status === 200 });

  return { token };
}

export default function (data) {
  const payload = PROBE_PAYLOADS[__VU % PROBE_PAYLOADS.length];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  let res;

  res = http.post(`${MONITORING_SVC}/api/probe-result`, JSON.stringify({
    ...payload,
    error_message: payload.status === 'down' ? 'Connection refused' : '',
    timestamp: now,
  }), { headers: { 'Content-Type': 'application/json' } });

  let success = check(res, {
    'probe stored (2xx)': (r) => r.status >= 200 && r.status < 300,
  });

  if (!success) {
    console.error(`FAIL: ${payload.target} -> ${res.status} ${res.body}`);
  }
  errorRate.add(!success);

  sleep(0.5);
}

export function teardown(data) {
  let loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username: 'admin',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  let token = loginRes.json('token');

  let statusRes = http.get(`${BASE_URL}/dashboard/monitoring/services-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(statusRes, { 'final status check': (r) => r.status === 200 });

  if (statusRes.status === 200) {
    let services = statusRes.json();
    let unknownCount = services.filter(s => s.status === 'unknown').length;
    console.log(`Services unknown after test: ${unknownCount}/${services.length}`);
    check(unknownCount, {
      'zero unknown services': (v) => v === 0,
    });
  }
}
