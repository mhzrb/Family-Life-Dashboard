# Family Life Dashboard

A calm, privacy-minded household expense dashboard built for families who want
one shared financial picture without losing individual accountability.

Family members have separate accounts and personal spending views, while the
combined dashboard shows household totals, category breakdowns, recent
activity, live currency rates, and local weather. Expenses can be added from
the website or through a button-driven Telegram bot.

## Highlights

- Separate member accounts and combined household analytics
- Approval-based member invitations and removals
- Expense entry in EUR, USD, CAD, and GBP
- Live exchange rates and weather data from free public APIs
- Permanent Telegram webhook with button-driven expense entry
- Combined €20 daily household budget with daily and monthly status
- Immediate green/red budget feedback on the website and in Telegram
- One-time Telegram linking codes that expire after 24 hours
- Custom categories shared between the dashboard and Telegram
- Edit and soft-delete support for each member's own expenses
- CSV and JSON exports for portable backups
- Household audit trail for important security and data changes
- Rate limiting, same-origin checks, validated inputs, and secret isolation
- Installable responsive PWA with English and Dutch interfaces
- Demo mode with temporary sample data

## Technology

- TypeScript and React
- Next.js-compatible Vinext runtime
- Cloudflare Workers
- Cloudflare D1 (SQLite-compatible SQL)
- Drizzle ORM and versioned SQL migrations
- Telegram Bot API

## Architecture

```text
Browser / PWA
      |
      v
Cloudflare Worker API  <------ Telegram secure webhook
      |
      +---- D1 SQL database
      |
      +---- Weather and currency APIs
```

Every database query is scoped to a household. Authentication is expected to
be enforced by Cloudflare Access, and authorization is checked again in the
server routes before data is read or changed.

## Run locally

Requirements: Node.js 22+, npm, and a Cloudflare account for D1-backed flows.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Without authentication headers or a configured D1 database, the homepage stays
in safe demo mode.

## Create the database

```bash
npx wrangler d1 create family-life-dashboard
```

Copy the returned database ID into `wrangler.jsonc`, then apply the migrations:

```bash
npm run db:migrate
```

## Configure Telegram

Create a bot with `@BotFather`, then store these values as Worker secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

After deployment, the household owner enables permanent delivery from the
Telegram panel. The bot then receives updates even when the dashboard is
closed.

If the dashboard is protected with Cloudflare Access, create a separate Access
application for the exact `/api/telegram` path with a **Bypass** policy. Keep
every other route behind an **Allow** policy limited to family email addresses.
The webhook itself remains protected by Telegram's secret-token header, and a
request without that header is rejected.

## Deploy

```bash
npm run deploy
```

Cloudflare provides a free `workers.dev` address for testing. For a private
family deployment, protect the Worker with Cloudflare Access and allow only the
family members' email addresses.

## Quality checks

```bash
npm test
```

The CI workflow runs linting and a production build on every pull request and
push to `main`.

## Data and privacy

- Real credentials belong only in Cloudflare secrets.
- `.dev.vars`, `.env*`, private keys, build output, and local Worker state are
  ignored by Git.
- Telegram tokens and linking codes are never included in exports.
- Deleted expenses are retained as soft-deleted records for auditability but
  are excluded from dashboards and exports.
- JSON exports provide portable user-controlled backups; D1 Time Travel adds
  platform-level recovery for recent database changes.

See [SECURITY.md](SECURITY.md) for the security model and reporting process.

## Roadmap

- Configurable category budgets and proactive Telegram alerts
- Weekly and monthly spending insights
- Receipt OCR and voice input
- Shared family calendar and recurring bills
- Automated scheduled encrypted backups
- Multi-family onboarding and household switching

## License

MIT
