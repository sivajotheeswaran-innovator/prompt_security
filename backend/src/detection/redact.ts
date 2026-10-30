/**
 * Redaction Engine: In-memory typed placeholder replacement and restoration.
 * 
 * SECURITY RULE: Raw values exist ONLY in the RedactionMap which lives
 * exclusively in request scope memory. They are NEVER logged, stored,
 * serialized, or sent outside the request lifecycle.
 */

import { RawFinding } from './layer1';

// Maps placeholder tokens back to original raw values (request-scoped only)
export type RedactionMap = Map<string, string>;

export interface RedactionResult {
  redactedText: string;
  map: RedactionMap; // discard after use — never store or log
}

/**
 * Generates a masked preview of a raw value for safe display in UI and DB.
 * NEVER shows more than the last 4 chars for short secrets.
 */
export function maskPreview(raw: string, type: string): string {
  const normalizedType = type.toLowerCase().replace(/\s+/g, '_');
  const s = raw.replace(/[\s\-]/g, '');

  switch (normalizedType) {
    case 'aadhaar': {
      // XXXX-XXXX-1234 (last 4 visible)
      const last4 = s.slice(-4);
      return `XXXX-XXXX-${last4}`;
    }
    case 'credit_card':
    case 'card': {
      // XXXX-XXXX-XXXX-1234
      const last4 = s.slice(-4);
      return `XXXX-XXXX-XXXX-${last4}`;
    }
    case 'pan': {
      // PAN -> last 3-4 chars only (hide first 6 chars)
      const lastChars = raw.slice(-4);
      return `XXXXXX${lastChars}`;
    }
    case 'phone': {
      // Phone -> last 4 digits consistently
      const digits = raw.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return `XXXXXX${last4}`;
    }
    case 'email': {
      const [local, domain] = raw.split('@');
      const maskedLocal = (local || '').slice(0, 2) + '***';
      return `${maskedLocal}@${domain || ''}`;
    }
    case 'upi': {
      const [upiLocal, handle] = raw.split('@');
      const masked = (upiLocal || '').slice(0, 2) + '***';
      return `${masked}@${handle || ''}`;
    }
    case 'ifsc': {
      // First 4 chars (bank code) visible
      return `${raw.slice(0, 4)}XXXXXX`;
    }
    case 'api_key':
    case 'private_key': {
      // Prefix (<=4 chars) + "…[REDACTED]"
      const prefix = raw.slice(0, Math.min(4, raw.length));
      return `${prefix}…[REDACTED]`;
    }
    case 'password': {
      return `[REDACTED_CREDENTIAL]`;
    }
    // Semantic & descriptive finding types (zero raw leakage: store only [TYPE • N chars])
    case 'name':
    case 'address':
    case 'health':
    case 'customer_list':
    case 'business_info':
    case 'prompt_injection':
    default: {
      const displayType = normalizedType.toUpperCase();
      return `[${displayType} • ${raw.length} chars]`;
    }
  }
}

/**
 * Replaces all detected sensitive spans with typed placeholders.
 * Processes spans in REVERSE order to preserve index correctness.
 * 
 * @param text - Original input text
 * @param findings - Layer 1 (and optionally Layer 2) findings sorted by start index
 * @returns redactedText with placeholders + a map for restoration
 */
export function redactText(text: string, findings: RawFinding[]): RedactionResult {
  const map: RedactionMap = new Map<string, string>();
  const counters = new Map<string, number>();

  // Sort by start index descending so we can safely splice from end
  const sorted = [...findings].sort((a, b) => b.start - a.start);

  let result = text;

  for (const finding of sorted) {
    const typeKey = finding.type.toUpperCase();
    const count = (counters.get(typeKey) ?? 0) + 1;
    counters.set(typeKey, count);
    const placeholder = `[${typeKey}_${count}]`;

    // Store raw → placeholder in map (raw is only here in request memory)
    map.set(placeholder, finding.rawValue);

    // Replace the span in the text
    result =
      result.slice(0, finding.start) +
      placeholder +
      result.slice(finding.end);
  }

  return { redactedText: result, map };
}

/**
 * Restores placeholders in a string (e.g., Gemini's reply) using the map.
 * After calling this, immediately discard the map.
 * 
 * @param text - Text with placeholders (e.g., the AI reply)
 * @param map - The redaction map from redactText()
 * @returns Restored text with original values re-inserted
 */
export function restorePlaceholders(text: string, map: RedactionMap): string {
  let result = text;

  for (const [placeholder, original] of map.entries()) {
    // Use global regex replacement to handle multiple occurrences in the reply
    result = result.split(placeholder).join(original);
  }

  return result;
}
