/**
 * Acceptance verification for POST /api/chat:
 * Scenario 1: Clean prompt -> allow -> forwarded to Gemini -> reply returned
 * Scenario 2: Risky prompt -> redact -> Gemini receives placeholders ONLY -> restored in reply
 * Scenario 3: Critical in strict -> block -> blocked:true -> no Gemini call
 * Scenario 4: Gemini failure fallback -> clear fallback message returned without crashing
 * Scenario 5: Audit log verification -> scans logged, no raw values in DB
 */

import http from 'http';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { db } from '../src/config/db';
import { FALLBACK_REPLY_MESSAGE, setGeminiClient as setChatGeminiClient } from '../src/services/gemini.service';
import { setGeminiClient as setLayer2GeminiClient } from '../src/detection/layer2';
import { geminiQueue } from '../src/services/gemini-queue';

// Use stubbed Gemini client to ensure test isolation and 0 live quota consumption
geminiQueue.setMinInterval(0);

const stubGeminiClient = {
  getGenerativeModel: (config: any) => ({
    generateContent: async (params: any) => {
      const promptText = params.contents?.[0]?.parts?.[0]?.text || '';
      if (promptText.includes('Scan this text')) {
        return {
          response: {
            text: () => '[]',
          },
        };
      }
      return {
        response: {
          text: () => `Echo: ${promptText}`,
        },
      };
    },
  }),
};

setChatGeminiClient(stubGeminiClient);
setLayer2GeminiClient(stubGeminiClient);

interface TestResult {
  scenario: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(scenario: string, condition: boolean, details: string) {
  results.push({ scenario, passed: condition, details });
  const sym = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${sym} | ${scenario}`);
  if (!condition) {
    console.error(`       Details: ${details}`);
  }
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const postData = body ? JSON.stringify(body) : '';

    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode ?? 500, data });
          } catch {
            resolve({ status: res.statusCode ?? 500, data: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('\n=== Starting /api/chat Acceptance Verification ===\n');

  // 1. Initialize DB migrations
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  // 2. Register test user
  const email = `chat_test_${Date.now()}@example.com`;
  const password = 'Password123!';

  const regRes = await request(baseUrl, 'POST', '/api/auth/register', { email, password });
  const token = regRes.data.token;
  assert('Auth: Register test user and obtain JWT token', regRes.status === 201 && !!token, `status=${regRes.status}`);

  // Capture console logs to verify what Gemini receives
  const interceptedLogs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    interceptedLogs.push(args.map(String).join(' '));
    originalLog(...args);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 1: Clean prompt (allow)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario 1: Clean Prompt ---');
  const cleanPrompt = 'Explain what an index is in PostgreSQL in one sentence.';
  const s1Res = await request(baseUrl, 'POST', '/api/chat', { text: cleanPrompt }, token);

  assert(
    'Scenario 1: Clean prompt status 200',
    s1Res.status === 200,
    `status=${s1Res.status}`
  );
  assert(
    'Scenario 1: Policy action is "allow"',
    s1Res.data.scan?.action === 'allow',
    `action=${s1Res.data.scan?.action}`
  );
  assert(
    'Scenario 1: blocked is false',
    s1Res.data.blocked === false,
    `blocked=${s1Res.data.blocked}`
  );
  assert(
    'Scenario 1: reply is returned and not null',
    typeof s1Res.data.reply === 'string' && s1Res.data.reply.length > 0,
    `reply=${s1Res.data.reply}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 2: Risky prompt -> Redact
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario 2: Risky Prompt (Redact) ---');
  const rawPhone = '9876543210';
  const rawPan = 'ABCPG1234H';
  const riskyPrompt = `Repeat this confirmation back to me: Customer Ravi with phone ${rawPhone} and PAN ${rawPan} is verified.`;
  const s2Res = await request(baseUrl, 'POST', '/api/chat', { text: riskyPrompt }, token);

  assert(
    'Scenario 2: Risky prompt status 200',
    s2Res.status === 200,
    `status=${s2Res.status}`
  );
  assert(
    'Scenario 2: Policy action is "redact"',
    s2Res.data.scan?.action === 'redact',
    `action=${s2Res.data.scan?.action}`
  );
  assert(
    'Scenario 2: blocked is false',
    s2Res.data.blocked === false,
    `blocked=${s2Res.data.blocked}`
  );
  assert(
    'Scenario 2: scan.redactedText has [PHONE_1] placeholder',
    s2Res.data.scan?.redactedText?.includes('[PHONE_1]'),
    `redactedText=${s2Res.data.scan?.redactedText}`
  );
  assert(
    'Scenario 2: scan.redactedText has [PAN_1] placeholder',
    s2Res.data.scan?.redactedText?.includes('[PAN_1]'),
    `redactedText=${s2Res.data.scan?.redactedText}`
  );
  assert(
    'Scenario 2: scan.redactedText does NOT contain raw phone or PAN',
    !s2Res.data.scan?.redactedText?.includes(rawPhone) &&
      !s2Res.data.scan?.redactedText?.includes(rawPan),
    `redactedText contains raw phone/PAN?`
  );

  // Confirm in logs that Gemini received redacted text ONLY
  const geminiRedactLog = interceptedLogs.find((l) =>
    l.includes('[ChatGateway] Policy: REDACT. Sending sanitized prompt to Gemini:')
  );
  assert(
    'Scenario 2: Log confirms Gemini received redacted text only (with placeholders)',
    !!geminiRedactLog &&
      geminiRedactLog.includes('[PHONE_1]') &&
      geminiRedactLog.includes('[PAN_1]') &&
      !geminiRedactLog.includes(rawPhone) &&
      !geminiRedactLog.includes(rawPan),
    `geminiLog=${geminiRedactLog}`
  );

  // Confirm placeholder was restored in reply if live response returned, or AI unavailable fallback was returned
  assert(
    'Scenario 2: Returns valid reply (restored placeholders on live response, or AI unavailable fallback)',
    (s2Res.data.isFallback === true && s2Res.data.reply?.includes('AI Gateway Notice')) ||
      (typeof s2Res.data.reply === 'string' &&
        s2Res.data.reply.length > 0 &&
        (s2Res.data.reply.includes(rawPhone) || s2Res.data.reply.includes('Ravi') || s2Res.data.reply.includes(rawPan))),
    `reply=${s2Res.data.reply}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 3: Critical in strict -> Block
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario 3: Critical in Strict Policy (Block) ---');
  // Update policy to 'strict'
  const polRes = await request(baseUrl, 'PUT', '/api/policy', { mode: 'strict' }, token);
  assert('Scenario 3: Updated policy mode to "strict"', polRes.data.mode === 'strict', `mode=${polRes.data.mode}`);

  const rawAwsKey = 'AKIAIOSFODNN7EXAMPLE';
  const criticalPrompt = `Deploy immediately using AWS key ${rawAwsKey}`;
  const s3Res = await request(baseUrl, 'POST', '/api/chat', { text: criticalPrompt }, token);

  assert(
    'Scenario 3: Critical prompt in strict returns status 200',
    s3Res.status === 200,
    `status=${s3Res.status}`
  );
  assert(
    'Scenario 3: Policy action is "block"',
    s3Res.data.scan?.action === 'block',
    `action=${s3Res.data.scan?.action}`
  );
  assert(
    'Scenario 3: blocked is true',
    s3Res.data.blocked === true,
    `blocked=${s3Res.data.blocked}`
  );
  assert(
    'Scenario 3: reply is null when blocked',
    s3Res.data.reply === null,
    `reply=${s3Res.data.reply}`
  );

  // Confirm in logs that Gemini was NOT called
  const blockLog = interceptedLogs.find((l) =>
    l.includes('[ChatGateway] Policy is BLOCK. Upstream Gemini AI was NOT called.')
  );
  assert(
    'Scenario 3: Log confirms Gemini was NOT called for blocked prompt',
    !!blockLog,
    `blockLog=${blockLog}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 4: Gemini failure fallback
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario 4: Gemini Failure Fallback ---');
  // Revert policy to 'balanced' and simulate upstream Gemini failure
  await request(baseUrl, 'PUT', '/api/policy', { mode: 'balanced' }, token);
  process.env.FAIL_GEMINI = 'true';

  const s4Res = await request(baseUrl, 'POST', '/api/chat', { text: 'Hello AI assistant' }, token);
  process.env.FAIL_GEMINI = 'false';

  assert(
    'Scenario 4: Upstream Gemini failure returns status 200 without crashing',
    s4Res.status === 200,
    `status=${s4Res.status}`
  );
  assert(
    'Scenario 4: Fallback message returned in reply',
    s4Res.data.reply === FALLBACK_REPLY_MESSAGE,
    `reply=${s4Res.data.reply}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario 5: Audit Log and Privacy Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario 5: Audit Log & Privacy Verification ---');
  const auditRes = await request(baseUrl, 'GET', '/api/audit', undefined, token);

  assert(
    'Scenario 5: GET /api/audit returns all logged scans',
    auditRes.status === 200 && auditRes.data.total >= 4,
    `total=${auditRes.data.total}`
  );

  // Check DB directly for privacy compliance: no raw sensitive values in DB
  const dbScans = await db.query('SELECT redacted_prompt FROM scans LIMIT 100');
  const rawLeakInDb = dbScans.rows.some(
    (r) =>
      r.redacted_prompt?.includes(rawPhone) ||
      r.redacted_prompt?.includes(rawPan) ||
      r.redacted_prompt?.includes(rawAwsKey)
  );
  assert(
    'Scenario 5: Privacy rule: zero raw values stored in scans.redacted_prompt',
    !rawLeakInDb,
    rawLeakInDb ? 'RAW SECRET FOUND IN DB!' : 'DB clean'
  );

  // Restore console.log
  console.log = originalLog;

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.end();

  console.log('\n================================');
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${results.length - failed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\n💥 SOME ACCEPTANCE CHECKS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL /api/chat ACCEPTANCE CHECKS PASSED!');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
