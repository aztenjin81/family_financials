# TODO

Track agreed product and engineering ideas here. Keep entries short, actionable, and current.

## Product

- Merge newly added transactions into the current dated "Today" group instead of creating a separate plain `Today` group.
- Add transaction edit/delete actions.
- Auto-fill transaction category, member, and icon from prior merchant history.
- Improve merchant suggestions beyond simple transaction scanning if repeated-merchant behavior needs ranking or aliases.
- Make "View all" in Recent activity open a full transactions view with filtering by member, category, merchant, date, and amount.
- Add transaction category management so categories are not hardcoded in the Add Activity modal.
- Add account creation/editing for the Accounts plus button.
- Make account counts, linked institution counts, and "Synced 4 min ago" real data instead of hardcoded text.
- Add real net-worth range filtering for `1M`, `3M`, `6M`, `1Y`, and `ALL`.
- Replace hardcoded "Combined household · 11 accounts" with a computed account count.
- Make monthly budget status labels real, including over-budget and warning states.
- Make cashflow health status real instead of hardcoded `healthy`.
- Replace hardcoded cashflow starting balance with database-backed checking/cash balance logic.
- Add budget editing from the "Adjust budget" action and spending category rows.
- Add goal creation/editing for the Goals plus button.
- Add upcoming bill creation/editing and bill paid/snooze behavior.
- Make the bills card's "Next 14 days" window date-driven instead of static fixture labels.
- Add investment holding refresh/edit behavior and real daily portfolio delta calculations.
- Add debt creation/editing and payoff projection details.
- Implement kids allowance history.
- Implement "Pay weekly allowance" so it writes jar balances and creates auditable allowance activity.
- Add smarter chore suggestions later, using kid ages and household context.
- Store household member birthdays/DOBs and derive displayed ages from DOB versus the current date.
- Add chore creation/editing and age-aware chore templates for Kristen, Jason, Lauren, and Ian.
- Decide how adult/older-teen household members should appear in kids allowance views as Kristen gets adult workflows.
- Add a dashboard state indicator when the app is using fixture fallback instead of database data.

## Engineering

- Add browser-level UI tests for the transaction modal and autocomplete when a browser test harness is introduced.
- Decide how the local API server should be managed during development so the Vite app does not depend on manual startup.
- Add a combined local dev command that starts both Vite and the API server.
- Replace source-level UI tests with DOM/browser tests for modal behavior once the browser harness exists.
- Add API route tests for not-found transaction/chore IDs and malformed JSON request bodies.
- Add database migrations instead of schema-only `create table if not exists` scripts before the schema grows further.
- Add database-level constraints for known member slugs, transaction categories, and positive stored bill/debt amounts where appropriate.
- Add a test database strategy so mutation tests do not run against the shared development database.
- Add observability for API errors so UI failures can be diagnosed without checking browser console only.
