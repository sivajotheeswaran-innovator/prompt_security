# TrustLayer - Implementation Task Plan

## Phase 1: Backend Foundation & Database
- [x] Initialize `backend/` with `package.json`, TypeScript, Express, Helmet, CORS, Rate Limiting, and Zod
- [x] Configure PostgreSQL connection pool (`pg` driver) for Supabase Postgres
- [x] Create database migration / init script with tables: `users`, `policies`, `scans`, `findings`
- [x] Implement user authentication with bcrypt and JWT (`POST /api/auth/register`, `POST /api/auth/login`)
- [x] Implement JWT authentication middleware
- [x] Implement policy endpoints (`GET /api/policy`, `PUT /api/policy`)
- [x] Implement health check (`GET /api/health`)
- [x] Verify Phase 1 with tests & acceptance script

## Phase 2: Detection Engine (Layer 1 & Scoring)
- [x] Build Layer 1 pattern detectors with algorithmic verification:
  - [x] Aadhaar (12 digits + Verhoeff validation)
  - [x] PAN (AAAAA9999A checksum format)
  - [x] Credit Card (13-19 digits + Luhn validation)
  - [x] Indian Phone Numbers (+91 / 10-digit formats)
  - [x] Email addresses
  - [x] UPI IDs (e.g., `user@bank`)
  - [x] IFSC codes (4 letters, 0, 6 alphanumeric)
  - [x] API keys & secrets (Google AIza, OpenAI sk-, GitHub ghp-, AWS AKIA, JWT, PEM private keys)
  - [x] Password patterns (`password: x`, etc.)
- [x] Build masking / preview generator (e.g., `XXXX-XXXX-1234`, never expose raw secret)
- [x] Build in-memory placeholder replacement engine (`[AADHAAR_1]`, `[API_KEY_1]`, etc.)
- [x] Build overlap resolution engine (checksum-validated outranks pattern-only, higher-severity wins)
- [x] Build severity weight scoring engine:
  - Critical: 40 | High: 25 | Medium: 10 | Low: 5
  - Base formula: `min(100, sum(severity_weight * confidence))`
  - Prompt injection: +30 bonus; strict/balanced block; relaxed warning flag
- [x] Build policy threshold evaluator:
  - Strict: 20 redact / 50 block (critical forces block, prompt injection forces block)
  - Balanced: 30 redact / 70 block (critical forces redact, prompt injection forces block)
  - Relaxed: 50 redact / 90 block (critical forces redact, prompt injection flags warning)
- [x] Layer 2 Gemini integration (text-only return, offset computation via indexOf, 10s timeout, thinking disabled)
- [x] Wire `POST /api/scan` with Layer 1 + Layer 2 fusion
- [x] Implement Audit & Analytics Endpoints:
  - [x] `GET /api/audit?limit&offset&action&type` (scoped by user_id)
  - [x] `GET /api/stats` (totalScans, blocked, redacted, allowed, avgRisk, byCategory via findings.type, riskOverTime)
- [x] Verify Phase 2 with 40 automated test cases (Verhoeff, Luhn, PAN, UPI, AWS key, PEM block, clean prompt < 10, mixed prompt, overlapping spans, unicode, redact/restore roundtrip, DB/preview raw leakage check)

## Phase 3: Chat Gateway Integration
- [x] Implement `POST /api/chat`:
  - [x] Single-turn execution: no conversation history sent to Gemini
  - [x] If blocked: return `{ scan, reply: null, blocked: true }` without calling chat model
  - [x] If redacted/allowed: send safe prompt to Gemini, restore placeholders in reply, return `{ scan, reply, blocked: false }`
  - [x] In-memory redaction map discarded immediately after reply restoration
  - [x] Always log the scan to DB (scans & findings tables)
  - [x] Gemini failure fallback with clear error message
- [x] Verify Phase 3 with end-to-end curl checks across clean, redact, block, and fallback scenarios

## Phase 4: Frontend Development
- [x] Initialize `frontend/` with Vite, React, TypeScript, TailwindCSS, React Router, Axios, Lucide Icons, Recharts
- [x] Build dark security-dashboard design system (colors, glassmorphism, badges, animations)
- [x] Build auth context and state management (JWT storage, axios interceptors)
- [x] Build Pages:
  - [x] `/login` & `/register`: Clean modern auth cards
  - [x] `/chat`: Interactive AI chat with real-time prompt risk preview, highlighted findings badge, redacted prompt inspector, and restored AI response view
  - [x] `/dashboard`: Executive security overview with risk metrics, donut/bar charts (`Recharts`), activity cards
  - [x] `/audit`: Searchable, filterable audit log table with masked previews, findings inspector, and pagination
  - [x] `/policy`: Policy configuration toggle (Strict / Balanced / Relaxed) with live threshold explanations
  - [x] `/redteam`: Interactive playground with pre-built attacks (Aadhaar leaks, API key exfiltration, prompt injections, medical records) that 1-click test the chat
- [x] Verify Phase 4 in browser via subagent / browser testing with full screenshot capture

## Phase 5: Verification, Hardening & Deployment
- [x] Run full security audit: ensure no raw credentials or raw prompt secrets are stored in DB or client
- [x] Verify rate limiting, CORS, Helmet headers, Zod input validation across all endpoints
- [x] Fix pass before deployment:
  - [x] Gemini mock removed entirely; fallback with `isFallback: true` and `aiLayerOk: false`
  - [x] `pg-mem` restricted exclusively to `NODE_ENV=test`; `DATABASE_URL` & `JWT_SECRET` strictly required for dev/prod
  - [x] Policy update: any finding forces at least `redact` across all modes; clean prompts are `allow`
  - [x] Generic high-entropy secret detector implemented with Shannon entropy calculation and verified
  - [x] Layer 2 masks ALL non-overlapping occurrences of returned spans
  - [x] CORS restricts localhost to non-production only; `npm test` orchestrates all 4 test suites
  - [x] Live Gemini tests verified: Name + Address + Health detection, balanced prompt injection block, real `/chat` reply with placeholders
- [x] Document architectural updates in `docs/decisions.md` and `docs/spec.md`

