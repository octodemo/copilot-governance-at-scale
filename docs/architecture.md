# Architecture

This document explains how the Copilot governance lab is structured and why.
Exact grammar lives in [CONTENT-FORMAT.md](CONTENT-FORMAT.md); the code is the reference for everything else.
This is not a content-approval or release report: all workshop prose, including User Governance, remains unvetted draft material until explicit human review.

## Shape of the lab

One participant canvas, `governance-lab`, walks participants through six use-case blocks.
Each block has four stages:

- **Understand**: a high-level view of the topic and its trade-offs.
- **Decisions** (shown as Decide): what the enterprise needs, then which policies or settings help.
- **Configure**: a step-by-step walkthrough of the settings tied to those decisions, plus evergreen `Additional steps`.
- **Validation** (shown as Verify): seeing configured policies in action.

Participants record their own answers, Done markers, and notes.
The canvas shows guidance; participants perform every administrative change themselves.

## Sources

| Location | Responsibility |
| --- | --- |
| `content/<block-id>.md` | The single editable source for one block's four stages |
| `content/manifest.json` | Block identity, order, and Markdown discovery |
| `content/policy-catalog.json` | Shared policy metadata and official references used by recipes |
| `content/policy-catalog.csv` | Policy coverage catalog; blocks trace to it with `**Catalog IDs:**` |
| `lib/workshop-content.mjs` | Neutral Markdown parser, schemas, diagnostics, fingerprints |
| `lib/workshop-resolver.mjs` | Browser-safe mapping from selected answers to recipes |
| `scripts/validate-content.mjs` | Offline validation CLI, also used in CI |
| `.github/extensions/governance-lab/` | Canvas: content adapter, local server, state, UI |

Policy prose is not duplicated per policy.
Block recipes reference shared policy IDs from `policy-catalog.json`.

## One contract, two consumers

```text
block Markdown + manifest + policy metadata
                    |
         lib/workshop-content.mjs
                    |
        +-----------+-----------+
        |                       |
  validation CLI         canvas content adapter
  (diagnostics, exit code)      |
                         shared recipe resolver
                                |
                  UI / actions / progress / exports
```

The parser has no dependency on the extension SDK, server, browser, participant state, or network, so the CLI runs with Node alone.
Content with diagnostics is never rendered as a partial model.
Errors carry file, line, a stable code, the affected section or ID, and a repair hint.
Schema validity says nothing about product truth.

## Decisions, recipes, and exercises

- Block, decision, answer, recipe, exercise, and policy IDs are stable contracts.
  Changing a label never changes identity.
- An answer references zero or more recipes local to its block.
  Configure deduplicates the applicable recipes and keeps authored order.
- **Guidance** is informational and has no completion state.
- An **exercise** has a stable ID and a matching Validation definition.
  Blocks may have zero, one, or several.
- Unresolved choices stay unresolved.
  Missing requirements never become implicit permission to configure.
- All surfaces use the same resolver and aggregation rules.

## Participant state

State is separate from authored content.
Content is loaded from the checkout; progress is stored per document ID in the user's Copilot home, outside the repository.

- Every write goes through the validated state layer with a revision check and atomic file replacement.
- A stale content version or revision fails explicitly instead of overwriting work.
- Known older records are migrated explicitly.
  Records whose meaning changed are kept as historical and never count as completion of new content.
  Corrupt or unknown records are rejected with recovery guidance, never silently reset.
- Forms autosave without re-rendering inputs; failed saves keep the input and show an error.
- An optional enterprise profile personalizes links and commands.
  It is omitted from exports.
- Exports (Markdown and JSON) label outcomes as participant-reported.
  They are not secret-redacted, so review them before sharing.

## Runtime and safety

- The local server binds to loopback only and checks the host on every request.
  Origin and per-instance token checks apply only to routes registered with `auth: "token"`; the HTML and static assets do not require the token, and the default route mode is `"none"`.
  Register every route that reads or changes state with `auth: "token"` rather than assuming authentication is global.
  Bodies are bounded and a CSP applies.
  Output is escaped and static paths are bounded.
- Shell blocks run only when the participant clicks **Open terminal and run**.
  Rendering never executes anything, and the server accepts only command templates that exist in the loaded content.
- The canvas is not an administrative API executor and stores no credentials.
  Commands, proposed changes, and exported notes are guidance, not authorization.
  Consequential writes need explicit confirmation of target, scope, and consequences.
- Developer tools default off. Only an explicit user request to the agent warrants reopening the same canvas instance and participant document with `dev: true`; `dev: false` or an omitted `dev` disables them. This is an agent-facing instruction, not a server-enforced proof of consent.
- Dev mode adds Reload (revalidate content, keep progress), Reset (back up and clear progress), named state snapshots, section picking, and all-variants review. Participant mode hides these controls and rejects developer HTTP operations. Reopening preserves saved progress, not unsaved page drafts or pending request batches.
  Runtime code changes need an extension reload.

## Verification

Structural validity, browser tests, native in-app acceptance, product-fact verification, and human review are separate outcomes.

```sh
node scripts/validate-content.mjs
node --test tests/content-validation/*.test.mjs
node --test .github/extensions/governance-lab/*.test.mjs
npm test --prefix tests/canvas-e2e
```
