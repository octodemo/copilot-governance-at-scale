import { test, expect } from "@playwright/test";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";
import { workspaceFor } from "../content-validation/exercise-helpers.mjs";

let entry, store, cleanup, calls, fail, releaseLaunch;
const command = "printf 'Terminal MVP\\n'";
const commandTemplate = 'REPORT_ID={{input.report-id}}\nprintf "%s\\n" "$REPORT_ID"';
const windowsTemplate = '$REPORT_ID={{input.report-id}}\nWrite-Output $REPORT_ID';
test.beforeEach(async ({ page }, testInfo) => {
  cleanup = []; calls = []; fail = false; releaseLaunch = null;
  const content = structuredClone(await loadContent());
  content.paths[0].stages.understand.markdown = "```sh\n" + command + "\n```\n\n```sh profile\n" + commandTemplate + "\n```\n\n```powershell profile\n" + windowsTemplate + "\n```\n\n```json\n{}\n```";
  store = createStore(await workspaceFor({ after: (fn) => cleanup.push(fn) }), content);
  entry = await openServer({ content, store, documentId: "terminal-browser",
    platform: testInfo.title.startsWith("Windows") ? "win32" : "linux",
    discover: async () => ({ profile: null, error: { code: "not-found", message: "No lab account in this fixture." } }),
    checkAuth: async () => ({ status: "ready", account: "octocat", missingScopes: [], message: "GitHub CLI is signed in as @octocat." }),
    openTerminal: async (value) => { if (fail) throw new Error("host unavailable"); calls.push(value); },
  });
  await page.goto(`${entry.url}?path=${content.paths[0].id}&stage=understand`);
});
test.afterEach(async () => {
  entry.server.closeAllConnections();
  await new Promise((done) => entry.server.close(done));
  for (const fn of cleanup) await fn();
});

test("one click runs a command after its required form input and never marks progress", async ({ page }) => {
  const before = await store.read("terminal-browser");
  const launcher = page.getByRole("button", { name: "Open terminal and run", exact: true }).nth(1);
  await expect(page.getByLabel("Report ID")).toBeVisible();
  await expect(launcher.locator("svg.octicon-terminal")).toHaveAttribute("aria-hidden", "true");
  await page.getByLabel("Report ID").fill("report-123");
  await launcher.click();
  await expect.poll(() => calls).toEqual(["REPORT_ID='report-123'\nprintf \"%s\\n\" \"$REPORT_ID\""]);
  await expect(page.locator("#terminal-dialog")).toHaveCount(0);
  await expect(launcher).toBeEnabled();
  expect(calls).toEqual(["REPORT_ID='report-123'\nprintf \"%s\\n\" \"$REPORT_ID\""]);
  expect(await store.read("terminal-browser")).toEqual(before);
});

test("required command input is validated before a terminal can open", async ({ page }) => {
  const launcher = page.getByRole("button", { name: "Open terminal and run", exact: true }).nth(1);
  await launcher.click();
  await expect(page.getByLabel("Report ID")).toBeFocused();
  expect(calls).toEqual([]);
});

test("host failures stay visible without a popup or automatic retry", async ({ page }) => {
  fail = true;
  const launcher = page.getByRole("button", { name: "Open terminal and run", exact: true }).nth(1);
  await page.getByLabel("Report ID").fill("report-123");
  await launcher.click();
  await expect(page.locator("#error")).toContainText("may already have started");
  await expect(launcher).toBeEnabled();
  await expect(page.locator("#terminal-dialog")).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("rapid clicks cannot launch the same command twice while opening", async ({ page }) => {
  await page.route("**/api/terminal", async (route) => {
    await new Promise((resolve) => { releaseLaunch = resolve; });
    await route.continue();
  });
  const launcher = page.getByRole("button", { name: "Open terminal and run", exact: true }).first();
  await launcher.evaluate((button) => { button.click(); button.click(); });
  await expect(launcher).toBeDisabled();
  await expect.poll(() => typeof releaseLaunch).toBe("function");
  releaseLaunch();
  await expect.poll(() => calls).toEqual([command]);
  await expect(launcher).toBeEnabled();
});

test("Windows selects and launches only the PowerShell alternative with literal participant input", async ({ page }) => {
  const before = await store.read("terminal-browser");
  await expect(page.getByLabel("Report ID")).toHaveCount(1);
  const code = page.locator("code.language-powershell");
  await expect(code).toHaveText(windowsTemplate);
  await expect(page.locator("code").filter({ hasText: 'printf "%s' })).toHaveCount(0);
  const value = "report'; $(throw 'bad'); #";
  await page.getByLabel("Report ID").fill(value);
  await page.getByRole("button", { name: "Open terminal and run", exact: true }).nth(1).click();
  await expect.poll(() => calls).toEqual(["$REPORT_ID='report''; $(throw ''bad''); #'\nWrite-Output $REPORT_ID"]);
  expect(await store.read("terminal-browser")).toEqual(before);
});

test("Windows rejects a forged Bash alternative instead of translating arbitrary text", async ({ page }) => {
  await expect(page.getByLabel("Report ID")).toBeVisible();
  const status = await page.evaluate(async (commandTemplate) => {
    const token = document.querySelector('meta[name="canvas-token"]').content;
    const { content, state } = await (await fetch("/api/bootstrap", { headers: { "X-Canvas-Token": token } })).json();
    return (await fetch("/api/terminal", {
      method: "POST",
      headers: { "X-Canvas-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ commandTemplate, inputs: { "report-id": "123" }, contentVersion: content.version, revision: state.revision }),
    })).status;
  }, commandTemplate);
  expect(status).toBe(400);
  expect(calls).toEqual([]);
});

for (const width of [320, 390]) {
  test(`launcher fits ${width}px in light and dark modes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const mode of ["light", "dark"]) {
      await page.locator("body").evaluate((body, mode) => body.setAttribute("data-color-mode", mode), mode);
      const launcher = page.getByRole("button", { name: "Open terminal and run", exact: true }).first();
      await expect(launcher).toBeVisible();
      const box = await launcher.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await launcher.focus();
      await expect(launcher).toBeFocused();
    }
  });
}
