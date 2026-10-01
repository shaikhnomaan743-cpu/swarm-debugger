# Tech Stack — Swarm Debugger

## Frontend

### React + TypeScript + Vite

Use for the web application.

Why:

- fast development;
- component-based UI;
- strong TypeScript support;
- suitable for dashboard-heavy applications.

### Tailwind CSS

Use for consistent styling and responsive layouts.

### Monaco Editor

Use as the in-browser code editor (later phases; not wired in Phase 0).

### React Router

Use for application routing.

### Recharts

Use for simple dashboard metrics and debugging analytics (later phases).

## Backend

### Python + FastAPI

Use for REST APIs and WebSocket progress updates.

### Pydantic

Use for request/response validation and typed internal models.

### SQLAlchemy

Use as the database abstraction layer.

### SQLite for local MVP

Use SQLite for easy local setup.

Keep the persistence layer compatible with PostgreSQL for later deployment.

## Agent layer

Create an internal provider abstraction (later phases):

```text
LLMProvider
  ├── generate_prosecutor(...)
  ├── generate_defender(...)
  └── summarize_judge_evidence(...)
```

Do not couple the whole application directly to one LLM vendor.

The orchestration state machine should remain deterministic even if the LLM provider changes.

Prosecutor, Defender, and Judge **must not** be implemented until the foundation, login, dashboard, session, and baseline runner exist (see `phases.md`).

## Execution

### Docker sandbox

Use containers for candidate execution.

Recommended controls:

- `--network none`
- CPU quota
- memory limit
- PID limit
- timeout
- read-only base filesystem where practical
- temporary writable workspace
- non-root user

For higher-security deployments, consider a stronger sandbox technology rather than treating ordinary Docker isolation as a perfect security boundary.

Never execute untrusted code on the host.

## Testing

- Pytest for backend
- Vitest + React Testing Library for frontend (later)
- Integration tests for API
- End-to-end tests for the main debugging flow

## Development

Recommended:

- Docker Compose
- `.env.example`
- Ruff for Python linting/formatting
- ESLint + Prettier for TypeScript (later phases)

## Deployment

Prototype-friendly deployment:

- Frontend: static hosting
- Backend: container hosting
- Database: managed PostgreSQL for production
- Sandbox: dedicated execution worker/host

Do not run untrusted code on the same infrastructure without appropriate isolation.

## Environment variables

Example:

```env
APP_ENV=development
DATABASE_URL=sqlite:///./swarm_debugger.db
LLM_API_KEY=
LLM_MODEL=
SANDBOX_TIMEOUT_SECONDS=15
SANDBOX_MEMORY_MB=512
SANDBOX_CPU_LIMIT=1
MAX_DEBUG_ROUNDS=5
CORS_ORIGINS=http://localhost:5173
```

Never commit real secrets.
