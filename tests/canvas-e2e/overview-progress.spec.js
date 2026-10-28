import { test, expect } from "@playwright/test";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";
import { emptyExercise } from "../../.github/extensions/governance-lab/ui/model.js";
import { FIXTURE_ROOT } from "./fixtures/workshop.mjs";

const content = await loadContent({ root: FIXTURE_ROOT });
const answered = content.paths.find((path) => path.decisions.length > 1);
const savedAnswerState = {
  version: 11,
  revision: 0,
  checklist: [],
  profile: { enterpriseSlug: "", organizationSlug: "" },
  history: [],
  paths: Object.fromEntries(content.paths.map((path) => [path.id, {
    decisions: Object.fromEntries(path.decisions.map((decision, index) => [decision.id,
      path.id === answered.id && index === 0 ? decision.options.find((option) => !option.deferred).id : null])),
    exercises: Object.fromEntries(path.recipes.filter((recipe) => recipe.kind === "exercise").map((recipe) => [
      recipe.exerciseId, emptyExercise(recipe, path.validations.find((item) => item.exerciseId === recipe.exerciseId)),
    ])),
  }])),
};
let entry;

test.beforeAll(async () => {
  entry = await openServer({ content, store: { read: async () => structuredClone(savedAnswerState) }, documentId: "overview-progress",
    discover: async () => ({ profile: null, error: { code: "not-found", message: "No lab enterprise found in this test preview." } }),
    checkAuth: async () => ({ status: "ready", account: "octocat", missingScopes: [], message: "GitHub CLI is signed in as @octocat." }) });
});

test.afterAll(async () => {
  entry.server.closeAllConnections();
  await new Promise((done) => entry.server.close(done));
});

test("block overview resumes after a saved resolved answer", async ({ page }) => {
  const path = answered, total = path.decisions.length;
  await page.goto(entry.url);
  const card = page.locator("a.journey").filter({ hasText: path.title });
  await expect(card.locator(".journey-action")).toHaveText("Resume");
  await expect(card.locator(".journey-meter-label").first()).toContainText(`1 / ${total}`);
  const overviewMeter = card.getByRole("progressbar", { name: "Decision taken", exact: true });
  await expect(card.locator(".journey-meter-label").first()).toContainText("Decision taken");
  await expect(card.locator(".journey-meter-label").nth(1)).toContainText("Configurations applied");
  await expect(overviewMeter).toHaveAttribute("value", "1");
  await expect(overviewMeter).toHaveAttribute("max", String(total));
  await expect(overviewMeter).toHaveAttribute("aria-valuetext", `1 of ${total} decisions answered`);

  await page.goto(`${entry.url}?path=${path.id}&decision=${path.decisions[0].id}`);
  const decisionMeter = page.getByRole("progressbar", { name: "Decisions answered", exact: true });
  await expect(decisionMeter).toHaveAttribute("value", "1");
  await expect(page.locator(".decision-counts")).toHaveText(`1 / ${total} answered`);
  await expect(decisionMeter).toHaveAttribute("aria-valuetext", `1 / ${total} answered`);
});
