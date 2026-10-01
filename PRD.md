# PRD — Swarm Debugger

## 1. Product summary

Swarm Debugger (PS 02) is a debugging platform that uses multiple specialized AI agents with opposing roles and a runtime-based judge.

The goal is to reduce the failure mode of a single AI coding assistant repeatedly proposing the same incorrect fix.

The system must not decide that a fix is correct merely because an LLM sounds confident. A candidate fix is accepted only after the Judge executes the code and evaluates the relevant test suite.

## 2. Problem

Single-agent code assistants can get stuck repeatedly proposing the same incorrect fix because there is no independent mechanism to challenge the diagnosis or verify it.

## 3. Target users

- Students and developers debugging programming assignments
- Software engineers investigating failing tests
- Hackathon teams building AI-assisted developer tools
- Educators demonstrating agentic debugging workflows

## 4. Primary user journey

1. User signs in.
2. User creates a debugging session.
3. User uploads/pastes a repository, source file or reproducible bug.
4. User provides the failing command/test suite.
5. Prosecutor analyzes the failure and proposes a root cause and patch.
6. Defender reviews the Prosecutor's reasoning and proposes a counter-diagnosis or alternative patch.
7. Judge creates isolated execution candidates and runs the test suite.
8. Runtime results are displayed with stdout, stderr, exit code, duration and test summary.
9. The winning candidate is selected only according to configured runtime/test evidence.
10. If no candidate succeeds, the system starts another round using evidence from rejected candidates.
11. The session ends when a valid fix is verified, the round limit is reached, or the system requires human intervention.

## 5. MVP features

### Authentication

- Login page
- Session handling
- Protected application routes
- Demo account mode for local development

### Debugging workspace

- Create debugging session
- Upload/paste code
- Upload test files or define a test command
- Display original failure
- Start/pause/cancel a debugging run

### Multi-agent debate

- Prosecutor response
- Defender response
- Agent evidence/reasoning summary
- Round-by-round history
- Clear separation between proposal and verification

### Runtime Judge

- Execute candidate patches in a sandbox
- Capture exit code
- Capture stdout/stderr
- Capture test results
- Enforce timeout and resource limits
- Compare candidates against the baseline failure

### Evidence timeline

- Round number
- Candidate
- Root-cause hypothesis
- Patch summary
- Runtime result
- Rejected/accepted status
- Reason for decision

### Dashboard

- Active sessions
- Verified fixes
- Failed runs
- Average rounds
- Recent debugging sessions
- System/sandbox status

## 6. Non-goals for MVP

- Automatic deployment to production
- Editing production repositories
- Arbitrary internet access from executed code
- Claiming a fix is correct without execution evidence
- Unlimited autonomous agent loops
- Supporting every programming language on day one

## 7. Definition of done

The MVP is complete when a user can:

- log in;
- create a debugging session;
- submit a deliberately broken program and failing test;
- receive independent Prosecutor and Defender proposals;
- execute both candidates in an isolated environment;
- see the real test/runtime output;
- have the Judge select a passing candidate based on configured evidence;
- see rejected candidates retained as evidence;
- run multiple rounds until a valid fix is found or the run terminates safely.

## 8. Example demo

Bug:

```python
def divide(a, b):
    return a / b
```

Failing test expects a controlled result for `b == 0`.

Possible flow:

- Prosecutor: identifies missing zero-division handling.
- Defender: challenges whether the API contract expects `None`, an exception, or a domain-specific error.
- Judge: executes both patches against the supplied tests.
- Candidate A fails one test.
- Candidate B passes the full suite.
- Judge accepts Candidate B and records the runtime evidence.

## 9. Success metrics

Track these as product metrics, not as claims until measured:

- Fix verification rate
- Tests passed per accepted candidate
- Average rounds to verified fix
- Percentage of sessions where the first proposal fails
- Sandbox execution failure rate
- Average execution latency
- Agent disagreement rate

## 10. Hard product constraints (PS 02)

- **Prosecutor Agent** identifies root cause and proposes a fix.
- **Defender Agent** challenges the Prosecutor and proposes an alternative.
- **Judge Agent** executes the candidates against the real failing tests.
- **Runtime/test output is the source of truth.**
- **LLM confidence must never be treated as proof.**
- **Rejected fixes must become evidence for later rounds.**
- **Debugging must continue across multiple rounds** until convergence or a safe stop condition.
- **Code execution must happen inside an isolated sandbox.**
- **Protected tests must not be modified** to make a candidate pass.
