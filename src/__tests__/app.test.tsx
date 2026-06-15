import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Market Signal Deck app", () => {
  it("renders the dashboard and demo disclaimer", () => {
    render(<App />);
    expect(screen.getByText("Market command center")).toBeInTheDocument();
    expect(screen.getAllByText("Demo Mode").length).toBeGreaterThan(0);
    expect(screen.getByText(/Educational market research only/)).toBeInTheDocument();
  });
});
