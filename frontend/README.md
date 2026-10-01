# Swarm Debugger frontend

React + TypeScript + Vite UI.

Login, dashboard, new session, and the debug workspace (source, debate, judge, runtime evidence).

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite proxy forwards `/api`, `/health`, and the session websocket to `http://127.0.0.1:8000`. Start the backend first.

Demo account: `demo@swarm.local` / `demo`
