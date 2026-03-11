# NuvoVet Backend — Startup Guide

## Prerequisites

- Python 3.11+
- `pip`

## Install dependencies

```bash
pip install -r requirements.txt
```

## Start the API server

Run from the **repo root**:

```bash
uvicorn backend.main:app --reload --port 8000
```

Or from inside the `backend/` directory:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## Health check

```bash
curl http://localhost:8000/api/health
# → {"status":"ok","drug_count":641}
```

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Backend health check |
| `GET` | `/api/drugs` | Paginated drug list (`limit`, `offset`, `drug_class`, `source`) |
| `GET` | `/api/drugs/search` | Full-text drug search (`q`, `species`, `limit`) |
| `GET` | `/api/drugs/{drug_id}` | Single drug by ID |

## Drug data

Drug records are loaded at startup from `backend/data/converted/**/*.jsonl`. Do not modify files in that directory — they are the read-only source of truth.

## CORS

The server allows all origins in development (`allow_origins=["*"]`). Restrict this in production.
