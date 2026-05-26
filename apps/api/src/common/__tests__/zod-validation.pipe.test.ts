import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  // ArgumentMetadata is unused by the pipe; we cast `any` only for the test.
  const meta = { type: "body" } as never;

  it("returns the parsed value when input matches the schema", () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: "Alice", age: 30 }, meta);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("throws BadRequestException when the input is invalid", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: "", age: -1 }, meta)).toThrow(
      BadRequestException,
    );
  });

  it("surfaces Zod issues with path + message + code", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: "", age: -1 }, meta);
      throw new Error("expected pipe to throw");
    } catch (err) {
      // Inspect the BadRequestException response shape.
      const response = (err as BadRequestException).getResponse() as {
        statusCode: number;
        error: string;
        issues: Array<{ path: string; message: string; code: string }>;
      };
      expect(response.statusCode).toBe(400);
      expect(response.error).toBe("ValidationError");
      expect(Array.isArray(response.issues)).toBe(true);
      expect(response.issues.length).toBeGreaterThan(0);
      // Each issue exposes the structured fields the frontend relies on.
      for (const issue of response.issues) {
        expect(typeof issue.path).toBe("string");
        expect(typeof issue.message).toBe("string");
        expect(typeof issue.code).toBe("string");
      }
    }
  });
});
