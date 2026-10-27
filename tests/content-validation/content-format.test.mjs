import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  parseWorkshopMarkdown, validateManifest, validatePolicyCatalog, loadWorkshopContent,
  resolveConfiguration, stageSource, STAGES, LIMITS,
} from "../../lib/workshop-content.mjs";
import { commandInputNames, resolveContentCommand, resolveContentLinkTarget, resolveValidationVariant } from "../../lib/workshop-resolver.mjs";
import { renderMarkdown } from "../../.github/extensions/governance-lab/ui/markdown.js";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtures = join(repository, "tests/content-validation/fixtures/content-format");
const validRoot = join(fixtures, "valid");
// Mutations use LF literals even when Git checks the fixture out with CRLF.
const source = (await readFile(join(validRoot, "content/example-block.md"), "utf8")).replace(/\r\n/g, "\n");
const catalog = JSON.parse(await readFile(join(validRoot, "content/policy-catalog.json"), "utf8"));
const parse = (text = source) => parseWorkshopMarkdown(text, { file: "content/example-block.md", catalog });
const codes = (result) => result.diagnostics.map((item) => item.code);
const block = parse().block;
const cli = (...args) => spawnSync(process.execPath, [join(repository, "scripts/validate-content.mjs"), ...args], {
  cwd: repository, encoding: "utf8",
  // No session, SDK, shell commands, browser, or PATH dependency is available.
  env: { PATH: "", HOME: "", NODE_NO_WARNINGS: "1" },
});

test("synthetic block, empty draft, template, and all manifest sources validate", async () => {
  assert.deepEqual(parse().diagnostics, []);
  const result = await loadWorkshopContent({ root: validRoot });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.blocks.map((item) => item.id), ["example-block", "empty-block"]);
  const template = await readFile(join(repository, "docs/templates/workshop-block.md"), "utf8");
  assert.deepEqual(parse(template).diagnostics, []);
  assert.deepEqual(result.blocks[1].recipes, []);
});

test("fictional datasets remain optional generic exercise content", () => {
  const generic = parse(source
    .replace("**Exercise ID:** EX-SECOND\n**Policies:**", "**Exercise ID:** EX-SECOND\n**Target:** enterprise\n**Policies:**")
    .replace(`#### Field: interpretation
**Label:** Interpretation
**Type:** text
**Required:** true

Explain this limited result.`, `#### Fallback

Use the prepared sample if the target is unavailable.`)
    .replace("The interpretation acknowledges limitations.", `The fictional table remains the only evidence.

#### Fallback

The result remains limited to this fictional sample.`));
  assert.deepEqual(generic.diagnostics, []);
  const exercise = generic.block.recipes.find((item) => item.exerciseId === "EX-SECOND");
  assert.equal(Object.hasOwn(exercise, "exerciseKind"), false);
  assert.equal(exercise.target, "enterprise");
  assert.equal(exercise.datasets.length, 1);
  assert.equal(exercise.fields.length, 0);
  assert.ok(exercise.sections.Fallback);
  assert.ok(generic.block.validations.find((item) => item.exerciseId === "EX-SECOND").sections.Fallback);
});

test("LF and CRLF preserve fenced headings and metadata without treating them as structure", () => {
  const unix = parse();
  const windows = parse(source.replace(/\n/g, "\r\n"));
  assert.deepEqual(windows, unix);
  assert.match(unix.block.stages.understand.markdown, /## Not a real stage/);
  const recipeFence = source.replace("Informational guidance, never a completed exercise.", "```markdown\n### Recipe: fake\n**Kind:** not-metadata\n```");
  assert.deepEqual(parse(recipeFence).diagnostics, []);
});

test("profile URL templates validate known variables and safely resolve or fall back", () => {
  const template = `[Enterprise page](https://example.test/enterprises/{{enterprise.slug}}/settings "fallback=https://example.test/enterprise")`;
  const valid = parse(source.replace("Read this fictional example.", template));
  assert.deepEqual(valid.diagnostics, []);
  const profile = { enterpriseSlug: "Acme-Tools", organizationSlug: "Platform-Team" };
  assert.equal(resolveContentLinkTarget('https://example.test/enterprises/{{enterprise.slug}}/settings "fallback=https://example.test/enterprise"', profile),
    "https://example.test/enterprises/Acme-Tools/settings");
  assert.equal(resolveContentLinkTarget('https://example.test/organizations/{{organization.slug}}', profile),
    "https://example.test/organizations/Platform-Team");
  assert.equal(resolveContentLinkTarget('https://example.test/enterprises/{{enterprise.slug}}/settings "fallback=https://example.test/enterprise"', {}),
    "https://example.test/enterprise");
  assert.equal(resolveContentLinkTarget("https://example.test/enterprises/{{enterprise.slug}}/settings", { enterpriseSlug: "acme/path" }), null);
  assert.match(renderMarkdown(template, profile), /href="https:\/\/example\.test\/enterprises\/Acme-Tools\/settings"/);
  assert.match(renderMarkdown(template, {}), /href="https:\/\/example\.test\/enterprise"/);
  assert.doesNotMatch(renderMarkdown("[Enterprise page](https://example.test/enterprises/{{enterprise.slug}}/settings)", {}), /<a /);
  assert.match(renderMarkdown("`[literal](https://example.test/{{enterprise.slug}})`", profile), /<code>\[literal\]\(https:\/\/example\.test\/\{\{enterprise\.slug\}\}\)<\/code>/);
  assert.match(renderMarkdown("[In-page](#local-anchor)", {}), /href="#local-anchor"/);

  const unknown = parse(source.replace("Read this fictional example.", "[Unknown](https://example.test/{{company.slug}})"));
  assert.ok(codes(unknown).includes("E_TEMPLATE_VAR"), JSON.stringify(unknown.diagnostics));
  const misplaced = parse(source.replace("Read this fictional example.", "Not a link: {{enterprise.slug}}."));
  assert.ok(codes(misplaced).includes("E_TEMPLATE_POSITION"), JSON.stringify(misplaced.diagnostics));
  const fallbackWithoutTemplate = parse(source.replace("Read this fictional example.", '[Static](https://example.test/ "fallback=https://example.test/other")'));
  assert.ok(codes(fallbackWithoutTemplate).includes("E_TEMPLATE_FALLBACK"), JSON.stringify(fallbackWithoutTemplate.diagnostics));
  const unsafeFallback = parse(source.replace("Read this fictional example.", '[Templated](https://example.test/{{enterprise.slug}} "fallback=https://user:pass@example.test/")'));
  assert.ok(codes(unsafeFallback).includes("E_LINK"), JSON.stringify(unsafeFallback.diagnostics));
});

test("repository links use validated profile names, default legacy profiles, and preserve explicit shared repositories", () => {
  const target = 'https://example.test/{{organization.slug}}/{{repository.name}}/settings "fallback=https://example.test/organizations"';
  const link = `[Repository Settings](${target})`;
  assert.deepEqual(parse(source.replace("Read this fictional example.", link)).diagnostics, []);
  assert.equal(resolveContentLinkTarget(target, { organizationSlug: "lab-org" }), "https://example.test/lab-org/pets-workshop/settings");
  assert.equal(resolveContentLinkTarget(target, { organizationSlug: "lab-org", repositoryName: "other.repo_name" }), "https://example.test/lab-org/other.repo_name/settings");
  for (const repositoryName of ["", null, ".", "..", "../other", "repo/name", "repo?x", "repo#x", "repo%2fother", "<script>", "a".repeat(101)]) {
    assert.equal(resolveContentLinkTarget(target, { organizationSlug: "lab-org", repositoryName }), "https://example.test/organizations", repositoryName);
    assert.equal(resolveContentLinkTarget(target.split(' "')[0], { organizationSlug: "lab-org", repositoryName }), null, repositoryName);
  }
  assert.equal(resolveContentLinkTarget(target, {}), "https://example.test/organizations");
  assert.equal(resolveContentLinkTarget("https://example.test/{{organization.slug}}/.github-private/blob/HEAD/file", {
    organizationSlug: "lab-org", repositoryName: "other",
  }), "https://example.test/lab-org/.github-private/blob/HEAD/file");
  assert.match(renderMarkdown(link, { organizationSlug: "lab-org" }), /href="https:\/\/example.test\/lab-org\/pets-workshop\/settings"/);
  assert.deepEqual(parse(source.replace("Read this fictional example.", "```sh profile\npwd {{repository.name}}\n```")).diagnostics, []);
  assert.deepEqual(parse(source.replace("Read this fictional example.", "```sh profile\nREPORT_ID={{input.report-id}}\n```")).diagnostics, []);
  assert.ok(codes(parse(source.replace("Read this fictional example.", "```sh profile\nREPORT_ID={{input.Report-ID}}\n```"))).includes("E_TEMPLATE_VAR"));
});

test("profile shell commands validate placeholders and safely personalize only opted-in fences", () => {
  const command = 'gh api "/enterprises/{{enterprise.slug}}/example" && gh api "/orgs/{{organization.slug}}/example"';
  const fence = "```sh profile\n" + command + "\n```";
  const profile = { enterpriseSlug: "Acme-Tools", organizationSlug: "Platform-Team" };
  assert.deepEqual(parse(source.replace("Read this fictional example.", fence)).diagnostics, []);
  assert.equal(resolveContentCommand(command, profile),
    'gh api "/enterprises/Acme-Tools/example" && gh api "/orgs/Platform-Team/example"');
  assert.equal(resolveContentCommand("gh repo view '{{organization.slug}}/{{repository.name}}'", {
    organizationSlug: "Platform-Team", repositoryName: "pets-workshop",
  }), "gh repo view 'Platform-Team/pets-workshop'");
  const inputCommand = "REPORT_ID={{input.report-id}}\nDOWNLOAD_URL={{input.download-url}}";
  assert.deepEqual(commandInputNames(inputCommand), ["report-id", "download-url"]);
  assert.equal(resolveContentCommand(inputCommand, profile, { "report-id": "id'with quote", "download-url": "https://example.test/report" }),
    "REPORT_ID='id'\\''with quote'\nDOWNLOAD_URL='https://example.test/report'");
  assert.equal(resolveContentCommand("{{input.report-id}}", profile, { "report-id": 42 }), "{{input.report-id}}");
  assert.equal(resolveContentCommand("{{input.report-id}}", profile, null), "{{input.report-id}}");
  assert.match(renderMarkdown(fence, profile), /\/enterprises\/Acme-Tools\/example/);
  assert.match(renderMarkdown(fence, profile), /\/orgs\/Platform-Team\/example/);
  assert.doesNotMatch(renderMarkdown(fence, profile).match(/<code[^>]*>([\s\S]*?)<\/code>/)[1], /\{\{/);
  assert.match(renderMarkdown(fence, {}), /\/enterprises\/YOUR-TEST-ENTERPRISE\/example/);
  assert.match(renderMarkdown(fence, { enterpriseSlug: "Valid", organizationSlug: "" }), /\/orgs\/YOUR-TEST-ORG\/example/);
  for (const value of ["$(touch /tmp/unsafe)", 'bad"; command', "bad/path", "<script>", "a".repeat(101)]) {
    assert.equal(resolveContentCommand("{{enterprise.slug}} {{organization.slug}}",
      { enterpriseSlug: value, organizationSlug: value }), "YOUR-TEST-ENTERPRISE YOUR-TEST-ORG");
  }
  assert.match(renderMarkdown(fence.replace("sh profile", "sh"), profile), /\{\{enterprise\.slug\}\}/);
  assert.match(renderMarkdown("`{{enterprise.slug}}`", profile), /\{\{enterprise\.slug\}\}/);
  assert.match(renderMarkdown("1. Command:\n\n" + fence.split("\n").map((line) => "   " + line).join("\n"), profile),
    /<li>[\s\S]*\/enterprises\/Acme-Tools\/example[\s\S]*<\/li>/);
  for (const placeholder of ["{{company.slug}}", "{{enterprise.slug}", "{{enterprise.slug}}}}"]) {
    const invalid = parse(source.replace("Read this fictional example.", fence.replace("{{enterprise.slug}}", placeholder)));
    assert.ok(invalid.diagnostics.some(({ code }) => ["E_TEMPLATE", "E_TEMPLATE_VAR"].includes(code)), JSON.stringify(invalid.diagnostics));
  }
});

test("Configure Additional steps subsection is exposed as its conclusion", () => {
  const withConclusion = parse(source.replace("## Validation", "### Additional steps\n\nClosing Configure guidance.\n\n## Validation"));
  assert.deepEqual(withConclusion.diagnostics, []);
  assert.equal(withConclusion.block.stages.configure.introduction, "");
  assert.equal(withConclusion.block.stages.configure.conclusion, "Closing Configure guidance.");
  const misplaced = parse(source.replace("### Recipe: shared-notes", "### Additional steps\n\nClosing guidance.\n\n### Recipe: shared-notes"));
  assert.ok(codes(misplaced).includes("E_SECTION"));
});

test("Additional steps cards preserve titles, order and safe Markdown without exercise identity", () => {
  const text = source.replace("## Validation", `### Additional steps

#### First baseline

1. Review the first fictional baseline.

#### Second baseline

1. Review the second fictional baseline.

## Validation`);
  const result = parse(text);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.block.stages.configure.conclusion, "");
  assert.deepEqual(result.block.stages.configure.additionalSteps.map(({ title, markdown }) => ({ title, markdown })), [
    { title: "First baseline", markdown: "1. Review the first fictional baseline." },
    { title: "Second baseline", markdown: "1. Review the second fictional baseline." },
  ]);
  assert.deepEqual(result.block.recipes, block.recipes);
  assert.ok(codes(parse(text.replace("1. Review the first fictional baseline.", ""))).includes("E_REQUIRED_SECTION"));
  assert.ok(codes(parse(text.replace("1. Review the first fictional baseline.", "**Target:** enterprise"))).includes("E_FIELD"));
  assert.ok(codes(parse(text.replace("1. Review the first fictional baseline.", "##### Nested heading\n\nNot supported."))).includes("E_HEADING"));
});

test("tilde and longer closing fences work; unclosed fences fail with source line", () => {
  assert.deepEqual(parse(source.replace("```markdown", "~~~~markdown").replace("```\n", "~~~~~\n")).diagnostics, []);
  const result = parse(source.replace("```\n", ""));
  const error = result.diagnostics.find((item) => item.code === "E_FENCE");
  assert.equal(error.line, 10);
});

test("zero, guidance-only, one, and multiple exercises resolve without invented completion", () => {
  const choices = { "EX-02": "ready" };
  assert.equal(resolveConfiguration(block, { "EX-01": "no-action" }).recipes.length, 0);
  const guidance = resolveConfiguration(block, { "EX-01": "notes", ...choices });
  assert.equal(guidance.guidance.length, 1);
  assert.equal(guidance.exercises.length, 0);
  const single = resolveConfiguration(block, { "EX-01": "inspect", ...choices });
  assert.equal(single.exercises.length, 1);
  assert.equal(single.exercises[0].eligible, true);
  const multiple = resolveConfiguration(block, { "EX-01": "mixed", ...choices });
  assert.deepEqual(multiple.recipes.map(({ recipe }) => recipe.id), ["shared-notes", "first-exercise", "second-exercise"]);
  assert.equal(multiple.exercises.length, 2);
  assert.deepEqual(multiple.exercises.map(({ validation }) => validation.exerciseId), ["EX-FIRST", "EX-SECOND"]);
  assert.deepEqual(multiple.guidance[0].selectedBy, [{ decisionId: "EX-01", optionId: "mixed" }, { decisionId: "EX-02", optionId: "ready" }]);
  assert.equal(multiple.exercises[0].warnings.length, 1);
  assert.equal(single.exercises[0].warnings.length, 0);
});

test("unanswered, unknown, and deferred choices never satisfy prerequisites or activate recipes", () => {
  for (const answer of [undefined, "review", "unknown"]) {
    const result = resolveConfiguration(block, { "EX-01": "inspect", "EX-02": answer });
    assert.equal(result.exercises[0].eligible, false);
    assert.deepEqual(result.exercises[0].missingDecisionIds, ["EX-02"]);
    assert.deepEqual(result.exercises[0].missingAnswers, [{ decisionId: "EX-02", optionId: "ready" }]);
    assert.ok(result.unresolvedDecisionIds.includes("EX-02"));
  }
  assert.equal(resolveConfiguration(block, { "EX-01": "review" }).recipes.length, 0);
});

test("answer recipe edits change Configure; unrelated prose does not", () => {
  const changed = parse(source.replace("**Configure:** first-exercise, shared-notes", "**Configure:** second-exercise")).block;
  assert.deepEqual(resolveConfiguration(changed, { "EX-01": "inspect" }).exercises.map(({ recipe }) => recipe.exerciseId), ["EX-SECOND"]);
  const proseOnly = parse(source.replace("Read this fictional example.", "Changed Understand prose only.")).block;
  assert.deepEqual(resolveConfiguration(proseOnly, { "EX-01": "inspect" }), resolveConfiguration(block, { "EX-01": "inspect" }));
  const validationOnly = parse(source.replace("Only the limited example is checked.", "An edited, still fictional expected result.")).block;
  assert.equal(validationOnly.validations[0].sections["Expected result"], "An edited, still fictional expected result.");
  assert.deepEqual(validationOnly.validations[1], block.validations[1]);
});

test("Validation variants follow the selected answer without changing exercise identity", () => {
  const conditional = source.replace(`### Exercise: EX-FIRST

#### Steps

1. Compare the observation with the example.

#### Expected result

Only the limited example is checked.

`, `### Exercise: EX-FIRST
**Variant decision:** EX-01

#### Variant: inspect

##### Steps

1. Verify the inspected example.

##### Expected result

The inspected example matches.

#### Variant: mixed

##### Steps

1. Verify the combined example.

##### Expected result

The combined example matches.

#### Variant: notes

##### Steps

1. Verify the notes example.

##### Expected result

The notes example matches.

#### Variant: no-action

##### Steps

1. Verify the unchanged example.

##### Expected result

The example remains unchanged.

`);
  const result = parse(conditional);
  assert.deepEqual(result.diagnostics, []);
  assert.equal("variants" in block.validations[0], false);
  assert.deepEqual(result.block.validations[0].variants.map(({ optionId }) => optionId), ["inspect", "mixed", "notes", "no-action"]);

  const inspect = resolveConfiguration(result.block, { "EX-01": "inspect", "EX-02": "ready" }).exercises[0];
  const mixed = resolveConfiguration(result.block, { "EX-01": "mixed", "EX-02": "ready" }).exercises[0];
  assert.equal(inspect.recipe.exerciseId, "EX-FIRST");
  assert.equal(inspect.validation.activeVariant.optionId, "inspect");
  assert.equal(inspect.validation.sections.Steps, "1. Verify the inspected example.");
  assert.equal(resolveValidationVariant(result.block, result.block.validations[0], {}), null);
  assert.equal(resolveValidationVariant(result.block, result.block.validations[0], { "EX-01": "review" }), null);
  assert.equal(resolveValidationVariant(result.block, result.block.validations[0], { "EX-01": "notes" }).optionId, "notes");
  assert.equal(mixed.recipe.exerciseId, inspect.recipe.exerciseId);
  assert.equal(mixed.validation.activeVariant.optionId, "mixed");
  assert.equal(mixed.validation.sections["Expected result"], "The combined example matches.");

  const missingVariant = parse(conditional.replace("#### Variant: no-action", "#### Variant: review"));
  assert.ok(codes(missingVariant).includes("E_VARIANT"));
  const missingRequiredDecision = parse(conditional.replace("**Requires decisions:** EX-01, EX-02", "**Requires decisions:** EX-02"));
  assert.ok(codes(missingRequiredDecision).includes("E_VARIANT"));
  const incompleteVariant = parse(conditional.replace("##### Expected result\n\nThe inspected example matches.", "##### Expected result\n\n"));
  assert.ok(codes(incompleteVariant).includes("E_REQUIRED_SECTION"));
  const obsoleteEvidence = parse(conditional.replace("##### Expected result\n\nThe inspected example matches.", "##### Evidence\n\nRecord the result."));
  assert.ok(codes(obsoleteEvidence).includes("E_SECTION"));
});

test("explicit cross-choice conflicts block both recipes while retaining the requested collection", () => {
  const changed = source
    .replace("**Requires answers:** EX-02.ready", "**Requires answers:** EX-02.ready\n**Conflicts with:** second-exercise")
    .replace("**Exercise ID:** EX-SECOND", "**Exercise ID:** EX-SECOND\n**Conflicts with:** first-exercise")
    .replace("**Configure:** shared-notes, second-exercise, first-exercise", "**Configure:** second-exercise")
    .replace("**Configure:** shared-notes\n\nYes", "**Configure:** first-exercise\n\nYes");
  const result = parse(changed);
  assert.deepEqual(result.diagnostics, []);
  const resolved = resolveConfiguration(result.block, { "EX-01": "mixed", "EX-02": "ready" });
  assert.equal(resolved.exercises.length, 2);
  assert.ok(resolved.exercises.every((entry) => !entry.eligible && entry.conflicts.length === 1));
});

const invalidCases = [
  ["unknown metadata", "**Description:** Fictional", "**Surprise:** Fictional", "E_FIELD"],
  ["multiple deferred options", "**Label:** Inspect\n**Configure:** first-exercise", "**Label:** Inspect\n**Deferred:** true\n**Configure:** none", "E_OPTIONS"],
  ["unsupported version", "**Format version:** 1", "**Format version:** 7", "E_VERSION"],
  ["duplicate metadata", "**Target:** repository", "**Target:** repository\n**Target:** none", "E_DUPLICATE_FIELD"],
  ["unknown recipe", "**Configure:** first-exercise, shared-notes", "**Configure:** missing-recipe", "E_RECIPE_REF"],
  ["unknown policy", "**Policies:** user.example", "**Policies:** user.missing", "E_POLICY_REF"],
  ["unknown required decision", "**Requires decisions:** EX-01, EX-02", "**Requires decisions:** EX-404", "E_DECISION_REF"],
  ["unknown required answer", "**Requires answers:** EX-02.ready", "**Requires answers:** EX-02.missing", "E_ANSWER_REF"],
  ["deferred required answer", "**Requires answers:** EX-02.ready", "**Requires answers:** EX-02.review", "E_ANSWER_REF"],
  ["contradictory requirements", "**Requires answers:** EX-02.ready", "**Requires answers:** EX-01.inspect, EX-01.mixed", "E_REQUIREMENT"],
  ["deferred activation", "**Configure:** none\n**Deferred:** true", "**Configure:** shared-notes\n**Deferred:** true", "E_DEFERRED"],
  ["boolean type", "**Deferred:** true", "**Deferred:** yes", "E_TYPE"],
  ["duplicate option", "#### Option: notes", "#### Option: inspect", "E_DUPLICATE_ID"],
  ["duplicate decision", "### Decision: EX-02", "### Decision: EX-01", "E_DUPLICATE_ID"],
  ["duplicate recipe", "### Recipe: first-exercise", "### Recipe: shared-notes", "E_DUPLICATE_ID"],
  ["duplicate exercise", "**Exercise ID:** EX-SECOND", "**Exercise ID:** EX-FIRST", "E_DUPLICATE_ID"],
  ["orphan validation", "### Exercise: EX-SECOND", "### Exercise: EX-ORPHAN", "E_VALIDATION_ORPHAN"],
  ["missing validation", "### Exercise: EX-SECOND", "### Exercise: EX-ORPHAN", "E_VALIDATION_MISSING"],
  ["empty required subsection", "Only the limited example is checked.", "", "E_REQUIRED_SECTION"],
  ["unknown section", "#### Safety", "#### Something else", "E_SECTION"],
  ["retired decision scenario", "#### Question", "#### Scenario\n\nA retired scenario.\n\n#### Question", "E_SECTION"],
  ["unknown recipe kind", "**Kind:** guidance", "**Kind:** executable", "E_KIND"],
  ["guidance with controls", "**Kind:** guidance", "**Kind:** guidance\n**Exercise ID:** EX-NO", "E_GUIDANCE"],
  ["retired exercise kind", "**Exercise ID:** EX-SECOND", "**Exercise ID:** EX-SECOND\n**Exercise kind:** inspection", "E_FIELD"],
  ["unknown target", "**Target:** repository", "**Target:** https://example.test", "E_TARGET"],
  ["metadata after prose", "**Label:** Inspect\n**Configure:**", "**Label:** Inspect\nProse starts here.\n**Configure:**", "E_METADATA_POSITION"],
  ["malformed metadata", "**Label:** Inspect", "**Label:**Inspect", "E_METADATA"],
  ["duplicate recipe references", "**Configure:** first-exercise, shared-notes", "**Configure:** shared-notes, shared-notes", "E_LIST"],
  ["unsafe link", "Read this fictional example.", "[unsafe](javascript:alert)", "E_LINK"],
  ["relative link", "Read this fictional example.", "[unsupported](../other.md)", "E_LINK"],
  ["raw HTML", "Read this fictional example.", "<script>bad</script>", "E_MARKDOWN"],
  ["image", "Read this fictional example.", "![image](https://example.test/image.png)", "E_MARKDOWN"],
  ["reference link", "Read this fictional example.", "[link][reference]", "E_MARKDOWN"],
  ["heading jump", "#### Question", "##### Question", "E_HEADING"],
  ["heading order", "## Understand", "## Configure", "E_STAGES"],
  ["reserved source anchor collision", "Read this fictional example.", "### Decisions\n\nA conflicting anchor.", "E_ANCHOR"],
  ["metadata in prose subheading", "Read this fictional example.", "### Ordinary heading\n**Unknown:** unsupported", "E_FIELD"],
  ["no policy recipe", "**Kind:** guidance\n**Policies:** user.example", "**Kind:** guidance\n**Policies:** none", "E_POLICY_REF"],
  ["unknown form type", "**Type:** textarea", "**Type:** execute", "E_FORM"],
  ["invalid select options", "**Type:** textarea", "**Type:** select\n**Options:** only-one", "E_FORM"],
  ["fictional marker missing", "**Fictional:** true", "**Fictional:** false", "E_DATASET"],
  ["ragged dataset", "| beta | 5 |", "| beta | 5 | extra |", "E_DATASET"],
  ["duplicate dataset columns", "| group | count |", "| group | group |", "E_DATASET"],
  ["invalid warning", "**When:** EX-01.mixed, EX-02.ready", "**When:** EX-01.mixed, EX-01.inspect", "E_WARNING"],
  ["unknown conflict", "**Target:** repository", "**Target:** repository\n**Conflicts with:** unknown", "E_CONFLICT"],
  ["non-official API documentation", "**Kind:** guidance\n**Policies:** user.example", "**Kind:** guidance\n**Policies:** user.example\n**API:** https://example.test/rest/copilot", "E_API"],
  ["API documentation outside the API reference", "**Kind:** guidance\n**Policies:** user.example", "**Kind:** guidance\n**Policies:** user.example\n**API:** https://docs.github.com/en/copilot", "E_API"],
];
test("recipe API metadata records documented availability or explicit absence", () => {
  const none = parse(source.replace("**Kind:** guidance\n**Policies:** user.example", "**Kind:** guidance\n**Policies:** user.example\n**API:** none"));
  assert.deepEqual(none.diagnostics, []);
  assert.deepEqual(none.block.recipes.find((item) => item.kind === "guidance").api, { available: false, url: null });
  const url = "https://docs.github.com/en/rest/copilot/copilot-user-management";
  const documented = parse(source.replace("**Kind:** guidance\n**Policies:** user.example", `**Kind:** guidance\n**Policies:** user.example\n**API:** ${url}`));
  assert.deepEqual(documented.diagnostics, []);
  assert.deepEqual(documented.block.recipes.find((item) => item.kind === "guidance").api, { available: true, url });
  assert.equal(block.recipes.find((item) => item.kind === "guidance").api, null);
});
test("retired decision Scenario sections point authors to Guidance", () => {
  const result = parse(source.replace("#### Question", "#### Scenario\n\nA retired scenario.\n\n#### Question"));
  assert.ok(result.diagnostics.some((item) => item.code === "E_SECTION" && /move this prose into #### Guidance/.test(item.hint)), JSON.stringify(result.diagnostics));
});
for (const [name, before, after, expected] of invalidCases) {
  test(`rejects ${name} with actionable diagnostics`, () => {
    assert.ok(source.includes(before), `test mutation must match: ${before}`);
    const mutated = source.replace(before, after);
    for (const text of [mutated, mutated.replace(/\n/g, "\r\n")]) {
      const result = parse(text);
      assert.ok(codes(result).includes(expected), JSON.stringify(result.diagnostics));
      for (const item of result.diagnostics) {
        assert.equal(item.file, "content/example-block.md");
        assert.ok(Number.isInteger(item.line) && item.line > 0);
        assert.ok(item.message && item.hint && item.section);
      }
    }
  });
}

test("E_OPTIONS rejects a decision with only one resolved option", () => {
  const invalid = source
    .replace("**Label:** Two examples\n**Configure:** shared-notes, second-exercise, first-exercise",
      "**Label:** Two examples\n**Deferred:** true\n**Configure:** none")
    .replace("**Label:** Read guidance\n**Configure:** shared-notes", "**Label:** Read guidance\n**Deferred:** true\n**Configure:** none")
    .replace("**Label:** Nothing to configure\n**Configure:** none", "**Label:** Nothing to configure\n**Deferred:** true\n**Configure:** none");
  assert.ok(parse(invalid).diagnostics.some(({ code }) => code === "E_OPTIONS"));
});

test("E_OPTIONS explains the deferred-option maximum and repair", () => {
  const invalid = source
    .replace("**Label:** Inspect\n**Configure:** first-exercise", "**Label:** Inspect\n**Deferred:** true\n**Configure:** none")
    .replace("**Label:** Analyze\n**Configure:** second-exercise", "**Label:** Analyze\n**Deferred:** true\n**Configure:** none");
  const diagnostic = parse(invalid).diagnostics.find(({ code }) => code === "E_OPTIONS");
  assert.match(diagnostic.message, /at most one deferred option/);
  assert.match(diagnostic.hint, /remove extra deferred options/);
});

test("source locations and fingerprints support stage links, staleness, and CRLF", () => {
  const locations = STAGES.map((stage) => stageSource(block, stage, catalog));
  assert.deepEqual(locations.map((item) => item.anchor), STAGES);
  assert.deepEqual(locations.map((item) => item.line), [6, 15, 87, 157]);
  for (const location of locations) {
    assert.equal(location.file, "content/example-block.md");
    assert.ok(location.endLine >= location.line);
    assert.match(location.fingerprint, /^sha256:[a-f0-9]{64}$/);
  }
  const fingerprint = (candidate, stage, policies = catalog) => stageSource(candidate, stage, policies).fingerprint;
  const changed = parse(source.replace("Read this fictional example.", "Changed introductory prose.")).block;
  assert.notEqual(fingerprint(changed, "understand"), fingerprint(block, "understand"));
  for (const stage of STAGES.slice(1)) assert.equal(fingerprint(changed, stage), fingerprint(block, stage));
  const policyEdit = structuredClone(catalog);
  policyEdit.policies[0].name = "Edited fictional metadata";
  for (const stage of STAGES) assert.notEqual(fingerprint(block, stage, policyEdit), fingerprint(block, stage));
  const unrelated = structuredClone(catalog);
  unrelated.policies.push({ ...catalog.policies[0], id: "user.unrelated" });
  for (const stage of STAGES) assert.equal(fingerprint(block, stage, unrelated), fingerprint(block, stage));
  const linked = parse(source.replace("**Configure:** first-exercise, shared-notes", "**Configure:** second-exercise")).block;
  for (const stage of ["decisions", "configure", "validation"]) assert.notEqual(fingerprint(linked, stage), fingerprint(block, stage));
  assert.equal(fingerprint(linked, "understand"), fingerprint(block, "understand"));
  const reordered = { policies: catalog.policies.map((policy) => Object.fromEntries(Object.entries(policy).reverse())), schemaVersion: 1 };
  assert.equal(fingerprint(block, "understand", reordered), fingerprint(block, "understand"));
  assert.throws(() => stageSource(block, "unknown", catalog), /Unknown/);
});

test("catalog validation rejects unknown fields, bad IDs, types and unsafe official source URLs", () => {
  assert.deepEqual(validatePolicyCatalog(catalog), []);
  for (const candidate of [null, [], {}, { schemaVersion: 1, policies: [null] }, { schemaVersion: 1, policies: [{ id: { toString: null } }] }]) assert.ok(validatePolicyCatalog(candidate).length);
  for (const url of ["http://docs.github.com/en", "https://docs.github.com.evil.test/en", "https://user:pass@docs.github.com/en", "https://docs.github.com:444/en", "https://github.blog/not-changelog/"]) {
    const changed = structuredClone(catalog);
    changed.policies[0].documentation[0].url = url;
    assert.ok(validatePolicyCatalog(changed).some((item) => item.code === "E_SOURCE"));
  }
  const changed = structuredClone(catalog);
  changed.policies.push(changed.policies[0]);
  changed.policies[0].execute = "not allowed";
  changed.policies[0].scope = "unknown";
  changed.policies[0].knownLimitations = [];
  assert.ok(validatePolicyCatalog(changed).length >= 4);
});

test("manifest rejects old versions, traversal, unknown fields and duplicate blocks", () => {
  for (const sourcePath of ["../outside.md", "/absolute.md", "subdir/example-block.md", "example-block.json"]) {
    const result = validateManifest({ version: 3, title: "Example", blocks: [{ id: "example-block", source: sourcePath }] });
    assert.ok(result.some((item) => item.code === "E_MANIFEST"));
  }
  assert.equal(validateManifest({ version: 2, paths: [] })[0].code, "E_MIGRATION_REQUIRED");
  const entry = { id: "example-block", source: "example-block.md" };
  const result = validateManifest({ version: 3, title: "Example", blocks: [entry, entry], status: "approved" });
  assert.ok(result.some((item) => item.code === "E_DUPLICATE_ID"));
  assert.ok(result.some((item) => item.code === "E_FIELD"));
});

test("parser enforces input size without executing input or requiring a server", () => {
  assert.equal(parse("x".repeat(LIMITS.bytes + 1)).diagnostics[0].code, "E_SIZE");
  assert.equal(parseWorkshopMarkdown(null).diagnostics[0].code, "E_SIZE");
});

async function snapshot(directory) {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), info = await stat(path);
    if (info.isDirectory()) result.push(...await snapshot(path));
    else result.push([path, info.mtimeMs, info.mode, createHash("sha256").update(await readFile(path)).digest("hex")]);
  }
  return result;
}

test("offline CLI validates all active files, supports --file, and is read-only", async () => {
  const before = await snapshot(fixtures);
  const all = cli("--root", validRoot);
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /Validated 2 Markdown block/);
  const single = cli("--root", validRoot, "--file", "content/example-block.md");
  assert.equal(single.status, 0, single.stderr);
  assert.match(single.stdout, /Validated 1 Markdown block/);
  assert.deepEqual(await snapshot(fixtures), before);
});

test("CLI invalid fixture reports several precise repair diagnostics and exit 1", () => {
  const result = cli("--root", join(fixtures, "invalid"));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /content\/broken-block\.md:5 error\[E_FIELD\]/);
  assert.match(result.stderr, /content\/broken-block\.md:23 error\[E_RECIPE_REF\] BAD-01\.inspect/);
  assert.match(result.stderr, /E_VALIDATION_MISSING/);
  assert.match(result.stderr, /Hint:/);
  assert.equal(result.stdout, "");
});

test("CLI distinguishes malformed content from invocation/read failures", () => {
  assert.equal(cli("--root", join(fixtures, "malformed")).status, 1);
  assert.match(cli("--root", join(fixtures, "malformed")).stderr, /E_JSON/);
  for (const args of [["--wat"], ["--file"], ["--root", validRoot, "--root", validRoot], ["--file", "not-markdown.json"], ["--root", "not-a-real-workshop-directory"]]) {
    const result = cli(...args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /E_INVOCATION|E_READ/);
  }
  assert.equal(cli("--help").status, 0);
});

test("single-file validation works outside the manifest, and still checks catalog references", () => {
  const result = cli("--root", validRoot, "--file", "../invalid/content/broken-block.md");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_RECIPE_REF/);
  assert.doesNotMatch(result.stderr, /E_MANIFEST|E_MIGRATION_REQUIRED/);
});

test("legacy manifests fail explicitly without attempting JSON block fallback", () => {
  const result = cli("--root", join(fixtures, "legacy"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_MIGRATION_REQUIRED/);
  assert.doesNotMatch(result.stderr, /E_READ/);
});

test("default validation catches cross-block identity collisions that single-file mode cannot", () => {
  const result = cli("--root", join(fixtures, "duplicate"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /second-block\.md:10 error\[E_DUPLICATE_ID\]/);
  assert.equal(cli("--root", join(fixtures, "duplicate"), "--file", "content/second-block.md").status, 0);
});

test("bounded variants cover one resolved decision and select authored steps without changing exercise identity", () => {
  const variants = ["inspect", "mixed", "notes", "no-action"].map((id) =>
    `#### Variant: ${id}\n\n##### Scope\n\nFictional scope\n\n##### Steps\n\n1. Inspect the ${id} example.\n\n`).join("");
  const text = source.replace("**Target:** repository", "**Target:** repository\n**Variant decision:** EX-01")
    .replace("### Recipe: second-exercise", `${variants}### Recipe: second-exercise`);
  const parsed = parse(text);
  assert.deepEqual(parsed.diagnostics, []);
  const result = resolveConfiguration(parsed.block, { "EX-01": "inspect", "EX-02": "ready" });
  assert.equal(result.exercises[0].recipe.exerciseId, "EX-FIRST");
  assert.equal(result.exercises[0].variant.optionId, "inspect");
  assert.match(result.exercises[0].variant.sections.Steps, /inspect example/);
  assert.ok(parse(text.replace("#### Variant: notes\n\n##### Scope\n\nFictional scope\n\n##### Steps\n\n1. Inspect the notes example.\n\n", "")).diagnostics.some((item) => item.code === "E_VARIANT"));
  assert.ok(parse(text.replace("**Variant decision:** EX-01", "**Variant decision:** EX-404")).diagnostics.some((item) => item.code === "E_VARIANT"));
});
