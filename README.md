# TrustLayer 🛡️
### Intelligent Enterprise AI Security Gateway & Data Redaction Engine

> **TrustLayer** intercepts prompts before they reach generative AI models (like Google Gemini). It algorithmically detects sensitive PII and corporate credentials, scores prompt risk, redacts or blocks per enterprise policy, restores placeholders in replies, and keeps a zero-knowledge audit trail in Supabase PostgreSQL.

---

## 🎯 Problem Statement
Employees regularly paste sensitive, proprietary, and regulated data into AI chatbots:
- **National IDs & Tax IDs**: Aadhaar numbers, PAN cards, Voter IDs
- **Financial & Payment Data**: Credit/debit cards, UPI handles, bank IFSC routing codes
- **Credentials & Cloud Secrets**: AWS AKIA keys, OpenAI/Google API keys, SSH/PEM private keys, bearer tokens, passwords
- **Customer & Healthcare Information**: Patient diagnoses, addresses, customer lists
- **Adversarial Threats**: Direct instruction overrides and prompt injection jailbreaks

Without an enterprise gateway, companies risk catastrophic regulatory penalties (GDPR, DPDP, HIPAA, PCI-DSS) and intellectual property exfiltration.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    User([Employee / Client]) <-->|HTTPS / React SPA| FE[TrustLayer Frontend\nVite + React + TailwindCSS]
    FE <-->|JWT Authenticated JSON API| BE[TrustLayer Gateway\nExpress + TypeScript]

    subgraph BE_PIPELINE [TrustLayer Security Gateway Pipeline]
        direction TB
        L1[Layer 1: Deterministic Engine\nVerhoeff Aadhaar + Luhn Cards + Regex Keys/UPI/PAN]
        L1 --> L2[Layer 2: Semantic AI Engine\nGemini Structured JSON: Names, Addresses, Health]
        L2 --> Score[Risk Scoring & Policy Evaluator\nWeights + Bonus | Strict, Balanced, Relaxed]
        Score --> Decision{Policy Decision}
    end

    BE --> BE_PIPELINE

    Decision -->|Block| BlockResp[Immediate Blocked Response\nUpstream AI Never Called]
    Decision -->|Redact| RedactFlow[Apply Typed Placeholders\nStore Mapping in Request Scope]
    Decision -->|Allow| AllowFlow[Forward Prompt As-Is]

    RedactFlow --> Upstream[Google Gemini AI API\nReceives Sanitized Prompt Only]
    AllowFlow --> Upstream

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

1. **Layer 2 Semantic Security Scanning (`layer2.ts`)**:
   - Algorithmic pattern matching (Layer 1) cannot reliably detect context-dependent unstructured PII (such as person names, residential addresses, clinical health diagnoses, and confidential business documents).
   - After Layer 1 replaces deterministic credentials with placeholders, TrustLayer sends the sanitized text to **Google Gemini** using structured JSON schema output (`{ type, text, confidence, explanation }`).
   - The gateway locates returned snippets in the original prompt, resolves span overlaps against Layer 1, and assigns severity weights without trusting client offsets.
2. **Upstream Generative AI Gateway (`gemini.service.ts`)**:
   - Operates as a single-turn gateway forwarding sanitized prompts to Gemini (`gemini-2.5-flash`).
   - When policy dictates `redact`, Gemini receives only tokens such as `[AADHAAR_1]` and `[PHONE_1]`.
   - The returned response has its placeholders restored before delivery to the client.

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

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | HTTP port for backend server | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `DATABASE_URL` | Supabase Transaction Pooler connection string (port 6543) | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | Secret key for signing authentication JWT tokens | `super-secure-jwt-key-32charslong!` |
| `JWT_EXPIRES_IN` | Token expiration lifespan | `7d` |
| `GEMINI_API_KEY` | Google Gemini API key for Layer 2 scan and chat | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini default model version (e.g. `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-2.0-flash`). Defaults to `gemini-2.5-flash`. | `gemini-2.5-flash` |
| `GEMINI_DETECTION_MODEL` | Optional model override for Layer 2 PII detection. Defaults to `GEMINI_MODEL`. | `gemini-2.5-flash` |
| `GEMINI_CHAT_MODEL` | Optional model override for upstream Chat generation. Defaults to `GEMINI_MODEL`. | `gemini-2.5-flash` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Full base URL pointing to backend `/api` router | `http://localhost:5000/api` |

---

## 🚀 Local Quickstart

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone & Configure
```bash
git clone <repo-url>
cd "BTS HACKATHON"
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, and GEMINI_API_KEY
npm install
npm run migrate
npm run build
npm start
```

### 3. Configure Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🧪 Automated Test Suite

TrustLayer includes an automated test orchestrator covering 70+ assertions:

```bash
cd backend
npm test
```

This runs:
1. **Phase 1 Foundation Suite**: JWT authentication, registration, login, Zod validation, policy switching, health endpoints.
2. **Phase 2 Detection Engine Suite**: Verhoeff, Luhn, PAN, UPI, IFSC, AWS keys, PEM blocks, generic high-entropy secret detection, and unicode compatibility.
3. **Phase 3 Chat Gateway Suite**: Allow, Redact, Block, and AI unavailable fallbacks.
4. **Live Verification Suite**: Real Gemini semantic detection, prompt injection block, and live Supabase row synchronization.

---

## ☁️ Deployment Guide

### Backend on Render (Web Service)
1. **Build Command**: `npm install && npm run build` (all build dependencies are bundled in `dependencies`).
2. **Start Command**: `npm start` (runs `node dist/server.js`).
3. **Environment Variables**: Configure `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`, and `GEMINI_API_KEY`.

### Frontend on Vercel
1. Set **Framework Preset**: Vite
2. Set **Root Directory**: `frontend`
3. Configure **Environment Variable**: `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
4. Routing rewrites are handled by the included [`frontend/vercel.json`](file:///c:/Users/sivaj/Downloads/BTS%20HACKATHON/frontend/vercel.json).

---

## ⚖️ Honest Limitations

1. **Text-Only Modality**: TrustLayer currently analyzes text prompts; binary file uploads (PDF, DOCX, audio) are out of scope for this release.
2. **Dual-Layer Latency**: Layer 2 semantic scanning requires an upstream call to Gemini for unstructured entities, adding ~400–900ms to prompt evaluation when semantic AI scanning is invoked.
3. **Single-Turn Scope**: For maximum enterprise privacy, conversation history is stored strictly in the client React state and is not chained into upstream multi-turn prompts.
