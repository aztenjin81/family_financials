# Plaid Guardrails

Use these rules before adding or changing any Plaid integration work in this repo.

## Account security and access management

- Use strong, unique passwords for all Plaid, GitHub, cloud, and database accounts.
- Store credentials in environment variables or a secrets manager only.
- Enable MFA on all key developer and admin accounts.
- Treat any exposed key, token, or secret as compromised and rotate it immediately.
- Do not commit API keys, secrets, access tokens, or webhook secrets to the repository.

## Data protection and software security

- Use HTTPS for all public-facing Plaid traffic.
- Keep Plaid access tokens server-side only.
- Encrypt sensitive data at rest, including backups and logs.
- Remove sensitive data when it is no longer needed.
- Keep dependencies and security updates current.

## Plaid-specific integration rules

- Create Link tokens with the smallest product set that meets the current use case.
- Add a short pre-Link explanation before opening Plaid Link.
- Verify Plaid webhooks on the server before trusting them.
- Put webhook handling on a dedicated endpoint.
- Add rate limiting or similar abuse controls around public sync or token-exchange routes.
- Keep the app provider-agnostic at the data model boundary so Plaid is one adapter, not the only one.

## Repo workflow rules

- Add tests for every behavior change.
- Keep the pre-commit Gitleaks scan enabled.
- Do not merge integration code that bypasses the existing database connection rewriting rules.
