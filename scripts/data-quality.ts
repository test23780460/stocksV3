import { demoAssets } from "../src/data/fixtures";
import { logJson } from "./shared";

const events = demoAssets.flatMap((asset) => {
  const issues: Array<Record<string, unknown>> = [];
  if (asset.price <= 0) issues.push({ symbol: asset.symbol, severity: "critical", label: "Suspicious", detail: "Non-positive price" });
  if (asset.volume < 0) issues.push({ symbol: asset.symbol, severity: "critical", label: "Suspicious", detail: "Negative volume" });
  if (asset.bars.length < 252) issues.push({ symbol: asset.symbol, severity: "warning", label: "Incomplete", detail: "Less than one market year of bars" });
  if (asset.type === "index" && asset.volume === 0) issues.push({ symbol: asset.symbol, severity: "info", label: "Normal", detail: "Index volume unavailable" });
  return issues;
});

logJson("data_quality_completed", {
  assetsChecked: demoAssets.length,
  eventsRecorded: events.length,
  labels: [...new Set(events.map((event) => event.label))],
  note: "Extreme moves should be investigated, not automatically overwritten."
});

