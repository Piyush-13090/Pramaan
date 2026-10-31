import { describe, expect, it } from "vitest";
import { type ProgressEvent, ReportSchema, runPipeline } from "../src/core";
import { FakeExtractor, FakeGitHub, FakeVerifier, makeClaim, sampleRef } from "./fakes";

const fixedNow = () => new Date("2026-10-31T20:00:00Z");

describe("runPipeline", () => {
  it("fetches, extracts, checks out, verifies and grades", async () => {
    const github = new FakeGitHub();
    const claim = makeClaim({ id: "c1" });
    const events: ProgressEvent[] = [];

    const report = await runPipeline(
      sampleRef,
      {
        github,
        extractor: new FakeExtractor({ status: "ok", claims: [claim], model: "gemma-test", attempts: 1 }),
        verifiers: [
          new FakeVerifier("symbols", {
            verdict: "contradicted",
            evidence: [{ kind: "static_proof", source: "symbols", summary: "parse_url_v2 is not defined anywhere" }],
            missing: [],
          }),
        ],
        now: fixedNow,
      },
      { onProgress: (e) => events.push(e) },
    );

    expect(ReportSchema.parse(report)).toEqual(report);
    expect(report.target.commit).toBe("abc1234");
    expect(report.models).toEqual(["gemma-test"]);
    expect(report.assessments[0]?.verdict).toBe("contradicted");
    expect(report.triage.label).toBe("invalid");
    expect(events.map((e) => e.stage)).toEqual(["fetch", "extract", "checkout", "verify", "grade", "done"]);
  });

  it("prefers an explicit commit over the adapter's hint", async () => {
    const github = new FakeGitHub();
    await runPipeline(
      sampleRef,
      {
        github,
        extractor: new FakeExtractor({ status: "ok", claims: [makeClaim({ id: "c1" })], model: "m", attempts: 1 }),
        verifiers: [],
      },
      { commit: "deadbeef" },
    );
    expect(github.checkouts[0]?.commit).toBe("deadbeef");
  });

  it("skips checkout and abstains when extraction abstains", async () => {
    const github = new FakeGitHub();
    const report = await runPipeline(sampleRef, {
      github,
      extractor: new FakeExtractor({ status: "abstained", reason: "invalid JSON after 3 tries", model: "m", attempts: 3 }),
      verifiers: [],
    });
    expect(github.checkouts).toHaveLength(0);
    expect(report.target.commit).toBeNull();
    expect(report.extraction).toEqual({ status: "abstained", reason: "invalid JSON after 3 tries" });
    expect(report.triage.label).toBe("needs-human-review");
  });

  it("turns a crashing verifier into missing evidence instead of failing the report", async () => {
    const report = await runPipeline(sampleRef, {
      github: new FakeGitHub(),
      extractor: new FakeExtractor({ status: "ok", claims: [makeClaim({ id: "c1" })], model: "m", attempts: 1 }),
      verifiers: [new FakeVerifier("boom", new Error("ripgrep not found"))],
    });
    const a = report.assessments[0];
    expect(a?.verdict).toBe("insufficient_evidence");
    expect(a?.missing.join(" ")).toContain("ripgrep not found");
  });

  it("only runs verifiers that apply to the claim and records models they used", async () => {
    const report = await runPipeline(sampleRef, {
      github: new FakeGitHub(),
      extractor: new FakeExtractor({ status: "ok", claims: [makeClaim({ id: "c1" })], model: "m1", attempts: 1 }),
      verifiers: [
        new FakeVerifier("never", new Error("should not run"), () => false),
        new FakeVerifier("drafter", {
          verdict: "reproduced",
          evidence: [{ kind: "executed_repro", source: "drafter", summary: "IndexError raised" }],
          missing: [],
          modelsUsed: ["coder-test"],
        }),
      ],
    });
    expect(report.assessments[0]?.verdict).toBe("reproduced");
    expect(report.models).toEqual(["m1", "coder-test"]);
  });
});
