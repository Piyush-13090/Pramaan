import type { PipelineDeps } from "../core";

/**
 * Builds the real adapters (GitHub, Ollama, Docker) from the environment.
 * Each adapter is added here by the PR that implements it.
 */
export function createDeps(): PipelineDeps {
  throw new Error(
    "Real adapters are not wired yet: the GitHub fetcher (PR 03) and Ollama claim extractor (PR 04) add them here.",
  );
}
