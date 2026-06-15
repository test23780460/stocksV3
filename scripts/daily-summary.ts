import { demoAssets, demoNews } from "../src/data/fixtures";
import { calculateMarketMood } from "../src/lib/calculations";
import { hasSupabaseWriteConfig, logJson } from "./shared";

const mood = calculateMarketMood(demoAssets);
const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL);

logJson("daily_summary_completed", {
  mood,
  topSignals: demoAssets.slice(0, 3).map((asset) => `${asset.symbol}:${asset.signal}`),
  headlinesReviewed: demoNews.length,
  discordWebhookConfigured: webhookConfigured,
  supabaseWriteConfigured: hasSupabaseWriteConfig(),
  note: webhookConfigured
    ? "Discord webhook secret is configured; real sender should post only redacted summary payloads."
    : "DISCORD_WEBHOOK_URL missing; no external alert was sent."
});

