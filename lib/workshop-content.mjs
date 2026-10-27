import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { parseTable } from "./csv.mjs";

import { hasMalformedContentTemplate, parseContentLinkTarget, resolveConfiguration, resolveContentLinkTarget } from "./workshop-resolver.mjs";

export { resolveConfiguration } from "./workshop-resolver.mjs";

export const FORMAT_VERSION = 1;
export const MANIFEST_VERSION = 3;
export const STAGES = Object.freeze(["understand", "decisions", "configure", "validation"]);
export const LIMITS = Object.freeze({ bytes: 512 * 1024, entries: 200, rows: 200, columns: 20, fields: 40 });
const ID = /^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/;
const BLOCK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const POLICY_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
// Row IDs of the author planning catalog (content/policy-catalog.csv).
export const CATALOG_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const CATALOG_FIELD = "Catalog IDs";
const STAGE_TITLES = ["Understand", "Decisions", "Configure", "Validation"];

/**
 * @typedef {{code:string,file:string,line:number,section:string,message:string,hint:string}} Diagnostic
 * @typedef {{file:string,line:number,endLine:number,anchor:string}} SourceLocation
 * @typedef {{block:object|null,diagnostics:Diagnostic[]}} ParseResult
 * ParseResult.block is usable only when diagnostics is empty.
 */
function diagnostic(file, line, code, section, message, hint) {
  return { code, file, line, section, message, hint };
}
function anchor(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/g, "-");
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

/** Parse one block and check local structure. Policy references are checked when catalog is supplied. */
export function parseWorkshopMarkdown(markdown, { file = "<markdown>", catalog, planning } = {}) {
  const diagnostics = [];
  const report = (node, code, message, hint) => diagnostics.push(diagnostic(file, node?.line ?? 1, code, node?.title ?? "block", message, hint));
  if (typeof markdown !== "string" || Buffer.byteLength(markdown, "utf8") > LIMITS.bytes) {
    report(null, "E_SIZE", "Expected a Markdown string no larger than 512 KiB.", "Split supporting drafts out of the active block file.");
    return { block: null, diagnostics };
  }
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const root = { title: "document", line: 1, level: 0, children: [], body: [] };
  const stack = [root];
  const usedAnchors = new Set();
  let fence = null;
  let fenceLine = 0;
  let profileCommand = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      stack.at(-1).body.push({ text: line, line: index + 1 });
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      else if (profileCommand) {
        const at = { title: stack.at(-1).title, line: index + 1 };
        if (hasMalformedContentTemplate(line)) report(at, "E_TEMPLATE", "Malformed command placeholder.", "Use a profile placeholder or {{input.field-id}} in a sh profile fence.");
        for (const match of line.matchAll(/\{\{([^{}]+)\}\}/g)) {
          if (!["enterprise.slug", "organization.slug", "repository.name"].includes(match[1]) &&
              !/^input\.[a-z][a-z0-9-]{0,63}$/.test(match[1])) {
            report(at, "E_TEMPLATE_VAR", `Unknown command placeholder "${match[1]}".`, "Use {{enterprise.slug}}, {{organization.slug}}, {{repository.name}}, or {{input.field-id}} in a sh profile fence.");
          }
        }
      }
      continue;
    }
    if (marker) {
      fence = marker[1];
      fenceLine = index + 1;
      profileCommand = marker[2].trim() === "sh profile";
      stack.at(-1).body.push({ text: line, line: index + 1 });
      continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (stack.at(-1).level >= level) stack.pop().endLine = index;
      const baseAnchor = anchor(heading[2]);
      let headingAnchor = baseAnchor;
      for (let suffix = 1; usedAnchors.has(headingAnchor); suffix++) headingAnchor = `${baseAnchor}-${suffix}`;
      usedAnchors.add(headingAnchor);
      const node = { title: heading[2], anchor: headingAnchor, level, line: index + 1, children: [], body: [] };
      if (level > stack.at(-1).level + 1) report(node, "E_HEADING", "Heading skips a level.", "Use consecutive ATX heading levels (#, ##, ###, ####).");
      stack.at(-1).children.push(node);
      stack.push(node);
    } else {
      stack.at(-1).body.push({ text: line, line: index + 1 });
      if (/^ {1,3}#{1,6}\s|^#{1,6}\S|^\s*(?:={3,}|-{3,})\s*$/.test(line)) {
        report({ line: index + 1 }, "E_MARKDOWN", "Unsupported heading or thematic-break syntax.", "Use unindented ATX headings and *** for thematic breaks.");
      }
    }
    if (/<\/?[A-Za-z][^>]*>|<!--/.test(line)) report({ line: index + 1 }, "E_MARKDOWN", "Raw HTML is not supported.", "Use Markdown; place literal HTML examples inside fenced code.");
    if (/!\[|^\s*\[[^\]]+\]:|\]\[[^\]]*\]/.test(line)) report({ line: index + 1 }, "E_MARKDOWN", "Images and reference-style links are not supported.", "Use ordinary inline links: [label](https://...).");
    const linkPattern = /\[[^\]]*\]\(([^)]*)\)/g;
    for (const match of line.matchAll(linkPattern)) {
      const target = parseContentLinkTarget(match[1]);
      const variables = target ? [...target.url.matchAll(/\{\{([^{}]+)\}\}/g)].map((item) => item[1]) : [];
      const malformedTemplate = target && (hasMalformedContentTemplate(target.url) ||
        (target.fallback && hasMalformedContentTemplate(target.fallback)));
      const unknownVariables = variables.filter((name) => !["enterprise.slug", "organization.slug", "repository.name"].includes(name));
      for (const name of new Set(unknownVariables)) report({ line: index + 1 }, "E_TEMPLATE_VAR", `Unknown content template variable "${name}".`, "Use only {{enterprise.slug}}, {{organization.slug}}, or {{repository.name}} inside an inline link URL.");
      if (malformedTemplate) report({ line: index + 1 }, "E_TEMPLATE", "Malformed content template placeholder.", "Use a complete known placeholder such as {{enterprise.slug}} inside an inline link URL.");
      if (target?.fallback && !variables.length) report({ line: index + 1 }, "E_TEMPLATE_FALLBACK", "A generic fallback requires a templated link URL.", "Remove the fallback title or add a known profile placeholder to the URL.");
      if (target?.fallback && !safeMarkdownLink(target.fallback)) report({ line: index + 1 }, "E_LINK", `Unsupported fallback URL "${target.fallback}".`, "Use an absolute HTTPS fallback URL without credentials.");
      if (!target || !unknownVariables.length && !malformedTemplate && !safeMarkdownLink(match[1])) {
        report({ line: index + 1 }, "E_LINK", `Unsupported link "${match[1]}".`, 'Use an absolute HTTPS URL without credentials, or a #local-anchor. For profile links use {{enterprise.slug}} or {{organization.slug}} and an optional "fallback=https://..." title.');
      }
    }
    const outsideLinks = line.replace(linkPattern, "");
    if (/\{\{|\}\}/.test(outsideLinks)) report({ line: index + 1 }, "E_TEMPLATE_POSITION", "Content template placeholders are supported only in inline link URLs.", "Move the placeholder into a link URL; do not interpolate labels, prose, or code.");
  }
  while (stack.length > 1) stack.pop().endLine = lines.length;
  if (fence) report({ line: fenceLine }, "E_FENCE", "Unclosed code fence.", `Close the ${fence} fence before the next structural heading.`);
  if (root.body.some(({ text }) => text.trim()) || root.children.length !== 1 || root.children[0]?.level !== 1) {
    report(root, "E_TITLE", "Expected exactly one top-level block title and no preamble.", "Start the file with # Block title.");
  }
  const title = root.children[0];
  if (!title) return { block: null, diagnostics };
  const source = (node) => ({ file, line: node.line, endLine: node.endLine, anchor: node.anchor });
  const raw = (node) => lines.slice(node.line - 1, node.endLine).join("\n").trimEnd();
  const prose = (node) => node ? node.body.map(({ text }) => text).join("\n").trim() : "";
  const metadata = (node, allowed, required = []) => {
    const values = {};
    const locations = {};
    const body = [];
    let started = false;
    let codeFence = null;
    for (const entry of node.body) {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(entry.text);
      if (codeFence || marker) {
        body.push(entry);
        started = true;
        if (!codeFence) codeFence = marker[1];
        else if (marker && marker[1][0] === codeFence[0] && marker[1].length >= codeFence.length && !marker[2].trim()) codeFence = null;
        continue;
      }
      const match = /^\*\*([^*]+):\*\* (.*)$/.exec(entry.text);
      if (match) {
        const [, name, value] = match;
        const at = { title: node.title, line: entry.line };
        if (started) report(at, "E_METADATA_POSITION", `Metadata "${name}" appears after prose.`, "Move metadata immediately below its owning heading, before prose.");
        if (!allowed.includes(name)) report(at, "E_FIELD", `Unsupported metadata "${name}".`, `Allowed fields: ${allowed.join(", ") || "none"}.`);
        if (Object.hasOwn(values, name)) report(at, "E_DUPLICATE_FIELD", `Duplicate metadata "${name}".`, "Keep exactly one value for this field.");
        if (!value.trim()) report(at, "E_FIELD_VALUE", `Empty metadata "${name}".`, "Supply a value, use none for empty reference lists, or remove an optional field.");
        values[name] = value.trim();
        locations[name] = at;
      } else {
        if (/^\*\*[^*]+:\*\*/.test(entry.text)) report({ title: node.title, line: entry.line }, "E_METADATA", "Malformed metadata.", "Use **Field name:** value on one line, with a space after **.");
        if (entry.text.trim()) started = true;
        body.push(entry);
      }
    }
    for (const name of required) if (!Object.hasOwn(values, name)) report(node, "E_REQUIRED", `Missing "${name}".`, `Add **${name}:** value immediately below this heading.`);
    node.body = body;
    node.meta = values;
    node.metaLocations = locations;
    return values;
  };
  const list = (node, name, pattern = ID) => {
    const value = node.meta[name];
    if (!value || value === "none") return [];
    const result = value.split(",").map((item) => item.trim());
    const bad = [...new Set(result.filter((item, index) => !pattern.test(item) || item === "none" || result.indexOf(item) !== index))];
    if (bad.length) {
      report(node.metaLocations[name], "E_LIST", `Invalid or duplicate IDs in "${name}": ${bad.map((item) => `"${item}"`).join(", ")}.`, name === CATALOG_FIELD
        ? "Use comma-separated row IDs from content/policy-catalog.csv (lowercase, e.g. models-features.model-availability), or none; no duplicates or empty items."
        : "Use comma-separated stable IDs, or none; do not use links, expressions, or empty items.");
    }
    return result;
  };
  const boolean = (node, name, fallback = false) => {
    if (node.meta[name] === undefined) return fallback;
    if (!["true", "false"].includes(node.meta[name])) report(node.metaLocations[name], "E_TYPE", `"${name}" must be a boolean.`, "Use the literal true or false.");
    return node.meta[name] === "true";
  };
  const refs = (node, name) => list(node, name, /^[A-Za-z][A-Za-z0-9-]*\.[A-Za-z][A-Za-z0-9-]*$/).map((ref) => {
    const [decisionId, optionId] = ref.split(".");
    return { decisionId, optionId };
  });
  const catalogRefs = (node) => ({
    catalogIds: list(node, CATALOG_FIELD, CATALOG_ID),
    catalogSource: node.metaLocations[CATALOG_FIELD] ? { file, line: node.metaLocations[CATALOG_FIELD].line } : null,
  });
  const identify = (node, prefix) => {
    const id = node.title.slice(prefix.length);
    if (!ID.test(id)) report(node, "E_ID", `Invalid ID "${id}".`, "Use a letter followed by letters, digits, or single hyphens; never change an existing ID just to rename its label.");
    return id;
  };
  const unique = (items, getId, owner, kind) => {
    const seen = new Set();
    for (const item of items) {
      const id = getId(item);
      if (seen.has(id)) report({ title: owner, line: item.source.line }, "E_DUPLICATE_ID", `Duplicate ${kind} ID "${id}".`, `Choose unique ${kind} IDs within ${owner}.`);
      seen.add(id);
    }
  };
  const leaf = (node) => {
    if (node.children.length) report(node.children[0], "E_HEADING", "Unexpected nested heading.", "Keep this subsection as prose, lists, tables, or fenced examples.");
  };
  const sections = (node, names, required = []) => {
    const result = {};
    for (const child of node.children) {
      if (!names.includes(child.title)) continue;
      if (Object.hasOwn(result, child.title)) report(child, "E_SECTION", `Duplicate subsection "${child.title}".`, "Keep one subsection with this heading.");
      metadata(child, []);
      leaf(child);
      result[child.title] = prose(child);
    }
    for (const name of required) if (!result[name]) report(node, "E_REQUIRED_SECTION", `Missing or empty "${name}" subsection.`, `Add ${"#".repeat(node.level + 1)} ${name} followed by authored Markdown.`);
    return result;
  };
  const checkChildren = (node, names, prefixes = [], retired = {}) => {
    for (const child of node.children) {
      if (!names.includes(child.title) && !prefixes.some((prefix) => child.title.startsWith(prefix))) {
        report(child, "E_SECTION", `Unsupported subsection "${child.title}".`, retired[child.title] ?? `Use ${[...names, ...prefixes.map((prefix) => `${prefix}<id>`)].join(", ") || "no nested headings"}.`);
      }
    }
  };
  const checkpoints = (node) => node.children.filter((child) => child.title.startsWith("Checkpoint: ")).map((child) => {
    const id = identify(child, "Checkpoint: ");
    metadata(child, []);
    checkChildren(child, ["Question", "Answer"]);
    const content = sections(child, ["Question", "Answer"], ["Question", "Answer"]);
    return { id, markdown: prose(child), question: content.Question ?? "", answer: content.Answer ?? "", source: source(child) };
  });
  const fields = (node) => node.children.filter((child) => child.title.startsWith("Field: ")).map((child) => {
    const id = identify(child, "Field: ");
    const meta = metadata(child, ["Label", "Type", "Required", "Options"], ["Label", "Type"]);
    leaf(child);
    if (!["text", "textarea", "select", "number"].includes(meta.Type)) report(child, "E_FORM", "Unsupported field type.", "Choose text, textarea, select, or number; no executable controls are supported.");
    const options = list(child, "Options");
    if ((meta.Type === "select" && options.length < 2) || (meta.Type !== "select" && meta.Options !== undefined)) {
      report(child, "E_FORM", "Only select fields accept Options, and require at least two.", "Use **Options:** stable-value, another-value for select; remove Options from other types.");
    }
    return { id, label: meta.Label, type: meta.Type, required: boolean(child, "Required"), options, markdown: prose(child), source: source(child) };
  });
  const datasets = (node) => node.children.filter((child) => child.title.startsWith("Dataset: ")).map((child) => {
    const id = identify(child, "Dataset: ");
    const meta = metadata(child, ["Fictional"], ["Fictional"]);
    leaf(child);
    if (!boolean(child, "Fictional")) report(child, "E_DATASET", "Workshop datasets must be explicitly fictional.", "Set **Fictional:** true and include a visible fictional-data notice before the table.");
    const body = child.body.filter(({ text }) => text.trim());
    const tableStart = body.findIndex(({ text }) => text.startsWith("|"));
    const notice = body.slice(0, tableStart < 0 ? body.length : tableStart).map(({ text }) => text).join("\n");
    const table = tableStart < 0 ? [] : body.slice(tableStart);
    const cells = (line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
    const columns = table[0] ? cells(table[0].text) : [];
    const rows = table.slice(2).map(({ text }) => cells(text));
    if (!notice || columns.length < 1 || columns.length > LIMITS.columns ||
        columns.some((column) => !ID.test(column)) || new Set(columns).size !== columns.length ||
        !table[1] || cells(table[1].text).length !== columns.length || cells(table[1].text).some((cell) => !/^:?-{3,}:?$/.test(cell)) ||
        !rows.length || rows.length > LIMITS.rows || rows.some((row) => row.length !== columns.length) ||
        table.some(({ text }) => !text.startsWith("|") || !text.endsWith("|"))) {
      report(child, "E_DATASET", "Malformed bounded fictional table.", "Add a notice, a pipe table with unique ID columns, a --- delimiter row, and 1–200 rectangular data rows (maximum 20 columns).");
    }
    return { id, fictional: meta.Fictional === "true", notice, columns, rows, markdown: prose(child), source: source(child) };
  });

  const blockMeta = metadata(title, ["Format version", "Block ID", "Description", "Subtitle", "Duration minutes"], ["Format version", "Block ID", "Description"]);
  if (blockMeta["Format version"] !== String(FORMAT_VERSION)) report(title, "E_VERSION", "Unsupported Markdown format version.", "Use **Format version:** 1; migrate deliberately rather than guessing a schema.");
  if (!BLOCK_ID.test(blockMeta["Block ID"] ?? "")) report(title, "E_ID", "Invalid block ID.", "Use a lowercase kebab-case block ID.");
  if (blockMeta["Duration minutes"] !== undefined && !/^[1-9]\d{0,3}$/.test(blockMeta["Duration minutes"])) report(title, "E_TYPE", "Invalid duration.", "Use a positive integer of at most four digits.");
  if (prose(title)) report(title, "E_SECTION", "Block prose must belong to a stage.", "Move prose after ## Understand.");
  if (title.children.map((node) => node.title).join("|") !== STAGE_TITLES.join("|")) report(title, "E_STAGES", "Expected Understand, Decisions, Configure, Validation exactly once in that order.", "Use exactly those four ## headings; keep deeper headings inside their stage.");
  const stageNodes = STAGE_TITLES.map((name) => title.children.find((node) => node.title === name));
  const checkReservedAnchors = (node) => {
    if (!stageNodes.includes(node) && STAGES.includes(anchor(node.title))) {
      report(node, "E_ANCHOR", `Heading "${node.title}" collides with a reserved stage anchor.`, "Rename this prose heading so #understand, #decisions, #configure, and #validation remain unique.");
    }
    node.children.forEach(checkReservedAnchors);
  };
  checkReservedAnchors(title);
  const checkUnderstandMetadata = (node) => {
    metadata(node, []);
    node.children.forEach(checkUnderstandMetadata);
  };
  stageNodes[0]?.children.forEach(checkUnderstandMetadata);
  const stages = {};
  stageNodes.forEach((node, index) => {
    if (!node) return;
    metadata(node, []);
    const firstChild = node.children[0];
    const introduction = node.body.filter(({ line }) => !firstChild || line < firstChild.line).map(({ text }) => text).join("\n").trim();
    stages[STAGES[index]] = {
      markdown: raw(node).split("\n").slice(1).join("\n").trim(),
      introduction, conclusion: "", additionalSteps: [], source: source(node),
    };
  });
  const block = {
    formatVersion: FORMAT_VERSION, id: blockMeta["Block ID"], title: title.title,
    description: blockMeta.Description, subtitle: blockMeta.Subtitle ?? "",
    durationMinutes: blockMeta["Duration minutes"] === undefined ? null : Number(blockMeta["Duration minutes"]),
    stages, decisions: [], recipes: [], validations: [], source: source(title),
    sourceText: lines.join("\n"), headerSource: lines.slice(0, title.children[0]?.line - 1 || lines.length).join("\n"),
  };
  const decisionsNode = stageNodes[1];
  if (decisionsNode) {
    checkChildren(decisionsNode, [], ["Decision: "]);
    for (const node of decisionsNode.children.filter((child) => child.title.startsWith("Decision: "))) {
      const id = identify(node, "Decision: ");
      const meta = metadata(node, ["Title", "Policies", CATALOG_FIELD], ["Title", "Policies"]);
      const names = ["Question", "Guidance"];
      checkChildren(node, names, ["Option: ", "Checkpoint: "], { Scenario: "Decision scenarios are retired; move this prose into #### Guidance." });
      const content = sections(node, names, ["Question"]);
      const options = node.children.filter((child) => child.title.startsWith("Option: ")).map((option) => {
        const optionId = identify(option, "Option: ");
        const optionMeta = metadata(option, ["Label", "Configure", "Deferred"], ["Label", "Configure"]);
        leaf(option);
        const deferred = boolean(option, "Deferred");
        const recipeIds = list(option, "Configure");
        if (deferred && recipeIds.length) report(option, "E_DEFERRED", "Deferred answers cannot activate recipes.", "Set **Configure:** none on deferred options.");
        return { id: optionId, label: optionMeta.Label, deferred, recipeIds, markdown: prose(option), source: source(option), referencesSource: option.metaLocations.Configure ?? source(option) };
      });
      const resolvedOptions = options.filter((option) => !option.deferred).length;
      const deferredOptions = options.filter((option) => option.deferred).length;
      if (options.length < 2 || resolvedOptions < 1 || deferredOptions > 1 || (!deferredOptions && resolvedOptions < 2)) report(node, "E_OPTIONS", "A decision needs at least two choices, including a resolved option, and may have at most one deferred option; without a deferred option, it needs at least two resolved choices.", "Add at least two substantive choices, remove extra deferred options so there is at most one, or omit the deferred option.");
      const items = checkpoints(node);
      unique(options, (item) => item.id, id, "option");
      unique(items, (item) => item.id, id, "checkpoint");
      block.decisions.push({ id, title: meta.Title, policyIds: list(node, "Policies", POLICY_ID), markdown: prose(node), question: content.Question ?? "", guidance: content.Guidance ?? "", options, checkpoints: items, ...catalogRefs(node), source: source(node) });
    }
  }
  const configureNode = stageNodes[2];
  if (configureNode) {
    checkChildren(configureNode, ["Additional steps"], ["Recipe: "]);
    const additionalSteps = configureNode.children.filter((child) => child.title === "Additional steps");
    if (additionalSteps.length > 1) report(additionalSteps[1], "E_DUPLICATE_SECTION", 'Configure may contain only one "Additional steps" subsection.', "Keep one ### Additional steps heading after the recipes.");
    if (additionalSteps[0]) {
      if (configureNode.children.at(-1) !== additionalSteps[0]) report(additionalSteps[0], "E_SECTION", 'The "Additional steps" subsection must follow all recipes.', "Move ### Additional steps to the end of Configure.");
      metadata(additionalSteps[0], []);
      block.stages.configure.conclusion = prose(additionalSteps[0]);
      block.stages.configure.additionalSteps = additionalSteps[0].children.map((step) => {
        metadata(step, [CATALOG_FIELD]);
        leaf(step);
        if (!prose(step)) report(step, "E_REQUIRED_SECTION", "Additional configuration step is empty.", "Add instructions below the #### heading.");
        return { title: step.title, markdown: prose(step), ...catalogRefs(step), source: source(step) };
      });
    }
    for (const node of configureNode.children.filter((child) => child.title.startsWith("Recipe: "))) {
      const id = identify(node, "Recipe: ");
      const labelFields = ["Inspection label", "Changed label", "Configuration confirmation", "Target label", "Target help", "Target link label", "Steps label", "Primary choice label"];
      const meta = metadata(node, ["Title", "Kind", "Exercise ID", "Policies", "Requires decisions", "Requires answers", "Conflicts with", "Target", "Variant decision", "API", CATALOG_FIELD, ...labelFields], ["Title", "Kind", "Policies"]);
      if (!["guidance", "exercise"].includes(meta.Kind)) report(node, "E_KIND", "Unsupported recipe kind.", "Use **Kind:** guidance or exercise.");
      const exercise = meta.Kind === "exercise";
      if (exercise && !ID.test(meta["Exercise ID"] ?? "")) report(node, "E_EXERCISE", "Exercise requires a stable Exercise ID.", "Add **Exercise ID:** YOUR-LAB-ID.");
      if (!exercise && ["Exercise ID", "Target", ...labelFields].some((name) => meta[name] !== undefined)) report(node, "E_GUIDANCE", "Guidance cannot define exercise controls or control labels.", "Remove exercise-only metadata, or explicitly author an exercise.");
      const target = meta.Target ?? "none";
      if (!["none", "enterprise", "organization", "repository", "client", "github-page"].includes(target)) report(node, "E_TARGET", "Unsupported target kind.", "Use none, enterprise, organization, repository, client, or github-page (no implied scope).");
      const names = ["Safety", "Scope", "Role", "Prerequisites", "Steps", "Fallback", "Prediction"];
      checkChildren(node, names, ["Field: ", "Dataset: ", "Checkpoint: ", "Warning: ", "Variant: "]);
      const content = sections(node, names, exercise ? ["Safety"] : []);
      const variants = node.children.filter((child) => child.title.startsWith("Variant: ")).map((child) => {
        const optionId = identify(child, "Variant: ");
        metadata(child, []);
        checkChildren(child, ["Scope", "Role", "Steps"]);
        return { optionId, markdown: prose(child), sections: sections(child, ["Scope", "Role", "Steps"], ["Steps"]), source: source(child) };
      });
      if (exercise && !content.Steps && !variants.length) report(node, "E_REQUIRED_SECTION", "Exercise needs Steps or decision variants.", "Add #### Steps or a Variant decision with one #### Variant: option-id for every resolved option.");
      if ((!exercise && variants.length) || Boolean(meta["Variant decision"]) !== Boolean(variants.length)) report(node, "E_VARIANT", "Variants require an exercise and a Variant decision.", "Declare Variant decision and all resolved option variants together, only on an exercise.");
      unique(variants, (item) => item.optionId, id, "variant");
      const warnings = node.children.filter((child) => child.title.startsWith("Warning: ")).map((warning) => {
        const warningId = identify(warning, "Warning: ");
        metadata(warning, ["When"], ["When"]);
        leaf(warning);
        const when = refs(warning, "When");
        if (!when.length || !prose(warning)) report(warning, "E_WARNING", "Warnings require explicit answer conditions and a message.", "Add **When:** DECISION.option and a Markdown explanation; comma-separated conditions mean all.");
        return { id: warningId, when, markdown: prose(warning), source: source(warning) };
      });
      const recipeFields = fields(node), samples = datasets(node), checks = checkpoints(node);
      const api = meta.API === undefined ? null : meta.API === "none" ? { available: false, url: null } : { available: true, url: meta.API };
      if (api?.available && !apiDocumentation(api.url)) report(node, "E_API", "Invalid API availability.", "Use **API:** none, or an HTTPS docs.github.com REST/GraphQL reference URL documenting the endpoint.");
      const policyIds = list(node, "Policies", POLICY_ID);
      if (!policyIds.length) report(node, "E_POLICY_REF", "A recipe must reference at least one shared policy.", "Add an existing runtime policy ID to **Policies:**; options needing no recipe can use Configure: none.");
      if (!exercise && (recipeFields.length || samples.length || checks.length)) report(node, "E_GUIDANCE", "Guidance cannot define exercise forms, datasets, or checkpoints.", "Move these controls into an exercise recipe.");
      for (const [items, kind] of [[recipeFields, "field"], [samples, "dataset"], [checks, "checkpoint"], [warnings, "warning"]]) unique(items, (item) => item.id, id, kind);
      if (recipeFields.length > LIMITS.fields) report(node, "E_LIMIT", "Too many form fields.", "Keep at most 40 fields per exercise.");
      block.recipes.push({ id, title: meta.Title, kind: meta.Kind, exerciseId: exercise ? meta["Exercise ID"] : null, target,
        policyIds, requiresDecisions: list(node, "Requires decisions"), requiresAnswers: refs(node, "Requires answers"), conflictsWith: list(node, "Conflicts with"), api,
        variantDecisionId: meta["Variant decision"] ?? null, variants, labels: Object.fromEntries(labelFields.filter((key) => meta[key]).map((key) => [key, meta[key]])),
        markdown: prose(node), sections: content, fields: recipeFields, datasets: samples, checkpoints: checks, warnings, ...catalogRefs(node), source: source(node) });
    }
  }
  const validationNode = stageNodes[3];
  if (validationNode) {
    checkChildren(validationNode, [], ["Exercise: "]);
    for (const node of validationNode.children.filter((child) => child.title.startsWith("Exercise: "))) {
      const exerciseId = identify(node, "Exercise: ");
      const meta = metadata(node, ["Title", "Task label", "Attestation", "Next label", "Navigation label", "Variant decision"]);
      const names = ["Steps", "Expected result", "Fallback"];
      checkChildren(node, names, ["Field: ", "Checkpoint: ", "Variant: "]);
      const variants = node.children.filter((child) => child.title.startsWith("Variant: ")).map((child) => {
        const optionId = identify(child, "Variant: ");
        metadata(child, []);
        const variantNames = ["Steps", "Expected result", "Fallback"];
        checkChildren(child, variantNames);
        const content = sections(child, variantNames, ["Steps", "Expected result"]);
        return { optionId, markdown: prose(child), sections: content, source: source(child) };
      });
      const content = sections(node, names, variants.length ? [] : ["Steps", "Expected result"]);
      if (variants.length && Object.keys(content).length) {
        report(node, "E_VARIANT", "Shared Validation sections cannot be combined with answer-specific variants.", "Put Steps, Expected result, and any Fallback content in every Variant.");
      }
      if (Boolean(meta["Variant decision"]) !== Boolean(variants.length)) {
        report(node, "E_VARIANT", "Validation variants require a Variant decision, and a Variant decision requires variants.", "Declare **Variant decision:** DECISION-ID and add one Variant for every resolved option.");
      }
      unique(variants, (item) => item.optionId, exerciseId, "validation variant");
      const validationFields = fields(node), checks = checkpoints(node);
      unique(validationFields, (item) => item.id, exerciseId, "field");
      unique(checks, (item) => item.id, exerciseId, "checkpoint");
      if (validationFields.length > LIMITS.fields) report(node, "E_LIMIT", "Too many evidence fields.", "Keep at most 40 fields per exercise validation.");
      block.validations.push({ exerciseId, title: meta.Title ?? exerciseId,
        ...(meta["Variant decision"] ? { variantDecisionId: meta["Variant decision"], variants } : {}),
        labels: Object.fromEntries(Object.entries(meta).filter(([key]) => key !== "Title" && key !== "Variant decision")),
        markdown: prose(node), sections: content, fields: validationFields, checkpoints: checks, source: source(node) });
    }
  }
  unique(block.decisions, (item) => item.id, block.id, "decision");
  unique(block.recipes, (item) => item.id, block.id, "recipe");
  unique(block.recipes.filter((item) => item.kind === "exercise"), (item) => item.exerciseId, block.id, "exercise");
  unique(block.validations, (item) => item.exerciseId, block.id, "validation");
  if (block.decisions.length + block.recipes.length + block.validations.length > LIMITS.entries) report(title, "E_LIMIT", "Too many structural entries.", "Keep at most 200 combined decisions, recipes, and validations per block.");
  diagnostics.push(...validateBlockReferences(block, catalog));
  if (planning) diagnostics.push(...validateCatalogReferences(block, planning, catalog));
  return { block, diagnostics };
}

function apiDocumentation(value) {
  try {
    const url = new URL(value);
    return safeMarkdownLink(value) && !url.port && url.hostname === "docs.github.com" && /\/(rest|graphql)(\/|$)/.test(url.pathname);
  } catch { return false; }
}

function safeMarkdownLink(value) {
  if (/^#[a-zA-Z0-9_-]+$/.test(value)) return true;
  return resolveContentLinkTarget(value, { enterpriseSlug: "profile", organizationSlug: "profile" }) !== null;
}

function validateBlockReferences(block, catalog) {
  const diagnostics = [];
  const report = (item, code, message, hint) => diagnostics.push(diagnostic(block.source.file, item.source?.line ?? 1, code, item.id ?? item.exerciseId ?? block.id, message, hint));
  const recipes = new Map(block.recipes.map((item) => [item.id, item]));
  const decisions = new Map(block.decisions.map((item) => [item.id, item]));
  const policies = catalog ? new Set((Array.isArray(catalog.policies) ? catalog.policies : []).filter((item) => item && typeof item === "object").map((item) => item.id)) : null;
  const checkAnswer = (owner, ref) => {
    const option = decisions.get(ref.decisionId)?.options.find((item) => item.id === ref.optionId);
    if (!option || option.deferred) report(owner, "E_ANSWER_REF", `Unknown or deferred answer "${ref.decisionId}.${ref.optionId}".`, "Reference a resolved Option ID in a local decision.");
  };
  for (const owner of [...block.decisions, ...block.recipes]) {
    for (const id of owner.policyIds) if (policies && !policies.has(id)) report(owner, "E_POLICY_REF", `Unknown shared policy "${id}".`, "Reference an ID in policy-catalog.json; do not use the planning CSV as the runtime catalog.");
  }
  for (const decision of block.decisions) for (const option of decision.options) {
    for (const id of option.recipeIds) if (!recipes.has(id)) report({ ...option, source: option.referencesSource, id: `${decision.id}.${option.id}` }, "E_RECIPE_REF", `Unknown Configure recipe "${id}".`, `Reference a local Recipe ID; available: ${[...recipes.keys()].join(", ") || "none"}.`);
    for (const id of option.recipeIds) {
      const recipe = recipes.get(id);
      if (recipe?.requiresAnswers.some((ref) => ref.decisionId === decision.id && ref.optionId !== option.id)) report(option, "E_REQUIREMENT", `Option selects recipe "${id}" but contradicts its required answer.`, "Correct Configure or Requires answers; a selected recipe must be satisfiable.");
      if (recipe?.conflictsWith.some((other) => option.recipeIds.includes(other))) report(option, "E_CONFLICT", "One option activates conflicting recipes.", "Remove one reference or correct the explicitly declared conflict.");
    }
  }
  for (const recipe of block.recipes) {
    if (recipe.variantDecisionId) {
      const decision = decisions.get(recipe.variantDecisionId);
      const expected = decision?.options.filter((option) => !option.deferred).map((option) => option.id).sort();
      if (!expected || JSON.stringify(expected) !== JSON.stringify(recipe.variants.map((variant) => variant.optionId).sort())) report(recipe, "E_VARIANT", "Variants must cover exactly the resolved options of a local decision.", "Use one Variant per non-deferred option, and no others.");
      if (!recipe.requiresDecisions.includes(recipe.variantDecisionId)) report(recipe, "E_VARIANT", "The variant decision must be a resolved prerequisite.", "Include Variant decision in Requires decisions.");
    }
    for (const id of recipe.requiresDecisions) if (!decisions.has(id)) report(recipe, "E_DECISION_REF", `Unknown required decision "${id}".`, "Reference a Decision ID in this block.");
    for (const ref of recipe.requiresAnswers) checkAnswer(recipe, ref);
    if (new Set(recipe.requiresAnswers.map((ref) => ref.decisionId)).size !== recipe.requiresAnswers.length) report(recipe, "E_REQUIREMENT", "Recipe requires multiple answers to one decision.", "Require at most one resolved answer per decision.");
    for (const warning of recipe.warnings) {
      for (const ref of warning.when) checkAnswer(warning, ref);
      if (new Set(warning.when.map((ref) => ref.decisionId)).size !== warning.when.length) report(warning, "E_WARNING", "A warning cannot match multiple answers to one decision.", "Use at most one answer per decision in When.");
    }
    for (const id of recipe.conflictsWith) {
      if (!recipes.has(id) || id === recipe.id) report(recipe, "E_CONFLICT", `Invalid conflicting recipe "${id}".`, "Reference a different local Recipe ID.");
      else if (!recipes.get(id).conflictsWith.includes(recipe.id)) report(recipe, "E_CONFLICT", `Conflict with "${id}" is not symmetric.`, `Add ${recipe.id} to that recipe's Conflicts with field.`);
    }
    if (recipe.kind === "exercise" && !block.validations.some((item) => item.exerciseId === recipe.exerciseId)) report(recipe, "E_VALIDATION_MISSING", `Exercise "${recipe.exerciseId}" has no validation.`, `Add ### Exercise: ${recipe.exerciseId} under ## Validation, with Steps and Expected result.`);
  }
  for (const validation of block.validations) {
    const recipe = block.recipes.find((item) => item.kind === "exercise" && item.exerciseId === validation.exerciseId);
    if (!recipe) report(validation, "E_VALIDATION_ORPHAN", `No exercise recipe owns "${validation.exerciseId}".`, "Correct this Exercise ID or add its exercise recipe in Configure.");
    if (validation.variantDecisionId) {
      const decision = decisions.get(validation.variantDecisionId);
      const expected = decision?.options.filter((option) => !option.deferred).map((option) => option.id).sort();
      if (!expected || JSON.stringify(expected) !== JSON.stringify(validation.variants.map((variant) => variant.optionId).sort())) {
        report(validation, "E_VARIANT", "Validation variants must cover exactly the resolved options of a local decision.", "Use one Variant per non-deferred option, and no others.");
      }
      if (!recipe?.requiresDecisions.includes(validation.variantDecisionId)) {
        report(validation, "E_VARIANT", "The validation variant decision must be a required decision for its exercise.", "Include Variant decision in the exercise recipe's Requires decisions.");
      }
    }
  }
  return diagnostics;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Every Markdown entry that can carry planning-catalog references, with a readable label. */
function catalogOwners(block) {
  return [
    ...block.decisions.map((item) => ({ item, stage: "decisions", kind: "decision", id: item.id, label: `Decision: ${item.id}` })),
    ...block.recipes.map((item) => ({ item, stage: "configure", kind: "recipe", id: item.id, label: `Recipe: ${item.id}` })),
    ...(block.stages.configure?.additionalSteps ?? []).map((item) => ({ item, stage: "configure", kind: "additional-step", id: item.title, label: `Additional steps: ${item.title}` })),
  ];
}

function validateCatalogReferences(block, planning, catalog) {
  const diagnostics = [];
  const runtimeIds = new Set((Array.isArray(catalog?.policies) ? catalog.policies : []).map((policy) => policy?.id));
  const active = planning.rows.filter((row) => !row.removed);
  const blockRows = active.filter((row) => row.block === block.id).map((row) => row.id);
  for (const { item, label } of catalogOwners(block)) {
    const line = item.catalogSource?.line ?? item.source?.line ?? 1;
    for (const id of new Set(item.catalogIds.filter((value) => value !== "none" && CATALOG_ID.test(value)))) {
      const row = planning.byId.get(id);
      if (row?.removed) {
        diagnostics.push(diagnostic(block.source.file, line, "E_CATALOG_REMOVED", label, `Catalog ID "${id}" is marked removed in ${planning.file}.`, `Drop "${id}" from **${CATALOG_FIELD}:**, or restore the row in the planning catalog if this content still addresses it.`));
      } else if (!row) {
        const nearest = active.map((candidate) => [candidate.id, editDistance(id, candidate.id)]).sort((a, b) => a[1] - b[1])[0];
        const suggestion = nearest && nearest[1] <= Math.max(3, Math.floor(id.length / 4)) ? ` Did you mean "${nearest[0]}"?` : "";
        const runtime = runtimeIds.has(id) ? ` "${id}" is a runtime policy ID from policy-catalog.json; keep it in **Policies:** and reference planning rows here.` : "";
        diagnostics.push(diagnostic(block.source.file, line, "E_CATALOG_REF", label, `Unknown catalog ID "${id}" in **${CATALOG_FIELD}:**.`,
          `Use a row id from ${planning.file}.${runtime}${suggestion} ${block.id} rows: ${blockRows.join(", ") || "none"}. Use none if no catalog row applies.`));
      }
    }
  }
  return diagnostics;
}

/** Parse the author planning catalog CSV into a reference index. Structure only; never product truth. */
export function indexPlanningCatalog(text, { file = "content/policy-catalog.csv" } = {}) {
  const diagnostics = [];
  const add = (line, message, hint) => diagnostics.push(diagnostic(file, line, "E_PLANNING_CATALOG", "planning catalog", message, hint));
  let table;
  try { table = parseTable(text); }
  catch (error) {
    add(error.line ?? 1, `Cannot parse CSV: ${error.message}`, "Repair the CSV (quote fields containing commas, quotes, or newlines).");
    return { planning: null, diagnostics };
  }
  for (const column of ["id", "block", "removed"]) if (!table.columns.includes(column)) add(1, `Missing column "${column}".`, "Restore the core planning columns from version control.");
  if (diagnostics.length) return { planning: null, diagnostics };
  const byId = new Map();
  table.rows.forEach((row, index) => {
    const line = table.lines[index];
    if (!CATALOG_ID.test(row.id)) add(line, `Invalid row id "${row.id}".`, "Use lowercase letters, digits, '.', '_' or '-'; never rename an existing ID.");
    else if (byId.has(row.id)) add(line, `Duplicate row id "${row.id}".`, "Keep each planning catalog ID unique.");
    else byId.set(row.id, { id: row.id, name: row.name ?? "", block: row.block, notes: row.notes ?? "", removed: row.removed === "yes", line });
  });
  return { planning: { file, rows: [...byId.values()], byId }, diagnostics };
}

/**
 * Map planning catalog IDs to the Markdown entries that reference them via **Catalog IDs:**.
 * Returns a prototype-free {[catalogId]: [{block, stage, kind, id}]} in authored order.
 */
export function catalogCoverage(blocks) {
  const coverage = Object.create(null);
  for (const block of blocks) for (const { item, stage, kind, id } of catalogOwners(block)) {
    for (const catalogId of item.catalogIds ?? []) (coverage[catalogId] ??= []).push({ block: block.id, stage, kind, id });
  }
  return coverage;
}

/** Validate the shared runtime catalog; this checks structure/URL syntax, never product truth. */
export function validatePolicyCatalog(catalog, { file = "content/policy-catalog.json" } = {}) {
  const diagnostics = [];
  const add = (section, code, message, hint) => diagnostics.push(diagnostic(file, 1, code, section, message, hint));
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const keys = ["id", "name", "governanceCategory", "scope", "requiredPermissions", "supportedSurfaces", "location", "workshopSuitability", "prerequisites", "knownLimitations", "releaseStatus", "propagation", "documentation"];
  if (!object(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.policies)) {
    add("catalog", "E_CATALOG", "Expected schemaVersion 1 and a policies array.", "Use the shared runtime policy catalog schema documented in CONTENT-FORMAT.md.");
    return diagnostics;
  }
  for (const key of Object.keys(catalog)) if (!["schemaVersion", "policies"].includes(key)) add("catalog", "E_FIELD", `Unsupported catalog field "${key}".`, "Remove unknown fields or explicitly version the schema.");
  const ids = new Set();
  for (const policy of catalog.policies) {
    if (!object(policy)) { add("policy", "E_CATALOG", "Expected a policy object.", "Replace the entry with a complete policy record."); continue; }
    const id = typeof policy.id === "string" ? policy.id : "policy";
    if (typeof policy.id !== "string" || !POLICY_ID.test(id) || ids.has(id)) add(id, "E_POLICY_ID", "Invalid or duplicate policy ID.", "Use a unique category.kebab-name ID.");
    ids.add(id);
    for (const key of Object.keys(policy)) if (!keys.includes(key)) add(id, "E_FIELD", `Unsupported policy field "${key}".`, "Use only documented catalog fields.");
    for (const key of ["name", "requiredPermissions", "location", "releaseStatus", "propagation"]) if (typeof policy[key] !== "string" || !policy[key].trim()) add(id, "E_CATALOG", `Missing or invalid "${key}".`, "Supply a nonempty string; do not invent an unverified product claim.");
    for (const [key, allowed] of Object.entries({ governanceCategory: ["user", "billing", "agent", "context", "observability"], scope: ["enterprise", "organization", "repository", "client"], workshopSuitability: ["hands-on", "demonstration", "reference-only"] })) if (!allowed.includes(policy[key])) add(id, "E_CATALOG", `Invalid "${key}".`, `Use one of: ${allowed.join(", ")}.`);
    for (const key of ["supportedSurfaces", "prerequisites", "knownLimitations"]) if (!Array.isArray(policy[key]) || !policy[key].length || policy[key].some((value) => typeof value !== "string" || !value.trim())) add(id, "E_CATALOG", `Invalid "${key}".`, "Use a nonempty array of nonempty strings.");
    if (!Array.isArray(policy.documentation) || !policy.documentation.length) add(id, "E_SOURCE", "Missing official documentation.", "Add documentation entries containing label and an official HTTPS URL.");
    else for (const entry of policy.documentation) {
      let valid = object(entry) && Object.keys(entry).every((key) => ["label", "url"].includes(key)) && typeof entry.label === "string" && !!entry.label.trim();
      try {
        const url = new URL(entry.url);
        valid &&= safeMarkdownLink(entry.url) && !url.port && (["docs.github.com", "api.github.com"].includes(url.hostname) || (url.hostname === "github.blog" && url.pathname.startsWith("/changelog/")));
      } catch { valid = false; }
      if (!valid) add(id, "E_SOURCE", "Invalid official documentation entry.", "Use {label, url} with HTTPS on docs.github.com, api.github.com, or github.blog/changelog/; no credentials or custom port.");
    }
  }
  return diagnostics;
}

/** Manifest v3 explicitly discovers active Markdown, independently of any canvas. */
export function validateManifest(manifest, { file = "content/manifest.json" } = {}) {
  const diagnostics = [];
  const add = (code, message, hint) => diagnostics.push(diagnostic(file, 1, code, "manifest", message, hint));
  if (manifest?.version !== MANIFEST_VERSION) {
    add("E_MIGRATION_REQUIRED", "The active repository manifest is not migrated to Markdown format (manifest version 3).", "Migrate explicitly to {version:3,title,blocks:[{id,source:\"<id>.md\"}]}; the validator never falls back to legacy block JSON.");
    return diagnostics;
  }
  for (const key of Object.keys(manifest)) if (!["version", "title", "blocks"].includes(key)) add("E_FIELD", `Unknown manifest field "${key}".`, "Use version, title, and blocks only.");
  if (typeof manifest.title !== "string" || !manifest.title.trim()) add("E_MANIFEST", "Missing manifest title.", "Supply a nonempty title.");
  if (!Array.isArray(manifest.blocks) || !manifest.blocks.length || manifest.blocks.length > LIMITS.entries) {
    add("E_MANIFEST", "Expected 1–200 active block entries.", "List each active block once in manifest order.");
    return diagnostics;
  }
  const ids = new Set();
  for (const block of manifest.blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block) || typeof block.id !== "string" || !BLOCK_ID.test(block.id) || block.source !== `${block.id}.md` || Object.keys(block).some((key) => !["id", "source"].includes(key))) {
      add("E_MANIFEST", "Invalid block entry or unsafe source path.", "Use exactly {id:\"kebab-id\",source:\"kebab-id.md\"}; sources live beside the manifest.");
      continue;
    }
    if (ids.has(block.id)) add("E_DUPLICATE_ID", `Duplicate block "${block.id}".`, "List each active block ID exactly once.");
    ids.add(block.id);
  }
  return diagnostics;
}

/** Source link + deterministic SHA-256 fingerprint for a human-reviewed author stage. */
export function stageSource(block, stage, catalog) {
  if (!STAGES.includes(stage) || !block.stages[stage]) throw new TypeError(`Unknown or missing stage: ${stage}`);
  const policyIds = new Set([...block.decisions, ...block.recipes].flatMap((item) => item.policyIds));
  const policies = (catalog?.policies ?? []).filter((item) => policyIds.has(item.id)).sort((a, b) => a.id.localeCompare(b.id));
  const linkage = ["configure", "validation"].includes(stage) ? block.decisions.map((decision) => ({
    id: decision.id, options: decision.options.map(({ id, deferred, recipeIds }) => ({ id, deferred, recipeIds })),
  })) : null;
  const recipes = stage === "validation" ? block.recipes.map(({ id, kind, exerciseId, target, policyIds, requiresDecisions, requiresAnswers, conflictsWith }) => ({
    id, kind, exerciseId, target, policyIds, requiresDecisions, requiresAnswers, conflictsWith,
  })) : null;
  return {
    ...block.stages[stage].source,
    fingerprint: `sha256:${hash({ format: FORMAT_VERSION, header: block.headerSource, stage: block.stages[stage].markdown, policies, linkage, recipes })}`,
  };
}

/** Completion basis changes when this exercise's authored instructions or policy metadata change. */
export function exerciseFingerprint(block, recipe, catalog) {
  const withoutSources = (value) => {
    if (Array.isArray(value)) return value.map(withoutSources);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["source", "referencesSource", "fingerprint", "catalogIds", "catalogSource"].includes(key)).map(([key, item]) => [key, withoutSources(item)]));
    return value;
  };
  const relevant = new Set([...recipe.requiresDecisions, ...recipe.requiresAnswers.map((item) => item.decisionId),
    recipe.variantDecisionId, ...block.decisions.filter((decision) => decision.options.some((option) => option.recipeIds.includes(recipe.id))).map((decision) => decision.id)]);
  // Preserve version-11 fingerprints for exercises that previously defaulted to inspection.
  const fingerprintRecipe = { ...recipe, exerciseKind: "inspection" };
  return `sha256:${hash({ recipe: withoutSources(fingerprintRecipe), validation: withoutSources(block.validations.find((item) => item.exerciseId === recipe.exerciseId)),
    decisions: withoutSources(block.decisions.filter((decision) => relevant.has(decision.id))),
    policies: catalog.policies.filter((policy) => recipe.policyIds.includes(policy.id)).sort((a, b) => a.id.localeCompare(b.id)) })}`;
}

export class ContentReadError extends Error {
  constructor(message, { file, cause } = {}) {
    super(message, { cause });
    this.name = "ContentReadError";
    this.file = file;
  }
}

/** Read-only repository API. Does not import an SDK, start services, or access the network. */
export async function loadWorkshopContent({ root = process.cwd(), manifestFile = "content/manifest.json", catalogFile = "content/policy-catalog.json", planningFile = "content/policy-catalog.csv", file } = {}) {
  root = resolve(root);
  const label = (path) => relative(root, path).split(sep).join("/") || ".";
  const diagnostics = [];
  const read = async (path) => {
    try {
      const text = await readFile(path, "utf8");
      if (Buffer.byteLength(text, "utf8") > LIMITS.bytes) {
        diagnostics.push(diagnostic(label(path), 1, "E_SIZE", "file", "Source exceeds 512 KiB.", "Split large supporting data out of the active source."));
        return null;
      }
      return text;
    } catch (cause) { throw new ContentReadError(`Cannot read ${label(path)}: ${cause.code ?? cause.message}`, { file: label(path), cause }); }
  };
  const json = async (path) => {
    const text = await read(path);
    if (text === null) return null;
    try { return JSON.parse(text); }
    catch (cause) {
      const position = /position (\d+)/.exec(cause.message)?.[1];
      const line = position ? text.slice(0, Number(position)).split("\n").length : 1;
      diagnostics.push(diagnostic(label(path), line, "E_JSON", "JSON", cause.message, "Repair JSON syntax; do not use comments or trailing commas."));
      return null;
    }
  };
  const manifestPath = resolve(root, manifestFile), catalogPath = resolve(root, catalogFile);
  // The planning CSV is optional: without it, Catalog IDs cannot be checked and are reported below.
  let planning = null, planningMissing = false;
  if (planningFile !== null) {
    const planningPath = resolve(root, planningFile);
    const text = await read(planningPath).catch((error) => {
      if (error.cause?.code !== "ENOENT") throw error;
      planningMissing = true;
      return null;
    });
    if (text !== null) {
      const indexed = indexPlanningCatalog(text, { file: label(planningPath) });
      diagnostics.push(...indexed.diagnostics);
      planning = indexed.planning;
    }
  }
  const catalog = await json(catalogPath);
  if (catalog) diagnostics.push(...validatePolicyCatalog(catalog, { file: label(catalogPath) }));
  if (!catalog && !diagnostics.some((item) => item.file === label(catalogPath))) diagnostics.push(...validatePolicyCatalog(catalog, { file: label(catalogPath) }));
  let manifest = null, sources = [];
  if (file) {
    const path = resolve(root, file);
    if (!path.endsWith(".md")) throw new ContentReadError("--file requires a Markdown (.md) source.", { file: label(path) });
    sources = [{ path }];
  } else {
    manifest = await json(manifestPath);
    if (manifest) diagnostics.push(...validateManifest(manifest, { file: label(manifestPath) }));
    else if (!diagnostics.some((item) => item.file === label(manifestPath))) diagnostics.push(...validateManifest(manifest, { file: label(manifestPath) }));
    if (manifest && !diagnostics.some((item) => item.file === label(manifestPath))) {
      sources = manifest.blocks.map(({ id, source }) => ({ id, path: resolve(dirname(manifestPath), source) }));
      for (const entry of sources) {
        try {
          const actual = await realpath(entry.path), directory = await realpath(dirname(manifestPath));
          if (dirname(actual) !== directory) throw new ContentReadError("Manifest source escapes its content directory through a symlink.", { file: label(entry.path) });
        } catch (cause) {
          if (cause instanceof ContentReadError) throw cause;
          throw new ContentReadError(`Cannot resolve ${label(entry.path)}: ${cause.code ?? cause.message}`, { file: label(entry.path), cause });
        }
      }
    }
  }
  const blocks = [];
  for (const entry of sources) {
    const markdown = await read(entry.path);
    if (markdown === null) continue;
    const result = parseWorkshopMarkdown(markdown, { file: label(entry.path), catalog: catalog ?? undefined, planning: planning ?? undefined });
    if (planningMissing && result.block) {
      const first = catalogOwners(result.block).find(({ item }) => item.catalogIds.length);
      if (first) diagnostics.push(diagnostic(label(entry.path), first.item.catalogSource?.line ?? 1, "E_PLANNING_MISSING", first.label, `${planningFile} is missing, so **${CATALOG_FIELD}:** references cannot be checked.`, "Restore the planning catalog CSV from version control, or validate from the repository root."));
    }
    diagnostics.push(...result.diagnostics);
    if (result.block) {
      if (entry.id && result.block.id !== entry.id) diagnostics.push(diagnostic(label(entry.path), 1, "E_BLOCK_ID", result.block.id, `Block ID does not match manifest ID "${entry.id}".`, "Keep the manifest ID, filename, and Markdown Block ID aligned."));
      blocks.push(result.block);
    }
  }
  const globalIds = new Map();
  for (const block of blocks) for (const [kind, entries] of [["decision", block.decisions], ["exercise", block.recipes.filter((item) => item.kind === "exercise")]]) {
    for (const entry of entries) {
      const id = kind === "exercise" ? entry.exerciseId : entry.id, key = `${kind}:${id}`;
      if (globalIds.has(key)) diagnostics.push(diagnostic(block.source.file, entry.source.line, "E_DUPLICATE_ID", id, `Duplicate global ${kind} ID "${id}".`, `Use a stable unique ID; already declared in ${globalIds.get(key)}.`));
      globalIds.set(key, block.source.file);
    }
  }
  return { manifest, catalog, planning, blocks, diagnostics };
}

export function formatDiagnostic(item) {
  return `${item.file}:${item.line} error[${item.code}] ${item.section}: ${item.message}\n  Hint: ${item.hint}`;
}
