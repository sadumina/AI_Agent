# agent_starter.py  — clean research agent with explicit seeds/no_search and local fallback
import argparse
import os
import sys
from urllib.parse import urlparse
from pathlib import Path

import requests
from dotenv import load_dotenv, find_dotenv
from duckduckgo_search import DDGS
try:
    from tavily import TavilyClient
except Exception:
    TavilyClient = None

import trafilatura
from pypdf import PdfReader

# ---- Optional OpenAI; we handle no-credits gracefully
from openai import OpenAI, RateLimitError, APIConnectionError, APIStatusError, AuthenticationError, BadRequestError


# ---------- Env ----------
def load_env():
    load_dotenv(override=True)
    print("Loaded .env from:", find_dotenv(usecwd=True) or "(not found)")
    k = os.getenv("OPENAI_API_KEY", "")
    print("OPENAI_API_KEY (masked):", (k[:4] + "..." + k[-4:]) if k else "(missing)")


# ---------- Helpers ----------
def is_pdf_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf")

def fetch_text(url: str, timeout=25) -> str:
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        ctype = (r.headers.get("Content-Type") or "").lower()
        if "pdf" in ctype or is_pdf_url(url):
            tmp = Path("tmp_download.pdf")
            tmp.write_bytes(r.content)
            try:
                reader = PdfReader(str(tmp))
                out = []
                for p in reader.pages:
                    out.append(p.extract_text() or "")
                return "\n".join(out)
            finally:
                try: tmp.unlink()
                except Exception: pass
        # HTML/text
        downloaded = trafilatura.fetch_url(url) or r.text
        extracted = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        return extracted or r.text[:8000]
    except Exception as e:
        return f"[Fetch error for {url}: {e}]"

def dedupe_urls(items):
    seen, out = set(), []
    for it in items:
        u = it.get("href") or it.get("url")
        if not u: continue
        key = urlparse(u)._replace(query="", fragment="").geturl()
        if key in seen: continue
        seen.add(key)
        out.append({"title": it.get("title",""), "href": key})
    return out

def search_web(query: str, max_results=5):
    """
    Priority:
      1) Tavily (if TAVILY_API_KEY present)
      2) DuckDuckGo 'lite' backend with small count to avoid rate-limit
    NO hidden PFAS fallback.
    """
    results = []

    tv_key = os.getenv("TAVILY_API_KEY")
    if tv_key and TavilyClient:
        try:
            tv = TavilyClient(api_key=tv_key)
            out = tv.search(query=query, max_results=max_results)
            for item in out.get("results", []):
                url = item.get("url")
                if url:
                    results.append({"title": item.get("title", ""), "href": url})
        except Exception as e:
            print(f"[Tavily error] {e}", file=sys.stderr)

    if not results:
        try:
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results, region="us-en",
                                   safesearch="moderate", backend="lite"):
                    href = r.get("href") or r.get("link")
                    if href:
                        results.append({"title": r.get("title",""), "href": href})
        except Exception as e:
            print(f"[DDG error] {e}", file=sys.stderr)

    return dedupe_urls(results)[:max_results]


# ---------- Local (no-API) summary ----------
import re
def local_extractive_summary(notes: str, max_sentences: int = 7) -> str:
    if not notes: return "(no content)"
    sentences = re.split(r'(?<=[.!?])\s+', notes)
    keywords = {
        'pfas','pfoa','pfos','limit','standard','guideline','gac','ion',
        'exchange','ebct','ro','cost','treatment','drinking','water',
        'regulation','epa','who','eu','uk','compare','costs','design','table'
    }
    scored=[]
    for i, s in enumerate(sentences[:400]):
        words = re.findall(r"\b\w+\b", s.lower())
        if not words: continue
        kw = sum(1 for w in words if w in keywords)
        score = kw + min(len(s)/120.0, 1.5) + (1.0 if i < 5 else 0.0)
        scored.append((score, i, s.strip()))
    if not scored:
        return sentences[0][:400] if sentences else "(no content)"
    top = sorted(scored, key=lambda x: x[0], reverse=True)[:max_sentences]
    top = [t[2] for t in sorted(top, key=lambda x: x[1])]
    return "• " + "\n• ".join(top)


# ---------- OpenAI wrapper (safe) ----------
def synthesize_with_openai(prompt: str, notes: str, sources: list, model: str = "gpt-4o-mini"):
    client = OpenAI(timeout=30, max_retries=2)
    src_block = "\n".join(f"- {s['href']}" for s in sources)
    sys_msg = (
        "You are a concise research assistant. Answer ONLY the user query using NOTES. "
        "Cite the provided URLs inline. Prefer recent, credible sources. Be specific."
    )
    user_msg = f"USER QUERY:\n{prompt}\n\nNOTES:\n{notes}\n\nSOURCES:\n{src_block}"

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role":"system","content":sys_msg},
                {"role":"user","content":user_msg}
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content

    except (AuthenticationError, RateLimitError) as e:
        # wrong/missing key OR no credits -> local summary
        return f"[OpenAI auth/quota]\n{e}\n\nLocal summary:\n{local_extractive_summary(notes)}"
    except (APIConnectionError, APIStatusError, BadRequestError, Exception) as e:
        # network/API issue -> local summary
        return f"[OpenAI error]\n{e}\n\nLocal summary:\n{local_extractive_summary(notes)}"


def clip(s: str, n=4000) -> str:
    return s if len(s) <= n else s[:n] + "\n...[truncated]"


# ---------- Main ----------
def minimal_research_agent(query: str,
                           save: str | None = None,
                           no_search: bool = False,
                           seed_urls: list[str] | None = None,
                           force_local: bool = False,
                           max_results: int = 5) -> str:
    seed_urls = seed_urls or []

    # 1) Pick sources
    if seed_urls:
        hits = [{"title":"seed", "href": u} for u in seed_urls if u.strip()]
        if not hits:
            return "No valid seed URLs provided."
    elif no_search:
        return "no_search requires --seed URL(s). Provide at least one URL."
    else:
        print(f"Searching: {query}")
        hits = search_web(query, max_results=max_results)
        if not hits:
            return "No search results (rate-limited or blocked). Try fewer results or provide --seed."

    print("\nUsing sources:")
    for i, h in enumerate(hits, 1):
        print(f"  {i}. {h['href']}")

    # 2) Fetch & build notes
    chunks = []
    for h in hits:
        txt = fetch_text(h["href"])
        chunks.append(f"# {h['href']}\n{clip(txt, n=4000)}")
    combined = "\n\n".join(chunks)

    # 3) Synthesize
    if force_local:
        answer = local_extractive_summary(combined, max_sentences=8)
    else:
        answer = synthesize_with_openai(prompt=query, notes=combined, sources=hits)

    if save:
        Path(save).write_text(answer, encoding="utf-8")
        print(f"\nSaved to: {save}")

    return answer


if __name__ == "__main__":
    load_env()
    ap = argparse.ArgumentParser(description="Tiny research agent")
    ap.add_argument("query", nargs="*", help="Your research question")
    ap.add_argument("--save", help="Save output to a file (e.g., brief.md)")
    ap.add_argument("--no-search", action="store_true", help="Do not search; requires --seed URL(s)")
    ap.add_argument("--seed", nargs="*", default=[], help="One or more URLs to summarize directly")
    ap.add_argument("--force-local", action="store_true", help="Bypass OpenAI (local summary only)")
    ap.add_argument("--max-results", type=int, default=5, help="Search results to fetch (1-8)")
    args = ap.parse_args()

    if not args.query and not args.seed:
        print("Usage:\n  python agent_starter.py \"your question\" [--save brief.md]\n"
              "  python agent_starter.py \"topic\" --seed https://a.com https://b.com\n"
              "  python agent_starter.py \"topic\" --force-local\n")
        sys.exit(2)

    question = " ".join(args.query) if args.query else "(no prompt)"
    out = minimal_research_agent(
        question,
        save=args.save,
        no_search=args.no_search,
        seed_urls=args.seed,
        force_local=args.force_local,
        max_results=max(1, min(8, args.max_results)),
    )
    print("\n=== ANSWER ===\n")
    print(out)
