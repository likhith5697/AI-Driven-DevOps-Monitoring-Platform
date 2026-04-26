import { useState, useRef, useEffect } from "react";

const API_BASE = "http://localhost:5000";

const INTENT_COLORS = {
  system_health:     { bg: "#0f2a1a", accent: "#22c55e", label: "System Health" },
  order_failure_rca: { bg: "#2a0f0f", accent: "#ef4444", label: "RCA" },
  order_trace:       { bg: "#0f1a2a", accent: "#3b82f6", label: "Trace" },
  metrics_question:  { bg: "#1a1a0f", accent: "#eab308", label: "Metrics" },
  log_search:        { bg: "#1a0f2a", accent: "#a855f7", label: "Log Search" },
  unknown:           { bg: "#1a1a1a", accent: "#6b7280", label: "Unknown" },
};

const STATUS_CONFIG = {
  HEALTHY:  { color: "#22c55e", glow: "0 0 12px #22c55e44" },
  DEGRADED: { color: "#eab308", glow: "0 0 12px #eab30844" },
  CRITICAL: { color: "#ef4444", glow: "0 0 12px #ef444444" },
  UNKNOWN:  { color: "#6b7280", glow: "0 0 12px #6b728044" },
};

const SAMPLE_QUESTIONS = [
  "Why are orders failing?",
  "System health status",
  "How many requests hit order service in last 1 hour?",
  "Search recent error logs",
];

function TerminalCursor() {
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVis(v => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      display: "inline-block", width: 8, height: 16,
      background: vis ? "#22c55e" : "transparent",
      marginLeft: 2, verticalAlign: "middle",
      transition: "background 0.1s",
    }}/>
  );
}

function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: 0.4,
        animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
      }}/>
      <span style={{
        position: "relative", width: 10, height: 10,
        borderRadius: "50%", background: color,
        boxShadow: `0 0 6px ${color}`,
      }}/>
    </span>
  );
}

function StepTrace({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#4b5563", marginBottom: 8, fontFamily: "monospace" }}>
        EXECUTION TRACE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 10px",
            background: step.success ? "#0a1a0a" : "#1a0a0a",
            border: `1px solid ${step.success ? "#1a3a1a" : "#3a1a1a"}`,
            borderRadius: 6, fontFamily: "monospace",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: step.success ? "#22c55e" : "#ef4444",
              boxShadow: step.success ? "0 0 4px #22c55e" : "0 0 4px #ef4444",
            }}/>
            <span style={{ fontSize: 11, color: "#9ca3af", flex: 1 }}>{step.tool}</span>
            <span style={{ fontSize: 10, color: step.success ? "#22c55e88" : "#ef444488" }}>
              {step.latency_ms}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseAnswer(answer) {
  if (!answer) return {};
  const statusMatch = answer.match(/Status:\s*(HEALTHY|DEGRADED|CRITICAL|UNKNOWN)/i);
  const summaryMatch = answer.match(/Summary:\s*([\s\S]*?)(?=Evidence:|Root Cause:|Recommendation:|$)/i);
  const evidenceMatch = answer.match(/Evidence:\s*([\s\S]*?)(?=Root Cause:|Recommendation:|$)/i);
  const rootCauseMatch = answer.match(/Root Cause:\s*([\s\S]*?)(?=Recommendation:|$)/i);
  const recommendMatch = answer.match(/Recommendation:\s*([\s\S]*?)$/i);
  return {
    status: statusMatch?.[1]?.toUpperCase() || "UNKNOWN",
    summary: summaryMatch?.[1]?.trim() || "",
    evidence: evidenceMatch?.[1]?.trim() || "",
    rootCause: rootCauseMatch?.[1]?.trim() || "",
    recommendation: recommendMatch?.[1]?.trim() || "",
    raw: answer,
  };
}

function AnswerCard({ message }) {
  const parsed = parseAnswer(message.answer);
  const sc = STATUS_CONFIG[parsed.status] || STATUS_CONFIG.UNKNOWN;
  const ic = INTENT_COLORS[message.intent] || INTENT_COLORS.unknown;

  return (
    <div style={{
      background: "#0d0d0d",
      border: "1px solid #1f1f1f",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: ic.bg,
        borderBottom: "1px solid #1f1f1f",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PulsingDot color={ic.accent}/>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: ic.accent, letterSpacing: "0.1em" }}>
            {ic.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: sc.color,
            fontFamily: "monospace", letterSpacing: "0.08em",
            textShadow: sc.glow,
          }}>
            {parsed.status}
          </span>
          <span style={{ fontSize: 10, color: "#374151", fontFamily: "monospace" }}>
            {message.latency_ms}ms
          </span>
        </div>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Question */}
        <div style={{
          fontSize: 13, color: "#9ca3af", marginBottom: 12,
          fontFamily: "'DM Mono', monospace",
          paddingBottom: 12, borderBottom: "1px solid #1a1a1a",
        }}>
          <span style={{ color: "#22c55e", marginRight: 8 }}>›</span>
          {message.question}
        </div>

        {/* Summary */}
        {parsed.summary && (
          <p style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.7, marginBottom: 12 }}>
            {parsed.summary}
          </p>
        )}

        {/* Evidence */}
        {parsed.evidence && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#4b5563", marginBottom: 6, fontFamily: "monospace" }}>
              EVIDENCE
            </div>
            <div style={{
              background: "#0a0a0a", border: "1px solid #1a1a1a",
              borderRadius: 6, padding: "10px 12px",
              fontSize: 12, color: "#9ca3af", fontFamily: "monospace",
              lineHeight: 1.8, whiteSpace: "pre-wrap",
            }}>
              {parsed.evidence}
            </div>
          </div>
        )}

        {/* Root Cause */}
        {parsed.rootCause && (
  <div style={{ marginBottom: 12 }}>
    <div style={{ 
      fontSize: 10, letterSpacing: "0.12em", 
      // red only if there's an actual problem
      color: parsed.status === "HEALTHY" ? "#22c55e66" : "#ef444466", 
      marginBottom: 6, fontFamily: "monospace" 
    }}>
      ROOT CAUSE
    </div>
    <div style={{
      // green background when healthy, red when not
      background: parsed.status === "HEALTHY" ? "#0a1a0a" : "#1a0a0a", 
      border: `1px solid ${parsed.status === "HEALTHY" ? "#1a3a1a" : "#3a1a1a"}`,
      borderRadius: 6, padding: "10px 12px",
      fontSize: 12, 
      color: parsed.status === "HEALTHY" ? "#86efac" : "#fca5a5",
      fontFamily: "monospace",
      lineHeight: 1.8, whiteSpace: "pre-wrap",
    }}>
      {parsed.rootCause}
    </div>
  </div>
)}

        {/* Recommendation */}
        {parsed.recommendation && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#22c55e66", marginBottom: 6, fontFamily: "monospace" }}>
              RECOMMENDATION
            </div>
            <div style={{
              background: "#0a1a0a", border: "1px solid #1a3a1a",
              borderRadius: 6, padding: "10px 12px",
              fontSize: 12, color: "#86efac", fontFamily: "monospace",
              lineHeight: 1.8, whiteSpace: "pre-wrap",
            }}>
              {parsed.recommendation}
            </div>
          </div>
        )}

        <StepTrace steps={message.steps}/>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: "#0d0d0d",
      border: "1px solid #1f1f1f",
      borderRadius: 10, padding: "14px 16px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.6,
      }}/>
      <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
          {value ?? "—"}
        </span>
        {unit && <span style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: "#374151", marginTop: 4, fontFamily: "monospace" }}>{sub}</div>}
    </div>
  );
}

function ServiceBadge({ name, status }) {
  const color = status === "up" ? "#22c55e" : status === "degraded" ? "#eab308" : "#ef4444";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      background: "#0d0d0d", border: "1px solid #1f1f1f",
      borderRadius: 8,
    }}>
      <PulsingDot color={color}/>
      <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{name}</span>
      <span style={{ fontSize: 10, color, marginLeft: "auto", fontFamily: "monospace", letterSpacing: "0.05em" }}>
        {status.toUpperCase()}
      </span>
    </div>
  );
}

export default function ObservAI() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ask?question=system health`);
      const data = await res.json();
      setHealthData(data);
    } catch {
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const ask = async (q) => {
    const trimmed = (q || question).trim();
    if (!trimmed || loading) return;
    setQuestion("");
    setLoading(true);
    setMessages(prev => [...prev, { type: "user", question: trimmed, id: Date.now() }]);

    try {
      const res = await fetch(`${API_BASE}/ask?question=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        type: "answer", question: trimmed, ...data, id: Date.now() + 1,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        type: "error", question: trimmed, answer: "Connection failed. Is the agent running on localhost:5000?",
        id: Date.now() + 1,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const extractMetrics = () => {
    if (!healthData?.steps) return null;
    const metricsStep = healthData.steps.find(s => s.tool === "get_service_health");
    return metricsStep?.result || null;
  };

  const metrics = extractMetrics();
  const httpMetrics = metrics?.http_requests;
  const parsed = parseAnswer(healthData?.answer || "");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      color: "#e5e7eb",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 2px; }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .msg-enter { animation: fadeSlideIn 0.3s ease forwards; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        button:hover { opacity: 0.85; }
        button:active { transform: scale(0.97); }
        .chip:hover { background: #1f1f1f !important; cursor: pointer; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
        borderBottom: "1px solid #111",
        background: "#0a0a0a",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#000",
          }}>O</div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "#f9fafb" }}>
            ObservAI
          </span>
          <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace", marginLeft: 4 }}>
            SRE Agent
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PulsingDot color={parsed.status === "HEALTHY" ? "#22c55e" : parsed.status === "CRITICAL" ? "#ef4444" : "#eab308"}/>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>
              {parsed.status || "CHECKING"}
            </span>
          </div>
          <button
            onClick={fetchHealth}
            style={{
              background: "none", border: "1px solid #1f1f1f",
              color: "#6b7280", fontSize: 11, padding: "4px 10px",
              borderRadius: 6, cursor: "pointer", fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}
          >
            {healthLoading ? "↻ refreshing" : "↻ refresh"}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 56px)" }}>

        {/* Left panel — metrics */}
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: "1px solid #111",
          background: "#090909",
          overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {/* Services */}
          <div>
            <div style={{ fontSize: 10, color: "#374151", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
              SERVICES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["order-service", "payment-service", "inventory-service"].map(svc => (
                <ServiceBadge
                  key={svc}
                  name={svc}
                  status={
                    healthData
                      ? (httpMetrics?.fail > 0 ? "degraded" : "up")
                      : "unknown"
                  }
                />
              ))}
            </div>
          </div>

          {/* HTTP metrics */}
          <div>
            <div style={{ fontSize: 10, color: "#374151", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
              LAST 60 MIN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <MetricCard
                label="TOTAL REQUESTS"
                value={httpMetrics?.total != null ? Math.round(httpMetrics.total) : null}
                color="#3b82f6"
              />
              <MetricCard
                label="SUCCESS RATE"
                value={httpMetrics?.success_rate != null ? `${httpMetrics.success_rate.toFixed(1)}` : null}
                unit="%"
                color="#22c55e"
              />
              <MetricCard
                label="FAILURES"
                value={httpMetrics?.fail != null ? Math.round(httpMetrics.fail) : null}
                color="#ef4444"
                sub={httpMetrics?.fail > 0 ? "investigate →" : "all clear"}
              />
            </div>
          </div>

          {/* Agent stats from last query */}
          {messages.length > 0 && (() => {
            const last = [...messages].reverse().find(m => m.type === "answer");
            return last ? (
              <div>
                <div style={{ fontSize: 10, color: "#374151", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
                  LAST QUERY
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <MetricCard
                    label="LATENCY"
                    value={last.latency_ms != null ? Math.round(last.latency_ms) : null}
                    unit="ms"
                    color="#a855f7"
                  />
                  <MetricCard
                    label="TOOLS CALLED"
                    value={last.steps?.length ?? null}
                    color="#eab308"
                    sub={`intent: ${last.intent || "—"}`}
                  />
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Right panel — chat */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "24px 28px",
          }}>
            {messages.length === 0 && (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                height: "100%", gap: 24, textAlign: "center",
              }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: "#1f2937", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Ask your infrastructure
                  </div>
                  <div style={{ fontSize: 14, color: "#374151", fontFamily: "'DM Mono', monospace" }}>
                    Natural language → logs + metrics → root cause
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500 }}>
                  {SAMPLE_QUESTIONS.map(q => (
                    <button
                      key={q}
                      className="chip"
                      onClick={() => ask(q)}
                      style={{
                        background: "#0d0d0d", border: "1px solid #1f1f1f",
                        color: "#6b7280", fontSize: 12, padding: "8px 14px",
                        borderRadius: 20, cursor: "pointer",
                        fontFamily: "'DM Mono', monospace",
                        transition: "background 0.15s",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={msg.id} className="msg-enter" style={{ animationDelay: `${i * 0.02}s` }}>
                {msg.type === "user" && (
                  <div style={{
                    display: "flex", justifyContent: "flex-end", marginBottom: 8,
                  }}>
                    <div style={{
                      background: "#111", border: "1px solid #1f1f1f",
                      borderRadius: "12px 12px 2px 12px",
                      padding: "10px 16px", maxWidth: "70%",
                      fontSize: 14, color: "#d1d5db",
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      <span style={{ color: "#22c55e", marginRight: 8 }}>›</span>
                      {msg.question}
                    </div>
                  </div>
                )}
                {msg.type === "answer" && <AnswerCard message={msg}/>}
                {msg.type === "error" && (
                  <div style={{
                    background: "#1a0a0a", border: "1px solid #3a1a1a",
                    borderRadius: 10, padding: "12px 16px", marginBottom: 16,
                    fontSize: 13, color: "#fca5a5", fontFamily: "monospace",
                  }}>
                    ✕ {msg.answer}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="msg-enter" style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: "#0d0d0d", border: "1px solid #1f1f1f",
                borderRadius: 10, marginBottom: 16,
              }}>
                <div style={{
                  width: 14, height: 14, border: "2px solid #1f1f1f",
                  borderTopColor: "#22c55e", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}/>
                <span style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace" }}>
                  Agent reasoning
                </span>
                <TerminalCursor/>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Input area */}
          <div style={{
            borderTop: "1px solid #111",
            padding: "16px 28px",
            background: "#090909",
          }}>
            <div style={{
              display: "flex", gap: 12, alignItems: "flex-end",
              background: "#0d0d0d",
              border: "1px solid #1f1f1f",
              borderRadius: 12, padding: "12px 16px",
              transition: "border-color 0.15s",
            }}
              onFocus={() => {}}
            >
              <span style={{ fontSize: 14, color: "#22c55e", fontFamily: "monospace", paddingBottom: 2 }}>›</span>
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask anything about your system..."
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none",
                  color: "#e5e7eb", fontSize: 14,
                  fontFamily: "'DM Mono', monospace",
                  lineHeight: 1.6, paddingTop: 1,
                  caretColor: "#22c55e",
                  "::placeholder": { color: "#374151" },
                }}
              />
              <button
                onClick={() => ask()}
                disabled={!question.trim() || loading}
                style={{
                  background: question.trim() && !loading ? "#22c55e" : "#1f1f1f",
                  border: "none", borderRadius: 8,
                  width: 32, height: 32, flexShrink: 0,
                  cursor: question.trim() && !loading ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s",
                  fontSize: 14, color: question.trim() && !loading ? "#000" : "#374151",
                }}
              >
                ↑
              </button>
            </div>
            <div style={{
              fontSize: 10, color: "#1f2937", fontFamily: "monospace",
              textAlign: "center", marginTop: 8, letterSpacing: "0.05em",
            }}>
              ENTER to send · SHIFT+ENTER for new line · connects to localhost:5000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}