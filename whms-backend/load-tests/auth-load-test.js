import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
    scenarios: {
        auth_test: {
            executor: 'constant-vus',
            vus: 20,
            duration: '20s',
        },
    },
    thresholds: {
        http_req_duration: ['p(99)<1000'],
        http_req_failed: ['rate<0.05'],
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

    const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: 'admin@whms.com', password: 'admin123' }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    check(loginRes, {
        'login status 200': (r) => r.status === 200,
        'has access token': (r) => JSON.parse(r.body).accessToken !== undefined,
    });

    sleep(0.5);
}

export function handleSummary(data) {
    return {
        stdout: `Auth Load Test Results\n${'='.repeat(40)}\nAuth Requests/sec: ${data.metrics.http_reqs.values.rate.toFixed(2)}\n`,
    };
}
