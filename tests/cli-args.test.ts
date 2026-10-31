import { describe, expect, it } from "vitest";
import { CliArgsError, parseCliArgs } from "../src/cli/args";

describe("parseCliArgs", () => {
  it("shows help with no arguments or -h", () => {
    expect(parseCliArgs([])).toEqual({ command: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ command: "help" });
  });

  it("parses check with options", () => {
    expect(
      parseCliArgs(["check", "https://github.com/a/b/issues/1", "--commit", "abc", "--out", "r.json"]),
    ).toEqual({ command: "check", url: "https://github.com/a/b/issues/1", commit: "abc", out: "r.json" });
  });

  it.each([[["frobnicate"]], [["check"]], [["check", "u", "extra"]], [["check", "u", "--nope"]]])(
    "rejects %j",
    (argv) => {
      expect(() => parseCliArgs(argv)).toThrow(CliArgsError);
    },
  );
});
