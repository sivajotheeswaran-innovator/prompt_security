import axios from 'axios';
import {
  AuthResponse,
  ChatApiResponse,
  PolicyResponse,
  PolicyMode,
  AuditResponse,
  StatsResponse,
  ScanResult,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('trustlayer_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Redirect to login on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      localStorage.removeItem('trustlayer_token');
      localStorage.removeItem('trustlayer_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth APIs ────────────────────────────────────────────────────────────────
export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { email, password });
  return res.data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

// ── Policy APIs ──────────────────────────────────────────────────────────────
export async function getPolicy(): Promise<PolicyResponse> {
  const res = await api.get<PolicyResponse>('/policy');
  return res.data;
}

export async function updatePolicy(mode: PolicyMode): Promise<PolicyResponse> {
  const res = await api.put<PolicyResponse>('/policy', { mode });
  return res.data;
}

// ── Scan & Chat APIs ─────────────────────────────────────────────────────────
export async function sendScan(text: string): Promise<ScanResult> {
  const res = await api.post<ScanResult>('/scan', { text });
  return res.data;
}

export async function sendChat(text: string): Promise<ChatApiResponse> {
  const res = await api.post<ChatApiResponse>('/chat', { text });
  return res.data;
}

// ── Audit & Stats APIs ───────────────────────────────────────────────────────
export async function getAuditLogs(params?: {
  limit?: number;
  offset?: number;
  action?: string;
  type?: string;
}): Promise<AuditResponse> {
  const res = await api.get<AuditResponse>('/audit', { params });
  return res.data;
}

export async function getStats(): Promise<StatsResponse> {
  const res = await api.get<StatsResponse>('/stats');
  return res.data;
}

export default api;
