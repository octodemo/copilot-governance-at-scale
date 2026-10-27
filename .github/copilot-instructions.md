# Copilot instructions

## Project context

This repository supports the GitHub Universe 2026 session **“GitHub Copilot at
scale: An interactive lab for enterprise admins,”** hosted by
[@scubaninja](https://github.com/scubaninja) and
[@davelosert](https://github.com/davelosert).

Keep work focused on practical enterprise governance decisions, approved
sandbox exercises, and evidence that explains what participants did and did
not establish. The public take-home experience is intended to support later
adaptation, not prescribe unreviewed production changes.

## Experience and content status

There is one participant canvas, `governance-lab`. The workshop has six use-case blocks:

- **01 — Access Management:** who gets access.
- **02 — User Governance:** models and features.
- **03 — Billing & Cost Control:** funding, consumption guardrails, and
  financial reporting.
- **04 — Agent Governance:** operating scope, tools, and actions.
- **05 — Context Management:** AI guidance and sensitive-information concerns.
- **06 — Observability:** adoption, agent activity, and engineering impact.

Each block has **Understand, Decisions, Configure, Validation** stages.
Participant labels Decide/Verify correspond to Decisions/Validation:

- **Understand** gives a high-level view of the topic, what exists, and the
  main trade-offs. It eases participants into the decisions and configuration.
- **Decisions** starts with what an enterprise needs, then connects those needs
  to the policies or settings that may help. Do not make participants start by
  choosing policies.
- **Configure** is the practical, step-by-step walkthrough of settings tied to
  those decisions. It can also include evergreen steps in `Additional steps`
  that are useful without depending on a decision.
- **Validation** helps participants see configured policies in action. Relate
  it to Configure, but do not require a check for every setting when the lab
  cannot demonstrate it.

Introduce complexity gradually and keep the workshop easy to follow. Do not
impose fixed decision counts or one exercise per block.

**ALL existing content, including User Governance, is stale and unvetted.**
Preserve author wording during mechanical migration; do not invent product
guidance, missing exercises, or approval to fill structural gaps. Report
unmapped draft material and unresolved questions in chat. Do not create
migration or author-note files unless explicitly requested.

## Sources and ownership

- `content/<block-id>.md` is the single editing layer for that block's four
  stages. Do not maintain editable block JSON or separate introduction copies.
- `content/manifest.json` owns block identity, order, and source discovery.
- `content/policy-catalog.json` owns shared runtime policy metadata and sources.
  Local block recipes reference its IDs; policy prose is not duplicated into
  a separate per-policy setup-guide library.
- `content/policy-catalog.csv` is the editable planning coverage catalog.
  Preserve IDs, notes, removal markers, and explicit classification questions.
  It is not a generated export or an automatic mirror of the JSON catalog.
  Block Markdown traces to its rows via `**Catalog IDs:**` on decisions,
  recipes, and Additional steps cards.
- Scenarios and author notes are supporting material, not proof
  of product truth or a second active rendered content source.

Read [the content format](../docs/CONTENT-FORMAT.md) for exact grammar and
[design guidelines](../docs/CANVAS-DESIGN-GUIDELINES.md) before changing the
participant canvas or its content. Use `lab-content` for authored content and
`lab-canvas` for the participant runtime; both skills live in `.github/skills/`.

## Grounding in documented truth

This applies to every response and every authored claim, including canvas
copy, skills, prompts, policy metadata, and configuration guidance:

- Ground GitHub product, setting, policy, limit, default, UI location, URL,
  and API claims in official documentation actually opened in this session:
  `docs.github.com`, the GitHub changelog, or the GitHub REST/GraphQL reference.
- Cite the opened source. Do not infer endpoints, placeholder names, URL
  patterns, defaults, limits, or availability from memory or repository text.
- If documentation cannot confirm a claim, say so explicitly in your response.
  Leave out new unsupported claims and record unresolved existing draft claims
  for review outside participant content.
- Only an explicit human exception permits an undocumented claim. State the
  claim plainly in workshop content.
- Admin-page URLs supplied by the authors are authoritative input.
  Apply them as the truth; they need no documentation source or confirmation
  label. Use `{{enterprise.slug}}`/`{{organization.slug}}`, never a real slug.
- Workshop content must not contain ANY markers that are not participant
  content: no verification or confirmation notes, source or approval labels,
  "the documentation states" attributions, TODOs, or authoring notes. It
  speaks with GitHub's authority. See the `lab-content` skill.
- Existing links, verification dates, authorship, and passing tests are not
  evidence that a claim is currently true. Use current terminology from the
  opened official source rather than a hard-coded terminology assumption.

## Authoring and approval boundaries

Stable block, decision, answer, recipe, exercise, and policy IDs are contracts.
Changing a label must not change identity. Answers reference zero or more local
recipes; Configure deduplicates applicable recipes in authored order. Guidance
does not produce completion. Every exercise needs its matching Validation
definition. Needs Review remains unresolved.

The catalog tracks coverage, not author readiness or approval.
Human approval requires explicit attestation; changed source or referenced
policy metadata requires re-review. Agents must not grant approval, infer it
from tests, or use readiness to hide participant content or alter exports.

## Safety and participant progress

Preserve the shared UI, loopback HTTP protections, safe rendering, and existing
participant records. All state writes go through the validated state layer
with revision checks and atomic persistence. Migrate known records explicitly;
preserve incompatible records as historical, never as new exercise completion.
Reject corrupt or unknown records rather than silently resetting them.

The canvas is not an administrative API executor. Commands and proposed
changes are guidance, not authorization. Obtain explicit confirmation of
target, scope, and consequences before enterprise, organization, billing,
licensing, repository, or other consequential writes. Never persist credentials.
Keep participant notes untrusted and review exports before sharing.

## Validation

Run the independent structural check after content/contract changes:

```sh
node scripts/validate-content.mjs
```

The CLI and canvas consume the same neutral contract in
`lib/workshop-content.mjs`. The CLI must run locally and in CI with Node alone,
without loading the extension SDK, server, browser, session, or network. Errors
need location, stable code, affected section/ID, and concrete repair hints.
Do not weaken the validator to make malformed content pass.

Run the smallest relevant maintained suites, and all of these for integration:

```sh
node --test tests/content-validation/*.test.mjs
node --test .github/extensions/governance-lab/*.test.mjs
npm test --prefix tests/canvas-e2e
```

Structural validity, browser coverage, native in-app acceptance, product-fact
verification, and human approval are separate outcomes. Report them separately.
