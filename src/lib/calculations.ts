import type { Asset, Bar, Prediction, ScenarioInput, SignalLabel } from "../types";
import { clamp } from "./format";

export const calculateRelativeVolume = (volume: number, averageVolume: number) =>
  averageVolume <= 0 ? 0 : Number((volume / averageVolume).toFixed(2));

export const calculateRiskScore = (asset: Pick<Asset, "volatility" | "relativeVolume" | "rsi" | "sentiment">) => {
  const volatilityRisk = asset.volatility * 0.38;
  const crowdedRisk = Math.max(0, asset.relativeVolume - 1) * 12;
  const momentumRisk = asset.rsi > 70 || asset.rsi < 30 ? 14 : 4;
  const sentimentRisk = asset.sentiment < 0 ? Math.abs(asset.sentiment) * 12 : 0;
  return Math.round(clamp(volatilityRisk + crowdedRisk + momentumRisk + sentimentRisk, 1, 99));
};

export const calculateConfidenceScore = (
  asset: Pick<Asset, "rsi" | "macd" | "relativeVolume" | "sentiment" | "price" | "sma50">
) => {
  const trend = asset.price >= asset.sma50 ? 22 : 8;
  const rsi = asset.rsi >= 42 && asset.rsi <= 68 ? 22 : 10;
  const macd = asset.macd > 0 ? 18 : 7;
  const participation = clamp(asset.relativeVolume * 12, 4, 18);
  const sentiment = clamp(12 + asset.sentiment * 8, 4, 18);
  return Math.round(clamp(trend + rsi + macd + participation + sentiment, 1, 99));
};

export const deriveSignal = (confidence: number, risk: number): SignalLabel => {
  if (confidence >= 72 && risk <= 50) return "Watch";
  if (risk >= 75 || confidence <= 35) return "Avoid";
  if (confidence >= 55 && risk <= 68) return "Research further";
  return "Wait";
};

export const calculateMarketMood = (assets: Asset[]) => {
  const averageChange = assets.reduce((sum, asset) => sum + asset.changePercent, 0) / assets.length;
  const breadth = assets.filter((asset) => asset.changePercent >= 0).length / assets.length;
  const averageRisk = assets.reduce((sum, asset) => sum + asset.risk, 0) / assets.length;
  const score = Math.round(clamp(45 + averageChange * 5 + breadth * 28 - averageRisk * 0.22));
  const label = score >= 70 ? "Constructive" : score >= 50 ? "Cautious" : "Defensive";
  return { score, label, breadth: Math.round(breadth * 100), averageChange: Number(averageChange.toFixed(2)) };
};

export const movingAverage = (bars: Bar[], period: number) => {
  if (bars.length < period) return [];
  return bars.map((bar, index) => {
    if (index < period - 1) return { time: bar.time, value: null };
    const slice = bars.slice(index - period + 1, index + 1);
    const value = slice.reduce((sum, item) => sum + item.close, 0) / period;
    return { time: bar.time, value: Number(value.toFixed(2)) };
  });
};

export const calculateScenario = ({ amount, possibleGainPercent, possibleLossPercent }: ScenarioInput) => ({
  possibleGain: Number((amount * (possibleGainPercent / 100)).toFixed(2)),
  possibleLoss: Number((amount * Math.abs(possibleLossPercent / 100)).toFixed(2))
});

export const evaluatePrediction = (prediction: Prediction, startPrice: number, endPrice: number) => {
  const changePercent = ((endPrice - startPrice) / startPrice) * 100;
  const metWatchThesis = prediction.label === "Watch" && changePercent >= prediction.possibleGainPercent * 0.5;
  const avoidedWeakness = prediction.label === "Avoid" && changePercent <= 0;
  const heldNeutral = prediction.label === "Wait" && Math.abs(changePercent) < Math.abs(prediction.possibleLossPercent);
  if (metWatchThesis || avoidedWeakness || heldNeutral) return "Met thesis" as const;
  if (Math.abs(changePercent) < 1.2) return "Mixed" as const;
  return "Missed thesis" as const;
};

