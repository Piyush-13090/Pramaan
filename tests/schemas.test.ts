import { describe, expect, it } from "vitest";
import { ClaimSchema } from "../src/core";

describe("ClaimSchema", () => {
  it("fills defaults for fields small models often omit", () => {
    const claim = ClaimSchema.parse({ id: "c1", type: "behavior", statement: "x crashes", quote: "x crashes" });
    expect(claim.references).toEqual({ files: [], symbols: [], lines: [], versions: [], commands: [] });
    expect(claim.evidenceProvided).toEqual([]);
  });

  it("rejects unknown claim types and bad line numbers", () => {
    expect(ClaimSchema.safeParse({ id: "c", type: "opinion", statement: "s", quote: "q" }).success).toBe(false);
    expect(
      ClaimSchema.safeParse({
        id: "c",
        type: "code_location",
        statement: "s",
        quote: "q",
        references: { lines: [{ file: "a.py", line: 0 }] },
      }).success,
    ).toBe(false);
  });
});
