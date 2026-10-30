/**
 * Risk scoring engine and policy decision maker.
 * Implements the spec severity weights and threshold logic.
 */

import { RawFinding, Severity } from './layer1';

// Severity weight map per spec
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 5,
};

// Policy threshold configuration: [redactAt, blockAt]
const POLICY_THRESHOLDS: Record<string, [number, number]> = {
  strict:   [20, 50],
  balanced: [30, 70],
  relaxed:  [50, 90],
};

export type PolicyAction = 'allow' | 'redact' | 'block';

export interface ScoringResult {
  riskScore: number;
  action: PolicyAction;
  hasPromptInjection: boolean;
  hasCritical: boolean;
  injectionWarning: boolean;
}

/**
 * Calculates the risk score and determines the policy action.
 * Score = min(100, sum(severity_weight × confidence))
 * Prompt injection adds +30 bonus (Amendment 4).
 * Critical findings force at minimum 'redact'; in 'strict' mode they force 'block'.
 * Prompt injection forces 'block' in strict and balanced; in relaxed it is allowed but flagged with warning.
 */
export function scoreAndDecide(
  findings: RawFinding[],
  policyMode: string
): ScoringResult {
  const mode = policyMode || 'balanced';
  const thresholds = POLICY_THRESHOLDS[mode] ?? POLICY_THRESHOLDS['balanced'];
  const [redactAt, blockAt] = thresholds;

  let rawScore = 0;
  let hasPromptInjection = false;
  let hasCritical = false;

  for (const f of findings) {
    const weight = SEVERITY_WEIGHTS[f.severity] ?? 5;
    rawScore += weight * f.confidence;

    if (f.type === 'prompt_injection') {
      hasPromptInjection = true;
    }
    if (f.severity === 'critical') {
      hasCritical = true;
    }
  }

  // Prompt injection bonus: +30 (Amendment 4)
  if (hasPromptInjection) {
    rawScore += 30;
  }

  const riskScore = Math.min(100, Math.round(rawScore));

  // Determine action:
  // RULE (Amendment 11): If there is ANY finding, the action is at least "redact" in every mode.
  // Thresholds decide only redact vs block. Clean prompts (0 findings) are "allow".
  let action: PolicyAction = 'allow';
  let injectionWarning = false;

  if (findings.length > 0) {
    if (riskScore >= blockAt) {
      action = 'block';
    } else {
      action = 'redact';
    }

    // Critical finding overrides:
    // - Strict mode: any critical finding forces 'block'
    if (hasCritical && mode === 'strict') {
      action = 'block';
    }

    // Prompt injection override:
    // - Strict and balanced modes: prompt_injection forces 'block'
    // - Relaxed mode: flagged with warning, action is 'block' only if riskScore >= blockAt
    if (hasPromptInjection) {
      if (mode === 'strict' || mode === 'balanced') {
        action = 'block';
      } else {
        injectionWarning = true;
      }
    }
  }

  return { riskScore, action, hasPromptInjection, hasCritical, injectionWarning };
}

/**
 * Aggregates finding types into a category list for storage.
 */
export function extractCategories(findings: RawFinding[]): string[] {
  return [...new Set(findings.map((f) => f.type))];
}
