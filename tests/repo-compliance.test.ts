import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("hackathon repository requirements", () => {
  it.each([
    "LICENSE",
    "HACKATHON.md",
    ".github/pull_request_template.md",
    ".github/workflows/ci.yml",
  ])("%s exists", (file) => {
    expect(existsSync(join(root, file))).toBe(true);
  });

  it("LICENSE is MIT", () => {
    expect(read("LICENSE")).toMatch(/^MIT License/);
  });

  it("PR template has every mandatory section", () => {
    const template = read(".github/pull_request_template.md");
    for (const heading of [
      "## What this PR does",
      "## Models the product uses in this PR",
      "## AI coding assistants that helped write it",
      "## How we tested it",
    ]) {
      expect(template).toContain(heading);
    }
  });

  it("CI runs on pull requests", () => {
    expect(read(".github/workflows/ci.yml")).toMatch(/^\s*pull_request:/m);
  });

  it(".env.local is gitignored so tokens never get committed", () => {
    expect(read(".gitignore")).toMatch(/^\.env\.\*$/m);
  });
});
