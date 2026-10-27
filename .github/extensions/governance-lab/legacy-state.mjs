// Read-only legacy decoder. No current progress writes or participant rendering.
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./http.mjs";
import { ARCHIVED_BILLING_CHOICES, ARCHIVED_BUDGET_CHOICES, canConfigure, canVerify, configurationsFor, CONFIGURATIONS, emptyLab, participationModes, readyPaths, safeTargetUrl, validAnalysis, verificationReady } from "./legacy-model.mjs";

const DOCUMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const LEGACY_PATH_IDS = ["user-governance", "agent-governance", "context-management", "observability"];

export function validateDocumentId(id) {
  if (typeof id !== "string" || !DOCUMENT_ID.test(id)) throw new HttpError(400, "Invalid workshop document ID.");
  return id;
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function boundedText(value) {
  return typeof value === "string" && value.length <= 2000;
}

function validProgress(progress, path) {
  if (!exactObject(progress, ["decisions", "lab"]) ||
      !exactObject(progress.decisions, path.decisions.map((decision) => decision.id)) ||
      !path.decisions.every((decision) => progress.decisions[decision.id] === null ||
        decision.options.some((option) => option.id === progress.decisions[decision.id]))) return false;
  const lab = progress.lab;
  const sample = path.lab.exerciseKind === "sample-analysis";
  return exactObject(lab, Object.keys(emptyLab(path))) &&
    typeof lab.mode === "string" && Object.hasOwn(participationModes(path), lab.mode) &&
    typeof lab.verified === "boolean" && Object.hasOwn(configurationsFor(path), lab.configuration) &&
    (lab.settingsUrl === "" || safeTargetUrl(path, lab.settingsUrl) !== null) &&
    ["evidence", "issues", "followUp"].every((key) => boundedText(lab[key])) &&
    (!sample || validAnalysis(path, lab.analysis)) &&
    (!canVerify(lab) || (canConfigure(path, progress) && (sample || Boolean(lab.settingsUrl)))) &&
    (!lab.verified || verificationReady(path, lab));
}

function validLegacy(state) {
  return exactObject(state, ["version", "revision", "paths"]) && state.version === 1 &&
    Number.isSafeInteger(state.revision) && state.revision >= 0 &&
    exactObject(state.paths, LEGACY_PATH_IDS) &&
    LEGACY_PATH_IDS.every((id) => {
      const value = state.paths[id];
      return exactObject(value, ["understood", "decision", "configuration", "verified", "evidence"]) &&
        typeof value.understood === "boolean" && typeof value.verified === "boolean" &&
        [null, "sandbox", "proposal"].includes(value.decision) &&
        Object.hasOwn(CONFIGURATIONS, value.configuration) &&
        typeof value.evidence === "string" && value.evidence.length <= 2000 &&
        (!value.decision || value.understood) &&
        (value.configuration === "not_started" || Boolean(value.decision)) &&
        (value.decision !== "proposal" || !canVerify(value)) &&
        (!value.verified || (canVerify(value) && Boolean(value.evidence.trim())));
    });
}

export function createLegacyReader(workspacePath, content) {
  if (!workspacePath || !isAbsolute(workspacePath)) throw new Error("A session artifact workspace is required.");
  const inside = relative(repositoryRoot, resolve(workspacePath));
  if (inside === "" || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside))) {
    throw new Error("Workshop progress must be stored outside the repository.");
  }
  const directory = resolve(workspacePath, "files", "governance-workshop");
  const paths = readyPaths(content);
  const userPath = paths.find((path) => path.id === "user-governance");
  const legacyUserPath = {
    ...userPath,
    lab: { ...userPath.lab, requiredSavedDecisionIds: undefined },
    decisions: userPath.decisions.filter((decision) => ["UG-01", "UG-02"].includes(decision.id)).map((decision) =>
      decision.id === "UG-01" ? { ...decision, options: decision.options.filter((option) =>
        ["pilot", "organization", "enterprise-teams", "review"].includes(option.id)) } : decision)
  };
  const legacyPaths = paths.map((path) => path.id === userPath.id ? legacyUserPath : path);
  const previousMainPaths = legacyPaths.filter((path) => path.id !== "observability");
  const mainPaths = previousMainPaths.filter((path) => path.id !== "context-management");
  const statePath = (id) => resolve(directory, `${validateDocumentId(id)}.json`);
  const emptyState = () => ({
    version: 8,
    revision: 0,
    paths: Object.fromEntries(paths.map((path) => [path.id, {
      decisions: Object.fromEntries(path.decisions.map((decision) => [decision.id, null])),
      lab: emptyLab(path)
    }])),
    legacyProgress: null,
    archivedDecisions: {},
    archivedBillingProgress: null
  });
  const validArchive = (archive) => exactObject(archive, []) ||
    (exactObject(archive, ["UG-03"]) &&
      (archive["UG-03"] === null || (typeof archive["UG-03"] === "string" &&
        Object.hasOwn(ARCHIVED_BUDGET_CHOICES, archive["UG-03"]))));
  const validStateFor = (state, version, expectedPaths) => exactObject(state,
    ["version", "revision", "paths", "legacyProgress", "archivedDecisions", ...(version >= 5 ? ["archivedBillingProgress"] : [])]) &&
    state.version === version && Number.isSafeInteger(state.revision) && state.revision >= 0 &&
    exactObject(state.paths, expectedPaths.map((path) => path.id)) &&
    expectedPaths.every((path) => validProgress(state.paths[path.id], path)) &&
    (state.legacyProgress === null || validLegacy(state.legacyProgress)) &&
    validArchive(state.archivedDecisions) &&
    (version < 5 || state.archivedBillingProgress === null || validProgress(state.archivedBillingProgress, previousBillingPath));
  const validState = (state) => validStateFor(state, 8, paths);
  const expandUserProgress = (progress) => ({
    ...progress,
    decisions: { ...emptyState().paths[userPath.id].decisions, ...progress.decisions }
  });
  const previousUserPath = {
    ...legacyUserPath,
    decisions: [
      ...legacyUserPath.decisions,
      { id: "UG-03", options: Object.keys(ARCHIVED_BUDGET_CHOICES).map((id) => ({ id, deferred: id === "review" })) }
    ]
  };
  const previousBillingPath = {
    id: "billing-cost-control",
    decisions: Object.entries(ARCHIVED_BILLING_CHOICES).map(([id, choices]) =>
      ({ id, options: Object.keys(choices).map((id) => ({ id, deferred: id === "review" })) })),
    lab: { primaryDecisionId: "BC-02", verification: {} }
  };
  const originalPaths = [previousUserPath, previousBillingPath, paths.find((path) => path.id === "agent-governance")];
  const validPreviousState = (state, version, count) =>
    exactObject(state, ["version", "revision", "paths", "legacyProgress"]) &&
    state.version === version && Number.isSafeInteger(state.revision) && state.revision >= 0 &&
    exactObject(state.paths, originalPaths.slice(0, count).map((path) => path.id)) &&
    originalPaths.slice(0, count).every((path) => validProgress(state.paths[path.id], path)) &&
    (state.legacyProgress === null || validLegacy(state.legacyProgress));
  const invalidState = () => new HttpError(409,
    "Saved workshop progress is invalid. Preserve the file and contact the facilitator.");
  async function read(id) {
    let raw;
    try {
      raw = await readFile(statePath(id), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return emptyState();
      throw error;
    }
    let state;
    try {
      state = JSON.parse(raw);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw invalidState();
    }
    // Participation choices from v1 are not policy decisions. Preserve them,
    // but never claim they configure or verify the new policy exercises.
    if (validLegacy(state)) return { ...emptyState(), revision: state.revision, legacyProgress: state };
    // The branches used different v3-v6 schemas. Validate the exact shape
    // before migrating; old Billing answers cannot attest to the revised lab.
    const originalContextPaths = [...originalPaths, paths.find((path) => path.id === "context-management")];
    const originalContextState = exactObject(state, ["version", "revision", "paths", "legacyProgress"]) &&
      state.version === 5 && Number.isSafeInteger(state.revision) && state.revision >= 0 &&
      exactObject(state.paths, originalContextPaths.map((path) => path.id)) &&
      originalContextPaths.every((path) => validProgress(state.paths[path.id], path)) &&
      (state.legacyProgress === null || validLegacy(state.legacyProgress));
    const originalObservabilityPaths = [...originalContextPaths, paths.find((path) => path.id === "observability")];
    const originalObservabilityState = exactObject(state, ["version", "revision", "paths", "legacyProgress"]) &&
      state.version === 6 && Number.isSafeInteger(state.revision) && state.revision >= 0 &&
      exactObject(state.paths, originalObservabilityPaths.map((path) => path.id)) &&
      originalObservabilityPaths.every((path) => validProgress(state.paths[path.id], path)) &&
      (state.legacyProgress === null || validLegacy(state.legacyProgress));
    if (validPreviousState(state, 2, 1) || validPreviousState(state, 3, 2) ||
        validPreviousState(state, 4, 3) || originalContextState || originalObservabilityState) {
      const migrated = emptyState();
      const progress = state.paths["user-governance"];
      const archivedDecisions = { "UG-03": progress.decisions["UG-03"] };
      delete progress.decisions["UG-03"];
      state = { ...migrated, revision: state.revision, legacyProgress: state.legacyProgress, archivedDecisions,
        archivedBillingProgress: state.paths["billing-cost-control"] ?? null,
        paths: { ...migrated.paths, "user-governance": expandUserProgress(progress),
          ...(state.paths["agent-governance"] ? { "agent-governance": state.paths["agent-governance"] } : {}),
          ...(originalContextState || originalObservabilityState ? { "context-management": state.paths["context-management"] } : {}),
          ...(originalObservabilityState ? { observability: state.paths.observability } : {}) } };
    } else if (validStateFor(state, 3, [legacyUserPath]) ||
        validStateFor(state, 4, mainPaths.filter((path) => path.id !== "agent-governance")) ||
        validStateFor(state, 5, mainPaths) || validStateFor(state, 6, previousMainPaths) ||
        validStateFor(state, 7, legacyPaths)) {
      state = { ...emptyState(), ...state, version: 8, paths: { ...emptyState().paths, ...state.paths,
        "user-governance": expandUserProgress(state.paths["user-governance"]) } };
    }
    if (!validState(state)) throw invalidState();
    return state;
  }
  return { read };
}
