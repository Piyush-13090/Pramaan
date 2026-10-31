import type {
  Claim,
  ClaimAssessment,
  Confidence,
  Evidence,
  EvidenceKind,
  ExtractionResult,
  TriageLabel,
  VerificationResult,
} from "./types";

// Confidence comes only from the type of evidence, never from asking a model.
const STRENGTH: Record<EvidenceKind, number> = {
  executed_repro: 3,
  failing_test: 3,
  static_proof: 2,
  doc_contradiction: 2,
  plausible_text: 1,
  none: 0,
};

const CONFIDENCE_BY_STRENGTH: Confidence[] = ["none", "low", "medium", "high"];

export function strength(evidence: Evidence[]): number {
  return Math.max(0, ...evidence.map((e) => STRENGTH[e.kind]));
}

export function confidenceFor(evidence: Evidence[]): Confidence {
  return CONFIDENCE_BY_STRENGTH[strength(evidence)] ?? "none";
}

export function assessClaim(claim: Claim, results: VerificationResult[]): ClaimAssessment {
  const decisive = results.filter((r) => r.verdict !== "insufficient_evidence");
  const missing = [...new Set(results.flatMap((r) => r.missing))];
  const allEvidence = results.flatMap((r) => r.evidence);

  if (decisive.length === 0) {
    return {
      claim,
      verdict: "insufficient_evidence",
      confidence: "none",
      evidence: allEvidence,
      missing: missing.length > 0 ? missing : ["No check could test this claim automatically."],
      needsHumanReview: true,
    };
  }

  const verdicts = new Set(decisive.map((r) => r.verdict));
  if (verdicts.has("reproduced") && verdicts.has("contradicted")) {
    return {
      claim,
      verdict: "insufficient_evidence",
      confidence: "none",
      evidence: allEvidence,
      missing: ["Checks disagree: some evidence supports this claim and some contradicts it.", ...missing],
      needsHumanReview: true,
    };
  }

  const best = decisive.reduce((a, b) => (strength(b.evidence) > strength(a.evidence) ? b : a));
  const confidence = confidenceFor(best.evidence);
  return {
    claim,
    verdict: best.verdict,
    confidence,
    evidence: allEvidence,
    missing,
    needsHumanReview:
      confidence === "low" ||
      confidence === "none" ||
      // Wrongly dismissing a real security bug costs more than a human look.
      (claim.type === "security_impact" && best.verdict !== "reproduced"),
  };
}

const atLeastMedium = (a: ClaimAssessment) => a.confidence === "high" || a.confidence === "medium";

export function triage(
  extraction: ExtractionResult,
  assessments: ClaimAssessment[],
): { label: TriageLabel; rationale: string } {
  if (extraction.status === "abstained") {
    return { label: "needs-human-review", rationale: `Claim extraction abstained: ${extraction.reason}` };
  }
  if (assessments.length === 0) {
    return { label: "needs-info", rationale: "The report contains no specific technical claim to check." };
  }

  const reproduced = assessments.filter((a) => a.verdict === "reproduced" && a.confidence === "high");
  if (reproduced.length > 0) {
    return { label: "confirmed", rationale: `${reproduced.length} claim(s) reproduced by execution.` };
  }

  if (assessments.some((a) => a.claim.type === "security_impact" && a.needsHumanReview)) {
    return {
      label: "needs-human-review",
      rationale: "A security claim could not be settled automatically; a maintainer should look.",
    };
  }

  const decisive = assessments.filter((a) => a.verdict !== "insufficient_evidence");
  if (decisive.length > 0 && decisive.every((a) => a.verdict === "contradicted" && atLeastMedium(a))) {
    return {
      label: "invalid",
      rationale: `Every checkable claim (${decisive.length}) is contradicted by the code or docs.`,
    };
  }
  if (
    decisive.length > 0 &&
    decisive.every((a) => a.verdict !== "reproduced" && atLeastMedium(a)) &&
    decisive.some((a) => a.verdict === "not_reproduced")
  ) {
    return { label: "cannot-reproduce", rationale: "The described behavior did not occur when tested." };
  }

  return {
    label: "needs-info",
    rationale: "The evidence is not strong enough for a verdict; the report needs more detail.",
  };
}
