import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadWorkshopContent, STAGES, stageSource } from "../../lib/workshop-content.mjs";
import { parseCsv } from "../../lib/csv.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const blockIds = [
  "access-management", "user-governance", "billing-cost-control", "agent-governance",
  "context-management", "observability",
];

test("the six workshop blocks have one active Markdown source and four author links", async () => {
  const result = await loadWorkshopContent({ root });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.blocks.map((block) => block.id), blockIds);
  for (const block of result.blocks) {
    assert.equal(block.source.file, `content/${block.id}.md`);
    for (const stage of STAGES) {
      const source = stageSource(block, stage, result.catalog);
      assert.equal(source.file, block.source.file);
      assert.equal(source.anchor, stage);
      assert.match(source.fingerprint, /^sha256:[a-f0-9]{64}$/);
    }
    await assert.rejects(access(new URL(`../../content/${block.id}.json`, import.meta.url)), { code: "ENOENT" });
  }
});

test("the canonical planning catalog retains stable IDs and the six-block taxonomy", async () => {
  const [header, ...rows] = parseCsv(await readFile(new URL("../../content/policy-catalog.csv", import.meta.url), "utf8"));
  for (const column of ["id", "name", "block", "location", "docs", "api", "notes", "removed"]) {
    assert.ok(header.includes(column), `Missing column ${column}`);
  }
  const ids = rows.map((row) => row[header.indexOf("id")]);
  assert.equal(new Set(ids).size, rows.length);
  assert.ok(ids.every(Boolean));
  for (const row of rows) {
    assert.ok(blockIds.includes(row[header.indexOf("block")]), `Unknown block for ${row[0]}`);
  }
});

test("retired canvases, content roots and inventory tooling are absent", async () => {
  for (const path of [
    ".github/extensions/copilot-at-scale-lab", "contents", "content/understand",
    "scripts/sync-policy-catalog.mjs", "scripts/validate-inventory.py", "scripts/test_validate_inventory.py",
  ]) {
    await assert.rejects(access(new URL(`../../${path}`, import.meta.url)), { code: "ENOENT" });
  }
});
