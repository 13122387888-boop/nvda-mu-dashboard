import { z } from "zod";

export const stockBarSchema = z
  .object({
    timestamp: z.string(),
    open: z.unknown(),
    high: z.unknown(),
    low: z.unknown(),
    close: z.unknown(),
    volume: z.unknown().optional().nullable(),
  })
  .passthrough();

export const stockResponseSchema = z.array(z.unknown());

export const optionContractSchema = z
  .object({
    symbol: z.string(),
    contract_id: z.string().optional().nullable(),
    contractID: z.string().optional().nullable(),
    date: z.string(),
    expiration: z.string(),
    strike: z.unknown(),
    type: z.string(),
    bid: z.unknown().optional().nullable(),
    ask: z.unknown().optional().nullable(),
    last: z.unknown().optional().nullable(),
    volume: z.unknown().optional().nullable(),
    open_interest: z.unknown().optional().nullable(),
    implied_volatility: z.unknown().optional().nullable(),
    delta: z.unknown().optional().nullable(),
    gamma: z.unknown().optional().nullable(),
    theta: z.unknown().optional().nullable(),
    vega: z.unknown().optional().nullable(),
    greeks: z
      .object({
        implied_volatility: z.unknown().optional().nullable(),
        delta: z.unknown().optional().nullable(),
        gamma: z.unknown().optional().nullable(),
        theta: z.unknown().optional().nullable(),
        vega: z.unknown().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .passthrough();

export const warningSchema = z.object({ warning: z.string() }).passthrough();
export const dateListSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.array(z.string())),
]);

export const optionExpirationListSchema = z.object({
  call: z.array(z.string()).optional(),
  put: z.array(z.string()).optional(),
});
