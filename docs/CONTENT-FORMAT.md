# Workshop Markdown format, version 1

Markdown is the editing layer. The parser/schema is
[`lib/workshop-content.mjs`](../lib/workshop-content.mjs); the offline CLI is
[`scripts/validate-content.mjs`](../scripts/validate-content.mjs). Neither imports
the extension SDK, HTTP server, browser, or participant state. They read files,
do not write them, and make no network requests. Structural validity does **not**
prove product accuracy, human approval, or participant completion.

## Author loop

```sh
node scripts/validate-content.mjs
node scripts/validate-content.mjs --file content/user-governance.md
node scripts/validate-content.mjs --root tests/content-validation/fixtures/content-format/valid
node --test tests/content-validation/content-format.test.mjs
```

Commands resolve paths against the current working directory, or `--root`.
`--file` validates a standalone Markdown source and its shared policy catalog;
it intentionally does not require manifest membership or validate other blocks.
This lets authors validate new files before activation. Without `--file`, all
manifest blocks are checked, including cross-block decision/exercise uniqueness.
Both modes validate the whole shared catalog, not just referenced entries.
`--help` prints usage. Unknown, duplicate, or valueless options fail.

Developer tools are off by default (`dev: false`) and have no participant-facing enable control. To use them, explicitly ask the agent to enable developer tools; an authoring task alone is not permission to enable them.
The agent reopens the same canvas instance and `documentId` with `dev: true`, or with `dev: false` to disable them again. Omitting `dev` also opens in participant mode. Reopening preserves saved progress, but not unsaved page drafts or pending request batches; finish those before switching modes.
For an optional visual preview after changing Markdown or the policy catalog, enable developer tools, then click **Reload** in the floating **Dev mode** panel at the top right of the open governance canvas.
The round button at the panel's left edge collapses the panel to a small icon and expands it again; the canvas remembers that choice in the browser's local storage.
Reload re-reads and revalidates the Markdown and policy
catalog, including newly authored content, while preserving and reconciling saved
progress. If validation fails, the canvas shows diagnostics and keeps the
previously loaded content active. The separate **Reset** button clears all
decisions, exercise progress, notes and history for this document after
confirmation, keeping a `.bak` backup. Reset does not reload content.
**Save state** stores the entire participant state under a name you choose, after flushing autosave. **Restore state** lists those names and reapplies the selected snapshot after confirmation, backing up the replaced state first.
Named states live beside the user-local progress files, outside the repository and agent session, in `$COPILOT_HOME/extensions/governance-lab/artifacts/files/governance-workshop/snapshots/` (`COPILOT_HOME` defaults to `~/.copilot`).
They include answers, profile, personal Done markers, exercise records, notes and history for all blocks, not authored Markdown or policy metadata. Existing names cannot be overwritten; choose a new name for another snapshot.
Restoring uses the current content's reconciliation rules, so changed content can archive earlier completion rather than mark new work Done.
**Pick section** (also dev-only) lets reviewers click a rendered part of the canvas and write a review request about its Markdown source.
Hover or Tab highlights the innermost sourced element; Alt+↑ widens to the enclosing section, Alt+↓ narrows again, Enter or click opens the request dialog, and Esc stops picking.
**Review all variants** shows every authored configuration recipe, Additional step, and validation path for the current block, including unselected options. **Config** and **Validation** tabs in the left-hand sidebar switch between the two stages; only the active stage's cards and index entries are shown. Review opens on Validation from Verify, otherwise Config. The tabs support arrow keys and Home/End. A visually distinct developer decision tree sits above each participant card, identifying the decision and option titles that select it. Cards reuse the participant Configure/Verify rendering, with progress actions disabled and answer-changing controls omitted. On narrow screens the sidebar, including the tabs, becomes an expandable browser above the content. This is a read-only developer review view; it does not change participant answers or progress.
**Add to batch** (Ctrl/⌘+Enter) keeps the request in the page's memory and returns to picking; the **Batch requests pending** tray at the bottom lists, edits and removes pending requests and is lost when the canvas page reloads.
**Send all to Copilot** (or **Send now** for a single request) immediately submits one message to the Copilot agent without a confirmation step; if the agent is busy, the message is queued.
After a successful send, picking mode turns off.
For each request, the message contains a link to the Markdown file and line range (for example `[content/user-governance.md (L7–31)](content/user-governance.md#L7-L31)`) followed by the prompt exactly as typed, and each picked section is attached as a selection.
While picking, clicks inside the content area do not save answers or progress.
If the Markdown file changed on disk or the workshop content was reloaded after a section was picked, sending is refused until you click **Reload** and pick again, so line numbers and section text match the content shown when picked.
Runtime code changes still need
`extensions_reload`. No canvas, extension reload, browser, or SDK is needed for the
offline edit/validate loop.

Exit status: **0** valid; **1** invalid content/schema/JSON; **2** invocation or
read failure. Every error includes a stable code, file, 1-based line, section/ID,
and repair hint. Markdown diagnostics locate headings or metadata; JSON schema
errors currently identify line 1 plus the affected policy ID. Recoverable
structural errors are collected rather than stopping after the first failure.
Do not automatically fix IDs or invent missing content.

The six active blocks now use manifest version 3 and Markdown format 1. The
default command validates that repository content directly. Old version-2
manifests still fail explicitly with `E_MIGRATION_REQUIRED`; there is no legacy
JSON content fallback. Independent fixtures test valid and invalid inputs
without blessing existing draft content.

## Discovery and supporting data

One active `content/<block-id>.md` per block. Manifest version 3 declares order:

```json
{
  "version": 3,
  "title": "Workshop title",
  "blocks": [
    {"id": "example-block", "source": "example-block.md"}
  ]
}
```

Only `version`, `title`, and `blocks` are accepted. Every block entry has exactly
`id` and `source`. Source must be `<id>.md` beside the manifest; absolute paths,
traversal, nested paths, and symlinks escaping that directory are rejected.
Every entry is active; approval/status never gates participant availability.
The repository manifest lists the six workshop block identities in order.
The format itself permits 1–200 blocks so isolated fixtures remain possible.

`content/policy-catalog.json` retains schemaVersion 1 with `policies`.
Each record has `id`, `name`, `governanceCategory`, `scope`,
`requiredPermissions`, `supportedSurfaces`, `location`, `workshopSuitability`,
`prerequisites`, `knownLimitations`, `releaseStatus`, `propagation`,
`documentation`. Unknown fields fail.

- Policy IDs: lowercase `category.kebab-name` (digits allowed).
- Category: `user`, `billing`, `agent`, `context`, or `observability`.
- Scope: `enterprise`, `organization`, `repository`, or `client`.
- Suitability: `hands-on`, `demonstration`, or `reference-only`.
- `supportedSurfaces`, `prerequisites`, `knownLimitations`: nonempty string arrays.
- `documentation`: nonempty `{label,url}` array. URLs must be credential-free
  HTTPS without a custom port, on `docs.github.com`, `api.github.com`, or
  `github.blog/changelog/`. Validation checks syntax/allowlist, not availability
  or truth. Authors must separately open and verify sources.
- Remaining named fields are nonempty strings. Policy IDs are unique.
- Recipes may reference policies from other categories: categorization is not
  an access rule. The planning CSV is **not** the runtime policy catalog and its
  IDs are not automatically interchangeable.

### Planning catalog traceability (`Catalog IDs`)

`content/policy-catalog.csv` is the author planning catalog: which settings and
policies the workshop intends to address, and where. Content traces back to it
with optional `**Catalog IDs:**` metadata on `### Decision:`, `### Recipe:`,
and `####` cards under `### Additional steps`:

```markdown
### Recipe: example-guidance

**Title:** Example guidance
**Kind:** guidance
**Policies:** user.example
**Catalog IDs:** models-features.model-availability, access.enterprise-teams
```

- Values are comma-separated CSV `id` values (lowercase letters, digits, `.`,
  `_`, `-`), or `none` when an entry was reviewed and no catalog row applies.
  `none` cannot be combined with IDs; duplicates fail (`E_LIST`).
- Omitting the field means "not yet traced". It is optional so untraced
  drafts still validate; traced blocks should list it on every entry.
- Every ID must be an active CSV row (`E_CATALOG_REF`, with a did-you-mean
  suggestion and the block's rows in the hint); rows marked `removed=yes` fail
  with `E_CATALOG_REMOVED`. A missing CSV fails with `E_PLANNING_MISSING` only
  when content uses `Catalog IDs`; a malformed CSV fails with
  `E_PLANNING_CATALOG`.
- Convention: a decision lists the union of the rows its options' recipes
  configure, so a decision shows which policies it affects.
- Traceability only: participants never see these IDs, they do not change
  exercise identity or saved progress, and they are not product evidence.
  `node scripts/catalog-coverage.mjs` prints the coverage per block as a
  read-only report. Missing coverage is a planning note, not a validation
  error. A row whose `notes` start with `Not applicable in the lab:` is
  labeled as such in the report.
- The participant runtime loads content with `planningFile: null`, so the
  author CSV never gates participant availability. The CLI and the authoring
  canvas validate the references.

## Copyable example

Copy [`templates/workshop-block.md`](templates/workshop-block.md). It is a
fictional structural example, not workshop guidance. Its `user.example` policy
is defined only in the synthetic test catalog. Replace placeholder IDs with
real catalog IDs and author/verify the prose before activating it.

## Headings and metadata

Use UTF-8, LF or CRLF, and unindented ATX headings (`# Title`, not Setext).
There is exactly one `#` block title and four `##` stages, exactly once in order:
`Understand`, `Decisions`, `Configure`, `Validation`.
Their stable source anchors are `#understand`, `#decisions`, `#configure`,
`#validation`. Visible labels can differ at runtime; these author headings cannot.
Other headings cannot reuse those anchors, including the block title.
Empty stages are structurally allowed for unapproved drafts.

Metadata is a single line `**Field name:** value` immediately after its owning
heading, before any prose. Blank lines are allowed between metadata fields.
Field names are case-sensitive; duplicate/unknown fields fail.
Strings are unquoted, single-line, nonempty. Prose goes below metadata, never in
JSON blobs. Reference lists are comma-separated IDs, or the literal `none`;
duplicates and empty elements fail. Booleans are exactly `true` or `false`.
No YAML, executable expressions, script hooks, inferred IDs, or arbitrary
dynamic URLs; the only template syntax is the constrained link URL form below.

IDs begin with a letter and contain letters/digits separated optionally by
single hyphens. Block IDs are lowercase. Decision and exercise IDs are globally
unique; recipe IDs are block-local; option IDs are decision-local; field,
checkpoint, warning, and dataset IDs are unique within their owning definition.
Renaming a title/label never changes identity. Configure fields and Validation
fields have separate namespaces (configuration versus evidence).

| Heading | Required metadata | Optional metadata |
| --- | --- | --- |
| `# Title` | Format version (`1`), Block ID, Description | Subtitle, Duration minutes (1–9999) |
| `### Decision: ID` | Title, Policies | Catalog IDs |
| `#### Option: ID` | Label, Configure | Deferred (defaults false) |
| `### Recipe: ID` | Title, Kind, Policies | Catalog IDs, Exercise ID, Requires decisions, Requires answers, Conflicts with, Target, Variant decision, API, control labels below |
| `### Exercise: ID` | — | Title (defaults to ID), Task label, Attestation, Next label, Navigation label, Variant decision |
| `### Additional steps` | — | — |
| `#### <card title>` (under Additional steps) | — | Catalog IDs |
| `#### Variant: option-id` | — | — |
| `#### Field: ID` | Label, Type | Required (defaults false), Options |
| `#### Dataset: ID` | Fictional (`true`) | — |
| `#### Warning: ID` | When | — |
| `#### Checkpoint: ID` | — | — |

Other stage/subsection headings do not accept metadata. Root-level prose must
be inside a stage. Prose before a stage's first structured entry is its
introduction. In Configure, the optional `### Additional steps` subsection
must follow all recipes and renders after selected guidance and exercise
content. Its introductory prose renders in a card; optional `####` headings
define separately titled cards, each with nonempty instructions below the
heading. These cards are always visible, informational only, and accept only
`Catalog IDs` metadata and no deeper headings.

### Understand

Ordinary Markdown, including ordinary `###` and deeper consecutive headings,
is retained as stage Markdown. Other stages reserve `###`/`####` for the grammar
below; unsupported structural headings fail rather than silently dropping copy.

### Decisions

Each `### Decision: ID` has `#### Question` (required nonempty), optional
`#### Guidance`, zero or more `#### Checkpoint: ID`, and at
least two `#### Option: ID` entries, including at least one resolved option.
Without a deferred option, a decision needs at least two resolved options. An
optional deferred option is accepted for compatibility with existing content;
`Deferred: true` means unresolved, not completed, and it must use
`Configure: none`. New participant decisions should offer only substantive
resolved choices, not a deferred option. Resolved options may activate zero,
one, or several local recipe IDs.
`Policies: none` is allowed on a decision. Option explanation follows metadata.
Decision `#### Scenario` sections are retired; the validator rejects them with a
repair hint. Put situational prose in `#### Guidance`.

A checkpoint has exactly one nonempty `##### Question` and `##### Answer`.
It is authored prediction/discussion material, not automatically scored evidence.

### Configure

A recipe's `Kind` is `guidance` or `exercise`. Every recipe references one or
more shared `Policies`. Introductory recipe prose is retained. Standard optional
`####` subsections: `Safety`, `Scope`, `Role`, `Prerequisites`, `Steps`,
`Fallback`, `Prediction`; Safety must be nonempty for exercises, and either
shared Steps or complete decision variants must supply instructions.
These are ordinary authored Markdown, not generated commands. An exercise may
use bounded variants instead of shared Steps, as described below.

Optional recipe `API` metadata records whether the configured setting can be
managed through an API: `none` when the opened official API reference lists no
endpoint for it, or an HTTPS `docs.github.com` REST/GraphQL reference URL
(path containing `/rest/` or `/graphql/`) for the documented endpoint. Omit it
when unverified. The canvas shows a green linked "API available" chip or a red
"No API Available" chip; omitted metadata stays neutral as "API not recorded".
Other documentation links come from the referenced shared policies.

Guidance is informational: no Exercise ID, Target, form, checkpoint, or dataset
controls. An exercise has a required stable `Exercise ID`.
`Target` is `none` (default), `enterprise`, `organization`, `repository`,
`client`, or `github-page` (a confirmed page without implying an account scope).
A target is data only; it does not construct a URL or grant permission. The
participant canvas does not render a target input. Datasets, fields, and
Fallback sections are optional exercise content and have no special
type-dependent requirements.

For an existing exercise whose steps depend on one decision, set
`Variant decision: EX-01`. Add exactly one `#### Variant: option-id` for every
non-deferred option of that decision. Each variant has required
`##### Steps` and optional `##### Scope`/`##### Role` prose. Include the variant
decision in `Requires decisions`. Do not add shared `#### Steps` to a recipe
with variants; repeat common steps in each variant so it is one complete list.
Configure displays shared Steps, if any, followed by the matching variant. This changes instructions, not
exercise identity;
it does not create arbitrary conditions, expressions or generated commands.

Optional exercise control labels are single-line metadata: `Inspection label`,
`Changed label`, `Configuration confirmation`, `Target label`, `Target help`,
`Target link label`, `Steps label`, and `Primary choice label`. They preserve
authored wording and never change eligibility or validation rules. The recipe
model exposes them in `labels` keyed by their exact metadata names. The
participant canvas no longer shows participation-mode, configuration-status,
target or field controls, so `Inspection label`, `Changed label`,
`Configuration confirmation`, `Target label`, `Target help` and `Target link
label` are currently unused by the UI.

Optional prerequisites use bounded, local, conjunctive logic:

- `Requires decisions: EX-01, EX-02`: each must have a resolved selected answer.
- `Requires answers: EX-01.inspect, EX-02.ready`: each exact answer must match.
  Deferred/unknown answers fail; requiring two answers to one decision fails.
- `Conflicts with: other-recipe`: explicit, symmetric recipe-ID declarations.
  Selecting both leaves both ineligible. A single option selecting a conflicting
  pair is invalid. Independent combinations are additive unless declared
  conflicting; the validator cannot infer real-world policy contradictions.
- `#### Warning: ID`, with `When: EX-01.inspect, EX-02.ready` and message prose:
  all conditions must match. Warnings inform, not override eligibility.

Every selected recipe is returned once, in authored recipe order, with all
selecting answers retained. Unselected recipes are legal: drafts may define
recipes before wiring choices. Requirements never recursively activate recipes.
There are no loops, arbitrary predicates, computed endpoints, or auto-execution.

### Forms, fictional tables, and validation

Exercise recipes and matching Validation definitions can contain `#### Field: ID`.
Types: `text`, `textarea`, `select`, `number`. `Options` is allowed only on
select fields and requires at least two stable ID values; labels are those
values, not executable expressions. Prompt prose follows metadata. Numeric
input is data, not a formula. At most 40 fields per definition. The participant
canvas does not render fields as inputs; they remain in the parsed model, the
exercise fingerprint, and the agent save action.

`#### Dataset: ID` may appear in any exercise and includes `Fictional: true`, a nonempty visible notice, then
one rectangular Markdown pipe table. Header cells are unique ID column names.
There are 1–20 columns and 1–200 data rows, with a normal `---` delimiter row.
Use leading/trailing pipes; escape literal pipes as `\|`. Cells are strings;
consumers must not evaluate formulas or infer executable analysis. No prose
after the dataset table; put interpretation instructions in the exercise prose
or a field prompt.
This retains readable fictional tables instead of giant serialized documents.

Under `## Validation`, every exercise has exactly one `### Exercise: ID`.
No orphan/duplicate validations or reused exercise IDs are accepted. Nonempty
`#### Steps` and `#### Expected result` are required; optional
`#### Fallback`, fields and checkpoints are supported. Validation addresses
that exercise only. Evidence prose sections are not part of the content format.
To give it answer-specific verification, add
`**Variant decision:** DECISION-ID` immediately below the exercise heading and
one `#### Variant: option-id` for every resolved option of that decision. The
decision must be a required decision on the exercise recipe. Each variant must
include nonempty `##### Steps` and `##### Expected result`; `##### Fallback` is
optional. Do not combine shared Validation sections with variants. Shared
exercise prose, fields, and checkpoints remain available to every variant. The
selected answer determines which variant is shown; unresolved decisions do not
reveal a verification path or permit its completion. This branches
instructions without creating another exercise. Guidance has no
validation/completion record. Exercise and validation prose can differ freely
without hard-coded per-block UI.

## Supported Markdown and escaping

Prose supports paragraphs, emphasis, inline code, ordered/unordered lists,
blockquotes, pipe tables, `***` thematic breaks, fenced examples (backticks or
tildes, at least three), and inline `[label](https://...)` / `[label](#anchor)`
links. Link URLs may use the known `{{enterprise.slug}}` and
`{{organization.slug}}` and `{{repository.name}}` placeholders in link destinations. The repository name defaults to `pets-workshop` when absent from older profiles; an explicitly blank or invalid name uses the link fallback. An optional Markdown title of the form
`"fallback=https://example.test/generic"` supplies a static HTTPS link to use
when a profile value is blank or invalid. Without a fallback, the link label is
rendered without an active link. `example.test` is synthetic and does not
describe a GitHub URL. Unknown or malformed placeholders fail validation.
Repository Settings links use `https://github.com/{{organization.slug}}/{{repository.name}}/settings "fallback=https://github.com/settings/organizations"`. Link only the Settings prefix unless an authoritative deeper URL exists. Explicitly named repositories such as `.github-private` remain literal.
Actual GitHub URL patterns still require verification against official
documentation opened by the author; structural validation does not verify
product facts. Encode URL spaces/parentheses. Fences protect example headings and
metadata from structural parsing; closing fences must match marker type and
be at least as long as the opening fence. LF/CRLF normalize identically.
Use a fenced example when showing a reserved heading or metadata literally.
Shell fences explicitly marked `sh profile` support `{{enterprise.slug}}`, `{{organization.slug}}`, and `{{repository.name}}`, which resolve from the saved workshop profile. If a required profile value is blank or invalid, the command shows a replacement marker and cannot run until the profile is corrected.
The same `sh profile` fence can declare participant-supplied inputs with `{{input.field-id}}`, where `field-id` starts with a lowercase letter and contains lowercase letters, digits, or hyphens. Each distinct placeholder creates a required input beside the command; names ending in `-url` use URL validation. Assign each placeholder directly to a shell variable without quotes, for example `REPORT_ID={{input.report-id}}`, then use that variable in the command. Submitted values are shell-quoted, sent only with the current command, and are not saved in participant progress or exports. Malformed or unknown placeholders fail validation. Ordinary code fences and inline code remain literal.
Fences whose info is exactly `sh`, `bash`, `shell`, or `sh profile` get an **Open terminal and run** button in the participant canvas. The button opens the workshop document's shared terminal and runs the command after any required inputs are provided. Later commands run in the same shell, so variables and files from earlier steps remain available. Use `sh manual` only for reference-only shell examples that participants must not run from the workshop; it renders without a button.

No raw HTML, images, reference links, Setext headings, relative file links,
script/data URLs, heading jumps, or arbitrary subheadings in structured entries.
Raw HTML is never trusted; consumers must still escape text and render safe
Markdown. The parser is not an HTML renderer. Link checking is offline syntax
validation, not a claim that a URL resolves.

### Navigation steps

Write a GitHub UI path as one bold run that starts at **Enterprise Settings**, **Organization Settings**, or **Repository Settings**, with ` -> ` between UI labels:

```text
Navigate to your **Enterprise Settings -> AI controls -> Copilot -> Configure models**.
```

When a verified page URL exists, make the whole path the link and keep the bold outside it. Link labels are rendered as plain text, so `**` inside a label would appear literally:

```text
Navigate to your **[Enterprise Settings -> AI controls](https://github.com/enterprises/{{enterprise.slug}}/ai-controls "fallback=https://github.com/settings/enterprises") -> Agent sessions**.
```

If the URL only reaches part of the path, link only that prefix, as in the example above. Use `https://github.com/settings/enterprises` or `https://github.com/settings/organizations` as the fallback; the official docs give these as the starting points for navigating to an enterprise or organization.

Sources are bounded to 512 KiB each and 200 decisions+recipes+validations per
block. These are parser bounds, not product limits.

## Stable JavaScript interfaces

```js
import {
  FORMAT_VERSION, MANIFEST_VERSION, STAGES, LIMITS,
  parseWorkshopMarkdown, validateManifest, validatePolicyCatalog,
  loadWorkshopContent, stageSource, exerciseFingerprint, formatDiagnostic, ContentReadError,
  resolveConfiguration, indexPlanningCatalog, catalogCoverage,
} from "../lib/workshop-content.mjs";
import { parseContentLinkTarget, resolveContentLinkTarget } from "../lib/workshop-resolver.mjs";
```

- `parseWorkshopMarkdown(text, {file?, catalog?, planning?}) -> {block, diagnostics}`:
  local syntax/schema/references; with catalog, also policy references; with
  `planning` (from `indexPlanningCatalog`), also `Catalog IDs` references.
- `indexPlanningCatalog(csvText, {file?}) -> {planning, diagnostics}` indexes
  planning rows as `{id,name,block,removed,line}`.
- `catalogCoverage(blocks) -> {[catalogId]: [{block,stage,kind,id}]}` with
  `kind` `decision`, `recipe`, or `additional-step` (whose `id` is its title).
- `validateManifest(value, {file?})`, `validatePolicyCatalog(value, {file?})`
  return diagnostic arrays. Strict schemas are shared, not duplicated by clients.
- `loadWorkshopContent({root?, manifestFile?, catalogFile?, planningFile?, file?})`
  is async, returns `{manifest, catalog, planning, blocks, diagnostics}` in
  authored order. Defaults: root cwd; manifest `content/manifest.json`; catalog
  `content/policy-catalog.json`; planning `content/policy-catalog.csv`
  (`null` skips planning references). `file` mode returns manifest null.
  I/O failure throws `ContentReadError` with `.file`; invalid content returns
  diagnostics. **Never render/use models with diagnostics.** No `status:ready`
  inference or legacy fallback.
- Diagnostics: `{code,file,line,section,message,hint}`.
  `formatDiagnostic(item)` produces the two-line CLI message.
- `block` has `formatVersion,id,title,description,subtitle,durationMinutes`,
  `stages`, `decisions`, `recipes`, `validations`, `source`, `sourceText`,
  `headerSource`. Optional scalar defaults are `""`/null; lists default empty.
- `stages[stage]` has `markdown` (the complete stage body), `introduction`
  (prose before structured children), `conclusion` (Additional steps introductory
  prose), `additionalSteps` (`{title,markdown,catalogIds,catalogSource,source}` cards), and `source`.
  Stage keys are the four
  lowercase exported STAGES. Runtime consumers render structured entries rather
  than rendering the full structured stage Markdown a second time.
- Decisions, recipes, and Additional steps cards also carry `catalogIds`
  (empty for `none` or absent) and `catalogSource` (`{file,line}` or null when
  the field is absent).
- Decisions: `id,title,policyIds,markdown,question,guidance,options,
  checkpoints,source`; options: `id,label,deferred,recipeIds,markdown,source`
  (plus `referencesSource` for metadata diagnostics).
- Recipes: `id,title,kind,exerciseId,target,policyIds,
  requiresDecisions,requiresAnswers,conflictsWith,variantDecisionId,variants,labels,markdown,sections,fields,
  datasets,checkpoints,warnings,source`. `sections` uses authored subsection
  titles as keys, e.g. `recipe.sections.Safety` or
  `validation.sections["Expected result"]`. Answer references are
  `{decisionId,optionId}`.
- Variants: `optionId,markdown,sections,source`. Their sections use `Scope`,
  `Role`, and `Steps`; a recipe without variants has an empty array.
- Validations: `exerciseId,title,labels,markdown,sections,fields,checkpoints,source`.
- Fields: `id,label,type,required,options,markdown,source`; datasets:
  `id,fictional,notice,columns,rows,markdown,source`; checkpoints:
  `id,markdown,question,answer,source`; warnings: `id,when,markdown,source`.
- `resolveConfiguration(block, selections)` accepts `{[decisionId]:optionId}`
  and returns `{recipes,guidance,exercises,unresolvedDecisionIds}`. Each recipe
  entry has `recipe,variant,selectedBy,missingDecisionIds,missingAnswers,conflicts,
  warnings,eligible`; `selectedBy` is an array of `{decisionId,optionId}`.
  Exercise entries add the matching `validation`. This pure resolver is also
  exported from browser-safe `lib/workshop-resolver.mjs` (no Node imports).
  Eligibility is not completion. Unknown selections are unresolved.
- `parseContentLinkTarget(value)` and `resolveContentLinkTarget(value, profile)`
  share the inline-link template grammar and safe URL resolution with the
  browser renderer. Profile values are path-segment identifiers, not verified
  enterprise or organization identities.

## Planning links and human sign-off fingerprints

The source-location and
fingerprint helpers below are available to content tooling.

All `source` objects are `{file,line,endLine,anchor}` (1-based inclusive ranges,
repository-relative file when loaded through the repository API). Stage links
are exactly `content/<block-id>.md#understand`, `#decisions`, `#configure`,
`#validation`. Entry anchors follow lowercased heading text with punctuation
removed, e.g. `### Recipe: example-notes` -> `#recipe-example-notes`.
Repeated ordinary subsection headings receive numeric suffixes (`#steps-1`).
Use stage anchors for stable planning links; no source paths are auto-published.

`stageSource(block, stage, catalog) -> {...source, fingerprint}` returns a
`sha256:<hex>` fingerprint. Sign-offs store that exact string; a mismatch means
re-review, not auto-revocation or approval. It hashes normalized stage source,
block header metadata, and the complete metadata of all policies referenced by
the block (sorted/key-stable). Thus any referenced policy change conservatively
stales all four stages, but unrelated catalog entries do not.
Configure and Validation also include answer-to-recipe linkage; Validation
includes recipe identity/prerequisite/target metadata. Understand prose edits
affect only Understand; validation prose edits affect only Validation.
Line shifts do not stale an otherwise unchanged stage. Pass the same validated
catalog used for loading; omitting it intentionally excludes policy metadata.
The fingerprint does not grant approval, verify an identity, or modify records.

## Common repairs

- `E_RECIPE_REF`: fix the ID in **Configure**, not a display label. The hint
  lists available local recipe IDs.
- `E_POLICY_REF`: use a runtime JSON catalog ID, not a planning CSV row ID.
- `E_CATALOG_REF`: use a planning CSV row ID in **Catalog IDs**, not a runtime
  JSON ID; the hint suggests the closest ID and lists the block's rows.
- `E_CATALOG_REMOVED`: drop the removed row, or restore it in the CSV.
- `E_VALIDATION_MISSING`: add the matching `### Exercise: ID` under Validation.
- `E_FIELD` / `E_SECTION`: fix spelling/case or remove unsupported structure;
  report unmapped draft material in chat. Do not create migration or author-note
  files unless explicitly requested; never silently ignore a field.
- `E_STAGES`: restore the four exact stage headings in order.
- `E_METADATA_POSITION`: move metadata directly below its owning heading.

## Runtime, migration and saved progress

The governance loader calls `loadWorkshopContent()` and rejects every diagnostic
before exposing `{manifest, paths: blocks, policies}`. There is no `path.lab`,
editable block JSON, or separate active Understand file. Active blocks are
never hidden by authoring status or sign-off. Scenario files remain supporting
drafts, served through an explicit server-side allowlist.
The old extension-local `validateContent()` export is retired; use the shared
parser/validators for author tooling and `loadContent()` for the runtime.

Mechanical conversion retained existing decision/option/exercise IDs.
The later display-order renumbering maps earlier Context, Observability and Agent Governance decision IDs using saved option signatures, not the numeric ID alone. See the `*SequentialDecisionIds` migration maps in `.github/extensions/governance-lab/state.mjs` for the mapping. Exercise IDs remain stable; changed fingerprints retain prior evidence and Done markers as history rather than current completion.
The frozen `tests/content-validation/fixtures/legacy-v8/content.json` is only a
migration regression input, never an active source or an authoring mirror.
Historical Access Management and Billing Markdown fixtures in the same
fixtures directory exercise saved-progress reconciliation.

`exerciseFingerprint(block, recipe, catalog)` hashes the exercise, matching
validation, relevant decision definitions, and referenced policy metadata,
excluding source locations. The loader adds its `sha256:<hex>` result to each
exercise recipe as `fingerprint`. Understand-only edits do not invalidate
exercise evidence. Relevant decision, instruction, target/form, validation or
policy changes do. The retired exercise-kind metadata is excluded from the
current recipe model; fingerprints retain compatibility with version-11
inspection records so removing that field alone does not reset their progress.

Saved state version **11** is `{version, revision, schema, paths, history,
checklist, profile}`. `paths[blockId]` is `{decisions, exercises}`. Exercise
records are keyed by stable exercise ID, with `mode`, `settingsUrl`,
`configuration`, `verified`, `evidence`, `issues`, `followUp`, `fields`,
`evidenceFields`, and `basis`. `profile` contains optional
`enterpriseSlug` and `organizationSlug` strings; both are blank by default,
validated as bounded path-segment identifiers, and are not checked against
GitHub. The canvas uses them only to personalize authored content links and explicitly marked shell commands.
The optional `repositoryName` string personalizes links only, permits 1–100 letters, digits, dots, underscores and hyphens except `.` and `..`, and defaults to `pets-workshop` when absent. Blank names use authored fallbacks. Older two-field profiles remain valid and need no disk rewrite; saves omitting the repository field preserve an existing name. Credentials and local filesystem paths are not part of this profile.
`fields` is configuration input; `evidenceFields` is validation input. `schema`
is an identity/shape snapshot used to reject corrupt records and safely retain
removed content. `basis` ties evidence to the current source and relevant
answers. `history` preserves earlier records and invalidated/inactive work;
it never contributes to current completion.
Version-11 schemas from the former contract may include the retired `kind`
property with its historical value. The reader accepts either schema shape,
while subsequent writes use the kind-free shape; unchanged inspection
fingerprints preserve existing records, and records with changed fingerprints
follow the normal historical-archive path.

Known v1–v8 shapes pass a frozen **read-only** legacy decoder. Version 9
precedes the separate checklist; version 10 includes the checklist but not the
profile. Reading either known shape migrates in memory, with a blank profile,
and does not write the file. The next successful mutation persists version 11.
Resetting decisions and exercise progress preserves the enterprise profile.
The JSON and Markdown participant exports omit profile values; other export
content is not secret-redacted. Earlier work maps
to a current exercise only when its identity and immutable mechanically
converted fingerprint match, and current prerequisites/evidence remain valid.
Changed semantics sharing an old ID are historical only. Unknown/corrupt shapes
fail with recovery guidance; reads do not rewrite files. Successful saves retain
revision checks and atomic writes. Guidance and zero-exercise selections never
produce configuration or verification completion.

The HTTP progress request and `update_progress` canvas action share:

```js
{
  contentVersion, // content.version from bootstrap/reload or get_progress
  revision, pathId,
  decisionId, // explicit ID for decide; otherwise null
  exerciseId, // explicit ID for configure/verify; otherwise null
  operation, // decide | configure | verify
  value
}
```

For `decide`, value is an option ID. For `configure`, it is exactly
`{mode,settingsUrl,configuration,issues,followUp,fields}`. For `verify`, it is
exactly `{verified,evidence,issues,followUp,evidenceFields}`. Unknown properties,
inactive exercises, invalid targets, unsupported field values, stale
revisions and a `contentVersion` other than the active content's fail. Proposal/fallback records cannot claim live completion.

The token-protected `POST /api/profile` route accepts exactly
`{contentVersion, revision, profile}`. It uses the same active-content version,
revision check, state validation, serialized writes, and atomic persistence as
other participant state. It stores no credentials and does not inspect or
configure GitHub. Profile values are omitted from the progress action output and
participant exports.

The token-protected `POST /api/profile/discover` route accepts an empty JSON
object and returns `{account, source, organizations, enterprises}`. `account`
is the detected login or `null`; `source` is `stored` (the active
`gh auth login` account, preferred over `GH_TOKEN`/`GITHUB_TOKEN`) or
`environment` (fallback when no stored login exists). Each list is
`{items, error?}` with `items` as `{slug, name}`. It runs only on an explicit participant request,
uses the participant's local `gh` authentication for fixed read-only queries,
and writes nothing. Missing `gh`, missing sign-in, token-scope failures, and
timeouts are reported per list; manual entry remains available.

The shared model's `summary(content,state)` returns blocks with `decisions`,
`guidance[]`, `exercises[]`, and `inactiveExerciseIds`, not one shared lab.
Inactive IDs represent unselected exercises with retained participant input,
notes, status changes, or explicitly identified historical records. Untouched
schema defaults are not presented as inactive participant work.
UI, native actions, Markdown and JSON exports use the same resolver and
per-exercise aggregation. Routes remain `?path=<id>&stage=configure|verify`,
with optional `&exercise=<exercise-id>` to select an applicable exercise.
Without exercises, Configure and Validation explicitly state that no action
is claimed and allow navigation to continue.

CI runs the standalone validator before browser setup. Runtime loading is an
additional safeguard, never a prerequisite for authoring validation.
