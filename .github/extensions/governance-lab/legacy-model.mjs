// Frozen read-only progress validation; not the participant content model.
export const CONFIGURATIONS = {
  not_started: "Not started",
  changed: "Complete - changed manually",
  already_matches: "Complete - inspected existing configuration",
  blocked: "Blocked",
  not_applicable: "Not applicable"
};

export function configurationsFor(path) {
  if (path.lab.exerciseKind === "sample-analysis") return {
    not_started: "Not started", already_matches: path.lab.inspectionLabel,
    blocked: "Blocked", not_applicable: "Not applicable"
  };
  return { ...CONFIGURATIONS, changed: path.lab.changedLabel ?? CONFIGURATIONS.changed,
    already_matches: path.lab.inspectionLabel ?? CONFIGURATIONS.already_matches };
}

export function participationModes(path) {
  if (path.lab.exerciseKind === "sample-analysis") return { sandbox: "Fictional sample analysis", proposal: "Proposal only" };
  return { sandbox: "Sandbox practice", proposal: "Proposal only",
    ...(path.lab.verification.fallback ? { fallback: "Prepared fallback - read-only" } : {}) };
}

export const ARCHIVED_BUDGET_CHOICES = {
  monitor: "Monitor spending with alerts",
  budget: "Enforce a metered-spending budget",
  review: "Needs Review"
};

export const ARCHIVED_BILLING_CHOICES = {
  "BC-01": { central: "Central enterprise funding", departmental: "Departmental cost centers", review: "Needs Review" },
  "BC-02": { monitor: "Monitor spending with alerts", enforce: "Configure enforced spending limits", review: "Needs Review" },
  "BC-03": { organization: "Organization-based allocation", "cost-centers": "Cost centers with users or enterprise teams", review: "Needs Review" }
};

export function archivedBillingSummary(state) {
  const progress = state.archivedBillingProgress;
  if (!progress) return null;
  return {
    decisions: Object.entries(ARCHIVED_BILLING_CHOICES).map(([id, choices]) =>
      ({ id, choice: choices[progress.decisions[id]] ?? "Not decided" })),
    lab: progress.lab
  };
}

export function archivedBudgetChoice(state) {
  return Object.hasOwn(state.archivedDecisions, "UG-03") ?
    ARCHIVED_BUDGET_CHOICES[state.archivedDecisions["UG-03"]] ?? "Not decided" : null;
}

export function readyPaths(content) {
  return content.paths.filter((path) => path.status === "ready");
}

export function emptyLab(path) {
  return { mode: "sandbox", settingsUrl: "", configuration: "not_started", verified: false, evidence: "", issues: "", followUp: "",
    ...(path?.lab.exerciseKind === "sample-analysis" ? { analysis: emptyAnalysis(path) } : {}) };
}

export function emptyAnalysis(path) {
  return Object.fromEntries(path.lab.sample.fields.map((field) => [field.id, ""]));
}

export function validAnalysis(path, value, complete = false) {
  const fields = path.lab.sample.fields;
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every((field) =>
      Object.hasOwn(value, field.id) && typeof value[field.id] === "string" && value[field.id].length <= 2000 &&
      (!complete || Boolean(value[field.id].trim())) &&
      (!field.options || value[field.id] === "" || field.options.includes(value[field.id])));
}

export function verificationReady(path, lab) {
  return canVerify(lab) && Boolean(lab.evidence.trim()) &&
    (path.lab.exerciseKind !== "sample-analysis" ||
      (validAnalysis(path, lab.analysis, true) && Boolean(lab.followUp.trim())));
}

export function selectedOption(decision, choice) {
  return decision.options.find((option) => option.id === choice);
}

export function canConfigure(path, progress) {
  return (path.lab.requiredSavedDecisionIds ?? path.decisions.map((decision) => decision.id))
    .every((id) => Boolean(progress.decisions[id])) &&
    progress.lab.mode === "sandbox" &&
    (path.lab.requiredDecisionIds ?? [path.lab.primaryDecisionId]).every((id) => {
      const decision = path.decisions.find((item) => item.id === id);
      const option = selectedOption(decision, progress.decisions[id]);
      return Boolean(option && !option.deferred);
    });
}

export function canVerify(lab) {
  return ["changed", "already_matches"].includes(lab.configuration);
}

export function configurationWarnings(path, progress) {
  return (path.lab.configurationChecks ?? [])
    .filter((check) => Object.entries(check.when).every(([id, option]) => progress.decisions[id] === option))
    .map((check) => check.message);
}

export function safeSettingsUrl(value) {
  if (typeof value !== "string" || value.length > 1000 || value !== value.trim() || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password ||
        url.search || url.hash || url.pathname === "/" || /%0[ad]/i.test(value)) return null;
    return url.href;
  } catch { return null; }
}

export function safeTargetUrl(path, value) {
  if (path.lab.exerciseKind === "sample-analysis") return null;
  const safe = safeSettingsUrl(value);
  if (!safe || path.lab.targetKind !== "repository") return safe;
  const pathname = new URL(safe).pathname;
  const repository = pathname.match(/^\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+\/?$/);
  return repository &&
    !["settings", "orgs", "organizations", "enterprises", "users", "copilot", "login", "signup",
      "account", "apps", "marketplace", "codespaces", "notifications"].includes(repository[1].toLowerCase()) &&
    !/^\/github-copilot\/purchase\/?$/i.test(pathname)
    ? safe : null;
}

