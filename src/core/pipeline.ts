import { assessClaim, triage } from "./grading";
import type {
  Checkout,
  ClaimExtractor,
  GitHubClient,
  Sandbox,
  TargetRef,
  Verifier,
} from "./ports";
import { type ClaimAssessment, type Report, ReportSchema, type VerificationResult } from "./types";

export type PipelineStage = "fetch" | "extract" | "checkout" | "verify" | "grade" | "done";

export interface ProgressEvent {
  stage: PipelineStage;
  message: string;
  claimIndex?: number;
  claimCount?: number;
}

export interface PipelineDeps {
  github: GitHubClient;
  extractor: ClaimExtractor;
  verifiers: Verifier[];
  sandbox?: Sandbox;
  now?: () => Date;
}

export interface PipelineOptions {
  /** Verify against this commit instead of the one the GitHub adapter suggests. */
  commit?: string;
  onProgress?: (event: ProgressEvent) => void;
}

export async function runPipeline(
  ref: TargetRef,
  deps: PipelineDeps,
  options: PipelineOptions = {},
): Promise<Report> {
  const progress = options.onProgress ?? (() => {});
  const now = deps.now ?? (() => new Date());

  progress({ stage: "fetch", message: `Fetching ${ref.owner}/${ref.repo}#${ref.number}` });
  const target = await deps.github.fetchTarget(ref);

  progress({ stage: "extract", message: "Extracting technical claims" });
  const extraction = await deps.extractor.extract(target);
  const claims = extraction.status === "ok" ? extraction.claims : [];
  const models = new Set<string>(extraction.model ? [extraction.model] : []);

  let checkout: Checkout | null = null;
  const assessments: ClaimAssessment[] = [];

  if (claims.length > 0) {
    const commit = options.commit ?? target.commitHint;
    progress({ stage: "checkout", message: `Checking out ${ref.owner}/${ref.repo}${commit ? ` at ${commit}` : ""}` });
    checkout = await deps.github.checkout(ref, commit);

    for (const [i, claim] of claims.entries()) {
      progress({
        stage: "verify",
        message: `Verifying: ${claim.statement}`,
        claimIndex: i,
        claimCount: claims.length,
      });
      const results: VerificationResult[] = [];
      for (const verifier of deps.verifiers.filter((v) => v.appliesTo(claim))) {
        try {
          const result = await verifier.verify(claim, { target, checkout, sandbox: deps.sandbox });
          if (result) {
            results.push(result);
            result.modelsUsed?.forEach((m) => models.add(m));
          }
        } catch (err) {
          results.push({
            verdict: "insufficient_evidence",
            evidence: [],
            missing: [`The ${verifier.name} check failed to run: ${(err as Error).message}`],
          });
        }
      }
      assessments.push(assessClaim(claim, results));
    }
  }

  progress({ stage: "grade", message: "Grading evidence" });
  const report = ReportSchema.parse({
    target: {
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      kind: ref.kind,
      url: target.url,
      title: target.title,
      commit: checkout?.commit ?? null,
    },
    generatedAt: now().toISOString(),
    models: [...models],
    extraction:
      extraction.status === "ok"
        ? { status: "ok", claimCount: claims.length }
        : { status: "abstained", reason: extraction.reason },
    assessments,
    triage: triage(extraction, assessments),
  });

  progress({ stage: "done", message: `Triage: ${report.triage.label}` });
  return report;
}
