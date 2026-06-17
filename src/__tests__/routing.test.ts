import { describe, expect, it } from "vitest";
import { parseRoutePath, pathForAsset, pathForRoute } from "../lib/routing";

describe("real application routing", () => {
  it("maps major pages to stable Next paths", () => {
    expect(pathForRoute("watchlists")).toBe("/watchlists");
    expect(pathForRoute("backend")).toBe("/admin/jobs");
    expect(parseRoutePath("/markets/stocks")).toEqual({ route: "stocks" });
  });

  it("keeps asset URLs shareable without changing symbols", () => {
    expect(pathForAsset("stock", "AAPL")).toBe("/stocks/AAPL");
    expect(pathForAsset("crypto", "BTC-USD")).toBe("/crypto/BTC-USD");
    expect(parseRoutePath("/stocks/AAPL")).toEqual({ route: "stocks", selectedSymbol: "AAPL" });
    expect(parseRoutePath("/crypto/btc")).toEqual({ route: "crypto", selectedSymbol: "BTC-USD" });
  });

  it("flags malformed paths for a real not-found response", () => {
    expect(parseRoutePath("/admin/nope").invalid).toBe(true);
    expect(parseRoutePath("/stocks/@@@").invalid).toBe(true);
  });
});
