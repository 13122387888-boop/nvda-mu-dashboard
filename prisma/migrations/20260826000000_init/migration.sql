CREATE TYPE "OptionType" AS ENUM ('CALL', 'PUT');
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'CRON');
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
CREATE TYPE "MarketStatus" AS ENUM ('STRONG_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'INSUFFICIENT_DATA');

CREATE TABLE "stock_daily" (
  "id" BIGSERIAL PRIMARY KEY,
  "symbol" VARCHAR(10) NOT NULL,
  "trade_date" DATE NOT NULL,
  "open" DECIMAL(18,6) NOT NULL,
  "high" DECIMAL(18,6) NOT NULL,
  "low" DECIMAL(18,6) NOT NULL,
  "close" DECIMAL(18,6) NOT NULL,
  "adjusted_close" DECIMAL(18,6),
  "volume" BIGINT,
  "provider" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "option_eod" (
  "id" BIGSERIAL PRIMARY KEY,
  "symbol" VARCHAR(10) NOT NULL,
  "trade_date" DATE NOT NULL,
  "expiration" DATE NOT NULL,
  "option_type" "OptionType" NOT NULL,
  "strike" DECIMAL(18,6) NOT NULL,
  "contract_symbol" VARCHAR(64),
  "contract_multiplier" INTEGER NOT NULL DEFAULT 100,
  "bid" DECIMAL(18,6),
  "ask" DECIMAL(18,6),
  "last" DECIMAL(18,6),
  "volume" BIGINT,
  "open_interest" BIGINT,
  "implied_volatility" DECIMAL(18,8),
  "delta" DECIMAL(18,8),
  "gamma" DECIMAL(18,8),
  "theta" DECIMAL(18,8),
  "vega" DECIMAL(18,8),
  "provider" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "stock_metrics" (
  "id" BIGSERIAL PRIMARY KEY,
  "symbol" VARCHAR(10) NOT NULL,
  "trade_date" DATE NOT NULL,
  "options_trade_date" DATE,
  "options_expiration" DATE,
  "close" DECIMAL(18,6) NOT NULL,
  "daily_change" DECIMAL(18,6),
  "daily_change_pct" DECIMAL(18,6),
  "ma20" DECIMAL(18,6),
  "ma50" DECIMAL(18,6),
  "ma200" DECIMAL(18,6),
  "rsi14" DECIMAL(18,6),
  "rv20" DECIMAL(18,8),
  "expected_move" DECIMAL(18,6),
  "expected_move_pct" DECIMAL(18,8),
  "expected_upper" DECIMAL(18,6),
  "expected_lower" DECIMAL(18,6),
  "put_call_oi" DECIMAL(18,8),
  "max_pain" DECIMAL(18,6),
  "call_wall" DECIMAL(18,6),
  "put_wall" DECIMAL(18,6),
  "atm_iv" DECIMAL(18,8),
  "market_status" "MarketStatus" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "sync_run" (
  "id" BIGSERIAL PRIMARY KEY,
  "trigger_type" "TriggerType" NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "status" "SyncStatus" NOT NULL,
  "symbols" TEXT[],
  "stock_rows" INTEGER NOT NULL DEFAULT 0,
  "option_rows" INTEGER NOT NULL DEFAULT 0,
  "metrics_rows" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "stock_daily_symbol_trade_date_key" ON "stock_daily"("symbol", "trade_date");
CREATE INDEX "stock_daily_symbol_trade_date_idx" ON "stock_daily"("symbol", "trade_date");
CREATE UNIQUE INDEX "option_eod_symbol_trade_date_expiration_option_type_strike_key" ON "option_eod"("symbol", "trade_date", "expiration", "option_type", "strike");
CREATE INDEX "option_eod_symbol_trade_date_expiration_idx" ON "option_eod"("symbol", "trade_date", "expiration");
CREATE UNIQUE INDEX "stock_metrics_symbol_trade_date_key" ON "stock_metrics"("symbol", "trade_date");
CREATE INDEX "sync_run_started_at_idx" ON "sync_run"("started_at");
