import { demoAssets } from "../src/data/fixtures";
import { evaluatePrediction } from "../src/lib/calculations";
import { hasSupabaseWriteConfig, logJson } from "./shared";

const evaluations = demoAssets.map((asset) => ({
  symbol: asset.symbol,
  predictionId: asset.prediction.id,
  label: asset.prediction.label,
  outcome: evaluatePrediction(asset.prediction, asset.previousClose, asset.price),
  confidence: asset.prediction.confidence,
  risk: asset.prediction.risk,
  modelVersion: "ruleset-demo-v1"
}));

logJson("prediction_jobs_completed", {
  predictionsGenerated: demoAssets.length,
  evaluationsCompleted: evaluations.length,
  modelVersion: "ruleset-demo-v1",
  supabaseWriteConfigured: hasSupabaseWriteConfig(),
  note: "Predictions are deterministic research estimates and are not guarantees."
});

