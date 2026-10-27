#!/usr/bin/env node
// Read-only author report: which planning catalog rows each block covers yet.
// Gaps are expected while content is being written, so they are notes, not errors.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogCoverage, indexPlanningCatalog, loadWorkshopContent } from "../lib/workshop-content.mjs";

export const NOT_APPLICABLE = /^not applicable in the lab\b/i;

export function coverageReport(blocks, planning) {
  const references = catalogCoverage(blocks);
  const status = (id) => {
    const refs = references[id] ?? [];
    return refs.some((ref) => ref.stage === "configure") ? "configured" : refs.length ? "decision only" : "not yet";
  };
  return blocks.map((block) => {
    const rows = planning.rows.filter((row) => !row.removed && row.block === block.id);
    const entries = rows.map((row) => ({ id: row.id, name: row.name, status: status(row.id), notApplicable: NOT_APPLICABLE.test(row.notes.trim()) }));
    return { block: block.id, title: block.title, entries };
  });
}

export function formatReport(report) {
  const lines = [];
  for (const { block, title, entries } of report) {
    const configured = entries.filter((entry) => entry.status === "configured").length;
    lines.push(`${title} (${block}): ${configured} of ${entries.length} catalog rows configured`);
    for (const entry of entries.filter((item) => item.status !== "configured")) {
      const label = entry.notApplicable ? `${entry.status}, not applicable in the lab` : entry.status;
      lines.push(`  - ${entry.id} (${label}): ${entry.name}`);
    }
  }
  lines.push("", "Rows that are not configured yet are expected while content is in progress. This is a planning note, not a validation error.");
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] === "--root" && process.argv[3] ? process.argv[3] : process.cwd();
  try {
    const result = await loadWorkshopContent({ root });
    if (result.diagnostics.length) console.error(`Note: content has ${result.diagnostics.length} validation error(s); run node scripts/validate-content.mjs. Coverage below uses what could be parsed.\n`);
    const { planning, diagnostics } = indexPlanningCatalog(await readFile(resolve(root, "content/policy-catalog.csv"), "utf8"));
    if (!planning) throw new Error(diagnostics.map((item) => item.message).join(" "));
    console.log(formatReport(coverageReport(result.blocks, planning)));
  } catch (error) {
    console.error(`Cannot build the coverage report: ${error.message}`);
    process.exitCode = 2;
  }
}
