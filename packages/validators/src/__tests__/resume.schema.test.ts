import { describe, expect, it } from "vitest";
import { createResumeSchema, sectionInputSchema, updateResumeSchema } from "../resume.schema";

describe("createResumeSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createResumeSchema.safeParse({ title: "My CV" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("id");
    }
  });

  it("rejects an empty title", () => {
    const result = createResumeSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    const result = createResumeSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported language", () => {
    const result = createResumeSchema.safeParse({ title: "ok", language: "fr" });
    expect(result.success).toBe(false);
  });
});

describe("sectionInputSchema", () => {
  const baseValid = {
    sectionType: "summary" as const,
    displayOrder: 0,
    content: { summary: "hello" },
  };

  it("accepts a valid section without an id (new section)", () => {
    const result = sectionInputSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("accepts a valid section with a UUID id (existing section)", () => {
    const result = sectionInputSchema.safeParse({
      ...baseValid,
      id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID id (defends against the legacy 'new-' sentinel)", () => {
    const result = sectionInputSchema.safeParse({
      ...baseValid,
      id: "new-1234567890",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown sectionType", () => {
    const result = sectionInputSchema.safeParse({
      ...baseValid,
      sectionType: "bio",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative displayOrder", () => {
    const result = sectionInputSchema.safeParse({
      ...baseValid,
      displayOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a content payload that serializes over 64 KB", () => {
    const huge = { description: "x".repeat(65 * 1024) };
    const result = sectionInputSchema.safeParse({
      ...baseValid,
      content: huge,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateResumeSchema", () => {
  it("accepts an empty body (PATCH with no fields)", () => {
    const result = updateResumeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts an empty sections array (treat as 'remove all')", () => {
    const result = updateResumeSchema.safeParse({ sections: [] });
    expect(result.success).toBe(true);
  });

  it("rejects a sections array longer than 64 entries (the cap)", () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => ({
      sectionType: "skills" as const,
      displayOrder: i,
      content: {},
    }));
    const result = updateResumeSchema.safeParse({ sections: tooMany });
    expect(result.success).toBe(false);
  });

  it("accepts a fully populated section row including visible flag", () => {
    const result = updateResumeSchema.safeParse({
      title: "Updated Title",
      sections: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          sectionType: "experience",
          displayOrder: 0,
          content: { company: "Acme", role: "Engineer" },
          visible: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
