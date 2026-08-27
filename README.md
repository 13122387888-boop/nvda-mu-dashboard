# US Equity EOD Research Dashboard

A product-validation dashboard for a configuration-driven US equity watchlist. The initial pool covers **NVDA, MU, SNDK, MSFT, and TSLA**. It stores end-of-day stock and option-chain data in Supabase PostgreSQL, calculates a deliberately small set of objective indicators, and serves the same dashboard payload to the Next.js web UI and versioned read-only APIs.

This is research software, not a real-time feed or investment-advice product.

## Architecture

```text
OnclickMedia → Provider adapter → Supabase PostgreSQL → Indicators
                                                       ↓
                               Next.js UI ← Dashboard service → /api/v1
                                                       ↑
                                              Vercel Cron (weekdays)
```

- Next.js 16 App Router, TypeScript, Tailwind CSS
- Prisma ORM 7 with the PostgreSQL driver adapter
- Supabase Transaction Pooler at runtime; Session Pooler/direct URL for migrations
- Lightweight Charts for price and moving-average history
- Vitest for indicator and provider-adapter tests

## OnclickMedia integration

The adapter uses the current official public endpoints documented at [OnclickMedia API Documentation](https://www.onclickmedia.com/Documentation):

- Adjusted daily OHLCV: `GET https://api.onclickmedia.com/stock-data/v2/adj/`
  - Parameters: `ticker`, `from`, `to`, `extended=false`, `bar_size=1d`, `data=ohlcv`, `output=json`, optional `apikey`.
- Stock availability: `GET https://api.onclickmedia.com/stock-data/v2/list/`
  - Parameters: `ticker`, `list=date`.
- Option availability: `GET https://api.onclickmedia.com/options/`
  - Parameters: `ticker`, `list=date`.
- Latest accessible EOD chain: `GET https://api.onclickmedia.com/options/`
  - Parameters: `ticker`, `date`, `data=options_all`, `output=json-v1`, optional `apikey`.

The provider is called only through `MarketDataProvider`. The adapter converts `call`/`put` to `CALL`/`PUT`, validates every number and market date, keeps nullable quote/Greek fields, stores the provider `contract_id`, and normalizes percentage-form IV (for example `45`) to decimal IV (`0.45`). Current API responses already use decimal IV in the nested `greeks` object.

The public/free API needs no key. Its documented option-chain response is limited to the 16 closest-to-the-money strikes per expiration and shorter history; a level-2 key is needed for the full database. Any coverage warning is recorded on the sync run. The app never substitutes another provider. OnclickMedia v2 daily bars are interval-end stamped at midnight on the following calendar date; the adapter maps that label back to the US market trade date and tests this behavior.

## 1. Create a Supabase project

1. Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Open **Connect → ORMs → Prisma**.
3. Copy the Transaction Pooler URL for `DATABASE_URL`. Keep `pgbouncer=true` if Supabase includes it.
4. Copy the Session Pooler or direct connection URL for `DIRECT_URL`. Prisma migrations use this URL through `prisma.config.ts`.
5. Replace only the local placeholders in `.env.local`; never commit the password or URLs.

Example shape only:

```env
DATABASE_URL=postgresql://USER:PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://USER:PASSWORD@SESSION_OR_DIRECT_HOST:5432/postgres
ONCLICKMEDIA_API_KEY=
CRON_SECRET=replace-with-a-long-random-value
ENABLE_DEBUG_PAGE=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 2. Local initialization

macOS/Linux:

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate -- --name init
npm run sync:bootstrap
npm run dev
```

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:generate
npm run db:migrate -- --name init
npm run sync:bootstrap
npm run dev
```

The committed initial migration creates `stock_daily`, `option_eod`, `stock_metrics`, and `sync_run`. Bootstrap attempts roughly 450 calendar days so the adjusted stock dataset can supply at least about 260 market sessions; provider range limits are handled in chunks. It imports only the latest accessible EOD option chain.

## 3. Daily synchronization

```bash
npm run sync:data
```

Both commands are idempotent. They use unique keys, bulk conflict-safe inserts, and recent-bar upserts; isolate failures by symbol; preserve successful symbols when another fails; and write a `SUCCESS`, `PARTIAL`, or `FAILED` `sync_run`. Logs never print connection URLs or API keys. Run `npm run audit:data` to verify yearly coverage and latest stock, option, and metric dates.

Vercel Cron calls `GET /api/cron/sync` at `23:30 UTC` on weekdays. It requires:

```http
Authorization: Bearer <CRON_SECRET>
```

Cron runs incremental sync only. Bootstrap remains a one-time manual operation.

## 4. APIs and pages

- `/` — configurable stock scanner with filters and attention-first sorting
- `/stocks/<SYMBOL>` — EOD dashboard for each configured symbol
- `/api/v1/stocks` — tracked-stock summaries
- `/api/v1/stocks/<SYMBOL>/dashboard` — reusable dashboard payload
- `/api/health` — database connectivity and latest sync time
- `/debug` — diagnostics only when `ENABLE_DEBUG_PAGE=true`

Symbols outside `src/lib/stocks.ts` return 404. The public APIs do not expose raw full chains, provider proxying, database queries, CSV, or bulk exports.

## 5. Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests cover MA20/50/200, Wilder RSI14, RV20, insufficient history, expected move and pricing fallback, put/call OI, max pain, option walls, ATM IV, empty/missing contracts, field/date/side/IV mapping, null handling, and invalid-number filtering.

## 6. Private GitHub repository

Create an empty **private** repository yourself, then run:

```bash
git status
git add .
git commit -m "Initial NVDA and MU dashboard MVP"
git branch -M main
git remote add origin <YOUR_PRIVATE_REPOSITORY_URL>
git push -u origin main
```

No push or public repository is created automatically. If a remote already exists, inspect it with `git remote -v` instead of replacing it.

## 7. Vercel deployment

1. Import the private GitHub repository into Vercel.
2. Add `DATABASE_URL`, `DIRECT_URL`, `ONCLICKMEDIA_API_KEY` (optional), `CRON_SECRET`, `ENABLE_DEBUG_PAGE=false`, and `NEXT_PUBLIC_SITE_URL`.
3. From a trusted local/CI environment with `DIRECT_URL`, apply the committed schema:

   ```bash
   npm run db:deploy
   ```

4. Deploy the Next.js project. Build does not call Supabase or OnclickMedia.
5. Before launch, run `npm run sync:bootstrap` once against the production Supabase project.
6. Verify `/api/health`, at least two configured stock pages, and one authorized Cron call.

Vercel's default domain is sufficient. A custom domain is optional later. The deployed app depends only on Vercel, Supabase, and OnclickMedia, so the local computer can be off.

## Troubleshooting

- **Supabase connection fails:** confirm `DATABASE_URL` is the Transaction Pooler URL, URL-encode special password characters, allow IPv4-compatible pooling, and check the project is awake.
- **Prisma migration fails:** confirm `DIRECT_URL` uses the Session Pooler/direct host rather than Transaction Pooler, then run `npm run db:deploy` for production migrations.
- **OnclickMedia returns no stock data:** check `stock-data/v2/list/?ticker=...&list=date`; adjusted v2 availability can lag the unadjusted endpoint.
- **MA200 is empty:** fewer than 200 valid adjusted closes were stored. Re-run bootstrap and inspect `/debug` locally.
- **Option chain lacks Greeks:** those nullable fields remain `NULL`; contracts are not discarded.
- **Cron returns 401:** Vercel's Authorization bearer value does not match `CRON_SECRET`.
- **Page shows an old date:** EOD providers can lag on weekends, holidays, or before publication. The UI displays stock date, option date, and expiration independently.
- **Vercel build fails:** run all four validation commands locally; do not place database calls in module top-level code or build-time generation.

## Disclaimer

EOD data for research and product validation only. Not investment advice. Data source: OnclickMedia.
