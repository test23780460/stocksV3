import { describe, expect, it } from "vitest";
import { demoAssets } from "../data/fixtures";
import { explainStatus, statusSeverity } from "../lib/dataStatus";

describe("data status messaging", () => {
  it("marks demo data with warning severity", () => {
    expect(statusSeverity("Demo")).toBe("warning");
    expect(explainStatus(demoAssets[0].meta)).toContain("fixture");
  });

  it("keeps provider errors distinct from stale data", () => {
    expect(statusSeverity("Provider error")).toBe("negative");
    expect(statusSeverity("Stale")).toBe("negative");
  });
});

