import { describe, expect, it } from "vitest";
import { prisma } from "../index";

describe("@lolos/database", () => {
  it("exports a Prisma client singleton", () => {
    expect(prisma).toBeDefined();
  });

  it("exposes the resume and resumeSection delegates we rely on", () => {
    // We don't connect to the database in unit tests — just assert the API
    // surface so a Prisma upgrade that drops a delegate breaks here loudly.
    expect(typeof prisma.resume.findFirst).toBe("function");
    expect(typeof prisma.resumeSection.findMany).toBe("function");
    expect(typeof prisma.resumeSection.deleteMany).toBe("function");
    expect(typeof prisma.$transaction).toBe("function");
  });
});
