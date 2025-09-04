import os
import asyncio
from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from agent.agent_starter import (
    search_web,
    fetch_text,
    synthesize_with_openai,
    clip,
    local_extractive_summary,
)

from aiolimiter import AsyncLimiter
from tavily import TavilyClient

# Load environment variables
load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "web" / "dist"

# --- FastAPI App ---
app = FastAPI(title="Research Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class RunRequest(BaseModel):
    query: str
    no_search: bool = False
    max_results: int = 3
    seed_urls: List[str] = []
    force_local: bool = False
    demo_mode: bool = False

class RunResponse(BaseModel):
    answer: str
    sources: List[str]


# --- DuckDuckGo Rate Limiter ---
ddg_limiter = AsyncLimiter(1, 2)  # 1 request every 2 seconds

async def safe_search_ddg(query: str, max_results: int = 3):
    """Safe DuckDuckGo search with rate limiting."""
    async with ddg_limiter:
        return search_web(query, max_results=max_results)


# --- Tavily Client (Fallback) ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

def search_with_tavily(query: str, max_results: int = 3):
    """Fallback: use Tavily if available."""
    if not tavily_client:
        return []
    try:
        res = tavily_client.search(query=query, max_results=max_results)
        return [{"href": r["url"], "title": r["title"]} for r in res.get("results", [])]
    except Exception:
        return []


# --- API Route ---
@app.post("/api/run", response_model=RunResponse)
async def run_agent(req: RunRequest):
    if req.demo_mode or os.getenv("DEMO_LOCK_OUTPUT") == "1":
        return RunResponse(answer="Demo mode output", sources=["https://example.com"])

    # Step 1: Try DuckDuckGo
    try:
        hits = await safe_search_ddg(req.query, max_results=req.max_results)
    except Exception as e:
        hits = []
        print(f"[DuckDuckGo error] {e}")

    # Step 2: Fallback to Tavily if no results
    if not hits:
        hits = search_with_tavily(req.query, max_results=req.max_results)

    if not hits:
        return RunResponse(answer="No search results (rate-limited or failed)", sources=[])

    # Step 3: Fetch content from URLs
    chunks = []
    for h in hits:
        try:
            txt = fetch_text(h["href"])
        except Exception as e:
            txt = f"(fetch error for {h['href']}: {e})"
        chunks.append(f"# {h['href']}\n{clip(txt, n=4000)}")

    combined = "\n\n".join(chunks)

    # Step 4: Summarize
    if req.force_local:
        answer = local_extractive_summary(combined, max_sentences=8)
    else:
        answer = synthesize_with_openai(req.query, combined, hits)

    return RunResponse(answer=answer, sources=[h["href"] for h in hits])


# --- Serve React frontend ---
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="spa")
