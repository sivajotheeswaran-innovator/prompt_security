import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import { AuditItem, ScanFinding, PolicyAction } from '../types';
import {
  FileSearch,
  Filter,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Layers,
  Lock,
} from 'lucide-react';

export const Audit: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [selectedItem, setSelectedItem] = useState<AuditItem | null>(null);

  const limit = 15;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        limit,
        offset: page * limit,
        action: actionFilter || undefined,
        type: typeFilter || undefined,
      });
      setLogs(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, typeFilter]);

  const totalPages = Math.ceil(total / limit);

  const getActionBadge = (action: PolicyAction) => {
    switch (action) {
      case 'block':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center w-fit space-x-1">
            <ShieldAlert className="w-3 h-3 mr-1" />
            BLOCK
          </span>
        );
      case 'redact':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex items-center w-fit space-x-1">
            <AlertTriangle className="w-3 h-3 mr-1" />
            REDACT
          </span>
        );
      case 'allow':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center w-fit space-x-1">
            <ShieldCheck className="w-3 h-3 mr-1" />
            ALLOW
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'low':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="min-h-full bg-[#0a0d14] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f293d] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <FileSearch className="w-5 h-5 text-cyan-400" />
            <span>Audit Trail & Privacy Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Immutable audit record of all prompt evaluations. Raw sensitive values are never persisted.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-[#111622] hover:bg-[#161d2d] border border-[#1f293d] text-xs text-slate-300 font-mono flex items-center space-x-2 transition-colors w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#111622] border border-[#1f293d] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filters:</span>
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0d121c] border border-[#1f293d] text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Actions</option>
            <option value="allow">Allow</option>
            <option value="redact">Redact</option>
            <option value="block">Block</option>
          </select>

          {/* Category Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0d121c] border border-[#1f293d] text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Categories</option>
            <option value="aadhaar">Aadhaar</option>
            <option value="pan">PAN Card</option>
            <option value="credit_card">Credit Card</option>
            <option value="phone">Indian Phone</option>
            <option value="email">Email</option>
            <option value="upi">UPI ID</option>
            <option value="api_key">API Key</option>
            <option value="private_key">Private Key</option>
            <option value="password">Password</option>
            <option value="prompt_injection">Prompt Injection</option>
          </select>

          {(actionFilter || typeFilter) && (
            <button
              onClick={() => {
                setActionFilter('');
                setTypeFilter('');
                setPage(0);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono underline underline-offset-2"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-white font-bold">{logs.length}</span> of{' '}
          <span className="text-white font-bold">{total}</span> records
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-[#111622] border border-[#1f293d] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d121c] text-slate-400 uppercase font-mono tracking-wider border-b border-[#1f293d]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Categories Detected</th>
                <th className="py-3 px-4">Fully Redacted Prompt Stored</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f293d]/50 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                    Querying audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    <FileSearch className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-[#161d2d]/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">{getActionBadge(item.action)}</td>
                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={`font-bold ${
                          item.riskScore >= 70
                            ? 'text-rose-400'
                            : item.riskScore >= 40
                            ? 'text-orange-400'
                            : item.riskScore >= 20
                            ? 'text-yellow-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {item.riskScore}
                      </span>
                      <span className="text-slate-500 text-[10px]">/100</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {item.categories && item.categories.length > 0 ? (
                          item.categories.map((cat, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700"
                            >
                              {cat}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">None (Clean)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 max-w-xs truncate">
                      <span title={item.redactedPrompt}>{item.redactedPrompt}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="p-1.5 rounded-lg bg-[#0d121c] hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-[#1f293d] group-hover:border-cyan-500/30 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#1f293d] flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Page <span className="text-white font-bold">{page + 1}</span> of{' '}
            <span className="text-white font-bold">{Math.max(1, totalPages)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded bg-[#0d121c] border border-[#1f293d] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded bg-[#0d121c] border border-[#1f293d] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Findings Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111622] border border-[#1f293d] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1f293d] pb-4">
              <div className="flex items-center space-x-2.5">
                <FileSearch className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  Scan Telemetry Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#161d2d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#0d121c] border border-[#1f293d]">
                <span className="text-slate-500 block text-[10px]">Action</span>
                <span className="font-bold text-white">{getActionBadge(selectedItem.action)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0d121c] border border-[#1f293d]">
                <span className="text-slate-500 block text-[10px]">Risk Score</span>
                <span className="font-bold text-white text-base">{selectedItem.riskScore}/100</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0d121c] border border-[#1f293d]">
                <span className="text-slate-500 block text-[10px]">Scan Latency</span>
                <span className="font-bold text-cyan-400">{selectedItem.latencyMs} ms</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0d121c] border border-[#1f293d]">
                <span className="text-slate-500 block text-[10px]">Layer 2 AI Status</span>
                <span className="font-bold text-emerald-400">
                  {selectedItem.aiLayerOk ? 'Fused (L1+L2)' : 'L1 Active'}
                </span>
              </div>
            </div>

            {/* Stored Fully Masked Prompt */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 font-mono">
                Persisted Redacted Prompt (scans.redacted_prompt):
              </span>
              <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-[#1f293d] font-mono text-emerald-400 text-xs leading-relaxed whitespace-pre-wrap">
                {selectedItem.redactedPrompt}
              </div>
            </div>

            {/* Granular Findings List */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-300 font-mono">
                Detected Findings ({selectedItem.findings.length}):
              </span>

              {selectedItem.findings.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#0a0d14] border border-[#1f293d] text-center text-xs text-slate-400 font-mono">
                  No sensitive patterns identified. Clean prompt forwarded.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItem.findings.map((f, i) => (
                    <div
                      key={f.id || i}
                      className="p-3 rounded-xl bg-[#0a0d14] border border-[#1f293d] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${getSeverityBadge(
                            f.severity
                          )}`}
                        >
                          {f.type} • {f.severity}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Confidence: {Math.round(f.confidence * 100)}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 font-mono">
                        <span className="text-slate-400 text-[11px]">Masked Preview:</span>
                        <span className="text-slate-200 bg-[#111622] px-2 py-0.5 rounded border border-[#1f293d]">
                          {f.maskedPreview}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 font-sans leading-normal pt-1 border-t border-[#1f293d]/50">
                        {f.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-lg bg-[#161d2d] hover:bg-[#1f293d] text-slate-300 text-xs font-mono transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
