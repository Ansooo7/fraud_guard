# FraudGuard — AI-Powered Fraud Detection System

## Overview

Production-grade banking fraud detection system built as a pnpm workspace monorepo. Features a React dashboard, Node.js/Express API with JWT auth, rule-based fraud scoring engine, PostgreSQL database, real-time WebSocket alerts, case management, in-app notifications, and email verification via magic link.

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
- **Auth**: JWT (jsonwebtoken) + bcrypt + email magic-link verification
- **Real-time**: WebSocket (ws library) with per-user socket tracking

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
| POST | /auth/login | — | JWT login (blocks unverified emails) |
| POST | /auth/register | — | Register + send magic-link verification email |
| GET | /auth/verify-email?token= | — | Redeem magic link → returns JWT |
| POST | /auth/resend-verification | — | Resend verification email |
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
| GET | /rules | JWT | List fraud rules |
| POST | /rules | JWT | Create fraud rule |
| PATCH | /rules/:id | JWT | Update fraud rule |
| DELETE | /rules/:id | JWT | Delete fraud rule |
| GET | /cases | JWT | List cases (filterable) |
| POST | /cases | JWT | Create case |
| GET | /cases/:id | JWT | Get single case |
| PATCH | /cases/:id | JWT | Update case (status/priority/assign) |
| DELETE | /cases/:id | JWT | Delete case |
| GET | /cases/:id/notes | JWT | List notes for case |
| POST | /cases/:id/notes | JWT | Add note to case |
| GET | /notifications | JWT | List in-app notifications |
| GET | /notifications/unread-count | JWT | Unread count for badge |
| PATCH | /notifications/:id/read | JWT | Mark one as read |
| POST | /notifications/read-all | JWT | Mark all as read |
| DELETE | /notifications/:id | JWT | Delete notification |
| WS | /api/ws | — | WebSocket (send auth msg after connect) |

## Database Schema

Tables: `users`, `transactions`, `fraud_alerts`, `risk_profiles`, `fraud_rules`, `fraud_cases`, `case_notes`, `notifications`, `email_verification_tokens`

Seeded with: admin + analyst users (pre-verified), 100 transactions, 20 fraud alerts, 4 risk profiles.

## Auth Credentials (Demo)

- Admin: `admin@fraudguard.io` / `admin123` (pre-verified)
- Analyst: `analyst@fraudguard.io` / `analyst123` (pre-verified)

## Email Verification (Magic Link)

- On signup, a verification token (32-byte hex, 24h TTL) is generated and stored in `email_verification_tokens`
- The verify URL is **logged to the API server console** in development (stub in `artifacts/api-server/src/lib/email.ts`)
- To wire real email: replace the stub in `email.ts` with your provider (Resend, SendGrid, Nodemailer)
- Connect Resend via: Replit integrations → Resend connector → `proposeIntegration`
- Users cannot log in until their email is verified
- Demo accounts (admin/analyst) are pre-verified in the DB

## Frontend Pages

- `/login` — JWT login; shows "email not verified" banner with resend link on 403
- `/signup` — Creates account → redirects to `/check-email`
- `/check-email` — "Check your email" screen with resend button + dev tip
- `/verify-email?token=` — Redeems magic link → auto-login → redirect to dashboard
- `/dashboard` — Command center: stats, fraud trend chart, risk distribution, recent transactions + alerts
- `/transactions` — Filterable table with status badges and fraud score bars
- `/alerts` — Alert feed with severity badges and resolve action
- `/analytics` — Deep-dive: AreaChart, PieChart, top risk users table
- `/users` — Users table (admin view)
- `/fraud-check` — Single transaction fraud check with cascading location picker
- `/fraud-batch` — Batch transaction fraud check
- `/rules` — Rule Engine CRUD with toggle and preset rules
- `/cases` — Case management: list, drawer, notes thread, status progression

## Orval Config Notes

- Zod section uses `mode: "single"`, `indexFiles: false`, `target: "generated/api"` — do NOT revert
- `lib/api-zod/src/index.ts` exports `export * from "./generated/api/api"` only
- `lib/api-client-react/src/index.ts` re-exports all hooks + `setAuthTokenGetter`

## Auth Token

JWT stored in `localStorage` key `fraud_token`. Call `setAuthTokenGetter(() => token)` from `@workspace/api-client-react` after login and on app mount.

## WebSocket

After connecting, client must send `{"type":"auth","token":"..."}` to register for user-specific notifications.
Events: `fraud_alert` (toast + invalidate alerts), `new_transaction` (invalidate transactions), `notification` (update bell + show toast).

## Fraud Scoring Engine

Located in `artifacts/api-server/src/lib/fraud-engine.ts`. Rule-based scoring:
- Amount deviation from user average
- High-risk merchant categories (crypto, gambling, wire_transfer, jewelry)
- Location/device diversity
- User transaction history
- Broadcasts via WebSocket on flagged/blocked transactions

## Notifications

Triggered automatically on:
- Case created → all admins notified
- Case status changed → assignee + creator notified
- Case assigned → new assignee notified
- Note added → case assignee + creator notified

Real-time delivery via WebSocket per-user socket tracking.
