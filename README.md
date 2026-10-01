# Swarm Debugger — PS 02

Swarm Debugger operationalizes adversarial debugging through **executable evidence**.

Competing hypotheses → adversarial challenge → real execution → runtime/trace evidence →
Judge decision → rejected-evidence memory → next round → convergence.

**AI proposes. AI challenges. Code executes. Evidence decides.**

Prosecutor proposes hypothesis A with a patch and validation plan. Defender attacks the
reasoning, proposes hypothesis B, and writes executable falsification tests. The runtime
probe instruments suspicious regions and captures structured traces. The deterministic
Judge checks build, exit code, protected tests, baseline, regression, falsification,
runtime/sandbox errors, timeout, resources, and file integrity — then explicitly picks
`WINNER: CANDIDATE A/B` when both pass. Rejected hypotheses persist as structured memory
so future rounds never repeat the same wrong diagnosis.

## Project context (read first)

| File | Purpose |
|------|---------|
| [PRD.md](./PRD.md) | Product requirements and MVP scope |
| [architecture.md](./architecture.md) | Components, state machine, APIs, persistence |
| [tech-stack.md](./tech-stack.md) | React/Vite, FastAPI, SQLite, Docker sandbox |
| [rules.md](./rules.md) | Agent, sandbox, test-integrity, and coding rules |
| [phases.md](./phases.md) | Implementation plan |
| [design.md](./design.md) | UI system and screens |
| [memory.md](./memory.md) | Living project state |

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Three.js (state-driven 3D arena, knowledge graph, trace, battle, replay)
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy
- **Database:** SQLite (MVP, PostgreSQL-compatible)
- **Execution:** Docker sandbox with labeled process fallback; `SANDBOX_STRICT=true` refuses unsafe execution with `SANDBOX UNAVAILABLE`

## Repository layout

```text
swarm-debugger/
├── frontend/          Vite + React + TypeScript
├── backend/           FastAPI application
├── sandbox/           Docker images and runners (stubs)
├── docs/              Extra notes
└── docker-compose.yml
```

## Local development

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix: source .venv/bin/activate
pip install -r requirements.txt
copy ..\.env.example .env   # Windows; Unix: cp ../.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### Docker Compose

From the repository root:

```bash
docker compose up --build
```

## Current status

Adversarial evidence lab, verified end to end (backend 35 pytest, frontend 13 vitest,
production builds pass). Coordinator state machine → fault localizer → Prosecutor vs
Defender (executable falsification) → sandbox + runtime probe → evidence engine →
causal graph → deterministic Judge with explicit winner → rejected-hypothesis memory →
next round. Benchmark Lab (6 cases, modes A–E, honest NOT YET MEASURED), Ablation Lab,
experiments, replay time machine, 3D arena/trace/graph/battle/replay, command palette
(⌘/Ctrl+K), sandbox monitor, and system health all run on real backend data.

Flagship demo: create the `demo-divide` session → baseline fails → arena activates →
fault map highlights `solution.py` → Hypothesis A (None guard) vs B (raise) → falsification
`assert divide(1,0) is None` executes → A passes, B fails → Judge verifies A → replay shows
T0–T9. No API key needed: deterministic demo provider, always labeled DEMO MODE.

## Routes (all real data)

`/`, `/login`, `/app`, `/app/new`, `/app/history`, `/app/sessions/:id`,
`/app/sessions/:id/report`, `/app/arena`, `/app/evidence`, `/app/trace`,
`/app/causal`, `/app/replay`, `/app/benchmarks`, `/app/ablation`,
`/app/experiments`, `/app/sandbox`, `/app/health`, `/app/settings`

## Safety

Never execute submitted or LLM-generated code on the host. Isolation, timeouts, resource limits, and disabled network are required before any candidate execution.
