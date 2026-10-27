import { resolveConfiguration } from "../../../../lib/workshop-resolver.mjs";
export { resolveConfiguration };

export const CONFIGURATIONS = {
  not_started: "Not started", changed: "Complete - changed manually",
  already_matches: "Complete - inspected existing configuration", blocked: "Blocked", not_applicable: "Not applicable"
};
export const readyPaths = (content) => content.paths;
export const selectedOption = (decision, choice) => decision?.options.find((option) => option.id === choice);
export const canVerify = (record) => ["changed", "already_matches"].includes(record?.configuration);
export const emptyFields = (fields) => Object.fromEntries(fields.map((field) => [field.id, ""]));
export function configurationsFor(recipe) {
  return {
    not_started: CONFIGURATIONS.not_started,
    changed: recipe.labels?.["Changed label"] ?? CONFIGURATIONS.changed,
    already_matches: recipe.labels?.["Inspection label"] ?? CONFIGURATIONS.already_matches,
    blocked: CONFIGURATIONS.blocked, not_applicable: CONFIGURATIONS.not_applicable,
  };
}
export function participationModes(recipe, validation) {
  return {
    sandbox: "Sandbox practice",
    proposal: "Proposal only",
    ...(recipe.sections.Fallback || validation?.sections.Fallback ? { fallback: "Prepared fallback - read-only" } : {}),
  };
}
export function emptyExercise(recipe, validation) {
  return { mode: "sandbox", settingsUrl: "", configuration: "not_started", verified: false,
    evidence: "", issues: "", followUp: "", fields: emptyFields(recipe.fields),
    evidenceFields: emptyFields(validation.fields), basis: "" };
}
export function validFields(fields, value, complete = false) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every((field) => {
      const text = value[field.id];
      return typeof text === "string" && text.length <= 2000 &&
        (!complete || !field.required || Boolean(text.trim())) &&
        (text === "" || field.type !== "select" || field.options.includes(text)) &&
        (text === "" || field.type !== "number" || (text.trim() !== "" && Number.isFinite(Number(text))));
    });
}
export function configurationFor(path, progress) {
  return resolveConfiguration(path, progress.decisions);
}
export function exerciseBasis(path, progress, recipe) {
  const relevant = new Set([...recipe.requiresDecisions, ...recipe.requiresAnswers.map((item) => item.decisionId),
    ...(recipe.variantDecisionId ? [recipe.variantDecisionId] : []),
    ...path.decisions.filter((decision) => decision.options.some((option) => option.recipeIds.includes(recipe.id))).map((decision) => decision.id)]);
  return JSON.stringify({ fingerprint: recipe.fingerprint ?? recipe.id,
    decisions: Object.fromEntries([...relevant].sort().map((id) => [id, progress.decisions[id] ?? null])) });
}
export function configurationTasks(path, progress) {
  const recipes = configurationFor(path, progress).recipes.map(({ recipe, eligible }) => ({
    id: `recipe:${recipe.id}`, title: recipe.title, eligible,
    basis: JSON.stringify({ source: recipe.fingerprint ?? {
      title: recipe.title, markdown: recipe.markdown, sections: recipe.sections, api: recipe.api,
      policyIds: recipe.policyIds, requiresDecisions: recipe.requiresDecisions,
      requiresAnswers: recipe.requiresAnswers, conflictsWith: recipe.conflictsWith,
    }, choices: exerciseBasis(path, progress, recipe),
    target: recipe.kind === "exercise" ? {
      mode: progress.exercises?.[recipe.exerciseId]?.mode, settingsUrl: progress.exercises?.[recipe.exerciseId]?.settingsUrl,
      fields: progress.exercises?.[recipe.exerciseId]?.fields,
    } : null }),
  }));
  const stage = path.stages.configure;
  const additional = [
    ...(stage.conclusion ? [{ id: "introduction:configure", title: "Additional steps", markdown: stage.conclusion }] : []),
    ...(stage.additionalSteps ?? []),
  ].map((step) => ({
    id: step.id ?? `additional:${step.title}`, title: step.title, eligible: true,
    basis: JSON.stringify({ title: step.title, markdown: step.markdown }),
  }));
  return [...recipes, ...additional];
}
/** All authored configuration steps in a block, regardless of which decisions select them. */
export function totalConfigurationSteps(path) {
  const stage = path.stages.configure;
  return path.recipes.length + (stage.conclusion ? 1 : 0) + (stage.additionalSteps?.length ?? 0);
}
export function configurationChecklist(path, progress, checklist = []) {
  return configurationTasks(path, progress).map((task) => ({
    ...task, done: task.eligible && checklist.some((record) =>
      record.pathId === path.id && record.stepId === task.id && record.basis === task.basis && record.done),
  }));
}
export function verificationTasks(path, progress) {
  return configurationFor(path, progress).exercises.map(({ recipe, validation, eligible }) => ({
    id: `verify:${recipe.exerciseId}`, title: validation.title, eligible,
    basis: JSON.stringify({ exercise: exerciseBasis(path, progress, recipe), target: {
      mode: progress.exercises?.[recipe.exerciseId]?.mode, settingsUrl: progress.exercises?.[recipe.exerciseId]?.settingsUrl,
      fields: progress.exercises?.[recipe.exerciseId]?.fields,
    } }),
  }));
}
export function checklistTasks(path, progress) {
  return [...configurationTasks(path, progress), ...verificationTasks(path, progress)];
}
export function verificationChecklist(path, progress, checklist = []) {
  return verificationTasks(path, progress).map((task) => ({
    ...task, done: task.eligible && checklist.some((record) =>
      record.pathId === path.id && record.stepId === task.id && record.basis === task.basis && record.done),
  }));
}
export function canConfigure(path, progress, exerciseId) {
  const entry = configurationFor(path, progress).exercises.find(({ recipe }) => recipe.exerciseId === exerciseId);
  const record = progress.exercises[exerciseId];
  return Boolean(entry?.eligible && record?.mode === "sandbox" && validFields(entry.recipe.fields, record.fields, true));
}
// Drives participant status labels and resume routing only; Verify uses personal Done markers, not recorded targets.
export function readyToVerify(path, progress, exerciseId) {
  const entry = configurationFor(path, progress).exercises.find(({ recipe }) => recipe.exerciseId === exerciseId);
  const record = progress.exercises[exerciseId];
  return Boolean(entry?.eligible && record?.mode === "sandbox" && !["blocked", "not_applicable"].includes(record.configuration));
}
export function verificationReady(path, progress, exerciseId) {
  const entry = configurationFor(path, progress).exercises.find(({ recipe }) => recipe.exerciseId === exerciseId);
  const record = progress.exercises[exerciseId];
  return Boolean(entry && canConfigure(path, progress, exerciseId) && (entry.recipe.target === "none" || record.settingsUrl) &&
    !["blocked", "not_applicable"].includes(record.configuration) &&
    record.evidence.trim() && validFields(entry.validation.fields, record.evidenceFields, true));
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
export function safeTargetUrl(recipe, value) {
  if (recipe.target === "none") return null;
  const safe = safeSettingsUrl(value);
  if (!safe || recipe.target !== "repository") return safe;
  const pathname = new URL(safe).pathname;
  const repository = pathname.match(/^\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+\/?$/);
  return repository && !["settings", "orgs", "organizations", "enterprises", "users", "copilot", "login", "signup",
    "account", "apps", "marketplace", "codespaces", "notifications"].includes(repository[1].toLowerCase()) &&
    !/^\/github-copilot\/purchase\/?$/i.test(pathname) ? safe : null;
}
function hasRetainedActivity(record) {
  return Boolean(record && ((typeof record.mode === "string" && record.mode !== "sandbox") || record.settingsUrl || record.verified ||
    (typeof record.configuration === "string" && record.configuration !== "not_started") ||
    [record.evidence, record.issues, record.followUp, ...Object.values(record.fields ?? {}), ...Object.values(record.evidenceFields ?? {})]
      .some((value) => typeof value === "string" && value.trim())));
}
export function summary(content, state) {
  return content.paths.map((path) => {
    const progress = state.paths[path.id], resolved = configurationFor(path, progress);
    const decisions = path.decisions.map((decision) => {
      const option = selectedOption(decision, progress.decisions[decision.id]);
      const exercises = resolved.exercises.filter((entry) => entry.selectedBy.some((item) => item.decisionId === decision.id));
      return { id: decision.id, title: decision.title, policyIds: decision.policyIds, choice: option?.label ?? "Not decided",
        deferred: Boolean(option?.deferred), answered: Boolean(option),
        recipeIds: option?.recipeIds ?? [], exerciseIds: exercises.map(({ recipe }) => recipe.exerciseId),
        configuration: !option || option.deferred ? "Unresolved" : exercises.length ? "See selected exercises" : "No exercise selected" };
    });
    const exercises = resolved.exercises.map((entry) => {
      const record = progress.exercises[entry.recipe.exerciseId];
      const current = record.basis === exerciseBasis(path, progress, entry.recipe);
      return { id: entry.recipe.exerciseId, title: entry.recipe.title, ...record, eligible: entry.eligible,
        selectedBy: entry.selectedBy, policyIds: entry.recipe.policyIds, missingDecisionIds: entry.missingDecisionIds,
        warnings: entry.warnings.map((warning) => warning.markdown),
        verified: Boolean(current && entry.eligible && record.verified),
        participationLabel: participationModes(entry.recipe, entry.validation)[record.mode],
        configurationLabel: current && entry.eligible ? configurationsFor(entry.recipe)[record.configuration] : "Not configured - prerequisites or source changed",
        verificationLabel: current && entry.eligible && record.verified ? "Participant-reported verified" :
          record.mode === "fallback" ? "Not verified - prepared fallback only" : "Not verified",
        responses: [...entry.recipe.fields.map((field) => ({ label: field.label, value: record.fields[field.id] })),
          ...entry.validation.fields.map((field) => ({ label: field.label, value: record.evidenceFields[field.id] }))] };
    });
    const retainedIds = new Set(Object.entries(progress.exercises).filter(([, record]) => hasRetainedActivity(record)).map(([id]) => id));
    for (const { data } of state.history ?? []) {
      if (data.pathId === path.id && typeof data.exerciseId === "string" && hasRetainedActivity(data.record)) retainedIds.add(data.exerciseId);
    }
    return { id: path.id, title: path.title, decisions, answered: decisions.filter((item) => item.answered).length,
      resolved: decisions.filter((item) => item.answered && !item.deferred).length, exercises,
      checklist: configurationChecklist(path, progress, state.checklist),
      verificationChecklist: verificationChecklist(path, progress, state.checklist),
      guidance: resolved.guidance.map(({ recipe, selectedBy, eligible, warnings, missingDecisionIds, missingAnswers, conflicts }) => ({ id: recipe.id, title: recipe.title, markdown: recipe.markdown,
        sections: recipe.sections, policyIds: recipe.policyIds, selectedBy, eligible, missingDecisionIds, missingAnswers, conflicts,
        warnings: warnings.map((warning) => warning.markdown) })),
      inactiveExerciseIds: [...retainedIds].filter((id) => !exercises.some((item) => item.id === id)) };
  });
}
export const decisionRoute = (pathId, decisionId) => `?path=${encodeURIComponent(pathId)}&decision=${encodeURIComponent(decisionId)}`;
export const understandRoute = (pathId) => `?path=${encodeURIComponent(pathId)}&stage=understand`;
export const labRoute = (pathId, stage = "configure", exerciseId = null) => `?path=${encodeURIComponent(pathId)}&stage=${stage}${exerciseId ? `&exercise=${encodeURIComponent(exerciseId)}` : ""}`;
export const configurationRoute = (pathId, stepId) => `${labRoute(pathId)}&step=${encodeURIComponent(stepId)}`;
export function decisionOverview(path, progress) {
  const decisions = path.decisions.map((decision) => {
    const option = selectedOption(decision, progress.decisions[decision.id]);
    const status = !option ? "Unanswered" : option.deferred ? "Needs review" : "Answered";
    return { id: decision.id, title: decision.title, status, answer: option?.label ?? null };
  });
  return {
    decisions,
    answered: decisions.filter((decision) => decision.status === "Answered").length,
    needsReview: decisions.filter((decision) => decision.status === "Needs review").length,
    unanswered: decisions.filter((decision) => decision.status === "Unanswered").length,
  };
}
export function parseRoute(search, paths, state) {
  const params = new URLSearchParams(search);
  if (params.get("view") === "summary") return { view: "summary" };
  const path = paths.find((item) => item.id === params.get("path"));
  if (!path) return { view: "home" };
  const stage = params.get("stage");
  if (stage === "understand") return { view: "understand", pathId: path.id };
  if (stage === "configure" && state) {
    const tasks = configurationTasks(path, state.paths[path.id]);
    const exerciseId = params.get("exercise");
    const legacyRecipe = exerciseId && path.recipes.find((recipe) => recipe.kind === "exercise" && recipe.exerciseId === exerciseId);
    const requested = params.get("step") ?? (legacyRecipe ? `recipe:${legacyRecipe.id}` : null);
    const task = tasks.find((task) => task.id === requested) ?? tasks[0];
    const recipe = path.recipes.find((recipe) => `recipe:${recipe.id}` === task?.id);
    return { view: "lab", pathId: path.id, stage, stepId: task?.id ?? null, exerciseId: recipe?.exerciseId ?? null };
  }
  if (stage === "configure" || stage === "verify") {
    const exercises = state ? configurationFor(path, state.paths[path.id]).exercises.map(({ recipe }) => recipe) : path.recipes.filter((recipe) => recipe.kind === "exercise");
    if (stage === "verify" && !params.has("exercise") && path.stages.validation.introduction.trim() && exercises.length) {
      return { view: "lab", pathId: path.id, stage, exerciseId: null };
    }
    return { view: "lab", pathId: path.id, stage, exerciseId: exercises.find((recipe) => recipe.exerciseId === params.get("exercise"))?.exerciseId ?? exercises[0]?.exerciseId ?? null };
  }
  const decision = path.decisions.find((item) => item.id === params.get("decision")) ?? path.decisions[0];
  return decision ? { view: "decision", pathId: path.id, decisionId: decision.id } : { view: "understand", pathId: path.id };
}
export function navigation(path, route, progress) {
  const count = path.decisions.length;
  const decisionIndex = path.decisions.findIndex((decision) => decision.id === route.decisionId);
  const exercises = progress ? configurationFor(path, progress).exercises : [];
  const exerciseIndex = exercises.findIndex(({ recipe }) => recipe.exerciseId === route.exerciseId);
  const first = exercises[0]?.recipe.exerciseId ?? null;
  const validationLabels = (exercises[exerciseIndex] ?? exercises[0])?.validation.labels ?? {};
  if (route.view === "understand") return { position: "Block introduction", back: "?", next: count ? decisionRoute(path.id, path.decisions[0].id) : labRoute(path.id), nextLabel: count ? "Start decisions" : "Continue to Configure" };
  if (route.view === "decision") return { position: `Question ${decisionIndex + 1} of ${count}`,
    back: decisionIndex > 0 ? decisionRoute(path.id, path.decisions[decisionIndex - 1].id) : understandRoute(path.id),
    next: decisionIndex < count - 1 ? decisionRoute(path.id, path.decisions[decisionIndex + 1].id) : labRoute(path.id),
    nextLabel: decisionIndex < count - 1 ? "Next decision" : "Start configuration" };
  if (route.stage === "configure" && route.stepId) {
    const tasks = configurationTasks(path, progress), index = tasks.findIndex((task) => task.id === route.stepId);
    return {
      position: `Step ${index + 1} of ${tasks.length}`,
      back: index > 0 ? configurationRoute(path.id, tasks[index - 1].id) :
        count ? decisionRoute(path.id, path.decisions.at(-1).id) : understandRoute(path.id),
      next: index < tasks.length - 1 ? configurationRoute(path.id, tasks[index + 1].id) :
        labRoute(path.id, "verify", path.stages.validation.introduction.trim() ? null : first),
      nextLabel: index < tasks.length - 1 ? "Next step" : "Continue to validation",
    };
  }
  if (route.stage === "verify" && !route.exerciseId && exercises.length && path.stages.validation.introduction.trim()) {
    return { position: "Verification introduction", back: labRoute(path.id), next: labRoute(path.id, "verify", first), nextLabel: "Start verification" };
  }
  const unresolved = decisionOverview(path, progress).unanswered > 0;
  return { position: exerciseIndex >= 0 ? `Exercise ${exerciseIndex + 1} of ${exercises.length}` :
      unresolved ? "Decisions remain" : "No applicable exercises",
    back: exerciseIndex > 0 ? labRoute(path.id, route.stage, exercises[exerciseIndex - 1].recipe.exerciseId) :
      route.stage === "verify" ? path.stages.validation.introduction.trim() ? labRoute(path.id, "verify") :
        labRoute(path.id, "configure", first) : count ? decisionRoute(path.id, path.decisions.at(-1).id) : understandRoute(path.id),
    next: exerciseIndex >= 0 && exerciseIndex < exercises.length - 1 ? labRoute(path.id, route.stage, exercises[exerciseIndex + 1].recipe.exerciseId) :
      route.stage === "configure" ? labRoute(path.id, "verify", first) : "?view=summary",
    nextLabel: exerciseIndex >= 0 && exerciseIndex < exercises.length - 1 ? "Next exercise" : route.stage === "configure" ?
      validationLabels["Navigation label"] ?? validationLabels["Next label"] ?? "Continue to validation" : "View summary" };
}
export function workflowSteps(path, route, progress) {
  const current = route.view === "understand" ? 0 : route.view === "decision" ? 1 : route.stage === "configure" ? 2 : 3;
  const firstUnanswered = path.decisions.find((decision) => !progress?.decisions?.[decision.id]);
  const decision = firstUnanswered ?? path.decisions[0];
  const exercises = progress ? configurationFor(path, progress).exercises : [];
  const firstExercise = exercises[0]?.recipe.exerciseId ?? null;
  const routes = [
    understandRoute(path.id),
    decision ? decisionRoute(path.id, decision.id) : understandRoute(path.id),
    labRoute(path.id),
    labRoute(path.id, "verify", path.stages.validation.introduction.trim() ? null : firstExercise),
  ];
  return ["Understand", "Decide", "Configure", "Verify"].map((label, index) => ({ label, current: index === current, href: routes[index] }));
}
export function resumeRoute(path, state) {
  const progress = state.paths[path.id];
  if (path.decisions.every((item) => !progress.decisions[item.id])) return understandRoute(path.id);
  const decision = path.decisions.find((item) => !progress.decisions[item.id]);
  if (decision) return decisionRoute(path.id, decision.id);
  const exercises = configurationFor(path, progress).exercises;
  const unfinished = configurationChecklist(path, progress, state.checklist).find((task) => !task.done);
  if (unfinished) return configurationRoute(path.id, unfinished.id);
  return labRoute(path.id, exercises.length && exercises.every(({ recipe }) => readyToVerify(path, progress, recipe.exerciseId)) ? "verify" : "configure");
}
function markdownText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_[\]{}()#+.!|~=-])/g, "\\$1").replace(/\r\n?/g, "\n");
}
export function markdownExport(content, state) {
  const lines = ["# Copilot Governance Workshop", "", "Participant-reported progress, not an independent audit of GitHub.", ""];
  for (const path of summary(content, state)) {
    lines.push(`## ${markdownText(path.title)}`, "");
    if (path.checklist.length) {
      lines.push("### Personal configuration checklist", "", "Done is a personal task marker, not configuration or validation evidence.", "");
      for (const task of path.checklist) lines.push(`- [${task.done ? "x" : " "}] ${markdownText(task.title)}`);
      lines.push("");
    }
    if (path.verificationChecklist.length) {
      lines.push("### Personal verification checklist", "", "Done is a personal task marker, not evidence-backed verification.", "");
      for (const task of path.verificationChecklist) lines.push(`- [${task.done ? "x" : " "}] ${markdownText(task.title)}`);
      lines.push("");
    }
    for (const decision of path.decisions) lines.push(`### ${markdownText(decision.id)}: ${markdownText(decision.title)}`, "",
      `Decision: ${markdownText(decision.choice)}${decision.deferred ? " (unresolved)" : ""}`, "",
      `Configuration: ${markdownText(decision.configuration)}`, "", `Policy references: ${decision.policyIds.map(markdownText).join(", ")}`, "");
    for (const guidance of path.guidance) {
      lines.push(`### Guidance: ${markdownText(guidance.title)}`, "", markdownText(guidance.markdown), "", "Informational only; not configured or verified.", "");
      if (!guidance.eligible) lines.push("Prerequisites or conflicting selections remain unresolved.", "");
      for (const [title, value] of Object.entries(guidance.sections)) lines.push(`#### ${markdownText(title)}`, "", markdownText(value), "");
    }
    if (!path.exercises.length) lines.push("No applicable exercises. No configuration or validation is claimed.", "");
    for (const exercise of path.exercises) {
      lines.push(`### Exercise ${markdownText(exercise.id)}: ${markdownText(exercise.title)}`, "",
        `Verification: ${markdownText(exercise.verificationLabel)}`, "");
      if (exercise.settingsUrl) lines.push(`Confirmed target: ${markdownText(exercise.settingsUrl)}`, "");
      for (const [key, label] of [["evidence", "Evidence"], ["issues", "Issues"], ["followUp", "Follow-up actions"]]) if (exercise[key]) lines.push(`#### ${label}`, "", markdownText(exercise[key]), "");
      for (const response of exercise.responses) if (response.value) lines.push(`#### ${markdownText(response.label)}`, "", markdownText(response.value), "");
    }
    if (path.inactiveExerciseIds.length) lines.push(`Inactive exercises (not counted): ${path.inactiveExerciseIds.map(markdownText).join(", ")}`, "");
  }
  if (state.history.length) {
    lines.push("## Historical records", "", "Preserved for reference only; these records do not count toward current exercises.", "");
    for (const item of state.history) lines.push(`### ${markdownText(item.reason)}`, "", markdownText(JSON.stringify(item.data, null, 2)), "");
  }
  return lines.join("\n");
}
