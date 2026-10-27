import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { parseWorkshopMarkdown, exerciseFingerprint } from "../../lib/workshop-content.mjs";
import { emptyLab } from "../../.github/extensions/governance-lab/legacy-model.mjs";
import legacyContent from "../../.github/extensions/governance-lab/legacy-content.mjs";
import legacyExerciseFingerprints from "../../.github/extensions/governance-lab/legacy-exercise-fingerprints.mjs";

export const content = await loadContent();
export function withoutLegacyEvidenceSections(source) {
  let skipping = false;
  return source.split("\n").filter((line) => {
    if (/^#### Evidence\s*$/.test(line)) { skipping = true; return false; }
    if (skipping && /^#{1,4}\s/.test(line)) skipping = false;
    return !skipping;
  }).join("\n");
}
// Current content with Access Management replaced by the superseded AM-01 to AM-04 meanings, for migrations of earlier saved state.
export const accessV1Content = await (async () => {
  const source = await readFile(new URL("./fixtures/access-before-assignment-decisions.md", import.meta.url), "utf8");
  const catalog = { schemaVersion: 1, policies: content.policies };
  const migratedSource = withoutLegacyEvidenceSections(source.slice(source.indexOf("# Access Management")));
  const parsed = parseWorkshopMarkdown(migratedSource, { file: "access-management.md", catalog });
  if (parsed.diagnostics.length) throw new Error(`Superseded Access Management draft no longer parses: ${parsed.diagnostics.map((item) => item.code).join(", ")}`);
  for (const recipe of parsed.block.recipes) recipe.fingerprint = exerciseFingerprint(parsed.block, recipe, catalog);
  const copy = structuredClone(content);
  copy.paths[copy.paths.findIndex((path) => path.id === "access-management")] = parsed.block;
  return copy;
})();
export const frozenDrafts = JSON.parse(await readFile(new URL("./fixtures/legacy-v8/content.json", import.meta.url), "utf8")).paths;

// Simulates current content whose exercise semantics still match the immutable mechanical migration.
export function legacyMatched(source = accessV1Content) {
  const copy = structuredClone(source);
  for (const fingerprints of Object.values(legacyExerciseFingerprints)) for (const [exerciseId, fingerprint] of Object.entries(fingerprints)) {
    for (const recipe of copy.paths.flatMap((path) => path.recipes)) if (recipe.exerciseId === (exerciseId === "UG-LAB" ? "AM-LAB" : exerciseId)) recipe.fingerprint = fingerprint;
  }
  return copy;
}
export async function workspaceFor(t) {
  const workspace = resolve(fileURLToPath(new URL("../../../", import.meta.url)), `.governance-test-artifacts-${process.pid}-${randomUUID()}`);
  const local = relative(process.cwd(), workspace);
  await mkdir(local);
  t.after(() => rm(local, { recursive: true, force: true }));
  return workspace;
}
export async function harness(t, source = content, documentId = "test") {
  const workspace = await workspaceFor(t), store = createStore(workspace, source);
  let state = await store.read(documentId);
  const send = async (pathId, operation, value, decisionId = null, exerciseId = null) =>
    (state = await store.update(documentId, { revision: state.revision, pathId, decisionId, exerciseId, operation, value }));
  return {
    workspace, store, documentId, state: () => state,
    refresh: async () => (state = await store.read(documentId)),
    select: (pathId, decisionId, value) => send(pathId, "decide", value, decisionId),
    configure: (pathId, exerciseId, value = {}) => {
      const record = state.paths[pathId].exercises[exerciseId];
      return send(pathId, "configure", { mode: record.mode, settingsUrl: record.settingsUrl, configuration: record.configuration,
        issues: record.issues, followUp: record.followUp, fields: record.fields, ...value }, null, exerciseId);
    },
    verify: (pathId, exerciseId, value = {}) => {
      const record = state.paths[pathId].exercises[exerciseId];
      return send(pathId, "verify", { verified: record.verified, evidence: record.evidence, issues: record.issues,
        followUp: record.followUp, evidenceFields: record.evidenceFields, ...value }, null, exerciseId);
    },
    async write(value) {
      await mkdir(join(workspace, "files/governance-workshop"), { recursive: true });
      await writeFile(join(workspace, "files/governance-workshop", `${documentId}.json`), typeof value === "string" ? value : JSON.stringify(value));
    },
    disk: () => readFile(join(workspace, "files/governance-workshop", `${documentId}.json`), "utf8"),
  };
}
export function legacyState(version = 8, complete = false) {
  const state = { version: 8, revision: 7, paths: Object.fromEntries(legacyContent.paths.map((path) => {
    const decisions = Object.fromEntries(path.decisions.map((decision) => [decision.id, complete ? decision.options.find((option) => !option.deferred).id : null]));
    const lab = emptyLab(path);
    if (complete) {
      Object.assign(lab, { configuration: "already_matches", verified: true, evidence: "Earlier observed evidence", followUp: "Earlier next action",
        settingsUrl: path.lab.exerciseKind === "sample-analysis" ? "" : path.lab.targetKind === "repository" ? "https://github.com/example/sample" : "https://github.com/orgs/example/settings/copilot" });
      if (lab.analysis) for (const field of path.lab.sample.fields) lab.analysis[field.id] = field.options?.[0] ?? "Earlier fictional analysis";
    }
    return [path.id, { decisions, lab }];
  })), legacyProgress: null, archivedDecisions: {}, archivedBillingProgress: null };
  if (version === 8) return state;
  state.version = version;
  const user = state.paths["user-governance"];
  user.decisions = Object.fromEntries(Object.entries(user.decisions).filter(([id]) => ["UG-01", "UG-02"].includes(id)));
  const keep = version === 7 ? 5 : version === 6 ? 4 : version === 5 ? 3 : version === 4 ? 2 : 1;
  state.paths = Object.fromEntries(Object.entries(state.paths).slice(0, keep));
  if (version < 5) delete state.archivedBillingProgress;
  if (version === 2) {
    user.decisions["UG-03"] = complete ? "monitor" : null;
    delete state.archivedDecisions;
  }
  return state;
}
