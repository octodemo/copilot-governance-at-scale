# Product

<!-- impeccable:product-schema 1 -->

> This record describes the approved consolidation direction, not a claim that
> implementation, content review, or workshop acceptance is complete.

## Platform

web

## Users

Enterprise administrators participating in **“GitHub Copilot at scale: An
interactive lab for enterprise admins”** are the primary users. Authors and
facilitators can prepare and review the material.
Participants should be able to revisit the public workshop after the session.

## Product Purpose

Help participants understand governance trade-offs, make explicit decisions,
find the relevant sourced guidance, practice approved exercises, and leave with
an honest record of outcomes and follow-up.

Success is a useful decision record, not a settings catalog, a completion badge,
or an unsupported claim that an enterprise is correctly configured.

## Positioning

The experience connects decisions to authored local recipes and shared policy
references. Recipes can be informational guidance or exercises. Configure shows
only the applicable collection; Validation records evidence for actual
exercises. A choice need not create an exercise, and several choices can share
one. The model must also support multiple applicable exercises in one block.

## Operating Context

One participant canvas, **`governance-lab`**, presents six use-case blocks:

1. Access Management — who gets access.
2. User Governance — models and features.
3. Billing & Cost Control — funding, consumption guardrails, financial reporting.
4. Agent Governance — operating scope, tools, and actions.
5. Context Management — AI guidance and sensitive-information concerns.
6. Observability — adoption, agent activity, and engineering impact.

Every block uses **Understand → Decisions → Configure → Validation**,
followed by shared summary/export. Decide/Verify are the corresponding
participant screen labels. No fixed number of decisions or exercises defines
a block's readiness.

Catalog coverage is independent of participant availability and completion
and does not imply human approval.

All current content, including User Governance, is stale, unvetted draft
material until explicit human review.

## Capabilities and Constraints

- One editable Markdown source per block contains all four stages.
- Shared policy metadata and official references live separately from recipes.
- The CSV is an author coverage catalog, not a runtime source or generated mirror.
- Standalone validation works in an editor/terminal loop with Node alone.
  Opening a canvas is optional preview, never required structural validation.
- Guidance and unresolved choices do not count as configured or validated.
- Configuration and validation evidence belong to explicit exercises.
  Historical records do not imply completion of revised exercises.
- Participant input autosaves through revision-checked persistence; failed
  saves remain visible and preserve input rather than silently losing work.
- Summary and both exports must agree with the UI about current, incomplete,
  inactive, and historical outcomes.
- The canvas does not perform administrative changes or store credentials.
  Consequential writes require explicit confirmation outside its reporting flow.
- Human review is explicit. Tests, source timestamps, and authorship never
  grant approval.

## Brand Commitments

Use **GitHub Copilot at scale** and the session title consistently. Prefer
Primer conventions, a focused single-column flow, and shared components.
Write direct, practical, decision-oriented guidance that explains uncertainty
and does not pretend one answer fits every organization.

Product terminology and claims must be verified against official documentation
opened during the authoring session. Do not retain stale claims simply because
they already appear in the repository.

## Evidence and Source Responsibilities

- [README](README.md): audience, scope, and author/participant separation.
- [Content format](docs/CONTENT-FORMAT.md): the Markdown authoring contract.
- [Architecture](docs/architecture.md): source flow and persistence requirements.
- [Design guidelines](docs/CANVAS-DESIGN-GUIDELINES.md): shared interaction rules.
- `content/manifest.json`: active block source discovery.
- `content/policy-catalog.json`: shared policy references, not proof of truth.

No customer testimonials, adoption benchmarks, accessibility certification, or
measured workshop outcomes are established by these documents. Do not invent
them.

## Product Principles

1. Start with a governance use case, not a catalog of controls.
2. Explain trade-offs and uncertainty honestly.
3. Connect choices to applicable guidance and observable exercises.
4. Preserve administrator control and participant records.
5. Separate structural validity, product truth, human approval, and completion.
6. Keep the take-home artifact useful without implying production authorization.

## Accessibility and Open Questions

Preserve keyboard operability, visible focus, meaningful labels, narrow-screen
navigation, and light/dark contrast. Test shared surfaces rather than creating
block-specific interaction patterns.

The exact exercises, content accuracy, and workshop timing remain human review
work. Accessibility conformance and workshop accommodation requirements need
explicit confirmation; automated browser coverage alone does not establish them.
