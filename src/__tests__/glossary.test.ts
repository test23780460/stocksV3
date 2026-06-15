import { describe, expect, it } from "vitest";
import { glossaryTerms, searchGlossary } from "../data/glossary";

describe("glossary search", () => {
  it("contains required education terms", () => {
    const names = glossaryTerms.map((item) => item.term);
    expect(names).toContain("Volatility");
    expect(names).toContain("Relative volume");
    expect(names).toContain("Implied volatility");
    expect(names).toContain("Drawdown");
  });

  it("searches by term and category", () => {
    expect(searchGlossary("option").length).toBeGreaterThan(4);
    expect(searchGlossary("risk").some((item) => item.term === "Risk score")).toBe(true);
  });
});

