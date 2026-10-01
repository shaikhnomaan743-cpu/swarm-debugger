# Memory — Swarm Debugger

> This file is a living project state document. Update it regularly.

## Project

PS 02 — Swarm Debugger

## Current objective

Adversarial evidence lab is complete and verified end to end (backend 35 pytest,
frontend 13 vitest, production builds pass, live flagship loop reaches `verified`
with 15 evidence items, 5 trace events, 5 causal edges, 1 rejected memory, 48 replay
events). Remaining work is evaluation scale-up and production hardening.

## Product state

### Completed

- Project requirements documented (`PRD.md`).
- Core architecture defined (`architecture.md`).
- Technology stack selected (`tech-stack.md`).
- Security/execution rules defined (`rules.md`).
- Implementation phases defined (`phases.md`, all MVP phases built).
- UI design system defined (`design.md`) and applied (dark forensic theme,
  Prosecutor pink/red, Defender blue, Judge green, status labels + color).
- **Auth:** login/logout, protected routes, session persistence via cookie,
  demo account `demo@swarm.local` / `demo`.
- **Dashboard:** real metrics (active/verified/failed/avg rounds), agent
  activity panel (Prosecutor/Defender/Judge states IDLE–VERIFIED), sandbox
  panel (backend, queue, CPU/memory, timeout, latest execution), recent
  sessions, New Debug Session CTA.
- **Session creation:** demo `divide()` fixture or custom pasted source +
  failing test (Monaco editor with textarea fallback), language guard
  (Python MVP), test command, entry point, max rounds (1–10).
- **Baseline execution:** original code runs before any agent; exit code,
  stdout/stderr, duration, parsed pytest totals stored; passing baseline →
  `human_review` (bug not reproduced).
- **Prosecutor:** structured root cause + hypothesis + evidence + minimal
  patch + expected behavior/tests; never claims verification.
- **Defender:** challenges Prosecutor (objections, assumptions), proposes a
  genuinely different patch + falsification tests.
- **Sandbox:** Docker (`--network none`, memory/CPU/PID limits, read-only
  rootfs, non-root user, output truncation, auto cleanup) with a clearly
  labelled `process` fallback when Docker is unavailable; pytest-only
  command allowlist; temp workspace; queue-depth tracking.
- **Judge:** deterministic runtime policy (protected-file tamper → REJECTED,
  timeout, missing/failed tests → FAILED, all-pass → PASSED). LLM text only
  explains; it can never override failing tests.
- **Multi-round loop:** rejected candidates become `previous_failures`
  evidence; stops on verified fix, max rounds (default 5), repeated
  identical proposals, sandbox-failure threshold, or human review.
- **Workspace:** Monaco source viewer, per-candidate patch diff viewer,
  all-rounds debate timeline, Judge evidence cards, baseline strip,
  terminal/runtime output + event timeline, one-click Markdown export.
- **History:** filterable/searchable session list with round/status/result.
- **Report:** per-session report page + Markdown/JSON download covering bug,
  baseline, all candidates, decisions, and final result.
- **Live updates:** `WS /api/ws/sessions/{id}` (snapshot + push) with
  polling fallback while running.
- **LLM abstraction:** `LLMProvider` (demo vs OpenAI-compatible via env);
  demo mode deterministic and always labelled.
- **Tests:** backend 24 pytest (auth, sessions, files, judge, sandbox
  safety, custom-file e2e verifying prosecutor fix); frontend 8 vitest
  (StatusBadge, DiffViewer, ProtectedRoute, report builder). Production
  builds pass (`tsc -b && vite build`).
- Live verification 2026-09-29: `POST /start-sync` on the demo fixture →
  `verified`/`verified_fix` in 1 round (Prosecutor VERIFIED, Defender
  FAILED); WS handshake returns live session events.

### In progress

- None. Next optional work: more benchmark cases + measured publications,
  Postgres, dedicated sandbox host, LLM-backed Prosecutor/Defender via
  `LLM_API_KEY` (demo provider stays default and labeled).

### Advanced lab (2026-09-29 upgrade, in place — no parallel architecture)

- `backend/app/coordinator/machine.py` — deterministic state machine
  (BASELINE→LOCALIZE→PROSECUTOR→DEFENDER→EXECUTE→TRACE→JUDGE→DECISION).
- `backend/app/localizer/fault.py` — fault map {files, symbols, failing_tests,
  suspicious_regions, confidence, evidence} persisted per round.
- `backend/app/probe/tracer.py` — AST probe (entry/exit/exception/variable
  snapshots), suspicious-only instrumentation, JSONL traces persisted as
  `trace_events` + RUNTIME_TRACE/VARIABLE_STATE evidence.
- `backend/app/evidence/engine.py` — unified evidence model (15 types,
  verification_state; AI claims visually distinct from execution evidence).
- `backend/app/causal/graph.py` — session-backed causal edges + challenge API.
- `backend/app/memory/rejected.py` — structured rejected-hypothesis memory +
  fingerprint duplicate detection (REPEATED HYPOTHESIS event).
- `backend/app/judge/policy.py` — `decide_advanced` (11 checks) +
  `build_falsification_file` (prose-safe, syntax-validated) +
  `compare_candidates` (explicit WINNER, never both verified).
- `backend/app/tools/registry.py` — 9 controlled tools, every call logged.
- `backend/app/benchmark/library.py` — 6 cases (logic/boundary/state/
  exception/algorithm/multifunction) + modes A–E + honest NOT YET MEASURED.
- `backend/app/experiments/service.py`, `backend/app/metrics/collect.py`,
  `backend/app/runners/adapters.py` (Python supported; others report unsupported).
- `backend/app/sandbox/runner.py` — `trace=True` collection, `SANDBOX_STRICT`
  refuses unsafe execution with SANDBOX UNAVAILABLE, diff/integrity checks.
- `backend/app/api/extended.py` — /evidence /traces /causal /memory /faultmaps
  /tools /replay /metrics /sandbox/monitor /benchmarks /experiments.
- Frontend: 17 routes incl. Arena (state-driven 3D), Evidence Explorer, Trace
  (3D), Causal Graph (3D + challenge + memory), Replay time machine (3D +
  play/step/scrub), Benchmark/Ablation/Experiment labs, Sandbox Monitor,
  System Health, Settings, ⌘/Ctrl+K palette, StateMachineBar.
- Tests: `test_advanced_systems.py` (11) + `evidence-lab.test.tsx` (4);
  full suite backend 35 / frontend 13 green.

### Landing page (light marketing UI, per reference mockup)

- Public route `/` renders `frontend/src/pages/LandingPage.tsx`: header nav
  (Dashboard/Arena/Workbench/Investigation/History → real app routes),
  Python (PyTest) pill, Run Tests CTA, hero, menu cards, SVG agent arena
  (`frontend/src/components/landing/ArenaArt.tsx` — Defender/Prosecutor/
  Judge robots, code cube, debate arrows, speech bubbles), Test Execution
  donut + Latest Output panels, and the 4-card code comparison
  (Buggy/Prosecutor/Defender/FAILED result).
- Dark forensic workspace under `/app` is unchanged (per `design.md`).
- Unknown paths now fall back to `/` instead of `/app`.

### Light-theme pass + Three.js arena (user-requested, supersedes dark `design.md`)

- Entire app re-themed to the light mockup palette via `tailwind.config.js`
  + `src/index.css` tokens (bg cream, white cards, navy ink). No hardcoded
  dark hex remains in `src/`. Monaco editor switched to the light theme.
- `src/components/landing/ArenaScene.tsx`: animated Three.js scene —
  platform slabs, rotating `</>` code cube, three bobbing robots
  (Defender blue / Prosecutor red / Judge green), pulsing debate arrows,
  floating deco cubes, soft shadows, drag-to-orbit + slow auto-rotate,
  `prefers-reduced-motion` static frame, SVG `ArenaArt` fallback when WebGL
  is unavailable. Lazy-loaded (`ArenaScene-*.js` chunk) with SVG Suspense
  fallback so first paint stays fast.
- Note: Tailwind v3 does not hot-reload config *value* changes — the Vite
  dev server must be restarted after palette edits.
- Verified with headless-Chrome screenshots: landing 3D arena, light
  login, logged-in light dashboard.

### Current file

`memory.md` (updated after MVP completion pass)

### Next file / task to work on

- `docs/` benchmark harness for Phase 11 (deliberately broken programs +
  baseline-vs-swarm comparison). Do not claim improvement until measured.

## Required agents (implemented)

### Prosecutor

Finds root cause and proposes a fix (`backend/app/agents/prosecutor.py`
via `provider.py`; prompts versioned `prosecutor-defender-v1`).

### Defender

Challenges the Prosecutor and proposes an alternative
(`backend/app/agents/defender.py`).

### Judge

Runs candidates and bases the final decision on runtime/test evidence
(`backend/app/judge/policy.py` + `backend/app/services/orchestrator.py`).

## Required loop (implemented)

```text
Baseline
→ Prosecutor
→ Defender
→ Execute candidates (sandbox)
→ Judge (runtime/tests as source of truth)
→ Verified OR next round (rejected candidates become evidence)
```

Stops when verified, max rounds, repeated identical candidate, sandbox
failure threshold, or human review.

## Current product decisions

- Runtime verification is mandatory.
- LLM confidence is not proof.
- Test files are protected; tampering → REJECTED and original kept.
- Candidate execution happens in a sandbox (Docker preferred, labelled
  process fallback for local demos).
- Maximum rounds enforced (default 5, per-session override 1–10).
- Rejected candidates retained as evidence + shown in UI/report.
- Frontend and backend are separate (Vite proxy in dev).
- LLM provider abstracted; `LLM_API_KEY` empty → demo mode.
- SQLite for MVP; SQLAlchemy kept PostgreSQL-compatible.
- Monaco loads lazily from CDN with an editable textarea fallback.

## Current implementation checklist

- [x] Frontend scaffold
- [x] Backend scaffold
- [x] Database initializes (SQLite + SQLAlchemy `create_all`)
- [x] Health endpoint
- [x] Docker Compose (app services)
- [x] Authentication (Phase 1)
- [x] Dashboard
- [x] Debug session creation (demo + custom files)
- [x] Baseline runner
- [x] Prosecutor
- [x] Defender
- [x] Sandbox execution engine (Docker + labelled fallback)
- [x] Judge
- [x] Multi-round orchestration
- [x] Evidence timeline
- [x] History/export
- [ ] Benchmark/evaluation (Phase 11, optional next)

## Important context for future coding sessions

Before changing architecture, read:

1. `PRD.md`
2. `architecture.md`
3. `tech-stack.md`
4. `rules.md`
5. `phases.md`
6. `design.md`
7. this file

After completing a meaningful feature:

- mark its checklist item;
- record important implementation decisions;
- record known bugs;
- update the current file;
- state the next file/task.

## Files changed in the MVP completion pass

- `backend/tests/test_health.py` — fixed stale `1-login` phase assertion.
- `backend/tests/test_rounds_safety.py` — new: custom-file e2e,
  protected-test requirement, `_apply_candidate` tamper block,
  cancel/delete round trip.
- `frontend/package.json` — added `@monaco-editor/react`,
  `monaco-editor`, vitest + Testing Library; `test`/`lint` scripts.
- `frontend/vitest.config.ts`, `frontend/src/test/setup.ts` — new.
- `frontend/src/test/` — StatusBadge, DiffViewer, routing/report tests.
- `frontend/src/components/CodeEditor.tsx` — new (Monaco + fallback).
- `frontend/src/components/DiffViewer.tsx` — new (line diff).
- `frontend/src/components/ReportView.tsx` — new (report + export).
- `frontend/src/components/AppShell.tsx` — nav (Dashboard/History/New).
- `frontend/src/pages/NewSessionPage.tsx` — custom source/test editors,
  language + max-rounds controls.
- `frontend/src/pages/DashboardPage.tsx` — agent activity + sandbox panels.
- `frontend/src/pages/SessionPage.tsx` — diffs, all-rounds timeline,
  baseline strip, report/export.
- `frontend/src/pages/HistoryPage.tsx`, `ReportPage.tsx` — new.
- `frontend/src/App.tsx` — history + report routes.
- `frontend/README.md` — updated routes.

## Known risks

- Running untrusted code is the highest-risk component.
- Agent loops can become expensive or repetitive.
- Test manipulation can create false positives.
- LLM output may be malformed or hallucinated.
- Long logs can overwhelm context and storage.

## Known issues

- Monaco loads from CDN; offline browsers get the textarea fallback
  (editable — no data loss, reduced editing experience).
- WS uses `window.location.host`; cross-origin production deployments
  rely on the 1.5s polling fallback while a session runs.
- Process-fallback execution is weaker isolation than Docker; the UI and
  API always label which backend ran a candidate.
- Demo provider only repairs the known `divide()` fixture shape;
  unknown bugs yield a deliberate no-op patch so the Judge rejects it
  with evidence (by design — proves verification, not guessing).

## Never forget

**The system is a debugging verifier, not a chatbot that guesses whether code works.**
