# Security Policy

## Supported version

Security updates are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Report it
privately to the repository owner with:

- the affected route or feature;
- clear reproduction steps;
- the expected and observed behavior; and
- the potential impact.

Do not include real household data, Telegram tokens, access codes, or other
credentials in a report.

## Security model

- Cloudflare Access authenticates approved users before protected use.
- Server routes verify active household membership and household ownership.
- Data queries are household-scoped and use parameterized Drizzle queries.
- Telegram webhooks require Telegram's secret-token header.
- Telegram account links are one-time codes with a 24-hour lifetime.
- Write endpoints enforce same-origin requests, validation, and rate limits.
- Important changes are recorded in an append-only household audit trail.
- Production credentials are stored as Worker secrets, never in source.

## Deployment checklist

- Keep the repository's secret scanning and dependency alerts enabled.
- Require pull-request review and passing CI on the default branch.
- Protect the Worker with Cloudflare Access before storing real data.
- Use a long random `TELEGRAM_WEBHOOK_SECRET`.
- Rotate the Telegram token immediately if it is ever exposed.
- Review audit activity and export a backup regularly.
