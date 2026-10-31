import type { RepoRef, TargetRef } from "./ports";

export class TargetUrlError extends Error {
  override name = "TargetUrlError";
}

const NAME = /^[A-Za-z0-9_.-]+$/;

function githubPath(input: string): string[] {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new TargetUrlError(`Not a URL: ${input}`);
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new TargetUrlError(`Only github.com links are supported, got ${url.hostname}`);
  }
  return url.pathname.split("/").filter(Boolean);
}

function repoFrom(owner: string | undefined, repo: string | undefined, input: string): RepoRef {
  const name = repo?.replace(/\.git$/, "");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) {
    throw new TargetUrlError(`Could not read owner/repo from ${input}`);
  }
  return { owner, repo: name };
}

/** Parses https://github.com/owner/repo/issues/12 or .../pull/12 (extra path, query and hash are ignored). */
export function parseTargetUrl(input: string): TargetRef {
  const [owner, repo, segment, num] = githubPath(input);
  const kind = segment === "issues" ? "issue" : segment === "pull" ? "pull" : undefined;
  if (!kind) {
    throw new TargetUrlError(`Expected an issue or pull request link, got ${input}`);
  }
  const number = Number(num);
  if (!Number.isInteger(number) || number <= 0) {
    throw new TargetUrlError(`Missing issue or pull request number in ${input}`);
  }
  return { ...repoFrom(owner, repo, input), number, kind };
}

/** Parses https://github.com/owner/repo, with or without .git or a trailing path. */
export function parseRepoUrl(input: string): RepoRef {
  const [owner, repo] = githubPath(input);
  return repoFrom(owner, repo, input);
}

export function targetUrl(ref: TargetRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}/${ref.kind === "issue" ? "issues" : "pull"}/${ref.number}`;
}
