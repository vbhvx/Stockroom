# Stockroom

Stockroom is an operations and inventory management application for catalog, inventory movements and reconciliation, orders, fulfillment, payments, staff, audit events, and operational reports.

## Architecture

It is a Next.js 14/React 18 application backed by PostgreSQL and Drizzle ORM. Feature code is organized under `src/features` and `src/server`; dashboard pages live in `src/app/dashboard`; `src/app/api/v1` contains the HTTP API. Database schema/migrations are managed through Drizzle, with seed support in `scripts/seed.ts`.

## Setup

```bash
cd 3_Stockroom
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Supply PostgreSQL URLs for development and tests plus distinct `SESSION_SECRET` and `JWT_SECRET` values. Payment integration defaults to the documented `simulated` provider mode; a webhook secret is still required by the configuration contract.

```bash
npm test
npm run lint
npm run build
npm run db:migrate
```
