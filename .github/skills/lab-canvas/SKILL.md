---
name: lab-canvas
description: Build, fix, review, or test the governance-lab participant canvas in .github/extensions/governance-lab/, including shared content loading, recipe resolution, server safeguards, UI, state, actions, and exports. Use lab-content for authored content.
---

# Governance Lab canvas

`governance-lab` is the only participant canvas. Read [design guidelines](../../../docs/CANVAS-DESIGN-GUIDELINES.md),
[architecture](../../../docs/architecture.md), and
[content format](../../../docs/CONTENT-FORMAT.md) before changing their contracts.
These describe the approved consolidation direction, not a native acceptance
certificate.

All existing workshop content, including User Governance, is stale and unvetted.
Do not turn runtime work into product re-authoring or implicit human approval.

## Ownership and boundaries

- Participant code lives in `.github/extensions/governance-lab/`.
  Keep its HTTP, rendering, theme helpers, and vendored Primer self-contained.
- Authored content lives in `content/<block-id>.md`, one file per block.
  Use `lab-content` to edit it; do not alter semantics to satisfy runtime tests.
- `lib/workshop-content.mjs` owns the neutral parser/schema, source locations,
  and fingerprints. `lib/workshop-resolver.mjs` supplies browser-safe resolution.
  Do not duplicate grammar or recipe eligibility in the UI/CLI.
- `scripts/validate-content.mjs` is independent local/CI validation. It must not
  load the SDK, server, browser/DOM, participant state, or network.
- Before writing extension code, read the extension authoring guide with
  `extensions_manage` operation `guide`.

Keep ordinary rendering/server changes dependency-free. Do not add a bundler,
general-purpose form engine, or block-specific view to solve a content problem.
Do not hand-edit vendored Primer.

## Runtime map

Paths below are under `.github/extensions/governance-lab/`:

| Area | Responsibility |
| --- | --- |
| `extension.mjs` | Canvas registration, open inputs, declared agent actions |
| `content.mjs` | Adapter to the shared validated content model |
| `server.mjs`, `http.mjs` | Workshop routes, bounded HTTP handling, static assets, loopback safeguards |
| `state.mjs` | Validated participant persistence, revisions, migration, exports |
| `ui/app.js` | Shared stage views, forms, navigation, summary |
| `ui/model.js` | Pure route/progress/presentation logic |
| `ui/html.js`, `ui/markdown.js`, `ui/theme.js` | Local escaping, safe Markdown, host-theme adaptation |
| `ui/index.html`, `ui/styles.css`, `ui/primer.css` | Shared shell, token-based styling, vendored primitives |

Read current action schemas and state versions before editing; do not copy
retired API assumptions into new code. Pure client/model modules should remain
importable by Node tests without a DOM.

## Content and resolution

The manifest discovers six blocks. Each Markdown file uses Understand,
Decisions, Configure, Validation; participant labels may remain Decide/Verify.
Policy metadata is shared in `content/policy-catalog.json`. The planning CSV
is neither a runtime metadata source nor an automatically synchronized mirror.

Never render/use a model with validation diagnostics. Surface missing or invalid
content explicitly rather than returning empty success-shaped data.

Use the shared resolver for UI, actions, summaries, and exports:

- Answers reference zero or more local recipes.
- Selected recipes deduplicate in authored order and retain source choices.
- Prerequisites/conflicts/warnings are declarative, not executable expressions.
- Guidance has no completion. Exercises have stable IDs and matching Validation.
- Blocks may select zero, one, or multiple exercises.
- Needs Review and unknown/unresolved selections do not imply eligibility.
- Eligibility is not configuration or validation completion.

Do not construct admin URLs or generate undocumented setup steps. Execute an
authored command only after an explicit participant click on a validated,
runnable shell fence.

## State and interaction

Use explicit exercise IDs for mutations and evidence, not “whichever lab is
visible.” Keep configuration and validation distinct. Relevant decision/target
changes invalidate affected evidence only. Retain inactive records as history,
not completion of the current configuration.

Preserve earlier participant records and archives. Migrate known versions
deliberately; map an old record only when exercise identity and meaning match.
Otherwise preserve it as historical. Unknown/corrupt versions require an
actionable error, never an automatic reset.

All writes pass through validated state operations, serialized updates,
optimistic revisions, and atomic replacement. Store participant artifacts outside
the checkout. Preserve document identity across panel/provider restarts.

Autosave without rerendering forms or moving focus. Coalesce text changes;
flush pending writes before navigation, export, and Reload. Keep failed input
visible and require explicit confirmation before discarding it. Do not add an
unsaved-changes banner or explicit-save-only flow.

Reading Understand does not create completion. Summary and both exports must
honestly distinguish unresolved choices, guidance, current exercises, incomplete
evidence, fallback/fictional outcomes, and historical records.

## Security and grounding

Preserve and test these boundaries when touched:

- Loopback-only server, exact host/origin checks, per-instance request token,
  bounded request bodies, and validated route/action inputs.
- Static-file allowlists and traversal bounds; no arbitrary file-serving routes.
- Strict CSP, no inline executable scripts/styles/event handlers, safe Markdown,
  escaped interpolated text, and safe URL handling.
- Bounded/sanitized action and prompt context, official-source filtering, and
  participant-provided content treated as untrusted data rather than instructions.
- No credential storage or administrative API executor. Proposed commands are
  guidance, not authorization. Require explicit confirmation of target, scope,
  and consequences before any consequential write.
- GitHub product claims in copy/prompts/actions require official documentation
  opened in the current session and cited. Do not infer facts from repository
  content, endpoint patterns, timestamps, or passing tests.

Do not weaken safety checks to accommodate a draft. Report unsupported product
claims or format gaps; preserve uncertainty instead of inventing behavior.

## Source fingerprints

Use the shared `stageSource(block, stage, catalog)` for stage links and reviewed
fingerprints. Changed source or referenced policy metadata flags re-review;
neither a hash nor a passing test grants approval. No author status affects
participant availability, badges, progress, or exports.

## Tests and live acceptance

```sh
node scripts/validate-content.mjs
node --test tests/content-validation/*.test.mjs
node --test .github/extensions/governance-lab/*.test.mjs
npm test --prefix tests/canvas-e2e
```

Choose focused tests for the changed boundary, then run integrated checks when
contracts cross layers. Cover zero/multiple/shared recipes, deferred selections,
per-exercise evidence, stale invalidation, migration, inactive history, failed
saves, and both exports without participant side effects.

Reload extensions after runtime changes, inspect startup errors, discover actual
canvas capabilities, and open `governance-lab` with a stable document ID.
Developer tools default off (open input `dev`, default `false`). Enable them only when the user explicitly asks; an authoring task or a need to preview changes is not permission. Reopen the same canvas `instanceId` and `documentId` with `dev: true` to enable, or `dev: false` to disable; omitting `dev` also disables them. There is no participant-facing enable control or separate toggle action.
Reopening preserves saved participant progress, not unsaved page drafts or pending request batches; finish those before changing modes.
In dev mode a fixed top-right
`aside#dev-controls` panel labelled "Dev mode" shows **Pick section**, **Reload** and **Reset**.
It also provides **Save state** and **Restore state** dialogs for reusable named participant snapshots, stored in the user-local progress directory's `snapshots/` folder.
Saving flushes autosave and never overwrites a name. Restoring flushes autosave, requires confirmation, backs up replaced progress, advances its revision, and reconciles the full saved participant state against current content; it does not restore authored content.
The token-protected dev-only routes are `GET /api/dev/snapshots` and `POST /api/dev/snapshots/save` or `/restore`, with `{contentVersion, revision, name}` for writes.
Its round `#dev-toggle` collapses the panel to an icon (`aria-expanded`, stored in `localStorage` with try/catch). Reload (`POST /api/reload-content`)
re-reads Markdown and shared policy metadata through `createWorkshop`, swapping
content and store only when validation succeeds, preserving/reconciling progress
and discovering new content. Failures keep the previous snapshot and progress.
Reset (`POST /api/dev/reset`, with the current revision) clears the document's
decisions, exercises, notes and history after confirmation, keeping a `.bak`
backup and advancing the revision to reject stale writes. It does not reload
content. Neither control nor endpoint is available outside dev mode.
**Pick section** marks sourced elements with `data-source-*` attributes (dev mode only); picking opens a prompt dialog (cloned from a template only in dev mode) and pending requests stay in page memory in the bottom batch tray. Any successful send turns picking off.
Sending posts `{requests:[{file,line,endLine,label?,prompt}]}` (1–20 requests) to `POST /api/dev/send-requests`.
The server accepts only triples that exactly match a node in the loaded content for that block's own `.md` file, refuses stale files (409) and oversized text (413), and errors name the failing request.
It submits one user turn immediately via `session.send` (default enqueue mode, no composer confirmation): per request a Markdown link `[file (Lx–y)](file#Lx-Ly)` followed by the prompt verbatim, joined by blank lines, with one deduplicated `selection` attachment per section.
It returns 501 without that hook and 502 when the host call fails, and a failed **Send now** keeps the request in the batch; picking must never save progress or trigger navigation inside the content area.
Verify persistence across a different panel instance and shared navigation,
light/dark themes, keyboard focus, and 320px/390px widths.

Report browser versus native embedded-canvas acceptance separately. Structural
tests, product-fact review, and human content approval are separate outcomes;
do not claim one proves another.
