import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Market Signal Deck app", () => {
  it("renders the dashboard and demo disclaimer", () => {
    render(<App />);
    expect(screen.getByText("Market command center")).toBeInTheDocument();
    expect(screen.getByText(/Demo Mode active/)).toBeInTheDocument();
    expect(screen.getByText(/Educational market research only/)).toBeInTheDocument();
  });
});
