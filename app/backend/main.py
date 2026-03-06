#!/usr/bin/env python3
"""FastAPI backend — YouTube search + NotebookLM notebook creation."""

import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PYTHON = sys.executable
NOTEBOOKLM = "/Users/magalidrumare/.pyenv/versions/3.11.9/bin/notebooklm"
SEARCH_SCRIPT = str(Path(__file__).parent.parent.parent / ".claude/skills/yt-search/scripts/search.py")

app = FastAPI(title="YT → NotebookLM API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    count: int = 20
    months: int = 6
    no_date_filter: bool = False


class NotebookRequest(BaseModel):
    name: str
    urls: list[str]


class Video(BaseModel):
    title: str
    channel: str
    views: Optional[int]
    duration: str
    date: str
    url: str


@app.post("/api/search", response_model=list[Video])
def search(req: SearchRequest):
    args = [PYTHON, SEARCH_SCRIPT, req.query, "--count", str(req.count)]
    if req.no_date_filter:
        args.append("--no-date-filter")
    else:
        args += ["--months", str(req.months)]

    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Search timed out")

    videos = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line.startswith("─") and line:
            # Parse structured output lines
            pass

    # Re-run with JSON output by calling yt-dlp directly
    import shutil
    if not shutil.which("yt-dlp"):
        yt_dlp = "/Users/magalidrumare/.pyenv/versions/3.11.9/bin/yt-dlp"
    else:
        yt_dlp = "yt-dlp"

    fetch_count = max(req.count * 5, 50)
    cmd = [
        yt_dlp,
        f"ytsearch{fetch_count}:{req.query}",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        "--quiet",
        "--cookies-from-browser", "chrome",
    ]

    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Search timed out")

    raw_videos = []
    for line in r.stdout.strip().splitlines():
        try:
            raw_videos.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    if not raw_videos:
        stderr = r.stderr.strip()
        detail = f"No results found. yt-dlp: {stderr[:200]}" if stderr else "No results found"
        raise HTTPException(status_code=404, detail=detail)

    # Date filter
    if not req.no_date_filter and req.months > 0:
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(days=req.months * 30)).strftime("%Y%m%d")
        raw_videos = [v for v in raw_videos if not v.get("upload_date") or v["upload_date"] >= cutoff]

    # Sort by view count descending (most viewed first)
    raw_videos.sort(key=lambda v: v.get("view_count") or 0, reverse=True)
    raw_videos = raw_videos[:req.count]

    def fmt_duration(info):
        if info.get("duration_string"):
            return info["duration_string"]
        dur = info.get("duration")
        if not dur:
            return "N/A"
        dur = int(dur)
        h, r = divmod(dur, 3600)
        m, s = divmod(r, 60)
        return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

    def fmt_date(raw):
        if not raw or len(raw) != 8:
            return "N/A"
        from datetime import datetime
        try:
            return datetime.strptime(raw, "%Y%m%d").strftime("%b %d, %Y")
        except ValueError:
            return raw

    for v in raw_videos:
        vid_id = v.get("id", "")
        videos.append(Video(
            title=v.get("title", "Unknown"),
            channel=v.get("channel") or v.get("uploader") or "Unknown",
            views=v.get("view_count"),
            duration=fmt_duration(v),
            date=fmt_date(v.get("upload_date", "")),
            url=f"https://youtube.com/watch?v={vid_id}" if vid_id else "N/A",
        ))

    return videos


@app.post("/api/notebook")
def create_notebook(req: NotebookRequest):
    # Create notebook
    r = subprocess.run(
        [NOTEBOOKLM, "create", req.name],
        capture_output=True, text=True, timeout=30
    )
    if r.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Failed to create notebook: {r.stderr}")

    # Extract notebook ID
    notebook_id = None
    for part in r.stdout.split():
        if "-" in part and len(part) > 30:
            notebook_id = part.strip(":")
            break

    if not notebook_id:
        raise HTTPException(status_code=500, detail="Could not parse notebook ID")

    # Add sources
    added = []
    failed = []
    for url in req.urls:
        r2 = subprocess.run(
            [NOTEBOOKLM, "source", "add", "--notebook", notebook_id, url],
            capture_output=True, text=True, timeout=30
        )
        if r2.returncode == 0:
            added.append(url)
        else:
            failed.append(url)

    return {
        "notebook_id": notebook_id,
        "name": req.name,
        "added": len(added),
        "failed": len(failed),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
