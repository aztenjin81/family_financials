# Agent Instructions

## Project Context

Family Financials is a household finance dashboard for The Czechowski Family. The app shows net worth, accounts, budgets, transactions, bills, goals, investments, debts, and kids' allowance/chores.

The primary user is John. User-facing household data should use John, not Alex. The internal member slug `alex` may still exist in seed/demo data until a deliberate migration renames it.

## Database Rules

- Do not use the `hermes` database for app data.
- App data belongs in the `family_financials` PostgreSQL database.
- If credentials reference another database, scripts should rewrite admin connections to the `postgres` maintenance database and app connections to `family_financials`.
- Do not print database passwords, connection URIs, or other secrets in normal responses.
- Keep `codex_db_credentials.md`, `.env`, and `.env.*` ignored by git.

## Development Workflow

- Prefer small, verifiable changes.
- Every behavior change must include automated tests in the same change. Do not leave new app, API, or database behavior untested.
- Every commit must pass the repo pre-commit hook. The hook must include a Gitleaks staged secret scan and must halt commits on failure.
- Run focused tests while developing new behavior. The pre-commit hook is the mandatory final local gate for the full secret scan, test suite, and build.
- Commit completed, tested checkpoints to git whenever it makes sense. Prefer small coherent commits over large mixed changes.
- Use the existing scripts for database work:
  - `npm run db:create`
  - `npm run db:schema`
  - `npm run db:seed`
  - `npm run db:inspect`
- Use `npm run api` for the local API server.
- Use `npm run dev` for the Vite frontend.

## Product Behavior

- The dashboard should hydrate from `/api/dashboard`.
- The static fixture in `src/data.js` is a fallback and seed source. Keep it aligned with visible app defaults when practical.
- Greeting copy should adapt to local time of day.
- Avoid adding authentication-sensitive or bank-integration behavior until the data model and write flows are stable.

## UI Guidance

- Preserve the existing dashboard style and density.
- Build actual working controls before adding decorative or marketing-style content.
- Keep financial values readable and avoid layout shifts when balances are hidden.
- Prefer pragmatic, household-useful workflows over generic finance-app features.
