import { z } from "zod";

export const requiredBackendEnv = z.object({
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  MARKET_DATA_PROVIDER: z.string().default("demo"),
  NEWS_DATA_PROVIDER: z.string().default("demo")
});

export const redact = (value: string) =>
  value
    .replace(/("(?:SUPABASE_SERVICE_ROLE_KEY|ALPHA_VANTAGE_API_KEY|POLYGON_API_KEY|FINNHUB_API_KEY|TWELVE_DATA_API_KEY|COINGECKO_API_KEY|NEWS_API_KEY|DISCORD_WEBHOOK_URL|CRON_SECRET)"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2")
    .replace(/((?:SUPABASE_SERVICE_ROLE_KEY|ALPHA_VANTAGE_API_KEY|POLYGON_API_KEY|FINNHUB_API_KEY|TWELVE_DATA_API_KEY|COINGECKO_API_KEY|NEWS_API_KEY|DISCORD_WEBHOOK_URL|CRON_SECRET)=)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/https:\/\/discord\.com\/api\/webhooks\/[^\s]+/g, "[REDACTED_WEBHOOK]");

export const getEnv = () => requiredBackendEnv.parse(process.env);

export const hasSupabaseWriteConfig = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const logJson = (event: string, payload: Record<string, unknown>) => {
  console.log(redact(JSON.stringify({ event, at: new Date().toISOString(), ...payload }, null, 2)));
};

export const parseSymbolInput = (input?: string) =>
  (input || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
