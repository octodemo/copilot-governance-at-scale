import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { loadContent } from "./content.mjs";
import { renderMarkdown } from "./ui/markdown.js";
import { commandInputNames, resolveContentCommand } from "../../../lib/workshop-resolver.mjs";
import { workspaceFor } from "../../../tests/content-validation/exercise-helpers.mjs";

const profile = { enterpriseSlug: "lab-enterprise", organizationSlug: "lab-org" };
const commandsFor = (content, shell) => {
  const commands = new Set();
  const visit = (value) => {
    if (typeof value === "string") renderMarkdown(value, profile, (_command, template) => commands.add(template), shell);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) if (!["source", "sourceText"].includes(key)) visit(child);
    }
  };
  visit(content.paths);
  return [...commands];
};
const content = await loadContent();
const windowsCommands = commandsFor(content, "powershell");
const executable = ["pwsh", ...(process.platform === "win32" ? ["powershell.exe"] : [])]
  .find((name) => spawnSync(name, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"]).status === 0);
const psTest = { skip: executable ? false : "PowerShell is not installed; run this suite with pwsh or on Windows." };

async function runPowerShell(t, script) {
  const workspace = await workspaceFor(t);
  const file = join(workspace, "commands.ps1");
  await writeFile(file, script);
  const result = spawnSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", file], {
    cwd: workspace, encoding: "utf8", timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return { workspace, stdout: result.stdout.trim() };
}

test("all runnable Windows commands avoid POSIX-only constructs and retain their inputs", () => {
  const posixCommands = commandsFor(content, "sh");
  assert.equal(windowsCommands.length, posixCommands.length);
  assert.ok(windowsCommands.length >= 17);
  for (const [index, command] of windowsCommands.entries()) {
    assert.doesNotMatch(command, /\\\r?\n|&&|^\w+=|^\s*(?:jq|curl|while|set -e)\s/m, command);
    assert.deepEqual(commandInputNames(command), commandInputNames(posixCommands[index]));
  }
});

test("PowerShell input quoting preserves literal quotes, paths and metacharacters", psTest, async (t) => {
  const values = ["id'with quote", "C:\\Private Folder\\report.csv", "$HOME; $(throw 'injected') & `whoami`", "\u2018; throw 'injected'; #\u2019", 'double " quote', ""];
  const scripts = values.map((value) => resolveContentCommand(
    "$value={{input.value}}\nConvertTo-Json -Compress -InputObject $value", {}, { value }, "powershell"));
  const { stdout } = await runPowerShell(t, scripts.join("\n"));
  assert.deepEqual(stdout.split(/\r?\n/).map((line) => JSON.parse(line)), values);
});

test("authored Windows commands execute with stubbed CLI calls and produce the expected report files", psTest, async (t) => {
  const inputs = { "report-id": "report-123", "budget-id": "budget-456", "user-login": "test-user",
    "download-url": "https://example.test/report?signature=literal&part=1", "output-file": "Private report.csv" };
  const scripts = windowsCommands.map((template) => resolveContentCommand(template, profile, inputs, "powershell"));
  const { workspace } = await runPowerShell(t, `
$ErrorActionPreference = 'Stop'
$global:calls = [System.Collections.Generic.List[object]]::new()
function gh {
  $global:calls.Add(@{ command = 'gh'; arguments = @($args) })
  $global:LASTEXITCODE = 0
  if ($args -contains '--slurp') { return '[[{"action":"copilot.one"}],[{"action":"copilot.two","nested":{"actor":"test"}}]]' }
  return '{"report_start_day":"2026-10-01","report_end_day":"2026-10-28","download_links":["https://example.test/one?a=1&b=2","https://example.test/two"]}'
}
function curl.exe {
  $global:calls.Add(@{ command = 'curl.exe'; arguments = @($args) })
  $outputIndex = [array]::IndexOf($args, '--output')
  if ($outputIndex -lt 0) { throw 'Missing output path' }
  Set-Content -LiteralPath $args[$outputIndex + 1] -Value '{"feature":"fixture"}'
  $global:LASTEXITCODE = 0
}
${scripts.join("\n\n")}
ConvertTo-Json -InputObject @($global:calls) -Depth 100 | Set-Content -Encoding utf8 calls.json
`);
  const readJson = async (name) => JSON.parse((await readFile(join(workspace, name), "utf8")).replace(/^\uFEFF/, ""));
  const calls = await readJson("calls.json");
  const reportRequest = calls.find(({ arguments: args }) => args.includes("report_type=ai_credit"));
  assert.deepEqual(reportRequest.arguments, ["api", "--method", "POST", "-H", "X-GitHub-Api-Version: 2026-03-10",
    "/enterprises/lab-enterprise/settings/billing/reports", "-f", "report_type=ai_credit",
    "-f", "start_date=2026-10-01", "-f", "end_date=2026-10-31"]);
  assert.ok(calls.some(({ arguments: args }) => args.includes("/enterprises/lab-enterprise/settings/billing/reports/report-123")));
  assert.ok(calls.some(({ arguments: args }) => args.includes("/enterprises/lab-enterprise/settings/billing/budgets/budget-456")));
  assert.ok(calls.some(({ arguments: args }) => args.includes("user=test-user")));
  const downloads = calls.filter(({ command }) => command === "curl.exe");
  assert.equal(downloads.length, 3);
  assert.ok(downloads[0].arguments.includes(inputs["download-url"]));
  assert.ok(downloads[0].arguments.includes(inputs["output-file"]));
  for (const { arguments: args } of downloads) {
    assert.ok(args.includes("--fail") && args.includes("--proto") && args.includes("=https"));
    assert.ok(!args.some((arg) => /authorization|token/i.test(arg)));
  }
  for (const name of ["Private report.csv", "copilot-usage-1.ndjson", "copilot-usage-2.ndjson"]) {
    assert.deepEqual(await readJson(name), { feature: "fixture" });
  }
  assert.equal((await readJson("usage-report-links.json")).download_links.length, 2);
  assert.deepEqual(await readJson("copilot-audit.json"), [{ action: "copilot.one" }, { action: "copilot.two", nested: { actor: "test" } }]);
});

test("Windows report requests and download loops stop explicitly on failures", psTest, async (t) => {
  const report = windowsCommands.find((command) => command.includes("$response = gh") && command.includes("/copilot/metrics/"));
  const download = windowsCommands.find((command) => command.includes("foreach ($url"));
  const script = resolveContentCommand(report, profile, {}, "powershell");
  const { stdout } = await runPowerShell(t, `
$ErrorActionPreference = 'Stop'
function gh { $global:LASTEXITCODE = 1 }
try {
  ${script}
  throw 'Report request did not stop'
} catch {
  if ($_.Exception.Message -ne 'Report request failed.') { throw }
}
if (Test-Path usage-report-links.json) { throw 'Failed request wrote an export' }
'{"download_links":[]}' | Set-Content usage-report-links.json
try {
  ${download}
  throw 'Empty download list did not stop'
} catch {
  if ($_.Exception.Message -ne 'No report download links returned') { throw }
}
$global:count = 0
function curl.exe { $global:count++; $global:LASTEXITCODE = 1 }
'{"download_links":["https://example.test/one","https://example.test/two"]}' | Set-Content usage-report-links.json
try {
  ${download}
  throw 'Failed download did not stop'
} catch {
  if ($_.Exception.Message -ne 'Download 1 failed.') { throw }
}
if ($global:count -ne 1) { throw 'Continued after failed download' }
Write-Output 'failures surfaced'
`);
  assert.equal(stdout, "failures surfaced");
});
