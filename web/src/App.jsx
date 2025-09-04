import { useState } from "react";
import "./App.css";

// Backend API URL
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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
  const [query, setQuery] = useState("PFAS drinking water limits; compare GAC vs IX (EBCT & costs)");
  const [noSearch, setNoSearch] = useState(false);
  const [maxResults, setMaxResults] = useState(3);
  const [demoMode, setDemoMode] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    <div className="app">
      {/* Header */}
      <header className="hero" role="banner">
        <div className="hero-inner">
          <h1 className="title">⚡ Research Agent</h1>
          <p className="subtitle">Beautiful Glassmorphism UI with Gradient Magic</p>
          <div className="toolbar">
            <div className="pill">✅ FastAPI Connected</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container">
        {/* Input */}
        <section className="card">
          <label htmlFor="query" className="lbl">Research Query</label>
          <textarea
            id="query"
            className="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter your research question…"
          />
          <div className="hint">
            Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to run
          </div>

          <div className="options">
            <label className="opt">
              <input
                type="checkbox"
                checked={noSearch}
                onChange={(e) => setNoSearch(e.target.checked)}
              />
              <div>
                <div className="opthead">Use Default Sources</div>
                <div className="optsub">EPA/WHO authoritative only</div>
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

          <div className="range">
            <label className="lbl">Maximum Results: {maxResults}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
            />
          </div>

          <div className="row">
            <button onClick={onRun} className="btn" disabled={loading || !query.trim()}>
              {loading ? <><div className="spinner" /> Analyzing…</> : "🚀 Run Analysis"}
            </button>
            <button onClick={copyAnswer} className="btn btn-ghost" disabled={!answer}>
              📋 Copy Answer
            </button>
            <button onClick={downloadMarkdown} className="btn btn-ghost" disabled={!answer}>
              ⬇️ Download .md
            </button>
          </div>
          {status && <div className={`alert ${status.startsWith("Error") ? "err" : "ok"}`}>{status}</div>}
        </section>

        {/* Results */}
        <section className="card">
          <h3>📊 Analysis</h3>
          {errorMsg && (
            <div className="alert err">
              <strong>Request error:</strong> {errorMsg}
            </div>
          )}
          <div className="split">
            <div className="pane">
              <div className="pane-head">Results</div>
              <div className={`pane-body ${answer || loading ? "" : "empty"}`}>
                {answer ? (
                  <pre className="answer">{answer}</pre>
                ) : loading ? (
                  <div><div className="spinner" /> Analyzing your query…</div>
                ) : (
                  <div className="hint">🔬 Ready for Analysis</div>
                )}
              </div>
            </div>
            <aside className="pane sticky">
              <div className="pane-head">Sources</div>
              <div className="pane-body">
                {sources?.length ? (
                  <div className="src-list">
                    {sources.map((s, i) => (
                      <SourceCard key={i} url={s} idx={i + 1} />
                    ))}
                  </div>
                ) : (
                  <div className="pane-body empty">📚 No Sources Yet</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="footer">© {new Date().getFullYear()} Research Agent</footer>
    </div>
  );
}
