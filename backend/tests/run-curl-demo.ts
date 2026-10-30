import http from 'http';
import { execSync } from 'child_process';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { db } from '../src/config/db';

async function main() {
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  const port = 5050;
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });

  console.log(`[Demo Server] Listening on http://127.0.0.1:${port}`);

  // 1. Register a test user
  const email = `curl_user_${Date.now()}@test.com`;
  const regCmd = `curl.exe -s -X POST http://127.0.0.1:${port}/api/auth/register -H "Content-Type: application/json" -d "{\\"email\\":\\"${email}\\",\\"password\\":\\"Password123!\\"}"`;
  const regRaw = execSync(regCmd, { encoding: 'utf-8' });
  const regJson = JSON.parse(regRaw);
  const token = regJson.token;
  console.log(`[Auth] Registered user: ${email}`);

  console.log('\n======================================================');
  console.log('SCENARIO 1: Clean prompt (Policy: Balanced -> Allow)');
  console.log('======================================================');
  const curl1 = `curl.exe -s -X POST http://127.0.0.1:${port}/api/chat -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"text\\":\\"Explain what an index is in PostgreSQL in one sentence.\\"}"`;
  console.log(`> Command:\n${curl1}\n`);
  const out1 = execSync(curl1, { encoding: 'utf-8' });
  console.log('> Output:');
  console.log(JSON.stringify(JSON.parse(out1), null, 2));

  console.log('\n======================================================');
  console.log('SCENARIO 2: Risky prompt (Policy: Balanced -> Redact)');
  console.log('======================================================');
  const curl2 = `curl.exe -s -X POST http://127.0.0.1:${port}/api/chat -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"text\\":\\"Please contact customer Ravi at 9876543210 (PAN: ABCPG1234H) regarding project alpha.\\"}"`;
  console.log(`> Command:\n${curl2}\n`);
  const out2 = execSync(curl2, { encoding: 'utf-8' });
  console.log('> Output:');
  console.log(JSON.stringify(JSON.parse(out2), null, 2));

  console.log('\n======================================================');
  console.log('SCENARIO 3: Critical in strict (Policy: Strict -> Block)');
  console.log('======================================================');
  // First switch policy to 'strict'
  const curlPutPol = `curl.exe -s -X PUT http://127.0.0.1:${port}/api/policy -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"mode\\":\\"strict\\"}"`;
  execSync(curlPutPol, { encoding: 'utf-8' });
  console.log('> Policy updated to "strict"');

  const curl3 = `curl.exe -s -X POST http://127.0.0.1:${port}/api/chat -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"text\\":\\"Deploy immediately using AWS key AKIAIOSFODNN7EXAMPLE\\"}"`;
  console.log(`> Command:\n${curl3}\n`);
  const out3 = execSync(curl3, { encoding: 'utf-8' });
  console.log('> Output:');
  console.log(JSON.stringify(JSON.parse(out3), null, 2));

  console.log('\n======================================================');
  console.log('SCENARIO 4: Fallback Verification (Upstream Failure)');
  console.log('======================================================');
  process.env.FAIL_GEMINI = 'true';
  const curl4 = `curl.exe -s -X POST http://127.0.0.1:${port}/api/chat -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"text\\":\\"Can you help me summarize this report?\\"}"`;
  console.log(`> Command:\n${curl4}\n`);
  const out4 = execSync(curl4, { encoding: 'utf-8' });
  console.log('> Output:');
  console.log(JSON.stringify(JSON.parse(out4), null, 2));
  process.env.FAIL_GEMINI = 'false';

  console.log('\n======================================================');
  console.log('AUDIT LOG VERIFICATION (Scans Persisted & Fully Masked)');
  console.log('======================================================');
  const curlAudit = `curl.exe -s -X GET "http://127.0.0.1:${port}/api/audit?limit=10" -H "Authorization: Bearer ${token}"`;
  const auditRaw = execSync(curlAudit, { encoding: 'utf-8' });
  const auditJson = JSON.parse(auditRaw);
  console.log(`Total Scans Logged: ${auditJson.total}`);
  console.log('Sample audit items (showing redactedPrompt stored):');
  for (const item of auditJson.items) {
    console.log(`- Scan ID: ${item.id} | Action: ${item.action} | Score: ${item.riskScore} | Stored Prompt: "${item.redactedPrompt}"`);
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.end();
  console.log('\n[Demo] Completed successfully.');
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
