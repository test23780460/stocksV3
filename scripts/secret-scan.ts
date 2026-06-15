import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { logJson } from "./shared";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", "dist", "coverage"]);
const riskyPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY[ \t]*=[ \t]*[^\s\r\n#]+/i,
  /DISCORD_WEBHOOK_URL[ \t]*=[ \t]*https:\/\/discord\.com\/api\/webhooks\//i,
  /(ALPHA_VANTAGE|POLYGON|FINNHUB|TWELVE_DATA|NEWS_API|COINGECKO)_API_KEY[ \t]*=[ \t]*[A-Za-z0-9_-]{12,}/i,
  /ghp_[A-Za-z0-9_]{20,}/
];

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full);
    else if (stats.size < 1_000_000) files.push(full);
  }
};
walk(root);

const findings = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return riskyPatterns.some((pattern) => pattern.test(text)) ? [file.replace(root, "")] : [];
});

logJson("secret_scan_completed", { filesScanned: files.length, findings });
if (findings.length) {
  throw new Error("Potential secret values found. Inspect files before committing.");
}
