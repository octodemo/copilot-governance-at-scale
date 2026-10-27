#!/usr/bin/env node
import { ContentReadError, formatDiagnostic, loadWorkshopContent } from "../lib/workshop-content.mjs";

const args = process.argv.slice(2);
const usage = "Usage: node scripts/validate-content.mjs [--file content/block.md] [--root directory]";
const options = {};
let invalid = false;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--help" && args.length === 1) {
    console.log(usage);
    process.exit(0);
  }
  const key = { "--file": "file", "--root": "root" }[arg];
  if (!key || options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) { invalid = true; break; }
  options[key] = args[++index];
}
if (invalid) {
  console.error(`cli:1 error[E_INVOCATION] arguments: Invalid arguments.\n  Hint: ${usage}`);
  process.exitCode = 2;
} else {
  try {
    const result = await loadWorkshopContent(options);
    for (const item of result.diagnostics) console.error(formatDiagnostic(item));
    if (result.diagnostics.length) process.exitCode = 1;
    else console.log(`Validated ${result.blocks.length} Markdown block(s) and shared/planning catalog references (offline; structural validity is not content approval).`);
  } catch (error) {
    const known = error instanceof ContentReadError;
    console.error(`${known ? error.file ?? "cli" : "cli"}:1 error[${known ? "E_READ" : "E_INTERNAL"}] validation: ${error.message}\n  Hint: ${known ? "Check the file path and permissions, then rerun; no files were changed." : "Report this validator error with the source that triggered it."}`);
    process.exitCode = 2;
  }
}
