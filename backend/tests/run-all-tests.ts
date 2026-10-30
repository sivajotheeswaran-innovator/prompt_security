/**
 * Unified Test Runner for TrustLayer
 * Executes all test suites sequentially and exits with code 0 only if all pass.
 * Suites:
 * - Phase 1: Foundation & Authentication Acceptance
 * - Phase 2: Detection Engine & Generic Secrets (45+ checks)
 * - Phase 3: /api/chat Gateway Lifecycle (Clean, Redact, Block, Fallback)
 * - Live: Real Gemini Semantic Detection & Database Auditing
 */

import { spawn } from 'child_process';
import path from 'path';

interface Suite {
  name: string;
  file: string;
}

const suites: Suite[] = [
  { name: 'Phase 1: Foundation & Auth Acceptance', file: 'tests/phase1-acceptance.ts' },
  { name: 'Phase 2: Detection Engine & Generic Secrets', file: 'tests/phase2-detection.ts' },
  { name: 'Phase 3: Chat Gateway End-to-End', file: 'tests/chat-acceptance.ts' },
  { name: 'Phase 4: Gemini Usage Reduction & Optimization', file: 'tests/unit-gemini-reduction.ts' },
];

async function runSuite(suite: Suite): Promise<boolean> {
  console.log(`\n================================================================`);
  console.log(`🚀 RUNNING SUITE: ${suite.name}`);
  console.log(`================================================================\n`);

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, ['tsx', suite.file], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: suite.file.includes('live') ? 'development' : 'test',
      },
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ SUITE PASSED: ${suite.name}\n`);
        resolve(true);
      } else {
        console.error(`\n❌ SUITE FAILED (exit code ${code}): ${suite.name}\n`);
        resolve(false);
      }
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║               TrustLayer Test Suite Orchestrator             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  let passed = 0;
  for (const s of suites) {
    const ok = await runSuite(s);
    if (!ok) {
      console.error(`\n💥 STOPPING: ${s.name} encountered errors.`);
      process.exit(1);
    }
    passed++;
  }

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${passed} TEST SUITES PASSED ENTIRELY!`);
  console.log(`================================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test orchestrator error:', err);
  process.exit(1);
});
