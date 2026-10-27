import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadWorkshopContent, formatDiagnostic, exerciseFingerprint } from "../../../lib/workshop-content.mjs";
import { HttpError } from "./http.mjs";

export const contentDirectory = new URL("../../../content/", import.meta.url);
export const PATH_IDS = ["access-management", "user-governance", "billing-cost-control", "agent-governance", "context-management", "observability"];

export async function loadContent({ root = fileURLToPath(new URL("../../../", import.meta.url)), ...options } = {}) {
  // The planning CSV is author-only; its references never gate participant content.
  const result = await loadWorkshopContent({ root, planningFile: null, ...options });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map(formatDiagnostic).join("\n"));
  for (const block of result.blocks) for (const recipe of block.recipes) {
    if (recipe.kind === "exercise") recipe.fingerprint = exerciseFingerprint(block, recipe, result.catalog);
    else recipe.fingerprint = `sha256:${createHash("sha256").update(JSON.stringify({
      title: recipe.title, markdown: recipe.markdown, sections: recipe.sections, api: recipe.api,
      policies: recipe.policyIds.map((id) => result.catalog.policies.find((policy) => policy.id === id)),
      requiresDecisions: recipe.requiresDecisions, requiresAnswers: recipe.requiresAnswers, conflictsWith: recipe.conflictsWith,
      warnings: recipe.warnings, checkpoints: recipe.checkpoints,
    })).digest("hex")}`;
  }
  const loaded = { manifest: result.manifest, paths: result.blocks, policies: result.catalog.policies };
  return { ...loaded, version: `sha256:${createHash("sha256").update(JSON.stringify(loaded)).digest("hex")}` };
}

// Holds the active authored content and its matching progress store. A failed
// reload keeps the last valid pair. Only the separate dev reset clears progress.
export async function createWorkshop({ load = loadContent, createStore }) {
  let content = await load(), store, reloading;
  const storeFor = () => store ??= createStore(content);
  return {
    snapshot: () => ({ content, store: storeFor() }),
    get content() { return content; },
    get store() { return storeFor(); },
    // Binds a write to the content snapshot the caller loaded, so a save made
    // against content that another panel has since reloaded cannot apply.
    update(documentId, contentVersion, input) {
      if (contentVersion !== content.version) {
        return Promise.reject(new HttpError(409, "Workshop content was reloaded since this view loaded. Refresh the workshop before saving; your input was not saved."));
      }
      return storeFor().update(documentId, input);
    },
    updateProfile(documentId, contentVersion, input) {
      if (contentVersion !== content.version) {
        return Promise.reject(new HttpError(409, "Workshop content was reloaded since this view loaded. Refresh the workshop before saving; your input was not saved."));
      }
      return storeFor().updateProfile(documentId, input);
    },
    reload() {
      reloading ??= (async () => {
        try {
          const next = await load();
          const nextStore = createStore(next);
          content = next; store = nextStore;
          return { content, store };
        } finally { reloading = null; }
      })();
      return reloading;
    },
  };
}
