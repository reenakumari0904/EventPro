# EventPro — Milestone 3: Event Intelligence, Agent Orchestration & Production Deployment

An AI-powered event management platform: registration & check-in, venue/speaker operations, sponsor & incident ops, an Event Intelligence Engine, and — as of this milestone — Agent Orchestration, real-time decision support, and a production-ready deployment.

**New in Milestone 3:** see `docs/MILESTONE_3_SUMMARY.md` for exactly what was built against each of the 10 milestone objectives.

## Quick start (Docker Compose — recommended)

```bash
cp .env.example .env      # fill in real secrets (see comments in the file)
docker compose up --build -d
```

Open `http://localhost:8080`. Full instructions, environment variables, and a manual/bare-metal alternative: `docs/DEPLOYMENT.md`.

## Quick start (local dev, no Docker)

```bash
# Database
createdb eventpro
psql eventpro -f backend/config/schema.sql
psql eventpro -f backend/config/schema_indexes.sql

# Backend
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run dev                # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

## Folder structure

```
eventpro-project/
├── frontend/                       React (Vite) dashboard UI
│   ├── Dockerfile, nginx.conf      Production image (Milestone 3)
│   └── src/
│       ├── api.js                  Fetch layer + apiStream() for SSE (Milestone 3)
│       └── pages/
│           └── ExecutiveDashboardPage.jsx   Live Command Center panel (Milestone 3)
│
├── backend/                        Node.js + Express API
│   ├── Dockerfile                  Production image (Milestone 3)
│   ├── controllers/
│   │   ├── intelligence.controller.js       Event Intelligence Engine
│   │   ├── orchestration.controller.js      Orchestration HTTP layer (Milestone 3)
│   │   └── health.controller.js             Liveness/readiness (Milestone 3)
│   ├── services/
│   │   ├── agents.js                        Agent Registry (Milestone 3)
│   │   ├── orchestrator.js                  Parallel Agent Orchestrator (Milestone 3)
│   │   └── workflows/                       Reactive Workflow Engine (Milestone 3)
│   │       ├── engine.js                        generic sequencing/approval/escalation engine
│   │       ├── speakerCancellation.js            Scenario 1: speaker cancellation
│   │       ├── sponsorPerformance.js             Scenario 2: sponsor performance
│   │       ├── venueIssue.js                     Scenario 3: venue issue
│   │       ├── highCrowd.js                      Scenario 4: high crowd detection
│   │       └── index.js                          registers all workflows on boot
│   ├── middleware/
│   │   ├── security.middleware.js           Rate limiting (Milestone 3)
│   │   └── error.middleware.js              Centralized error handling (Milestone 3)
│   ├── utils/cache.js                       In-memory TTL cache (Milestone 3)
│   ├── utils/metrics.js                     In-process metrics registry → /api/metrics (Milestone 3)
│   ├── config/schema_indexes.sql            Performance indexes (Milestone 3)
│   └── tests/                               Jest + Supertest suite (Milestone 3)
│
├── scripts/
│   ├── backup.sh                    Database backup (pg_dump, retention pruning) (Milestone 3)
│   └── restore.sh                   Database restore from a backup file (Milestone 3)
│
├── docker-compose.yml               Postgres + backend + frontend (Milestone 3)
├── .github/workflows/ci.yml         Test + build CI (Milestone 3)
└── docs/
    ├── MILESTONE_3_SUMMARY.md       Objective-by-objective delivery map
    ├── ARCHITECTURE.md
    ├── API.md
    ├── AGENT_ORCHESTRATION.md
    ├── DEPLOYMENT.md
    └── TESTING.md
```

## Documentation

| Doc | Covers |
|---|---|
| `docs/MILESTONE_3_SUMMARY.md` | What was built, mapped to each of the 10 objectives |
| `docs/ARCHITECTURE.md` | System diagram, layers, security posture |
| `docs/API.md` | Every endpoint, grouped by module, with the orchestration report shape |
| `docs/AGENT_ORCHESTRATION.md` | How the Agent Registry + Orchestrator work, and how to add a new agent |
| `docs/DEPLOYMENT.md` | Docker Compose & manual deployment, env vars, scaling notes |
| `docs/TESTING.md` | How to run the automated suite, and the manual E2E checklist |

## Status by milestone

- **Milestone 1** — Registration Intelligence & Attendee Management (auth, events, registration, check-in, dashboard basics).
- **Milestone 2** — Venue/Speaker Operations, Sponsor/Incident Ops, first AI-integrated endpoints, the Event Intelligence Engine.
- **Milestone 3** (this one) — Agent Orchestration, real-time decision support, end-to-end testing, security/reliability hardening, performance optimization, and a production-ready Docker deployment. Details: `docs/MILESTONE_3_SUMMARY.md`.

## Known gaps / next steps

- Frontend automated tests (Vitest/Playwright) — not yet added; see `docs/TESTING.md` for the plan and current CI gate (a clean production build).
- Real ML models (no-show prediction, attendee segmentation) are still out of scope — the AI-assisted endpoints use live data + an LLM (Gemini), not trained models. New models can be added as agents to the orchestrator without changing its design.
- Multi-source registration ingestion (Google Forms, Eventbrite, CSV/Excel upload) is not implemented.
