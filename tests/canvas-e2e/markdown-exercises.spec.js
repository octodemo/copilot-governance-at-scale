import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkshop, loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { FIXTURE_ROOT } from "./fixtures/workshop.mjs";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";
import { workspaceFor } from "../content-validation/exercise-helpers.mjs";

const content = await loadContent({ root: fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url)) });
const fullContent = await loadContent();
const workshopFixture = await loadContent({ root: FIXTURE_ROOT });
const variantPath = workshopFixture.paths.find((path) =>
  path.recipes.some((recipe) => recipe.variants.length) && path.recipes.some((recipe) => !recipe.variants.length && recipe.warnings.length));
let entry, store, cleanup, workspace;
test.beforeEach(async ({ page }) => {
  cleanup = [];
  await page.route("**/api/profile/discover", (route) => route.fulfill({
    json: { profile: null, error: { code: "not-found", message: "No lab enterprise found in this test preview." } },
  }));
  workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  store = createStore(workspace, content);
  entry = await openServer({ content, store, documentId: "markdown-exercises", log() {} });
  await page.goto(entry.url);
});
test.afterEach(async () => {
  if (entry) {
    entry.server.closeAllConnections();
    await new Promise((done) => entry.server.close(done));
  }
  for (const fn of cleanup) await fn();
});
async function choose(page, decisionId, value) {
  await page.goto(`${entry.url}?path=example-block&decision=${decisionId}`);
  await page.locator(`input[value="${value}"]`).check();
  await expect.poll(async () => (await store.read("markdown-exercises")).paths["example-block"].decisions[decisionId]).toBe(value);
}
test("repository profile defaults, edits links in place, persists across panels, and falls back when blank", async ({ page, context }) => {
  const root = await mkdtemp(join(tmpdir(), "governance-repository-e2e-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url)), root, { recursive: true });
  const source = join(root, "content/example-block.md");
  const original = await readFile(source, "utf8");
  await writeFile(source, original.replace("Read this fictional example.",
    'Read this fictional example.\n\n[Repository Settings](https://example.test/{{organization.slug}}/{{repository.name}}/settings "fallback=https://example.test/organizations")'));
  const linkedContent = await loadContent({ root });
  const linkedStore = createStore(workspace, linkedContent);
  const linked = await openServer({ content: linkedContent, store: linkedStore, documentId: "repository-profile", log() {} });
  cleanup.push(() => { linked.server.closeAllConnections(); return new Promise((done) => linked.server.close(done)); });
  await linkedStore.updateProfile("repository-profile", {
    revision: 0, profile: { enterpriseSlug: "lab-enterprise", organizationSlug: "lab-org" },
  });
  await page.goto(`${linked.url}?path=example-block&stage=understand`);
  const link = page.locator("#main").getByRole("link", { name: "Repository Settings", exact: true });
  await expect(link).toHaveAttribute("href", "https://example.test/lab-org/pets-workshop/settings");
  await page.locator("#profile-open").click();
  const input = page.getByLabel("Repository name", { exact: true });
  await expect(input).toHaveValue("pets-workshop");
  await input.fill("custom.repo_name");
  await expect(link).toHaveAttribute("href", "https://example.test/lab-org/custom.repo_name/settings");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  const second = await context.newPage();
  await second.goto(`${linked.url}?path=example-block&stage=understand`);
  await expect(second.locator("#main").getByRole("link", { name: "Repository Settings", exact: true }))
    .toHaveAttribute("href", "https://example.test/lab-org/custom.repo_name/settings");
  await second.close();
  await page.locator("#profile-open").click();
  await input.fill("");
  await expect(link).toHaveAttribute("href", "https://example.test/organizations");
  await expect(input).toBeFocused();
  await expect.poll(async () => (await linkedStore.read("repository-profile")).profile.repositoryName).toBe("");
});

test("automatic account detection preserves a custom repository in an otherwise blank profile", async ({ page }) => {
  await page.waitForLoadState("networkidle");
  await store.updateProfile("markdown-exercises", {
    revision: 0, profile: { enterpriseSlug: "", organizationSlug: "", repositoryName: "custom.repo_name" },
  });
  await page.route("**/api/profile/discover", (route) => route.fulfill({
    json: { profile: { enterpriseSlug: "lab-enterprise", organizationSlug: "lab-org" } },
  }));
  await page.reload();
  await expect.poll(async () => (await store.read("markdown-exercises")).profile).toEqual({
    enterpriseSlug: "lab-enterprise", organizationSlug: "lab-org", repositoryName: "custom.repo_name",
  });
  await expect(page.locator("#profile-detection-error")).toBeHidden();
  await expect(page.getByRole("link", { name: "Your Repository: custom.repo_name", exact: true }))
    .toHaveAttribute("href", "https://github.com/lab-org/custom.repo_name");
});

test("Markdown fixtures render two exercises, shared guidance and separate validation without record fields", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await choose(page, "EX-01", "mixed"); await choose(page, "EX-02", "ready");
  await page.goto(`${entry.url}?path=example-block&stage=configure`);
  await expect(page.locator('[data-recipe-id="shared-notes"]')).toHaveCount(1);
  await expect(page.locator('[data-recipe-id="shared-notes"]').getByText("Informational guidance, never a completed exercise.")).toBeVisible();
  await expect(page.locator('[data-recipe-id="shared-notes"] .config-docs a').first()).toBeVisible();
  await page.getByText("Browse configuration steps", { exact: true }).click();
  const overview = page.getByRole("navigation", { name: "Configuration steps", exact: true });
  await expect(overview).toBeVisible();
  await expect(overview).toContainText("First example");
  await expect(overview).toContainText("Second example");
  await expect(overview.locator("a")).toHaveCount(3);
  await overview.getByRole("link", { name: /First example/ }).click();
  await expect(page.locator('[data-exercise-id="EX-FIRST"]')).toBeVisible();
  await expect(page.locator('#workflow-form, #settingsUrl, [name^="field:"]')).toHaveCount(0);
  await page.goto(`${entry.url}?path=example-block&stage=verify&exercise=EX-FIRST`);
  const card = page.locator('[data-exercise-id="EX-FIRST"]');
  const done = card.locator(".config-heading [data-verify-done]");
  await expect(card).toHaveClass(/workflow-card/);
  await expect(card.locator('input[name="verified"]')).toHaveCount(0);
  await expect(done).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#evidence")).toHaveCount(0);
  await done.click();
  await expect.poll(async () => (await store.read("markdown-exercises")).checklist.some((item) => item.stepId === "verify:EX-FIRST" && item.done)).toBe(true);
  await expect(card).toHaveClass(/is-done/);
  await expect(done).toHaveText("Undo");
  await expect(page.locator(".verify-counts")).toHaveText("1 of 2 done");
  await expect(done).toBeFocused();
  await done.click();
  await expect.poll(async () => (await store.read("markdown-exercises")).checklist.some((item) => item.stepId === "verify:EX-FIRST" && item.done)).toBe(false);
  await expect(page.locator(".verify-counts")).toHaveText("0 of 2 done");
  await done.click();
  await expect.poll(async () => (await store.read("markdown-exercises")).checklist.some((item) => item.stepId === "verify:EX-FIRST" && item.done)).toBe(true);
  await page.reload();
  await expect(page.locator("[data-verify-done]")).toHaveAttribute("aria-pressed", "true");
  expect((await store.read("markdown-exercises")).paths["example-block"].exercises["EX-FIRST"].verified).toBe(false);
  await page.goto(`${entry.url}?path=example-block&stage=configure&exercise=EX-SECOND`);
  await expect(page.locator("table")).toContainText("alpha");
  await expect(page.locator('#workflow-form, #settingsUrl, [name^="field:"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Continue to validation" }).click();
  await expect(page).toHaveURL(/stage=verify/);
  await expect(page.locator('#workflow-form, [name^="field:"]')).toHaveCount(0);
  await page.goto(`${entry.url}?path=example-block&stage=verify&exercise=EX-SECOND`);
  await page.locator("[data-verify-done]").click();
  await expect.poll(async () => (await store.read("markdown-exercises")).checklist.some((item) => item.stepId === "verify:EX-SECOND" && item.done)).toBe(true);
  await page.goto(`${entry.url}?view=summary`);
  await expect(page.locator("#main")).toContainText("Personal verification checklist · 2 / 2 done");
  await expect(page.locator("#main")).not.toContainText("Participant-reported verified");
});

test("Verify shows the answer-specific validation path for the same exercise", async ({ page }) => {
  const branched = structuredClone(content);
  const path = branched.paths.find((item) => item.id === "example-block");
  const validation = path.validations.find((item) => item.exerciseId === "EX-FIRST");
  validation.variantDecisionId = "EX-01";
  validation.variants = path.decisions.find((item) => item.id === "EX-01").options.filter((option) => !option.deferred).map((option) => ({
    optionId: option.id,
    markdown: `This is the ${option.id} verification introduction.`,
    sections: {
      Steps: `1. Verify the ${option.id} path.`,
      "Expected result": `The ${option.id} result is visible.`,
      Evidence: `Record the ${option.id} result.`,
    },
    source: validation.source,
  }));
  validation.sections = {};

  entry.server.closeAllConnections();
  await new Promise((done) => entry.server.close(done));
  store = createStore(workspace, branched);
  entry = await openServer({ content: branched, store, documentId: "conditional-verification", log() {} });
  await page.goto(entry.url);
  await page.goto(`${entry.url}?path=example-block&stage=verify`);
  const preview = page.locator('[data-preview-exercise-id="EX-FIRST"]');
  await expect(preview).toContainText('Answer "Choose an example" to see the matching verification path.');
  await expect(preview).not.toContainText("Verify the inspect path.");

  const chooseAnswer = async (decisionId, value) => {
    await page.goto(`${entry.url}?path=example-block&decision=${decisionId}`);
    await page.locator(`input[name="decision"][value="${value}"]`).check();
    await expect.poll(async () => (await store.read("conditional-verification")).paths["example-block"].decisions[decisionId]).toBe(value);
  };
  await chooseAnswer("EX-01", "review");
  await page.goto(`${entry.url}?path=example-block&stage=verify`);
  await expect(preview).toContainText('Answer "Choose an example" to see the matching verification path.');
  await chooseAnswer("EX-01", "notes");
  await page.goto(`${entry.url}?path=example-block&stage=verify`);
  await expect(preview).not.toContainText('Answer "Choose an example" to see the matching verification path.');
  await expect(preview).toContainText("This is the notes verification introduction.");
  await expect(preview).toContainText("Verify the notes path.");
  await expect(preview).toContainText("Record the notes result.");

  await chooseAnswer("EX-01", "inspect");
  await chooseAnswer("EX-02", "ready");
  await page.goto(`${entry.url}?path=example-block&stage=verify&exercise=EX-FIRST`);
  const card = page.locator('[data-exercise-id="EX-FIRST"]');
  await expect(card).toContainText("This is the inspect verification introduction.");
  await expect(card).toContainText("Verify the inspect path.");
  await expect(card).toContainText("The inspect result is visible.");
  await expect(card.locator("form")).toHaveCount(0);

  await chooseAnswer("EX-01", "mixed");
  await page.goto(`${entry.url}?path=example-block&stage=verify&exercise=EX-FIRST`);
  await expect(card).toContainText("This is the mixed verification introduction.");
  await expect(card).toContainText("Verify the mixed path.");
  await expect(card).toContainText("The mixed result is visible.");
  await expect(card.locator("form")).toHaveCount(0);
});

test("question browser jumps directly and the stage links remain available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const path = content.paths.find((item) => item.id === "example-block");
  await page.goto(`${entry.url}?path=example-block&decision=EX-01`);
  await expect(page.locator(".stage-counts progress")).toHaveCount(1);
  await expect(page.locator(".steps a")).toHaveCount(4);
  await expect(page.locator(".decision-counts")).toHaveText(`0 / ${path.decisions.length} answered`);
  await page.getByRole("radio", { name: "Two examples" }).check();
  await page.getByText("Browse questions", { exact: true }).click();
  const questionList = page.getByRole("navigation", { name: "Decision questions" });
  await questionList.getByRole("link", { name: new RegExp(path.decisions[1].title) }).click();
  await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", path.decisions[1].id);
  await expect(page.locator(".decision-counts")).toHaveText(`1 / ${path.decisions.length} answered`);
  await expect.poll(async () => (await store.read("markdown-exercises")).paths["example-block"].decisions["EX-01"]).toBe("mixed");
  await page.locator(".steps").getByRole("link", { name: "Verify" }).click();
  await expect(page).toHaveURL(/stage=verify/);
  await expect(page.locator(".steps [aria-current=step]")).toContainText("Verify");
});

test("question browser becomes a left sidebar on wide canvases and resizes without replacing the form", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${entry.url}?path=example-block&decision=EX-01`);
  const browser = page.locator(".stage-sidebar details");
  const toggle = browser.locator("summary");
  const questions = page.getByRole("navigation", { name: "Decision questions" });
  const answer = page.getByRole("radio", { name: "Two examples" });
  await answer.check();
  await expect(page.locator('[data-question-status="EX-01"]')).toHaveText("Answered · Two examples");
  await expect(page.locator('[data-question-status="EX-01"]')).toHaveClass(/is-done/);
  await expect(page.locator('[data-question-status="EX-01"] .ui-icon')).toHaveCount(1);
  await expect(page.locator('[data-question-status="EX-02"] .ui-icon')).toHaveCount(0);
  await expect(answer).toBeFocused();
  const originalForm = await page.locator("#workflow-form").elementHandle();
  for (const tone of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    for (const width of [320, 390, 768, 959, 960, 1280, 1600]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(answer).toBeChecked();
      expect(await originalForm.evaluate((form) => form === document.querySelector("#workflow-form"))).toBe(true);
      await expect(page.locator(".navigation-hint")).toHaveText("Question 1 of 2");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width < 960) {
        await expect(toggle).toBeVisible();
        await expect(questions).toBeHidden();
      } else {
        await expect(toggle).toBeHidden();
        await expect(questions).toBeVisible();
        const sidebar = await page.locator(".stage-sidebar").boundingBox();
        const card = await page.locator(".decision-card").boundingBox();
        expect(sidebar.x + sidebar.width).toBeLessThan(card.x);
        expect(card.width).toBeGreaterThan(580);
        expect(card.width).toBeLessThanOrEqual(800);
      }
    }
  }
  await page.screenshot({ path: testInfo.outputPath("wide-question-sidebar.png") });
  const nextQuestion = questions.locator("a").last();
  await nextQuestion.focus();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(toggle).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(questions.locator('[aria-current="page"]')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(questions).toBeVisible();
  await nextQuestion.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", "EX-02");
  await expect(page.locator(".navigation-hint")).toHaveText("Question 2 of 2");
  expect(errors).toEqual([]);
});

test("sidebar checkmarks update only after a resolved answer is saved, without replacing the form", async ({ page }) => {
  await page.goto(`${entry.url}?path=example-block&decision=EX-01`);
  const form = await page.locator("#workflow-form").elementHandle();
  const status = page.locator('[data-question-status="EX-01"]');
  await page.locator('input[value="mixed"]').check();
  await expect(status).toHaveClass(/is-done/);
  await expect(page.locator(".stage-counts progress")).toHaveAttribute("value", "1");
  await expect(status.locator("svg")).toHaveCount(1);
  await page.locator('input[value="review"]').check();
  await expect(status).toHaveText(/Needs review/);
  await expect(status).not.toHaveClass(/is-done/);
  await expect(page.locator(".stage-counts progress")).toHaveAttribute("value", "0");
  await expect(status.locator("svg")).toHaveCount(0);
  expect(await form.evaluate((element) => element === document.querySelector("#workflow-form"))).toBe(true);
  await expect(page.locator('input[value="review"]')).toBeFocused();
  await page.reload();
  await expect(status.locator("svg")).toHaveCount(0);
});

test("wide exercise navigation stays visible and collapses when resized", async ({ page }) => {
  await choose(page, "EX-01", "mixed");
  await choose(page, "EX-02", "ready");
  await page.goto(`${entry.url}?path=example-block&stage=configure&exercise=EX-FIRST`);
  const exercises = page.getByRole("navigation", { name: "Configuration steps", exact: true });
  await expect(exercises).toBeVisible();
  await expect(page.locator(".stage-sidebar summary")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(exercises).toBeHidden();
  await page.getByText("Browse configuration steps", { exact: true }).click();
  await exercises.getByRole("link", { name: /Second example/ }).click();
  await expect(page.locator("[data-exercise-id]")).toHaveAttribute("data-exercise-id", "EX-SECOND");
});

for (const width of [390, 1280]) {
  test(`question navigation at ${width}px retains input and blocks jumps after a failed save`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${entry.url}?path=example-block&decision=EX-01`);
    let fail = true;
    await page.route("**/api/progress", (route) => fail ?
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Simulated save failure" }) }) :
      route.continue());
    await page.getByRole("radio", { name: "Two examples" }).check();
    await expect(page.locator("#error")).toContainText("Simulated save failure");
    await expect(page.locator("#status")).not.toHaveAttribute("aria-busy", "true");
    if (width < 960) await page.getByText("Browse questions", { exact: true }).click();
    const next = page.getByRole("navigation", { name: "Decision questions" }).locator("a").last();
    const failedNavigationSave = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/api/progress") &&
      response.request().method() === "POST" &&
      response.status() === 503);
    await Promise.all([failedNavigationSave, next.click()]);
    await expect(page.locator("#status")).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", "EX-01");
    await expect(page.getByRole("radio", { name: "Two examples" })).toBeChecked();
    await expect(page.locator(".decision-counts")).toHaveText(`0 / ${content.paths.find((path) => path.id === "example-block").decisions.length} answered`);
    fail = false;
    await next.click();
    await expect(page.locator("[data-decision-id]")).toHaveAttribute("data-decision-id", "EX-02");
    expect((await store.read("markdown-exercises")).paths["example-block"].decisions["EX-01"]).toBe("mixed");
  });
}

test("guidance-only, no-action, deferred and empty blocks never manufacture a completed exercise", async ({ page }) => {
  for (const choice of ["notes", "no-action", "review"]) {
    await choose(page, "EX-01", choice);
    await choose(page, "EX-02", "review");
    await page.goto(`${entry.url}?path=example-block&stage=configure`);
    await expect(page.getByRole("heading", { name: "No applicable exercises" })).toHaveCount(0);
    await expect(page.locator("#main form")).toHaveCount(0);
    await expect(page.locator('[data-recipe-id="shared-notes"]')).toHaveCount(choice === "notes" ? 1 : 0);
    await page.getByRole("link", { name: "Continue to validation" }).click();
    await expect(page.getByRole("heading", { name: "No applicable exercises" })).toBeVisible();
  }
  await page.goto(`${entry.url}?path=empty-block&stage=understand`);
  await expect(page.getByRole("heading", { name: "A normal prose heading" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to Configure" }).click();
  await expect(page.getByRole("heading", { name: "No applicable exercises" })).toHaveCount(0);
  await expect(page.locator("#main")).toContainText("No configuration steps selected.");
  const saved = await store.read("markdown-exercises");
  expect(Object.values(saved.paths).flatMap((path) => Object.values(path.exercises)).every((record) => !record.verified)).toBe(true);
});

test("narrow light/dark views retain readable steps without overflow or unsafe inline styles", async ({ page }) => {
  await choose(page, "EX-01", "mixed");
  for (const width of [320, 390]) for (const tone of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${entry.url}?path=example-block&stage=configure&exercise=EX-SECOND`);
    await page.evaluate((tone) => document.documentElement.setAttribute("data-theme-tone", tone), tone);
    await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#main [style]")).toHaveCount(0);
    const done = page.locator("[data-checklist]").first();
    await done.focus();
    await expect(done).toBeFocused();
  }
});

test("participant mode hides all developer controls and ignores a dev URL flag", async ({ page }) => {
  await page.goto(`${entry.url}?path=example-block&stage=understand&dev=true`);
  await expect(page.locator("#main")).not.toBeEmpty();
  await expect(page.locator("#dev-reset")).toBeHidden();
  await expect(page.locator("#dev-controls")).toBeHidden();
  await expect(page.locator("#dev-toggle")).toBeHidden();
  await expect(page.locator("#dev-save-state")).toBeHidden();
  await expect(page.locator("#dev-restore-state")).toBeHidden();
  await expect(page.locator("#reload")).toBeHidden();
  await expect(page.locator("#pick-source")).toBeHidden();
  await expect(page.locator("#review-all-variants")).toBeHidden();
  await expect(page.locator("[data-source-file]")).toHaveCount(0);
  await expect(page.locator("#prompt-dialog, #state-dialog")).toHaveCount(0);
  await expect(page.locator("#picker-hint")).toBeHidden();
  await expect(page.locator("#batch")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-dev/);
});

test("developer review shows all configurations and validation variants with provenance", async ({ page }) => {
  const reviewStore = createStore(workspace, workshopFixture);
  const review = await openServer({ content: workshopFixture, store: reviewStore, documentId: "all-variants", dev: true, log() {} });
  cleanup.push(() => {
    review.server.closeAllConnections();
    return new Promise((done) => review.server.close(done));
  });
  const path = variantPath;
  await page.goto(`${review.url}?path=${path.id}&stage=configure`);
  const trigger = page.getByRole("button", { name: "Review all variants", exact: true });
  await expect(trigger).toBeVisible();
  const before = await reviewStore.read("all-variants");
  await trigger.click();
  await expect(page.getByRole("heading", { name: "All configurations and validation paths" })).toBeVisible();
  const configurationCount = path.recipes.reduce((count, recipe) => count + (recipe.variants?.length || 1), 0) +
    (path.stages.configure.conclusion ? 1 : 0) + path.stages.configure.additionalSteps.length;
  await expect(page.locator("[data-review-configuration]")).toHaveCount(configurationCount);
  const validationCount = path.validations.reduce((count, validation) => count + (validation.variants?.length || 1), 0);
  await expect(page.locator("[data-review-validation]")).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  const configTab = page.getByRole("tab", { name: "Config", exact: true });
  const validationTab = page.getByRole("tab", { name: "Validation", exact: true });
  const reviewBrowser = page.getByRole("navigation", { name: "All review paths", exact: true });
  await expect(configTab).toHaveAttribute("aria-selected", "true");
  await expect(reviewBrowser.getByRole("link")).toHaveCount(configurationCount);
  const unvariedRecipes = path.recipes.filter((recipe) => !recipe.variants?.length);
  await expect(page.locator("[data-review-warning]")).toHaveCount(unvariedRecipes.reduce((count, recipe) => count + recipe.warnings.length, 0));
  const expectedVariantCount = path.recipes.reduce((count, recipe) => count + (recipe.variants?.length ?? 0), 0);
  await expect(page.locator("[data-review-variant]")).toHaveCount(expectedVariantCount);

  for (const recipe of path.recipes.filter((item) => item.variants?.length)) {
    const decision = path.decisions.find((item) => item.id === recipe.variantDecisionId);
    for (const variant of recipe.variants) {
      const option = decision.options.find((item) => item.id === variant.optionId);
      const card = page.locator(`[data-review-configuration="${recipe.id}"][data-review-variant="${variant.optionId}"]`);
      await expect(card.locator(".dev-review-provenance")).toContainText(decision.title);
      await expect(card.locator(".dev-review-provenance")).toContainText(option.label);
    }
  }
  for (const recipe of unvariedRecipes) for (const warning of recipe.warnings) {
    const card = page.locator(`[data-review-warning="${warning.id}"]`);
    for (const { decisionId, optionId } of warning.when) {
      const decision = path.decisions.find((item) => item.id === decisionId);
      const option = decision.options.find((item) => item.id === optionId);
      await expect(card).toContainText(decision.title);
      await expect(card).toContainText(option.label);
    }
  }
  await expect(page.locator("[data-review-action]:enabled")).toHaveCount(0);
  await expect(page.locator(".dev-review [data-checklist], .dev-review [data-compare-toggle]")).toHaveCount(0);
  await validationTab.click();
  await expect(validationTab).toBeFocused();
  await expect(validationTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Validation", exact: true })).toBeVisible();
  await expect(page.locator("[data-review-configuration]")).toHaveCount(0);
  await expect(page.locator("[data-review-validation]")).toHaveCount(validationCount);
  for (const validation of path.validations.filter((item) => item.variants?.length)) {
    const decision = path.decisions.find((item) => item.id === validation.variantDecisionId);
    for (const variant of validation.variants) {
      const option = decision.options.find((item) => item.id === variant.optionId);
      const card = page.locator(`[data-review-validation="${validation.exerciseId}"][data-review-variant="${variant.optionId}"]`);
      await expect(card.locator(".dev-review-provenance")).toContainText(decision.title);
      await expect(card.locator(".dev-review-provenance")).toContainText(option.label);
    }
  }
  await expect(reviewBrowser.getByRole("link")).toHaveCount(validationCount);
  await validationTab.press("ArrowLeft");
  await expect(configTab).toBeFocused();
  await expect(configTab).toHaveAttribute("aria-selected", "true");
  await configTab.press("End");
  await expect(validationTab).toBeFocused();
  await validationTab.press("Home");
  await expect(configTab).toBeFocused();
  await configTab.press("ArrowRight");
  await expect(validationTab).toHaveAttribute("aria-selected", "true");
  const browserToggle = page.getByText("Browse all review paths", { exact: true });
  for (const tab of [configTab, validationTab]) {
    await tab.click();
    await expect(tab).toBeFocused();
    await page.setViewportSize({ width: 959, height: 800 });
    await expect(browserToggle).toBeFocused();
    await expect(tab).toBeHidden();
    await browserToggle.press("Enter");
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(reviewBrowser).toBeVisible();
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const sidebar = await page.locator(".stage-sidebar").boundingBox();
  const body = await page.locator(".stage-content").boundingBox();
  expect(sidebar.x + sidebar.width).toBeLessThan(body.x);
  const lastLink = reviewBrowser.getByRole("link").last();
  await lastLink.click();
  await expect(lastLink).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".dev-review-variant").last()).toBeFocused();
  await expect(page.locator(".dev-review-variant .dev-review-provenance .config-card")).toHaveCount(0);
  await expect(page.locator(".dev-review-variant > .config-card .dev-review-provenance")).toHaveCount(0);
  for (const width of [320, 390]) for (const tone of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme-tone", value), tone);
    await expect(page.locator("body")).toHaveAttribute("data-color-mode", tone);
    await page.getByText("Browse all review paths", { exact: true }).click();
    await expect(reviewBrowser).toBeVisible();
    await configTab.click();
    await expect(configTab).toBeFocused();
    await expect(reviewBrowser).toBeVisible();
    await expect(page.locator("[data-review-configuration]")).toHaveCount(configurationCount);
    await expect(page.locator("[data-review-validation]")).toHaveCount(0);
    await expect(page.locator("[data-review-action]:enabled")).toHaveCount(0);
    await expect(page.locator(".dev-review [data-checklist], .dev-review [data-compare-toggle]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await validationTab.click();
    await expect(validationTab).toBeFocused();
    await expect(page.locator("[data-review-validation]")).toHaveCount(validationCount);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByText("Browse all review paths", { exact: true }).click();
  }
  await expect(page.locator("[data-review-action]:enabled")).toHaveCount(0);
  await expect(page.locator(".dev-review [data-checklist], .dev-review [data-compare-toggle]")).toHaveCount(0);
  expect((await reviewStore.read("all-variants")).revision).toBe(before.revision);
  await page.getByRole("button", { name: "Return to workshop", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All configurations and validation paths" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Decisions remain" })).toBeVisible();
  expect((await reviewStore.read("all-variants")).paths[path.id].decisions).toEqual(before.paths[path.id].decisions);
});

test("developer review reuses participant configuration and validation card content", async ({ page }) => {
  const reviewHeadings = (markup) => markup.replace(/<(\/?)h([2-6])\b/g,
    (_, closing, level) => `<${closing}h${Math.min(6, Number(level) + 2)}`);
  const reviewStore = createStore(workspace, workshopFixture);
  const documentId = "participant-parity";
  const path = variantPath;
  let saved = await reviewStore.read(documentId);
  for (const decision of path.decisions) {
    saved = await reviewStore.update(documentId, { revision: saved.revision, pathId: path.id, decisionId: decision.id,
      exerciseId: null, operation: "decide", value: decision.options.find((option) => !option.deferred).id });
  }
  const preview = await openServer({ content: workshopFixture, store: reviewStore, documentId, dev: true, log() {} });
  cleanup.push(() => { preview.server.closeAllConnections(); return new Promise((done) => preview.server.close(done)); });
  const recipe = path.recipes.find((item) => item.kind === "exercise" && item.variants.length);
  await page.goto(`${preview.url}?path=${path.id}&stage=configure&exercise=${recipe.exerciseId}`);
  const instructions = await page.locator(".config-instructions").innerHTML();
  const references = await page.locator(".config-meta").innerHTML();
  await page.locator("#review-all-variants").click();
  const optionId = saved.paths[path.id].decisions[recipe.variantDecisionId];
  const config = page.locator(`[data-review-configuration="${recipe.id}"][data-review-variant="${optionId}"] .config-card`);
  expect(await config.locator(".config-instructions").innerHTML()).toBe(reviewHeadings(instructions));
  expect(await config.locator(".config-meta").innerHTML()).toBe(reviewHeadings(references));
  await expect(config.locator(".workflow-heading h4")).toHaveText(recipe.title);
  await expect(config.locator("h5", { hasText: "What to do" })).toBeVisible();
  await expect(page.locator(".dev-review-variant :is(h2, h3)")).toHaveCount(0);
  const positions = await config.evaluate((card) => ({
    contextBottom: card.previousElementSibling.getBoundingClientRect().bottom,
    cardTop: card.getBoundingClientRect().top,
  }));
  expect(positions.contextBottom).toBeLessThanOrEqual(positions.cardTop);

  await page.goto(`${preview.url}?path=${path.id}&stage=verify&exercise=${recipe.exerciseId}`);
  const validationBody = await page.locator(".config-card .workflow-body").innerHTML();
  await page.locator("#review-all-variants").click();
  const validation = path.validations.find((item) => item.exerciseId === recipe.exerciseId);
  const validationOption = saved.paths[path.id].decisions[validation.variantDecisionId];
  const verify = page.locator(`[data-review-validation="${recipe.exerciseId}"][data-review-variant="${validationOption}"] .config-card`);
  expect(await verify.locator(".workflow-body").innerHTML()).toBe(reviewHeadings(validationBody));
  expect((await reviewStore.read(documentId)).revision).toBe(saved.revision);
});

test("developer review renders every block without saving participant progress", async ({ page }) => {
  const reviewStore = createStore(workspace, fullContent);
  const preview = await openServer({ content: fullContent, store: reviewStore, documentId: "every-block", dev: true, log() {} });
  cleanup.push(() => { preview.server.closeAllConnections(); return new Promise((done) => preview.server.close(done)); });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const before = await reviewStore.read("every-block");
  for (const path of fullContent.paths) {
    await page.goto(`${preview.url}?path=${path.id}&stage=understand`);
    await page.locator("#review-all-variants").click();
    await expect(page.locator(".dev-review")).toBeVisible();
    for (const stage of ["configure", "verify"]) {
      await page.getByRole("tab", { name: stage === "configure" ? "Config" : "Validation", exact: true }).click();
      const expected = stage === "configure" ?
        path.recipes.reduce((count, recipe) => count + (recipe.variants?.length || 1), 0) +
          (path.stages.configure.conclusion ? 1 : 0) + path.stages.configure.additionalSteps.length :
        path.validations.reduce((count, validation) => count + (validation.variants?.length || 1), 0);
      await expect(page.locator(".dev-review-variant > .config-card")).toHaveCount(expected);
      await expect(page.locator(".dev-review-variant > .dev-review-provenance")).toHaveCount(expected);
      await expect(page.locator("[data-review-link]")).toHaveCount(expected);
      await expect(page.locator("[data-review-action]:enabled")).toHaveCount(0);
      await expect(page.locator(".dev-review [data-checklist], .dev-review [data-compare-toggle]")).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
  expect(await reviewStore.read("every-block")).toEqual(before);
});

test("Pick section opens a prompt, batches requests in memory, and sends them only on Send all", async ({ page }) => {
  const root = fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url));
  const workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (value) => createStore(workspace, value) });
  const attached = [];
  const dev = await openServer({ workshop, documentId: "picker", dev: true, contentRoot: root, sendToAgent: async (message) => { attached.push(message); }, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  const option = page.locator('label.choice[data-source-file]').first();
  const dialog = page.getByRole("dialog", { name: "Request for Copilot" });
  const tray = page.getByRole("region", { name: /Batch requests pending/ });
  await expect(option).toBeVisible();
  await expect(tray).toBeHidden();
  await page.locator("#pick-source").click();
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "true");
  await option.hover();
  await expect(option).toHaveClass(/is-source-highlight/);
  await option.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Answer EX-01");
  await expect(page.locator("#prompt-text")).toBeFocused();
  await page.locator("#prompt-text").fill("Clarify the trade-off.");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog).toBeHidden();
  await expect(tray).toBeVisible();
  await expect(tray.getByRole("heading")).toHaveText("Batch requests pending (1)");
  await expect(tray).toContainText("Clarify the trade-off.");
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "true");
  expect(attached).toHaveLength(0);
  await expect(page.locator('input[name="decision"]:checked')).toHaveCount(0);
  expect((await workshop.store.read("picker")).revision).toBe(0);

  await option.focus();
  await expect(option).toHaveClass(/is-source-highlight/);
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.locator('[data-decision-id="EX-01"]')).toHaveClass(/is-source-highlight/);
  await page.keyboard.press("Enter");
  await expect(dialog).toContainText("Decision EX-01");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-source-file][tabindex]")).toHaveCount(0);

  await page.locator("#pick-source").click();
  await page.locator('[data-decision-id="EX-01"]').click({ position: { x: 4, y: 4 } });
  await page.locator("#prompt-text").fill("Split this decision.");
  await page.getByRole("button", { name: "Add to batch" }).click();
  await expect(tray.getByRole("heading")).toHaveText("Batch requests pending (2)");
  await page.keyboard.press("Escape");

  await tray.getByRole("button", { name: /^Edit request for .*Answer EX-01/ }).click();
  await expect(page.locator("#prompt-text")).toHaveValue("Clarify the trade-off.");
  await page.locator("#prompt-text").fill("Clarify the trade-off, please.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(tray).toContainText("Clarify the trade-off, please.");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByRole("button", { name: "Send all to Copilot" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 900, height: 800 });
  expect(attached).toHaveLength(0);
  await page.locator("#pick-source").click();
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Send all to Copilot" }).click();
  await expect(page.locator("#status")).toContainText("Sent 2 requests to the Copilot agent");
  await expect(tray).toBeHidden();
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#picker-hint")).toBeHidden();
  expect(attached).toHaveLength(1);
  const { prompt, attachments } = attached[0];
  expect(prompt).toMatch(/^\[content\/example-block\.md \(L\d+–\d+\)\]\(content\/example-block\.md#L\d+-L\d+\)\nClarify the trade-off, please\.\n\n\[content\/example-block\.md \(L\d+–\d+\)\]\(content\/example-block\.md#L\d+-L\d+\)\nSplit this decision\.$/);
  expect(attachments.map((item) => item.text.split("\n")[0])).toEqual([expect.stringMatching(/^#### Option: /), expect.stringMatching(/^### Decision: EX-01/)]);
  expect(new URL(page.url()).searchParams.get("decision")).toBe("EX-01");
});

test("Send now sends one request and a failed send keeps it in the batch", async ({ page }) => {
  const root = fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url));
  const workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (value) => createStore(workspace, value) });
  const attached = [];
  let fail = false;
  const dev = await openServer({ workshop, documentId: "picker", dev: true, contentRoot: root, sendToAgent: async (message) => { if (fail) throw new Error("host offline"); attached.push(message); }, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  const option = page.locator('label.choice[data-source-file]').first();
  await page.locator("#pick-source").click();
  await option.click();
  await page.locator("#prompt-text").fill("Now please.");
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.locator("#status")).toContainText("Sent 1 request to the Copilot agent");
  await expect(page.locator("#batch")).toBeHidden();
  await expect(page.locator("#pick-source")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#picker-hint")).toBeHidden();
  expect(attached[0].prompt).toMatch(/\)\nNow please\.$/);
  fail = true;
  await page.locator("#pick-source").click();
  await option.click();
  await page.locator("#prompt-text").fill("Retry me.");
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.locator("#error")).toContainText("host offline");
  await expect(page.locator("#batch")).toContainText("Retry me.");
});

test("Reload preserves progress and Reset clears it independently of Markdown edits", async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), "governance-reload-e2e-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url)), root, { recursive: true });
  const source = join(root, "content/example-block.md"), original = await readFile(source, "utf8");
  const workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (value) => createStore(workspace, value) });
  const reloadable = await openServer({ workshop, documentId: "reload", dev: true, log() {} });
  cleanup.push(() => { reloadable.server.closeAllConnections(); return new Promise((done) => reloadable.server.close(done)); });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${reloadable.url}?path=example-block&decision=EX-01`);
  await page.locator('input[value="mixed"]').check();
  await expect.poll(async () => (await workshop.store.read("reload")).revision).toBe(1);
  await page.goto(`${reloadable.url}?path=example-block&stage=understand`);
  await expect(page.locator("main")).toContainText("Read this fictional example.");
  await writeFile(source, original.replace("Read this fictional example.", "Edited during the session."));
  await page.locator("#reload").click();
  await expect(page.locator("#status")).toContainText("Content reloaded");
  await expect(page.locator("#status")).toBeVisible();
  expect((await workshop.store.read("reload")).paths["example-block"].decisions["EX-01"]).toBe("mixed");
  await expect(page.locator("main")).toContainText("Edited during the session.");
  await writeFile(source, original.replace("Read this fictional example.", "Broken edit.").replace("## Validation", "## Removed"));
  await page.locator("#reload").click();
  await expect(page.locator("#error")).toContainText("previous content and progress remain active");
  await expect(page.locator("#status")).toHaveText("Could not reload content.");
  await expect(page.locator("main")).toContainText("Edited during the session.");
  await page.locator("#dev-reset").click();
  await expect(page.locator("#status")).toContainText("Lab reset");
  await expect(page.locator("#status")).toBeVisible();
  expect((await workshop.store.read("reload")).paths["example-block"].decisions["EX-01"]).toBe(null);
  await page.reload();
  await expect(page.locator("#status")).toHaveText("");
  await expect(page.locator("#status")).not.toHaveAttribute("hidden");
  expect((await workshop.store.read("reload")).paths["example-block"].decisions["EX-01"]).toBe(null);
  await page.goto(`${reloadable.url}?path=example-block&stage=understand`);
  await expect(page.locator("main")).toContainText("Edited during the session.");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("a panel with content replaced by another panel's Reload keeps its answer and does not save", async ({ page, context }) => {
  const root = await mkdtemp(join(tmpdir(), "governance-stale-e2e-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url)), root, { recursive: true });
  const source = join(root, "content/example-block.md");
  const workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (value) => createStore(workspace, value) });
  const reloadable = await openServer({ workshop, documentId: "stale", dev: true, log() {} });
  cleanup.push(() => { reloadable.server.closeAllConnections(); return new Promise((done) => reloadable.server.close(done)); });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${reloadable.url}?path=example-block&decision=EX-01`);
  await page.locator('input[value="mixed"]').check();
  await expect.poll(async () => (await workshop.store.read("stale")).revision).toBe(1);
  const stale = await context.newPage();
  await stale.goto(`${reloadable.url}?path=example-block&decision=EX-02`);
  await writeFile(source, (await readFile(source, "utf8")).replace("Interpret the fictional records.", "Interpret the revised records."));
  await page.locator("#reload").click();
  await expect(page.locator("#status")).toContainText("Content reloaded");
  await stale.locator('input[value="ready"]').check();
  await expect(stale.locator("#error")).toContainText("content was reloaded");
  await expect(stale.locator('input[value="ready"]')).toBeChecked();
  const saved = await workshop.store.read("stale");
  expect(saved.revision).toBe(1);
  expect(saved.paths["example-block"].decisions["EX-02"]).not.toBe("ready");
});

test("dev mode tools float top right and collapse to a remembered round toggle", async ({ page }) => {
  const root = fileURLToPath(new URL("../content-validation/fixtures/content-format/valid/", import.meta.url));
  const workspace = await workspaceFor({ after: (fn) => cleanup.push(fn) });
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (value) => createStore(workspace, value) });
  const dev = await openServer({ workshop, documentId: "devpanel", dev: true, contentRoot: root, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto(dev.url);
  const panel = page.getByRole("complementary", { name: "Dev mode tools" });
  const toggle = page.locator("#dev-toggle");
  await expect(panel).toContainText("Dev mode");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await panel.boundingBox();
  expect(box.y).toBeLessThan(20);
  expect(900 - (box.x + box.width)).toBeLessThan(20);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#pick-source")).toBeHidden();
  await expect(page.locator("#reload")).toBeHidden();
  const round = await toggle.boundingBox();
  expect(Math.abs(round.width - round.height)).toBeLessThan(1);
  await page.reload();
  await expect(page.locator("#dev-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#dev-toggle").click();
  await expect(page.locator("#pick-source")).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("dev tools save a named state, reject duplicates, and restore it after reset and reopening", async ({ page }) => {
  const dev = await openServer({ content, store, documentId: "markdown-exercises", dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  await page.locator('input[value="mixed"]').check();
  // Save immediately: the snapshot must include any in-flight autosave.
  await page.getByRole("button", { name: "Save state", exact: true }).click();
  await page.getByLabel("State name", { exact: true }).fill("Mixed path demo");
  const dialog = page.getByRole("dialog", { name: "Save state" });
  await dialog.getByRole("button", { name: "Save state", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#status")).toContainText('Saved state "Mixed path demo"');
  await expect(page.locator("#dev-save-state")).toBeFocused();
  expect(await store.listSnapshots()).toEqual(["Mixed path demo"]);
  await page.locator("#dev-save-state").click();
  await page.locator("#state-name").fill("Mixed path demo");
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-error")).toContainText("already exists");
  await expect(page.locator("#state-name")).toHaveValue("Mixed path demo");
  await page.locator("#state-cancel").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#dev-reset").click();
  await expect(page.locator("#status")).toContainText("Lab reset");
  await page.reload();
  await page.locator("#dev-restore-state").click();
  await expect(page.getByLabel("Saved state", { exact: true })).toHaveValue("Mixed path demo");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).toBeVisible();
  expect((await store.read("markdown-exercises")).paths["example-block"].decisions["EX-01"]).toBe(null);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).not.toBeVisible();
  await expect(page.locator("#status")).toContainText('Restored state "Mixed path demo"');
  expect((await store.read("markdown-exercises")).paths["example-block"].decisions["EX-01"]).toBe("mixed");
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  await expect(page.locator('input[value="mixed"]')).toBeChecked();
  await page.reload();
  await expect(page.locator('input[value="mixed"]')).toBeChecked();
  await page.locator("#dev-restore-state").click();
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.locator("#state-submit")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#dev-restore-state")).toBeFocused();
});

test("saved-state padding preserves input, backdrop dismisses, and invalid names stay client-side", async ({ page }) => {
  const dev = await openServer({ content, store, documentId: "markdown-exercises", dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(dev.url);
  await page.locator("#dev-save-state").click();
  const dialog = page.locator("#state-dialog"), name = page.locator("#state-name");
  await name.fill("Keep typed name");
  await dialog.click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeVisible();
  await expect(name).toHaveValue("Keep typed name");
  let saves = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/dev/snapshots/save")) saves++; });
  for (const invalid of ["../escape", "trailing ", "a/b", "a|b"]) {
    await name.fill(invalid);
    expect(await name.evaluate((input) => input.validity.patternMismatch)).toBe(true);
    await page.locator("#state-submit").click();
    await expect(dialog).toBeVisible();
  }
  expect(saves).toBe(0);
  for (const valid of ["A", "Access demo-1_v2.0", "a".repeat(80)]) {
    await name.fill(valid);
    expect(await name.evaluate((input) => input.checkValidity())).toBe(true);
  }
  await page.mouse.click(1, 1);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#dev-save-state")).toBeFocused();
});

for (const [label, profile] of [
  ["blank", { enterpriseSlug: "", organizationSlug: "" }],
  ["partial", { enterpriseSlug: "existing-enterprise", organizationSlug: "" }],
]) test(`restoring a ${label} profile restarts detection and exposes manual setup on failure`, async ({ page }) => {
  await page.waitForLoadState("networkidle");
  const documentId = "markdown-exercises";
  let state = await store.updateProfile(documentId, { revision: 0, profile });
  await store.saveSnapshot(documentId, { revision: state.revision, name: "Incomplete profile" });
  state = await store.updateProfile(documentId, { revision: state.revision,
    profile: { enterpriseSlug: "complete-enterprise", organizationSlug: "complete-org" } });
  const dev = await openServer({ content, store, documentId, dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  let initialDiscoveries = 0;
  const countInitialDiscovery = (request) => {
    if (request.url().endsWith("/api/profile/discover")) initialDiscoveries++;
  };
  page.on("request", countInitialDiscovery);
  await page.goto(dev.url);
  await expect(page.locator("#profile-summary")).toContainText("complete-enterprise");
  await expect(page.locator("#profile-summary")).toContainText("complete-org");
  await page.waitForLoadState("networkidle");
  page.off("request", countInitialDiscovery);
  expect(initialDiscoveries).toBe(0);
  let discoveries = 0;
  await page.route("**/api/profile/discover", (route) => {
    discoveries++;
    return route.fulfill({ json: { profile: null, error: { message: "Detection unavailable after restore." } } });
  });
  await page.locator("#dev-restore-state").click();
  await expect(page.locator("#state-choice")).toHaveValue("Incomplete profile");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).not.toBeVisible();
  await expect(page.locator("#profile-open")).toBeVisible();
  await expect(page.locator("#profile-detection-error")).toContainText("Detection unavailable after restore.");
  expect(discoveries).toBe(1);
  expect((await store.read(documentId)).profile).toEqual(profile);
  await page.locator("#profile-open").click();
  await expect(page.locator("#enterprise-slug")).toHaveValue(profile.enterpriseSlug);
  await page.locator("#organization-slug").fill("manually-completed");
  await expect.poll(async () => (await store.read(documentId)).profile.organizationSlug).toBe("manually-completed");
});

test("saved-state dialogs expose empty lists and failed saves without losing current input", async ({ page }) => {
  await expect(page.locator("#state-dialog")).toHaveCount(0);
  const dev = await openServer({ content, store, documentId: "markdown-exercises", dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  await page.locator("#dev-restore-state").click();
  await expect(page.locator("#state-error")).toContainText("No saved states yet");
  await expect(page.locator("#state-submit")).toBeDisabled();
  await page.locator("#state-cancel").click();
  await page.route("**/api/progress", (route) => route.fulfill({ status: 500, json: { message: "disk unavailable" } }));
  await page.locator('input[value="mixed"]').check();
  await expect(page.locator("#error")).toContainText("disk unavailable");
  await page.locator("#dev-save-state").click();
  await page.locator("#state-name").fill("Unsaved path");
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-error")).toContainText("Current edits could not be saved");
  await expect(page.locator("#state-name")).toHaveValue("Unsaved path");
  expect(await store.listSnapshots()).toEqual([]);
  await page.locator("#state-cancel").click();
  await expect(page.locator('input[value="mixed"]')).toBeChecked();
  await page.unroute("**/api/progress");
  await page.locator("#dev-save-state").click();
  await page.locator("#state-name").fill("Unsaved path");
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).not.toBeVisible();
  expect(await store.listSnapshots()).toEqual(["Unsaved path"]);
});

test("old providers show extension reload guidance and retain the snapshot name for retry", async ({ page }) => {
  const dev = await openServer({ content, store, documentId: "markdown-exercises", dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.route("**/api/dev/snapshots**", (route) => route.fulfill({ status: 404, json: { message: "Not found." } }));
  await page.goto(dev.url);
  await page.locator("#dev-save-state").click();
  await page.locator("#state-name").fill("Keep this name");
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-error")).toContainText("Reload project extensions");
  await expect(page.locator("#state-error")).toContainText("reloads content only");
  await expect(page.locator("#state-name")).toHaveValue("Keep this name");
  expect(await store.listSnapshots()).toEqual([]);
  await page.locator("#state-cancel").click();
  await page.locator("#dev-restore-state").click();
  await expect(page.locator("#state-error")).toContainText("Reload project extensions");
  await page.locator("#state-cancel").click();
  await page.unroute("**/api/dev/snapshots**");
  await page.locator("#dev-save-state").click();
  await page.locator("#state-name").fill("Keep this name");
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).not.toBeVisible();
  expect(await store.listSnapshots()).toEqual(["Keep this name"]);
});

test("a stale or failed restore keeps the selected name and current answers for retry", async ({ page }) => {
  await store.saveSnapshot("markdown-exercises", { name: "Blank starting point", revision: 0 });
  const dev = await openServer({ content, store, documentId: "markdown-exercises", dev: true, log() {} });
  cleanup.push(() => { dev.server.closeAllConnections(); return new Promise((done) => dev.server.close(done)); });
  await page.goto(`${dev.url}?path=example-block&decision=EX-01`);
  await page.locator('input[value="mixed"]').check();
  await expect.poll(async () => (await store.read("markdown-exercises")).revision).toBe(1);
  await page.locator("#dev-restore-state").click();
  await expect(page.locator("#state-choice")).toHaveValue("Blank starting point");
  await store.update("markdown-exercises", { revision: 1, pathId: "example-block", decisionId: "EX-02",
    exerciseId: null, operation: "decide", value: "ready" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-error")).toContainText("another panel");
  await expect(page.locator("#state-choice")).toHaveValue("Blank starting point");
  await expect(page.locator("#state-submit")).toBeEnabled();
  expect((await store.read("markdown-exercises")).paths["example-block"].decisions).toEqual({ "EX-01": "mixed", "EX-02": "ready" });
  await page.locator("#state-cancel").click();
  await expect(page.locator('input[value="mixed"]')).toBeChecked();
  await page.reload();
  await page.locator("#dev-restore-state").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#state-submit").click();
  await expect(page.locator("#state-dialog")).not.toBeVisible();
  await expect(page.locator('input[value="mixed"]')).not.toBeChecked();
  expect((await store.read("markdown-exercises")).revision).toBe(3);
});
