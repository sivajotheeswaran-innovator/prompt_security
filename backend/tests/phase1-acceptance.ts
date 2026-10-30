import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { db } from '../src/config/db';
import http from 'http';

interface CheckResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

const results: CheckResult[] = [];

async function runCheck(
  name: string,
  expected: string,
  fn: () => Promise<{ actual: string; passed: boolean }>
) {
  try {
    const res = await fn();
    results.push({
      name,
      passed: res.passed,
      expected,
      actual: res.actual,
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      expected,
      actual: 'Exception thrown',
      error: err.message,
    });
  }
}

async function main() {
  console.log('\n=== Starting Phase 1 Acceptance Verification ===\n');

  // 1. Run migrations
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running on ${baseUrl}\n`);

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authToken = '';

  // Check 0: Health check
  await runCheck('GET /api/health returns { ok: true }', 'status: 200, { ok: true }', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json: any = await res.json();
    const passed = res.status === 200 && json.ok === true;
    return { actual: `status: ${res.status}, ${JSON.stringify(json)}`, passed };
  });

  // Check 1: Register new user (with auto-created default balanced policy)
  await runCheck(
    'POST /api/auth/register creates user and returns token',
    'status: 201, token and user returned',
    async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      const json: any = await res.json();
      const passed = res.status === 201 && !!json.token && json.user?.email === testEmail;
      return { actual: `status: ${res.status}, hasToken: ${!!json.token}, email: ${json.user?.email}`, passed };
    }
  );

  // Check 2: Login with correct credentials
  await runCheck(
    'POST /api/auth/login with valid credentials returns token',
    'status: 200, token returned',
    async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      const json: any = await res.json();
      authToken = json.token;
      const passed = res.status === 200 && !!authToken;
      return { actual: `status: ${res.status}, hasToken: ${!!authToken}`, passed };
    }
  );

  // Check 3: GET /api/policy with token returns 'balanced' (auto-created on register)
  await runCheck(
    "GET /api/policy with auth token returns mode 'balanced'",
    "status: 200, mode: 'balanced'",
    async () => {
      const res = await fetch(`${baseUrl}/api/policy`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json: any = await res.json();
      const passed = res.status === 200 && json.mode === 'balanced';
      return { actual: `status: ${res.status}, mode: '${json.mode}'`, passed };
    }
  );

  // Check 4: Login with wrong password returns 401
  await runCheck(
    'POST /api/auth/login with wrong password returns 401',
    'status: 401',
    async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword123' }),
      });
      const json: any = await res.json();
      const passed = res.status === 401;
      return { actual: `status: ${res.status}, error: ${json.error}`, passed };
    }
  );

  // Check 5: Invalid body returns 400 with Zod message
  await runCheck(
    'POST /api/auth/register with invalid body (password < 8 chars) returns 400 with Zod message',
    'status: 400, Zod validation message',
    async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad-email', password: 'short' }),
      });
      const json: any = await res.json();
      const passed = res.status === 400 && json.error === 'Validation failed' && Array.isArray(json.details);
      return {
        actual: `status: ${res.status}, error: ${json.error}, message: "${json.message}"`,
        passed,
      };
    }
  );

  // Check 6: Protected endpoint with no token returns 401
  await runCheck(
    'GET /api/policy without token returns 401 Unauthorized',
    'status: 401',
    async () => {
      const res = await fetch(`${baseUrl}/api/policy`);
      const json: any = await res.json();
      const passed = res.status === 401;
      return { actual: `status: ${res.status}, error: ${json.error}`, passed };
    }
  );

  // Check 7: PUT /api/policy updates mode to 'strict'
  await runCheck(
    "PUT /api/policy updates policy to 'strict'",
    "status: 200, mode: 'strict'",
    async () => {
      const res = await fetch(`${baseUrl}/api/policy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ mode: 'strict' }),
      });
      const json: any = await res.json();
      const passed = res.status === 200 && json.mode === 'strict';
      return { actual: `status: ${res.status}, mode: '${json.mode}'`, passed };
    }
  );

  // Check 8: PUT /api/policy with invalid mode returns 400 with Zod message
  await runCheck(
    'PUT /api/policy with invalid mode returns 400 with Zod message',
    'status: 400',
    async () => {
      const res = await fetch(`${baseUrl}/api/policy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ mode: 'super-strict' }),
      });
      const json: any = await res.json();
      const passed = res.status === 400 && json.error === 'Validation failed';
      return { actual: `status: ${res.status}, message: "${json.message}"`, passed };
    }
  );

  // Shutdown test server
  server.close();
  await db.end();

  // Print results table
  console.log('\n=== ACCEPTANCE TEST RESULTS ===\n');
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} | ${r.name}`);
    console.log(`       Expected: ${r.expected}`);
    console.log(`       Actual:   ${r.actual}`);
    if (r.error) {
      console.log(`       Error:    ${r.error}`);
    }
    if (!r.passed) allPassed = false;
  }

  console.log('\n================================');
  if (allPassed) {
    console.log('🎉 ALL PHASE 1 ACCEPTANCE CHECKS PASSED!');
    process.exit(0);
  } else {
    console.error('💥 SOME ACCEPTANCE CHECKS FAILED!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
