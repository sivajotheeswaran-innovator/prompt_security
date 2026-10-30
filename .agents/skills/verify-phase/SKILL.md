---
name: verify-phase
description: Run the app, execute acceptance checks, verify test passes/fails, fix any detected failures, and only report once all verification criteria are satisfied.
---

# Verify Phase Procedure

Follow this procedure after completing any feature or development phase:

1. **Start / Ensure Running Services**:
   - Check that the backend server starts without errors and connects to PostgreSQL.
   - Check that the frontend builds and/or serves without syntax/bundle errors.

2. **Execute Acceptance Checks**:
   - Run unit/integration tests or API endpoint checks (e.g. via curl / script).
   - Validate negative test cases (e.g., malformed inputs, edge cases).
   - Verify security rules from `docs/agent-rules.md`:
     - No raw sensitive data logged or stored in DB.
     - Redactions and masked previews adhere to specifications.
     - Structured JSON responses properly parsed with Zod.

3. **Evaluate Pass / Fail Status**:
   - Compile a clear list of each acceptance criteria tested with explicit Pass / Fail status.

4. **Self-Remediate Failures**:
   - If any check fails, do NOT report completion immediately.
   - Diagnose root causes, apply fixes, and re-run the verification suite until all checks pass.

5. **Report Results**:
   - Report the verified state, passing checks, and any recorded decisions in `docs/decisions.md`.
