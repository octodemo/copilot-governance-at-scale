import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  parseWorkshopMarkdown, indexPlanningCatalog, catalogCoverage, exerciseFingerprint, loadWorkshopContent,
} from "../../lib/workshop-content.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const validRoot = join(repository, "tests/content-validation/fixtures/content-format/valid");
const source = (await readFile(join(validRoot, "content/example-block.md"), "utf8")).replace(/\r\n/g, "\n");
const catalog = JSON.parse(await readFile(join(validRoot, "content/policy-catalog.json"), "utf8"));
const CSV = `id,name,block,removed
example.first-setting,First fictional setting,example-block,
example.second-setting,Second fictional setting,example-block,
example.retired-setting,Retired fictional setting,example-block,yes
other.setting,Other fictional setting,empty-block,
`;
const { planning } = indexPlanningCatalog(CSV);
const parse = (text, options = { catalog, planning }) => parseWorkshopMarkdown(text, { file: "content/example-block.md", ...options });
const codes = (result) => result.diagnostics.map((item) => item.code);
const withIds = (decision, recipe) => source
  .replace("### Decision: EX-01\n", `### Decision: EX-01\n\n**Catalog IDs:** ${decision}\n`)
  .replace("### Recipe: first-exercise\n", `### Recipe: first-exercise\n\n**Catalog IDs:** ${recipe}\n`);

test("Catalog IDs parse on decisions, recipes and Additional steps cards without changing exercise identity", () => {
  const base = parse(source);
  const text = withIds("example.first-setting, example.second-setting", "example.first-setting").replace("## Validation", `### Additional steps

#### Fictional baseline

**Catalog IDs:** example.second-setting

1. Review the fictional baseline.

## Validation`);
  const result = parse(text);
  assert.deepEqual(result.diagnostics, []);
  const decision = result.block.decisions.find((item) => item.id === "EX-01");
  assert.deepEqual(decision.catalogIds, ["example.first-setting", "example.second-setting"]);
  assert.ok(decision.catalogSource.line > decision.source.line);
  const recipe = result.block.recipes.find((item) => item.id === "first-exercise");
  assert.deepEqual(recipe.catalogIds, ["example.first-setting"]);
  const [step] = result.block.stages.configure.additionalSteps;
  assert.deepEqual(step.catalogIds, ["example.second-setting"]);
  assert.equal(step.markdown, "1. Review the fictional baseline.");
  assert.deepEqual(base.block.recipes.find((item) => item.id === "shared-notes").catalogIds, []);
  const before = base.block.recipes.find((item) => item.id === "first-exercise");
  assert.equal(exerciseFingerprint(result.block, recipe, catalog), exerciseFingerprint(base.block, before, catalog));
  assert.deepEqual(catalogCoverage([result.block]), Object.assign(Object.create(null), {
    "example.first-setting": [
      { block: "example-block", stage: "decisions", kind: "decision", id: "EX-01" },
      { block: "example-block", stage: "configure", kind: "recipe", id: "first-exercise" },
    ],
    "example.second-setting": [
      { block: "example-block", stage: "decisions", kind: "decision", id: "EX-01" },
      { block: "example-block", stage: "configure", kind: "additional-step", id: "Fictional baseline" },
    ],
  }));
});

test("coverage accumulates constructor references without inherited entries", () => {
  const { planning } = indexPlanningCatalog(`${CSV}constructor,Fictional constructor setting,example-block,\n`);
  const result = parse(withIds("constructor", "constructor"), { catalog, planning });
  assert.deepEqual(result.diagnostics, []);
  const coverage = catalogCoverage([result.block]);
  assert.equal(Object.getPrototypeOf(coverage), null);
  assert.deepEqual(coverage.constructor, [
    { block: "example-block", stage: "decisions", kind: "decision", id: "EX-01" },
    { block: "example-block", stage: "configure", kind: "recipe", id: "first-exercise" },
  ]);
  const empty = catalogCoverage([]);
  assert.equal(Object.getPrototypeOf(empty), null);
  assert.equal(empty.constructor, undefined);
});

test("none records an explicit no-row decision and cannot be mixed with IDs", () => {
  const result = parse(withIds("none", "none"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.block.decisions[0].catalogIds, []);
  assert.ok(codes(parse(withIds("none, example.first-setting", "none"))).includes("E_LIST"));
});

test("unknown, runtime, removed and malformed catalog IDs fail once each with precise repair hints", () => {
  const result = parse(withIds("example.first-seting, user.example, example.retired-setting", "Bad ID, example.first-setting, example.first-setting"));
  const byCode = (code) => result.diagnostics.filter((item) => item.code === code);
  const refs = byCode("E_CATALOG_REF");
  assert.equal(refs.length, 2, JSON.stringify(result.diagnostics));
  assert.match(refs[0].hint, /Did you mean "example\.first-setting"\?/);
  assert.match(refs[0].hint, /example-block rows: example\.first-setting, example\.second-setting\./);
  assert.match(refs[1].hint, /"user\.example" is a runtime policy ID from policy-catalog\.json/);
  assert.equal(refs[0].section, "Decision: EX-01");
  assert.equal(byCode("E_CATALOG_REMOVED").length, 1);
  const list = byCode("E_LIST");
  assert.equal(list.length, 1);
  assert.equal(list[0].section, "Recipe: first-exercise");
  assert.match(list[0].message, /"Bad ID", "example\.first-setting"/);
  for (const item of result.diagnostics) {
    assert.equal(item.file, "content/example-block.md");
    assert.ok(Number.isInteger(item.line) && item.line > 1);
  }
  const lines = withIds("example.first-seting", "none").split("\n");
  assert.match(lines[parse(withIds("example.first-seting", "none")).diagnostics[0].line - 1], /^\*\*Catalog IDs:\*\*/);
});

test("Catalog IDs are not checked without a planning catalog, and unsupported placement fails", () => {
  assert.deepEqual(parse(withIds("anything.unknown", "none"), { catalog }).diagnostics, []);
  assert.ok(source.includes("### Exercise: EX-FIRST\n"));
  const misplaced = source.replace("### Exercise: EX-FIRST\n", "### Exercise: EX-FIRST\n\n**Catalog IDs:** example.first-setting\n");
  assert.ok(parse(misplaced).diagnostics.length > 0);
});

test("planning catalog index reports parse, column and ID problems with locations", () => {
  assert.deepEqual(indexPlanningCatalog(CSV).diagnostics, []);
  assert.equal(planning.byId.get("example.retired-setting").removed, true);
  const missing = indexPlanningCatalog("id,name\nexample.a,A\n");
  assert.equal(missing.planning, null);
  assert.ok(missing.diagnostics.every((item) => item.code === "E_PLANNING_CATALOG" && item.line === 1));
  const bad = indexPlanningCatalog("id,block,removed\nexample.a,x,\nexample.a,x,\nBad Id,x,\n");
  assert.deepEqual(bad.diagnostics.map((item) => [item.line, item.code]), [[3, "E_PLANNING_CATALOG"], [4, "E_PLANNING_CATALOG"]]);
  assert.equal(indexPlanningCatalog('id,block,removed\n"unterminated,x,\n').diagnostics[0].code, "E_PLANNING_CATALOG");
});

test("loader validates the planning CSV only when present and required, and can opt out", async () => {
  const root = await mkdtemp(join(tmpdir(), "catalog-ids-"));
  try {
    await cp(validRoot, root, { recursive: true });
    await writeFile(join(root, "content/example-block.md"), withIds("example.first-setting", "example.missing"));
    const missing = await loadWorkshopContent({ root });
    assert.deepEqual(missing.diagnostics.map((item) => item.code), ["E_PLANNING_MISSING"]);
    assert.equal((await loadWorkshopContent({ root, planningFile: null })).diagnostics.length, 0);
    await writeFile(join(root, "content/policy-catalog.csv"), CSV);
    const checked = await loadWorkshopContent({ root });
    assert.deepEqual(checked.diagnostics.map((item) => item.code), ["E_CATALOG_REF"]);
    assert.equal(checked.planning.rows.length, 4);
    await writeFile(join(root, "content/policy-catalog.csv"), "id,name\n");
    assert.ok((await loadWorkshopContent({ root })).diagnostics.some((item) => item.code === "E_PLANNING_CATALOG"));
    assert.deepEqual((await loadWorkshopContent({ root, planningFile: null })).diagnostics, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("none in a mixed list gets only E_LIST, and repeated unknown IDs are reported once", () => {
  const mixed = parse(withIds("none, example.first-setting", "none"));
  assert.equal(codes(mixed).filter((code) => code === "E_CATALOG_REF").length, 0);
  assert.ok(codes(mixed).includes("E_LIST"));
  const repeated = parse(withIds("example.nope, example.nope", "none"));
  assert.equal(codes(repeated).filter((code) => code === "E_CATALOG_REF").length, 1);
  const removed = parse(withIds("example.retired-setting, example.retired-setting", "none"));
  assert.equal(codes(removed).filter((code) => code === "E_CATALOG_REMOVED").length, 1);
  assert.ok(codes(removed).includes("E_LIST"));
});

test("planning CSV diagnostics use physical lines across quoted multiline notes and blank records", () => {
  const text = 'id,name,block,removed\n\n"a.one","multi\nline",example-block,\nBAD ID,x,example-block,\n';
  for (const newline of ["\n", "\r\n", "\r"]) {
    const { diagnostics, planning } = indexPlanningCatalog(text.replaceAll("\n", newline));
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].line, 5);
    assert.equal(planning.byId.get("a.one").line, 3);
    const duplicate = indexPlanningCatalog(text.replace("BAD ID", "a.one").replaceAll("\n", newline));
    assert.equal(duplicate.diagnostics[0].line, 5);
  }
  const width = indexPlanningCatalog("id,name,block,removed\na.one,x,example-block,\nshort,row\n").diagnostics[0];
  assert.equal(width.line, 3);
});

test("catalog without a policies array does not crash planning reference validation", () => {
  const result = parse(withIds("example.first-setting", "none"), { catalog: { schemaVersion: 1, policies: {} }, planning });
  assert.ok(Array.isArray(result.diagnostics));
});

test("loader retains E_CATALOG when policies is an object and planning references exist", async () => {
  const root = await mkdtemp(join(tmpdir(), "invalid-runtime-catalog-"));
  try {
    await cp(validRoot, root, { recursive: true });
    await writeFile(join(root, "content/example-block.md"), withIds("example.first-setting", "none"));
    await writeFile(join(root, "content/policy-catalog.csv"), CSV);
    await writeFile(join(root, "content/policy-catalog.json"), JSON.stringify({ schemaVersion: 1, policies: {} }));
    const result = await loadWorkshopContent({ root });
    assert.ok(codes(result).includes("E_CATALOG"));
    assert.equal(result.blocks.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
