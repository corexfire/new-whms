import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_DURATION = '30s';
const VUS = 50;

export const options = {
    stages: [
        { duration: '10s', target: VUS },
        { duration: TEST_DURATION, target: VUS },
        { duration: '10s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

const getHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

export function setup() {
    const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: 'admin@whms.com', password: 'admin123' }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    const body = JSON.parse(loginRes.body);
    return { token: body.accessToken };
}

export default function (data) {
    const headers = getHeaders(data.token);

    http.get(`${BASE_URL}/api/items`, { headers });

    http.get(`${BASE_URL}/api/inventory/summary`, { headers });

    http.get(`${BASE_URL}/api/monitoring/dashboard`, { headers });

    http.get(`${BASE_URL}/api/coa`, { headers });

    sleep(1);
}

export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: '', enableColors: true }),
    };
}

function textSummary(data, opts) {
    const indent = opts.indent || '';
    const enableColors = opts.enableColors || false;

    let output = `${indent}Load Test Summary\n`;
    output += `${indent}==================\n\n`;
    output += `${indent}Duration: ${data.metrics.http_req_duration.values.dur}\n`;
    output += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    output += `${indent}Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
    output += `${indent}Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    output += `${indent}P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;

    return output;
}
