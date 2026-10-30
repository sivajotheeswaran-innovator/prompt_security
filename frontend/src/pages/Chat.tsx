import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { sendChat } from '../services/api';
import { ChatMessage, ScanFinding, ScanResult, Severity } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Send,
  AlertTriangle,
  Eye,
  FileCode,
  Info,
  Clock,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeScan, setActiveScan] = useState<{ scan: ScanResult; originalText: string } | null>(null);
  const [viewMode, setViewMode] = useState<'highlighted' | 'gemini_received'>('highlighted');
  const [panelOpen, setPanelOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Check if routed from /redteam with prefilled attack text
  useEffect(() => {
    const prefill = (location.state as any)?.prefill;
    if (prefill) {
      setInput(prefill);
      // clear state so it doesn't re-fill
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await sendChat(userText);

      // Attach scan result to user message
      userMessage.scan = response.scan;
      userMessage.blocked = response.blocked;

      setActiveScan({ scan: response.scan, originalText: userText });

      if (response.blocked) {
        // Assistant message notes blocked status
        const blockedMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: '⚠️ This prompt was BLOCKED by TrustLayer security policy. No sensitive data was transmitted to Gemini.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          blocked: true,
        };
        setMessages((prev) => [...prev.slice(0, -1), userMessage, blockedMsg]);
      } else {
        const botMessage: ChatMessage = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: response.reply || 'No reply generated.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          blocked: false,
        };
        setMessages((prev) => [...prev.slice(0, -1), userMessage, botMessage]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `bot_err_${Date.now()}`,
        role: 'assistant',
        content: 'Error: Failed to process prompt through security gateway. Please verify network or credentials.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: Severity) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/30';
      case 'low':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'block':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            BLOCKED
          </span>
        );
      case 'redact':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            REDACTED
          </span>
        );
      case 'allow':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            ALLOWED
          </span>
        );
      default:
        return null;
    }
  };

  // Helper to slice text and highlight findings based on startIdx and endIdx
  const renderHighlightedText = (originalText: string, findings: ScanFinding[]) => {
    if (!findings || findings.length === 0) {
      return <span className="text-slate-300">{originalText}</span>;
    }

    // Sort findings ascending by startIdx
    const sorted = [...findings].sort((a, b) => a.startIdx - b.startIdx);
    const elements: React.ReactNode[] = [];
    let currentIdx = 0;

    sorted.forEach((f, idx) => {
      // Preceding clean text
      if (f.startIdx > currentIdx) {
        elements.push(
          <span key={`clean_${idx}`} className="text-slate-300">
            {originalText.slice(currentIdx, f.startIdx)}
          </span>
        );
      }

      // Highlighted sensitive span
      const matchedText = originalText.slice(f.startIdx, f.endIdx);
      elements.push(
        <mark
          key={`finding_${f.id || idx}`}
          className={`inline-block px-1.5 py-0.5 rounded border text-xs font-mono font-medium mx-0.5 transition-all cursor-pointer ${getSeverityColor(
            f.severity
          )}`}
          title={`${f.type.toUpperCase()} (${f.severity}) — ${f.explanation}`}
        >
          {matchedText}
        </mark>
      );

      currentIdx = Math.max(currentIdx, f.endIdx);
    });

    if (currentIdx < originalText.length) {
      elements.push(
        <span key="clean_tail" className="text-slate-300">
          {originalText.slice(currentIdx)}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0d14]">
      {/* ── Left Column: Chat Conversation Stream ─────────────────────────── */}
      <div className="flex-1 flex flex-col h-full border-r border-[#1f293d] min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-3.5 border-b border-[#1f293d] bg-[#111622]/50 backdrop-blur flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">TrustLayer Gateway Session</h1>
              <p className="text-[11px] text-slate-400 font-mono">
                Single-turn protected gateway • All prompts inspected before dispatch
              </p>
            </div>
          </div>

          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="lg:hidden text-xs px-2.5 py-1.5 rounded-lg bg-[#161d2d] text-cyan-400 border border-[#1f293d]"
          >
            {panelOpen ? 'Hide Inspector' : 'Show Inspector'}
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-white mb-2">Ready to Secure Prompts</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Paste any prompt containing credit cards, PAN, Aadhaar, API keys, or customer records.
                TrustLayer will sanitize it in real-time before forwarding to Gemini.
              </p>
              <div className="w-full space-y-2 text-left font-mono text-xs">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-sans font-semibold">
                  Quick Examples:
                </p>
                <button
                  onClick={() =>
                    setInput(
                      'Please contact customer Ravi at 9876543210 (PAN: ABCPG1234H) regarding project alpha.'
                    )
                  }
                  className="w-full p-2.5 rounded-lg bg-[#111622] hover:bg-[#161d2d] border border-[#1f293d] text-slate-300 text-left transition-colors flex items-center justify-between group"
                >
                  <span className="truncate">Contact Ravi at 9876543210 (PAN: ABCPG1234H)...</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() =>
                    setInput('Deploy the production database using AWS key AKIAIOSFODNN7EXAMPLE')
                  }
                  className="w-full p-2.5 rounded-lg bg-[#111622] hover:bg-[#161d2d] border border-[#1f293d] text-slate-300 text-left transition-colors flex items-center justify-between group"
                >
                  <span className="truncate">Deploy using AWS key AKIAIOSFODNN7...</span>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex space-x-3 max-w-3xl ${
                  msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.blocked
                        ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`space-y-1.5 max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {/* Message Bubble */}
                  <div
                    onClick={() => {
                      if (msg.scan && msg.role === 'user') {
                        setActiveScan({ scan: msg.scan, originalText: msg.content });
                      }
                    }}
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all cursor-pointer ${
                      msg.role === 'user'
                        ? 'bg-[#161d2d] border border-cyan-500/30 text-white shadow-lg shadow-cyan-950/20 rounded-tr-none'
                        : msg.blocked
                        ? 'bg-rose-950/30 border border-rose-500/30 text-rose-200 rounded-tl-none font-mono text-xs'
                        : 'bg-[#111622] border border-[#1f293d] text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Badge on user message */}
                    {msg.scan && (
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Risk Score: {msg.scan.riskScore}/100</span>
                        {getActionBadge(msg.scan.action)}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 px-1 font-mono">{msg.timestamp}</div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex space-x-3 items-center mr-auto text-slate-400 text-xs font-mono">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl bg-[#111622] border border-[#1f293d] flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>Scanning prompt & routing through TrustLayer...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#1f293d] bg-[#111622]/50 backdrop-blur">
          <form onSubmit={handleSend} className="relative flex items-center">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything or paste sensitive data (Aadhaar, cards, API keys, patient records)..."
              className="w-full pl-4 pr-24 py-3 bg-[#0d121c] border border-[#1f293d] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors resize-none font-sans"
            />
            <div className="absolute right-3 flex items-center space-x-2">
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>API SLA: 10s timeout clamp</span>
          </div>
        </div>
      </div>

      {/* ── Right Column: Live Security Inspector Side Panel ──────────────── */}
      {panelOpen && (
        <div className="w-full lg:w-[420px] shrink-0 h-full overflow-y-auto bg-[#0d121c] border-l border-[#1f293d] flex flex-col">
          {/* Panel Header */}
          <div className="px-5 py-3.5 border-b border-[#1f293d] bg-[#111622] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Security Inspector
              </h2>
            </div>
            {activeScan && getActionBadge(activeScan.scan.action)}
          </div>

          {activeScan ? (
            <div className="p-5 space-y-6">
              {/* Prompt Injection Alert */}
              {activeScan.scan.injectionWarning && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-200 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Prompt Injection Detected:</span>
                    <p className="text-[11px] text-orange-300 mt-0.5">
                      Flagged under Relaxed policy. Proceed with extreme caution.
                    </p>
                  </div>
                </div>
              )}

              {/* Risk Gauge (0-100) */}
              <div className="p-4 rounded-xl bg-[#111622] border border-[#1f293d] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Calculated Risk Score
                  </span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      activeScan.scan.riskScore >= 70
                        ? 'text-rose-400'
                        : activeScan.scan.riskScore >= 40
                        ? 'text-orange-400'
                        : activeScan.scan.riskScore >= 20
                        ? 'text-yellow-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeScan.scan.riskScore}
                    <span className="text-xs text-slate-500">/100</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-[#0a0d14] rounded-full overflow-hidden p-0.5 border border-[#1f293d]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeScan.scan.riskScore >= 70
                        ? 'bg-rose-500 shadow-sm shadow-rose-500'
                        : activeScan.scan.riskScore >= 40
                        ? 'bg-orange-500'
                        : activeScan.scan.riskScore >= 20
                        ? 'bg-yellow-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(4, activeScan.scan.riskScore)}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 (Safe)</span>
                  <span>Balanced Threshold: 30 / 70</span>
                  <span>100 (Critical)</span>
                </div>
              </div>

              {/* View Mode Toggle: Highlighted vs Redacted */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Prompt Transparency
                  </span>
                  <div className="flex bg-[#111622] p-0.5 rounded-lg border border-[#1f293d]">
                    <button
                      onClick={() => setViewMode('highlighted')}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                        viewMode === 'highlighted'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Original Findings
                    </button>
                    <button
                      onClick={() => setViewMode('gemini_received')}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                        viewMode === 'gemini_received'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gemini Received
                    </button>
                  </div>
                </div>

                {/* Text View Container */}
                <div className="p-3.5 rounded-xl bg-[#111622] border border-[#1f293d] text-xs leading-relaxed font-sans">
                  {viewMode === 'highlighted' ? (
                    <div>
                      <p className="text-[11px] text-slate-400 mb-2 font-mono flex items-center space-x-1">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Highlighted sensitive spans in your prompt:</span>
                      </p>
                      <div className="bg-[#0a0d14] p-3 rounded-lg border border-[#1f293d] overflow-x-auto">
                        {renderHighlightedText(
                          activeScan.originalText,
                          activeScan.scan.findings
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] text-slate-400 mb-2 font-mono flex items-center space-x-1">
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Exact payload dispatched to upstream AI:</span>
                      </p>
                      <div className="bg-[#0a0d14] p-3 rounded-lg border border-[#1f293d] font-mono text-emerald-400 text-xs overflow-x-auto whitespace-pre-wrap">
                        {activeScan.scan.action === 'block' ? (
                          <span className="text-rose-400 italic font-mono">
                            [Prompt BLOCKED: Nothing was sent to Gemini]
                          </span>
                        ) : (
                          activeScan.scan.redactedText
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Detected Findings Breakdown List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Detected Findings ({activeScan.scan.findings.length})
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {activeScan.scan.aiLayerOk ? 'Layer 1 & 2 Fusion' : 'Layer 1 Deterministic'}
                  </span>
                </div>

                {activeScan.scan.findings.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#1f293d] text-center text-xs text-slate-400">
                    <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                    Zero sensitive findings detected. Safe to forward.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeScan.scan.findings.map((f, i) => (
                      <div
                        key={f.id || i}
                        className="p-3 rounded-xl bg-[#111622] border border-[#1f293d] space-y-1.5 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${getSeverityColor(
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
                          <span className="text-slate-400 text-[11px]">Preview:</span>
                          <span className="text-slate-200 bg-[#0a0d14] px-1.5 py-0.5 rounded border border-[#1f293d]">
                            {f.maskedPreview}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-normal pt-1 border-t border-[#1f293d]">
                          {f.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-64 space-y-3 font-mono">
              <Info className="w-8 h-8 text-slate-600" />
              <p>Submit a prompt or click any message bubble to inspect real-time detection telemetry.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
