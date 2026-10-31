import { exportSource } from "./lib/source-export.mjs";
const args = process.argv.slice(2);
const review = args.includes("--review");
const positional = args.filter((arg) => arg !== "--review");
if (positional.length > 1 || positional.some((arg) => arg.startsWith("--"))) {
  console.error("Usage: npm run release:export -- [--review] [output.tar.gz]");
  process.exitCode = 1;
} else {
  try {
    const result = exportSource({
      repo: process.cwd(),
      output: positional[0],
      review,
    });
    console.log(JSON.stringify(result, null, 2));
    console.log(
      "Source-only snapshot; .git, ignored private files and commit history are excluded. Review licensing, provider approval, assets and the release checklist before distribution. This command does not publish anything.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Source export failed.",
    );
    process.exitCode = 1;
  }
}
