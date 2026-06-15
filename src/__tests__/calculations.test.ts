import { describe, expect, it } from "vitest";
import { demoAssets } from "../data/fixtures";
import {
  calculateConfidenceScore,
  calculateMarketMood,
  calculateRelativeVolume,
  calculateRiskScore,
  calculateScenario,
  deriveSignal,
  evaluatePrediction,
  movingAverage
} from "../lib/calculations";

describe("market calculations", () => {
  it("calculates relative volume without dividing by zero", () => {
    expect(calculateRelativeVolume(200, 100)).toBe(2);
    expect(calculateRelativeVolume(200, 0)).toBe(0);
  });

  it("derives safe research labels from confidence and risk", () => {
    expect(deriveSignal(80, 35)).toBe("Watch");
    expect(deriveSignal(30, 80)).toBe("Avoid");
    expect(deriveSignal(60, 55)).toBe("Research further");
    expect(deriveSignal(44, 55)).toBe("Wait");
  });

  it("keeps risk and confidence inside expected score bounds", () => {
    const msft = demoAssets.find((asset) => asset.symbol === "MSFT")!;
    expect(calculateRiskScore(msft)).toBeGreaterThanOrEqual(1);
    expect(calculateRiskScore(msft)).toBeLessThanOrEqual(99);
    expect(calculateConfidenceScore(msft)).toBeGreaterThanOrEqual(1);
    expect(calculateConfidenceScore(msft)).toBeLessThanOrEqual(99);
  });

  it("calculates market mood from fixed demo assets", () => {
    const mood = calculateMarketMood(demoAssets);
    expect(mood.score).toBeGreaterThan(0);
    expect(["Constructive", "Cautious", "Defensive"]).toContain(mood.label);
    expect(mood.breadth).toBeGreaterThan(0);
  });

  it("calculates moving averages only after enough bars exist", () => {
    const bars = demoAssets[0].bars.slice(0, 25);
    const ma = movingAverage(bars, 20);
    expect(ma[0].value).toBeNull();
    expect(ma[19].value).toBeTypeOf("number");
  });

  it("calculates possible scenario gain and loss amounts", () => {
    expect(calculateScenario({ amount: 1000, possibleGainPercent: 5, possibleLossPercent: -3 })).toEqual({
      possibleGain: 50,
      possibleLoss: 30
    });
  });

  it("evaluates immutable prediction outcomes without hiding misses", () => {
    const prediction = demoAssets[0].prediction;
    expect(evaluatePrediction(prediction, 100, 110)).toBe("Met thesis");
    expect(evaluatePrediction(prediction, 100, 90)).toBe("Missed thesis");
  });
});

