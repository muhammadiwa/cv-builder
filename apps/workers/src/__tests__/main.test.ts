import { describe, expect, it, vi } from "vitest";
import { bootstrap } from "../main";

describe("@lolos/workers", () => {
  it("exports a bootstrap function (smoke)", () => {
    expect(typeof bootstrap).toBe("function");
  });

  it("logs the ready banner when bootstrap runs", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    bootstrap();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Lolos workers"),
    );
    spy.mockRestore();
  });
});
