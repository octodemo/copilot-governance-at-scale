# Lab content author reference

The normative schema and examples live in
[CONTENT-FORMAT.md](../../../docs/CONTENT-FORMAT.md) and
[the block template](../../../docs/templates/workshop-block.md). The executable
contract is `lib/workshop-content.mjs`; selection resolution is shared with
browser-safe `lib/workshop-resolver.mjs`. Do not maintain a second grammar here.

## Choose the correct source

| Task | Source |
| --- | --- |
| Change a block's introduction, question, option, recipe, or validation | `content/<block-id>.md` |
| Change shared policy facts/references | `content/policy-catalog.json`, with opened official evidence |
| Add or reorder active blocks | `content/manifest.json`, following the approved six-block scope |
| Edit planning coverage/classification | `content/policy-catalog.csv` |
| Trace a Decision, Recipe, or Additional steps card to planning rows | `**Catalog IDs:**` in `content/<block-id>.md` (CSV row IDs or `none`) |
| Report unresolved draft material | Chat summary; create migration or author-note files only when explicitly requested |

The CSV and runtime JSON are different datasets; do not infer IDs or regenerate
one from the other. Scenarios and notes do not override active Markdown.

## Start from the template

The template demonstrates guidance-only, exercise, mixed, no-action, and
shared-recipe cases. Its policy ID belongs to a synthetic fixture catalog:
replace it with real runtime policy references before activation. It is not
verified workshop content.

Use exactly the four stage headings in one file. Keep metadata below its owning
heading, prose as Markdown, and explicit IDs stable. Consult the specification
for required fields, fenced examples, safe links, and supported forms/datasets.
Do not copy placeholder product advice into the workshop.

## Independent validation

```sh
node scripts/validate-content.mjs
node scripts/validate-content.mjs --file content/user-governance.md
node scripts/validate-content.mjs --root tests/content-validation/fixtures/content-format/valid
node --test tests/content-validation/content-format.test.mjs
```

The CLI is read-only and offline. It does not load a canvas/SDK or participant
state. Full mode checks all active sources and cross-block identities.
Single-file mode validates that file and the whole shared policy catalog,
without requiring manifest membership or checking other blocks. Use full mode
before integration.

Exit codes: **0** valid; **1** invalid content/schema/JSON; **2** invocation/read
failure. Diagnostics include repository-relative file, 1-based line, code,
section/ID, and repair hint. JSON schema diagnostics can identify line 1 plus
the affected ID; consult the reported section rather than guessing.

## Catalog coverage report

```sh
node scripts/catalog-coverage.mjs
```

Read-only and offline. For each active block it lists the active CSV rows
assigned to that block and whether content traces them as **configured**,
**decision only**, or **not yet**. Rows whose `notes` start with
`Not applicable in the lab:` are labeled so. The report always exits 0 when it
can read the files: gaps are planning notes during drafting, not errors.
Coverage is traceability, not proof that the guidance is correct or approved.

## Repair pointers

These examples reference current validator codes; the specification remains
the complete source of truth.

| Diagnostic | Repair |
| --- | --- |
| `E_RECIPE_REF` | Correct the answer's Configure ID to a declared local recipe; changing a label is not a repair |
| `E_POLICY_REF` | Use an existing runtime JSON policy ID, not a similarly named planning row |
| `E_VALIDATION_MISSING` | Add the matching exercise definition under Validation; do not invent product steps to satisfy it |
| `E_STAGES` | Restore the four exact headings in order; do not split the file |
| `E_METADATA_POSITION` | Put metadata immediately below its owner, before prose |
| `E_FIELD` / `E_SECTION` | Correct spelling/case or remove unsupported structure; report unmapped draft material in chat, and do not create migration or author-note files unless explicitly requested |

Fix the cause, rerun, and inspect all independently reported errors. Do not
silently drop unknown fields, change IDs, or treat a parser success as content
review.

## Source locations and human review

Block source anchors remain:

```text
content/<block-id>.md#understand
content/<block-id>.md#decisions
content/<block-id>.md#configure
content/<block-id>.md#validation
```

Use `stageSource(block, stage, catalog)` for locations and the exact
`sha256:<hex>` fingerprint. Always pass the validated shared catalog so policy
metadata participates. The format documents which source changes invalidate
each fingerprint.

The fingerprint is not approval or identity authentication. Record sign-off only
after explicit human reviewed-and-approved attestation. Changed fingerprints
mean re-review, not automatic approval. Author readiness does not change
participant content availability, progress, or exports.

## Completion checklist

- Open and cite official sources for changed product claims; mark uncertainty.
- Preserve human draft intent and explicitly report unmapped material.
- Check answer → local recipe → shared policy references.
- Check each stage does its job: Understand introduces the topic and trade-offs;
  Decisions connect enterprise needs to choices; Configure presents selected
  guidance and exercise recipes; Validation defines checks for exercises only.
- Keep wording simple and human. Fix typos and grammar without rephrasing.
- Run the coverage report and list remaining gaps gently.
- Keep participant decision choices substantive and resolved.
- Give every exercise matching validation with bounded expected results.
- Preserve stable IDs and assess saved-progress implications.
- Run full standalone validation and relevant tests; preview changed rendering.
- Request human review separately; never approve content on an agent's behalf.
