# Swarm Debugger backend (FastAPI)

Python API for PS 02. Phase 1 adds demo authentication. Agent implementations are **not** in this phase.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Demo user is seeded on startup: `demo@swarm.local` / `demo` (username `demo`).

## Layout

```text
app/
  api/       HTTP routers (health, auth)
  agents/    Prosecutor / Defender / LLM adapter (stubs)
  judge/     Runtime-grounded decisions (stub)
  sandbox/   Isolated execution boundary (stub)
  db/        SQLAlchemy engine and session
  models/    Persistence entities (minimal for init)
  core/      Settings
  main.py    FastAPI entrypoint
tests/
```

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## Tests

```bash
pytest
```
