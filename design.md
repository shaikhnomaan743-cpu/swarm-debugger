# Design — Swarm Debugger

> Update: per user request the product moved from the dark forensic theme to
> the light marketing UI (see landing reference). Tokens below are the
> current light system. Agent colors and status-label rules are unchanged.

## 1. Design direction

Visual identity: **light, warm, product-marketing interface with a 3D agent
arena on the landing page and clean white workspace cards inside the app**.

The interface should feel like a professional debugging console, not a generic chatbot.

Primary visual idea:

- dark workspace;
- high-contrast code;
- clear agent separation;
- evidence-driven status indicators;
- subtle grid/terminal details;
- restrained animation.

## 2. Color system

Use CSS variables so the theme can be changed centrally.

```css
:root {
  --bg: #f5f3ee;
  --surface: #ffffff;
  --surface-2: #faf9f6;
  --border: #e7e2d8;

  --text: #101828;
  --muted: #667085;

  --primary: #101828;
  --primary-soft: #e7e2d8;

  --prosecutor: #f04452;
  --defender: #2e90fa;
  --judge: #12b76a;

  --warning: #dc6803;
  --danger: #d92d20;
}
```

Do not use color alone to communicate status. Pair colors with labels/icons.

Prosecutor, Defender, and Judge must remain visually distinct so proposals are never confused with verified runtime results.

## 3. Fonts

Recommended:

- UI: Inter
- Code: JetBrains Mono

Fallbacks:

```text
Inter, system-ui, sans-serif
JetBrains Mono, SFMono-Regular, Consolas, monospace
```

## 4. Typography

```text
Page title: 28–32px / semibold
Section title: 18–20px / semibold
Body: 14–16px
Secondary: 12–13px
Code: 12–14px
Metric number: 24–32px / bold
```

## 5. Core screens

### Login

```text
+------------------------------------------+
|              SWARM DEBUGGER              |
|  Adversarial AI debugging with runtime   |
|  verification                            |
|                                          |
|  Email                                   |
|  [____________________________]           |
|                                          |
|  Password                                |
|  [____________________________]           |
|                                          |
|           [ Sign in ]                    |
+------------------------------------------+
```

### Dashboard

Top:

- logo;
- current user;
- system status;
- New Debug Session.

Metrics:

- Active Sessions
- Verified Fixes
- Failed Candidates
- Avg. Rounds

Main:

- recent sessions table;
- live agent activity;
- sandbox status.

### Debug Workspace

Recommended layout:

```text
┌─────────────────────────────────────────────────────────┐
│ Session: Bug #104                  Round 2   RUNNING     │
├───────────────┬────────────────────────┬────────────────┤
│ Source / Diff │ Agent Debate           │ Runtime Judge  │
│               │                        │                │
│ code editor   │ Prosecutor             │ Candidate A    │
│               │ Defender               │ PASSED  ✓      │
│               │                        │                │
│               │ Evidence               │ Candidate B    │
│               │                        │ FAILED  ×      │
├───────────────┴────────────────────────┴────────────────┤
│ Runtime Output / Test Evidence                           │
└─────────────────────────────────────────────────────────┘
```

### Agent cards

Prosecutor:

- red/pink accent;
- root cause;
- evidence;
- proposed patch;
- expected tests.

Defender:

- blue accent;
- objections;
- alternative diagnosis;
- alternative patch;
- falsification tests.

Judge:

- green accent when verified;
- runtime facts;
- test summary;
- final decision.

## 6. Status badges

Use explicit labels:

- `PROPOSED`
- `RUNNING`
- `PASSED`
- `FAILED`
- `REJECTED`
- `VERIFIED`
- `TIMEOUT`
- `SANDBOX ERROR`

Never display a failed candidate as the final fix. Never present LLM confidence as verification.

## 7. Motion

Use animation sparingly:

- 150–200ms card transitions;
- progress indicator while agents work;
- terminal output appearing incrementally;
- no excessive bouncing/glowing.

## 8. UX principles

1. Evidence should be visible beside every important decision.
2. User should always know what the system is currently doing.
3. Never make an AI proposal look verified before execution.
4. Make the code diff easy to inspect.
5. Preserve the history of every round.
6. Keep destructive actions behind confirmation.
7. Make errors actionable.

## 9. Responsive behavior

Desktop-first because the application is a developer workspace.

Tablet:

- stack Judge below debate.

Mobile:

- use tabs for Source / Debate / Judge;
- preserve runtime output and decision status;
- avoid horizontal overflow.

## 10. Accessibility

- keyboard navigation;
- visible focus states;
- semantic buttons;
- sufficient contrast;
- status communicated with text as well as color;
- reduced-motion support.
