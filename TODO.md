# TODO

Track agreed product and engineering ideas here. Keep entries short, actionable, and current.

## Product

- Improve merchant suggestions beyond simple transaction scanning if repeated-merchant behavior needs ranking or aliases.
- Make "View all" in Recent activity open a full transactions view with filtering by member, category, merchant, date, and amount.
- Add transaction category management so categories are not hardcoded in the Add Activity modal.
- Make account counts, linked institution counts, and "Synced 4 min ago" real data instead of hardcoded text.
- Add Plaid connection UI/token exchange on top of the new account import endpoint and account mapping fields.
- Follow the Plaid guardrails in `docs/plaid-guardrails.md` before making any provider integration changes.
- Replace hardcoded cashflow starting balance with database-backed checking/cash balance logic.
- Add goal creation/editing for the Goals plus button.
- Add upcoming bill creation/editing and bill paid/snooze behavior.
- Add investment holding refresh/edit behavior and real daily portfolio delta calculations.
- Add debt creation/editing and payoff projection details.
- Implement kids allowance history.
- Implement "Pay weekly allowance" so it writes jar balances and creates auditable allowance activity.
- Add smarter chore suggestions later, using kid ages and household context.
- Store household member birthdays/DOBs and derive displayed ages from DOB versus the current date.
- Add chore creation/editing and age-aware chore templates for Kristen, Jason, Lauren, and Ian.
- Decide how adult/older-teen household members should appear in kids allowance views as Kristen gets adult workflows.

## Engineering

- Add Playwright coverage for transaction autocomplete and remaining modal flows beyond the edit and budget regression checks.
- Replace source-level UI tests with DOM/browser tests for modal behavior as the Playwright suite expands.
- Add API route tests for not-found transaction/chore IDs and malformed JSON request bodies.
- Add database migrations instead of schema-only `create table if not exists` scripts before the schema grows further.
- Add database-level constraints for known member slugs, transaction categories, and positive stored bill/debt amounts where appropriate.
- Add a test database strategy so mutation tests do not run against the shared development database.
- Add observability for API errors so UI failures can be diagnosed without checking browser console only.
