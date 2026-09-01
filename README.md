# 收盘雷达 / EOD Radar

An invitation-beta dashboard for a configuration-driven US equity and exchange-traded-product watchlist. The current 41-symbol pool covers **NVDA, MU, SNDK, MSFT, TSLA, DRAM, SKHY, TSM, AAPL, AVGO, ORCL, SOXX, QQQ, IBIT, GLD, XLF, XLE, XLU, XLV, MVRL, SPCX, CRCL, INTC, GOOG, AMD, IGV, UVIX, META, AMZN, ASML, WDC, STX, PLTR, XBI, BRK.B, LLY, GLW, COHR, AAOI, LITE, and BE**. It stores end-of-day stock and option-chain data in Supabase PostgreSQL, calculates a deliberately small set of objective indicators, and serves the same dashboard payload to the Next.js web UI and versioned read-only APIs.

This is research software, not a real-time feed or investment-advice product.

## Architecture

```text
OnclickMedia option sync ───────────────→ Supabase PostgreSQL → Indicators
Longbridge morning stock-close sync ───→                     ↓
                                                       ↓
                               Next.js UI ← Dashboard service → /api/v1
                                      ↑                         ↑
                           GitHub Actions                 Vercel Cron
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

The public/free API needs no key. Its documented option-chain response is limited to the closest-to-the-money strikes per expiration and shorter history; a level-2 key is needed for the full database. Any coverage warning is recorded on the sync run. OnclickMedia remains the automated daily options source. Longbridge supplies the faster stock-close path: `npm run backfill:longbridge` adds missing daily bars, refreshes the most recent eight sessions, recalculates stock metrics, and rejects a run unless every selected symbol shares one latest date with aligned stored metrics. Stored rows retain their source label. OnclickMedia v2 daily bars are interval-end stamped at midnight on the following calendar date; the adapter maps that label back to the US market trade date and tests this behavior.

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

For a verified one-off current-year history repair on a trusted machine with the Longbridge CLI configured:

```bash
npm run backfill:longbridge -- all 2026-01-01 2026-12-31
npm run sync:data
```

The backfill inserts missing dates, refreshes the most recent eight sessions, recalculates the latest metrics, retries transient CLI failures, and verifies that all selected symbols and metrics share one latest trade date. `SKHY` began US trading in July 2026, so its long-term averages and trend score remain unavailable until enough genuine sessions accumulate.

GitHub Actions runs `.github/workflows/morning-stock-sync.yml` at **07:30 and 08:30 Asia/Shanghai, Tuesday through Saturday**. The second idempotent attempt protects the 09:00 freshness target from a delayed first publication or runner start. Configure these repository secrets:

- `DATABASE_URL` — the Supabase Transaction Pooler URL.
- `LONGBRIDGE_APP_KEY`, `LONGBRIDGE_APP_SECRET`, `LONGBRIDGE_ACCESS_TOKEN` — a quote-only Longbridge OpenAPI application.

The workflow pins and checksum-verifies the official Longbridge CLI binary, refreshes recent stock bars, recalculates stock-only indicators, and validates the uncached production health endpoint. Options are intentionally not required for the morning stock-close check because their free EOD archive can publish later.

Vercel Cron separately calls `GET /api/cron/sync` at `05:30 UTC` from Tuesday through Saturday to fill the OnclickMedia option snapshot when it becomes available. It requires:

```http
Authorization: Bearer <CRON_SECRET>
```

Cron runs incremental sync only. Bootstrap remains a one-time manual operation. Stock and option dates are kept independent; a newer stock close never borrows an older option chain for wall, OI, Gamma, IV, or expected-range conclusions.

## 4. APIs and pages

- `/` — configurable stock scanner with filters, trend sorting, and a trend/IV/Gamma structure map
- `/stocks/<SYMBOL>` — EOD dashboard for each configured symbol
- `/api/v1/stocks` — tracked-stock summaries
- `/api/v1/stocks/<SYMBOL>/dashboard` — reusable dashboard payload
- `/api/health` — database connectivity and latest sync time
- `/debug` — diagnostics only when `ENABLE_DEBUG_PAGE=true`
- `/methodology` — data sources, indicator scope, freshness, and known limitations
- `/privacy` and `/terms` — invitation-beta privacy and usage notices

Symbols outside `src/lib/stocks.ts` return 404. The public APIs do not expose raw full chains, provider proxying, database queries, CSV, or bulk exports.

The dashboard also derives MA50/100/200 trend structure, Wilder RSI14, BOLL(20,2) price position and bandwidth state, 20-day relative volume, evidence-state summaries, 10-snapshot wall migration, expected-range and wall-continuation review, IV percentile/term structure, and 25-delta IV skew. BOLL uses adjusted closes and population standard deviation; its bandwidth state is ranked against up to 252 valid observations. IV skew filters zero/extreme IV, requires open interest, uses the liquid expiration closest to 30 days (preferably at least 7 days), and reports `25Δ Put IV − 25Δ Call IV`; these are context measures rather than directional forecasts.

Stock detail pages use one beginner-readable layer: plain-language metric explanations, a three-step “what to read now” path, and evidence wording that avoids implying buy/sell support. Stock and option source dates remain visible as neutral scope tags; different snapshot dates are not promoted as a warning.

## 5. Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests cover MA50/100/200 (while retaining the legacy MA20 sync field), the 0–100 trend score, Wilder RSI14, BOLL(20,2), RVOL20, RV20, insufficient history, expected move and pricing fallback, put/call OI, max pain, option walls, ATM IV, 25-delta IV skew, empty/missing contracts, field/date/side/IV mapping, null handling, and invalid-number filtering.

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
2. Add `DATABASE_URL`, `DIRECT_URL`, `ONCLICKMEDIA_API_KEY` (optional), `CRON_SECRET`, `ENABLE_DEBUG_PAGE=false`, and `NEXT_PUBLIC_SITE_URL`. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin used in links and metadata; changing the custom domain later should only require updating this value and redeploying.
3. From a trusted local/CI environment with `DIRECT_URL`, apply the committed schema:

   ```bash
   npm run db:deploy
   ```

4. Deploy the Next.js project. Build does not call Supabase or either market-data source.
5. Before launch, run `npm run sync:bootstrap` once against the production Supabase project.
6. Verify `/api/health`, at least two configured stock pages, and one authorized Cron call.

Vercel's default domain can be used during invitation testing. Before a wider release, bind a neutral custom domain, update `NEXT_PUBLIC_SITE_URL`, redeploy, and verify the site without a proxy on the target networks. Runtime updates use Vercel, GitHub Actions, Supabase, OnclickMedia, and the quote-only Longbridge OpenAPI application; the local computer can be off.

## Troubleshooting

- **Supabase connection fails:** confirm `DATABASE_URL` is the Transaction Pooler URL, URL-encode special password characters, allow IPv4-compatible pooling, and check the project is awake.
- **Prisma migration fails:** confirm `DIRECT_URL` uses the Session Pooler/direct host rather than Transaction Pooler, then run `npm run db:deploy` for production migrations.
- **OnclickMedia returns no stock data:** check `stock-data/v2/list/?ticker=...&list=date`; adjusted v2 availability can lag the unadjusted endpoint.
- **MA200 is empty:** fewer than 200 valid adjusted closes were stored. Re-run bootstrap and inspect `/debug` locally.
- **Option chain lacks Greeks:** those nullable fields remain `NULL`; contracts are not discarded.
- **Cron returns 401:** Vercel's Authorization bearer value does not match `CRON_SECRET`.
- **Morning stock workflow fails before sync:** confirm all four GitHub repository secrets exist and the Longbridge OpenAPI credentials are quote-only and active.
- **Page shows an old date:** EOD providers can lag on weekends, holidays, or before publication. The UI displays stock date, option date, and expiration independently.
- **Vercel build fails:** run all four validation commands locally; do not place database calls in module top-level code or build-time generation.

## Disclaimer

EOD data for research and product validation only. Not investment advice. Data sources: OnclickMedia and Longbridge.
