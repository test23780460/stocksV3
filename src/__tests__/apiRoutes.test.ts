import { describe, expect, it } from "vitest";
import { GET as quoteGet } from "../app/api/quote/route";
import { GET as historyGet } from "../app/api/history/route";

describe("API input validation", () => {
  it("returns 400 for malformed quote symbols before provider calls", async () => {
    const response = await quoteGet(new Request("http://localhost/api/quote?symbol=@@@"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("bad_request");
  });

  it("returns 400 for unsupported history ranges", async () => {
    const response = await historyGet(new Request("http://localhost/api/history?symbol=AAPL&range=2Y"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("bad_request");
  });
});
