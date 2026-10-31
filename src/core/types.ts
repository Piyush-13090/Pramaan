import { z } from "zod";

// ---------- Claims (produced by the LLM extractor, so always parsed, never trusted) ----------

export const CLAIM_TYPES = [
  "behavior",
  "code_location",
  "version",
  "security_impact",
  "pr_claim",
] as const;
export const ClaimTypeSchema = z.enum(CLAIM_TYPES);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const PROVIDED_EVIDENCE = [
  "stack_trace",
  "repro_steps",
  "logs",
  "test",
  "code_snippet",
  "screenshot",
  "none",
] as const;
export const ProvidedEvidenceSchema = z.enum(PROVIDED_EVIDENCE);
export type ProvidedEvidence = z.infer<typeof ProvidedEvidenceSchema>;

export const ClaimReferencesSchema = z.object({
  files: z.array(z.string()).default([]),
  symbols: z.array(z.string()).default([]),
  lines: z
    .array(z.object({ file: z.string(), line: z.number().int().positive() }))
    .default([]),
  versions: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
});

export const ClaimSchema = z.object({
  id: z.string().min(1),
  type: ClaimTypeSchema,
  /** One atomic, checkable statement, normalized by the extractor. */
  statement: z.string().min(1),
  /** Verbatim span of the report the claim came from, so a human can check the extraction. */
  quote: z.string(),
  references: ClaimReferencesSchema.prefault({}),
  evidenceProvided: z.array(ProvidedEvidenceSchema).default([]),
});
export type Claim = z.infer<typeof ClaimSchema>;

export type ExtractionResult =
  | { status: "ok"; claims: Claim[]; model: string; attempts: number }
  | { status: "abstained"; reason: string; model: string; attempts: number };

// ---------- Evidence and verdicts (produced by code, never by the LLM) ----------

/** Ordered strongest to weakest; grading.ts turns this into confidence. */
export const EVIDENCE_KINDS = [
  "executed_repro",
  "failing_test",
  "static_proof",
  "doc_contradiction",
  "plausible_text",
  "none",
] as const;
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceSchema = z.object({
  kind: EvidenceKindSchema,
  /** Name of the verifier that produced this evidence. */
  source: z.string().min(1),
  summary: z.string().min(1),
  location: z
    .object({
      file: z.string(),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      permalink: z.url().optional(),
    })
    .optional(),
  /** Raw command output or code excerpt backing the summary. */
  log: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const VERDICTS = [
  "reproduced",
  "contradicted",
  "not_reproduced",
  "insufficient_evidence",
] as const;
export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CONFIDENCES = ["high", "medium", "low", "none"] as const;
export const ConfidenceSchema = z.enum(CONFIDENCES);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** What one verifier concluded about one claim. */
export interface VerificationResult {
  verdict: Verdict;
  evidence: Evidence[];
  /** Evidence the reporter should supply for a firmer verdict. */
  missing: string[];
  /** Open-weight models this verifier actually called, if any. */
  modelsUsed?: string[];
}

export const ClaimAssessmentSchema = z.object({
  claim: ClaimSchema,
  verdict: VerdictSchema,
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
  missing: z.array(z.string()),
  needsHumanReview: z.boolean(),
});
export type ClaimAssessment = z.infer<typeof ClaimAssessmentSchema>;

/** Mirrors the closed-issue labels the evaluation uses as reference answers. */
export const TRIAGE_LABELS = [
  "confirmed",
  "invalid",
  "cannot-reproduce",
  "needs-info",
  "needs-human-review",
] as const;
export const TriageLabelSchema = z.enum(TRIAGE_LABELS);
export type TriageLabel = z.infer<typeof TriageLabelSchema>;

export const ReportSchema = z.object({
  target: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number().int().positive(),
    kind: z.enum(["issue", "pull"]),
    url: z.url(),
    title: z.string(),
    /** Commit the claims were verified against; null when no checkout was needed. */
    commit: z.string().nullable(),
  }),
  generatedAt: z.iso.datetime(),
  models: z.array(z.string()),
  extraction: z.discriminatedUnion("status", [
    z.object({ status: z.literal("ok"), claimCount: z.number().int().nonnegative() }),
    z.object({ status: z.literal("abstained"), reason: z.string() }),
  ]),
  assessments: z.array(ClaimAssessmentSchema),
  triage: z.object({ label: TriageLabelSchema, rationale: z.string() }),
});
export type Report = z.infer<typeof ReportSchema>;
