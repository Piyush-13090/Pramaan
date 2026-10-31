import { parseArgs } from "node:util";

export const USAGE = `Usage: pramaan check <github issue or pull request url> [options]

Options:
  --commit <sha>   Verify claims against this commit instead of the suggested one
  --out <file>     Write the JSON report to a file instead of stdout
  -h, --help       Show this help`;

export type CliCommand =
  | { command: "help" }
  | { command: "check"; url: string; commit?: string; out?: string };

export class CliArgsError extends Error {
  override name = "CliArgsError";
}

export function parseCliArgs(argv: string[]): CliCommand {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        commit: { type: "string" },
        out: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    throw new CliArgsError((err as Error).message);
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) return { command: "help" };

  const [command, url, ...rest] = positionals;
  if (command !== "check") throw new CliArgsError(`Unknown command: ${command}`);
  if (!url) throw new CliArgsError("check needs an issue or pull request URL");
  if (rest.length > 0) throw new CliArgsError(`Unexpected arguments: ${rest.join(" ")}`);
  return { command: "check", url, commit: values.commit, out: values.out };
}
