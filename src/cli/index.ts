import { writeFileSync } from "node:fs";
import { parseTargetUrl, runPipeline } from "../core";
import { parseCliArgs, USAGE } from "./args";
import { createDeps } from "./deps";

async function main(argv: string[]): Promise<number> {
  const cmd = parseCliArgs(argv);
  if (cmd.command === "help") {
    console.log(USAGE);
    return 0;
  }

  const ref = parseTargetUrl(cmd.url);
  const report = await runPipeline(ref, createDeps(), {
    commit: cmd.commit,
    onProgress: (e) => console.error(`[${e.stage}] ${e.message}`),
  });

  const json = JSON.stringify(report, null, 2);
  if (cmd.out) {
    writeFileSync(cmd.out, `${json}\n`);
    console.error(`Report written to ${cmd.out}`);
  } else {
    console.log(json);
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: Error) => {
    console.error(`pramaan: ${err.message}`);
    process.exit(1);
  },
);
