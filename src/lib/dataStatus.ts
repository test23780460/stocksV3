import type { DataStatus, MarketMeta } from "../types";

export const statusSeverity = (status: DataStatus) => {
  if (status === "Live" || status === "Real-time IEX" || status === "Provider-supplied" || status === "Near real-time") return "positive";
  if (status === "Delayed" || status === "Cached" || status === "Market closed" || status === "Demo" || status === "Intraday snapshot" || status === "End-of-day") return "warning";
  return "negative";
};

export const explainStatus = (meta: MarketMeta) => {
  if (meta.dataStatus === "Demo") return "Fixed fixture data for local testing. It is not live market data.";
  if (meta.dataStatus === "Real-time IEX") return "Updated by the local collector using Alpaca IEX data. This is not full consolidated U.S. market data.";
  if (meta.dataStatus === "Provider-supplied" || meta.dataStatus === "Near real-time") return "Updated by the local collector from the named provider/feed.";
  if (meta.dataStatus === "End-of-day") return "End-of-day value from the collector database.";
  if (meta.dataStatus === "Delayed") return `Provider reports a delay of about ${meta.delayMinutes ?? "unknown"} minutes.`;
  if (meta.dataStatus === "Cached") return "Showing the newest stored information because a fresh provider response is unavailable.";
  if (meta.dataStatus === "Stale") return meta.staleReason || "The latest stored data is older than expected.";
  if (meta.dataStatus === "Unavailable") return "The collector has not stored a usable value for this field yet.";
  if (meta.dataStatus === "Provider error") return "The provider request failed and the error was logged without credentials.";
  if (meta.dataStatus === "Rate limited") return "The provider limit was reached. The backend will slow down before retrying.";
  return "Provider and ingestion timestamps are shown for auditability.";
};
