import type {
  Checkout,
  Claim,
  ClaimExtractor,
  ExtractionResult,
  GitHubClient,
  LlmClient,
  LlmRequest,
  RepoRef,
  Sandbox,
  SandboxResult,
  SandboxSpec,
  TargetDocument,
  TargetRef,
  VerificationResult,
  Verifier,
} from "../src/core";
import { ClaimSchema, targetUrl } from "../src/core";

// Shared in-memory fakes. CI has no network, Ollama or Docker, so every test uses these.

export const sampleRef: TargetRef = { owner: "acme", repo: "widgets", number: 42, kind: "issue" };

export function makeTarget(overrides: Partial<TargetDocument> = {}): TargetDocument {
  return {
    ref: sampleRef,
    url: targetUrl(sampleRef),
    title: "parse_url_v2() crashes on empty input",
    body: "Calling parse_url_v2('') in src/url.py line 88 raises IndexError on v1.4.0.",
    author: "reporter",
    state: "open",
    labels: [],
    createdAt: "2026-10-01T10:00:00Z",
    comments: [],
    commitHint: "abc1234",
    ...overrides,
  };
}

export function makeClaim(overrides: Partial<Claim> & Pick<Claim, "id">): Claim {
  return ClaimSchema.parse({
    type: "code_location",
    statement: "Function parse_url_v2 exists in src/url.py",
    quote: "parse_url_v2('') in src/url.py line 88",
    references: { files: ["src/url.py"], symbols: ["parse_url_v2"] },
    ...overrides,
  });
}

export class FakeGitHub implements GitHubClient {
  checkouts: Array<{ repo: RepoRef; commit?: string }> = [];
  constructor(private readonly doc: TargetDocument = makeTarget()) {}
  async fetchTarget(_ref: TargetRef): Promise<TargetDocument> {
    return this.doc;
  }
  async checkout(repo: RepoRef, commit?: string): Promise<Checkout> {
    this.checkouts.push({ repo, commit });
    return { dir: "/tmp/fake-checkout", commit: commit ?? "head000" };
  }
}

export class FakeExtractor implements ClaimExtractor {
  constructor(private readonly result: ExtractionResult) {}
  async extract(_doc: TargetDocument): Promise<ExtractionResult> {
    return this.result;
  }
}

/** Replays recorded model outputs in order, so tests exercise real parsing paths. */
export class FakeLlm implements LlmClient {
  requests: LlmRequest[] = [];
  constructor(
    readonly model: string,
    private readonly responses: string[],
  ) {}
  async completeJson(request: LlmRequest): Promise<string> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (next === undefined) throw new Error("FakeLlm ran out of recorded responses");
    return next;
  }
}

export class FakeSandbox implements Sandbox {
  runs: SandboxSpec[] = [];
  constructor(private readonly result: SandboxResult) {}
  async run(spec: SandboxSpec): Promise<SandboxResult> {
    this.runs.push(spec);
    return this.result;
  }
}

export class FakeVerifier implements Verifier {
  constructor(
    readonly name: string,
    private readonly result: VerificationResult | null | Error,
    private readonly applies: (claim: Claim) => boolean = () => true,
  ) {}
  appliesTo(claim: Claim): boolean {
    return this.applies(claim);
  }
  async verify(): Promise<VerificationResult | null> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}
