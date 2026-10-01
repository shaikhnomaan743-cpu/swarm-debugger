# Phases — Swarm Debugger

> Status 2026-09-29: Phases 0–10 are built and verified end to end
> (backend 24 pytest green, frontend 8 vitest green, production builds pass,
> live demo loop reaches `verified`). Phase 11 (benchmark) is optional next.

## Phase 0 — Foundation

Goal: create a clean repository and development environment.

Tasks:

- create frontend and backend folders;
- configure environment variables;
- configure linting/formatting;
- create database;
- create Docker Compose;
- add health endpoint;
- add README.

Done when:

- frontend starts;
- backend starts;
- `/health` returns success;
- database initializes.

Done for local scaffolding.

## Phase 1 — Login

Goal: create the authentication entry point.

Tasks:

- login screen;
- form validation;
- demo/local authentication;
- protected routes;
- logout;
- user session state.

UI:

- centered login card;
- product name;
- short one-line explanation;
- email/username;
- password;
- sign-in button.

Do not overbuild authentication in the first prototype.

**Phase 1 is implemented. Do not start Phase 2 until requested.**

## Phase 2 — Dashboard

Goal: give the user a clear control center.

Dashboard sections:

- active debugging sessions;
- verified fixes;
- failed executions;
- average rounds;
- recent sessions;
- system/sandbox status;
- `New Debug Session` primary action.

Use real backend data once APIs exist. Use clearly marked demo data only during early UI development.

## Phase 3 — Debug Session Creation

Tasks:

- create session form;
- project name;
- language;
- source/repository input;
- failing test input;
- test command;
- constraints;
- create session.

Example:

```text
Language: Python
Entry point: solution.py
Test command: pytest -q
```

## Phase 4 — Baseline Execution

Before agents propose fixes:

- execute the original project;
- record failing tests;
- capture stdout/stderr;
- store baseline result.

This prevents the system from accepting a patch for a bug that cannot be reproduced.

## Phase 5 — Prosecutor Agent

Build:

- prompt;
- structured response schema;
- code-context selection;
- patch generation;
- validation.

Output:

- root cause;
- evidence;
- patch;
- expected result.

## Phase 6 — Defender Agent

Build:

- Prosecutor context input;
- adversarial prompt;
- alternative diagnosis;
- alternative patch;
- falsification tests.

The UI should visually separate Prosecutor and Defender.

## Phase 7 — Judge + Sandbox

Build the most important technical component.

Flow:

```text
Candidate
   ↓
Create isolated workspace
   ↓
Apply patch
   ↓
Run test command
   ↓
Collect output
   ↓
Normalize result
   ↓
Judge decision
```

Add:

- timeout;
- memory limit;
- CPU limit;
- no network;
- output limits;
- cleanup;
- rejection if protected tests were modified.

## Phase 8 — Iterative Rounds

If no candidate passes:

```text
Rejected candidate evidence
        ↓
Round N+1 context
        ↓
Prosecutor
        ↓
Defender
        ↓
Judge
```

Stop conditions:

- verified fix;
- max rounds reached;
- repeated identical candidate;
- sandbox failure threshold;
- human review required.

## Phase 9 — Evidence & History

Build:

- round timeline;
- candidate cards;
- runtime logs;
- diff viewer;
- decision explanation;
- export/debug report.

## Phase 10 — Polish

Add:

- responsive design;
- loading states;
- empty states;
- error recovery;
- accessibility;
- keyboard shortcuts;
- performance improvements.

## Phase 11 — Evaluation

Create a benchmark set with deliberately broken programs.

Measure:

- baseline single-agent result;
- Swarm Debugger result;
- rounds;
- execution failures;
- verified fixes;
- false acceptance rate.

Do not claim improvement until the benchmark has actually been run.

## Recommended build order

```text
Login
  ↓
Dashboard
  ↓
Create Debug Session
  ↓
Baseline Runner
  ↓
Prosecutor
  ↓
Defender
  ↓
Sandbox
  ↓
Judge
  ↓
Multi-round loop
  ↓
Evidence/history
  ↓
Polish
```
