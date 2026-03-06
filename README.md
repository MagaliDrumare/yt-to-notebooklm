# YT → NotebookLM

Search YouTube, pick the most-viewed videos, and create a NotebookLM notebook — all from one UI.

## Stack
- **Frontend**: React + Vite
- **Backend**: FastAPI + Python
- **YouTube scraping**: yt-dlp (Chrome cookies auth)
- **NotebookLM**: notebooklm-py CLI

## Setup

### Requirements
- Python 3.11+
- Node 18+
- Chrome browser (for yt-dlp cookie auth)
- notebooklm-py installed and logged in

### Install

```bash
# Backend
pip install fastapi uvicorn yt-dlp "notebooklm-py[browser]"
playwright install chromium
notebooklm login

# Frontend
cd app/frontend
npm install
```

### Run

```bash
# Terminal 1 — backend
cd app
uvicorn backend.main:app --port 8000

# Terminal 2 — frontend
cd app/frontend
npm run dev
```

Open http://localhost:5173 (or whatever port Vite assigns).

## Features
- Search YouTube by keyword with configurable result count and time period
- Results sorted by **most viewed** descending
- Select/deselect individual videos
- Create a NotebookLM notebook with selected videos in one click
