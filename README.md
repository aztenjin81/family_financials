# Family Financials

Hearth is a family financial management dashboard built from the design handoff in `design_handoff_family_financials`.

## Development

```bash
npm install
npm run dev
```

The dev server runs with Vite. For a production build:

```bash
npm run build
```

To serve the built app without Vite:

```bash
npm run build
npm run serve
```

## Database

Database scripts read connection details from `codex_db_credentials.md`, but they do not use the `hermes` database for app data. The admin connection is rewritten to the `postgres` maintenance database, and the app connection is rewritten to `family_financials`.

```bash
npm run db:create
npm run db:schema
npm run db:seed
npm run db:inspect
```

## API

Run the API in a separate terminal while using the Vite dev server:

```bash
npm run api
```

The app fetches `/api/dashboard`. During development, Vite proxies that path to `http://127.0.0.1:8787`. The production static server also serves the API route:

```bash
npm run build
npm run serve
```
