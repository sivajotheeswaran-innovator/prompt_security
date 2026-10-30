## Tables
users(id uuid pk, email unique, password_hash, created_at)
policies(user_id fk unique, mode text check in ('strict','balanced','relaxed'), updated_at)
scans(id uuid pk, user_id fk, risk_score int, action text check in ('allow','redact','block'), categories jsonb, ai_layer_ok bool, latency_ms int, redacted_prompt text NOT NULL, created_at)
findings(id uuid pk, scan_id fk, type text, masked_preview text, start_idx int, end_idx int, confidence real, source text check in ('regex','ai'), severity text, explanation text)
(No raw prompt or raw values are stored. scans.redacted_prompt stores the FULLY masked text for every scan regardless of action — even 'allow' scans store the redacted version for audit integrity.)

## API (all under /api, JSON, JWT Bearer except auth+health)
POST /auth/register {email,password(min 8)} -> {token,user}
POST /auth/login -> {token,user}
GET  /health -> {ok:true}
GET  /policy ; PUT /policy {mode}
POST /scan {text(max 8000)} -> {scanId,riskScore,action,findings[],redactedText,aiLayerOk}
POST /chat {text} -> {scan:{...same as above}, reply|null, blocked:bool}
GET  /audit?limit&offset&action&type -> {items[],total}
GET  /stats -> {totalScans,blocked,redacted,allowed,avgRisk,byCategory[],riskOverTime[]}

## Infrastructure
- app.set('trust proxy', 1) — required for accurate rate-limit IP tracking behind Supabase/reverse proxies.
- DATABASE_URL uses the Supabase transaction pooler connection string (port 6543). pg pool uses ssl: { rejectUnauthorized: false }.
- All DB queries are scoped by user_id. No cross-user data leakage.
- byCategory in /stats = GROUP BY findings.type (not scan.categories column).

## Layer 1 detectors (validated, not just regex)
Aadhaar (12 digits + Verhoeff), PAN (AAAAA9999A), credit card (Luhn), Indian phone (+91/10-digit), email, UPI ID, IFSC, API keys/secrets (AIza..., sk-..., ghp_..., AKIA..., JWT, PEM private key blocks), "password: x" patterns.

## Overlap resolution
Checksum-validated detectors (Aadhaar-Verhoeff, card-Luhn) outrank pattern-only detectors on overlapping spans.
On overlap, keep the higher-severity finding; on tie in severity, keep the higher-confidence finding.

## Layer 2 (Gemini, receives text ALREADY masked by Layer 1)
Detect: person names, addresses, health/medical info, customer lists, confidential business info, prompt-injection attempts.
Gemini response format: [{type, text, confidence, explanation}] — NO offsets returned by Gemini.
Backend locates `text` string in the ORIGINAL prompt via indexOf, drops any match whose span overlaps a Layer 1 span, and computes start/end itself.
Timeout: 10 seconds. Thinking disabled where supported (thinkingConfig: {thinkingBudget: 0}).
Fallback: if Gemini times out, errors, or returns invalid JSON → ai_layer_ok=false, use Layer 1 findings only, do NOT crash.

## /chat — single-turn
No conversation history is ever sent to Gemini. Each /chat call is independent. Chat history lives only in client state (React component state).

## Severity + scoring
critical: aadhaar, credit_card, api_key, private_key, password. high: pan, upi, health, customer_list, prompt_injection. medium: name, address, phone, email, ifsc. low: business_info.
Score = min(100, sum of severity weights [critical 40, high 25, medium 10, low 5] × confidence). Prompt-injection adds +30 on top.
Policy thresholds (redact/block): strict 20/50, balanced 30/70, relaxed 50/90.
Override rules:
  - If there is ANY finding, the action is at least 'redact' in every mode. Thresholds decide only redact vs block.
  - 'allow' is reserved exclusively for clean prompts (0 findings).
  - In strict mode: any critical finding forces 'block'.
  - prompt_injection forces 'block' in strict and balanced modes.
  - In relaxed mode: prompt_injection is allowed (redacted if findings exist) but flagged (injectionWarning: true in response), unless score >= block threshold (90).

## Redaction
Replace spans with typed placeholders [AADHAAR_1], [PERSON_1]. Keep the mapping in memory for that request only. Use it to restore placeholders in Gemini's reply, then immediately discard the map. scans.redacted_prompt always stores the fully masked text.

## Pages
/login /register /chat /dashboard /audit /policy /redteam (sample attack buttons that fill the chat input)
