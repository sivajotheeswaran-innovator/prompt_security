import React, { useState, useEffect } from 'react';
import { getStats } from '../services/api';
import { StatsResponse } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Layers,
  TrendingUp,
  RefreshCw,
  Clock,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
      setError('Unable to load security analytics. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pieData = stats
    ? [
        { name: 'Blocked', value: stats.blocked, color: '#f43f5e' },
        { name: 'Redacted', value: stats.redacted, color: '#eab308' },
        { name: 'Allowed', value: stats.allowed, color: '#10b981' },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="min-h-full bg-[#0a0d14] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f293d] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Security Operations Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time telemetry across prompt sanitization, risk thresholds, and PII containment
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-[#111622] hover:bg-[#161d2d] border border-[#1f293d] text-xs text-slate-300 font-mono flex items-center space-x-2 transition-colors w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Scans */}
        <div className="p-4 rounded-xl bg-[#111622] border border-[#1f293d] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono">Total Scans</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? '...' : stats?.totalScans ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Scanned by Layer 1 & 2</p>
        </div>

        {/* Blocked */}
        <div className="p-4 rounded-xl bg-[#111622] border border-rose-500/30 space-y-2">
          <div className="flex items-center justify-between text-rose-300">
            <span className="text-xs font-mono">Blocked</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {loading ? '...' : stats?.blocked ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {stats && stats.totalScans > 0
              ? `${Math.round((stats.blocked / stats.totalScans) * 100)}% of total traffic`
              : 'Zero threats contained'}
          </p>
        </div>

        {/* Redacted */}
        <div className="p-4 rounded-xl bg-[#111622] border border-yellow-500/30 space-y-2">
          <div className="flex items-center justify-between text-yellow-300">
            <span className="text-xs font-mono">Redacted</span>
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-yellow-400">
            {loading ? '...' : stats?.redacted ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {stats && stats.totalScans > 0
              ? `${Math.round((stats.redacted / stats.totalScans) * 100)}% sanitized & forwarded`
              : 'Placeholders applied'}
          </p>
        </div>

        {/* Allowed */}
        <div className="p-4 rounded-xl bg-[#111622] border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-xs font-mono">Allowed</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {loading ? '...' : stats?.allowed ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {stats && stats.totalScans > 0
              ? `${Math.round((stats.allowed / stats.totalScans) * 100)}% clean prompts`
              : 'Forwarded as-is'}
          </p>
        </div>

        {/* Average Risk */}
        <div className="p-4 rounded-xl bg-[#111622] border border-[#1f293d] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono">Avg Risk Score</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {loading ? '...' : `${stats?.avgRisk ?? 0}`}
            <span className="text-xs text-slate-500">/100</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Cumulative risk index</p>
        </div>
      </div>

      {/* Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Over Time (Area Chart) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#111622] border border-[#1f293d] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Risk Telemetry Over Time</h2>
              <p className="text-[11px] text-slate-400 font-mono">14-day trailing risk index and scan volume</p>
            </div>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="h-64 w-full">
            {stats?.riskOverTime && stats.riskOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.riskOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d121c',
                      borderColor: '#1f293d',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgRisk"
                    name="Avg Risk Score"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#riskGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                {loading ? 'Loading timeline...' : 'No historical data recorded yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Action Breakdown (Donut Pie Chart) */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-[#1f293d] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Policy Action Distribution</h2>
              <p className="text-[11px] text-slate-400 font-mono">Ratio of allow, redact, and block actions</p>
            </div>
            <PieIcon className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0d121c" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d121c',
                      borderColor: '#1f293d',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-300 font-mono">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 font-mono text-xs text-center">
                {loading ? 'Loading distribution...' : 'Zero action events recorded.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Findings By Category (Bar Chart) */}
      <div className="p-5 rounded-2xl bg-[#111622] border border-[#1f293d] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Sensitive Findings by Category</h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Aggregate detections grouped by type (Aadhaar, PAN, Cards, API Keys, Passwords)
            </p>
          </div>
          <Layers className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="h-64 w-full">
          {stats?.byCategory && stats.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="type" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d121c',
                    borderColor: '#1f293d',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Bar dataKey="count" name="Detection Count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
              {loading ? 'Loading categories...' : 'No PII or credential detections recorded yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
