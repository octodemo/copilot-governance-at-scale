import { test, expect } from "@playwright/test";
import { access, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { configurationChecklist, configurationRoute, totalConfigurationSteps } from "../../.github/extensions/governance-lab/ui/model.js";
import { FIXTURE_ROOT } from "./fixtures/workshop.mjs";

// Behaviour tests run against test-owned fixture content so authored workshop edits cannot break them.
const content = await loadContent({ root: FIXTURE_ROOT });
const block = (id) => content.paths.find((item) => item.id === id);
const ALPHA = block("alpha-block"), BETA = block("beta-block"), GAMMA = block("gamma-block");
const VARIANT_DECISION = "AL-01";
const VARIANT_RECIPE = ALPHA.recipes.find((recipe) => recipe.id === "alpha-lab");
const VARIANT_VALIDATION = ALPHA.validations.find((item) => item.exerciseId === VARIANT_RECIPE.exerciseId);
const variantSteps = (recipe, option) => (recipe.variants.find((item) => item.optionId === option).sections.Steps.match(/^\d+\. /gm) ?? []).length;
const fenceCount = (variant) => (variant.sections.Steps.match(/^```sh profile$/gm) ?? []).length;
const answered = (path, overrides = {}) => ({
  decisions: Object.fromEntries(path.decisions.map((decision) => [decision.id, overrides[decision.id] ?? decision.options.find((option) => !option.deferred).id])),
  exercises: {},
});
const checklist = (path, overrides) => configurationChecklist(path, answered(path, overrides));
let entry, workspace;
async function startPreview(root = FIXTURE_ROOT, { dev = false } = {}) {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL("./preview.mjs", import.meta.url)), workspace, ...(root ? [root] : []),
    ...(dev ? ["--dev"] : []),
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "", errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk; });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Preview startup timed out: ${errors}`)), 10000);
      const fail = (error) => { clearTimeout(timer); reject(error); };
      child.once("error", fail);
      child.once("exit", (code) => fail(new Error(`Preview exited (${code}): ${errors}`)));
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    return { child, url };
  } catch (error) { await stopPreview({ child }); throw error; }
}
async function stopPreview(current) {
  if (!current || current.child.exitCode !== null || current.child.signalCode !== null) return;
  await new Promise((resolve) => { current.child.once("exit", resolve); current.child.kill(); });
}
test.beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "governance-browser-"));
  entry = await startPreview();
});
test.afterEach(async () => {
  await stopPreview(entry);
  if (workspace) await rm(workspace, { recursive: true, force: true });
});
async function disk() {
  const file = join(workspace, "files/governance-workshop/preview.json");
  await expect.poll(async () => {
    try { await access(file); return true; }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
  }).toBe(true);
  return JSON.parse(await readFile(file, "utf8"));
}
async function chooseAll(page, id, overrides = {}) {
  const path = content.paths.find((item) => item.id === id);
  await page.goto(`${entry.url}?path=${id}`);
  for (const [index, decision] of path.decisions.entries()) {
    await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", decision.id);
    const choice = overrides[decision.id] ?? decision.options.find((option) => !option.deferred).id;
    await page.locator(`input[name="decision"][value="${choice}"]`).check();
    await page.getByRole("button", { name: index === path.decisions.length - 1 ? "Start configuration" : "Next decision", exact: true }).click();
  }
  await expect(page).toHaveURL(/stage=configure/);
  const exercise = path.recipes.find((recipe) => recipe.kind === "exercise");
  if (exercise) await page.goto(`${entry.url}?path=${id}&stage=configure&exercise=${exercise.exerciseId}`);
}

test("variant exercises render only the selected variant in Configure and Verify", async ({ page }) => {
  async function answer(decision, option) {
    await page.goto(`${entry.url}?path=${ALPHA.id}&decision=${decision}`);
    await page.locator(`input[name="decision"][value="${option}"]`).check();
    await expect.poll(async () => (await disk()).paths[ALPHA.id].decisions[decision]).toBe(option);
  }
  const configureStep = (option) => variantSteps(VARIANT_RECIPE, option);
  const verifyBlocks = (option) => VARIANT_VALIDATION.variants.find((item) => item.optionId === option);
  await answer(VARIANT_DECISION, "one");
  await answer("AL-02", "strict");
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=configure&exercise=${VARIANT_RECIPE.exerciseId}`);
  const card = page.locator(`[data-exercise-id="${VARIANT_RECIPE.exerciseId}"]`);
  await expect(card).toContainText("Fixture single-scope configure step");
  await expect(card).not.toContainText("Fixture many-scope configure step");
  await expect(card.locator(".config-steps")).toHaveCount(1);
  await expect(card.locator(".config-steps ol > li")).toHaveCount(configureStep("one"));
  await expect(card.locator("aside.notice")).toHaveCount(0);
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify&exercise=${VARIANT_RECIPE.exerciseId}`);
  await expect(page.locator("#main pre")).toHaveCount(fenceCount(verifyBlocks("one")));
  await expect(page.locator("#main")).toContainText("/orgs/YOUR-TEST-ORG/fixture-reports");
  await expect(page.locator("#main")).toContainText("Fixture single-scope expected result");

  await answer(VARIANT_DECISION, "many");
  await answer("AL-02", "open");
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=configure&exercise=${VARIANT_RECIPE.exerciseId}`);
  await expect(card).toContainText("Fixture many-scope configure step");
  await expect(card).not.toContainText("Fixture single-scope configure step");
  await expect(card.locator(".config-steps")).toHaveCount(1);
  await expect(card.locator("aside.notice")).toContainText("Fixture many-open warning prose");
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify&exercise=${VARIANT_RECIPE.exerciseId}`);
  await expect(page.locator("#main pre")).toHaveCount(fenceCount(verifyBlocks("many")));
  await expect(page.locator("#main pre").first()).toContainText("/enterprises/YOUR-TEST-ENTERPRISE/fixture-reports");
  await expect(page.locator("#main pre").first()).not.toContainText("/orgs/");
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify`);
  await expect(page.locator("#main")).not.toContainText("Confirm the fixture alpha audit");
});
test("profile commands use saved profile scopes only in Verify", async ({ page }) => {
  await page.goto(entry.url);
  await page.locator("#profile-open").click();
  await page.getByLabel("Enterprise slug", { exact: true }).fill("Lab-Enterprise");
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("Lab-Enterprise");
  await page.getByLabel("Organization slug", { exact: true }).fill("Lab-Org");
  await expect.poll(async () => (await disk()).profile.organizationSlug).toBe("Lab-Org");
  await page.getByRole("button", { name: "Close enterprise profile" }).click();
  for (const [option, expected] of [["one", "/orgs/Lab-Org/fixture-reports"], ["many", "/enterprises/Lab-Enterprise/fixture-reports"]]) {
    await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: option });
    await page.goto(`${entry.url}${configurationRoute(ALPHA.id, `recipe:${VARIANT_RECIPE.id}`)}`);
    await expect(page.locator("[data-config-step]")).toHaveAttribute("data-config-step", `recipe:${VARIANT_RECIPE.id}`);
    await expect(page.locator("#main pre")).toHaveCount(0);
    await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify&exercise=${VARIANT_RECIPE.exerciseId}`);
    const commands = page.locator("#main pre");
    await expect(commands.first()).toContainText(expected);
    for (const command of await commands.allTextContents()) {
      expect(command).not.toMatch(/\$(?:ENTERPRISE|ORG)\b|\{\{|YOUR-TEST-/);
    }
  }
});

async function openStep(page, pathId, stepId) {
  await page.goto(`${entry.url}${configurationRoute(pathId, stepId)}`);
  await expect(page.locator("[data-config-step]")).toHaveAttribute("data-config-step", stepId);
}
async function configure(page, id) {
  const path = content.paths.find((item) => item.id === id);
  const exerciseId = await page.locator("[data-exercise-id]").getAttribute("data-exercise-id");
  const recipe = path.recipes.find((item) => item.exerciseId === exerciseId);
  await page.locator(".steps").getByRole("link", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/stage=verify/);
  await page.goto(`${entry.url}?path=${id}&stage=verify&exercise=${recipe.exerciseId}`);
  return recipe;
}
async function verify(page) {
  await expect(page.locator('[name^="field:"]')).toHaveCount(0);
  await expect(page.getByLabel("Verification evidence", { exact: true })).toHaveCount(0);
  await page.locator("[data-verify-done]").click();
  const next = page.locator("#navigation-next");
  if (await next.textContent() === "View summary") await next.click();
  else await page.getByRole("link", { name: "Governance Summary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Governance Summary", exact: true })).toBeVisible();
}

test("late automatic profile detection refreshes visible verification commands without moving focus", async ({ page }) => {
  await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: "one" });
  let release;
  const responseReady = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/profile/discover", async (route) => {
    await responseReady;
    await route.fulfill({ json: { profile: { enterpriseSlug: "Late-Enterprise", organizationSlug: "Late-Org" } } });
  });
  await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify&exercise=${VARIANT_RECIPE.exerciseId}`);
  const command = page.locator("#main pre").first();
  await expect(command).toContainText("/orgs/YOUR-TEST-ORG/");
  const done = page.locator("[data-verify-done]");
  await done.focus();
  release();
  await expect(command).toContainText("/orgs/Late-Org/fixture-reports");
  await expect(done).toBeFocused();
  await expect.poll(async () => (await disk()).profile.organizationSlug).toBe("Late-Org");
});

test("block actions use Primer buttons and resume only blocks with a saved answer", async ({ page }) => {
  await page.goto(entry.url);
  await expect(page.locator(".journey-action.btn")).toHaveCount(content.paths.length);
  await expect(page.locator(".journey-mark")).toHaveCount(0);
  expect(await page.locator(".journey-action").allTextContents()).toEqual(content.paths.map(() => "Start"));
  await page.locator("a.journey").filter({ hasText: ALPHA.title }).click();
  await expect(page.locator("[data-understand-id]")).toBeVisible();
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  const card = page.locator("a.journey").filter({ hasText: ALPHA.title });
  await expect(card.locator(".journey-action")).toHaveText("Start");
  await expect(card.locator(".journey-action")).toHaveClass(/btn-primary/);
  await card.click();
  await page.getByRole("link", { name: "Start decisions", exact: true }).click();
  await page.locator('input[value="review"]').check();
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  await expect(card.locator(".journey-action")).toHaveText("Resume");
  await expect(card.locator(".journey-action")).toHaveClass(/journey-resume/);
  await expect(page.locator(".journey-action").filter({ hasText: /^Start$/ })).toHaveCount(content.paths.length - 1);
  await page.reload();
  await expect(card.locator(".journey-action")).toHaveText("Resume");
  await card.locator(".journey-action").click();
  await expect(page.locator("[data-decision-id]")).toBeVisible();
});

test("enterprise profile autosaves per document and is omitted from exports", async ({ page }) => {
  await page.goto(entry.url);
  const trigger = page.getByRole("button", { name: "Configure enterprise profile", exact: true });
  const panel = page.getByRole("dialog", { name: "Enterprise profile" });
  await expect(panel).toBeHidden();
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Enterprise slug", { exact: true })).toBeFocused();
  await page.getByLabel("Enterprise slug", { exact: true }).fill("Private-Enterprise");
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("Private-Enterprise");
  await page.getByLabel("Organization slug", { exact: true }).fill("Private-Organization");
  await expect.poll(async () => (await disk()).profile.organizationSlug).toBe("Private-Organization");
  await expect(page.getByLabel("Repository name", { exact: true })).toHaveValue("pets-workshop");
  await page.getByLabel("Repository name", { exact: true }).fill("Private-Repository");
  await expect.poll(async () => (await disk()).profile.repositoryName).toBe("Private-Repository");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("#profile-summary")).toContainText("Your Enterprise: Private-Enterprise");
  await expect(page.locator("#profile-summary")).toContainText("Your Organization: Private-Organization");
  await expect(page.getByRole("link", { name: "Your Repository: Private-Repository", exact: true })).toHaveAttribute("href", "https://github.com/Private-Organization/Private-Repository");

  await trigger.click();
  await expect(page.getByLabel("Enterprise slug", { exact: true })).toHaveValue("Private-Enterprise");
  await expect(page.getByLabel("Organization slug", { exact: true })).toHaveValue("Private-Organization");
  await page.getByRole("button", { name: "Close enterprise profile" }).click();
  await expect(panel).toBeHidden();
  let detections = 0;
  await page.route("**/api/profile/discover", () => { detections++; });
  await page.reload();
  await expect(page.locator("#profile-summary")).toContainText("Private-Enterprise");
  await expect(trigger).toBeVisible();
  expect(detections).toBe(0);
  await page.getByRole("link", { name: "Governance Summary", exact: true }).click();

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const jsonDownload = await jsonDownloadPromise;
  const json = await readFile(await jsonDownload.path(), "utf8");
  expect(json).not.toContain("Private-Enterprise");
  expect(json).not.toContain("Private-Organization");
  expect(json).not.toContain("Private-Repository");

  const markdownDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown", exact: true }).click();
  const markdownDownload = await markdownDownloadPromise;
  const markdown = await readFile(await markdownDownload.path(), "utf8");
  expect(markdown).not.toContain("Private-Enterprise");
  expect(markdown).not.toContain("Private-Organization");
  expect(markdown).not.toContain("Private-Repository");
});

test("enterprise profile panel offers GitHub CLI detections and keeps manual entry", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/profile/discover", async (route) => {
    if (route.request().postDataJSON().automatic) {
      await route.fulfill({ json: { profile: null, error: { code: "not-found", message: "No matching enterprise." } } });
      return;
    }
    calls++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-canvas-token"]).toBeTruthy();
    await route.fulfill({ json: {
      account: "octocat", source: "stored",
      enterprises: { items: [], error: { code: "forbidden", message: "GitHub reports that listing enterprises requires the read:enterprise scope." } },
      organizations: { items: [{ slug: "octo-org", name: "Octo <Org>" }, { slug: "second-org", name: "second-org" }] },
    } });
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(entry.url);
  await page.getByRole("button", { name: "Configure enterprise profile", exact: true }).click();
  await page.getByRole("button", { name: "Detect enterprises and organizations", exact: true }).click();
  await expect(page.locator("#profile-discovery-status")).toContainText("Found 0 enterprises and 2 organizations for @octocat");
  expect(calls).toBe(1);
  await expect(page.locator('[data-profile-detected="enterpriseSlug"]')).toContainText("read:enterprise");
  const picker = page.getByLabel("Detected organizations (2)");
  await expect(picker.locator("option")).toHaveText(["Choose a detected organization…", "Octo <Org> (octo-org)", "second-org"]);
  await expect(picker).toHaveClass(/form-select/);
  await picker.selectOption("octo-org");
  await expect(page.getByLabel("Organization slug", { exact: true })).toHaveValue("octo-org");
  await expect.poll(async () => (await disk()).profile.organizationSlug).toBe("octo-org");
  await page.getByLabel("Enterprise slug", { exact: true }).fill("manual-enterprise");
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("manual-enterprise");
  const panel = page.getByRole("dialog", { name: "Enterprise profile" });
  const box = await panel.boundingBox();
  expect(box.width).toBeLessThanOrEqual(320);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByLabel("Enterprise slug", { exact: true }).fill("not valid");
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await expect(page.locator("#profile-error")).toBeVisible();
  await page.getByLabel("Enterprise slug", { exact: true }).fill("manual-enterprise");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("lab profile loads automatically, survives navigation and reload, and links both matching slugs", async ({ page }) => {
  let release, calls = 0;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/profile/discover", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ automatic: true });
    await ready;
    await route.fulfill({ json: { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" } } });
  });
  await page.goto(entry.url);
  await expect(page.locator("#profile-summary")).toContainText("Your Enterprise: Loading...");
  await expect(page.locator("#profile-summary")).toContainText("Your Organization: Loading...");
  await expect(page.locator("#profile-open")).toBeHidden();
  await page.locator("a.journey").filter({ hasText: ALPHA.title }).click();
  await page.getByRole("link", { name: "Start decisions", exact: true }).click();
  const question = page.locator("[data-decision-id]");
  const questionId = await question.getAttribute("data-decision-id");
  const answer = page.locator('input[name="decision"]').first();
  await answer.check();
  await answer.focus();
  release();
  await expect.poll(async () => (await disk()).profile).toEqual({
    enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76",
    repositoryName: "pets-workshop",
  });
  await expect(answer).toBeChecked();
  await expect(answer).toBeFocused();
  await expect(question).toHaveAttribute("data-decision-id", questionId);
  await expect(page.locator("#profile-open")).toBeHidden();
  const links = page.locator("#profile-summary a");
  await expect(links).toHaveCount(3);
  for (const [index, name] of ["globe", "organization", "repo"].entries()) {
    await expect(links.nth(index).locator(`svg.octicon-${name}`)).toHaveAttribute("aria-hidden", "true");
    await expect(links.nth(index).locator(".profile-value")).not.toBeEmpty();
  }
  await expect(links.nth(0)).toHaveText("Your Enterprise: ghuniverse1874-ea76");
  await expect(links.nth(1)).toHaveText("Your Organization: ghuniverse1874-ea76");
  await expect(links.nth(0)).toHaveClass("profile-label");
  await expect(links.nth(1)).toHaveClass("profile-label");
  await links.nth(0).focus();
  await expect(links.nth(0)).toBeFocused();
  await expect(links.nth(0)).toHaveAttribute("href", "https://github.com/enterprises/ghuniverse1874-ea76");
  await expect(links.nth(1)).toHaveAttribute("href", "https://github.com/ghuniverse1874-ea76");
  await expect(links.nth(2)).toHaveAttribute("href", "https://github.com/ghuniverse1874-ea76/pets-workshop");
  for (const width of [1280, 390, 320]) for (const tone of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(links.nth(0)).toBeVisible();
    await expect(links.nth(1)).toBeVisible();
    if (width === 1280) {
      const lines = await page.locator("#profile-summary p").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
      expect(lines[0]).toBe(lines[1]);
      await expect(page.locator("#profile-summary")).toHaveCSS("font-size", "12px");
      await expect(page.locator(".enterprise-profile")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(page.locator(".enterprise-profile")).toHaveCSS("border-top-width", "0px");
    }
  }
  await page.reload();
  await expect(links.nth(0)).toHaveText("Your Enterprise: ghuniverse1874-ea76");
  await expect(page.locator("#profile-open")).toBeHidden();
  await page.goto(entry.url);
  await expect(page.locator("#profile-open")).toBeVisible();
  const open = await page.locator("#profile-open").boundingBox(), summary = await page.locator("#profile-summary").boundingBox();
  expect(open.y).toBeGreaterThanOrEqual(summary.y + summary.height);
  expect(calls).toBe(1);
});

test("first open offers GitHub CLI sign-in and detects enterprise, organization, and repository after sign-in", async ({ page }) => {
  let status = { status: "signed-out", account: null, missingScopes: ["admin:enterprise", "admin:org"], message: "GitHub CLI is not signed in to github.com." };
  const signIns = [];
  let discoveries = 0;
  await page.route("**/api/auth/status", (route) => route.fulfill({ json: status }));
  await page.route("**/api/auth/sign-in", (route) => { signIns.push(route.request().postDataJSON()); return route.fulfill({ json: { opened: true } }); });
  await page.route("**/api/profile/discover", (route) => {
    discoveries++;
    return route.fulfill({ json: { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76", repositoryName: "pets-workshop" }, notices: [] } });
  });
  await page.clock.install();
  await page.goto(entry.url);
  const signIn = page.getByRole("button", { name: "Log into CLI", exact: true });
  await expect(signIn).toBeVisible();
  await expect(page.locator("#profile-signin")).toContainText("admin:enterprise");
  await expect(page.locator("#profile-summary")).toContainText("Your Enterprise: Sign-in required");
  await expect(page.locator("#profile-open")).toBeVisible();
  expect(discoveries).toBe(0);
  await signIn.click();
  expect(signIns).toEqual([{ mode: "login" }]);
  await expect(page.locator("#profile-signin")).toContainText("Waiting for sign-in");
  await page.clock.runFor(4500);
  expect(discoveries).toBe(0);
  status = { status: "ready", account: "lab-admin", missingScopes: [], message: "GitHub CLI is signed in as @lab-admin." };
  await page.clock.runFor(4500);
  await expect.poll(async () => (await disk()).profile).toEqual({
    enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76", repositoryName: "pets-workshop",
  });
  await expect(page.locator("#profile-signin")).toBeHidden();
  await expect(page.locator("#profile-summary a").nth(0)).toHaveText("Your Enterprise: ghuniverse1874-ea76");
  expect(discoveries).toBe(1);
});

test("failed sign-in checks and missing lab enterprises still offer the green Log into CLI button", async ({ page }) => {
  await page.route("**/api/auth/status", (route) => route.fulfill({ status: 500, json: { message: "Status unavailable." } }));
  await page.goto(entry.url);
  const login = page.getByRole("button", { name: "Log into CLI", exact: true });
  await expect(login).toBeVisible();
  await expect(login).toHaveClass(/btn-primary/);
  await page.unroute("**/api/auth/status");
  await page.route("**/api/auth/status", (route) => route.fulfill({ json: { status: "ready", account: "octocat", missingScopes: [], message: "GitHub CLI is signed in as @octocat." } }));
  await page.route("**/api/profile/discover", (route) => route.fulfill({ json: { profile: null, error: { code: "not-found", message: "No enterprise matching ghuniverse1874- was found for this GitHub CLI account." } } }));
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  await expect(page.locator("#profile-detection-error")).toContainText("No enterprise matching");
  await expect(login).toBeVisible();
  await expect(login).toHaveClass(/btn-primary/);
  await expect(page.locator(".enterprise-profile")).not.toContainText("If this is not your lab account");
  const configure = page.getByRole("button", { name: "Configure enterprise profile", exact: true });
  const [loginBox, configureBox, summaryBox] = await Promise.all([login.boundingBox(), configure.boundingBox(), page.locator("#profile-summary").boundingBox()]);
  expect(loginBox.y).toBe(configureBox.y);
  expect(loginBox.x).toBeLessThan(configureBox.x);
  expect(loginBox.y).toBeGreaterThanOrEqual(summaryBox.y + summaryBox.height);
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  await expect(page.locator("#profile-detection-error")).toContainText("No enterprise matching");
  await expect(login).toBeHidden();
  await expect(configure).toBeHidden();
});

test("signed-in accounts without admin scopes are offered a scope refresh", async ({ page }) => {
  const signIns = [];
  await page.route("**/api/auth/status", (route) => route.fulfill({ json: {
    status: "missing-scopes", account: "octocat", missingScopes: ["admin:enterprise"], message: "GitHub CLI is signed in as @octocat without the admin:enterprise scope.",
  } }));
  await page.route("**/api/auth/sign-in", (route) => { signIns.push(route.request().postDataJSON()); return route.fulfill({ status: 502, json: { message: "Could not confirm that the terminal opened: host unavailable." } }); });
  await page.goto(entry.url);
  await expect(page.locator("#profile-signin")).toContainText("@octocat without the admin:enterprise scope");
  await expect(page.getByRole("button", { name: "Use a different account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Grant admin scopes", exact: true }).click();
  expect(signIns).toEqual([{ mode: "refresh" }]);
  await expect(page.locator("#profile-signin")).toContainText("host unavailable");
});

for (const failure of [
  { code: "not-found", message: "No enterprise matching ghuniverse1874- was found." },
  { code: "ambiguous", message: "Multiple enterprises match ghuniverse1874-." },
  { code: "forbidden", message: "GitHub CLI's token cannot list enterprises." },
]) test(`automatic profile ${failure.code} exposes manual configuration on the overview only`, async ({ page }) => {
  await page.route("**/api/profile/discover", (route) => route.fulfill({ json: { profile: null, error: failure } }));
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  await expect(page.locator("#profile-detection-error")).toHaveText(failure.message);
  await expect(page.locator("#profile-summary")).toContainText("Not configured");
  await expect(page.getByRole("button", { name: "Configure enterprise profile", exact: true })).toBeHidden();
  await expect(page.locator("#profile-signin-actions")).toBeHidden();
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  await expect(page).not.toHaveURL(/path=/);
  await page.getByRole("button", { name: "Configure enterprise profile", exact: true }).click();
  await page.getByLabel("Enterprise slug", { exact: true }).fill("manual-enterprise");
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("manual-enterprise");
  await expect(page.locator("#profile-detection-error")).toBeVisible();
  await expect(page.locator("#profile-detection-error")).toHaveText(failure.message);
  await page.getByLabel("Organization slug", { exact: true }).fill("manual-org");
  await expect.poll(async () => (await disk()).profile.organizationSlug).toBe("manual-org");
  await expect(page.locator("#profile-detection-error")).toBeHidden();
  await expect(page.locator("#profile-detection-error")).toBeEmpty();
  await page.keyboard.press("Escape");
  await expect(page.locator("#profile-panel")).toBeHidden();
  await expect.poll(async () => (await disk()).profile).toEqual({ enterpriseSlug: "manual-enterprise", organizationSlug: "manual-org", repositoryName: "pets-workshop" });
  await expect(page.locator("#profile-summary a").nth(1)).toHaveAttribute("href", "https://github.com/manual-org");
  await expect(page.locator("#profile-detection-error")).toBeHidden();
});

test("failed automatic profile save shows fallback and retains the detected values for retry", async ({ page }) => {
  await page.route("**/api/profile/discover", (route) => route.fulfill({
    json: { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" } },
  }));
  await page.route("**/api/profile", (route) => route.fulfill({ status: 409, json: { message: "Revision changed. Reload saved progress." } }));
  await page.goto(entry.url);
  await expect(page.locator("#profile-detection-error")).toContainText("could not be saved");
  await expect(page.locator("#error")).toContainText("Revision changed");
  await page.locator("#profile-open").click();
  await expect(page.getByLabel("Enterprise slug", { exact: true })).toHaveValue("ghuniverse1874-ea76");
  await expect(page.getByLabel("Organization slug", { exact: true })).toHaveValue("ghuniverse1874-ea76");
  await expect(page.locator("#profile-detection-error")).toBeVisible();
  await page.unroute("**/api/profile");
  await page.keyboard.press("Escape");
  await expect(page.locator("#profile-panel")).toBeHidden();
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("ghuniverse1874-ea76");
  await expect(page.locator("#profile-detection-error")).toBeHidden();
});

test("automatic detection does not overwrite an existing incomplete profile", async ({ page }) => {
  await page.goto(entry.url);
  await page.locator("#profile-open").click();
  await page.getByLabel("Enterprise slug", { exact: true }).fill("existing-enterprise");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await disk()).profile.enterpriseSlug).toBe("existing-enterprise");
  await page.route("**/api/profile/discover", (route) => route.fulfill({
    json: { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" } },
  }));
  await page.reload();
  await expect(page.locator("#profile-detection-error")).toContainText("existing profile was kept");
  expect((await disk()).profile).toEqual({ enterpriseSlug: "existing-enterprise", organizationSlug: "", repositoryName: "pets-workshop" });
});

test("block progress separates answered decisions from personal steps and fits both themes", async ({ page }, testInfo) => {
  await page.goto(entry.url);
  const card = page.locator("a.journey").filter({ hasText: ALPHA.title });
  await expect(card.getByRole("progressbar", { name: "Decision taken", exact: true })).toHaveAttribute("value", "0");
  await chooseAll(page, ALPHA.id);
  await page.getByRole("button", { name: "Mark as done", exact: true }).click();
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  const decisions = card.getByRole("progressbar", { name: "Decision taken", exact: true });
  const steps = card.getByRole("progressbar", { name: "Configurations applied", exact: true });
  await expect(decisions).toHaveAttribute("value", String(ALPHA.decisions.length));
  await expect(decisions).toHaveAttribute("max", String(ALPHA.decisions.length));
  await expect(steps).toHaveAttribute("value", "1");
  await expect(steps).toHaveAttribute("max", String(totalConfigurationSteps(ALPHA)));
  await expect(steps).toHaveAttribute("aria-valuetext", /personal markers, not applied configuration/);
  for (const width of [1280, 390, 320]) for (const tone of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const meters = await card.locator(".journey-meters > span").evaluateAll((items) => items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width };
    }));
    expect(meters[0].y).toBe(meters[1].y);
    expect(meters[1].x).toBeGreaterThan(meters[0].x + meters[0].width);
    const start = page.locator(".journey-action.btn-primary").first();
    const color = await start.evaluate((element) => getComputedStyle(element).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
    expect(color[1]).toBeGreaterThan(color[0]);
    expect(color[1]).toBeGreaterThan(color[2]);
    await page.screenshot({ path: testInfo.outputPath(`blocks-${width}-${tone}.png`), animations: "disabled" });
  }
  await page.reload();
  await expect(steps).toHaveAttribute("value", "1");
});

test("every block introduction opens without saving progress or showing author approvals", async ({ page }) => {
  const writes = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/progress")) writes.push(request.postData()); });
  for (const path of content.paths) {
    await page.goto(entry.url);
    await page.locator("a.journey").filter({ hasText: path.title }).click();
    await expect(page.locator("[data-understand-id]")).toHaveAttribute("data-understand-id", path.id);
    await expect(page.getByRole("heading", { name: path.title, exact: true, level: 2 })).toBeVisible();
    await expect(page.locator("#main form, #main input, #main textarea, #main select")).toHaveCount(0);
    const status = page.locator("#status");
    await expect(status).toHaveText("");
    await expect(status).not.toHaveAttribute("hidden");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(page.locator("#main")).not.toContainText("human-approved");
    await page.getByRole("link", { name: "Start decisions", exact: true }).click();
    await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", path.decisions[0].id);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page.locator("[data-understand-id]")).toBeVisible();
    await page.locator(".steps").getByRole("link", { name: "Configure" }).click();
    await expect(page.getByRole("heading", { name: "Decisions remain", exact: true })).toBeVisible();
    await page.locator(".steps").getByRole("link", { name: "Decide" }).click();
    await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", path.decisions[0].id);
  }
  expect(writes).toEqual([]);
});

for (const path of content.paths.filter((item) => item.recipes.some((recipe) => recipe.kind === "exercise"))) {
  test(`${path.title}: selections, separate configuration/validation, reload and exports`, async ({ page }) => {
    await chooseAll(page, path.id);
    const recipe = await configure(page, path.id);
    await expect(page.locator("[data-verify-done]")).toHaveAttribute("aria-pressed", "false");
    await verify(page, path.id, recipe);
    await expect(page.getByRole("heading", { name: "Governance Summary", exact: true })).toBeVisible();
    await expect(page.locator("#main")).toContainText("Personal verification checklist");
    await page.reload();
    await expect(page.locator("#main")).toContainText("Personal task markers only, not evidence-backed verification.");
    const state = await disk();
    expect(state.version).toBe(11);
    expect(state.checklist.some((item) => item.pathId === path.id && item.stepId === `verify:${recipe.exerciseId}` && item.done)).toBe(true);
    expect(state.paths[path.id].exercises[recipe.exerciseId].verified).toBe(false);
    for (const other of content.paths.filter((item) => item.id !== path.id)) {
      expect(Object.values(state.paths[other.id].decisions).every((value) => value === null)).toBe(true);
    }
    for (const format of ["JSON", "Markdown"]) {
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: `Export ${format}`, exact: true }).click();
      const file = await downloaded;
      const text = await readFile(await file.path(), "utf8");
      if (format === "JSON") expect(JSON.parse(text).state.checklist.some((item) => item.stepId === `verify:${recipe.exerciseId}` && item.done)).toBe(true);
      else expect(text).toContain("Personal verification checklist");
    }
  });
}

test("verify previews exercises read-only while decisions remain unanswered", async ({ page }) => {
  await page.goto(`${entry.url}?path=${GAMMA.id}&stage=verify`);
  await expect(page.getByRole("heading", { name: "Decisions remain", exact: true })).toBeVisible();
  const validation = GAMMA.validations[0];
  const preview = page.locator(`[data-preview-exercise-id="${validation.exerciseId}"]`);
  await expect(preview.getByRole("heading", { name: validation.title, exact: true })).toBeVisible();
  await expect(preview).toContainText("Preview only");
  await expect(page.locator("[data-exercise-id], #workflow-form, input[name=verified]")).toHaveCount(0);
});

test("Verify introduction leads to applicable exercises without claiming completion", async ({ page }) => {
  await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: "one", "AL-02": "strict" });
  await page.locator(".steps").getByRole("link", { name: "Verify", exact: true }).click();
  await expect(page.locator("[data-verify-introduction]")).toContainText("Fixture alpha verification introduction.");
  await expect(page.locator("[data-verify-done]")).toHaveCount(0);
  await page.getByRole("link", { name: "Start verification", exact: true }).click();
  const [first] = ALPHA.validations;
  await expect(page.locator(`[data-exercise-id="${first.exerciseId}"]`)).toBeVisible();
  await expect(page.locator("#main")).not.toContainText("Fixture alpha verification introduction.");
  const checks = [[first.exerciseId, "Fixture single-scope verify step"], ["AL-AUDIT", "Fixture audit verify step"]];
  for (const [exerciseId, instruction] of checks) {
    await page.goto(`${entry.url}?path=${ALPHA.id}&stage=verify&exercise=${exerciseId}`);
    const card = page.locator(`[data-exercise-id="${exerciseId}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator("ol").first()).toContainText(instruction);
    await expect(card.locator("[data-verify-done]")).toHaveAttribute("aria-pressed", "false");
    await expect(card.locator("[data-verify-done]")).toBeEnabled();
    await expect(card.locator("#evidence")).toHaveCount(0);
  }
  await page.locator("[data-verify-done]").click();
  await expect.poll(async () => (await disk()).checklist.some((item) => item.stepId === "verify:AL-AUDIT" && item.done)).toBe(true);
  await page.reload();
  await expect(page.locator("[data-verify-done]")).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${entry.url}?path=${ALPHA.id}&decision=AL-02`);
  await page.locator('input[name="decision"][value="open"]').check();
  await page.locator(".steps").getByRole("link", { name: "Verify", exact: true }).click();
  await expect(page.locator('a[href*="exercise=AL-AUDIT"]')).toHaveCount(0);
  const state = await disk();
  expect(state.paths[ALPHA.id].decisions["AL-02"]).toBe("open");
  expect(Object.values(state.paths[ALPHA.id].exercises).every((record) => !record.verified && !record.evidence)).toBe(true);
});

test("guidance-only blocks complete decisions without an exercise or completion claim", async ({ page }) => {
  await chooseAll(page, BETA.id, { "BE-01": "auto" });
  await openStep(page, BETA.id, "recipe:beta-shared-setup");
  await expect(page.getByRole("heading", { name: "No applicable exercises", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-recipe-id]").first()).not.toContainText("Guidance only");
  await expect(page.locator("[data-exercise-id], #configuration")).toHaveCount(0);
  const card = page.locator('[data-recipe-id="beta-shared-setup"]');
  await expect(card.locator(".config-decision")).toContainText("Fixture automatic preset");
  await expect(card.getByRole("heading", { name: "Prepare the fixture preset file", exact: true })).toBeVisible();
  await expect(card.locator(".config-api")).toHaveCount(0);
  await expect(card.locator(".config-meta")).not.toContainText(/API available|No API Available|API not recorded/);
  await expect(card.locator(".config-steps")).toBeVisible();
  await expect(card.locator(".config-docs a").first()).toBeVisible();
  await expect(page.locator("[data-config-step]")).toHaveCount(1);
  const overview = page.getByRole("navigation", { name: "Configuration steps", exact: true });
  const tasks = checklist(BETA, { "BE-01": "auto" });
  await expect(overview.locator("a")).toHaveCount(tasks.length);
  await expect(page.locator(".config-counts")).toHaveText(`0 of ${tasks.length} done`);
  await expect(page.locator("#main")).not.toContainText("0 applicable exercises");
  for (const step of BETA.stages.configure.additionalSteps) await expect(overview.getByRole("link", { name: new RegExp(step.title) })).toBeVisible();
  for (const width of [320, 390]) for (const tone of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((tone) => document.documentElement.setAttribute("data-theme-tone", tone), tone);
    await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("Decide and Configure share panel styling and a single responsive progress summary", async ({ page }, testInfo) => {
  await chooseAll(page, ALPHA.id);
  const decision = ALPHA.decisions.find((item) => item.id === VARIANT_DECISION);
  const tasks = checklist(ALPHA);
  for (const [width, tone] of [[1280, "light"], [1280, "dark"], [390, "light"], [320, "dark"]]) {
    await page.setViewportSize({ width, height: 900 });
    const headings = [];
    for (const stage of ["decide", "configure"]) {
      await page.goto(stage === "decide" ? `${entry.url}?path=${ALPHA.id}&decision=${decision.id}` :
        `${entry.url}${configurationRoute(ALPHA.id, tasks[0].id)}`);
      await expect(page.locator(".workflow-card")).toHaveCount(1);
      if (stage === "decide") {
        await expect(page.locator(".decision-heading-title")).toHaveText(decision.title);
        await expect(page.locator(".decision-heading h2")).toHaveText("Which fictional scope should the alpha block use?");
        await expect(page.getByRole("heading", { name: "Which fictional scope should the alpha block use?", exact: true })).toBeVisible();
        const guidance = page.getByRole("region", { name: "Decision guidance", exact: true });
        await expect(guidance.getByRole("heading", { name: "What you are deciding", exact: true })).toHaveCount(0);
        expect(await guidance.evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, border: style.borderTopWidth, padding: style.padding };
        })).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px", padding: "0px" });
      }
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
      await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
      await expect(page.locator(".toolbar, .decision-progress")).toHaveCount(0);
      await expect(page.locator("#status")).toHaveText("");
      await expect(page.locator("#status")).not.toHaveAttribute("hidden");
      await expect(page.locator(".stage-counts")).toHaveCount(1);
      await expect(page.locator(".privacy")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Local progress only.");
      const meter = page.locator(".stage-counts progress");
      await expect(meter).toHaveAttribute("value", stage === "decide" ? String(ALPHA.decisions.length) : "0");
      await expect(meter).toHaveAttribute("max", String(stage === "decide" ? ALPHA.decisions.length : tasks.length));
      expect(await page.locator(".stage-counts").evaluate((element) =>
        Boolean(element.previousElementSibling?.matches("nav")))).toBe(true);
      await expect(page.locator(".workshop-location")).toHaveText(ALPHA.title);
      headings.push(await page.locator(".workflow-heading").evaluate((element) => {
        const heading = getComputedStyle(element), title = getComputedStyle(element.querySelector("h2"));
        return { background: heading.backgroundColor, padding: heading.padding, border: heading.borderBottom,
          font: title.fontSize, weight: title.fontWeight };
      }));
      if (width < 960) {
        await expect(page.locator(".stage-counts")).toBeHidden();
        await page.locator(".item-browser > summary").click();
      }
      await expect(page.locator(".stage-counts")).toBeVisible();
      await expect(page.locator(".stage-counts")).toHaveText(stage === "decide" ?
        `${ALPHA.decisions.length} / ${ALPHA.decisions.length} answered` : `0 of ${tasks.length} done`);
      if (width < 960) await page.locator(".item-browser > summary").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${stage}-${width}-${tone}.png`), animations: "disabled" });
    }
    expect(headings[0]).toMatchObject({ background: headings[1].background, padding: headings[1].padding, border: headings[1].border });
    expect(Number.parseFloat(headings[0].font)).toBeGreaterThan(Number.parseFloat(headings[1].font));
  }
});

test("Summary is a temporary detour that restores the current question after reload and browser history", async ({ page }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}&decision=AL-02`);
  const origin = page.url();
  await page.locator('input[value="strict"]').check();
  await page.getByRole("link", { name: "Governance Summary", exact: true }).click();
  await expect(page).toHaveURL(/\?view=summary$/);
  await expect(page.locator("#workshop-navigation")).toContainText("Workshop summary");
  const returnLink = page.getByRole("link", { name: "Return to workshop", exact: true });
  await expect(returnLink).toHaveAttribute("href", new URL(origin).pathname + new URL(origin).search);
  await expect(page.locator("#main")).toContainText("Fixture strict review");
  await page.reload();
  await returnLink.click();
  await expect(page).toHaveURL(origin);
  await expect(page.locator('input[value="strict"]')).toBeChecked();
  await expect(page.locator("#workshop-summary")).toBeFocused();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Governance Summary", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(origin);
  await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", "AL-02");
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  await expect(page.locator(".journeys")).toBeVisible();
});

test("Summary preserves the exact configuration step, scroll and return focus", async ({ page }) => {
  await chooseAll(page, ALPHA.id);
  await expect(page.locator(`[data-exercise-id="${VARIANT_RECIPE.exerciseId}"]`)).toBeVisible();
  await expect(page.locator("#workshop-summary")).toBeVisible();
  const origin = page.url();
  await page.evaluate(() => {
    window.scrollTo(0, 400);
    document.querySelector("#workshop-summary").focus({ preventScroll: true });
  });
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?view=summary$/);
  await page.getByRole("link", { name: "Return to workshop", exact: true }).click();
  await expect(page).toHaveURL(origin);
  await expect(page.locator("#workshop-summary")).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test("Summary restores focus to the bottom View summary link", async ({ page }) => {
  await chooseAll(page, GAMMA.id);
  await configure(page, GAMMA.id);
  await verify(page);
  await page.reload();
  await page.getByRole("link", { name: "Return to workshop", exact: true }).click();
  await expect(page.locator("#navigation-next")).toBeFocused();
  await expect(page.locator("#navigation-next")).toHaveRole("link");

  await page.goto(`${entry.url}?path=${BETA.id}&stage=verify`);
  const summaryLink = page.locator("#navigation-next");
  await expect(summaryLink).toHaveRole("link");
  await expect(summaryLink).toHaveText("View summary");
  await summaryLink.click();
  await page.reload();
  await page.getByRole("link", { name: "Return to workshop", exact: true }).click();
  await expect(page.locator("#navigation-next")).toBeFocused();
  await expect(page.locator("#navigation-next")).toHaveRole("link");
});

test("workshop navigation fits both themes and narrow panels, with a safe direct-summary fallback", async ({ page }, testInfo) => {
  for (const [width, tone] of [[1280, "light"], [390, "dark"], [320, "light"]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${entry.url}?path=${ALPHA.id}&decision=AL-02`);
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    const navigation = page.getByRole("navigation", { name: "Workshop", exact: true });
    await expect(navigation.locator(".workshop-location")).toHaveText(ALPHA.title);
    await expect(navigation.locator("a.btn")).toHaveCount(2);
    await expect(page.locator(".stage-title")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}-${tone}.png`), animations: "disabled" });
    await navigation.getByRole("link", { name: "Governance Summary", exact: true }).click();
    await expect(navigation.getByRole("link", { name: "Return to workshop", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto(entry.url);
  await expect(page.getByRole("link", { name: "Back to blocks", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Governance Summary", exact: true })).toBeVisible();
  await page.goto(`${entry.url}?view=summary`);
  await expect(page.getByRole("link", { name: "Return to workshop", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to blocks", exact: true }).click();
  await expect(page.locator(".journeys")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to blocks", exact: true })).toHaveCount(0);
});

test("navigation to Summary and blocks preserves failed Verify markers until a successful retry", async ({ page }) => {
  await chooseAll(page, GAMMA.id);
  await configure(page, GAMMA.id);
  const origin = page.url();
  let fail = true;
  await page.route("**/api/progress", (route) => fail ?
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Navigation save unavailable" }) }) : route.continue());
  await page.locator("[data-verify-done]").click();
  for (const name of ["Governance Summary", "Back to blocks"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.locator("#error")).toContainText("Navigation save unavailable");
    await expect(page).toHaveURL(origin);
    await expect(page.locator("[data-verify-done]")).toHaveAttribute("aria-pressed", "true");
  }
  fail = false;
  await page.getByRole("link", { name: "Governance Summary", exact: true }).click();
  await expect(page).toHaveURL(/\?view=summary$/);
  await expect(page.locator("#main")).toContainText("Personal verification checklist");
  expect((await disk()).checklist.some((item) => item.stepId === `verify:${GAMMA.validations[0].exerciseId}` && item.done)).toBe(true);
});

for (const preset of ["auto", "specific"]) test(`preset ${preset} shows shared setup and only its own example`, async ({ page }) => {
  await chooseAll(page, BETA.id, { "BE-01": preset });
  const example = `beta-${preset}-example`;
  const other = preset === "auto" ? "beta-specific-example" : "beta-auto-example";
  const overview = page.getByRole("navigation", { name: "Configuration steps", exact: true });
  await expect(overview.locator("a").first()).toBeAttached();
  const steps = await overview.locator("a").evaluateAll((items) => items.map((item) => decodeURIComponent(item.getAttribute("href"))));
  expect(steps.some((href) => href.includes("recipe:beta-shared-setup"))).toBe(true);
  expect(steps.some((href) => href.includes(`recipe:${example}`))).toBe(true);
  expect(steps.some((href) => href.includes(`recipe:${other}`))).toBe(false);
  await openStep(page, BETA.id, "recipe:beta-shared-setup");
  await expect(page.locator('[data-recipe-id="beta-shared-setup"]')).toContainText("Fixture shared setup step");
  await openStep(page, BETA.id, `recipe:${example}`);
  const card = page.locator(`[data-recipe-id="${example}"]`);
  if (preset === "auto") {
    await expect(card.locator("pre")).toContainText('"overridable": "fixture-balance"');
    await expect(card.locator("code.language-json .syntax-key").first()).toHaveText('"model"');
  } else {
    await expect(card.locator("pre")).toContainText("FIXTURE_SPECIFIC_MODEL_ID");
  }
  for (const tone of ["light", "dark"]) {
    await page.evaluate((tone) => document.documentElement.setAttribute("data-theme-tone", tone), tone);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await card.locator("pre").first().evaluate((element) => {
      const code = element.querySelector("code");
      return getComputedStyle(element).overflowX === "auto" && getComputedStyle(code).backgroundColor === "rgba(0, 0, 0, 0)";
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const preset of ["review", "none"]) test(`additional steps remain visible when the decision selects no recipe (${preset})`, async ({ page }) => {
  await chooseAll(page, BETA.id, { "BE-01": preset });
  const main = page.locator("#main");
  const [first, second] = BETA.stages.configure.additionalSteps;
  await expect(page.getByRole("navigation", { name: "Configuration steps", exact: true }).locator("a")).toHaveCount(BETA.stages.configure.additionalSteps.length);
  await expect(main).toContainText(first.title);
  await expect(main).toContainText(second.title);
  await expect(main.locator(".config-card")).toHaveCount(1);
  await expect(main.locator(".config-independent")).toBeVisible();
  await expect(main.getByRole("heading", { name: "No applicable exercises", exact: true })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Fixture beta baseline documentation", exact: true })).toBeVisible();
  await expect(main.locator("[data-recipe-id], [data-exercise-id], #configuration")).toHaveCount(0);
  await page.getByRole("link", { name: "Next step", exact: true }).click();
  await expect(main).toContainText("Fixture beta baseline two step.");
  await page.reload();
  await expect(main).toContainText(first.title);
  await expect(main).toContainText(second.title);
});

test("configuration cards persist Done separately and compare alternatives without writes", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await chooseAll(page, ALPHA.id);
  await openStep(page, ALPHA.id, "recipe:alpha-strict-guidance");
  const total = checklist(ALPHA).length;
  const card = page.locator('[data-recipe-id="alpha-strict-guidance"]');
  const done = card.locator("[data-checklist]");
  await expect(card.locator(".config-heading [data-checklist]")).toHaveCount(1);
  await expect(card.locator("[data-checklist]")).toHaveCount(1);
  await expect(done).toHaveText("Mark as done");
  await expect(done).toHaveClass(/btn-primary/);
  const readyColor = await done.evaluate((button) => getComputedStyle(button).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
  expect(readyColor[1]).toBeGreaterThan(readyColor[0]);
  expect(readyColor[1]).toBeGreaterThan(readyColor[2]);
  await expect(card.locator("[data-step-done-status]")).toBeHidden();
  await expect(card.locator(".config-decision [data-compare-toggle]")).toHaveCount(1);
  await expect(card.locator(".config-decision #comparison-panel")).toHaveCount(1);
  await expect(card.locator(".config-toolbar [data-compare-toggle]")).toHaveCount(0);
  expect(await card.locator(":scope > .config-instructions, :scope > .config-decision, :scope > .config-meta")
    .evaluateAll((sections) => sections.map((section) => section.className))).toEqual(["config-instructions", "config-decision", "config-meta"]);
  await expect(card).not.toContainText("Personal checklist only");
  await expect(done).not.toHaveAttribute("aria-describedby", /config-completion-help/);
  const indentation = await card.locator(".config-steps > ol").evaluate((list) => ({
    padding: parseFloat(getComputedStyle(list).paddingInlineStart),
    itemOffset: list.firstElementChild.getBoundingClientRect().left - list.closest(".config-instructions").getBoundingClientRect().left,
  }));
  expect(indentation.padding).toBe(40);
  expect(indentation.itemOffset).toBeGreaterThanOrEqual(40);
  await expect(page.locator("#comparison-panel")).toBeHidden();
  await expect(card.locator(".config-docs a").first()).toBeVisible();
  await done.evaluate((button) => button.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: testInfo.outputPath("configure-progress-1280-light.png"), animations: "disabled" });
  await done.click();
  await expect.poll(async () => (await disk()).checklist.some((item) => item.stepId === "recipe:alpha-strict-guidance" && item.done)).toBe(true);
  await expect(done).toBeFocused();
  await expect(done).toHaveAttribute("aria-pressed", "true");
  await expect(done).toHaveText("Undo");
  await expect(done).toHaveClass(/btn-danger/);
  await expect(card).toHaveClass(/is-done/);
  await expect(card.locator("[data-step-done-status]")).toBeVisible();
  await expect(card.locator("[data-step-done-status]")).toHaveText("Done");
  await expect(page.locator(".config-counts")).toHaveText(`1 of ${total} done`);
  await expect(page.locator(".stage-counts progress")).toHaveAttribute("value", "1");
  await page.reload();
  await expect(done).toHaveAttribute("aria-pressed", "true");
  for (const [width, tone] of [[1280, "light"], [390, "dark"], [320, "light"]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((value) => {
      document.documentElement.setAttribute("data-theme-tone", value);
      window.scrollTo(0, 0);
    }, tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const position = await done.evaluate((button) => {
      const bounds = button.getBoundingClientRect(), heading = button.closest(".config-heading");
      const container = heading.getBoundingClientRect(), style = getComputedStyle(heading);
      return {
        height: bounds.height,
        top: bounds.top - container.top - parseFloat(style.paddingTop),
        right: container.right - parseFloat(style.paddingRight) - bounds.right,
      };
    });
    expect(position.height).toBeLessThanOrEqual(32);
    expect(Math.abs(position.top)).toBeLessThan(1);
    expect(Math.abs(position.right)).toBeLessThan(1);
    const completedColor = await done.evaluate((button) => getComputedStyle(button).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
    expect(completedColor[0]).toBeGreaterThan(completedColor[1]);
    expect(completedColor[0]).toBeGreaterThan(completedColor[2]);
    await expect(card.locator("[data-step-done-status]")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`configure-${width}-${tone}.png`), animations: "disabled" });
  }
  const before = await disk(), writes = [];
  page.on("request", (request) => { if (request.url().endsWith("/api/progress")) writes.push(request.postData()); });
  await page.getByRole("button", { name: "Compare answers", exact: true }).click();
  await page.locator('[data-compare-answer][value="open"]').check();
  const preview = page.locator("#comparison-preview");
  await expect(preview).toContainText("Fixture open step one.");
  await expect(page.locator("#comparison-panel")).toContainText("Read-only preview");
  await expect(preview.locator("input, textarea, select, button")).toHaveCount(0);
  await expect(card).toContainText("Fixture strict review");
  await expect(done).toHaveAttribute("aria-pressed", "true");
  expect(await disk()).toEqual(before);
  expect(writes).toEqual([]);
  for (const [width, tone] of [[1280, "light"], [390, "dark"]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#main [style]:not([style=""])')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`compare-${width}-${tone}.png`), animations: "disabled" });
  }
  await page.getByRole("button", { name: "Close comparison" }).click();
  await expect(page.getByRole("button", { name: "Compare answers", exact: true })).toBeFocused();
  await expect(card.locator(":scope > .config-meta .config-docs a").first()).toBeVisible();
  await page.goto(`${entry.url}?view=summary`);
  await expect(page.locator("#main")).toContainText(`Personal configuration checklist · 1 / ${total} done`);
  expect(errors).toEqual([]);
});

test("Reference hides API availability for available, unavailable, and unrecorded metadata", async ({ page }) => {
  const url = "https://docs.github.com/en/rest/copilot/copilot-user-management";
  let api = { available: true, url };
  await page.route("**/api/bootstrap", async (route) => {
    const response = await route.fetch(), bootstrap = await response.json();
    bootstrap.content.paths.find((path) => path.id === ALPHA.id).recipes
      .find((recipe) => recipe.id === "alpha-strict-guidance").api = api;
    await route.fulfill({ response, json: bootstrap });
  });
  await chooseAll(page, ALPHA.id);
  await openStep(page, ALPHA.id, "recipe:alpha-strict-guidance");
  const reference = page.locator(".config-card > .config-meta");
  for (const value of [api, { available: false, url: null }, null]) {
    api = value;
    await page.reload();
    await expect(reference).toBeVisible();
    await expect(reference.locator(".config-api, .api-available, .api-unavailable")).toHaveCount(0);
    await expect(reference).not.toContainText(/API available|No API Available|API not recorded|API availability/);
    await expect(reference.locator(".config-docs a").first()).toBeVisible();
  }
});

test("numbered configuration overview and shortcuts traverse every selected step in authored order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await chooseAll(page, ALPHA.id);
  const tasks = checklist(ALPHA);
  const overview = page.getByRole("navigation", { name: "Configuration steps", exact: true });
  await expect(overview.locator(".config-browser-number")).toHaveCount(tasks.length);
  const links = await overview.getByRole("link").evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  expect(await overview.locator(".config-browser-number").allTextContents()).toEqual(tasks.map((_, index) => String(index + 1)));
  await overview.getByRole("link").first().click();
  for (const [index, href] of links.entries()) {
    await expect(page.locator("[data-config-step]")).toHaveCount(1);
    await expect(page.locator(".config-step-number")).toHaveText(String(index + 1));
    await expect(overview.locator('[aria-current="page"]')).toHaveAttribute("href", href);
    if (tasks[index].id.startsWith("additional:")) {
      await expect(page.locator(".config-independent")).toBeVisible();
      await expect(page.locator("[data-compare-toggle], #workflow-form")).toHaveCount(0);
    }
    await page.getByRole("link", { name: index < links.length - 1 ? "Next step" : "Continue to validation", exact: true }).click();
  }
  await expect(page).toHaveURL(/stage=verify/);
  await page.locator(".steps").getByRole("link", { name: "Configure", exact: true }).click();
  await overview.getByRole("link").last().click();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.locator(".config-step-number")).toHaveText(String(tasks.length - 1));
  const stepId = await page.locator("[data-config-step]").getAttribute("data-config-step");
  const done = page.getByRole("button", { name: "Mark as done", exact: true });
  await done.focus();
  await page.keyboard.press("Space");
  await expect(done).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeFocused();
  await expect(page.locator(".config-counts")).toHaveText(`1 of ${tasks.length} done`);
  await expect.poll(async () => (await disk()).checklist.some((item) => item.stepId === stepId && item.done)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("comparison selects the alternate exercise variant without writes", async ({ page }) => {
  await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: "one" });
  const card = page.locator(`[data-exercise-id="${VARIANT_RECIPE.exerciseId}"]`);
  await expect(card).toBeVisible();
  const before = await disk();
  await page.getByRole("button", { name: "Compare answers", exact: true }).click();
  await page.locator('[data-compare-answer][value="many"]').check();
  await expect(page.locator("#comparison-preview")).toContainText("Fixture many-scope configure step");
  await expect(card).toContainText("Fixture single-scope configure step");
  expect(await disk()).toEqual(before);
  await card.locator("[data-checklist]").click();
  await expect.poll(async () => (await disk()).checklist.some((item) => item.stepId === `recipe:${VARIANT_RECIPE.id}` && item.done)).toBe(true);
});

test("failed Done saves retain the toggle, block navigation, and retry without losing progress", async ({ page }) => {
  await chooseAll(page, ALPHA.id);
  const [step, nextStep] = checklist(ALPHA);
  await openStep(page, ALPHA.id, step.id);
  let fail = true;
  await page.route("**/api/progress", (route) => fail ?
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Checklist save unavailable" }) }) :
    route.continue());
  const done = page.locator(`[data-config-step="${step.id}"] [data-checklist]`);
  await done.click();
  await expect(page.locator("#error")).toContainText("Checklist save unavailable");
  await expect(done).toHaveAttribute("aria-pressed", "true");
  const next = page.getByRole("link", { name: "Next step", exact: true });
  await next.click();
  await expect(page).toHaveURL(/stage=configure/);
  await expect(done).toHaveAttribute("aria-pressed", "true");
  fail = false;
  await next.click();
  await expect(page.locator("[data-config-step]")).toHaveAttribute("data-config-step", nextStep.id);
  expect((await disk()).checklist.some((item) => item.stepId === step.id && item.done)).toBe(true);
  await openStep(page, ALPHA.id, step.id);
  await done.click();
  await expect.poll(async () => (await disk()).checklist.find((item) => item.stepId === step.id)?.done).toBe(false);
});

test("rapid Done toggles preserve the latest intent while a save is in flight", async ({ page }) => {
  await chooseAll(page, ALPHA.id);
  const [step] = checklist(ALPHA);
  await openStep(page, ALPHA.id, step.id);
  let release, intercepted;
  const waiting = new Promise((done) => { intercepted = done; });
  await page.route("**/api/progress", async (route) => {
    if (route.request().postDataJSON().operation === "checklist" && !release) {
      await new Promise((done) => { release = done; intercepted(); });
    }
    await route.continue();
  });
  const done = page.locator(`[data-config-step="${step.id}"] [data-checklist]`);
  await done.click();
  await waiting;
  await expect(done).toHaveText("Undo");
  await expect(page.locator("[data-step-done-status]")).toBeVisible();
  await done.click();
  await expect(done).toHaveText("Mark as done");
  await expect(page.locator("[data-step-done-status]")).toBeHidden();
  await expect(page.locator(".config-card")).not.toHaveClass(/is-done/);
  release();
  await expect.poll(async () => (await disk()).checklist.find((item) => item.stepId === step.id)?.done).toBe(false);
  await expect(done).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(done).toHaveAttribute("aria-pressed", "false");
});

test("Needs Review yields no exercise, while selected guidance remains informational", async ({ page }) => {
  await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: "review", "AL-02": "open" });
  await expect(page.getByRole("heading", { name: "No applicable exercises", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-recipe-id]").first()).not.toContainText("Guidance only");
  await expect(page.locator("[data-exercise-id], #configuration")).toHaveCount(0);
  await page.locator(".steps").getByRole("link", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No applicable exercises", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View summary", exact: true }).click();
  await expect(page.locator("#main")).toContainText("(unresolved)");
  await expect(page.locator("#main")).not.toContainText("Participant-reported verified");
});

test("configure and verify omit the exercise record, participation, status and notes controls", async ({ page }) => {
  await chooseAll(page, GAMMA.id);
  const recipeId = await page.locator("[data-exercise-id]").getAttribute("data-exercise-id");
  for (const stage of ["configure", "verify"]) {
    await page.goto(`${entry.url}?path=${GAMMA.id}&stage=${stage}&exercise=${recipeId}`);
    for (const label of ["Participation mode", "Configuration status", "Issues encountered", "Follow-up actions"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.locator('#workflow-form, #settingsUrl, #settings-link, [name^="field:"], .exercise-record')).toHaveCount(0);
    await expect(page.locator("#main")).not.toContainText("Exercise record");
  }
  await expect(page.locator("[data-verify-done]")).toBeEnabled();
  await page.locator("[data-verify-done]").click();
  await expect.poll(async () => (await disk()).checklist.some((item) => item.stepId === `verify:${recipeId}` && item.done)).toBe(true);
  expect((await disk()).paths[GAMMA.id].exercises[recipeId].verified).toBe(false);
});

test("decisions autosave without Next and rapid edits preserve focus", async ({ page }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  for (const option of ["review", "one", "many"]) await page.locator(`input[value="${option}"]`).check();
  await expect.poll(async () => (await disk()).paths[ALPHA.id].decisions[VARIANT_DECISION]).toBe("many");
  await expect(page.locator('input[value="many"]')).toBeFocused();
  await page.reload();
  await expect(page.locator('input[value="many"]')).toBeChecked();
});

test("failed autosave retains input and retry persists without advancing", async ({ page }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  let fail = true;
  await page.route("**/api/progress", (route) => fail ?
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Simulated save failure" }) }) : route.continue());
  await page.locator('input[value="one"]').check();
  await expect(page.locator("#error")).toContainText("Simulated save failure");
  await expect(page.locator('input[value="one"]')).toBeChecked();
  await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", VARIANT_DECISION);
  fail = false;
  await page.locator('input[value="many"]').check();
  await expect.poll(async () => (await disk()).paths[ALPHA.id].decisions[VARIANT_DECISION]).toBe("many");
  await page.reload();
  await expect(page.locator('input[value="many"]')).toBeChecked();
});

test("stale saves expose conflict and preserve the second panel draft", async ({ page, context }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  const second = await context.newPage();
  await second.goto(`${entry.url}?path=${ALPHA.id}`);
  await page.locator('input[value="one"]').check();
  await expect.poll(async () => (await disk()).revision).toBe(1);
  await second.locator('input[value="many"]').check();
  await expect(second.locator("#error")).toContainText("another panel");
  await expect(second.locator('input[value="many"]')).toBeChecked();
  expect((await disk()).paths[ALPHA.id].decisions[VARIANT_DECISION]).toBe("one");
  await second.close();
});

test("relevant decision changes retain earlier Verify Done markers as history, not current completion", async ({ page }) => {
  await chooseAll(page, ALPHA.id, { [VARIANT_DECISION]: "one" });
  const recipe = await configure(page, ALPHA.id);
  await verify(page);
  await page.goto(`${entry.url}?path=${ALPHA.id}&decision=${VARIANT_DECISION}`);
  await page.locator('input[value="many"]').check();
  await expect.poll(async () => (await disk()).paths[ALPHA.id].decisions[VARIANT_DECISION]).toBe("many");
  expect((await disk()).paths[ALPHA.id].exercises[recipe.exerciseId].verified).toBe(false);
  await page.goto(`${entry.url}?view=summary`);
  await expect(page.locator("#main")).not.toContainText("Participant-reported verified");
  await page.getByText("Historical records (not counted)", { exact: true }).click();
  await expect(page.locator("#main")).toContainText(`verify:${recipe.exerciseId}`);
});

test("server restart retains saved decisions and document revision", async ({ page }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  await page.locator('input[value="one"]').check();
  await expect.poll(async () => (await disk()).revision).toBe(1);
  await stopPreview(entry);
  entry = await startPreview();
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  await expect(page.locator('input[value="one"]')).toBeChecked();
  expect((await disk()).revision).toBe(1);
});

test("wide screens expand the shared shell without stretching the reading column", async ({ page }, testInfo) => {
  for (const width of [960, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(entry.url);
    const journeys = page.locator(".journeys > a");
    await expect(journeys).toHaveCount(content.paths.length);
    const first = await journeys.nth(0).boundingBox(), second = await journeys.nth(1).boundingBox();
    expect(first.y).toBe(second.y);
    expect(first.x + first.width).toBeLessThan(second.x);
    await journeys.filter({ hasText: ALPHA.title }).click();
    const shell = await page.locator("#main").boundingBox();
    const introduction = await page.locator("[data-understand-id]").boundingBox();
    expect(shell.width).toBe(Math.min(width, 1120));
    expect(introduction.width).toBeGreaterThan(700);
    expect(introduction.width).toBeLessThanOrEqual(800);
    await page.getByRole("link", { name: "Start decisions", exact: true }).click();
    const questions = page.getByRole("navigation", { name: "Decision questions" });
    await expect(questions).toBeVisible();
    const sidebar = await page.locator(".stage-sidebar").boundingBox();
    const card = await page.locator("[data-decision-id]").boundingBox();
    expect(sidebar.x + sidebar.width).toBeLessThan(card.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".navigation-hint")).not.toContainText(/NaN|undefined/);
    await page.screenshot({ path: testInfo.outputPath(`wide-${width}.png`) });
  }
});

test("malformed saved progress surfaces recovery rather than silently resetting", async ({ page }) => {
  await page.goto(`${entry.url}?path=${ALPHA.id}`);
  await page.locator('input[value="one"]').check();
  await expect.poll(async () => (await disk()).revision).toBe(1);
  await writeFile(join(workspace, "files/governance-workshop/preview.json"), "{broken");
  await page.reload();
  await expect(page.locator("#error")).toContainText("Preserve the file");
  expect(await readFile(join(workspace, "files/governance-workshop/preview.json"), "utf8")).toBe("{broken");
});

test("Primer assets, all shared views and keyboard controls fit narrow light/dark layouts", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const tone of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: tone });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 740 });
      for (const path of content.paths) {
        await page.goto(`${entry.url}?path=${path.id}`);
        await page.evaluate((value) => document.body.setAttribute("data-color-mode", value), tone);
        await expect(page.locator("[data-decision-id]")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.locator('input[type="radio"]').first().focus();
        await expect(page.locator('input[type="radio"]').first()).toBeFocused();
        await page.keyboard.press("Space");
        await expect(page.locator('input[type="radio"]').first()).toBeChecked();
        const button = page.getByRole("button", { name: path.decisions.length > 1 ? "Next decision" : "Start configuration", exact: true });
        await expect(button).toBeInViewport();
      }
      await page.screenshot({ path: testInfo.outputPath(`${tone}-${width}.png`) });
    }
  }
  expect((await page.request.get(`${entry.url}primer.css`)).status()).toBe(200);
  expect(pageErrors).toEqual([]);
});

test("route focus does not scroll the newly opened stage to its bottom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  for (const keyboard of [false, true]) {
    const activate = async (link) => {
      if (keyboard) { await link.focus(); await page.keyboard.press("Enter"); }
      else await link.click();
    };
    await page.goto(entry.url);
    await activate(page.locator("a.journey").filter({ hasText: ALPHA.title }));
    await expect(page.locator("[data-understand-id]")).toBeVisible();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator("#main")).toBeFocused();
    await activate(page.getByRole("link", { name: "Start decisions", exact: true }));
    await expect(page.locator("[data-decision-id]")).toBeVisible();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

for (const width of [320, 390, 900]) {
  test(`pointer focus keeps choices under the mouse at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    for (const tone of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: tone });
      await page.goto(`${entry.url}?path=${ALPHA.id}`);
      const input = page.locator('input[type="radio"]').first();
      const position = await input.evaluate((element) => {
        const footer = document.querySelector("#navigation").getBoundingClientRect();
        window.scrollBy(0, element.getBoundingClientRect().bottom - footer.top + 4);
        const bounds = element.getBoundingClientRect();
        return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, scrollY: window.scrollY };
      });
      await page.mouse.move(position.x, position.y);
      expect(await input.evaluate((element) => element.matches(":hover"))).toBe(true);
      await page.mouse.down();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await page.evaluate(() => window.scrollY)).toBe(position.scrollY);
      expect(await input.evaluate((element, { x, y }) => document.elementFromPoint(x, y) === element, position)).toBe(true);
      await page.mouse.up();
      await expect(input).toBeFocused();
      await expect(input).toBeChecked();
    }
  });
}

test("keyboard focus remains visible above fixed navigation in both themes", async ({ page }) => {
  await chooseAll(page, GAMMA.id);
  await configure(page, GAMMA.id);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 640 });
    for (const tone of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
      await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
      await page.locator("[data-verify-done]").focus();
      for (let index = 0; index < 3; index++) {
        await page.keyboard.press("Tab");
        await expect(page.locator('[data-exercise-id="GA-LAB"] a').nth(index)).toBeFocused();
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        const focus = await page.evaluate(() => {
          const element = document.activeElement;
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top, bottom: rect.bottom, outline: getComputedStyle(element).outlineStyle,
            footer: document.querySelector("#navigation").getBoundingClientRect().top,
          };
        });
        expect(focus.outline).not.toBe("none");
        expect(focus.top).toBeGreaterThanOrEqual(0);
        expect(focus.bottom).toBeLessThanOrEqual(focus.footer);
      }
    }
  }
});

for (const delayed of [false, true]) {
  test(`decision text maintains normal-text contrast in both settled themes${delayed ? " with delayed transitions" : ""}`, async ({ page }) => {
    if (delayed) {
      await page.route("**/styles.css", async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}
.btn { transition-duration: 400ms; transition-delay: 150ms; }` });
      });
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${entry.url}?path=${ALPHA.id}`);
    await expect(page.locator("[data-decision-id]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to blocks", exact: true })).toBeVisible();
    await expect(page.locator("#error")).toBeHidden();
    for (const tone of ["light", "dark", "light"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
      await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
      // Theme attributes update before Primer's colors finish transitioning.
      // Measure the settled palette, including when rendering is delayed.
      await page.evaluate(async () => {
        const transitions = document.getAnimations().filter((animation) => animation instanceof CSSTransition);
        await Promise.all(transitions.map((transition) => transition.finished));
      });
      expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation instanceof CSSTransition).length)).toBe(0);
      const contrasts = await page.evaluate(() => {
        const channels = (color) => color.match(/[\d.]+/g).map(Number);
        const luminance = (color) => channels(color).slice(0, 3).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        return [...document.querySelectorAll(".callout, .choice strong, .choice .muted, header a, #navigation .btn")].map((element) => {
          let backgroundElement = element;
          while (backgroundElement.parentElement && channels(getComputedStyle(backgroundElement).backgroundColor)[3] === 0) {
            backgroundElement = backgroundElement.parentElement;
          }
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(getComputedStyle(backgroundElement).backgroundColor);
          return { text: element.textContent, ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
        });
      });
      expect(contrasts.length).toBeGreaterThan(0);
      for (const { text, ratio } of contrasts) expect(ratio, `${tone}: ${text}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test.describe("authored workshop content smoke check", () => {
  // Structure only: counts and titles come from the loaded model, so authored edits never require test changes.
  async function checkWorkshopStructure(page, root = null) {
    const realContent = await loadContent(root ? { root } : undefined);
    await stopPreview(entry);
    entry = await startPreview(root);
    const errors = [], writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().endsWith("/api/progress")) writes.push(request.postData()); });
    await page.goto(entry.url);
    await expect(page.locator(".journeys > a")).toHaveCount(realContent.paths.length);
    for (const path of realContent.paths) {
      await page.goto(`${entry.url}?path=${path.id}&stage=understand`);
      await expect(page.locator("[data-understand-id]")).toHaveAttribute("data-understand-id", path.id);
      if (path.decisions.length) {
        await page.getByRole("link", { name: "Start decisions", exact: true }).click();
        await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", path.decisions[0].id);
        await expect(page.locator('input[name="decision"]')).toHaveCount(path.decisions[0].options.length);
        await page.locator(".steps").getByRole("link", { name: "Configure" }).click();
        await expect(page.getByRole("heading", { name: "Decisions remain", exact: true })).toBeVisible();
      } else {
        await page.getByRole("link", { name: "Continue to Configure", exact: true }).click();
        await expect(page).toHaveURL(/stage=configure/);
        await expect(page.locator("[data-decision-id]")).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Decisions remain", exact: true })).toHaveCount(0);
        const tasks = configurationChecklist(path, { decisions: {}, exercises: {} }, []);
        if (tasks.length) await expect(page.locator("[data-config-step]")).toHaveAttribute("data-config-step", tasks[0].id);
        else await expect(page.getByRole("heading", { name: "No configuration steps selected.", exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  }

  test("every authored block opens Understand, Decide and Configure without errors or saved progress", async ({ page }) => {
    await checkWorkshopStructure(page);
  });

  test("the structural smoke check accepts an empty draft block", async ({ page }) => {
    const root = join(workspace, "empty-draft");
    await cp(FIXTURE_ROOT, root, { recursive: true });
    await writeFile(join(root, "content/gamma-block.md"), `# Empty draft
**Format version:** 1
**Block ID:** gamma-block
**Description:** Fictional empty-stage regression fixture.

## Understand
## Decisions
## Configure
## Validation
`);
    await checkWorkshopStructure(page, root);
  });
});
