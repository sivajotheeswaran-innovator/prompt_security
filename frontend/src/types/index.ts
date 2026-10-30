export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type PolicyMode = 'strict' | 'balanced' | 'relaxed';
export type PolicyAction = 'allow' | 'redact' | 'block';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ScanFinding {
  id: string;
  type: string;
  maskedPreview: string;
  startIdx: number;
  endIdx: number;
  confidence: number;
  source: 'regex' | 'ai';
  severity: Severity;
  explanation: string;
}

export interface ScanResult {
  scanId: string;
  riskScore: number;
  action: PolicyAction;
  findings: ScanFinding[];
  redactedText: string;
  aiLayerOk: boolean;
  injectionWarning?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  scan?: ScanResult;
  blocked?: boolean;
}

export interface ChatApiResponse {
  scan: ScanResult;
  reply: string | null;
  blocked: boolean;
}

export interface PolicyResponse {
  mode: PolicyMode;
  updated_at?: string;
}

export interface AuditItem {
  id: string;
  riskScore: number;
  action: PolicyAction;
  categories: string[];
  aiLayerOk: boolean;
  latencyMs: number;
  redactedPrompt: string;
  createdAt: string;
  findings: ScanFinding[];
}

export interface AuditResponse {
  items: AuditItem[];
  total: number;
}

export interface StatsResponse {
  totalScans: number;
  blocked: number;
  redacted: number;
  allowed: number;
  avgRisk: number;
  byCategory: Array<{ type: string; count: number }>;
  riskOverTime: Array<{ date: string; avgRisk: number; scanCount: number }>;
}
