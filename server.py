import os
from pathlib import Path
from typing import List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from agent_starter import search_web, fetch_text, synthesize_with_openai, clip, local_extractive_summary

load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "web" / "dist"

app = FastAPI(title="Research Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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



@app.post("/api/run", response_model=RunResponse)
def run_agent(req: RunRequest):
    if req.demo_mode or os.getenv("DEMO_LOCK_OUTPUT") == "1":
        return RunResponse(answer=DEMO_ANSWER, sources=DEMO_SOURCES)

    # (normal path: search, fetch, synthesize…)
    hits = search_web(req.query, max_results=req.max_results)
    if not hits:
        return RunResponse(answer="No search results", sources=[])

    chunks = []
    for h in hits:
        try:
            txt = fetch_text(h["href"])
        except Exception as e:
            txt = f"(fetch error for {h['href']}: {e})"
        chunks.append(f"# {h['href']}\n{clip(txt, n=4000)}")
    combined = "\n\n".join(chunks)

    if req.force_local:
        answer = local_extractive_summary(combined, max_sentences=8)
    else:
        answer = synthesize_with_openai(req.query, combined, hits)

    return RunResponse(answer=answer, sources=[h["href"] for h in hits])

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="spa")
