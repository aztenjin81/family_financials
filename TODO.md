# TODO

Track agreed product and engineering ideas here. Keep entries short, actionable, and current.

## Product

- Improve merchant suggestions beyond simple transaction scanning if repeated-merchant behavior needs ranking or aliases.
- Follow the Plaid guardrails in `docs/plaid-guardrails.md` before making any provider integration changes.
- Add smarter chore suggestions later, using kid ages and household context.
- Decide how adult/older-teen household members should appear in kids allowance views as Kristen gets adult workflows.

## Engineering

- Add Playwright coverage for transaction autocomplete and remaining modal flows beyond the edit and budget regression checks.
- Replace source-level UI tests with DOM/browser tests for modal behavior as the Playwright suite expands.
- Add API route tests for not-found transaction/chore IDs and malformed JSON request bodies.
- Add database migrations instead of schema-only `create table if not exists` scripts before the schema grows further.
- Add database-level constraints for known member slugs, transaction categories, and positive stored bill/debt amounts where appropriate.
- Add a test database strategy so mutation tests do not run against the shared development database.
- Add observability for API errors so UI failures can be diagnosed without checking browser console only.
