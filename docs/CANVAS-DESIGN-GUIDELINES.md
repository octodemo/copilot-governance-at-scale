# Governance Lab design guidelines

Read this before changing `.github/extensions/governance-lab/` or its workshop
content. Keep one participant canvas and the existing shared visual shell.
User Governance can be a visual comparison, never a content-quality standard:
**all current blocks are stale, unvetted drafts**.

These are approved design requirements, not a claim of completed acceptance.
See [architecture](architecture.md) and [content format](CONTENT-FORMAT.md).

## Shared layout and components

All runtime paths below are under `.github/extensions/governance-lab/`.

| Surface | Reuse |
| --- | --- |
| Shell | `ui/index.html`, `ui/styles.css`: responsive shell up to 1120px, reading column up to 800px, two-column journey grid on wide screens |
| Theme and primitives | Local vendored Primer, theme helper, token-based controls, focus states and notices |
| Understand and choices | Shared safe Markdown rendering and `ui/app.js` decision cards |
| Configure and Validation | Shared recipe/exercise forms, ordered steps and expected results (no participation, status or notes controls) |
| Advanced guidance | Authored expandable details, closed initially; no automatic policy-catalogue panel |
| Navigation | `ui/model.js` route/resume model, four-stage navigation, within-stage item browsers and fixed Back/Next bar |
| Summary and exports | Shared resolution/aggregation, Markdown and JSON output |

Do not introduce block-specific canvases, views, or styling. Keep validated
content labels separate from shared interaction logic. Escape dynamic text;
do not add inline scripts/styles, raw HTML execution, or external assets.

## Content architecture

Use one `content/<block-id>.md` with **Understand, Decisions, Configure,
Validation** headings. The participant screens may retain Decide/Verify labels.
The manifest discovers sources; `content/policy-catalog.json` supplies shared
metadata. The Markdown format and template, not any existing block, define
the schema.

Decisions link answers to local guidance and/or exercise recipes. Show selected
recipes once, in authored order, with their source decisions retained.
Support no-action and guidance-only choices as well as one or multiple exercises.
Do not impose fixed decision/answer counts beyond the format's explicit rules,
or revive a one-exercise-per-block constraint.

Each exercise has its own Validation definition. Needs Review and
unmet prerequisites stay unresolved; guidance never counts as completion.
Do not invent scenarios, trade-offs, setup steps, or warnings to fill draft gaps.
Preserve human-authored wording during migration except explicit corrections.
Report conflicting/duplicate material for review rather than silently merging it.

Keep participant copy concise and move advanced detail into expandable guidance.
Keep API availability metadata in the content model, but do not surface availability indicators in the participant canvas. Reference sections show documentation links without API-state badges.
Render Decide's guidance as standard Markdown without an added heading
or colored callout. Render GitHub Markdown alerts for
NOTE, TIP, IMPORTANT, WARNING, and CAUTION with distinct semantic styling.
Do not repeat a global local-progress/safety footer or a **Guidance only** label
on participant cards or summaries. Preserve guidance/exercise semantics and
context-specific safety instructions; omitting a label never grants completion.
Consecutive guidance recipes selected by the same answers share one Configure
card, with a subheading for each recipe and one decision summary. Recipe IDs,
eligibility, and exports remain independent. Fenced code uses GitHub-style
scrollable blocks, preserves language labels, and highlights JSON locally.
The renderer supports the safe Markdown subset in the content format, plus
GitHub Markdown alerts for NOTE, TIP, IMPORTANT, WARNING, and CAUTION; raw HTML
remains escaped.
Open official sources for substantive product claims and cite them. Label
fictional datasets and prepared examples explicitly. Billing owns financial
reporting; Observability owns adoption, activity, and engineering-impact questions.

## Interaction and persistence

Repository links use an editable **Repository name** in the profile panel, defaulting to `pets-workshop`. The header includes **Your Repository** alongside the account labels. Keep the profile button available after successful detection so participants can change the repository. Older profiles without a repository name remain valid and use the default; a blank name disables repository-specific links or uses their authored fallback. Detection changes account identifiers only and preserves the chosen repository.

Account labels use the Octicons globe, organization, and repo icons, with muted captions and stronger account identifiers. Keep icons decorative and preserve accessible link text, loading states, and responsive wrapping.

Block overview actions use the shared Primer button styling: **Start** until a
block has a saved answer, then **Resume**. Reading an introduction alone does not
change the action label. Start uses primary green; Resume uses muted amber.
Two compact progress columns show decisions answered and personal configuration
steps marked Done. Do not label personal task markers as applied settings or
exercise validation; no selected steps is zero progress, not completion.
The shared header shows a small, unboxed lab-account row on every stage, with **Your Enterprise**, **Your Organization**, and **Your Repository** as GitHub-style rounded labels on one line when space permits, wrapping on narrow screens. Each configured label, including its caption and identifier, is a single link. Use muted, 12px text, a subtle neutral fill and thin border, and visible keyboard focus; do not add an enclosing banner background or border. When either account value is missing, first check the local GitHub CLI sign-in with stored credentials. If it is signed out or lacks the `admin:enterprise` and `admin:org` scopes, show **Sign-in required** and a sign-in region with a green **Log into CLI** primary button that opens the workshop terminal with `gh auth login` (or a green **Grant admin scopes** button running `gh auth refresh`, plus **Use a different account**, when only scopes are missing). Also offer **Log into CLI** when the status check fails or detection finds no lab enterprise for the signed-in account; poll the sign-in status and continue automatically once it is ready. When signed in, show **Loading...** in a noninteractive label for missing values and automatically discover the enterprise, organization, and repository. Exactly one enterprise matching `ghuniverse1874-<suffix>` supplies the enterprise slug; the organization uses the same slug without listing organizations; the repository is `pets-workshop` when present, else the only repository. A custom repository is never overwritten. Preserve existing complete profiles and do not overwrite conflicting partial profiles. No match, multiple matches, discovery errors, or save failures reveal an explanation. Show the sign-in region and profile buttons only on the blocks overview, in one row beneath the account labels with **Log into CLI** (or **Grant admin scopes**) before **Configure enterprise profile**; block stages show only the account labels and any detection message. Hide **Configure enterprise profile** during discovery, then show it for both complete profiles and failed discovery so participants can edit their repository.
The profile button opens a modal side panel (native `dialog`, right-aligned, full width at narrow sizes) with enterprise, organization, and repository fields, without changing the current stage. Escape, the close button, and the backdrop close it after flushing autosave; focus returns to the trigger. A failed save keeps the panel open with the error inside it. Clear the detection warning as soon as both account identifiers are successfully saved, including manual entry; incomplete or unsaved values do not dismiss it. The panel retains the explicit **Detect enterprises and organizations** action and manual entry. Automatically detected profiles use the same revision-checked persistence as manual values. Profile changes update authored links without replacing active forms or moving focus. The profile personalizes authored links and explicitly marked account-based commands; it does not configure GitHub or enter participant exports.

Understand is a separate authored introduction. Reading it or selecting Start
decisions must not create completion. Decide and Configure share a bordered
panel with a muted numbered header, consistent heading scale and body spacing,
and matching numbered browser rows. Keep the configuration action in its header.
Show one decision card at a time, with a question browser for direct navigation
and a simple `n / total answered` progress label without review or unanswered counts. Keep each stage's
aggregate counts and a compact progress bar below its browser list, not repeated
in the shell or card. Decide's bar counts resolved Answered choices, excluding
Needs review; Configure's bar counts personal Done markers, not applied settings.
Both update in place without replacing the active form. The
bottom navigation shows item position. A shared navigation bar groups the
**Back to blocks** button, the current block title, and the **Governance Summary**
button. Summary is a temporary page: **Return to workshop** restores the previous
question or configuration/validation step, scroll position, and focus, including
after a Summary reload. Direct Summary links without a return location offer
Back to blocks. Navigation flushes edits and remains blocked after failed saves.
Resolved Answered sidebar statuses use the same green checkmark as Done
configuration steps; Needs review and Unanswered never get a success check.
Routine saves do not announce global totals or state revisions.
Verify uses the same numbered card header and Mark as done/Undo action as Configure, with no generic Verification evidence panel. Done is a personal checklist marker, persisted independently under `verify:<exercise-id>`, not evidence-backed verification. Only recipe eligibility gates the marker; a confirmed target URL, configuration record, and written evidence are not required. Keep existing evidence-backed records and their stricter validation intact for history, actions, and exports. Show configuration and verification checklists separately in summaries and exports, and update the header and sidebar in place.
When Verify has authored introductory text and selected exercises, show that text on a separate introductory screen with Start verification before the first exercise. Do not repeat it above each exercise. The Verify stage link opens the introduction; explicit exercise links remain direct, and Back from the first exercise returns to the introduction. Reading the introduction does not save progress.
At viewport widths of 960px and above, show the browser as an
always-visible, sticky left sidebar beside the reading column. Below 960px,
use an inline disclosure above the card, closed initially, including its counts.
Multiple exercises
use the same responsive browsing pattern. Resize without replacing forms or
losing draft input; keep focus reachable when the browser changes layout.
Update saved answer/status labels without rerendering the active form.
Keep the four stages directly reachable; stage navigation indicates location,
not completion. Back/Next remain shortcuts and all navigation flushes pending
edits before changing routes.

Forms autosave without rerendering or moving focus. Coalesce text changes,
serialize writes using the latest revision, and flush pending edits before
navigation, exports, and Reload. Do not show an unsaved-changes banner or routine
autosave notice. Failed writes remain visible and preserve input. Reload may
discard failed edits only with explicit confirmation.

New blocks start at Understand. No author approval/status flag may gate
participant navigation or add a draft badge to participant screens.

Track configuration separately from validation for each exercise. Changing
relevant decisions or targets invalidates affected evidence only. Retain inactive
results as historical, not current completion. Prepared fallback, proposal-only,
blocked, fictional analysis, and live outcomes must remain distinguishable.
Completion labels must state what the exercise actually establishes.

Configure presents one selected step at a time, in authored recipe order followed
by Additional steps. A numbered overview mirrors Decide's sidebar on wide
canvases and becomes a disclosure on narrow ones. It shows the current step,
each step's status, and a live Done count. Back/Next traverse every step.

Cards separate numbered headings, instructions, neutral saved-decision context,
and API/documentation references, in that order. Configure and Verify have no
exercise record form: no target URL, field, or evidence inputs. Participants
only mark steps Done.
Do not add a personal-checklist disclaimer beneath the instructions.
Use restrained utility icons, Primer tokens, and section dividers;
do not scatter the same references above and below the instructions.
Each selected recipe and Additional steps card has a compact green
**Mark as done** button at the top right. Completed steps show a separate
checkmarked **Done** indicator, a green-tinted header, and a red **Undo** button.
The reversible action retains its pressed state and keyboard focus.
Instruction-list numbering is inset from the section
headings. Reference sections retain documentation links without API-availability chips; API metadata remains available in the content model.
These task markers are not exercise configuration or validation evidence; guidance remains
informational. They autosave, appear separately in summaries/exports, and stale
markers move to history when their source, relevant choices, or exercise target
changes. Additional steps currently use their exact authored title as identity;
renaming one archives its marker rather than transferring Done.

The quiet **Compare answers** control belongs inside **Based on your decision**.
It opens an inline panel only on request, with styled native
radio choices, an explicit saved-answer label, and a Close control. Show related
decision buttons only when a step has multiple decisions to compare. It resolves
a hypothetical answer through the shared resolver and shows read-only instructions, including
the matching exercise variant. It never changes saved decisions, task markers,
exercise fields, eligibility, or exports. Saved-answer instructions stay visible.

All writes go through `state.mjs` with revision checks and atomic persistence.
Migrate known versions explicitly; preserve existing participant records and
archives. Unknown/corrupt state must produce recovery guidance, never reset
progress. UI, actions, summary, and exports must agree through shared resolution.

## Acceptance

Run standalone validation without a running canvas, then focused content,
runtime, and browser suites. Neither a passing validator nor a completed
participant exercise grants human approval. Cover:

- guidance-only, no-action, shared recipes, and multiple exercises;
- Needs Review, unmet requirements, inactive history, and both exports;
- known-state migration, stale/failed saves, and retained input;
- light/dark themes, keyboard focus, 320px/390px widths, scrolling, and reachable
  fixed navigation controls, including Windows.

Report native embedded-canvas coverage separately from Chromium coverage.
Visual consistency, structural validity, product accuracy, and human approval
are different acceptance dimensions.
