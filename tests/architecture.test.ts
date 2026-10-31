import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const core = sourceFiles(join(root, "src/core")).map((path) => ({
  path: relative(root, path),
  text: readFileSync(path, "utf8"),
}));

describe("architecture rules", () => {
  it("src/core does not depend on Next.js or React, so the CLI and CI can run it", () => {
    for (const file of core) {
      expect(file.text, file.path).not.toMatch(/from\s+["'](next|react)(\/|["'])/);
    }
  });

  it("only the GitHub and sandbox adapters may spawn processes", () => {
    for (const file of core) {
      if (/^src\/core\/(github|sandbox)\//.test(file.path)) continue;
      expect(file.text, file.path).not.toMatch(/child_process/);
    }
  });

  it("nothing in src/core evaluates code dynamically", () => {
    for (const file of core) {
      expect(file.text, file.path).not.toMatch(/\beval\s*\(|new\s+Function\s*\(|\bvm\.run/);
    }
  });
});
