# FraudGuard — AI-Powered Fraud Detection System

## Overview

Production-grade banking fraud detection system built as a pnpm workspace monorepo. Features a React dashboard, Node.js/Express API with JWT auth, rule-based fraud scoring engine, PostgreSQL database, and real-time WebSocket alerts.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript**: 5.9 (strict)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui + Recharts
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Real-time**: WebSocket (ws library)
- **Build**: esbuild (ESM bundle for API server)

## Artifacts

| Artifact | Path | Port | Description |
|---|---|---|---|
| `fraud-dashboard` | `/` | 20272 | React frontend dashboard |
| `api-server` | `/api` | 8080 | Express REST API + WebSocket |
| `mockup-sandbox` | `/mockup-sandbox` | — | Canvas component previews |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema to PostgreSQL
- `pnpm --filter @workspace/api-server run dev` — run API server (build + start)

## API Routes

All routes are prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/login | — | JWT login |
| GET | /auth/me | JWT | Current user |
| GET | /transactions | JWT | List transactions (filterable) |
| POST | /transactions | JWT | Create + auto-score transaction |
| GET | /transactions/:id | JWT | Single transaction |
| GET | /alerts | JWT | List fraud alerts |
| PATCH | /alerts/:id/resolve | JWT | Resolve an alert |
| GET | /analytics/summary | JWT | Dashboard summary stats |
| GET | /analytics/fraud-trend | JWT | 30-day daily trend |
| GET | /analytics/risk-distribution | JWT | Risk level breakdown |
| GET | /analytics/top-risk-users | JWT | Users by risk score |
| GET | /users | JWT | List users |
| WS | /api/ws | — | WebSocket (fraud_alert, new_transaction) |

## Database Schema

Tables: `users`, `transactions`, `fraud_alerts`, `risk_profiles`

Seeded with: 6 users (admin/analyst/user roles), 100 transactions, 20 fraud alerts, 4 risk profiles.

## Auth Credentials (Demo)

- Admin: `admin@fraudguard.io` / `admin123`
- Analyst: `analyst@fraudguard.io` / `analyst123`

## Frontend Pages

- `/login` — JWT login with demo credentials shown
- `/dashboard` — Command center: stats, fraud trend chart, risk distribution, recent transactions + alerts
- `/transactions` — Filterable table with status badges and fraud score bars
- `/alerts` — Alert feed with severity badges and resolve action
- `/analytics` — Deep-dive: AreaChart, PieChart, top risk users table
- `/users` — Users table (admin view)

## Orval Config Notes

- Zod section uses `mode: "single"`, `indexFiles: false`, `target: "generated/api"` — do NOT revert
- `lib/api-zod/src/index.ts` exports `export * from "./generated/api/api"` only
- `lib/api-client-react/src/index.ts` re-exports all hooks + `setAuthTokenGetter`

## Auth Token

JWT stored in `localStorage` key `fraud_token`. Call `setAuthTokenGetter(() => token)` from `@workspace/api-client-react` after login and on app mount.

## WebSocket

Connect via:
```ts
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
```
Events: `fraud_alert` (triggers toast + invalidate alerts), `new_transaction` (invalidate transactions).

## Fraud Scoring Engine

Located in `artifacts/api-server/src/lib/fraud-engine.ts`. Rule-based scoring:
- Amount deviation from user average
- High-risk merchant categories (crypto, gambling, wire_transfer, jewelry)
- Location/device diversity
- User transaction history
- Broadcasts via WebSocket on flagged/blocked transactions
