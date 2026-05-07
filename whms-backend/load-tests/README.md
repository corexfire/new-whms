# Load Testing Guide

## Tools Required

### k6 (Recommended)
Install: `brew install k6` (macOS) or `choco install k6` (Windows)

### Alternative: autocannon
```bash
npm install -g autocannon
```

## Running Load Tests

### 1. Full Load Test (50 concurrent users)
```bash
cd load-tests
k6 run load-test.js
```

### 2. Auth Endpoint Load Test
```bash
k6 run auth-load-test.js
```

### 3. Using autocannon
```bash
autocannon -c 50 -d 30 http://localhost:3001/api/health
```

## Environment Variables
```bash
BASE_URL=http://localhost:3001 k6 run load-test.js
```

## Expected Thresholds
- HTTP Request Duration P95 < 500ms
- HTTP Request Failed Rate < 1%
- Auth P99 < 1000ms

## Adding New Tests
Create new `*.js` files in `load-tests/` directory following k6 conventions.
