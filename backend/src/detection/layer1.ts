/**
 * Layer 1: Deterministic pattern-based detectors.
 * All detectors include algorithmic validation where applicable.
 * CRITICAL RULE: This module NEVER logs or returns raw sensitive values.
 * Only start/end offsets and type metadata are exposed.
 */

import { verhoeffValidate } from './verhoeff';
import { luhnValidate } from './luhn';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface RawFinding {
  type: string;
  severity: Severity;
  start: number;
  end: number;
  rawValue: string; // ONLY in-memory; NEVER logged, stored, or serialized
  confidence: number;
  source: 'regex' | 'ai';
  explanation: string;
}

// ─── Aadhaar ─────────────────────────────────────────────────────────────────
// UIDAI: 12 digits, does NOT start with 0 or 1
const AADHAAR_RE = /\b([2-9]\d{3})\s*(\d{4})\s*(\d{4})\b/g;

function detectAadhaar(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  AADHAAR_RE.lastIndex = 0;

  while ((m = AADHAAR_RE.exec(text)) !== null) {
    const raw = m[0].replace(/\s/g, '');
    // Reject repeating-digit sequences (000000000000 etc.)
    if (/^(\d)\1{11}$/.test(raw)) continue;
    if (!verhoeffValidate(raw)) continue;

    findings.push({
      type: 'aadhaar',
      severity: 'critical',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: raw,
      confidence: 1.0,
      source: 'regex',
      explanation: 'Aadhaar number detected (12 digits, Verhoeff checksum validated)',
    });
  }
  return findings;
}

// ─── PAN ─────────────────────────────────────────────────────────────────────
// Format: AAAAA9999A (5 uppercase letters, 4 digits, 1 uppercase letter)
const PAN_RE = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;

function detectPAN(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  PAN_RE.lastIndex = 0;

  while ((m = PAN_RE.exec(text)) !== null) {
    // Validate 4th character is a valid entity type
    const validEntityTypes = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
    if (!validEntityTypes.includes(m[0][3])) continue;

    findings.push({
      type: 'pan',
      severity: 'high',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.95,
      source: 'regex',
      explanation: 'PAN card number detected (AAAAA9999A format with valid entity type)',
    });
  }
  return findings;
}

// ─── Credit Card ─────────────────────────────────────────────────────────────
// Visa (13-16), MasterCard (16), Amex (15), Discover (16), RuPay (16)
const CARD_RE = /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}|\d{4}[\s\-]?\d{6}[\s\-]?\d{5})\b/g;

function detectCreditCard(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  CARD_RE.lastIndex = 0;

  while ((m = CARD_RE.exec(text)) !== null) {
    const raw = m[0].replace(/[\s-]/g, '');
    if (raw.length < 13 || raw.length > 19) continue;
    if (!luhnValidate(raw)) continue;
    // Reject simple incremental / all-same sequences
    if (/^(\d)\1+$/.test(raw)) continue;

    findings.push({
      type: 'credit_card',
      severity: 'critical',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: raw,
      confidence: 0.99,
      source: 'regex',
      explanation: 'Credit/debit card number detected (Luhn checksum validated)',
    });
  }
  return findings;
}

// ─── Indian Phone Number ──────────────────────────────────────────────────────
// +91 followed by 10 digits, or 10-digit starting with 6-9
const PHONE_RE = /(?<!\d)(\+91[\s\-]?)?([6-9]\d{9})(?!\d)/g;

function detectIndianPhone(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;

  while ((m = PHONE_RE.exec(text)) !== null) {
    const hasCountryCode = !!m[1]; // m[1] is the optional +91 group
    // Only strip the leading 91/+91 if we actually matched a country code prefix
    const normalized = m[0].replace(/[\s\-+]/g, '');
    const digits = hasCountryCode ? normalized.replace(/^91/, '') : normalized;
    if (digits.length !== 10) continue;
    if (/^(\d)\1{9}$/.test(digits)) continue; // reject 9999999999
    if (!/^[6-9]/.test(digits)) continue; // must start with 6-9

    findings.push({
      type: 'phone',
      severity: 'medium',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0].trim(),
      confidence: 0.85,
      source: 'regex',
      explanation: 'Indian mobile phone number detected',
    });
  }
  return findings;
}

// ─── Email ────────────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

function detectEmail(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;

  while ((m = EMAIL_RE.exec(text)) !== null) {
    // Must have valid TLD length and structure
    const parts = m[0].split('@');
    if (parts.length !== 2 || !parts[1].includes('.')) continue;

    findings.push({
      type: 'email',
      severity: 'medium',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.95,
      source: 'regex',
      explanation: 'Email address detected',
    });
  }
  return findings;
}

// ─── UPI ID ───────────────────────────────────────────────────────────────────
// Format: identifier@bank (e.g., user@ybl, 9876543210@paytm)
const UPI_RE = /\b([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})\b/g;
// Known UPI PSP handles to reduce false positives
const UPI_PSP_HANDLES = new Set([
  'ybl','upi','paytm','oksbi','okaxis','okicici','okhdfcbank',
  'axisbank','hdfcbank','sbi','icici','kotak','indus','ibl',
  'rbl','idfc','upi','apl','barodampay','mahb','sib','cmsidfc',
  'fbl','ikwik','jupiteraxis','naviaxis','sliceaxis','superyes',
  'pz','postbank','nsdl','waicici','yesbank','abfspay','airtel',
  'tapicici','rajgovhdfcbank','esaf','kalupur','kvb','utbi',
  'pingpay','dbs','allbank','andb','boi','vijb','cnrb','bdbl',
  'cbin','federal','idbi','jkb','pnb','psb','rbi','scmtebank',
  'tjsb','uco','unionbank','united','yapl','abhaibfl',
]);

function detectUPI(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  UPI_RE.lastIndex = 0;

  while ((m = UPI_RE.exec(text)) !== null) {
    const handle = m[0].split('@')[1]?.toLowerCase() || '';
    // Only flag if it matches a known PSP handle (avoids email false positives)
    if (!UPI_PSP_HANDLES.has(handle)) continue;

    findings.push({
      type: 'upi',
      severity: 'high',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.9,
      source: 'regex',
      explanation: `UPI payment ID detected (handle: @${handle})`,
    });
  }
  return findings;
}

// ─── IFSC Code ────────────────────────────────────────────────────────────────
// Format: 4 uppercase letters + 0 + 6 alphanumeric
const IFSC_RE = /\b([A-Z]{4}0[A-Z0-9]{6})\b/g;

function detectIFSC(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  IFSC_RE.lastIndex = 0;

  while ((m = IFSC_RE.exec(text)) !== null) {
    findings.push({
      type: 'ifsc',
      severity: 'medium',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.85,
      source: 'regex',
      explanation: 'IFSC code detected (bank routing identifier)',
    });
  }
  return findings;
}

// ─── API Keys & Secrets ───────────────────────────────────────────────────────
interface ApiKeyPattern {
  name: string;
  pattern: RegExp;
  confidence: number;
}

const API_KEY_PATTERNS: ApiKeyPattern[] = [
  // Google API Key
  { name: 'google_api_key', pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g, confidence: 0.99 },
  // OpenAI secret key (sk-... and new sk-proj-...)
  { name: 'openai_api_key', pattern: /\bsk-(?:proj-)?[a-zA-Z0-9_\-]{20,80}\b/g, confidence: 0.98 },
  // GitHub Personal Access Token (classic ghp_ and fine-grained github_pat_)
  { name: 'github_token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[0-9a-zA-Z_]{20,255}\b/g, confidence: 0.99 },
  // AWS Access Key ID (AKIA, ASIA, AROA, AIDA)
  { name: 'aws_access_key', pattern: /\b(AKIA|ASIA|AROA|AIDA)[0-9A-Z]{16,28}\b/g, confidence: 0.99 },
  // AWS Secret Access Key (generic 40-char base64 after known labels)
  { name: 'aws_secret_key', pattern: /(?:aws.{0,20}secret.{0,20}|SecretAccessKey['":\s=]+)([A-Za-z0-9/+=]{40})\b/gi, confidence: 0.90 },
  // Stripe secret key
  { name: 'stripe_key', pattern: /\bsk_(?:live|test)_[a-zA-Z0-9]{24,}\b/g, confidence: 0.99 },
  // Slack Bot/User OAuth tokens
  { name: 'slack_token', pattern: /\bxox[bpoa]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}\b/g, confidence: 0.99 },
  // Generic Bearer token (long random string after "Bearer")
  { name: 'bearer_token', pattern: /\bBearer\s+([a-zA-Z0-9_\-\.]{30,})\b/g, confidence: 0.75 },
];

// JWT token: three base64url segments separated by dots
const JWT_RE = /\bey[a-zA-Z0-9\-_]+\.ey[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\b/g;

function detectApiKeys(text: string): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const { name, pattern, confidence } of API_KEY_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      findings.push({
        type: 'api_key',
        severity: 'critical',
        start: m.index,
        end: m.index + m[0].length,
        rawValue: m[0],
        confidence,
        source: 'regex',
        explanation: `${name.replace(/_/g, ' ')} detected`,
      });
    }
  }

  // JWT detection
  JWT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = JWT_RE.exec(text)) !== null) {
    // Validate it looks like a real JWT header
    try {
      const headerB64 = m[0].split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
      if (!header.alg && !header.typ) continue;
    } catch {
      continue;
    }
    findings.push({
      type: 'api_key',
      severity: 'critical',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.92,
      source: 'regex',
      explanation: 'JWT bearer token detected',
    });
  }

  return findings;
}

// ─── Generic High-Entropy Secret Detector ────────────────────────────────────
// Matches long high-entropy tokens following key/token/secret/bearer/api labels.
const GENERIC_SECRET_LABEL_RE = /(?:api[_-]?key|api[_-]?token|api[_-]?secret|secret[_-]?key|secret[_-]?token|access[_-]?token|auth[_-]?token|bearer[_-]?token|bearer|client[_-]?secret|private[_-]?key|secret)(?:\s*[:=]\s*|\s+)["']?([A-Za-z0-9_\-\.\/+=]{20,})["']?/gi;

export function calculateShannonEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;
  const freqs: Record<string, number> = {};
  for (let i = 0; i < len; i++) {
    const ch = str[i];
    freqs[ch] = (freqs[ch] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(freqs)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function detectGenericSecrets(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  GENERIC_SECRET_LABEL_RE.lastIndex = 0;

  while ((m = GENERIC_SECRET_LABEL_RE.exec(text)) !== null) {
    const token = m[1];
    if (!token || token.length < 20) continue;

    // Must have good Shannon entropy and character mix
    const entropy = calculateShannonEntropy(token);
    const hasLetters = /[a-zA-Z]/.test(token);
    const hasDigitsOrSymbols = /[\d_\-\.\/+=]/.test(token);

    if (entropy >= 3.0 && hasLetters && hasDigitsOrSymbols) {
      const tokenOffset = m[0].indexOf(token);
      const start = m.index + tokenOffset;
      const end = start + token.length;

      findings.push({
        type: 'api_key',
        severity: 'critical',
        start,
        end,
        rawValue: token,
        confidence: 0.95,
        source: 'regex',
        explanation: 'Generic high-entropy secret token detected following credential label',
      });
    }
  }

  return findings;
}

// ─── PEM Private Key ─────────────────────────────────────────────────────────
const PEM_RE = /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g;

function detectPEMKey(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  PEM_RE.lastIndex = 0;

  while ((m = PEM_RE.exec(text)) !== null) {
    findings.push({
      type: 'private_key',
      severity: 'critical',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 1.0,
      source: 'regex',
      explanation: 'PEM private key block detected',
    });
  }
  return findings;
}

// ─── Password Patterns ────────────────────────────────────────────────────────
// Matches: password: x, passwd=x, pwd=x, "password":"x", etc.
const PASSWORD_RE = /(?:password|passwd|pwd|pass|secret|token|api[-_]?key|auth[-_]?key)[\s]*[:=]+[\s]*["']?([^\s"',;]{4,})["']?/gi;

function detectPassword(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  let m: RegExpExecArray | null;
  PASSWORD_RE.lastIndex = 0;

  while ((m = PASSWORD_RE.exec(text)) !== null) {
    // Avoid matching placeholder-like values
    const value = m[1];
    if (!value || value.toLowerCase() === 'your_password' || value === '***' || value === 'xxxx') continue;
    if (value.length < 4) continue;

    findings.push({
      type: 'password',
      severity: 'critical',
      start: m.index,
      end: m.index + m[0].length,
      rawValue: m[0],
      confidence: 0.85,
      source: 'regex',
      explanation: 'Password or secret credential pattern detected',
    });
  }
  return findings;
}

// ─── Overlap resolution (Amendment 8) ─────────────────────────────────────────
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const CHECKSUM_TYPES = new Set(['aadhaar', 'credit_card']);

/**
 * Returns negative if a outranks b, positive if b outranks a, 0 if equal.
 * Priority:
 *   1. Checksum-validated (aadhaar, credit_card) outranks pattern-only
 *   2. Higher severity
 *   3. Higher confidence
 *   4. Longer span length
 */
export function compareFindings(a: RawFinding, b: RawFinding): number {
  const aChecksum = CHECKSUM_TYPES.has(a.type);
  const bChecksum = CHECKSUM_TYPES.has(b.type);
  if (aChecksum && !bChecksum) return -1;
  if (!aChecksum && bChecksum) return 1;

  const aSev = SEVERITY_RANK[a.severity] ?? 0;
  const bSev = SEVERITY_RANK[b.severity] ?? 0;
  if (aSev !== bSev) return bSev - aSev;

  if (a.confidence !== b.confidence) return b.confidence - a.confidence;

  return (b.end - b.start) - (a.end - a.start);
}

/**
 * Removes duplicate/overlapping findings per Amendment 8.
 * Checksum-validated detectors outrank pattern-only detectors.
 * On overlap, keeps the higher-severity finding; on tie, keeps higher-confidence.
 * Results are sorted strictly by start index ascending.
 */
export function deduplicateFindings(findings: RawFinding[]): RawFinding[] {
  if (findings.length <= 1) return findings;

  // Sort by start index ascending, then by ranking priority
  const sorted = [...findings].sort((a, b) => a.start - b.start || compareFindings(a, b));

  const result: RawFinding[] = [];

  for (const candidate of sorted) {
    if (result.length === 0) {
      result.push(candidate);
      continue;
    }

    const prev = result[result.length - 1];

    // Check overlap: candidate.start < prev.end && candidate.end > prev.start
    if (candidate.start < prev.end && candidate.end > prev.start) {
      // Overlap detected: determine which one wins
      if (compareFindings(candidate, prev) < 0) {
        // Candidate outranks prev: replace prev with candidate
        result[result.length - 1] = candidate;
      }
      // Else prev outranks candidate; candidate is dropped
    } else {
      result.push(candidate);
    }
  }

  return result.sort((a, b) => a.start - b.start);
}

// ─── Prompt Injection (Deterministic heuristics) ─────────────────────────────
const PROMPT_INJECTION_PATTERNS: Array<{ re: RegExp; explanation: string }> = [
  // 1. Instruction-override phrases
  {
    re: /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|commands|constraints|directives)\b/gi,
    explanation: 'Instruction-override phrase detected',
  },
  {
    re: /\b(?:stop\s+being\s+an\s+ai|reset\s+(?:all\s+)?(?:instructions|prompts|rules)|system\s+prompt\s+override)\b/gi,
    explanation: 'Instruction override or prompt reset attempt detected',
  },
  // 2. DAN / Jailbreak phrases
  {
    re: /\b(?:do\s+anything\s+now|DAN(?:\s+mode|\s+jailbreak|\s+prompt|\s+version)?|jailbreak(?:\s+mode|\s+prompt)?|developer\s+mode\s+(?:on|enabled|prompt|active)|AIM\s+mode)\b/gi,
    explanation: 'DAN or jailbreak persona attempt detected',
  },
  // 3. System-prompt extraction
  {
    re: /\b(?:output|print|show|reveal|display|leak|repeat|give\s+me)\s+(?:your\s+|the\s+)?(?:internal\s+)?(?:system\s+(?:prompt|instructions|rules|message)|initial\s+prompt)\b/gi,
    explanation: 'System-prompt extraction attempt detected',
  },
  {
    re: /\bwhat\s+(?:are|were)\s+your\s+(?:system\s+|initial\s+)?(?:instructions|prompts|rules)\b/gi,
    explanation: 'System prompt or instruction extraction attempt detected',
  },
  // 4. "you are now" persona hijacking
  {
    re: /\byou\s+are\s+now\b/gi,
    explanation: '"you are now" persona hijacking pattern detected',
  },
];

function detectPromptInjection(text: string): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const { re, explanation } of PROMPT_INJECTION_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      findings.push({
        type: 'prompt_injection',
        severity: 'high',
        start: m.index,
        end: m.index + m[0].length,
        rawValue: m[0],
        confidence: 0.95,
        source: 'regex',
        explanation,
      });
    }
  }

  return findings;
}

// ─── Layer 1 Runner ───────────────────────────────────────────────────────────
/**
 * Runs all Layer 1 detectors on the provided text.
 * Returns raw findings sorted by start index with overlaps resolved.
 * RAW VALUES ARE KEPT IN MEMORY ONLY — never log or persist them.
 */
export function runLayer1(text: string): RawFinding[] {
  const all: RawFinding[] = [
    ...detectAadhaar(text),
    ...detectPAN(text),
    ...detectCreditCard(text),
    ...detectIndianPhone(text),
    ...detectEmail(text),
    ...detectUPI(text),
    ...detectIFSC(text),
    ...detectApiKeys(text),
    ...detectGenericSecrets(text),
    ...detectPEMKey(text),
    ...detectPassword(text),
    ...detectPromptInjection(text),
  ];

  return deduplicateFindings(all);
}
