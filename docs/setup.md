# Workshop setup guide

For **GitHub Copilot at scale: An interactive lab for enterprise admins** at
GitHub Universe.

[Workshop overview](../README.md) |
[Facilitator guide](facilitator-guide.md) |
[Attendee instructions](../instructions/README.md)

Attending the workshop? Start with the
[attendee instructions](../instructions/README.md) for GitHub Copilot app setup
and the participant walkthrough. This guide covers author and facilitator
preparation.

## Scope and status

Use **`governance-lab`** for participants.
There is one workshop-content root, `content/`, and one active Markdown file
per block. The six blocks share Understand, Decisions, Configure, Validation;
Decide/Verify are the corresponding participant screen labels.

Structural validation and human content review are separate. **All current
workshop content, including User Governance, is stale and unvetted.**
Author status and sign-off do not gate participant availability.

## Prepare the delivery environment

### Required for the participant walkthrough

Use the [attendee prerequisites and Exercise 0](../instructions/README.md) as
the participant setup contract. Rehearse those exact steps rather than teaching
a different installation path.

The delivery environment needs:

- The GitHub Copilot app, Git, and a workshop account that can use the app and
  access the assigned repository.
- A local session for the workshop repository with its existing
  `governance-lab` canvas available.
- Approved sandbox targets and exercise-specific permissions for any live
  configuration or inspection.
- An approved location outside the repository for progress artifacts, exported
  records, and nonsensitive troubleshooting notes.

Use the [official app quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app)
for installation, sign-in, repository connection, and session creation.
Repository-scoped canvases are described in
[Working with canvas extensions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions).
Do not ask participants to create a new canvas.

### Additional tools for authors and facilitators

Use Node 24 for the repository's structural validator and maintained tests.
The browser test suite also needs its package dependencies and Chromium; install
them only if the selected check reports they are missing, using the commands
below. These validation tools are preparation tools, not extra steps in
attendee Exercise 0.

### Prepare a sandbox handoff

Before inviting participants to perform live tasks, agree the following with
the sandbox owner and distribute the necessary details through an approved
channel outside the repository:

| Item | Required detail |
| --- | --- |
| Target | Exact enterprise, organization, and any repository assigned to the participant |
| Identity and access | Which account to use and the access needed for the selected exercises |
| Authorization | Allowed inspections and changes, their scope, and explicit exclusions |
| Cost boundaries | Whether any action could create charges and which actions must not be performed |
| Recovery | Rollback instructions and a contact for access or configuration problems |
| Retention | Where notes and exports may be saved, shared, and retained |
| Fallback | An authored alternative, or discussion-only participation, when a prerequisite is unavailable |

This guide does not provision accounts or authorize administrative writes.
Do not put credentials or participant-specific target lists in tracked files.

## Rehearse Exercise 0

Run the preparation checks below before rehearsing changed workshop material.

1. Follow the [attendee instructions](../instructions/README.md) to connect the
   repository and start an Interactive session.
2. Open the existing participant canvas with a separate rehearsal record:

   ```text
   Open this repository's existing governance-lab canvas.
   Use documentId "facilitator-rehearsal" and dev false.
   Do not create or modify a canvas, edit repository files, or change
   GitHub settings. Report any loading error and stop.
   ```

3. Confirm the title is **Copilot Governance Workshop** and all six blocks are
   present.
4. Compare **Your Enterprise** and **Your Organization** with the approved
   rehearsal targets. When automatic detection fails, use **Configure
   enterprise profile** with the approved slugs. If the detected target is
   wrong, stop before following settings links and resolve it.
5. Work through a reviewed block, check that edits save, and inspect
   **Governance Summary**. Export Markdown and JSON, reviewing the contents
   before sharing or projecting them.
6. Reopen the canvas in the same session with the same document ID and confirm
   that the expected progress remains.

Use a separate record for demonstrations; never reset an attendee's record as
part of a rehearsal. Detection and saved profile values are not proof of
authorization or correct live configuration.

## Run preparation checks

Use Node 24. From the repository root:

```sh
node scripts/validate-content.mjs
```

The standalone command needs no SDK, running canvas, browser, session,
network, or generation step. Fix each diagnostic using its file/line, code,
section/ID, and hint. Exit 0 means structurally valid, 1 means invalid content,
and 2 means invocation/read failure; none means product approval.

For an authoring iteration:

```sh
node scripts/validate-content.mjs --file content/user-governance.md
```

Single-file mode checks that source and the whole shared policy catalog but
does not require manifest membership or check other blocks. Run the full command
before integration. See [the format](CONTENT-FORMAT.md) for `--root`, supported
Markdown, and [the template](templates/workshop-block.md).

Run relevant maintained suites:

```sh
node --test tests/content-validation/*.test.mjs
node --test .github/extensions/governance-lab/*.test.mjs
npm test --prefix tests/canvas-e2e
```

If the browser command reports missing dependencies or a missing Chromium
installation, restore only what is missing:

```sh
npm ci --prefix tests/canvas-e2e
npm exec --prefix tests/canvas-e2e -- playwright install chromium
```

Then rerun the failed command. Browser tests use the shared runtime but do not
prove native extension registration. Do not report an OS as verified solely
because a CI matrix contains it.

## Author workflow

1. Edit `content/<block-id>.md`; do not create editable JSON or separate
   introduction duplicates.
2. Resolve recipe policy references against `content/policy-catalog.json`.
   Open and cite official sources for changed product claims.
3. Run standalone validation and relevant tests. Preview is optional for
   structural correctness, but required for rendering/interaction changes.
   After Markdown or shared policy metadata edits, click **Reload content and
   progress** in `governance-lab`. Invalid edits show diagnostics and keep the
   previous content. Runtime code changes still need `extensions_reload`.
4. Human review is separate from catalog coverage. No agent
   or test may approve content.

## Preview and native acceptance

The browser preview is an author troubleshooting aid, not the attendee setup
path. It does not perform automatic lab-enterprise discovery. For a preview,
the maintained helper is:

```text
node tests/canvas-e2e/preview.mjs <absolute-artifact-directory-outside-repo>
```

Use an artifact directory outside the checkout. A temporary directory is
appropriate for disposable checks; use a persistent directory when retaining
participant progress. Open the printed loopback URL, verify readiness, and stop
the helper after checking. This preview does not exercise native SDK registration.

After runtime edits, reload project extensions and inspect startup errors.
Discover the declared capabilities before opening/calling canvas actions.
Verify the `governance-lab` canvas ID is present and no retired participant canvas remains.
Use a stable participant `documentId` when checking persistence; a new panel
instance should not create a new document.

Native acceptance should cover:

- All six blocks and the four stage transitions, including Understand without
  a saved completion record.
- Resolved, deferred, guidance-only, no-action, and shared-recipe selections.
  Test multiple exercises with an appropriate fixture if the draft content
  does not select several.
- Separate exercise configuration and validation; relevant decision/target
  changes; inactive/historical records; proposal, blocked, and prepared outcomes.
- Reload/restart, stale and failed saves, preserved input, Summary, Markdown
  export, and JSON export.
- Light/dark themes, keyboard operation, narrow layouts, and reachable controls.

Do not grant real author approval as a test.
Record the
actual action schemas and migration versions from the integrated runtime, not
from retired documentation.

## Saving and recovery

Participant form edits autosave. Navigation, exports, and Reload must flush
pending writes. Failed saves retain input with a visible error; Reload asks
before discarding failed edits. There is no explicit-save-only workflow or
unsaved-changes banner.

For stale revisions, preserve nonsensitive draft text, reload the current
document, reconcile, and retry. Do not replace corrupt state with empty progress.
Keep participant artifacts outside the checkout and use another document ID
for a separate workshop attempt. Never delete prior records without authorization.

The participant canvas stores answers, profile, checklist markers, evidence, notes, and history in `$COPILOT_HOME/extensions/governance-lab/artifacts/files/governance-workshop/<documentId>.json`, with `COPILOT_HOME` defaulting to `~/.copilot`.
This is user-local storage independent of agent sessions and worktrees; reopening without a document ID resumes `default`.
Authored content remains in the repository's `content/` files and is reloaded when the provider starts.
If no durable document exists, opening imports validated progress for that ID from the current session's old artifact folder and leaves the original untouched. It does not search or merge other sessions; an existing durable document is never overwritten by an import.
Files use owner-only permissions. Concurrent providers share a per-document disk lock and stale saves are rejected.
If an error reports an abandoned `<documentId>.json.lock` directory after a crash, close every workshop canvas/provider before removing that exact empty lock directory and reopening. Preserve the JSON and `.bak` files.

To keep a reusable demo path, click **Save state** in the dev tools and enter a name such as `Access demo`.
Later, click **Restore state**, select the name, and confirm. This restores the entire workshop's participant state, including profile and all blocks, not only the visible path. Unsaved edits must save successfully first.
The replaced state is backed up automatically. Named states remain available after Reset, reopening, or a new agent session, and can be applied repeatedly or to another document ID.
Names are never overwritten; use another name for a revised snapshot.
Snapshots live in the progress directory's `snapshots/` folder and do not contain authored content. Changed content still invalidates affected completion through the normal reconciliation rules.

## Sandbox and facilitator preparation

Review the selected block's Markdown, its policy references, and supporting
scenario before assigning a live task. Provide the exact approved target,
necessary access, allowed operations, change boundaries, and rollback plan
outside the repository. Do not assume draft prerequisites are complete.

The canvas records participant reports; it does not provision accounts, perform
administrative changes, or supply credentials. Confirm consequential changes
explicitly. Never enable spending or weaken safeguards merely to complete a
workshop. Do not paste sensitive URLs, credentials, or real confidential data
into evidence or exports.

If live access is unavailable, use an authored prepared/proposal alternative
and record the limitation without claiming live completion. If the canvas
cannot load, use the block Markdown as a discussion worksheet and keep notes
outside the checkout. Fictional data remains fictional evidence.

Before sharing the workshop, review content and artifacts for sensitive data,
complete human review, and record remaining gaps. Setup instructions do not
change repository visibility, permissions, or administrative policies.

## Delivery readiness checklist

Record the outcome and unresolved gaps for each check in the delivery
preparation record. One passing category must not stand in for another.

| Check | Evidence to retain |
| --- | --- |
| Structural validity | Validator result for the selected repository revision |
| Automated coverage | Relevant maintained test results and any untested areas |
| Native app acceptance | Actual app environment and the exercised open, save, resume, and export flow |
| Product-fact verification | Official sources reviewed for the selected procedures and any discrepancies |
| Human content approval | Explicit reviewer attestation for the material being delivered |
| Sandbox readiness | Confirmed targets, access, authorization, rollback, and support owner |
| Participant readiness | Exercise 0 completed or a clearly communicated discussion-only fallback |

Do not advertise live exercises that have unresolved access, safety, or content
review blockers. Move to the [facilitator guide](facilitator-guide.md) for the
run of show and handling interruptions.

## Setup troubleshooting

| Problem | Next action |
| --- | --- |
| App sign-in or repository connection fails | Check the [official quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app) and the assigned account's access. Escalate policy questions to the administrator. |
| Participant canvas is missing | Confirm the session's repository contains `.github/extensions/governance-lab/`. Inspect the reported extension loading error rather than generating a replacement. |
| Structural validation fails | Fix the reported source location using its diagnostic code and repair hint, then rerun the validator. Do not weaken the contract. |
| Browser tests report missing dependencies | Restore only the missing dependencies with the commands above, then rerun the failed check. |
| Automatic lab detection fails | Enter approved target slugs manually when offered. Do not guess targets or treat discovery as permission. |
| Progress cannot be saved | Preserve nonsensitive input, investigate the visible error, and reconcile stale revisions. Never delete or silently replace progress to clear the error. |
| An exercise cannot be safely rehearsed | Keep it out of live delivery until the blocker is resolved, or use its authored alternative without claiming live validation. |
