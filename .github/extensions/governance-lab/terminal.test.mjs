import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "./content.mjs";
import { createStore } from "./state.mjs";
import { openServer } from "./server.mjs";
import { openCommandTerminal, validateTerminalCommand } from "./terminal.mjs";
import { renderMarkdown } from "./ui/markdown.js";
import { workspaceFor } from "../../../tests/content-validation/exercise-helpers.mjs";
import { commandShellForPlatform } from "../../../lib/workshop-resolver.mjs";

const shell = "printf 'Workshop terminal test\\n'";
const content = structuredClone(await loadContent());
const templatedShell = "REPORT_ID={{input.report-id}}\nprintf '%s' \"$REPORT_ID\"";
content.paths[0].stages.understand.markdown += "\n\n```sh\n" + shell + "\n```\n\n```sh profile\nprintf '{{enterprise.slug}}'\n```\n\n```sh profile\n" + templatedShell + "\n```";
const inputFor = (state, commandTemplate = shell, inputs = {}) => ({
  commandTemplate, inputs, contentVersion: content.version, revision: state.revision,
});

test("shell blocks expose launchers and command forms while retaining validated templates", () => {
  const commands = [];
  const template = "printf '{{enterprise.slug}}' {{input.report-id}}";
  const rendered = renderMarkdown("1. Run this:\n\n   ```sh profile\n   " + template + "\n   ```", { enterpriseSlug: "my-lab" },
    (command, source) => commands.push({ command, source }));
  assert.deepEqual(commands, [{ command: "printf 'my-lab' {{input.report-id}}", source: template }]);
  assert.match(rendered, /data-open-terminal/);
  assert.match(rendered, /data-profile-command/);
  assert.match(rendered, /data-command-input="report-id"/);
  assert.match(rendered, /aria-label="Command inputs"/);
  for (const info of ["json", "sh manual", "sh malicious", "sh profile extra", "text", ""]) {
    assert.doesNotMatch(renderMarkdown("```" + info + "\nprintf test\n```"), /data-open-terminal/);
  }
  assert.doesNotMatch(renderMarkdown("```sh\n\n```"), /data-open-terminal/);
  assert.match(renderMarkdown("```bash\nprintf '<script>'\n```"), /&lt;script&gt;/);
});

test("command validation resolves configured profile values and safely quoted form input", () => {
  const state = { revision: 2, profile: { enterpriseSlug: "my-lab", organizationSlug: "my-org", repositoryName: "pets-workshop" } };
  const input = inputFor(state);
  assert.equal(validateTerminalCommand(input, content, state), shell);
  assert.equal(validateTerminalCommand(inputFor(state, "printf '{{enterprise.slug}}'"), content, state), "printf 'my-lab'");
  assert.equal(validateTerminalCommand(inputFor(state, templatedShell, { "report-id": "id'\\n;touch bad" }), content, state),
    "REPORT_ID='id'\\''\\n;touch bad'\nprintf '%s' \"$REPORT_ID\"");
  assert.equal(validateTerminalCommand(inputFor(state, 'gh repo view "{{organization.slug}}/{{repository.name}}"'), {
    ...content,
    paths: [...content.paths, { stages: { understand: { markdown: '```sh profile\ngh repo view "{{organization.slug}}/{{repository.name}}"\n```' } } }],
  }, state), 'gh repo view "my-org/pets-workshop"');
});

test("command validation rejects unknown fields, stale, arbitrary, malformed, control-bearing and unresolved commands", () => {
  const state = { revision: 2, profile: { enterpriseSlug: "my-lab" } };
  const input = inputFor(state);
  for (const change of [
    { extra: true }, { commandTemplate: "touch arbitrary" },
    { commandTemplate: "" }, { commandTemplate: "x".repeat(16_001) }, { commandTemplate: "printf '\x1b'" },
    { inputs: { unexpected: "value" } },
    { commandTemplate: templatedShell, inputs: {} },
    { commandTemplate: templatedShell, inputs: { "report-id": "line\nbreak" } },
  ]) assert.throws(() => validateTerminalCommand({ ...input, ...change }, content, state), (error) => error.statusCode === 400);
  for (const change of [{ revision: 1 }, { contentVersion: "stale" }]) {
    assert.throws(() => validateTerminalCommand({ ...input, ...change }, content, state), (error) => error.statusCode === 409);
  }
  assert.throws(() => validateTerminalCommand(inputFor(state, "printf '{{enterprise.slug}}'"), content, { ...state, profile: {} }), /Configure your enterprise, organization, or repository profile/);
});

test("native terminal adapter reuses one terminal per workshop document with the exact reviewed command", async () => {
  const calls = [];
  const session = { rpc: { canvas: { open: async (input) => { calls.push(input); return { instanceId: input.instanceId }; } } } };
  await openCommandTerminal(session, shell, "default");
  await openCommandTerminal(session, shell, "default");
  await openCommandTerminal(session, shell, "other");
  assert.equal(calls[0].instanceId, calls[1].instanceId);
  assert.notEqual(calls[0].instanceId, calls[2].instanceId);
  assert.match(calls[0].instanceId, /^workshop-terminal-[0-9a-f]{16}$/);
  assert.equal(calls[0].canvasId, "terminal");
  assert.deepEqual(calls[0].input, { title: "Workshop command", command: shell, placement: { focus: true } });
});

const pairedCommand = "```sh profile\nREPORT_ID={{input.report-id}}\nprintf '%s' \"$REPORT_ID\"\n```\n\n```powershell profile\n$REPORT_ID={{input.report-id}}\nWrite-Output $REPORT_ID\n```";
test("OS selects one authored shell alternative, including nested lists and alerts", () => {
  assert.equal(commandShellForPlatform("win32"), "powershell");
  for (const platform of ["darwin", "linux", "freebsd"]) assert.equal(commandShellForPlatform(platform), "sh");
  for (const markdown of [
    pairedCommand,
    "1. Run:\n\n" + pairedCommand.split("\n").map((line) => "   " + line).join("\n"),
    "> [!TIP]\n" + pairedCommand.split("\n").map((line) => "> " + line).join("\n"),
    pairedCommand.replaceAll("```", "~~~~").replaceAll("\n", "\r\n"),
  ]) {
    for (const shell of ["sh", "powershell"]) {
      const commands = [];
      const html = renderMarkdown(markdown, {}, (_value, template) => commands.push(template), shell);
      assert.equal(commands.length, 1);
      assert.equal((html.match(/data-open-terminal/g) ?? []).length, 1);
      assert.equal((html.match(/data-command-input="report-id"/g) ?? []).length, 1);
      assert.match(commands[0], shell === "powershell" ? /^\$REPORT_ID=/ : /^REPORT_ID=/);
      assert.doesNotMatch(html, shell === "powershell" ? /printf/ : /Write-Output/);
    }
  }
  const separate = pairedCommand.replace("\n\n```powershell", "\n\nA different example.\n\n```powershell");
  assert.equal((renderMarkdown(separate).match(/<pre /g) ?? []).length, 2);
  assert.doesNotMatch(renderMarkdown("```powershell manual\nWrite-Output example\n```"), /data-open-terminal/);
});

test("Windows route renders, validates and quotes the PowerShell alternative without changing progress", async (t) => {
  const windowsContent = structuredClone(content);
  windowsContent.paths[0].stages.understand.markdown = pairedCommand;
  const store = createStore(await workspaceFor(t), windowsContent);
  const calls = [];
  const entry = await openServer({ content: windowsContent, store, documentId: "windows", platform: "win32",
    openTerminal: async (command) => calls.push(command) });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((done) => entry.server.close(done)); });
  assert.match(await (await fetch(entry.url)).text(), /name="canvas-command-shell" content="powershell"/);
  const before = await store.read("windows");
  const template = "$REPORT_ID={{input.report-id}}\nWrite-Output $REPORT_ID";
  const input = { ...inputFor(before, template, { "report-id": "id'; $(throw 'bad'); #" }), contentVersion: windowsContent.version };
  const call = (body) => fetch(new URL("/api/terminal", entry.url), {
    method: "POST", headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token }, body: JSON.stringify(body),
  });
  assert.equal((await call(input)).status, 200);
  assert.deepEqual(calls, ["$REPORT_ID='id''; $(throw ''bad''); #'\nWrite-Output $REPORT_ID"]);
  assert.equal((await call({ ...input, commandTemplate: templatedShell })).status, 400);
  assert.deepEqual(await store.read("windows"), before);
});

test("terminal route authenticates, validates, reports host errors, and leaves progress unchanged", async (t) => {
  const workspace = await workspaceFor(t);
  const store = createStore(workspace, content);
  const calls = [];
  let fail = false;
  const entry = await openServer({ content, store, documentId: "terminal-test",
    openTerminal: async (command) => { if (fail) throw new Error("host unavailable"); calls.push(command); } });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((done) => entry.server.close(done)); });
  const call = (body, headers = {}) => fetch(new URL("/api/terminal", entry.url), {
    method: "POST", headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token, ...headers }, body: JSON.stringify(body),
  });
  const before = await store.read("terminal-test");
  const input = inputFor(before);
  assert.equal((await call(input, { "X-Canvas-Token": "wrong" })).status, 403);
  assert.equal((await call(input, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await call({ ...input, extra: true })).status, 400);
  assert.equal((await call({ ...input, command: "touch arbitrary" })).status, 400);
  assert.equal((await call({ ...input, revision: 99 })).status, 409);
  assert.deepEqual(calls, []);
  assert.equal((await call(input)).status, 200);
  assert.deepEqual(calls, [shell]);
  assert.deepEqual(await store.read("terminal-test"), before);
  fail = true;
  const failed = await call(input);
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).message, /may already have started/);
});

test("terminal route without a host hook returns an actionable error", async (t) => {
  const store = createStore(await workspaceFor(t), content);
  const entry = await openServer({ content, store, documentId: "no-terminal" });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((done) => entry.server.close(done)); });
  const response = await fetch(new URL("/api/terminal", entry.url), {
    method: "POST", headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token },
    body: JSON.stringify(inputFor(await store.read("no-terminal"))),
  });
  assert.equal(response.status, 501);
  assert.match((await response.json()).message, /Copy the command/);
});
