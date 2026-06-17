import { afterEach, describe, expect, it, vi } from "vitest";
import { getCryptoHistory, marketStatusNow, normalizeHistoryRequest } from "../services/marketData";

describe("history range mapping", () => {
  it("maps short and long ranges to distinct backend intervals", () => {
    expect(normalizeHistoryRequest("1D").interval).toBe("5m");
    expect(normalizeHistoryRequest("5D").interval).toBe("30m");
    expect(normalizeHistoryRequest("5Y").interval).toBe("1W");
    expect(normalizeHistoryRequest("MAX").interval).toBe("1M");
  });
});

describe("market status", () => {
  it("handles regular, pre-market, after-hours, weekends, and holidays", () => {
    expect(marketStatusNow(new Date("2026-06-17T14:00:00Z"))).toBe("Open");
    expect(marketStatusNow(new Date("2026-06-17T12:00:00Z"))).toBe("Pre-market");
    expect(marketStatusNow(new Date("2026-06-17T21:00:00Z"))).toBe("After-hours");
    expect(marketStatusNow(new Date("2026-06-20T14:00:00Z"))).toBe("Closed");
    expect(marketStatusNow(new Date("2026-06-19T14:00:00Z"))).toBe("Closed");
  });
});

describe("crypto history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks CoinGecko market_chart data as a price series instead of OHLC candles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            prices: [
              [Date.UTC(2026, 0, 1), 100],
              [Date.UTC(2026, 0, 2), 105]
            ],
            total_volumes: [
              [Date.UTC(2026, 0, 1), 1000],
              [Date.UTC(2026, 0, 2), 1200]
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const history = await getCryptoHistory("bitcoin", "1Y", { refresh: true });
    expect(history.provider).toBe("CoinGecko");
    expect(history.dataShape).toBe("price-series");
    expect(history.note).toContain("not true OHLC");
    expect(history.candles[0].open).toBe(history.candles[0].close);
    expect(history.candles[0].high).toBe(history.candles[0].close);
    expect(history.candles[0].low).toBe(history.candles[0].close);
  });
});
