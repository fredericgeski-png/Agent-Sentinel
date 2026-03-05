# Kinetic Integrity Monitor

Lightweight, self-hosted AI agent safety & observability.  
Runs on a **$10/mo VPS**. No cloud lock-in. No data leaves your server.

---

## Quick Start (Docker — one command)

```bash
# 1. Clone
git clone https://github.com/you/kinetic-integrity-monitor
cd kinetic-integrity-monitor

# 2. Configure
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD at minimum

# 3. Launch
docker compose up -d --build

# 4. Open dashboard
open http://localhost:3001
```

---

## Local Dev

```bash
cp .env.example .env
# Start postgres (or use docker compose up postgres -d)
npm install
npm run dev          # starts backend :3001 + frontend :5173 concurrently
```

---

## SDK Integration

### Python — LangChain

```python
from kinetic.monitor import KineticCallbackHandler

handler = KineticCallbackHandler(agent_id="my-chain")
result = chain.invoke({"input": "..."}, config={"callbacks": [handler]})
```

### Python — CrewAI

```python
from kinetic.monitor import wrap_crewai_agent
from crewai import Crew

crew = wrap_crewai_agent(
    Crew(agents=[...], tasks=[...]),
    agent_id="research-crew-v1"
)
crew.kickoff()
# Kinetic now tracks entropy, loops, and auto-terminates at threshold
```

### Python — Generic callable

```python
from kinetic.monitor import wrap_agent

@wrap_agent(agent_id="my-agent")
def run_agent(prompt: str) -> str:
    return llm.call(prompt)
```

### Node.js

```ts
import { AgentMonitor } from './sdk/node/src/monitor'

const monitor = new AgentMonitor('my-agent')

// Wrap individual steps
const result = await monitor.wrap(
  async () => llm.call(prompt),
  'llm_call'
)

// Manual recording
monitor.recordOutput(rawOutput, 'search_tool')
```

### Go

```go
import "github.com/you/kinetic/sdk/go"

m := kinetic.NewMonitor("my-agent", uuid.New().String())

result, err := m.Wrap(func() (string, error) {
    return llm.Call(ctx, prompt)
}, "llm_call")
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/calculate-entropy` | Compute entropy breakdown for an agent step |
| GET  | `/api/v1/kill-switch/check` | Check if kill switch is active |
| POST | `/api/v1/kill-switch/activate` | Activate global or per-agent kill switch |
| POST | `/api/v1/kill-switch/reset` | Reset kill switch |
| GET  | `/api/v1/telemetry` | Paginated telemetry feed |
| POST | `/api/v1/telemetry` | Emit a telemetry event |
| GET  | `/api/v1/telemetry/stats` | Dashboard stats (sessions, entropy, events) |
| GET  | `/health` | Health check |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | — | `3001` | Server port |
| `NODE_ENV` | — | `development` | Set to `production` in prod |
| `CORS_ORIGIN` | — | `*` | Allowed CORS origin |
| `WEBHOOK_URLS` | — | — | Comma-separated kill-switch notification URLs |
| `WEBHOOK_SECRET` | — | — | HMAC secret for webhook signatures |
| `KINETIC_API_URL` | — | `http://localhost:3001/api/v1` | SDK target URL |
| `KINETIC_ENTROPY_THRESHOLD` | — | `0.85` | Auto-terminate entropy threshold |
| `VITE_API_URL` | — | `/api/v1` | Frontend API base URL |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Agent Process (Python / Node / Go)                 │
│  ┌──────────────────────────────────────────────┐   │
│  │  SDK: AgentMonitor / KineticCallbackHandler  │   │
│  │  • Records tokens, tool calls, loop signals  │   │
│  │  • POSTs /calculate-entropy every 5 calls   │   │
│  │  • Auto-terminates at threshold             │   │
│  └───────────────────────┬──────────────────────┘   │
└──────────────────────────┼──────────────────────────┘
                           │ HTTP (3s timeout, offline queue)
┌──────────────────────────▼──────────────────────────┐
│  Kinetic Backend (Node.js + Express)                │
│  • Entropy engine (Shannon + loop + tool + drift)   │
│  • Kill switch (in-memory + DB + webhooks)          │
│  • Telemetry store + stats aggregation              │
│  • Rate limiting (120 req/min per agent)            │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│  PostgreSQL                                         │
│  sessions · entropy_logs · telemetry · kill_switch  │
└─────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│  React Dashboard (served by Express in prod)        │
│  • Real-time entropy gauge (Canvas + animation)     │
│  • Per-agent chart (Recharts)                       │
│  • Kill All button with confirm dialog              │
│  • Live telemetry feed (TanStack Query, 3s poll)    │
└─────────────────────────────────────────────────────┘
```

---

## Docker Image Size

Multi-stage build: `node:20-alpine` builder → `node:20-alpine` runtime  
Final image: **~210–230 MB** (pruned node_modules + compiled JS only)

---

## Deployment on a $10/mo VPS

```bash
# On your server (Ubuntu 22.04 / Debian 12)
curl -fsSL https://get.docker.com | sh
git clone https://github.com/you/kinetic-integrity-monitor
cd kinetic-integrity-monitor
cp .env.example .env && nano .env   # set strong POSTGRES_PASSWORD
docker compose up -d --build
```

For HTTPS, put Caddy or nginx in front:

```
# Caddyfile
monitor.yourdomain.com {
    reverse_proxy localhost:3001
}
```
