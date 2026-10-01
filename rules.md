# Rules — Swarm Debugger

## 1. Core product rules

1. Runtime evidence is the source of truth for fix verification.
2. LLM confidence is never proof that a fix works.
3. Prosecutor and Defender must have genuinely opposing responsibilities.
4. The Judge must be able to reject both proposals.
5. Every rejected candidate must remain available as evidence.
6. Every round must be reproducible from stored inputs and outputs.
7. The system must have a maximum round count.
8. The system must terminate safely on repeated failures.
9. Debugging continues across multiple rounds until convergence or a safe stop condition.

## 2. AI-agent rules

### Prosecutor

Must:

- identify a concrete root cause;
- reference relevant code/test evidence;
- propose a minimal patch;
- state what tests should change.

Must not:

- claim execution success before execution;
- invent test results;
- modify tests just to make a patch pass.

### Defender

Must:

- explicitly challenge the Prosecutor;
- identify assumptions;
- propose an alternative when justified;
- suggest a falsifying test or verification condition.

Must not:

- agree automatically;
- treat LLM confidence as evidence.

### Judge

Must:

- inspect actual runtime/test results;
- report exit code and test status;
- reject candidates with failing required tests;
- explain decisions using evidence.

Must not:

- override failing tests because a candidate sounds correct.

## 3. Code execution rules

Never run untrusted code directly on the host.

Every execution must have:

- timeout;
- memory limit;
- CPU limit;
- process limit;
- output-size limit;
- isolated temporary directory;
- restricted permissions;
- network disabled by default.

Protected files:

- test suite;
- sandbox configuration;
- system configuration;
- secrets;
- host-mounted files.

## 4. Test integrity

The candidate patch must not:

- delete tests;
- weaken assertions;
- skip tests;
- alter test discovery;
- disable safety checks.

The system should detect and reject suspicious modifications to protected test files.

Protected tests must not be modified to make a candidate pass.

## 5. Error handling

Use typed error categories:

```text
VALIDATION_ERROR
AUTH_ERROR
AGENT_ERROR
LLM_PROVIDER_ERROR
SANDBOX_ERROR
TIMEOUT
TEST_FAILURE
INTERNAL_ERROR
```

Return user-friendly messages while keeping detailed diagnostics in server logs.

Do not expose secrets, internal stack traces or host paths to users.

## 6. AI boundaries

AI agents may:

- inspect project files;
- reason about failures;
- propose patches;
- propose tests;
- summarize runtime evidence.

AI agents may not:

- execute arbitrary host commands;
- access secrets;
- access the production filesystem;
- silently change project requirements;
- silently modify protected tests;
- declare success without Judge evidence.

## 7. Coding rules

- Prefer small functions.
- Use TypeScript types rather than `any` where possible.
- Validate all API inputs.
- Keep agent prompts versioned.
- Keep orchestration logic separate from UI.
- Keep sandbox logic separate from agent logic.
- Write tests for every critical state transition.
- Log every candidate execution with a session and candidate ID.
- Do not implement Prosecutor, Defender, Judge, or the full debugging engine before the Phase 0 foundation and Phase 1 login are in place.

## 8. UI rules

- Never hide whether a result is AI-generated or runtime-verified.
- Use clear status labels: `PROPOSED`, `RUNNING`, `PASSED`, `FAILED`, `REJECTED`, `VERIFIED`.
- Never display a failed candidate as the final fix.
- Show evidence next to decisions.
