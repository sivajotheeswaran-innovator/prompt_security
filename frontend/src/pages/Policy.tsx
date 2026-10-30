import React, { useState, useEffect } from 'react';
import { getPolicy, updatePolicy } from '../services/api';
import { PolicyMode } from '../types';
import {
  Sliders,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  AlertTriangle,
  Info,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const Policy: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<PolicyMode>('balanced');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await getPolicy();
      setCurrentMode(data.mode);
    } catch (err) {
      console.error('Failed to load policy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSelectMode = async (mode: PolicyMode) => {
    if (mode === currentMode || saving) return;
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res = await updatePolicy(mode);
      setCurrentMode(res.mode);
      setSuccessMsg(`Active security posture successfully updated to '${mode.toUpperCase()}'.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to update policy:', err);
    } finally {
      setSaving(false);
    }
  };

  const policies = [
    {
      id: 'strict' as PolicyMode,
      name: 'Strict Posture',
      tagline: 'Zero-Trust Defense for High-Compliance Environments',
      color: 'rose',
      borderActive: 'border-rose-500 shadow-rose-500/10',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      redactThreshold: 20,
      blockThreshold: 50,
      rules: [
        'Any Critical finding forces an immediate BLOCK (Aadhaar, cards, API keys)',
        'Prompt Injection attempts automatically trigger a BLOCK',
        'Aggressive redaction starting at Risk Score ≥ 20',
        'Recommended for healthcare, banking, and secret key storage',
      ],
    },
    {
      id: 'balanced' as PolicyMode,
      name: 'Balanced Posture',
      tagline: 'Standard Enterprise Guardrail (Default Setting)',
      color: 'cyan',
      borderActive: 'border-cyan-500 shadow-cyan-500/10',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      redactThreshold: 30,
      blockThreshold: 70,
      rules: [
        'Any Critical finding forces at least REDACT',
        'Prompt Injection attempts automatically trigger a BLOCK',
        'Redacts at Risk Score ≥ 30; Blocks at Risk Score ≥ 70',
        'Recommended for daily enterprise workflows and customer operations',
      ],
    },
    {
      id: 'relaxed' as PolicyMode,
      name: 'Relaxed Posture',
      tagline: 'High Developer Velocity & Internal Research',
      color: 'emerald',
      borderActive: 'border-emerald-500 shadow-emerald-500/10',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      redactThreshold: 50,
      blockThreshold: 90,
      rules: [
        'Any Critical finding forces REDACT before reaching AI',
        'Prompt Injection is ALLOWED but flagged with an active warning badge',
        'High tolerance: Blocks only severe cumulative risks (Score ≥ 90)',
        'Recommended for sandboxed testing, internal QA, and red-team drills',
      ],
    },
  ];

  return (
    <div className="min-h-full bg-[#0a0d14] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f293d] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>Policy Engine & Threshold Controls</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Configure risk thresholds, critical secret overrides, and prompt-injection containment modes
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2.5 animate-fadeIn">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 3 Policy Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {policies.map((p) => {
          const isSelected = currentMode === p.id;
          return (
            <div
              key={p.id}
              onClick={() => handleSelectMode(p.id)}
              className={`p-6 rounded-2xl bg-[#111622] border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 relative overflow-hidden ${
                isSelected
                  ? `${p.borderActive} shadow-xl ring-1 ring-cyan-500/40 bg-[#161d2d]`
                  : 'border-[#1f293d] hover:border-slate-600 hover:bg-[#141b29]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500/20 to-transparent p-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500 text-black">
                    ACTIVE
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      p.id === 'strict'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : p.id === 'balanced'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white font-sans">{p.name}</h2>
                    <span className="text-[10px] font-mono text-slate-400">Mode: '{p.id}'</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{p.tagline}</p>

                {/* Threshold Metric Box */}
                <div className="p-3 rounded-xl bg-[#0d121c] border border-[#1f293d] flex items-center justify-around text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Redact At</span>
                    <span className="text-sm font-bold text-yellow-400">≥ {p.redactThreshold}</span>
                  </div>
                  <div className="w-px h-6 bg-[#1f293d]"></div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Block At</span>
                    <span className="text-sm font-bold text-rose-400">≥ {p.blockThreshold}</span>
                  </div>
                </div>

                {/* Behavioral Rules List */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                    Enforcement Rules:
                  </span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {p.rules.map((rule, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1f293d]">
                <button
                  disabled={isSelected || saving}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold font-mono flex items-center justify-center space-x-2 transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 cursor-default'
                      : 'bg-[#161d2d] hover:bg-cyan-500 hover:text-black text-slate-300 border border-[#1f293d] cursor-pointer'
                  }`}
                >
                  {isSelected ? (
                    <span className="flex items-center space-x-1.5">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Current Mode</span>
                    </span>
                  ) : saving ? (
                    <span>Switching...</span>
                  ) : (
                    <span>Switch to {p.name}</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Severity Weights Table */}
      <div className="p-6 rounded-2xl bg-[#111622] border border-[#1f293d] space-y-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
            Risk Scoring Formulation & Weight Multipliers
          </h2>
        </div>
        <p className="text-xs text-slate-400 font-sans leading-relaxed">
          The risk score is calculated dynamically as{' '}
          <code className="text-cyan-400 font-mono bg-[#0d121c] px-1.5 py-0.5 rounded border border-[#1f293d]">
            Score = min(100, sum(severity_weight × confidence) + bonus)
          </code>
          . Prompt Injection findings add a <span className="text-rose-400 font-mono">+30 risk bonus</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono pt-2">
          <div className="p-3.5 rounded-xl bg-[#0d121c] border border-rose-500/30 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-bold block">Critical (40 pts)</span>
            <p className="text-[11px] text-slate-300">Aadhaar, Credit Card, API Keys, Private Keys, Passwords</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0d121c] border border-orange-500/30 space-y-1">
            <span className="text-[10px] text-orange-400 uppercase font-bold block">High (25 pts)</span>
            <p className="text-[11px] text-slate-300">PAN, UPI IDs, Health/Medical, Customer Lists, Prompt Injection</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0d121c] border border-yellow-500/30 space-y-1">
            <span className="text-[10px] text-yellow-400 uppercase font-bold block">Medium (10 pts)</span>
            <p className="text-[11px] text-slate-300">Person Names, Physical Addresses, Phone Numbers, Emails, IFSC</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0d121c] border border-cyan-500/30 space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-bold block">Low (5 pts)</span>
            <p className="text-[11px] text-slate-300">Confidential Business Strategy, Trade Secrets, Internal Codes</p>
          </div>
        </div>
      </div>
    </div>
  );
};
