import { describe, expect, it } from "vitest";
import { parseRepoUrl, parseTargetUrl, TargetUrlError, targetUrl } from "../src/core";

describe("parseTargetUrl", () => {
  it("parses issue links", () => {
    expect(parseTargetUrl("https://github.com/curl/curl/issues/12345")).toEqual({
      owner: "curl",
      repo: "curl",
      number: 12345,
      kind: "issue",
    });
  });

  it("parses pull request links with extra path, query and hash", () => {
    expect(parseTargetUrl("github.com/vercel/next.js/pull/7/files?w=1#diff")).toEqual({
      owner: "vercel",
      repo: "next.js",
      number: 7,
      kind: "pull",
    });
  });

  it.each([
    "https://gitlab.com/a/b/issues/1",
    "https://github.com/a/b",
    "https://github.com/a/b/issues/abc",
    "https://github.com/a/b/discussions/3",
    "not a url at all",
  ])("rejects %s", (input) => {
    expect(() => parseTargetUrl(input)).toThrow(TargetUrlError);
  });

  it("round-trips through targetUrl", () => {
    const url = "https://github.com/acme/widgets/pull/9";
    expect(targetUrl(parseTargetUrl(url))).toBe(url);
  });
});

describe("parseRepoUrl", () => {
  it("accepts .git suffix and trailing paths", () => {
    expect(parseRepoUrl("https://github.com/acme/widgets.git")).toEqual({ owner: "acme", repo: "widgets" });
    expect(parseRepoUrl("https://github.com/acme/widgets/tree/main/src")).toEqual({
      owner: "acme",
      repo: "widgets",
    });
  });
});
