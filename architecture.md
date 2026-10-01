# Architecture — Swarm Debugger

## 1. High-level architecture

```text
Browser
  |
  v
React Web App (TypeScript + Vite)
  |
  v
FastAPI Backend
  |
  +--------------------+
  | Session Manager    |
  +--------------------+
  | Agent Orchestrator |
  +--------------------+
  | Debate Engine      |
  +--------------------+
  | Judge / Evaluator  |
  +--------------------+
  | Sandbox Manager    |
  +--------------------+
  | Evidence Store     |
  +--------------------+
          |
          +----> LLM Provider Adapter
          |
          +----> Isolated Code Runner (Docker)
          |
          +----> SQLite (MVP) / PostgreSQL (later)
```

## 2. Components

### Frontend

Responsibilities:

- Authentication UI
- Dashboard
- Debugging workspace
- Debate timeline
- Candidate comparison
- Runtime output viewer
- Session history

Suggested routes:

- `/login`
- `/dashboard`
- `/debug/new`
- `/debug/:sessionId`
- `/debug/:sessionId/round/:roundId`
- `/history`
- `/settings`

Layout (see `frontend/src/`):

- `components/` — reusable UI
- `pages/` — route screens
- `hooks/` — client state
- `services/` — API/WebSocket clients
- `types/` — shared TypeScript types

### Backend API

Responsibilities:

- Authentication/session management
- Session CRUD
- Agent orchestration
- Candidate management
- Sandbox execution
- Judge decisions
- Evidence persistence
- WebSocket progress updates

Package layout (see `backend/app/`):

- `api/` — HTTP/WebSocket routers
- `agents/` — Prosecutor, Defender, provider adapter (not implemented in Phase 0)
- `judge/` — decision policy grounded in runtime evidence
- `sandbox/` — isolation boundary for execution
- `db/` — engine, session, init
- `models/` — SQLAlchemy entities
- `core/` — settings and shared utilities
- `main.py` — FastAPI entrypoint

### Agent Orchestrator

Controls the state machine:

```text
INPUT
  -> BASELINE_EXECUTION
  -> PROSECUTOR
  -> DEFENDER
  -> CANDIDATE_BUILD
  -> JUDGE_EXECUTION
  -> DECISION
       |-> VERIFIED_FIX
       |-> NEXT_ROUND
       |-> HUMAN_REVIEW
       |-> TERMINATED
```

The orchestrator, not the LLM, controls transitions.

### Prosecutor Agent

Input:

- source code
- failing tests
- error output
- repository context
- previous evidence (including rejected candidates)

Output:

- root-cause hypothesis
- explanation
- proposed patch
- confidence as metadata only
- expected behavioral change

### Defender Agent

Input:

- same debugging context
- Prosecutor proposal
- previous rejected candidates

Output:

- objections
- alternative root cause
- alternative patch
- tests that could disprove the Prosecutor

The Defender must not simply rewrite the Prosecutor response.

### Judge Agent

The Judge has two responsibilities:

1. Select/interpret candidate execution results.
2. Produce a human-readable explanation of the runtime evidence.

The final decision must be grounded in the execution engine. LLM confidence cannot override a failing test.

## 3. Sandbox execution

Every candidate must be executed in an isolated environment.

Required controls:

- no host filesystem access;
- no network access by default;
- CPU limit;
- memory limit;
- process limit;
- execution timeout;
- maximum stdout/stderr size;
- temporary workspace;
- non-root execution where supported;
- cleanup after execution.

Never execute user/LLM-generated code through a raw host shell.

Protected tests must not be modified to make a candidate pass. The sandbox/Judge pipeline must detect and reject suspicious changes to protected test files.

## 4. Candidate model

Each candidate contains:

```json
{
  "candidate_id": "uuid",
  "round": 1,
  "agent": "prosecutor",
  "patch": "...",
  "hypothesis": "...",
  "files_changed": ["src/example.py"],
  "expected_tests": ["test_divide_zero"]
}
```

## 5. Runtime result model

```json
{
  "candidate_id": "uuid",
  "status": "failed|passed|error|timeout",
  "exit_code": 0,
  "duration_ms": 1240,
  "tests_total": 8,
  "tests_passed": 8,
  "tests_failed": 0,
  "stdout": "...",
  "stderr": "...",
  "failure_summary": null
}
```

## 6. Decision policy

The Judge must use deterministic runtime evidence first.

Recommended order:

1. Candidate executes successfully.
2. Required test command completes within limits.
3. All required tests pass.
4. No disallowed side effects/security violations occurred.
5. Candidate does not modify protected tests.
6. Candidate is compared against the baseline and task constraints.

LLM reasoning may explain the result, but it cannot override a failing test.

If both candidates fail, the Judge rejects both. Rejected candidates remain in the evidence store for later rounds.

## 7. Persistence

Core entities:

- User
- DebugSession
- Round
- Candidate
- Execution
- AgentMessage
- JudgeDecision
- ProjectFile

Keep raw runtime evidence for reproducibility, subject to output-size limits.

MVP store: SQLite. Keep the persistence layer compatible with PostgreSQL.

## 8. API sketch

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Sessions

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `POST /api/sessions/{id}/start`
- `POST /api/sessions/{id}/cancel`

### Rounds

- `GET /api/sessions/{id}/rounds`
- `GET /api/rounds/{id}`

### Candidates

- `GET /api/rounds/{id}/candidates`
- `GET /api/candidates/{id}`

### Execution

- `POST /api/candidates/{id}/execute`
- `GET /api/executions/{id}`

### System

- `GET /health`

### Live updates

- `WS /api/ws/sessions/{id}`

## 9. Repository structure

```text
swarm-debugger/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── agents/
│   │   ├── judge/
│   │   ├── sandbox/
│   │   ├── db/
│   │   ├── models/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
├── sandbox/
│   ├── docker/
│   └── runners/
├── docs/
├── docker-compose.yml
├── PRD.md
├── architecture.md
├── tech-stack.md
├── rules.md
├── phases.md
├── design.md
├── memory.md
└── README.md
```
