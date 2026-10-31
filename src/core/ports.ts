import type { Claim, ExtractionResult, VerificationResult } from "./types";

// Every external system sits behind one of these interfaces. Tests and CI use the
// fakes in tests/fakes.ts; the real adapters call GitHub, Ollama and Docker.

export type TargetKind = "issue" | "pull";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface TargetRef extends RepoRef {
  number: number;
  kind: TargetKind;
}

export interface TargetComment {
  author: string;
  body: string;
  createdAt: string;
}

export interface TargetDocument {
  ref: TargetRef;
  url: string;
  title: string;
  body: string;
  author: string;
  state: "open" | "closed";
  labels: string[];
  createdAt: string;
  comments: TargetComment[];
  /** Commit the report most plausibly refers to (PR head, or default branch when the issue was filed). */
  commitHint?: string;
  pull?: {
    baseSha: string;
    headSha: string;
    changedFiles: string[];
  };
}

export interface Checkout {
  /** Local directory holding the repo at `commit`. Read only from Node; never executed here. */
  dir: string;
  commit: string;
}

export interface GitHubClient {
  fetchTarget(ref: TargetRef): Promise<TargetDocument>;
  checkout(repo: RepoRef, commit?: string): Promise<Checkout>;
}

export interface LlmRequest {
  system: string;
  prompt: string;
  /** JSON schema the model output must follow (passed to Ollama's `format`). */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmClient {
  readonly model: string;
  /** Returns the raw model text; callers parse and validate it. */
  completeJson(request: LlmRequest): Promise<string>;
}

export interface ClaimExtractor {
  extract(doc: TargetDocument): Promise<ExtractionResult>;
}

export interface SandboxSpec {
  image: string;
  /** Host directory mounted read-only at /repo. */
  repoDir: string;
  command: string[];
  timeoutMs: number;
  memoryMb: number;
  cpus: number;
}

export interface SandboxResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface Sandbox {
  run(spec: SandboxSpec): Promise<SandboxResult>;
}

export interface VerifyContext {
  target: TargetDocument;
  checkout: Checkout;
  sandbox?: Sandbox;
}

export interface Verifier {
  readonly name: string;
  appliesTo(claim: Claim): boolean;
  /** Returns null when the verifier ran but found nothing relevant to say. */
  verify(claim: Claim, ctx: VerifyContext): Promise<VerificationResult | null>;
}
