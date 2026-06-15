import type { DataStatus, MarketMeta } from "../types";

export const statusSeverity = (status: DataStatus) => {
  if (status === "Live") return "positive";
  if (status === "Delayed" || status === "Cached" || status === "Market closed" || status === "Demo") return "warning";
  return "negative";
};

export const explainStatus = (meta: MarketMeta) => {
  if (meta.dataStatus === "Demo") return "Fixed fixture data for local testing. It is not live market data.";
  if (meta.dataStatus === "Delayed") return `Provider reports a delay of about ${meta.delayMinutes ?? "unknown"} minutes.`;
  if (meta.dataStatus === "Cached") return "Showing the newest stored information because a fresh provider response is unavailable.";
  if (meta.dataStatus === "Stale") return meta.staleReason || "The latest stored data is older than expected.";
  if (meta.dataStatus === "Provider error") return "The provider request failed and the error was logged without credentials.";
  if (meta.dataStatus === "Rate limited") return "The provider limit was reached. The backend will slow down before retrying.";
  return "Provider and ingestion timestamps are shown for auditability.";
};

