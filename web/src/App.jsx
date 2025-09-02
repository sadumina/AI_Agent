import { useEffect, useMemo, useState } from "react";

// Configure your backend URL via Vite env or fallback to localhost
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// --- API call to your FastAPI backend ---
async function runAgent({ query, noSearch, maxResults, demoMode }) {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      no_search: noSearch,
      max_results: maxResults,
      seed_urls: [],
      force_local: false,
      demo_mode: demoMode,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// --- Helpers ---
function safeUrlParts(raw) {
  try {
    const u = new URL(String(raw));
    return {
      host: u.hostname.replace(/^www\./, ""),
      path: (u.pathname + u.search).replace(/\/$/, "") || "/",
    };
  } catch {
    return { host: "link", path: String(raw) };
  }
}

const SourceCard = ({ url, idx }) => {
  const { host, path } = safeUrlParts(url);
  return (
    <a
      href={String(url)}
      className="src"
      target="_blank"
      rel="noopener noreferrer"
      title={String(url)}
    >
      <div className="src-head">[{idx}] {host}</div>
      <div className="src-link">{path}</div>
    </a>
  );
};

export default function App() {
  const [query, setQuery] = useState(
    "PFAS drinking water limits; compare GAC vs IX (EBCT & costs)"
  );
  const [noSearch, setNoSearch] = useState(false);
  const [maxResults, setMaxResults] = useState(3);
  const [demoMode, setDemoMode] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [theme, setTheme] = useState(
    window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ? "dark"
      : "light"
  );

  // Respect OS preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Persist theme choice per session
  useEffect(() => {
    const saved = sessionStorage.getItem("pfas-theme");
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => sessionStorage.setItem("pfas-theme", theme), [theme]);

  const colors = useMemo(
    () =>
      theme === "dark"
        ? {
            bg: "#0f1419",
            surface: "#121823",
            surfaceElevated: "#1a2130",
            border: "#2a3444",
            text: "#e7eef7",
            textMuted: "#a6b2c2",
            primary: "#22c55e",
            primaryHover: "#16a34a",
            primarySubtle: "#14351e",
            accent: "#2f855a",
            gray: "#4b5563",
            ring: "rgba(34,197,94,0.45)",
          }
        : {
            bg: "#f6f8fb",
            surface: "#ffffff",
            surfaceElevated: "#f9fafb",
            border: "#e5e7eb",
            text: "#1f2937",
            textMuted: "#6b7280",
            primary: "#22c55e",
            primaryHover: "#16a34a",
            primarySubtle: "#e8f7ee",
            accent: "#2f855a",
            gray: "#9ca3af",
            ring: "rgba(34,197,94,0.45)",
          },
    [theme]
  );

  async function onRun() {
    if (!query.trim()) return;
    setLoading(true);
    setStatus("Running analysis…");
    setErrorMsg("");
    setAnswer("");
    setSources([]);

    try {
      const data = await runAgent({ query, noSearch, maxResults, demoMode });
      if (data.error) setErrorMsg(String(data.error));
      setAnswer(data.answer || "No answer received");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setStatus("Analysis complete");
      setTimeout(() => setStatus(""), 2500);
    } catch (e) {
      setErrorMsg(e.message || "Request failed");
      setStatus(`Error: ${e.message}`);
      setTimeout(() => setStatus(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRun();
  };

  const copyAnswer = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setStatus("Copied to clipboard");
    setTimeout(() => setStatus(""), 1500);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([answer || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pfas_analysis_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app" data-theme={theme} style={{ background: colors.bg, color: colors.text }}>
      {/* Global CSS (no external deps) */}
      <style>{`
        :root{
          --bg:${colors.bg};
          --surface:${colors.surface};
          --surfaceElevated:${colors.surfaceElevated};
          --border:${colors.border};
          --text:${colors.text};
          --textMuted:${colors.textMuted};
          --primary:${colors.primary};
          --primaryHover:${colors.primaryHover};
          --primarySubtle:${colors.primarySubtle};
          --accent:${colors.accent};
          --gray:${colors.gray};
          --ring:${colors.ring};
        }
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;width:100%}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;}
        #root{max-width:none !important;margin:0 !important;padding:0 !important;text-align:initial !important;width:100% !important;}
        .app{min-height:100vh;display:flex;flex-direction:column;width:100%}

        /* Header */
        .hero{background:linear-gradient(135deg,var(--primary),#2f855a); padding:36px 16px;}
        .hero-inner{max-width:1200px;margin:0 auto;text-align:center;color:#fff;padding:0 16px;}
        .title{font-size:clamp(24px,4vw,40px);font-weight:800;letter-spacing:0.2px;text-shadow:0 2px 4px rgba(0,0,0,.1)}
        .subtitle{margin:8px 0 0;opacity:.95;font-weight:400}
        .toolbar{margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .pill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.15);font-size:12px}

        /* Container */
        .container{max-width:1200px;margin:0 auto;padding:24px 16px;flex:1;width:100%}

        /* Card */
        .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 6px 15px rgba(0,0,0,0.05);width:100%}
        .card.pad{padding:24px}
        .card h3{margin-bottom:16px;font-size:20px}

        /* Inputs */
        label.lbl{font-weight:600;display:block;margin-bottom:8px}
        textarea.query{width:100%;min-height:120px;padding:14px;border-radius:12px;border:2px solid var(--border);background:var(--surfaceElevated);color:var(--text);font:inherit;resize:vertical;outline:none;transition:border-color .2s}
        textarea.query:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}
        .hint{font-size:12.5px;color:var(--textMuted);margin-top:6px}

        /* Options */
        .options{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:16px 0;width:100%}
        .opt{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--surfaceElevated);}
        .opt:hover{border-color:var(--primary)}
        .opt input[type="checkbox"]{width:18px;height:18px;accent-color:var(--primary)}
        .opt .opthead{font-weight:600}
        .opt .optsub{font-size:13px;color:var(--textMuted)}

        /* Range */
        .range{margin:12px 0 20px;width:100%}
        input[type=range]{width:100%;accent-color:var(--primary)}

        /* Buttons */
        .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;width:100%}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border:none;border-radius:12px;font-weight:700;color:#fff;background:var(--primary);cursor:pointer;transition:transform .15s ease, background .2s}
        .btn:disabled{cursor:not-allowed;background:var(--gray)}
        .btn:not(:disabled):hover{transform:translateY(-1px);background:var(--primaryHover)}
        .btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
        .btn-ghost:hover{border-color:var(--primary);color:var(--primary)}

        /* Alerts */
        .alert{border-radius:12px;border:1px solid;padding:12px 14px;margin-bottom:12px}
        .alert.err{background:rgba(239,68,68,.08);color:#ef4444;border-color:rgba(239,68,68,.25)}
        .alert small{opacity:.8}

        /* --- Compact split layout for Results + Sources --- */
        .split { display: grid; gap: 16px; }
        @media (min-width: 900px) {
          .split { grid-template-columns: minmax(0,1fr) 340px; }
        }

        .pane {
          background: var(--surfaceElevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          min-height: 240px;
        }
        .pane-head {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
        }
        .pane-body {
          padding: 12px;
          overflow: auto;
          max-height: 460px;
        }
        .pane-body.empty {
          display: flex; align-items: center; justify-content: center;
          color: var(--textMuted); min-height: 200px; text-align: center;
        }

        /* Sources compact list */
        .src-list { display: grid; gap: 10px; }
        .src {
          display: block; padding: 10px;
          background: var(--surface); border-radius: 10px;
          border: 1px solid var(--border); text-decoration: none;
        }
        .src:hover { border-color: var(--primary); }
        .src-head { font-size: 12.5px; color: var(--primary); font-weight: 700; }
        .src-link { font-size: 12.8px; color: var(--textMuted); word-break: break-all; }

        /* Make the sources column sticky so it stays in view while reading */
        .sticky { position: sticky; top: 16px; }

        /* Trim some spacing globally for this card */
        .card.pad h3 { margin-bottom: 10px; }
        .results { border: none; background: transparent; padding: 0; }
        pre.answer { margin: 0; font-size: 14.5px; line-height: 1.55; }

        /* Footer */
        .footer{padding:16px;color:var(--textMuted);font-size:13px;text-align:center;margin-top:auto;width:100%}
      `}</style>

      {/* Header */}
      <header className="hero" role="banner">
        <div className="hero-inner">
          <h1 className="title">PFAS Research Agent</h1>
          <p className="subtitle">Advanced environmental analysis and research tool</p>
          <div className="toolbar">
            <div className="pill" title={`Backend: ${API_BASE}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M7 16h10" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M9 8h6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>FastAPI Connected</span>
            </div>
            <button
              className="pill btn-ghost"
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              style={{ cursor: "pointer" }}
            >
              {theme === "dark" ? "🌙 Dark" : "🌞 Light"}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container">
        {/* Input Card */}
        <section className="card pad" aria-labelledby="query-section">
          <div>
            <label htmlFor="query" className="lbl" id="query-section">
              Research Query
            </label>
            <textarea
              id="query"
              className="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter your PFAS research question or analysis request…"
              aria-describedby="query-hint"
            />
            <div id="query-hint" className="hint">
              Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to run analysis
            </div>
          </div>

          {/* Options */}
          <div className="options">
            <label className="opt">
              <input
                type="checkbox"
                checked={noSearch}
                onChange={(e) => setNoSearch(e.target.checked)}
              />
              <div>
                <div className="opthead">Use Default Sources</div>
                <div className="optsub">EPA/WHO authoritative sources only</div>
              </div>
            </label>

            <label className="opt">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
              />
              <div>
                <div className="opthead">Demo Mode</div>
                <div className="optsub">Consistent output for testing</div>
              </div>
            </label>
          </div>

          {/* Max Results */}
          <div className="range">
            <label className="lbl" htmlFor="maxr">
              Maximum Results: {maxResults}
            </label>
            <input
              id="maxr"
              type="range"
              min="1"
              max="10"
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value, 10))}
            />
          </div>

          {/* Actions */}
          <div className="row">
            <button
              onClick={onRun}
              className="btn"
              disabled={loading || !query.trim()}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                <>🔬 Run Analysis</>
              )}
            </button>
            <button className="btn btn-ghost" onClick={copyAnswer} disabled={!answer}>
              📋 Copy Answer
            </button>
            <button className="btn btn-ghost" onClick={downloadMarkdown} disabled={!answer}>
              ⬇️ Download .md
            </button>
          </div>

          {/* Status Toast */}
          {status && (
            <div className={`toast ${status.startsWith("Error") ? "err" : "ok"}`}>{status}</div>
          )}
        </section>

        {/* Results + Sources (compact) */}
        <section className="card pad" style={{ marginTop: 24 }}>
          <h3>📊 Analysis</h3>

          {/* Error banner (OpenAI 429 etc.) */}
          {errorMsg && (
            <div className="alert err" role="alert" style={{ marginTop: 8, marginBottom: 12 }}>
              <strong>Request error:</strong> {errorMsg}
              <div><small>Tip: enable Demo Mode or check API billing/keys.</small></div>
            </div>
          )}

          <div className="split">
            {/* Left: Results */}
            <div className="pane">
              <div className="pane-head">Results</div>
              <div className={`pane-body ${answer || loading ? "" : "empty"}`} role="region" aria-live="polite">
                {answer ? (
                  <pre className="answer">{answer}</pre>
                ) : loading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div className="spinner" />
                    <div>Analyzing your query…</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 34, lineHeight: 1 }}>🔬</div>
                    <div style={{ fontWeight: 600 }}>Ready for Analysis</div>
                    <div className="hint">Run your query to see results here</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sources (sticky) */}
            <aside className="pane sticky" aria-label="Sources">
              <div className="pane-head">Sources</div>
              <div className="pane-body">
                {sources?.length ? (
                  <div className="src-list">
                    {sources.map((s, i) => (
                      <SourceCard key={i} url={s} idx={i + 1} />
                    ))}
                  </div>
                ) : (
                  <div className="pane-body empty" style={{ minHeight: 120 }}>
                    <div style={{ fontSize: 30, lineHeight: 1 }}>📚</div>
                    <div style={{ fontWeight: 600 }}>No Sources Yet</div>
                    <div className="hint">References will appear here</div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} PFAS Research Agent · Green/Gray UI · No external UI dependencies
      </footer>
    </div>
  );
}
