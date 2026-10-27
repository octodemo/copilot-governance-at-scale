import { escapeHtml as html } from "./html.js";
import { watchTheme } from "./theme.js";
import { inlineMarkdown, renderMarkdown, renderQuestion } from "./markdown.js";
import { icon } from "./icons.js";
import { DEFAULT_REPOSITORY_NAME, resolveContentCommand, resolveContentLinkTarget, resolveValidationVariant } from "../../../../lib/workshop-resolver.mjs";
import {
  configurationChecklist, configurationFor, configurationRoute, decisionOverview, decisionRoute, exerciseBasis, labRoute, navigation, parseRoute,
  readyToVerify, resumeRoute, summary, totalConfigurationSteps, verificationChecklist, workflowSteps,
} from "./model.js";

watchTheme(document);
const token = document.querySelector('meta[name="canvas-token"]').content;
const devMode = document.querySelector('meta[name="canvas-dev"]')?.content === "true";
const devReset = document.querySelector("#dev-reset");
const main = document.querySelector("#main"), controls = document.querySelector("#navigation");
const status = document.querySelector("#status"), error = document.querySelector("#error");
const drafts = new Map(), pendingSaves = new Map();
const profileHost = document.querySelector("#profile-host");
const profileKey = JSON.stringify({ view: "home" });
let profileDetection = "idle", profileDetectionError = "", profileDetectionCode = "", profileNotice = "", profileEpoch = 0;
// GitHub CLI sign-in gate for automatic detection. Status checks are read-only.
const SIGN_IN_POLL_MS = 4000, SIGN_IN_TIMEOUT_MS = 15 * 60 * 1000;
let authState = null, signInPending = false, signInDeadline = 0, signInTimer = null, signInError = "", signInReplaces = null;
const signInRendered = new WeakMap();
let content, state, saving, saveTimer, inFlight = null;
let busy = false, renderedRoute = "", renderedUrl = "";
let showingAllVariants = false;
let reviewStage = "configure";
let keyboardFocus = true;
const md = (text) => renderMarkdown(text ?? "", state?.profile);
// Dev-only provenance for the section picker: where a rendered part comes from in Markdown.
const src = (source, label) => devMode && source?.file ?
  ` data-source-file="${html(source.file)}" data-source-line="${source.line}" data-source-end="${source.endLine}" data-source-label="${html(label)}"` : "";
const sourced = (source, label, inner) => devMode && inner && source ? `<div class="source-region"${src(source, label)}>${inner}</div>` : inner;
const pathFor = (route) => content.paths.find((path) => path.id === route.pathId);
const entryFor = (route) => configurationFor(pathFor(route), state.paths[route.pathId]).exercises.find(({ recipe }) => recipe.exerciseId === route.exerciseId);
const recordFor = (route, snapshot = state) => snapshot.paths[route.pathId]?.exercises[route.exerciseId];
const routeNow = () => parseRoute(location.search, content.paths, state);
const wideLayout = window.matchMedia("(min-width: 960px)");
history.scrollRestoration = "manual";

function syncItemBrowser() {
  const browser = main.querySelector(".stage-sidebar details");
  if (!browser) return;
  const focused = document.activeElement, toggle = browser.querySelector("summary");
  if (!wideLayout.matches) {
    toggle.hidden = false;
    if (browser.contains(focused)) toggle.focus();
  }
  browser.open = wideLayout.matches;
  if (wideLayout.matches) {
    if (focused === toggle) browser.querySelector('[aria-current="page"]')?.focus();
    toggle.hidden = true;
  }
}
wideLayout.addEventListener("change", syncItemBrowser);

async function request(path, input) {
  const response = await fetch(path, {
    method: input === undefined ? "GET" : "POST",
    headers: { "X-Canvas-Token": token, ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  if (!response.ok) {
    const { message } = await response.json();
    if (response.status === 404 && path.startsWith("/api/dev/snapshots") && message === "Not found.") {
      throw new Error("The canvas server is running an older extension version without saved-state support. Reload project extensions, then reopen this canvas. The dev-tools Reload button reloads content only; it cannot update server code. Your saved progress has not been changed.");
    }
    throw new Error(message || `Request failed (${response.status}).`);
  }
  return response;
}
function showError(reason) { error.textContent = reason.message; error.hidden = false; error.focus(); }
function setStatus(message) { status.textContent = message; }
function updateStatus() {
  setStatus("");
}
let terminalOpening = false;
async function runTerminalCommand(button) {
  if (terminalOpening || button.closest("#comparison-preview, .dev-review, .validation-preview")) return;
  const commandBlock = button.closest(".terminal-command");
  const code = commandBlock?.querySelector("code");
  const commandTemplate = code?.dataset.commandTemplate;
  if (!commandTemplate?.trim()) {
    showError(new Error("This shell block is empty. Reload the workshop and try again."));
    return;
  }
  const fields = [...commandBlock.querySelectorAll("[data-command-input]")];
  const invalidField = fields.find((field) => !field.checkValidity());
  if (invalidField) {
    invalidField.reportValidity();
    return;
  }
  const inputs = Object.fromEntries(fields.map((field) => [field.dataset.commandInput, field.value]));
  terminalOpening = true;
  button.disabled = true;
  try {
    queueSave();
    if (!await flushSaves()) return;
    await request("/api/terminal", { commandTemplate, inputs, contentVersion: content.version, revision: state.revision });
  } catch (reason) {
    showError(reason);
  } finally {
    terminalOpening = false;
    button.disabled = false;
  }
}
function savedDraft(route) {
  if (route.view === "home") return { ...(state.profile ?? {}) };
  if (route.view === "checklist") return { done: [...configurationChecklist(pathFor(route), state.paths[route.pathId], state.checklist),
    ...verificationChecklist(pathFor(route), state.paths[route.pathId], state.checklist)].find((task) => task.id === route.stepId)?.done ?? false };
  if (route.view === "decision") return { decision: state.paths[route.pathId].decisions[route.decisionId] ?? "" };
  const record = recordFor(route);
  return record ? { ...record, ...Object.fromEntries(Object.entries(route.stage === "configure" ? record.fields : record.evidenceFields).map(([id, value]) => [`field:${id}`, value])) } : {};
}
function rememberDraft(key, draft) {
  const saved = savedDraft(JSON.parse(key));
  if (Object.entries(draft).some(([name, value]) => value !== saved[name])) drafts.set(key, draft);
  else drafts.delete(key);
}
function captureDraft() {
  const form = profileHost.querySelector("dialog[open] form") ?? main.querySelector("form");
  if (!form || busy) return;
  const draft = Object.fromEntries(new FormData(form));
  for (const element of form.elements) if (element.name && element.type === "checkbox") draft[element.name] = element.checked;
  rememberDraft(form.id === "profile-form" ? profileKey : renderedRoute, draft);
  return draft;
}
function restoreDraft() {
  const form = main.querySelector("form"), draft = drafts.get(renderedRoute);
  if (!form || !draft) return;
  for (const element of form.elements) {
    if (!element.name || !Object.hasOwn(draft, element.name)) continue;
    if (element.type === "radio") element.checked = element.value === draft[element.name];
    else if (element.type === "checkbox") element.checked = draft[element.name];
    else element.value = draft[element.name];
  }
  refreshVerification();
}
const list = (items) => `<ul>${items.map((item) => `<li>${html(item)}</li>`).join("")}</ul>`;
function decisionsTaken(path, selectedBy, route, readOnly = false) {
  if (!selectedBy.length) return "";
  const comparison = readOnly ? "" : renderComparison(path, route);
  return `<section class="config-decision" aria-label="Decision context">
    <div class="config-decision-heading"><h3>${icon("decision")}Based on your decision</h3>
      ${comparison ? `<button class="config-compare-trigger" type="button" data-compare-toggle aria-controls="comparison-panel" aria-expanded="false">${icon("compare")}Compare answers</button>` : ""}</div>
    <ul>${selectedBy.map(({ decisionId, optionId }) => {
    const decision = path.decisions.find((item) => item.id === decisionId), option = decision?.options.find((item) => item.id === optionId);
    return `<li><span><span class="muted">${html(decision?.title ?? decisionId)}</span><strong>${html(option?.label ?? optionId)}</strong></span>
      ${readOnly ? "" : `<a href="${decisionRoute(path.id, decisionId)}" data-route aria-label="Change ${html(decision?.title ?? decisionId)} decision">Change</a>`}</li>`;
  }).join("")}</ul>${comparison}</section>`;
}
function configMeta(recipe) {
  const sources = [...new Map(recipe.policyIds.map((id) => content.policies.find((policy) => policy.id === id)).filter(Boolean)
    .flatMap((policy) => policy.documentation).map((source) => [source.url, source])).values()];
  return `<footer class="config-meta"><h3>${icon("book")}Reference</h3>
    ${sources.length ? `<div class="config-docs config-reference-group"><h4>${icon("link")}Documentation</h4><ul>${sources.map((source) =>
      `<li><a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.label)}<span class="sr-only"> (new tab)</span>${icon("arrow")}</a></li>`).join("")}</ul></div>` : ""}</footer>`;
}
function configBody(recipe, variant = null) {
  const sections = (values) => Object.entries(values).filter(([, text]) => text).map(([title, text]) =>
    title === "Safety" ? `<aside class="callout">${md(text)}</aside>` :
      ["Fallback", "Prerequisites"].includes(title) ? `<details><summary>${html(title)}</summary>${md(text)}</details>` :
        `<section class="${title === "Steps" ? "config-steps" : "config-context"}"><h4>${html(title === "Steps" ? recipe.labels?.["Steps label"] ?? title : title)}</h4>${md(text)}</section>`).join("");
  const { Safety, Scope, Role, Prerequisites, Steps, Prediction, Fallback } = recipe.sections;
  return `${md(recipe.markdown)}${sections({ Safety, Scope, Role, Prerequisites, Steps })}
    ${variant ? sourced(variant.source, `Variant for ${variant.optionId}`, `${md(variant.markdown)}${sections(variant.sections)}`) : ""}${sections({ Prediction, Fallback })}`;
}
function taskDone(path, task) {
  const key = JSON.stringify({ view: "checklist", pathId: path.id, stepId: task.id });
  return (pendingSaves.get(key) ?? drafts.get(key))?.done ?? task.done;
}
function workflowHeading(number, title, description = "", actions = "", className = "") {
  return `<header class="workflow-heading ${className}"><span class="workflow-number${className === "config-heading" ? " config-step-number" : ""}" aria-hidden="true">${number}</span>
    <div class="workflow-heading-copy"><h2>${html(title)}</h2>${description ? `<p class="muted">${html(description)}</p>` : ""}</div>${actions}</header>`;
}
function doneActions(done, attribute, eligible) {
  return `<div class="config-heading-actions"><span class="config-done-indicator" data-step-done-status role="status" ${done ? "" : "hidden"}>${icon("check")}Done</span>
    <button type="button" class="btn btn-sm config-action ${done ? "btn-danger" : "btn-primary"}" ${attribute} aria-pressed="${done}"
      title="${done ? "Mark this step as not done" : "Mark this step as done"}"
      ${eligible ? "" : "disabled"}>${done ? "Undo" : `${icon("check")}Mark as done`}</button></div>`;
}
function configHeading(path, progress, task, type, readOnly = false) {
  const tasks = configurationChecklist(path, progress, state.checklist), done = taskDone(path, task);
  return workflowHeading(tasks.some((item) => item.id === task.id) ? tasks.findIndex((item) => item.id === task.id) + 1 : task.number, task.title, type,
    doneActions(done, readOnly ? "data-review-action" : `data-checklist="${html(task.id)}"`, !readOnly && task.eligible), "config-heading");
}
function refreshVerification() {
  if (showingAllVariants) return;
  const route = routeNow(), button = main.querySelector("[data-verify-done]");
  if (!button || route.stage !== "verify") return;
  const path = pathFor(route), task = verificationChecklist(path, state.paths[route.pathId], state.checklist).find((item) => item.id === `verify:${route.exerciseId}`);
  if (!task) return;
  const done = taskDone(path, task);
  main.querySelector(".config-card")?.classList.toggle("is-done", done);
  main.querySelector("[data-step-done-status]").hidden = !done;
  button.setAttribute("aria-pressed", String(done));
  button.classList.toggle("btn-primary", !done);
  button.classList.toggle("btn-danger", done);
  button.title = done ? "Mark this step as not done" : "Mark this step as done";
  button.innerHTML = done ? "Undo" : `${icon("check")}Mark as done`;
  button.disabled = !task.eligible;
}
function refreshChecklist() {
  if (showingAllVariants) return;
  const route = routeNow();
  if (route.view !== "lab" || route.stage !== "configure") return;
  const tasks = configurationChecklist(pathFor(route), state.paths[route.pathId], state.checklist);
  const path = pathFor(route), task = tasks.find((task) => task.id === route.stepId);
  if (!task) return;
  const done = taskDone(path, task), button = main.querySelector("[data-checklist]");
  main.querySelector(".config-card")?.classList.toggle("is-done", done);
  const indicator = main.querySelector("[data-step-done-status]");
  if (indicator) indicator.hidden = !done;
  if (button) {
    button.setAttribute("aria-pressed", String(done));
    button.classList.toggle("btn-primary", !done);
    button.classList.toggle("btn-danger", done);
    button.title = done ? "Mark this step as not done" : "Mark this step as done";
    button.innerHTML = done ? "Undo" : `${icon("check")}Mark as done`;
  }
}
function comparisonDecisions(path, route) {
  const recipe = path.recipes.find((item) => `recipe:${item.id}` === route.stepId);
  if (!recipe) return [];
  return path.decisions.filter((decision) => decision.options.filter((option) => !option.deferred).length > 1 &&
    (decision.id === recipe.variantDecisionId || recipe.requiresDecisions.includes(decision.id) ||
      recipe.requiresAnswers.some((ref) => ref.decisionId === decision.id) ||
      decision.options.some((option) => option.recipeIds.includes(recipe.id))));
}
function renderComparison(path, route) {
  const decisions = comparisonDecisions(path, route);
  if (!decisions.length) return "";
  return `<section class="config-comparison" id="comparison-panel" aria-labelledby="comparison-title" hidden>
    <div class="comparison-heading"><h3 id="comparison-title">${icon("compare")}Compare answers</h3>
      <button class="btn btn-icon" type="button" data-compare-close aria-label="Close comparison">${icon("close")}</button></div>
    <p class="muted">Read-only preview. Your saved answer, instructions and progress stay unchanged.</p>
    ${decisions.length > 1 ? `<div class="comparison-decisions" role="group" aria-label="Decision to compare">${decisions.map((decision) =>
      `<button class="btn" type="button" data-compare-decision="${html(decision.id)}" aria-pressed="false">${html(decision.title)}</button>`).join("")}</div>` : ""}
    <fieldset class="comparison-answers"><legend id="comparison-question"></legend><div id="comparison-answers"></div></fieldset>
    <div id="comparison-preview" aria-live="polite"></div></section>`;
}
function updateComparison(decisionId, optionId) {
  const panel = main.querySelector("#comparison-panel");
  if (!panel) return;
  const path = pathFor(routeNow()), progress = state.paths[path.id];
  const decision = path.decisions.find((item) => item.id === decisionId);
  panel.dataset.decisionId = decisionId;
  if (!optionId) {
    optionId = decision.options.find((option) => !option.deferred && option.id !== progress.decisions[decision.id])?.id ??
      decision.options.find((option) => !option.deferred).id;
    panel.querySelector("#comparison-question").textContent = decision.title;
    for (const button of panel.querySelectorAll("[data-compare-decision]")) button.setAttribute("aria-pressed", String(button.dataset.compareDecision === decisionId));
    panel.querySelector("#comparison-answers").innerHTML = decision.options.filter((option) => !option.deferred).map((option) =>
      `<label class="comparison-answer"><input type="radio" name="comparison-answer" data-compare-answer value="${html(option.id)}" ${option.id === optionId ? "checked" : ""}>
        <span>${html(option.label)}</span>${progress.decisions[decision.id] === option.id ? '<span class="config-tag">Saved answer</span>' : ""}</label>`).join("");
  }
  const alternatives = configurationFor(path, { ...progress, decisions: { ...progress.decisions, [decision.id]: optionId } });
  const entries = alternatives.recipes.filter(({ recipe, selectedBy }) =>
    selectedBy.some((item) => item.decisionId === decision.id) || recipe.variantDecisionId === decision.id ||
    recipe.requiresDecisions.includes(decision.id) || recipe.requiresAnswers.some((ref) => ref.decisionId === decision.id));
  panel.querySelector("#comparison-preview").innerHTML = `<h4 class="comparison-result-title">${icon("list")}Instructions for this answer</h4>${entries.length ? entries.map((entry) =>
    `<section class="comparison-recipe"${src(entry.recipe.source, `Recipe ${entry.recipe.id}`)}><h3>${html(entry.recipe.title)}</h3>${!entry.eligible ? '<p class="notice">Prerequisites or conflicts remain unresolved in this preview.</p>' : ""}
      ${entry.warnings.map((warning) => `<aside class="notice"${src(warning.source, `Warning ${warning.id}`)}>${md(warning.markdown)}</aside>`).join("")}
      ${configBody(entry.recipe, entry.variant)}${entry.recipe.datasets.map((dataset) => md(dataset.markdown)).join("")}
      ${configMeta(entry.recipe)}</section>`).join("") : "<p>No decision-specific configuration steps are selected by this answer.</p>"}`;
}
function checkpoints(items) {
  return items.length ? `<details><summary>Prediction and discussion checkpoints</summary>${items.map((item) =>
    `<section${src(item.source, `Checkpoint ${item.id}`)}>${md(item.markdown)}${md(item.question)}<details><summary>Reveal explanation</summary>${md(item.answer)}</details></section>`).join("")}</details>` : "";
}
function renderDecision(decision, progress, number) {
  const question = renderQuestion(decision.question, state?.profile);
  return `<article class="decision-card workflow-card" data-decision-id="${html(decision.id)}"${src(decision.source, `Decision ${decision.id}`)}>
    <header class="workflow-heading decision-heading">
      <span class="workflow-number" aria-hidden="true">${number}</span>
      <div class="workflow-heading-copy">
        ${question.singleParagraph ? `<span class="decision-heading-title">${html(decision.title)}</span>
          <h2 id="decision-question">${question.html}</h2>` : `<h2 class="decision-heading-title">${html(decision.title)}</h2>`}
      </div>
    </header>
    <div class="workflow-body">
    ${question.singleParagraph ? "" : `<div id="decision-question">${question.html}</div>`}
    ${md(decision.markdown)}
    ${decision.guidance ? `<section aria-label="Decision guidance">${md(decision.guidance)}</section>` : ""}
    <form id="workflow-form"><fieldset aria-labelledby="decision-question"><legend class="sr-only">Choose an answer</legend>
    ${decision.options.map((option) => `<label class="choice"${src(option.source, `Answer ${decision.id} · ${option.label}`)}><input type="radio" name="decision" value="${html(option.id)}" required ${progress.decisions[decision.id] === option.id ? "checked" : ""}>
    <span><strong>${html(option.label)}</strong><span class="muted">${md(option.markdown)}</span></span></label>`).join("")}</fieldset>
    </form>
    ${checkpoints(decision.checkpoints)}</div></article>`;
}
const decisionCounts = (overview) => `${overview.answered} / ${overview.decisions.length} answered`;
const decisionStatus = (decision) => `${decision.status}${decision.answer ? ` · ${decision.answer}` : ""}`;
function progressMeter(label, value, total, description) {
  return `<progress class="journey-meter" aria-label="${html(label)}" value="${value}" max="${total || 1}" aria-valuetext="${html(description)}"></progress>`;
}
function renderDecisionStatus(decision) {
  return `${decision.status === "Answered" ? icon("check") : ""}<span>${html(decisionStatus(decision))}</span>`;
}
function renderItemBrowser(title, label, navigationLabel, items, counts = "", className = "", tabs = "") {
  return `<aside class="stage-sidebar" aria-label="${html(title)}">
    <h2 class="sidebar-heading">${html(title)}</h2>
    <details class="item-browser ${className}"><summary>${html(label)}</summary>
      ${tabs}
      <nav aria-label="${html(navigationLabel)}"><ul>${items}</ul></nav>
      ${counts}</details></aside>`;
}
function renderQuestionBrowser(path, progress, route) {
  const overview = decisionOverview(path, progress);
  const items = overview.decisions.map((decision, index) => `<li><a href="${decisionRoute(path.id, decision.id)}" data-route ${decision.id === route.decisionId ? 'aria-current="page"' : ""}>
    <span class="browser-number" aria-hidden="true">${index + 1}</span><span class="browser-copy"><span>${html(decision.title)}</span>
    <span class="item-status${decision.status === "Answered" ? " is-done" : ""}" data-question-status="${html(decision.id)}">${renderDecisionStatus(decision)}</span></span></a></li>`).join("");
  return renderItemBrowser("Questions", "Browse questions", "Decision questions", items,
    `<div class="stage-counts"><p class="decision-counts" aria-live="polite">${decisionCounts(overview)}</p>
      ${progressMeter("Decisions answered", overview.answered, overview.decisions.length, decisionCounts(overview))}</div>`);
}
function refreshItemBrowser() {
  if (showingAllVariants) return;
  const route = JSON.parse(renderedRoute);
  const path = pathFor(route), progress = state.paths[route.pathId];
  if (route.view === "decision") {
    const overview = decisionOverview(path, progress);
    main.querySelector(".decision-counts").textContent = decisionCounts(overview);
    const meter = main.querySelector(".stage-counts progress");
    meter.value = overview.answered;
    meter.setAttribute("aria-valuetext", decisionCounts(overview));
    for (const label of main.querySelectorAll("[data-question-status]")) {
      const decision = overview.decisions.find((decision) => decision.id === label.dataset.questionStatus);
      label.classList.toggle("is-done", decision.status === "Answered");
      label.innerHTML = renderDecisionStatus(decision);
    }
  } else if (route.view === "lab" && route.stage === "configure") {
    const tasks = configurationChecklist(path, progress, state.checklist);
    const counts = main.querySelector(".config-counts");
    if (counts) {
      const done = tasks.filter((task) => taskDone(path, task)).length;
      counts.textContent = `${done} of ${tasks.length} done`;
      const meter = main.querySelector(".stage-counts progress");
      meter.value = done;
      meter.setAttribute("aria-valuetext", `${done} of ${tasks.length} steps marked done; personal markers, not applied configuration`);
    }
    for (const label of main.querySelectorAll("[data-step-status]")) {
      const task = tasks.find((item) => item.id === label.dataset.stepStatus), done = taskDone(path, task);
      label.classList.toggle("is-done", done);
      label.innerHTML = `${icon(done ? "check" : "circle")}${done ? "Done" : task.eligible ? "Not done" : "Needs review"}`;
    }
  } else if (route.view === "lab") {
    const exercises = configurationFor(path, progress).exercises;
    for (const label of main.querySelectorAll("[data-exercise-status]")) {
      const entry = exercises.find(({ recipe }) => recipe.exerciseId === label.dataset.exerciseStatus);
      const text = exerciseStatus(path, entry, progress, route.stage), done = text === "Done";
      label.innerHTML = `${icon(done ? "check" : "circle")}${html(text)}`;
      label.classList.toggle("is-done", done);
    }
    const done = exercises.filter((entry) => exerciseStatus(path, entry, progress, route.stage) === "Done").length;
    const counts = main.querySelector(".verify-counts"), meter = main.querySelector(".stage-counts progress");
    if (counts) counts.textContent = `${done} of ${exercises.length} done`;
    if (meter) {
      meter.value = done;
      meter.setAttribute("aria-valuetext", `${done} of ${exercises.length} participant-reported verifications done`);
    }
  }
}
function exerciseStatus(path, entry, progress, stage) {
  if (!entry.eligible) return "Needs review";
  const task = verificationChecklist(path, progress, state.checklist).find((item) => item.id === `verify:${entry.recipe.exerciseId}`);
  if (task && taskDone(path, task)) return "Done";
  const { recipe } = entry, record = progress.exercises[recipe.exerciseId];
  if (record.verified && record.basis === exerciseBasis(path, progress, recipe)) return "Participant-reported verified";
  if (record.evidence.trim()) return "Evidence recorded";
  return readyToVerify(path, progress, recipe.exerciseId) ? "Ready to verify" : "Not started";
}
function renderExerciseBrowser(path, progress, route, exercises) {
  if (exercises.length < 2) return "";
  const done = exercises.filter((entry) => exerciseStatus(path, entry, progress, route.stage) === "Done").length;
  return renderItemBrowser("Exercises", "Browse exercises", "Selected exercises", exercises.map((entry, index) =>
    `<li><a href="${labRoute(path.id, route.stage, entry.recipe.exerciseId)}" data-route ${entry.recipe.exerciseId === route.exerciseId ? 'aria-current="page"' : ""}>
      <span class="browser-number" aria-hidden="true">${index + 1}</span><span class="browser-copy"><span>${html(entry.validation.title)}</span><span class="config-task-status${exerciseStatus(path, entry, progress, route.stage) === "Done" ? " is-done" : ""}" data-exercise-status="${html(entry.recipe.exerciseId)}">${icon(exerciseStatus(path, entry, progress, route.stage) === "Done" ? "check" : "circle")}${html(exerciseStatus(path, entry, progress, route.stage))}</span></span></a></li>`).join(""),
    `<div class="stage-counts"><p class="verify-counts" aria-live="polite">${done} of ${exercises.length} done</p>
      ${progressMeter("Verification steps marked done", done, exercises.length, `${done} of ${exercises.length} participant-reported verifications done`)}</div>`);
}
function renderConfigurationBrowser(path, progress, route) {
  const tasks = configurationChecklist(path, progress, state.checklist);
  if (!tasks.length) return "";
  const doneCount = tasks.filter((task) => taskDone(path, task)).length;
  return renderItemBrowser("Configuration", "Browse configuration steps", "Configuration steps", tasks.map((task, index) => {
    const done = taskDone(path, task);
    return `<li><a href="${configurationRoute(path.id, task.id)}" data-route ${task.id === route.stepId ? 'aria-current="page"' : ""}>
      <span class="browser-number config-browser-number" aria-hidden="true">${index + 1}</span><span class="browser-copy"><span>${html(task.title)}</span>
      <span class="config-task-status${done ? " is-done" : ""}" data-step-status="${html(task.id)}">${icon(done ? "check" : "circle")}${done ? "Done" : task.eligible ? "Not done" : "Needs review"}</span></span></a></li>`;
  }).join(""), `<div class="stage-counts"><p class="config-counts" aria-live="polite">${doneCount} of ${tasks.length} done</p>
    ${progressMeter("Configuration steps marked done", doneCount, tasks.length,
      `${doneCount} of ${tasks.length} steps marked done; personal markers, not applied configuration`)}</div>`, "config-browser");
}
function renderConfigure(path, progress, route) {
  const tasks = configurationChecklist(path, progress, state.checklist), task = tasks.find((item) => item.id === route.stepId);
  const unanswered = path.decisions.find((decision) => !progress.decisions[decision.id]);
  const introduction = `${sourced(path.stages.configure.source, "Configure stage", md(path.stages.configure.introduction))}${task && unanswered ? `<aside class="notice config-unanswered"><h2>Decisions remain</h2>
    <p>These are the steps selected so far. Answer the remaining questions to see all applicable instructions.</p>
    <a href="${decisionRoute(path.id, unanswered.id)}" data-route>Review unanswered decisions</a></aside>` : ""}`;
  if (!task) {
    return `${introduction}<article class="decision-card"><h2>${unanswered ? "Decisions remain" : "No configuration steps selected."}</h2>
      <p>${unanswered ? "Answer the remaining questions to determine which configuration steps apply." : "You can revisit decisions or continue to validation."}</p></article>`;
  }
  const entry = configurationFor(path, progress).recipes.find(({ recipe }) => `recipe:${recipe.id}` === task.id);
  return `${introduction}${renderConfigurationCard(path, progress, route, task, entry)}`;
}
function renderConfigurationCard(path, progress, route, task, entry, readOnly = false) {
  const recipe = entry?.recipe;
  const type = recipe ? recipe.kind === "guidance" ? "" : "Exercise" : "Additional step";
  const additional = path.stages.configure.additionalSteps.find((step) => `additional:${step.title}` === task.id);
  return `<article class="config-card workflow-card${taskDone(path, task) ? " is-done" : ""}" data-config-step="${html(task.id)}"
    ${recipe ? `data-recipe-id="${html(recipe.id)}"` : ""} ${recipe?.kind === "exercise" ? `data-exercise-id="${html(recipe.exerciseId)}"` : ""}${src(recipe?.source ?? additional?.source ?? path.stages.configure.source, recipe ? `Recipe ${recipe.id}` : additional ? `Additional step: ${additional.title}` : "Configure stage")}>
    ${configHeading(path, progress, task, type, readOnly)}
    ${entry ? "" : '<p class="config-independent">Applies independently of your decision answers.</p>'}
    ${!task.eligible ? `<aside class="notice">Prerequisites or conflicts need review before applying these instructions.
      ${list([...entry.missingDecisionIds, ...entry.missingAnswers.map((ref) => `${ref.decisionId}.${ref.optionId}`), ...entry.conflicts])}</aside>` : ""}
    ${entry?.warnings.map((warning) => `<aside class="notice"${src(warning.source, `Warning ${warning.id}`)}>${md(warning.markdown)}</aside>`).join("") ?? ""}
    <section class="config-instructions" aria-label="Configuration instructions"><h3>${icon("list")}What to do</h3>
      ${recipe ? configBody(recipe, entry.variant) : `<div class="config-steps">${md(additional?.markdown ?? path.stages.configure.conclusion)}</div>`}
      ${recipe?.datasets.map((dataset) => `<section aria-label="Fictional dataset"${src(dataset.source, `Dataset ${dataset.id}`)}>${md(dataset.markdown)}</section>`).join("") ?? ""}
      ${recipe ? checkpoints(recipe.checkpoints) : ""}</section>
    ${entry ? decisionsTaken(path, entry.selectedBy, route, readOnly) : ""}${recipe ? configMeta(recipe) : ""}</article>`;
}
function renderRecipes(path, progress, route) {
  if (route.stage === "configure") return renderConfigure(path, progress, route);
  const resolved = configurationFor(path, progress), entry = resolved.exercises.find(({ recipe }) => recipe.exerciseId === route.exerciseId);
  const introduction = sourced(path.stages.validation.source, "Validation stage", md(path.stages.validation.introduction));
  if (!entry) {
    if (!route.exerciseId && resolved.exercises.length && introduction) {
      return `<article class="workflow-card verification-introduction" data-verify-introduction>
        ${workflowHeading("i", "Before you verify")}
        <div class="workflow-body">${introduction}</div></article>`;
    }
    const unanswered = decisionOverview(path, progress).unanswered > 0;
    const preview = unanswered ? path.validations.map((validation) => {
      const variant = resolveValidationVariant(path, validation, progress.decisions);
      const details = validation.variantDecisionId && !variant
        ? `<aside class="notice">Answer "${html(path.decisions.find((item) => item.id === validation.variantDecisionId)?.title ?? validation.variantDecisionId)}" to see the matching verification path.</aside>`
        : `<h3>${html(validation.labels["Task label"] ?? "Validation steps")}</h3>${md(variant?.sections.Steps ?? validation.sections.Steps)}
          <h3>Expected result</h3>${md(variant?.sections["Expected result"] ?? validation.sections["Expected result"])}
          <h3>Evidence</h3>${md(variant?.sections.Evidence ?? validation.sections.Evidence)}`;
      return `<article class="decision-card validation-preview" data-preview-exercise-id="${html(validation.exerciseId)}"${src(validation.source, `Validation ${validation.exerciseId}`)}>
        <span class="eyebrow">${html(validation.exerciseId)} · preview</span><h2>${html(validation.title)}</h2>
        <aside class="notice">Preview only. This exercise applies only if your answers select it, and it can't be marked complete from here.</aside>
        ${md(validation.markdown)}${variant ? md(variant.markdown) : ""}${details}</article>`;
    }).join("") : "";
    return `${introduction}<article class="decision-card"><h2>${unanswered ? "Decisions remain" : "No applicable exercises"}</h2>
      <p>${unanswered ? "Answer the remaining questions to determine which exercises apply. No configuration or validation is claimed." :
        "No configuration or validation is claimed. You can revisit decisions or continue to the summary."}</p></article>${preview}`;
  }
  return renderValidationCard(path, progress, entry, resolved.exercises.indexOf(entry) + 1);
}
function renderValidationCard(path, progress, entry, number, readOnly = false) {
  const { recipe, validation } = entry;
  const validationVariantPending = validation.variantDecisionId && !validation.activeVariant;
  const task = verificationChecklist(path, progress, state.checklist).find((item) => item.id === `verify:${recipe.exerciseId}`), done = task ? taskDone(path, task) : false;
  return `<article class="config-card workflow-card${done ? " is-done" : ""}" data-exercise-id="${html(recipe.exerciseId)}"${src(validation.source, `Validation ${validation.exerciseId}`)}>
    ${workflowHeading(number, validation.title, "Personal Done marker, not evidence-backed verification.",
      doneActions(done, readOnly ? "data-review-action" : `data-verify-done data-checklist="${html(task.id)}"`, !readOnly && entry.eligible), "config-heading")}
    <div class="workflow-body">
    ${!entry.eligible ? `<aside class="notice">Resolve this exercise's required choices and conflicting selections before claiming completion.
      ${list([...entry.missingDecisionIds, ...entry.missingAnswers.map((ref) => `${ref.decisionId}.${ref.optionId}`), ...entry.conflicts])}</aside>` : ""}
    ${entry.warnings.map((warning) => `<aside class="notice"${src(warning.source, `Warning ${warning.id}`)}>${md(warning.markdown)}</aside>`).join("")}
    ${md(validation.markdown)}
    ${validation.activeVariant ? md(validation.activeVariant.markdown) : ""}
    ${recipe.datasets.length ? `<details><summary>Revisit fictional dataset</summary>${recipe.datasets.map((dataset) =>
      sourced(dataset.source, `Dataset ${dataset.id}`, md(dataset.markdown))).join("")}</details>` : ""}
    ${validationVariantPending
      ? `<aside class="notice">Resolve the "${html(path.decisions.find((item) => item.id === validation.variantDecisionId)?.title ?? validation.variantDecisionId)}" decision to see its matching verification path.</aside>`
      : `<section class="config-steps"><h3>${html(validation.labels["Task label"] ?? "Validation steps")}</h3>${md(validation.sections.Steps)}</section>
        <h3>Expected result</h3>${md(validation.sections["Expected result"])}${checkpoints(validation.checkpoints)}
        ${validation.sections.Fallback ? `<details><summary>Prepared fallback</summary>${md(validation.sections.Fallback)}</details>` : ""}`}</div></article>`;
}
function recipeTriggers(path, recipe) {
  return path.decisions.flatMap((decision) => decision.options
    .filter((option) => option.recipeIds.includes(recipe.id))
    .map((option) => ({ decision, option })));
}
function reviewProvenance(path, recipe, variant = null, variantDecisionId = recipe.variantDecisionId) {
  const triggers = recipeTriggers(path, recipe);
  const decision = path.decisions.find((item) => item.id === variantDecisionId);
  const option = decision?.options.find((item) => item.id === variant?.optionId);
  return `<aside class="dev-review-provenance">
    <span class="eyebrow">Developer context · not participant content</span>
    <h4>${icon("decision")}Decision tree</h4>
    <p>Any of these answers selects this configuration:</p>
    ${triggers.length ? `<ul>${triggers.map(({ decision: triggerDecision, option: triggerOption }) =>
      `<li>${html(triggerDecision.title)} → ${html(triggerOption.label)}</li>`).join("")}</ul>` :
      "<p>No decision option currently selects this recipe.</p>"}
    ${variant ? `<p><strong>Then show this variant when:</strong> ${html(decision?.title ?? variantDecisionId)} → ${html(option?.label ?? variant.optionId)}</p>` : ""}
    ${recipe.requiresAnswers.length ? `<p><strong>Also requires:</strong></p><ul>${recipe.requiresAnswers.map((ref) => {
      const required = path.decisions.find((item) => item.id === ref.decisionId);
      return `<li>${html(required.title)} → ${html(required.options.find((item) => item.id === ref.optionId).label)}</li>`;
    }).join("")}</ul>` : ""}
    ${recipe.requiresDecisions.length ? `<p><strong>Resolved decisions required:</strong> ${recipe.requiresDecisions
      .map((id) => html(path.decisions.find((item) => item.id === id).title)).join(", ")}</p>` : ""}
  </aside>`;
}
function reviewWarnings(path, recipe) {
  return recipe.warnings.map((warning) => `<aside class="notice dev-review-warning" data-review-warning="${html(warning.id)}"${src(warning.source, `Warning ${warning.id}`)}>
    <strong>Conditional warning · applies when</strong>
    <ul>${warning.when.map(({ decisionId, optionId }) => {
      const decision = path.decisions.find((item) => item.id === decisionId);
      const option = decision?.options.find((item) => item.id === optionId);
      return `<li>${html(decision?.title ?? decisionId)} → ${html(option?.label ?? optionId)}</li>`;
    }).join("")}</ul>${md(warning.markdown)}</aside>`).join("");
}
function reviewItems(path) {
  const additionalSteps = [
    ...(path.stages.configure.conclusion ? [{ id: "introduction:configure", title: "Additional steps" }] : []),
    ...(path.stages.configure.additionalSteps ?? []),
  ];
  return [
    ...path.recipes.flatMap((recipe) => (recipe.variants?.length ? recipe.variants : [null]).map((variant) =>
      ({ stage: "configure", title: recipe.title, recipe, variant, variantDecisionId: recipe.variantDecisionId }))),
    ...additionalSteps.map((step) => ({ stage: "configure", title: step.title, stepId: step.id ?? `additional:${step.title}` })),
    ...path.validations.flatMap((validation) => (validation.variants?.length ? validation.variants : [null]).map((variant) =>
      ({ stage: "verify", title: validation.title, recipe: path.recipes.find((item) => item.exerciseId === validation.exerciseId),
        validation, variant, variantDecisionId: validation.variantDecisionId }))),
  ].map((item, index) => ({ ...item, anchor: `review-path-${index + 1}` }));
}
function reviewProgress(path, item) {
  const decisions = Object.fromEntries(path.decisions.map((decision) =>
    [decision.id, decision.options.find((option) => !option.deferred).id]));
  const trigger = recipeTriggers(path, item.recipe).find(({ decision, option }) =>
    decision.id !== item.variantDecisionId || option.id === item.variant?.optionId) ?? recipeTriggers(path, item.recipe)[0];
  if (trigger) decisions[trigger.decision.id] = trigger.option.id;
  for (const ref of item.recipe.requiresAnswers) decisions[ref.decisionId] = ref.optionId;
  if (item.variant) decisions[item.variantDecisionId] = item.variant.optionId;
  return { ...state.paths[path.id], decisions };
}
function reviewOptionLabel(path, item) {
  return item.variant ? path.decisions.find((decision) => decision.id === item.variantDecisionId)
    .options.find((option) => option.id === item.variant.optionId).label : "";
}
function renderReviewBrowser(path) {
  const items = reviewItems(path).filter((item) => item.stage === reviewStage);
  const tabs = `<div class="dev-review-tabs" role="tablist" aria-label="Review stage">
    ${["configure", "verify"].map((stage) => `<button type="button" role="tab" id="review-tab-${stage}"
      data-review-stage="${stage}" aria-controls="review-panel" aria-selected="${stage === reviewStage}"
      tabindex="${stage === reviewStage ? 0 : -1}">${stage === "configure" ? "Config" : "Validation"}</button>`).join("")}
  </div>`;
  return renderItemBrowser("Included in this view", "Browse all review paths", "All review paths",
    items.map((item) =>
      `<li><a href="#${item.anchor}" data-review-link><span class="browser-copy">${html(item.title)}
        ${item.variant ? `<span class="item-status">${html(reviewOptionLabel(path, item))}</span>` : ""}</span></a></li>`).join(""),
    `<p class="stage-counts">${items.length} paths included</p>`, "dev-review-browser", tabs);
}
function reviewCardHeadings(card) {
  return card.replace(/<(\/?)h([2-6])\b/g, (_, closing, level) => `<${closing}h${Math.min(6, Number(level) + 2)}`);
}
function renderAllVariants(path) {
  const items = reviewItems(path);
  const cards = (stage) => items.filter((item) => item.stage === stage).map((item, index) => {
    let card, context;
    if (item.recipe) {
      const progress = reviewProgress(path, item);
      const resolved = configurationFor(path, progress);
      const entry = resolved.recipes.find(({ recipe }) => recipe.id === item.recipe.id) ??
        { recipe: item.recipe, selectedBy: [], eligible: false, missingDecisionIds: [], missingAnswers: [], conflicts: [], warnings: [], variant: item.variant };
      context = reviewProvenance(path, item.recipe, item.variant, item.variantDecisionId);
      if (stage === "configure") {
        const task = configurationChecklist(path, progress, []).find((task) => task.id === `recipe:${item.recipe.id}`) ??
          { id: `recipe:${item.recipe.id}`, title: item.title, eligible: false, done: false, number: index + 1 };
        card = renderConfigurationCard(path, progress, { stepId: task.id }, task, entry, true);
      } else {
        const exercise = resolved.exercises.find(({ recipe }) => recipe.id === item.recipe.id) ?? {
          ...entry, validation: item.validation.variantDecisionId
            ? { ...item.validation, sections: item.variant.sections, activeVariant: item.variant } : item.validation,
        };
        card = renderValidationCard(path, progress, exercise,
          resolved.exercises.includes(exercise) ? resolved.exercises.indexOf(exercise) + 1 : index + 1, true);
      }
    } else {
      const progress = state.paths[path.id];
      const task = configurationChecklist(path, progress, []).find((task) => task.id === item.stepId);
      context = `<aside class="dev-review-provenance"><span class="eyebrow">Developer context · not participant content</span>
        <h4>Decision tree</h4><p>Applies independently of decision answers.</p></aside>`;
      card = renderConfigurationCard(path, progress, { stepId: item.stepId }, task, null, true);
    }
    return `<section class="dev-review-variant" id="${item.anchor}" tabindex="-1"
      ${stage === "configure" ? `data-review-configuration="${html(item.recipe?.id ?? item.stepId)}"` : `data-review-validation="${html(item.validation.exerciseId)}"`}
      ${item.variant ? `data-review-variant="${html(item.variant.optionId)}"` : ""}>
      ${context}${item.recipe && stage === "configure" && !item.variant ? reviewWarnings(path, item.recipe) : ""}${reviewCardHeadings(card)}</section>`;
  }).join("");
  const stage = reviewStage === "configure" ? path.stages.configure : path.stages.validation;
  return `<section class="dev-review" id="review-panel" role="tabpanel" aria-labelledby="review-tab-${reviewStage}" tabindex="0">
    <h2 id="dev-review-title">All configurations and validation paths</h2>
    <p class="notice">Developer review only. Each participant card previews a representative answer selection for that path, not your saved answers. Decision trees above the cards are developer context. Progress controls are disabled. This view does not evaluate every combination for eligibility or change answers, progress, or completion.</p>
    <h3 class="dev-review-section-title">${reviewStage === "configure" ? "Configurations" : "Validation paths"}</h3>
    ${sourced(stage.source, reviewStage === "configure" ? "Configure stage" : "Validation stage", md(stage.introduction))}
    ${cards(reviewStage) || (reviewStage === "configure" ? "<p>No configuration recipes are authored for this block.</p>" : "<p>No validation paths are authored for this block.</p>")}
  </section>`;
}
function renderSummary(rows) {
  return `<h2>Governance Summary</h2><p>Participant-reported decisions, configuration and validation are separate, not a live audit.</p>
    <div class="export-controls"><button class="btn btn-primary" data-export="markdown">Export Markdown</button><button class="btn" data-export="json">Export JSON</button></div>
    ${rows.map((row) => `<h3 class="summary-heading">${html(row.title)}</h3><p>${row.answered} / ${row.decisions.length} answered; ${row.resolved} resolved.</p>
    ${row.checklist.length ? `<details><summary>Personal configuration checklist · ${row.checklist.filter((task) => task.done).length} / ${row.checklist.length} done</summary>
      <p class="muted">Personal task markers only, not configuration or validation evidence.</p><ul>${row.checklist.map((task) =>
        `<li>${html(task.title)} — ${task.done ? "Done" : "Not done"}</li>`).join("")}</ul></details>` : ""}
      ${row.verificationChecklist.length ? `<details><summary>Personal verification checklist · ${row.verificationChecklist.filter((task) => task.done).length} / ${row.verificationChecklist.length} done</summary>
        <p class="muted">Personal task markers only, not evidence-backed verification.</p><ul>${row.verificationChecklist.map((task) =>
          `<li>${html(task.title)} — ${task.done ? "Done" : "Not done"}</li>`).join("")}</ul></details>` : ""}
    <div class="summary-list">${row.decisions.map((decision) => `<article class="summary-card"><h3><a href="${decisionRoute(row.id, decision.id)}" data-route>${html(decision.id)}: ${html(decision.title)}</a></h3>
      <p>${html(decision.choice)}${decision.deferred ? " (unresolved)" : ""}</p><p>${html(decision.configuration)}</p></article>`).join("")}
    ${row.guidance.map((item) => `<details><summary>${html(item.title)}</summary>
      ${!item.eligible ? '<p class="notice">Prerequisites or conflicting selections remain unresolved; this guidance is not a completed action.</p>' : ""}
      ${md(item.markdown)}
      ${Object.entries(item.sections).map(([title, text]) => `<h4>${html(title)}</h4>${md(text)}`).join("")}</details>`).join("")}
    ${!row.exercises.length ? "<p>No applicable exercises. No configuration or validation is claimed.</p>" : ""}
    ${row.exercises.map((exercise) => `<article class="summary-card"><h3><a href="${labRoute(row.id, "configure", exercise.id)}" data-route>${html(exercise.title)}</a></h3>
      <p>${html(exercise.verificationLabel)}</p>
      ${exercise.settingsUrl ? `<h4>Confirmed target</h4><p class="evidence">${html(exercise.settingsUrl)}</p>` : ""}
      ${[["evidence", "Evidence"], ["issues", "Issues"], ["followUp", "Follow-up actions"]].filter(([key]) => exercise[key]).map(([key, label]) => `<h4>${label}</h4><p class="evidence">${html(exercise[key])}</p>`).join("")}
      ${exercise.responses.filter((response) => response.value).map((response) => `<h4>${html(response.label)}</h4><p class="evidence">${html(response.value)}</p>`).join("")}</article>`).join("")}
    ${row.inactiveExerciseIds.length ? `<details><summary>Inactive exercises (not counted)</summary>${list(row.inactiveExerciseIds)}</details>` : ""}</div>`).join("")}
    ${state.history.length ? `<details><summary>Historical records (not counted)</summary>${state.history.map((item) => `<h3>${html(item.reason)}</h3><pre class="overflow-auto">${html(JSON.stringify(item.data, null, 2))}</pre>`).join("")}</details>` : ""}`;
}
function profileSummary() {
  const { enterpriseSlug = "", organizationSlug = "", repositoryName = DEFAULT_REPOSITORY_NAME } = state.profile ?? {};
  const label = (title, slug, url, symbol, missing = null) => {
    const value = slug || missing || (profileDetection === "loading" || profileDetection === "idle" ? "Loading..." :
      profileDetection === "signin" ? "Sign-in required" : "Not configured");
    const text = `${icon(symbol)}<span><span class="profile-caption">${title}: </span><span class="profile-value">${html(value)}</span></span>`;
    return slug ? `<a class="profile-label" href="${url}${html(slug)}" target="_blank" rel="noopener noreferrer">${text}</a>` :
      `<span class="profile-label">${text}</span>`;
  };
  return `<p>${label("Your Enterprise", enterpriseSlug, "https://github.com/enterprises/", "globe")}</p>
    <p>${label("Your Organization", organizationSlug, "https://github.com/", "organization")}</p>
    <p>${label("Your Repository", organizationSlug && repositoryName ? repositoryName : "", `https://github.com/${html(organizationSlug)}/`, "repo", "Not configured")}</p>`;
}
function refreshProfile() {
  const summary = profileHost.querySelector("#profile-summary");
  if (!summary) return;
  if (state.profile?.enterpriseSlug && state.profile?.organizationSlug) profileDetectionError = "";
  const markup = profileSummary();
  if (summary.innerHTML !== markup) summary.innerHTML = markup;
  profileHost.querySelector("#profile-open").hidden = profileDetection === "loading" || profileDetection === "idle";
  const message = profileHost.querySelector("#profile-detection-error");
  message.textContent = profileDetectionError || profileNotice;
  message.hidden = !message.textContent;
  // Compare with the last rendered string so unchanged buttons keep focus.
  const signIn = profileHost.querySelector("#profile-signin"), signInNext = signInMarkup();
  if (signIn && signInRendered.get(signIn) !== signInNext) { signIn.innerHTML = signInNext; signInRendered.set(signIn, signInNext); }
  if (signIn) signIn.hidden = !signInNext;
  for (const link of main.querySelectorAll("[data-profile-link]")) {
    const url = resolveContentLinkTarget(link.dataset.profileLink, state.profile);
    if (url) link.href = url; else link.removeAttribute("href");
  }
  for (const command of main.querySelectorAll("[data-profile-command]")) {
    command.textContent = resolveContentCommand(command.dataset.profileCommand, state.profile);
  }
}
async function detectLabProfile() {
  if (profileDetection !== "idle") return;
  if (state.profile?.enterpriseSlug && state.profile?.organizationSlug) {
    profileDetection = "configured"; refreshProfile(); return;
  }
  profileDetection = "loading"; profileDetectionCode = ""; profileNotice = ""; refreshProfile();
  const epoch = profileEpoch;
  try { authState = await (await request("/api/auth/status")).json(); }
  catch (reason) { authState = { status: "failed", account: null, missingScopes: [], message: reason.message }; }
  if (epoch !== profileEpoch) { profileDetection = "idle"; void detectLabProfile(); return; }
  if (authState.status !== "ready") {
    profileDetection = "signin"; refreshProfile();
    if (signInPending && !signInTimer) signInTimer = setTimeout(pollSignIn, SIGN_IN_POLL_MS);
    return;
  }
  stopSignInPolling();
  try {
    const { profile, error: failure, notices = [] } = await (await request("/api/profile/discover", { automatic: true })).json();
    if (epoch !== profileEpoch) { profileDetection = "idle"; void detectLabProfile(); return; }
    if (failure) throw Object.assign(new Error(failure.message), { code: failure.code });
    if (!profile) throw new Error("No lab enterprise was detected.");
    if (drafts.has(profileKey) || ["enterpriseSlug", "organizationSlug"].some((key) => state.profile?.[key] && state.profile[key] !== profile[key])) {
      throw new Error("Your existing profile was kept. Complete the profile manually.");
    }
    const { repositoryName, ...slugs } = profile;
    const keepRepository = state.profile?.repositoryName && state.profile.repositoryName !== DEFAULT_REPOSITORY_NAME;
    const detectedProfile = { ...state.profile, ...slugs, ...(repositoryName && !keepRepository ? { repositoryName } : {}) };
    rememberDraft(profileKey, detectedProfile); pendingSaves.set(profileKey, detectedProfile);
    if (!await flushSaves()) throw new Error("The detected lab profile could not be saved. Configure it manually.");
    profileDetection = "configured"; profileNotice = notices.join(" ");
  } catch (reason) {
    if (epoch !== profileEpoch) { profileDetection = "idle"; void detectLabProfile(); return; }
    profileDetection = "failed"; profileDetectionError = reason.message; profileDetectionCode = reason.code ?? "";
  }
  refreshProfile();
}
function stopSignInPolling() {
  clearTimeout(signInTimer); signInTimer = null; signInPending = false; signInError = "";
}
async function pollSignIn() {
  signInTimer = null;
  if (!signInPending || profileDetection !== "signin") return;
  const epoch = profileEpoch;
  let next = authState;
  try { next = await (await request("/api/auth/status")).json(); } catch { /* keep the last known status and retry */ }
  if (epoch !== profileEpoch || profileDetection !== "signin" || !signInPending) return;
  authState = next;
  // When switching accounts, the previous ready account is not the new sign-in.
  if (next.status === "ready" && next.account !== signInReplaces) { stopSignInPolling(); profileDetection = "idle"; void detectLabProfile(); return; }
  if (Date.now() > signInDeadline) signInPending = false;
  else signInTimer = setTimeout(pollSignIn, SIGN_IN_POLL_MS);
  refreshProfile();
}
async function startSignIn(mode) {
  clearTimeout(signInTimer); signInTimer = null; signInError = "";
  try {
    await request("/api/auth/sign-in", { mode });
    signInReplaces = mode === "login" && authState?.status === "ready" ? authState.account : null;
    signInPending = true; signInDeadline = Date.now() + SIGN_IN_TIMEOUT_MS;
    if (profileDetection === "failed") { profileDetection = "signin"; profileDetectionError = ""; profileDetectionCode = ""; }
    signInTimer = setTimeout(pollSignIn, SIGN_IN_POLL_MS);
  } catch (reason) { signInPending = false; signInError = reason.message; }
  refreshProfile();
}
function checkSignInAgain() {
  if (profileDetection === "loading") return;
  clearTimeout(signInTimer); signInTimer = null;
  if (signInPending) signInDeadline = Date.now() + SIGN_IN_TIMEOUT_MS;
  profileDetection = "idle"; profileDetectionError = ""; profileDetectionCode = "";
  void detectLabProfile();
}
function signInMarkup() {
  const wrongAccount = profileDetection === "failed" && ["not-found", "unauthenticated", "forbidden"].includes(profileDetectionCode);
  if (profileDetection !== "signin" && !wrongAccount) return "";
  const button = (mode, label, primary = false) => `<button class="btn${primary ? " btn-primary" : ""}" type="button" data-sign-in="${mode}">${label}</button>`;
  const check = `<button id="profile-signin-check" class="btn" type="button">Check again</button>`;
  const status = authState?.status;
  const login = button("login", "Log into CLI", true);
  const purpose = "Sign-in opens a terminal and your browser, and requests the <code>admin:enterprise</code> and <code>admin:org</code> scopes.";
  let intro, actions;
  if (wrongAccount) {
    intro = `If this is not your lab account, log into GitHub CLI with the account that administers your lab enterprise. ${purpose}`;
    actions = login;
  } else if (status === "missing-scopes") {
    intro = `${html(authState.message)} Grant them to detect your lab enterprise, organization, and repository, or log in with your lab account instead.`;
    actions = `${button("refresh", "Grant admin scopes", true)}${button("login", "Use a different account")}${check}`;
  } else if (status === "ready" && signInPending) {
    intro = "Complete the sign-in for your lab account in the terminal and browser.";
    actions = check;
  } else if (status === "gh-missing") {
    intro = html(authState.message);
    actions = check;
  } else if (status === "signed-out") {
    intro = `Log into GitHub CLI with your lab account so the workshop can detect your enterprise, organization, and repository. ${purpose}`;
    actions = `${login}${check}`;
  } else {
    intro = `${html(authState?.message ?? "GitHub CLI sign-in status is unknown.")} Log into GitHub CLI with your lab account to detect your enterprise, organization, and repository. ${purpose}`;
    actions = `${login}${check}`;
  }
  const progress = signInError ? html(signInError) :
    signInPending ? "Waiting for sign-in. Finish it in the terminal and browser; the one-time code is copied to your clipboard. Detection starts automatically." :
    signInDeadline && Date.now() > signInDeadline && profileDetection === "signin" ? "Sign-in was not detected yet. Check again, or start sign-in again." : "";
  return `<p class="profile-signin-intro">${intro}</p><div class="profile-signin-actions">${actions}</div>
    <p class="profile-signin-status">${progress}</p>`;
}
function renderProfile() {
  const profile = state.profile ?? { enterpriseSlug: "", organizationSlug: "" };
  const field = (id, name, label, value) => `<div class="profile-field">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${name}" type="text" maxlength="100" autocomplete="off" spellcheck="false" value="${html(value)}">
      <div class="profile-detected" data-profile-detected="${name}" hidden></div>
    </div>`;
  return `<section class="enterprise-profile" aria-labelledby="enterprise-profile-title">
    <div class="enterprise-profile-copy"><h2 id="enterprise-profile-title" class="sr-only">Your lab accounts</h2>
      <div id="profile-summary" class="profile-summary" role="status" aria-live="polite">${profileSummary()}</div>
      <p id="profile-detection-error" class="profile-detection-error" hidden></p>
      <div id="profile-signin" class="profile-signin" role="region" aria-label="GitHub CLI sign-in" aria-live="polite" hidden></div></div>
    <button id="profile-open" class="btn" type="button" aria-haspopup="dialog" aria-controls="profile-panel" aria-expanded="false" hidden>Configure enterprise profile</button>
  </section>
  <dialog id="profile-panel" class="profile-panel" aria-labelledby="profile-panel-title">
    <div class="profile-panel-header"><h2 id="profile-panel-title">Enterprise profile</h2>
      <button class="btn btn-icon" type="button" data-profile-close aria-label="Close enterprise profile">${icon("close")}</button></div>
    <div class="profile-panel-body">
      <p class="muted">Optional identifiers personalize authored links and commands. They are not checked against GitHub. Commands are displayed for you to review and run; they are not executed automatically.</p>
      <section class="profile-discovery" aria-labelledby="profile-discovery-title">
        <h3 id="profile-discovery-title">Detect with GitHub CLI</h3>
        <p class="muted">Lists the organizations and enterprises your active <code>gh auth login</code> account belongs to, using read-only API requests on this computer. Results are not saved.</p>
        <button id="profile-discover" class="btn" type="button">Detect enterprises and organizations</button>
        <p id="profile-discovery-status" class="profile-discovery-status" role="status" aria-live="polite"></p>
      </section>
      <form id="profile-form">
        ${field("enterprise-slug", "enterpriseSlug", "Enterprise slug", profile.enterpriseSlug)}
        ${field("organization-slug", "organizationSlug", "Organization slug", profile.organizationSlug)}
        ${field("repository-name", "repositoryName", "Repository name", profile.repositoryName ?? DEFAULT_REPOSITORY_NAME)}
      </form>
      <p id="profile-error" class="profile-error" role="alert" tabindex="-1" hidden></p>
      <p class="muted">Saved automatically with this workshop document. Profile values are omitted from exports.</p>
    </div>
  </dialog>`;
}
function renderDetected(name, result, kind) {
  const container = profileHost.querySelector(`[data-profile-detected="${name}"]`), input = container?.parentElement.querySelector("input");
  if (!container) return;
  container.hidden = false;
  if (result.error) { container.innerHTML = `<p class="profile-detected-note">${html(result.error.message)}</p>`; return; }
  if (!result.items.length) { container.innerHTML = `<p class="profile-detected-note">No ${kind} found for this GitHub CLI account. Enter a slug manually.</p>`; return; }
  const id = `${input.id}-detected`;
  container.innerHTML = `<label for="${id}">Detected ${kind} (${result.items.length})</label>
    <span class="profile-select-wrap"><select id="${id}" class="form-select" data-profile-pick="${html(input.id)}"><option value="">Choose a detected ${kind === "enterprises" ? "enterprise" : "organization"}…</option>
    ${result.items.map((item) => `<option value="${html(item.slug)}"${item.slug === input.value ? " selected" : ""}>${html(item.name === item.slug ? item.slug : `${item.name} (${item.slug})`)}</option>`).join("")}</select></span>`;
}
async function discoverProfile() {
  const button = profileHost.querySelector("#profile-discover"), message = profileHost.querySelector("#profile-discovery-status");
  if (!button || button.disabled) return;
  button.disabled = true; message.textContent = "Asking GitHub CLI…";
  try {
    const { account, source, organizations, enterprises } = await (await request("/api/profile/discover", {})).json();
    renderDetected("enterpriseSlug", enterprises, "enterprises");
    renderDetected("organizationSlug", organizations, "organizations");
    const found = enterprises.items.length + organizations.items.length;
    const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const via = account ? ` for @${account}${source === "environment" ? " (GH_TOKEN environment token)" : ""}` : "";
    message.textContent = found ? `Found ${count(enterprises.items.length, "enterprise")} and ${count(organizations.items.length, "organization")}${via}. Choose one or type your own.` :
      `Nothing detected${via}. You can still enter slugs manually.`;
  } catch (reason) { message.textContent = `Detection failed: ${reason.message} You can still enter slugs manually.`; }
  finally { button.disabled = false; }
}
function openProfilePanel() {
  const panel = profileHost.querySelector("#profile-panel");
  if (!panel || panel.open) return;
  const profile = drafts.get(profileKey) ?? state.profile;
  for (const input of panel.querySelectorAll("#profile-form input")) input.value = profile?.[input.name] ?? (input.name === "repositoryName" ? DEFAULT_REPOSITORY_NAME : "");
  panel.showModal();
  profileHost.querySelector("#profile-open").setAttribute("aria-expanded", "true");
  panel.querySelector("#enterprise-slug").focus();
}
async function closeProfilePanel() {
  const panel = profileHost.querySelector("#profile-panel");
  if (!panel?.open) return;
  queueSave();
  if (await flushSaves()) panel.close();
  else panel.querySelector("#profile-error:not([hidden])")?.focus?.();
}
function renderWorkshopNavigation(route) {
  const returnTo = route.view === "summary" ? history.state?.summaryReturn : null;
  const navigation = document.querySelector("#workshop-navigation");
  navigation.classList.toggle("is-overview", route.view === "home");
  navigation.innerHTML = `
    ${route.view === "home" ? "" : `<a class="btn" href="?" data-route>${icon("back")}Back to blocks</a>`}
    <span class="workshop-location">${html(pathFor(route)?.title ?? (route.view === "summary" ? "Workshop summary" : "Workshop blocks"))}</span>
    ${route.view === "summary" ? returnTo ? `<a class="btn" href="${html(returnTo.url)}" data-route data-summary-return>${icon("back")}Return to workshop</a>` : "" :
      `<a id="workshop-summary" class="btn" href="?view=summary" data-route>${icon("list")}Governance Summary</a>`}`;
}
function render() {
  const route = routeNow(), rows = summary(content, state);
  const path = pathFor(route), reviewButton = document.querySelector("#review-all-variants");
  reviewButton.hidden = !devMode || !path || route.view === "summary";
  reviewButton.textContent = showingAllVariants ? "Return to workshop" : "Review all variants";
  reviewButton.setAttribute("aria-pressed", String(showingAllVariants));
  renderedRoute = JSON.stringify(route); renderedUrl = location.href; updateStatus();
  renderWorkshopNavigation(route);
  controls.hidden = true; controls.innerHTML = "";
  if (route.view === "home") main.innerHTML = `<h2>Choose your governance journey</h2><p class="muted">Explore decisions, selected guidance, and exercises. Configuration and validation remain separate.</p>
    <div class="journeys">${content.paths.map((path, index) => {
      const row = rows.find((item) => item.id === path.id);
      const done = row.checklist.filter((task) => task.done).length, total = totalConfigurationSteps(path);
      return `<a class="journey" href="${resumeRoute(path, state)}" data-route>
      <span class="journey-copy"><h3>${String(index + 1).padStart(2, "0")} &mdash; ${html(path.title)}</h3><span class="muted">${html(path.description)}</span>
      ${path.subtitle ? `<span class="journey-progress">${html(path.subtitle)}</span>` : ""}</span>
      <span class="btn journey-action ${row.answered > 0 ? "journey-resume" : "btn-primary"}">${row.answered > 0 ? "Resume" : "Start"}</span>
      <span class="journey-meters">
        <span><span class="journey-meter-label">Decision taken <span>${row.resolved} / ${path.decisions.length}</span></span>
          ${progressMeter("Decision taken", row.resolved, path.decisions.length, `${row.resolved} of ${path.decisions.length} decisions answered`)}</span>
        <span><span class="journey-meter-label">Configurations applied <span>${done} / ${total}</span></span>
          ${progressMeter("Configurations applied", done, total, total ? `${done} of ${total} steps marked done, current checklist: ${row.checklist.length} steps; personal markers, not applied configuration` : "No configuration steps authored")}</span>
      </span></a>`;
    }).join("")}</div>`;
  else if (route.view === "summary") main.innerHTML = renderSummary(rows);
  else {
    const progress = state.paths[path.id], nav = navigation(path, route, progress);
    const browser = showingAllVariants ? renderReviewBrowser(path) : route.view === "decision" ? renderQuestionBrowser(path, progress, route) :
      route.view === "lab" ? route.stage === "configure" ? renderConfigurationBrowser(path, progress, route) :
        renderExerciseBrowser(path, progress, route, configurationFor(path, progress).exercises) : "";
    main.innerHTML = `<section class="decision-view" aria-label="${html(path.title)}">
      ${showingAllVariants ? "" : `<ol class="steps" aria-label="Workflow">${workflowSteps(path, route, progress).map((step, index) => `<li>
        <a href="${html(step.href)}" data-route ${step.current ? 'aria-current="step"' : ""}><span aria-hidden="true">${index + 1}</span>${step.label}</a></li>`).join("")}</ol>
      `}
      <div class="stage-layout${browser ? " has-sidebar" : ""}">${browser}<div class="stage-content">
      ${showingAllVariants ? renderAllVariants(path) : `
      ${route.view === "understand" ? `<article class="decision-card" data-understand-id="${html(path.id)}"${src(path.stages.understand.source, "Understand")}><span class="eyebrow">Understand · Block introduction</span><h2>${html(path.title)}</h2>${md(path.stages.understand.markdown)}</article>` :
        route.view === "decision" ? `${sourced(path.stages.decisions.source, "Decisions stage", md(path.stages.decisions.introduction))}${renderDecision(path.decisions.find((item) => item.id === route.decisionId), progress, path.decisions.findIndex((item) => item.id === route.decisionId) + 1)}` : renderRecipes(path, progress, route)}
      `}</div></div></section>`;
    controls.hidden = showingAllVariants;
    controls.innerHTML = `<a class="btn" href="${nav.back}" data-route>Back</a><span class="navigation-hint">${html(nav.position)}</span>
      ${main.querySelector("form") ? `<button id="navigation-next" class="btn btn-primary" type="submit" form="workflow-form">${html(nav.nextLabel)}</button>` : `<a id="navigation-next" class="btn btn-primary" href="${nav.next}" data-route>${html(nav.nextLabel)}</a>`}`;
    syncItemBrowser();
    if (!showingAllVariants) {
      restoreDraft();
      main.querySelector("form")?.addEventListener("submit", save);
    }
  }
  main.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => exportSummary(button.dataset.export)));
  syncPicker();
}
function mountProfile() {
  profileHost.innerHTML = renderProfile();
  refreshProfile();
  profileHost.querySelector("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault(); void closeProfilePanel();
  });
  const panel = profileHost.querySelector("#profile-panel");
  panel?.addEventListener("close", () => {
    const trigger = profileHost.querySelector("#profile-open");
    trigger?.setAttribute("aria-expanded", "false");
    refreshProfile();
    trigger?.focus({ preventScroll: true });
  });
  panel?.addEventListener("cancel", (event) => { event.preventDefault(); void closeProfilePanel(); });
  panel?.addEventListener("click", (event) => { if (event.target === panel) void closeProfilePanel(); });
}
function setBusy(value) {
  busy = value;
  devReset.disabled = value;
  document.querySelector("#reload").disabled = value;
  document.querySelector("#dev-save-state").disabled = value;
  document.querySelector("#dev-restore-state").disabled = value;
  controls.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  document.querySelectorAll("#main input, #main select, #main textarea, #main button, #profile-host input, #profile-host select, #profile-host button").forEach((element) => {
    if (value && !element.disabled) { element.setAttribute("data-saving", ""); element.disabled = true; }
    else if (!value && element.hasAttribute("data-saving")) { element.disabled = false; element.removeAttribute("data-saving"); }
  });
}
function queueSave() {
  for (const [key, draft] of drafts) {
    // A draft already being sent must not replay after a later save changes the step basis.
    if (JSON.parse(key).view === "checklist" && !(inFlight?.key === key && inFlight.draft === draft)) pendingSaves.set(key, draft);
  }
  const draft = captureDraft();
  const key = profileHost.querySelector("dialog[open]") ? profileKey : renderedRoute;
  if (!draft || (JSON.parse(key).view === "decision" && !draft.decision)) return;
  pendingSaves.set(key, draft);
}
function progressValue(route, draft) {
  if (route.view === "home") return {
    enterpriseSlug: draft.enterpriseSlug ?? "",
    organizationSlug: draft.organizationSlug ?? "",
    repositoryName: draft.repositoryName ?? state.profile?.repositoryName ?? DEFAULT_REPOSITORY_NAME,
  };
  if (route.view === "checklist") return { stepId: route.stepId, done: draft.done };
  if (route.view === "decision") return draft.decision;
  const entry = entryFor(route), data = { ...recordFor(route), ...draft };
  const definitions = route.stage === "configure" ? entry.recipe.fields : entry.validation.fields;
  const values = Object.fromEntries(definitions.map((field) => [field.id, draft[`field:${field.id}`] ?? (route.stage === "configure" ? data.fields : data.evidenceFields)[field.id]]));
  return route.stage === "configure" ? { mode: data.mode, settingsUrl: data.settingsUrl, configuration: data.configuration, issues: data.issues, followUp: data.followUp, fields: values } :
    { verified: data.verified, evidence: data.evidence, issues: data.issues, followUp: data.followUp, evidenceFields: values };
}
async function flushSaves() {
  clearTimeout(saveTimer);
  if (saving) return saving;
  saving = (async () => {
    while (pendingSaves.size) {
      const [key, draft] = pendingSaves.entries().next().value;
      pendingSaves.delete(key);
      const route = JSON.parse(key), before = state, value = progressValue(route, draft);
      const saved = route.view === "home" ? state.profile :
        route.view === "checklist" ? { stepId: route.stepId, ...savedDraft(route) } :
        route.view === "decision" ? state.paths[route.pathId].decisions[route.decisionId] :
        Object.fromEntries(Object.keys(value).map((field) => [field, recordFor(route)[field]]));
      if (JSON.stringify(saved) === JSON.stringify(value)) { rememberDraft(key, draft); continue; }
      status.setAttribute("aria-busy", "true");
      inFlight = { key, draft };
      try {
        const input = route.view === "home" ? { contentVersion: content.version, revision: state.revision, profile: value } :
          { contentVersion: content.version, revision: state.revision, pathId: route.pathId,
            decisionId: route.decisionId ?? null, exerciseId: route.exerciseId ?? null,
            operation: route.view === "checklist" ? "checklist" : route.view === "decision" ? "decide" : route.stage, value };
        state = await (await request(route.view === "home" ? "/api/profile" : "/api/progress", input)).json();
        if (JSON.stringify(drafts.get(key)) === JSON.stringify(draft)) drafts.delete(key);
        for (const [draftKey, remaining] of drafts) {
          const candidate = JSON.parse(draftKey);
          if (candidate.view === "lab" && recordFor(candidate, before)?.basis !== recordFor(candidate)?.basis) drafts.delete(draftKey);
          else rememberDraft(draftKey, remaining);
        }
        error.hidden = true; updateStatus(); refreshItemBrowser(); refreshChecklist(); refreshVerification();
        profileHost.querySelector("#profile-error")?.setAttribute("hidden", "");
        refreshProfile();
      } catch (reason) {
        error.textContent = `Could not save automatically: ${reason.message}`; error.hidden = false;
        const profileError = profileHost.querySelector("#profile-panel[open] #profile-error");
        if (profileError) { profileError.textContent = error.textContent; profileError.hidden = false; }
        setStatus("Not saved. Input retained. Correct the input or retry with Next.");
        pendingSaves.clear(); return false;
      } finally { inFlight = null; }
    }
    return true;
  })();
  try { return await saving; } finally { saving = null; status.removeAttribute("aria-busy"); }
}
async function save(event) {
  event.preventDefault();
  if (busy) return;
  const focusId = event.submitter?.id || document.activeElement?.id || "main";
  const route = routeNow(), path = pathFor(route);
  queueSave(); setBusy(true);
  try { if (await flushSaves()) navigate(navigation(path, route, state.paths[path.id]).next, focusId); }
  finally { setBusy(false); }
}
async function exportSummary(format) {
  if (busy) return;
  queueSave(); if (!await flushSaves()) return;
  setBusy(true);
  try {
    const response = await request(`/api/export?format=${format}`), url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `governance-workshop.${format === "markdown" ? "md" : "json"}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus("Export ready. Save it outside the repository.");
  } catch (reason) { showError(reason); } finally { setBusy(false); }
}
function navigate(url, focusId = document.activeElement?.id || "main") {
  showingAllVariants = false;
  captureDraft();
  let nextState = null;
  if (new URL(url, location.href).searchParams.get("view") === "summary" && JSON.parse(renderedRoute).view !== "summary") {
    const position = { url: location.pathname + location.search + location.hash, scrollY: window.scrollY,
      focusId };
    history.replaceState({ workshopPosition: position }, "", renderedUrl);
    nextState = { summaryReturn: position };
  }
  history.pushState(nextState, "", url); render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0);
}
document.addEventListener("click", async (event) => {
  const link = event.target.closest("a[data-route]");
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  if (!busy && content) {
    const focusId = link.id || document.activeElement?.id || "main";
    queueSave(); setBusy(true);
    try {
      if (await flushSaves()) {
        if (link.hasAttribute("data-summary-return") && history.state?.summaryReturn) history.back();
        else navigate(link.getAttribute("href"), focusId);
      }
    } finally { setBusy(false); }
  }
});
window.addEventListener("popstate", async () => {
  if (!content) return;
  showingAllVariants = false;
  queueSave(); setBusy(true);
  try { if (!await flushSaves()) { history.replaceState(null, "", renderedUrl); return; } }
  finally { setBusy(false); }
  const position = history.state?.workshopPosition;
  render();
  (document.getElementById(position?.focusId) ?? main).focus({ preventScroll: true });
  window.scrollTo(0, position?.scrollY ?? 0);
});
document.addEventListener("input", (event) => {
  if (!event.target.closest("#workflow-form, #profile-form")) return;
  queueSave(); clearTimeout(saveTimer); saveTimer = setTimeout(flushSaves, 250);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || busy) return;
  if (button.matches("[data-open-terminal]")) void runTerminalCommand(button);
  else if (button.id === "profile-open") openProfilePanel();
  else if (button.matches("[data-profile-close]")) void closeProfilePanel();
  else if (button.id === "profile-discover") void discoverProfile();
  else if (button.matches("[data-sign-in]")) void startSignIn(button.dataset.signIn);
  else if (button.id === "profile-signin-check") checkSignInAgain();
  else if (button.matches("[data-checklist]")) {
    const route = routeNow(), stepId = button.dataset.checklist;
    const key = JSON.stringify({ view: "checklist", pathId: route.pathId, stepId });
    const draft = { done: button.getAttribute("aria-pressed") !== "true" };
    rememberDraft(key, draft); pendingSaves.set(key, draft);
    refreshChecklist(); refreshVerification(); refreshItemBrowser();
    queueSave(); void flushSaves();
  } else if (button.matches("[data-compare-toggle], [data-compare-close]")) {
    const panel = main.querySelector("#comparison-panel"), trigger = main.querySelector("[data-compare-toggle]");
    const open = button.hasAttribute("data-compare-toggle") && panel.hidden;
    panel.hidden = !open; trigger.setAttribute("aria-expanded", String(open));
    if (open) updateComparison(comparisonDecisions(pathFor(routeNow()), routeNow())[0].id);
    else trigger.focus({ preventScroll: true });
  } else if (button.matches("[data-compare-decision]")) {
    updateComparison(button.dataset.compareDecision);
  }
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-compare-answer]")) {
    updateComparison(main.querySelector("#comparison-panel").dataset.decisionId, event.target.value); return;
  }
  if (event.target.matches("[data-profile-pick]")) {
    const input = profileHost.querySelector(`#${event.target.dataset.profilePick}`);
    if (!input || !event.target.value) return;
    input.value = event.target.value;
    queueSave(); void flushSaves(); return;
  }
  if (!event.target.closest("#workflow-form, #profile-form")) return;
  queueSave(); void flushSaves();
});
document.addEventListener("pointerdown", () => { keyboardFocus = false; }, true);
document.addEventListener("keydown", (event) => {
  if (!event.altKey && !event.ctrlKey && !event.metaKey) keyboardFocus = true;
}, true);
main.addEventListener("focusin", (event) => {
  if (!keyboardFocus || controls.hidden || event.target === main || !(event.target instanceof HTMLElement)) return;
  const focused = event.target;
  requestAnimationFrame(() => {
    if (!keyboardFocus || document.activeElement !== focused) return;
    const bounds = focused.getBoundingClientRect();
    const navigationTop = controls.getBoundingClientRect().top;
    if (bounds.bottom > navigationTop - 12) window.scrollBy(0, bounds.bottom - navigationTop + 12);
    else if (bounds.top < 12) window.scrollBy(0, bounds.top - 12);
  });
});
window.addEventListener("beforeunload", (event) => {
  captureDraft();
  if (!drafts.size && !pendingSaves.size && !saving) return;
  event.preventDefault(); event.returnValue = "";
});
async function load(fresh = false) {
  if (busy) return;
  queueSave(); setBusy(true);
  try {
    if (!await flushSaves() && !window.confirm("Discard unsaved choices and notes? Saved progress will not be reset.")) return;
    error.hidden = true;
    ({ content, state } = await (await request(fresh ? "/api/reload-content" : "/api/bootstrap", fresh ? {} : undefined)).json());
    profileEpoch++;
    drafts.clear(); pendingSaves.clear(); render(); mountProfile();
    if (fresh) setStatus("Content reloaded. Saved progress preserved.");
  } catch (reason) { showError(reason); setStatus(fresh ? "Could not reload content." : "Could not load saved progress."); }
  finally { setBusy(false); }
  if (state && content) void detectLabProfile();
}
async function resetLab() {
  if (busy || !window.confirm("Reset all decisions, exercise progress, notes and history for this lab? Content will not be reloaded. A backup of saved progress is kept.")) return;
  setBusy(true);
  try {
    error.hidden = true;
    clearTimeout(saveTimer);
    if (saving) await saving;
    ({ content, state } = await (await request("/api/dev/reset", { revision: state.revision })).json());
    profileEpoch++;
    drafts.clear(); pendingSaves.clear();
    mountProfile();
    history.replaceState(null, "", "?");
    render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    setStatus("Lab reset. A backup of saved progress was kept.");
  } catch (reason) { showError(reason); setStatus("Could not reset the lab."); }
  finally { setBusy(false); }
}
if (devMode) {
  document.body.append(document.querySelector("#state-template").content.cloneNode(true));
  const dialog = document.querySelector("#state-dialog"), form = document.querySelector("#state-form");
  const name = document.querySelector("#state-name"), choice = document.querySelector("#state-choice");
  const submit = document.querySelector("#state-submit"), message = document.querySelector("#state-error");
  let mode = "save", working = false;
  const fail = (reason) => { message.textContent = reason.message; message.hidden = false; message.focus(); };
  const close = () => { if (!working) dialog.close(); };
  const open = async (operation) => {
    if (busy || dialog.open) return;
    queueSave();
    mode = operation;
    const restoring = mode === "restore";
    document.querySelector("#state-title").textContent = submit.textContent = restoring ? "Restore state" : "Save state";
    document.querySelector("#state-save-fields").hidden = restoring;
    document.querySelector("#state-restore-fields").hidden = !restoring;
    name.disabled = restoring; name.required = !restoring;
    choice.disabled = !restoring; choice.required = restoring;
    message.hidden = true; submit.disabled = false; name.value = ""; choice.replaceChildren();
    dialog.showModal();
    if (!restoring) { name.focus(); return; }
    submit.disabled = true;
    try {
      const { names } = await (await request("/api/dev/snapshots")).json();
      if (!dialog.open || mode !== operation) return;
      choice.replaceChildren(...names.map((name) => new Option(name, name)));
      submit.disabled = !names.length;
      if (!names.length) throw new Error("No saved states yet. Use Save state to create one.");
      choice.focus();
    } catch (reason) { if (dialog.open) fail(reason); }
  };
  document.querySelector("#dev-save-state").addEventListener("click", () => open("save"));
  document.querySelector("#dev-restore-state").addEventListener("click", () => open("restore"));
  document.querySelector("#state-cancel").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  dialog.addEventListener("close", () => document.querySelector(mode === "save" ? "#dev-save-state" : "#dev-restore-state").focus());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || working) return;
    const selected = mode === "save" ? name.value : choice.value;
    if (mode === "restore" && !window.confirm(`Restore "${selected}" for the entire workshop? Current answers, profile, task markers, notes and history will be replaced, with a backup kept. Authored content will not change.`)) return;
    queueSave(); working = true; setBusy(true); submit.disabled = true; message.hidden = true;
    name.disabled = true; choice.disabled = true;
    let succeeded = false;
    try {
      if (!await flushSaves()) throw new Error("Current edits could not be saved. They were kept; resolve the save error before saving or restoring a state.");
      const result = await (await request(`/api/dev/snapshots/${mode}`, {
        name: selected, revision: state.revision, contentVersion: content.version,
      })).json();
      if (mode === "restore") {
        ({ content, state } = result); profileEpoch++;
        if (profileDetection !== "loading") profileDetection = "idle";
        profileDetectionError = "";
        drafts.clear(); pendingSaves.clear(); setPicking(false);
        mountProfile(); render();
        setStatus(`Restored state "${selected}". A backup of the previous state was kept.`);
      } else setStatus(`Saved state "${selected}".`);
      error.hidden = true; succeeded = true;
    } catch (reason) { fail(reason); }
    finally {
      working = false; setBusy(false); submit.disabled = false;
      name.disabled = mode !== "save"; choice.disabled = mode !== "restore";
      if (succeeded) dialog.close();
      if (succeeded && mode === "restore") void detectLabProfile();
    }
  });
}
document.querySelector("#dev-controls").hidden = !devMode;
document.body.classList.toggle("is-dev", devMode);
const devToggle = document.querySelector("#dev-toggle"), devTools = document.querySelector("#dev-tools");
function switchReviewStage(stage) {
  const expanded = main.querySelector(".dev-review-browser").open;
  reviewStage = stage;
  render();
  main.querySelector(".dev-review-browser").open = expanded;
  main.querySelector(`#review-tab-${stage}`).focus({ preventScroll: true });
}
document.addEventListener("keydown", (event) => {
  const tab = event.target.closest("[data-review-stage]");
  if (!tab || !showingAllVariants || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  switchReviewStage(event.key === "Home" ? "configure" : event.key === "End" ? "verify" :
    reviewStage === "configure" ? "verify" : "configure");
});
document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-review-stage]");
  if (tab && showingAllVariants) {
    switchReviewStage(tab.dataset.reviewStage);
    return;
  }
  const link = event.target.closest("[data-review-link]");
  if (link && showingAllVariants) {
    event.preventDefault();
    const target = document.getElementById(link.getAttribute("href").slice(1));
    main.querySelectorAll("[data-review-link]").forEach((item) => item.removeAttribute("aria-current"));
    link.setAttribute("aria-current", "page");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
    return;
  }
  const button = event.target.closest("#review-all-variants");
  if (!button || busy || !devMode) return;
  captureDraft();
  showingAllVariants = !showingAllVariants;
  if (showingAllVariants) reviewStage = routeNow().stage === "verify" ? "verify" : "configure";
  render();
  (showingAllVariants ? main : button).focus({ preventScroll: true });
});
function setDevCollapsed(collapsed) {
  devTools.hidden = collapsed;
  devToggle.setAttribute("aria-expanded", String(!collapsed));
  devToggle.title = collapsed ? "Show dev mode tools" : "Hide dev mode tools";
  document.querySelector("#dev-controls").classList.toggle("is-collapsed", collapsed);
  try { localStorage.setItem("governance-lab-dev-collapsed", collapsed ? "1" : "0"); } catch {}
}
if (devMode) {
  let collapsed = false;
  try { collapsed = localStorage.getItem("governance-lab-dev-collapsed") === "1"; } catch {}
  setDevCollapsed(collapsed);
  devToggle.addEventListener("click", () => setDevCollapsed(!devTools.hidden));
}
// Dev-only section picker: sends prompts about the Markdown behind rendered parts to the agent.
const pickButton = document.querySelector("#pick-source"), pickHint = document.querySelector("#picker-hint");
let picking = false, picked = null;
const sourceOf = (element) => element?.closest?.("#main [data-source-file]") ?? null;
function describe(element) {
  return `${element.dataset.sourceFile.split("/").at(-1)} · ${element.dataset.sourceLabel} (L${element.dataset.sourceLine}–${element.dataset.sourceEnd})`;
}
function highlight(element) {
  if (picked === element) return;
  picked?.classList.remove("is-source-highlight");
  picked = element;
  picked?.classList.add("is-source-highlight");
  pickHint.textContent = picked ? `${describe(picked)} — Click or Enter to write a request · Alt+↑/↓ widen/narrow · Esc to stop` :
    "Pick a section: hover or Tab to a part of the workshop. Esc to stop.";
}
function syncPicker() {
  if (!devMode) return;
  document.body.classList.toggle("is-picking", picking);
  pickButton.setAttribute("aria-pressed", String(picking));
  pickHint.hidden = !picking;
  for (const element of main.querySelectorAll("[data-source-file]")) {
    if (picking) element.setAttribute("tabindex", "0"); else element.removeAttribute("tabindex");
  }
  if (!picking) highlight(null);
  else if (!picked?.isConnected) { picked = null; highlight(null); }
}
function setPicking(value) {
  picking = value; syncPicker();
  if (picking) highlight(sourceOf(document.activeElement));
  if (picking) setStatus("");
}
// Batched review requests live only in this page's memory until sent.
const batchPanel = document.querySelector("#batch"), batchList = document.querySelector("#batch-list"), batchTitle = document.querySelector("#batch-title");
// The prompt dialog is cloned from a template so participant pages contain no dev-only form.
if (devMode) document.body.append(document.querySelector("#prompt-template").content.cloneNode(true));
const promptDialog = document.querySelector("#prompt-dialog"), promptText = document.querySelector("#prompt-text"), promptSource = document.querySelector("#prompt-source");
const promptAdd = document.querySelector("#prompt-add");
const batch = [];
let draft = null, nextRequestId = 1;
function renderBatch() {
  if (!devMode) return;
  batchPanel.hidden = !batch.length;
  document.body.classList.toggle("has-batch", batch.length > 0);
  batchTitle.textContent = `Batch requests pending (${batch.length})`;
  batchList.replaceChildren(...batch.map((item) => {
    const row = document.createElement("li"), body = document.createElement("div"), source = document.createElement("strong"), prompt = document.createElement("p");
    source.textContent = item.title; prompt.textContent = item.prompt; prompt.className = "batch-prompt";
    body.append(source, prompt);
    const actions = document.createElement("div"); actions.className = "batch-item-actions";
    for (const [action, text] of [["edit", "Edit"], ["remove", "Remove"]]) {
      const button = document.createElement("button");
      Object.assign(button, { type: "button", className: "btn btn-sm", textContent: text });
      button.dataset.batchAction = action; button.dataset.batchId = String(item.id);
      button.setAttribute("aria-label", `${text} request for ${item.title}`);
      actions.append(button);
    }
    row.append(body, actions);
    return row;
  }));
}
function openPrompt(element, existing = null) {
  if (!element && !existing) return;
  const source = existing ?? (({ sourceFile: file, sourceLine, sourceEnd, sourceLabel: label }) =>
    ({ file, line: Number(sourceLine), endLine: Number(sourceEnd), label, title: describe(element), contentVersion: content.version }))(element.dataset);
  const resume = !existing && picking;
  setPicking(false);
  draft = { ...source, id: existing?.id ?? null, resume };
  promptSource.textContent = source.title;
  promptText.value = existing?.prompt ?? "";
  promptAdd.textContent = existing ? "Save" : "Add to batch";
  promptDialog.showModal();
  promptText.focus();
}
function closePrompt() {
  const resume = draft?.resume;
  draft = null;
  if (promptDialog.open) promptDialog.close();
  return resume;
}
async function sendRequests(items) {
  if (busy || !items.length) return false;
  try {
    error.hidden = true;
    const requests = items.map(({ file, line, endLine, label, prompt, contentVersion }) => ({ file, line, endLine, label, prompt, contentVersion }));
    const { count } = await (await request("/api/dev/send-requests", { requests })).json();
    setPicking(false);
    setStatus(`Sent ${count} request${count === 1 ? "" : "s"} to the Copilot agent.`);
    return true;
  } catch (reason) { showError(reason); setStatus("Could not send the requests to the Copilot agent."); return false; }
}
function saveDraft() {
  const prompt = promptText.value.trim();
  if (!draft || !prompt) { promptText.reportValidity(); return; }
  const { resume, id, ...source } = draft;
  const existing = batch.find((item) => item.id === id);
  if (existing) existing.prompt = prompt; else batch.push({ ...source, id: nextRequestId++, prompt });
  closePrompt();
  renderBatch();
  setStatus(existing ? "Updated the pending request." : `Added to batch (${batch.length} pending). Pick another section or send the batch.`);
  if (resume) setPicking(true);
  else (existing ? batchList.querySelector(`[data-batch-id="${id}"]`) : pickButton)?.focus();
}
if (devMode) {
  pickButton.addEventListener("click", () => setPicking(!picking));
  // Capture-phase listeners keep links, forms and buttons inert while picking.
  document.addEventListener("pointerover", (event) => { if (picking) highlight(sourceOf(event.target)); }, true);
  document.addEventListener("focus", (event) => { if (picking) highlight(sourceOf(event.target)); }, true);
  for (const type of ["pointerdown", "mousedown", "submit", "change", "input"]) {
    document.addEventListener(type, (event) => {
      if (picking && main.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }
  document.addEventListener("click", (event) => {
    if (!picking || !main.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openPrompt(picked?.contains(event.target) ? picked : sourceOf(event.target));
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!picking) return;
    if (event.key === "Escape") { event.preventDefault(); setPicking(false); pickButton.focus(); return; }
    const current = sourceOf(event.target) ?? picked;
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && current) {
      event.preventDefault();
      const next = event.key === "ArrowUp" ? sourceOf(current.parentElement) : current.querySelector("[data-source-file]");
      if (next) { highlight(next); next.focus({ preventScroll: true }); }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && main.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "Enter") openPrompt(picked ?? sourceOf(event.target));
    }
  }, true);
}
if (devMode) {
  promptDialog.addEventListener("submit", (event) => { event.preventDefault(); saveDraft(); });
  promptText.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); saveDraft(); }
  });
  promptDialog.addEventListener("cancel", (event) => { event.preventDefault(); document.querySelector("#prompt-cancel").click(); });
  document.querySelector("#prompt-cancel").addEventListener("click", () => {
    if (closePrompt()) setPicking(true); else pickButton.focus();
  });
  document.querySelector("#prompt-send").addEventListener("click", async () => {
    const prompt = promptText.value.trim();
    if (!draft || !prompt) { promptText.reportValidity(); return; }
    const { file, line, endLine, label, id, contentVersion } = draft;
    if (await sendRequests([{ file, line, endLine, label, prompt, contentVersion }])) {
      closePrompt();
      const index = batch.findIndex((item) => item.id === id);
      if (index >= 0) batch.splice(index, 1);
      renderBatch(); pickButton.focus();
    } else {
      // Keep the prompt: a failed immediate send lands in the batch for retry.
      closePrompt();
      const existing = batch.find((item) => item.id === id);
      if (existing) existing.prompt = prompt; else batch.push({ file, line, endLine, label, title: promptSource.textContent, contentVersion, id: nextRequestId++, prompt });
      renderBatch();
      error.focus();
    }
  });
  batchList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-batch-action]");
    if (!button) return;
    const id = Number(button.dataset.batchId), index = batch.findIndex((item) => item.id === id);
    if (index < 0) return;
    if (button.dataset.batchAction === "edit") { openPrompt(null, batch[index]); return; }
    batch.splice(index, 1);
    renderBatch();
    setStatus(`Removed request (${batch.length} pending).`);
    (batchList.querySelector("[data-batch-action]") ?? pickButton).focus();
  });
  document.querySelector("#batch-clear").addEventListener("click", () => {
    if (!window.confirm(`Discard ${batch.length} pending request${batch.length === 1 ? "" : "s"}?`)) return;
    batch.length = 0; renderBatch(); setStatus("Cleared pending requests."); pickButton.focus();
  });
  document.querySelector("#batch-send").addEventListener("click", async () => {
    if (await sendRequests(batch)) { batch.length = 0; renderBatch(); pickButton.focus(); }
  });
  devReset.addEventListener("click", resetLab);
  document.querySelector("#reload").addEventListener("click", () => load(true));
}
await load();
