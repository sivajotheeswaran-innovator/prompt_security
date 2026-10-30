# TrustLayer 🛡️
### Intelligent Enterprise AI Security Gateway & Data Redaction Engine

> **TrustLayer** intercepts prompts before they reach generative AI models (like Google Gemini). It algorithmically detects sensitive PII and corporate credentials, scores prompt risk, redacts or blocks per enterprise policy, restores placeholders in replies, and keeps a zero-knowledge audit trail in Supabase PostgreSQL.

---

## 🎯 Problem Statement

Enterprise employees regularly paste sensitive, proprietary, and regulated data into AI chatbots to accelerate their daily work:
- **National IDs & Tax Identifiers**: Aadhaar numbers, PAN cards, Voter IDs.
- **Financial & Payment Data**: Credit/debit cards, UPI handles, bank IFSC routing codes.
- **Credentials & Cloud Secrets**: AWS AKIA keys, OpenAI/Google API keys, SSH/PEM private keys, bearer tokens, high-entropy passwords.
- **Customer & Healthcare Information**: Patient diagnoses, physical addresses, customer lists.
- **Adversarial Threats**: Direct instruction overrides, jailbreaks, and prompt injection attacks.

Without an automated security gateway, enterprises face an impossible dilemma: **shut down AI access entirely** (crushing productivity) or **accept catastrophic data leakage** and regulatory non-compliance (DPDP, GDPR, HIPAA, PCI-DSS).

**TrustLayer solves this by acting as an inline proxy**: transparently redacting sensitive data before it touches LLMs, restoring placeholders in generated responses, and maintaining compliance without sacrificing model utility.

---

## 🏗️ Architecture & Request Lifecycle

```mermaid
flowchart TD
    User([Employee / Client]) <-->|HTTPS / React SPA| FE[TrustLayer Frontend\nVite + React + TailwindCSS]
    FE <-->|JWT Authenticated JSON API| BE[TrustLayer Gateway\nExpress + TypeScript]

    subgraph BE_PIPELINE [TrustLayer Security Gateway Pipeline]
        direction TB
        L1[Layer 1: Deterministic Engine\nVerhoeff Aadhaar + Luhn Cards + Regex Keys/UPI/PAN]
        L1 --> L1Check{L1 Yields Block?}
        
        L1Check -->|Yes: Action=Block| SkipL2[Skip Layer 2\naiLayerOk=true, zero LLM calls]
        L1Check -->|No| RedactL1[Redact L1 Findings\nMask sensitive tokens]
        
        RedactL1 --> CacheCheck{Layer 2 LRU Cache\nKeyed by SHA-256}
        CacheCheck -->|Cache Hit| CachedL2[Re-use Cached Findings\nZero LLM calls]
        CacheCheck -->|Cache Miss| L2Queue[Global Request Queue\n1 call/2s pace + 429 backoff]
        L2Queue --> L2AI[Layer 2: Gemini Semantic Scan\nmaxOutputTokens: 1024]
        L2AI --> StoreCache[Store in LRU Cache\n200 entries, 10m TTL]
        
        SkipL2 --> Score[Risk Scoring & Policy Evaluator\nWeights + Bonus | Strict, Balanced, Relaxed]
        CachedL2 --> Score
        StoreCache --> Score
        Score --> Decision{Policy Decision}
    end

    BE --> BE_PIPELINE

    Decision -->|Block| BlockResp[Immediate Blocked Response\nUpstream Chat Never Called]
    Decision -->|Redact| RedactFlow[Apply Typed Placeholders\nStore Mapping in Request Scope]
    Decision -->|Allow| AllowFlow[Forward Prompt As-Is]

    RedactFlow --> ChatQueue[Global Request Queue\n1 call/2s pace + 429 backoff]
    AllowFlow --> ChatQueue
    ChatQueue --> Upstream[Google Gemini Chat AI\nmaxOutputTokens: 400 | under 150 words]

    Upstream --> Restorer[Response Interceptor\nRestores Original Data from In-Memory Map]
    Restorer --> Purge[Purge In-Memory Map\nZero-Knowledge Lifetime]
    Purge --> BE

    subgraph STORAGE [Compliance & Analytics]
        DB[(Supabase PostgreSQL Pooler\nscans + findings + policies + users)]
    end

    BE_PIPELINE -.->|Only Masked Previews Stored| DB
    BlockResp --> BE
```

---

## 🔬 How AI is Used in TrustLayer

TrustLayer uses Artificial Intelligence strategically and conservatively to maximize protection while minimizing latency and API consumption:

1. **Layer 2 Semantic Security Scanning (`backend/src/detection/layer2.ts`)**:
   - Algorithmic pattern matching (Layer 1) cannot reliably detect context-dependent unstructured PII (such as person names, residential addresses, clinical health diagnoses, and confidential business documents).
   - After Layer 1 replaces deterministic credentials with placeholders, TrustLayer sends the sanitized text to **Google Gemini** using structured JSON schema output (`{ type, text, confidence, explanation }`).
   - The gateway locates returned snippets in the original prompt, resolves span overlaps against Layer 1, and assigns severity weights without trusting client offsets.
   - **Cost & Quota Optimizations**:
     - **Deterministic Short-Circuit**: If Layer 1 alone yields `action === 'block'`, Layer 2 is skipped completely (`aiLayerOk: true`, note `"layer2 skipped: deterministic block"`).
     - **In-Memory LRU Cache**: Layer 2 findings are cached (max 200 entries, 10 min TTL) keyed by SHA-256 of the masked text. Identical prompt templates never make redundant Gemini calls.
     - **Token Limit**: Output is strictly capped to `maxOutputTokens: 1024`.

2. **Upstream Generative AI Gateway (`backend/src/services/gemini.service.ts`)**:
   - Operates as a single-turn gateway forwarding sanitized prompts to Gemini.
   - When policy dictates `redact`, Gemini receives only tokens such as `[AADHAAR_1]` and `[PHONE_1]`.
   - The returned response has its placeholders restored before delivery to the client.
   - **Global Rate Limiting & 429 Backoff**: A global request queue paces Gemini calls to at most 1 call per 2 seconds globally, honoring `Retry-After` headers and `retryDelay` on 429 quota errors (max 1 retry before falling back to a distinct rate-limited state).
   - **Chat Token Limit & System Prompt**: Configured with `maxOutputTokens: 400` and system instruction `"answer in under 150 words"`.
   - **Never Cached**: Chat replies are never stored in the Layer 2 cache.

---

## 🔐 Security Design & Privacy Guarantees

- **Zero Raw Data Persistence**: Neither raw prompt text nor raw sensitive values are ever stored in the database or server logs. Only masked previews (e.g. `XXXX-XXXX-1234` or `[HEALTH • 24 chars]`) are recorded in the audit trail.
- **Request-Scoped Ephemeral Memory**: The `RedactionMap` linking placeholders to raw values exists strictly in memory during the execution of that specific HTTP request and is wiped immediately upon completion.
- **Algorithmic Validation**:
  - **Aadhaar**: Verified with the official **Verhoeff checksum algorithm** (D8 dihedral group multiplication) to eliminate false positives.
  - **Credit Cards**: Validated with the **Luhn mod-10 algorithm**.
  - **Generic Secrets**: Analyzed via **Shannon entropy calculations** ($\ge 3.0$) and character distributions to flag unknown arbitrary high-entropy tokens following credential labels.
- **Single-Turn Isolation**: No conversational history is ever forwarded to Gemini, eliminating history exfiltration vectors.
- **Hardened Server**: Uses Helmet security headers, proxy trust rate limiting (`200 req / 15 min`), and parameterized SQL queries scoped strictly by authenticated `user_id`.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port for backend server (Render automatically sets this) | Optional (default: `5000`) | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | Required | `production` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | Required | `https://your-frontend.vercel.app` |
| `DATABASE_URL` | Supabase Transaction Pooler connection string (port 6543) | Required in dev/prod | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | Secret key for signing authentication JWT tokens (min 32 chars) | Required in dev/prod | `super-secure-jwt-key-32charslong!` |
| `JWT_EXPIRES_IN` | Token expiration lifespan | Optional (default: `7d`) | `7d` |
| `GEMINI_API_KEY` | Google Gemini API key for Layer 2 scan and chat | Required for live AI | `AIzaSy...` |
| `GEMINI_MODEL` | Default Gemini model version | Optional (default: `gemini-2.5-flash`) | `gemini-2.5-flash` |
| `GEMINI_DETECTION_MODEL` | Specialized model override for Layer 2 PII detection | Optional (defaults to `GEMINI_MODEL`) | `gemini-2.5-flash` |
| `GEMINI_CHAT_MODEL` | Specialized model override for upstream Chat generation | Optional (defaults to `GEMINI_MODEL`) | `gemini-2.5-flash` |

### Frontend (`frontend/.env`)

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Full base URL pointing to backend `/api` router | Required | `https://your-backend.onrender.com/api` |

---

## 🚀 Local Quickstart

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone & Configure
```bash
git clone https://github.com/sivajotheeswaran-innovator/prompt_security.git
cd prompt_security
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, and GEMINI_API_KEY
npm install
npm run build
npm start
```

### 3. Configure Frontend
```bash
cd ../frontend
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## ☁️ Deployment Guide

### Backend on Render (Web Service)
1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository: `https://github.com/sivajotheeswaran-innovator/prompt_security.git`.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
   - `JWT_SECRET`: `<your-32-char-random-secret>`
   - `FRONTEND_URL`: `https://<your-vercel-domain>.vercel.app`
   - `GEMINI_API_KEY`: `<your-gemini-api-key>`
   *(Note: Render automatically injects `PORT`, and TrustLayer binds to `0.0.0.0:${PORT}` automatically).*

### Frontend on Vercel
1. In Vercel Dashboard, click **Add New...** → **Project**.
2. Import `prompt_security`.
3. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variable:
   - `VITE_API_BASE_URL`: `https://<your-render-backend-url>.onrender.com/api`
5. Click **Deploy**.
   *(Note: Client-side routing rewrites are handled automatically by `frontend/vercel.json`, preventing 404s on page refresh).*

---

## 🧪 Automated Test Suite

TrustLayer includes an automated test orchestrator covering 110+ assertions across 4 comprehensive suites:

```bash
cd backend
npm test
```

### Test Suites Included:
1. **Phase 1: Foundation & Auth Acceptance (`tests/phase1-acceptance.ts`)**:
   - JWT authentication, registration, login, Zod validation, policy switching, health endpoints.
2. **Phase 2: Detection Engine & Generic Secrets (`tests/phase2-detection.ts`)**:
   - Verhoeff Aadhaar validation, Luhn Credit Card validation, PAN, UPI, IFSC, AWS keys, PEM private keys, Shannon entropy generic secrets, unicode text.
3. **Phase 3: Chat Gateway End-to-End (`tests/chat-acceptance.ts`)**:
   - Allow flow, Redact & restore flow, Block flow, and upstream failure fallback.
4. **Phase 4: Gemini Usage Reduction & Optimization (`tests/unit-gemini-reduction.ts`)**:
   - Layer 1 block skipping Layer 2, LRU caching & TTL expiration, global request queue pacing (1 call/2s), 429 retry backoff, token limits (`400` chat, `1024` detection), system prompts, and stub client isolation.
5. **Live Gemini Suite (`npm run test:live`)**:
   - Real upstream Gemini semantic detection and live Supabase row synchronization (isolated from default test runs).

---

## ⚖️ Honest Limitations

1. **Text-Only Modality**: TrustLayer currently analyzes text prompts; binary file uploads (PDF, DOCX, audio) are out of scope for this release.
2. **Dual-Layer Latency**: Layer 2 semantic scanning requires an upstream call to Gemini for unstructured entities, adding ~400–900ms when an uncached semantic AI scan is invoked. (Mitigated by our Layer 1 block short-circuit and LRU caching).
3. **Single-Turn Scope**: For maximum enterprise privacy, conversation history is stored strictly in the client React state and is not chained into upstream multi-turn prompts, eliminating multi-turn exfiltration vectors.
