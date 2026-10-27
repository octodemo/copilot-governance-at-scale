import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { parseWorkshopMarkdown, exerciseFingerprint } from "../../lib/workshop-content.mjs";
import { configurationFor } from "../../.github/extensions/governance-lab/ui/model.js";
import { content, harness, withoutLegacyEvidenceSections } from "./exercise-helpers.mjs";

const id = "billing-cost-control", path = content.paths.find((item) => item.id === id);

test("Billing decisions select targeted Verify exercises without creating completion", async (t) => {
  const h = await harness(t);
  assert.deepEqual(path.decisions.map((item) => item.id), ["BC-01", "BC-02", "BC-03", "BC-04", "BC-05", "BC-06", "BC-07", "BC-08", "BC-09", "BC-10"]);
  assert.ok(!path.decisions.some((item) => item.id === "BC-13"));
  assert.match(path.sourceText, /Your sandbox already has an Azure subscription, so you will not set up a payment method here/);
  const exercises = path.recipes.filter((recipe) => recipe.kind === "exercise");
  assert.equal(exercises.length, 6);
  assert.deepEqual(path.validations.map((validation) => validation.exerciseId), exercises.map((recipe) => recipe.exerciseId));
  for (const decision of path.decisions) {
    for (const option of decision.options) {
      await h.select(id, decision.id, option.id);
      assert.equal(h.state().paths[id].decisions[decision.id], option.id);
      const config = configurationFor(path, h.state().paths[id]);
      assert.ok(config.exercises.every(({ recipe, validation }) => validation.exerciseId === recipe.exerciseId));
      assert.ok(Object.values(h.state().paths[id].exercises).every((record) => !record.verified));
    }
  }
});

test("participant references use visible titles instead of question numbers or decision IDs", () => {
  const prose = path.sourceText.split("\n").filter((line) => !line.startsWith("#") && !line.startsWith("**")).join("\n");
  assert.doesNotMatch(prose, /\bBC-\d+\b/);
  assert.doesNotMatch(prose, /\bquestion \d+\b/);
  assert.match(prose, /internal cost allocation in \*\*Cross-charging: Allocation level\*\*/);
  assert.match(prose, /No per-user limits\*\* in \*\*Budgets: User-level limits\*\*/);
  assert.match(prose, /no enterprise-level budget in \*\*Budgets: Enterprise level\*\*, but \*\*Budgets: AI workloads\*\*/);
});

test("Configure keeps ULB setup after the enterprise guardrail and uses API reporting for cross-charging", async (t) => {
  const ids = path.recipes.map(({ id }) => id);
  assert.deepEqual(ids, [
    "bc-billing-managers", "bc-cost-centers", "bc-azure-routing",
    "bc-enterprise-budget", "bc-universal-ulb", "bc-differentiated-ulbs", "bc-group-budgets", "bc-workload-budgets",
    "bc-cli-organization-billing", "bc-cli-organization-billing-no", "bc-code-review-organization-billing", "bc-user-visibility"
  ]);
  assert.ok(!ids.includes("bc-azure-payment"));
  assert.ok(!ids.includes("bc-payment-review"));
  const enterpriseIndex = ids.indexOf("bc-enterprise-budget");
  assert.deepEqual(ids.slice(enterpriseIndex + 1, enterpriseIndex + 3), ["bc-universal-ulb", "bc-differentiated-ulbs"]);
  assert.ok(!ids.includes("bc-chargeback-reporting"));
  const configure = path.sourceText.split("## Configure\n")[1].split("## Validation\n")[0];
  assert.doesNotMatch(configure, /Email me the report/i);
  assert.match(configure, /> \[!WARNING\]\n> Review the setting without changing your role or inviting anyone/);
  const h = await harness(t);
  for (const [decisionId, answerId] of [["BC-03", "unit"], ["BC-03", "user"], ["BC-02", "reporting"]]) {
    await h.select(id, decisionId, answerId);
    const guidance = configurationFor(path, h.state().paths[id]).guidance;
    assert.equal(guidance.filter(({ recipe }) => recipe.id === "bc-user-visibility").length, 1);
    if (decisionId === "BC-03" && answerId === "user") {
      assert.ok(!configurationFor(path, h.state().paths[id]).recipes.some(({ recipe }) => recipe.id === "bc-cost-centers"));
    }
  }
});

test("central reporting offers resolved yes and no choices", async (t) => {
  const decision = path.decisions.find((item) => item.id === "BC-10");
  assert.deepEqual(decision.options.map(({ id, label }) => [id, label]), [
    ["budget", "Yes, provide central cost and budget reporting"], ["none", "No, keep individual Copilot views"]
  ]);
  const h = await harness(t);
  for (const answer of ["budget", "none"]) {
    await h.select(id, "BC-10", answer);
    assert.deepEqual(configurationFor(path, h.state().paths[id]).guidance.map(({ recipe }) => recipe.id),
      answer === "budget" ? ["bc-user-visibility"] : []);
  }
});

test("Billing Configure supports sandbox experimentation without facilitator gates", () => {
  const configure = path.sourceText.split("## Configure\n")[1].split("## Validation\n")[0];
  assert.doesNotMatch(configure, /facilitator|approved nonzero|Do not run a workflow|Do not request a review/i);
  assert.match(configure, /including zero/);
  assert.match(configure, /Under `Resources`, select your user, an enterprise team, or your organization/);
  assert.doesNotMatch(path.sourceText, /assigned test|isolated|other participants|shared sandbox|anyone else/i);
  assert.match(configure, /> \[!NOTE\]\n> This budget limits each user's AI credit usage/);
  assert.match(configure, /> \[!NOTE\]\n> In the pooled model, these budgets apply only after/);
  assert.match(configure, /> \[!NOTE\]\n> Use this guidance if you selected \*\*Separate Azure subscriptions by cost center\*\* in \*\*Cross-payment: Azure subscriptions\*\*/);
  assert.match(configure, /> \[!NOTE\]\n> If you selected \*\*One shared AI-credit budget\*\* or \*\*Shared budget with additional workload-specific limits\*\* in \*\*Budgets: AI workloads\*\*/);
  assert.match(configure, /> \[!NOTE\]\n> If you selected \*\*Separate limits for specific AI workloads\*\* in \*\*Budgets: AI workloads\*\*/);
  assert.match(configure, /> \[!NOTE\]\n> If you selected \*\*Central Azure subscription; allocate costs internally\*\* in \*\*Cross-payment: Azure subscriptions\*\*/);
});

test("API reporting separates CSV downloads from budget queries and includes authentication", () => {
  const reporting = path.sourceText.split("### Recipe: bc-user-visibility\n")[1].split("## Validation\n")[0];
  assert.match(reporting, /> \[!WARNING\]\n> Usage data may be empty/);
  assert.match(reporting, /\*\*Download a CSV usage report\*\*/);
  assert.match(reporting, /2\. Add the enterprise billing scope/);
  assert.match(reporting, /gh auth refresh --scopes manage_billing:enterprise/);
  assert.match(reporting, /START_DATE='2026-10-01'\n   END_DATE='2026-10-31'/);
  assert.match(reporting, /October 2026/);
  assert.match(reporting, /If you selected \*\*By individual user\*\* in \*\*Cross-charging: Allocation level\*\*, use these per-user rows; this path does not require a cost center/);
  assert.match(reporting, /If you selected a group allocation and created a cost center, use the \[detailed usage report\].*filter by its `cost_center_name`; that field is not included in the AI usage report/);
  assert.match(reporting, /\*\*Query budget status\*\*\n\n1\. In the same terminal/);
});

test("enterprise budget warns only when workload choices conflict with rejecting an enterprise budget", () => {
  for (const enterprise of ["none", "enforce", "monitor"]) {
    for (const workload of ["shared", "layered", "separate"]) {
      const config = configurationFor(path, { decisions: { "BC-04": enterprise, "BC-08": workload } });
      const budget = config.recipes.find(({ recipe }) => recipe.id === "bc-enterprise-budget");
      const expected = enterprise === "none" && workload !== "separate" ? [`rejected-budget-${workload}`] : [];
      assert.deepEqual(budget?.warnings.map(({ id }) => id) ?? [], expected);
      if (budget) assert.match(budget.recipe.markdown, /If you selected \*\*One shared AI-credit budget\*\*/);
      if (expected.length) {
        assert.equal(budget.eligible, true);
        assert.match(budget.warnings[0].markdown, /reconcile those choices before creating a budget/);
      }
    }
  }
});

test("Billing validation invites safe budget experiments and explains how to restore settings", () => {
  const validation = path.sourceText.split("## Validation\n")[1];
  assert.match(validation, /temporarily set it to \*\*\$0\*\*/i);
  assert.match(validation, /enterprise spending controls apply to metered spending after the shared pool is exhausted/i);
  assert.match(validation, /alerts are usually sent by email/i);
  assert.match(validation, /move your user into and out of the cost center/);
  assert.match(validation, /temporarily set your own individual ULB to \*\*\$0\*\*/);
  for (const exercise of path.validations) {
    const definitions = exercise.variants?.length ? exercise.variants.map(({ sections }) => sections) : [exercise.sections];
    for (const sections of definitions) {
      assert.ok(sections.Steps);
      assert.ok(sections["Expected result"]);
      assert.equal("Evidence" in sections, false);
      assert.match(sections.Steps, /restore/i);
    }
  }
});

test("organization billing routes both resolved choices to CLI guidance and code-review Verify", async (t) => {
  const h = await harness(t);
  for (const answer of ["yes", "no"]) {
    await h.select(id, "BC-09", answer);
    const config = configurationFor(path, h.state().paths[id]);
    assert.deepEqual(config.guidance.map(({ recipe }) => recipe.id),
      [answer === "yes" ? "bc-cli-organization-billing" : "bc-cli-organization-billing-no"]);
    assert.deepEqual(config.exercises.map(({ recipe }) => recipe.id), ["bc-code-review-organization-billing"]);
    assert.equal(config.exercises[0].variant.optionId, answer);
    assert.ok(config.recipes.every(({ eligible }) => eligible));
  }
  await assert.rejects(h.select(id, "BC-09", "review"), /valid policy decision/);
});

test("code-review answer variants keep configuration and validation on the selected billing path", () => {
  const recipe = path.recipes.find(({ id }) => id === "bc-code-review-organization-billing");
  const validation = path.validations.find(({ exerciseId }) => exerciseId === recipe.exerciseId);
  assert.ok(recipe.catalogIds.includes("billing.ai-credits-paid-usage-policy"));
  assert.ok(path.decisions.find(({ id }) => id === "BC-09").catalogIds.includes("billing.ai-credits-paid-usage-policy"));
  assert.match(recipe.sections.Safety, /You may enable `AI credits paid usage` in your sandbox/);
  assert.match(recipe.sections.Safety, /Keep existing budgets and unrelated access settings unchanged/);
  const configure = Object.fromEntries(recipe.variants.map(({ optionId, sections }) => [optionId, sections.Steps]));
  const verify = Object.fromEntries(validation.variants.map(({ optionId, sections }) => [optionId, sections]));
  assert.deepEqual(Object.keys(configure).sort(), ["no", "yes"]);
  assert.deepEqual(Object.keys(verify).sort(), ["no", "yes"]);
  assert.match(configure.yes, /Choose organization billing/);
  assert.match(configure.yes, /check `AI credits paid usage` and enable it in your sandbox if it is disabled/);
  assert.doesNotMatch(configure.yes, /Retain billing against the member/);
  assert.match(configure.no, /Retain billing against the member's Copilot entitlement/);
  assert.doesNotMatch(configure.no, /AI credits paid usage|spending controls for organization-billed reviews/);
  assert.match(verify.yes.Steps, /`AI credits paid usage` is enabled/);
  assert.match(verify.yes.Steps, /Do not raise a budget to obtain a review/);
  assert.match(verify.yes.Steps, /repository in your sandbox organization/);
  assert.match(verify.yes["Expected result"], /Organization-billed reviews use the applicable/);
  assert.match(verify.no.Steps, /your effective ULB/);
  assert.doesNotMatch(verify.no.Steps, /AI credits paid usage|If you also configured a group spending limit/);
  assert.doesNotMatch(verify.no["Expected result"], /Organization-billed reviews use the applicable/);
  assert.match(verify.yes.Steps, /Do not raise a budget to obtain a review/);
  assert.match(verify.no.Steps, /Do not raise a budget to obtain a review/);
  for (const section of [recipe.sections.Safety, configure.yes, configure.no]) {
    assert.doesNotMatch(section, /do not[^.\n]*(?:enable|enabling) (?:\*\*)?(?:AI credits )?paid usage/i);
  }
});

test("Billing wording completes the central Azure path without changing reporting dates", () => {
  const reporting = path.decisions.find(({ id }) => id === "BC-02").options.find(({ id }) => id === "reporting");
  assert.match(reporting.markdown, /Use reports to allocate costs internally while payment remains on a central Azure subscription\./);
  assert.match(path.sourceText, /Each budget comes with a dollar amount/);
  assert.match(path.decisions.find(({ id }) => id === "BC-04").guidance, /Agree on the amount/);
  assert.match(path.sourceText, /START_DATE='2026-10-01'\n   END_DATE='2026-10-31'/);
});

test("changed BC-09 exercise fingerprints archive earlier evidence and Done markers", async (t) => {
  const previous = structuredClone(content);
  const previousPath = previous.paths.find(({ id }) => id === "billing-cost-control");
  const previousRecipe = previousPath.recipes.find(({ exerciseId }) => exerciseId === "BC-VERIFY-CODE-REVIEW");
  previousRecipe.variants.find(({ optionId }) => optionId === "yes").sections.Steps += "\nEarlier setup wording.";
  previousRecipe.fingerprint = exerciseFingerprint(previousPath, previousRecipe, { policies: content.policies });
  assert.notEqual(previousRecipe.fingerprint, path.recipes.find(({ id }) => id === previousRecipe.id).fingerprint);
  const h = await harness(t, previous);
  await h.select(id, "BC-09", "yes");
  await h.configure(id, "BC-VERIFY-CODE-REVIEW", {
    configuration: "already_matches",
    settingsUrl: "https://github.com/example/sample",
  });
  await h.verify(id, "BC-VERIFY-CODE-REVIEW", { verified: true, evidence: "Earlier code-review result" });
  await h.store.update(h.documentId, {
    revision: h.state().revision, pathId: id, decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "verify:BC-VERIFY-CODE-REVIEW", done: true },
  });
  const disk = await h.disk();
  const current = await createStore(h.workspace, content).read(h.documentId);
  const record = current.paths[id].exercises["BC-VERIFY-CODE-REVIEW"];
  assert.equal(record.verified, false);
  assert.equal(record.evidence, "");
  assert.ok(current.history.some(({ data }) => data.exerciseId === "BC-VERIFY-CODE-REVIEW" &&
    data.record?.evidence === "Earlier code-review result"));
  assert.ok(current.history.some(({ data }) => data.stepId === "verify:BC-VERIFY-CODE-REVIEW" && data.done));
  assert.ok(!current.checklist.some(({ stepId, done }) => stepId === "verify:BC-VERIFY-CODE-REVIEW" && done));
  assert.equal(await h.disk(), disk, "reading reconciliation must not overwrite saved data");
});

test("Azure routing requires the separate-payment decision and ULB recipes require the per-user decision", async (t) => {
  const h = await harness(t);
  await h.select(id, "BC-02", "not-applicable");
  await h.select(id, "BC-06", "mixed");
  await h.select(id, "BC-05", "no");
  const blocked = configurationFor(path, h.state().paths[id]);
  assert.ok(!blocked.guidance.some(({ recipe }) => recipe.id === "bc-azure-routing"));
  for (const recipeId of ["bc-universal-ulb", "bc-differentiated-ulbs"]) {
    assert.equal(blocked.exercises.find(({ recipe }) => recipe.id === recipeId).eligible, false);
  }
  await h.select(id, "BC-02", "separate");
  await h.select(id, "BC-05", "yes");
  const enabled = configurationFor(path, h.state().paths[id]);
  for (const recipeId of ["bc-azure-routing", "bc-universal-ulb", "bc-differentiated-ulbs"]) {
    assert.equal(enabled.recipes.find(({ recipe }) => recipe.id === recipeId).eligible, true);
  }
  assert.equal(enabled.exercises.filter(({ recipe }) => recipe.id === "bc-universal-ulb").length, 1);
});

test("Verify follows selected budget scopes and deduplicates shared ULB checks", async (t) => {
  const h = await harness(t);
  const selectedIds = () => configurationFor(path, h.state().paths[id]).exercises.map(({ recipe }) => recipe.exerciseId);
  assert.deepEqual(selectedIds(), []);
  await h.select(id, "BC-05", "yes");
  assert.deepEqual(selectedIds(), ["BC-VERIFY-UNIVERSAL"]);
  await h.select(id, "BC-06", "mixed");
  assert.deepEqual(selectedIds(), ["BC-VERIFY-COST-CENTER", "BC-VERIFY-UNIVERSAL", "BC-VERIFY-ULB-OVERRIDES"]);
  await h.select(id, "BC-07", "both");
  assert.deepEqual(selectedIds(), ["BC-VERIFY-COST-CENTER", "BC-VERIFY-UNIVERSAL", "BC-VERIFY-ULB-OVERRIDES", "BC-VERIFY-GROUP"]);
  await h.select(id, "BC-07", "none");
  assert.ok(!selectedIds().includes("BC-VERIFY-GROUP"));
  await h.select(id, "BC-04", "monitor");
  await h.select(id, "BC-08", "shared");
  assert.equal(selectedIds().filter((exerciseId) => exerciseId === "BC-VERIFY-ENTERPRISE").length, 1);
  const review = path.validations.find((item) => item.exerciseId === "BC-VERIFY-CODE-REVIEW");
  for (const variant of review.variants) {
    assert.match(variant.sections.Steps, /`Reviewers` sidebar.*`Copilot`.*`Request`/);
    assert.match(variant.sections["Expected result"], /not which account was charged/);
  }
});

test("retired Billing decisions and exercise evidence remain historical across a current-state content change", async (t) => {
  const source = await readFile(new URL("./fixtures/billing-before-production-decisions.md", import.meta.url), "utf8");
  const catalog = { schemaVersion: 1, policies: content.policies };
  const parsed = parseWorkshopMarkdown(withoutLegacyEvidenceSections(source.slice(source.indexOf("# Billing & Cost Control"))), { file: "billing-cost-control.md", catalog });
  assert.deepEqual(parsed.diagnostics, []);
  const previousPath = parsed.block;
  for (const recipe of previousPath.recipes) recipe.fingerprint = exerciseFingerprint(previousPath, recipe, catalog);
  const previous = structuredClone(content);
  previous.paths[previous.paths.findIndex((item) => item.id === id)] = previousPath;
  const h = await harness(t, previous);
  await h.select(id, "BC-01", "department");
  await h.select(id, "BC-02", "layered");
  await h.configure(id, "BC-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/billing" });
  await h.verify(id, "BC-LAB", { verified: true, evidence: "Earlier scoped guardrail inspection" });
  const disk = await h.disk();
  const reconciled = await createStore(h.workspace, content).read(h.documentId);
  assert.ok(Object.values(reconciled.paths[id].decisions).every((value) => value === null));
  assert.deepEqual(Object.keys(reconciled.paths[id].exercises), path.validations.map(({ exerciseId }) => exerciseId));
  assert.ok(Object.values(reconciled.paths[id].exercises).every((record) => !record.verified && !record.evidence && record.configuration === "not_started"));
  assert.ok(reconciled.history.some((item) => item.data.decisionId === "BC-01" && item.data.value === "department"));
  assert.ok(reconciled.history.some((item) => item.data.exerciseId === "BC-LAB" && item.data.record.verified &&
    item.data.record.evidence === "Earlier scoped guardrail inspection"));
  assert.equal(await h.disk(), disk);
  await assert.rejects(h.select(id, "BC-04", "azure"), /valid decision/);
  for (const decision of previousPath.decisions) await h.select(id, decision.id, "review");
  const deferred = await createStore(h.workspace, content).read(h.documentId);
  assert.ok(Object.values(deferred.paths[id].decisions).every((value) => value === null),
    "retired review answers must not attach to reused IDs");
  assert.ok(deferred.history.some((item) => item.data.decisionId === "BC-01" && item.data.value === "review"));
});

function beforeBillingRenumbering() {
  const oldIds = ["BC-13", "BC-06", "BC-05", "BC-07", "BC-10", "BC-11", "BC-09", "BC-08", "BC-14", "BC-12"];
  const previous = structuredClone(content);
  const oldSource = path.sourceText.replace(/\bBC-(\d{2})\b/g, (_, number) => oldIds[Number(number) - 1]);
  const catalog = { schemaVersion: 1, policies: content.policies };
  const parsed = parseWorkshopMarkdown(oldSource, { file: "billing-cost-control.md", catalog });
  assert.deepEqual(parsed.diagnostics, []);
  for (const decision of parsed.block.decisions) {
    decision.options.push({
      ...structuredClone(decision.options[0]),
      id: "review",
      label: "I don't know yet",
      deferred: true,
      recipeIds: [],
    });
  }
  for (const recipe of parsed.block.recipes) recipe.fingerprint = exerciseFingerprint(parsed.block, recipe, catalog);
  previous.paths[previous.paths.findIndex((item) => item.id === id)] = parsed.block;
  return previous;
}

test("billing renumbering maps every answer by saved definitions and persists without remapping twice", async (t) => {
  const previous = beforeBillingRenumbering();
  const oldPath = previous.paths.find((item) => item.id === id);
  const h = await harness(t, previous);
  const store = createStore(h.workspace, content);
  for (const [index, decision] of oldPath.decisions.entries()) {
    for (const option of decision.options) {
      await h.select(id, decision.id, option.id);
      const disk = await h.disk();
      const migrated = await store.read(h.documentId);
      const targetDecision = path.decisions[index];
      assert.equal(migrated.paths[id].decisions[targetDecision.id], option.deferred ? null : option.id);
      if (option.deferred) {
        assert.ok(migrated.history.some((item) => item.data.decisionId === decision.id && item.data.value === "review"));
      }
      for (let other = 0; other < path.decisions.length; other++) {
        const oldDecision = oldPath.decisions[other];
        const oldValue = h.state().paths[id].decisions[oldDecision.id];
        assert.equal(migrated.paths[id].decisions[path.decisions[other].id], oldValue === "review" ? null : oldValue);
      }
      assert.equal(await h.disk(), disk, "migration reads must not write");
    }
  }
  const migrated = await store.read(h.documentId);
  const saved = await store.update(h.documentId, { revision: migrated.revision, pathId: id,
    decisionId: "BC-01", exerciseId: null, operation: "decide", value: "owners" });
  assert.deepEqual(await store.read(h.documentId), saved);
  const exported = await store.export(h.documentId);
  assert.deepEqual(exported.state.paths[id].decisions, saved.paths[id].decisions);
});

test("billing renumbering retains earlier exercise evidence and checklist markers as history", async (t) => {
  const h = await harness(t, beforeBillingRenumbering());
  await h.select(id, "BC-10", "yes");
  await h.configure(id, "BC-VERIFY-UNIVERSAL", { configuration: "already_matches",
    settingsUrl: "https://github.com/enterprises/example/billing", issues: "Preserve this note" });
  await h.verify(id, "BC-VERIFY-UNIVERSAL", { verified: true, evidence: "Earlier ULB observation" });
  await h.store.update(h.documentId, { revision: h.state().revision, pathId: id, decisionId: null,
    exerciseId: null, operation: "checklist", value: { stepId: "verify:BC-VERIFY-UNIVERSAL", done: true } });
  const disk = await h.disk();
  const migrated = await createStore(h.workspace, content).read(h.documentId);
  assert.equal(migrated.paths[id].decisions["BC-05"], "yes");
  const exercise = migrated.paths[id].exercises["BC-VERIFY-UNIVERSAL"];
  assert.equal(exercise.verified, false);
  assert.equal(exercise.issues, "Preserve this note");
  assert.ok(migrated.history.some((item) => item.data.record?.evidence === "Earlier ULB observation"));
  assert.ok(migrated.history.some((item) => item.data.stepId === "verify:BC-VERIFY-UNIVERSAL" && item.data.done));
  assert.equal(migrated.checklist.length, 0);
  assert.equal(await h.disk(), disk);
});
