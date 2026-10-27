---
name: lab-content
description: Author, verify, or review governance workshop content in content/<block-id>.md and shared content/policy-catalog.json metadata. Use for the Understand, Decisions, Configure, and Validation stages, catalog coverage against content/policy-catalog.csv, writing style, sources, and authoring contracts. Do not use for canvas runtime code.
---

# Lab content authoring

The participant canvas is `governance-lab`. Each block lives in one
`content/<block-id>.md` file with four stages: **Understand, Decisions,
Configure, Validation**. All current material, including User Governance, is
stale, unvetted draft content. Neither migration nor passing tests grant
approval.

## Read first

- [Content format](../../../docs/CONTENT-FORMAT.md): the Markdown grammar,
  manifest, metadata, reference rules, and diagnostics.
- [Copyable template](../../../docs/templates/workshop-block.md): a fictional
  structural example, not product guidance.
- [Design guidelines](../../../docs/CANVAS-DESIGN-GUIDELINES.md): shared flow,
  interaction, and progress preservation.
- [Reference](reference.md): author workflow, coverage report, and repair hints.

Do not copy schema details into this skill or treat one draft block as the schema.
Use `content/observability.md` and `content/billing-cost-control.md` only as
examples of structural relationships between explanatory prose, decision
framing, Configure recipes, and matching validations. They are drafts and may
contain wording or author notes that conflict with this skill. Do not copy
their wording or notes. Use the format and template for the actual grammar;
block copy is not product evidence.

## What the workshop is for

Copilot governance is complex. The workshop makes it easy to digest. Start
simple and add complexity bit by bit. Do not overwhelm participants with every
option, edge case, or setting at once.

## Participant sandbox

Each participant receives a pre-created Sandbox Enterprise and organization.
The organization has a `.github-private` repository with
`copilot/managed-settings.json` and an example Petstore workshop repository.
Participants are enterprise and organization owners and the only user in their
enterprise. They use a provided laptop with Copilot CLI, GitHub CLI, and the
GitHub Copilot app installed and signed in as their pre-created sandbox user.
The tracked provisioning setup for the organization and managed-settings file
is described in `scripts/provisioning/README.md`.

The enterprise is already connected to a GitHub-provided Azure subscription.
Its subscription ID is fixed, and no additional subscriptions can be added.
Do not include steps to change the subscription or payment connection.

The lab is a safe place to try settings hands-on. Participants should leave
with learnings and ideas to adapt for their production instances. Because each
participant is the sole user in their enterprise, role changes and assigning
or removing licenses for other people cannot be fully practiced here. If these
actions are a required part of a Configure step, explain that participants can
visit the settings page and, where appropriate, create a team or role to learn
where and how the setup works, but cannot assign other users or licenses in
this lab. Treat those steps as demonstrations of the workflow, not completed
assignments. If the production design depends on assigning people or licenses,
add a brief hint to apply those assignments in the production instance.

## The four stages

Each block walks through the same four stages. Participants see Decide and
Verify as labels for Decisions and Validation.

1. **Understand** eases people in. Start with a plain-language overview of the
   problem, relevant concepts, and important trade-offs. Add ordinary topic
   subsections, tables, or callouts when they help explain the subject. Prepare
   participants for the choices without asking them to make a decision yet.
2. **Decisions** connects an enterprise's needs and constraints to the
   available choices. Optional introduction text can frame how to answer the
   questions. Each decision poses a clear question and offers options that
   describe the resulting paths. Use its guidance to explain trade-offs and
   context. Prefer business or team situations over a bare policy list. A
   direct question about enabling a setting is appropriate when that is the
   decision participants need to make. Offer only substantive, resolved
   choices; do not add a deferred option.
3. **Configure** contains the selected recipes in authored order. Each recipe
   is guidance or an exercise; options can select recipes of either kind, and
   can select more than one recipe or none. Recipes can be reused by several
   options. Do not turn every decision or policy into an exercise. Add evergreen
   instructions only when useful, under `### Additional steps` cards.
4. **Validation** defines how participants check the result of each exercise;
   it is not a second configuration walkthrough. Checks can inspect a setting,
   report, or other stated outcome, and should say what the result establishes.
   Guidance recipes do not get Validation definitions. Every exercise recipe
   does, but not every configuration or setting needs an exercise. When the
   decision changes the applicable check, use the format's answer-specific
   validation variants rather than duplicating the exercise.

There is no fixed number of decisions or exercises per block.

## Writing style

Content must read as if a person wrote it.

- Use short sentences and everyday words. Explain terms in simple language.
- Avoid catchy, slogan-like phrasing, semicolon chains, and "X, not Y" taglines.
- Avoid filler words and inflated vocabulary such as "leverage", "robust",
  "seamless", "holistic", or "ensure alignment".
- Introduce one idea at a time. Put the common case first and edge cases later.
- Whenever content names a specific policy or setting participants should
  adjust, use its exact name as shown in the GitHub UI and format the name as
  inline code, for example `Copilot metrics industry comparison`. Use the
  planning catalog to find candidate names, then verify the displayed name
  against an official source opened during the session.
- Keep documentation links and references in Configure and Validation focused
  on the specific setting, action, or result covered by that recipe or check.
  Include a source only when it helps participants understand or perform that
  step; avoid broad reference lists that are not directly relevant.

### Voice and authority

The workshop is delivered by GitHub. Write as GitHub, in the first person plural ("we recommend", "our documentation") or by naming GitHub directly. What the content says is authoritative.

- State facts directly: "Copilot Business includes …", not "According to the GitHub documentation, Copilot Business includes …".
- Avoid hedging or attribution phrases such as "the GitHub Docs state", "the documentation says", "as documented", "per the docs", "it appears that", or "should, according to …".
- Source links are fine as a "Learn more" pointer or in the format's source fields. They support the statement and do not replace a direct one.

### No working state in content

Participants read every word of the content. Keep authoring work out of it. Content must not contain ANY markers that are not participant content.

- Never write verification or confirmation notes into content, such as "confirmed in the docs", "verified on <date>", "documentation-confirmed", "undocumented - confirmed by …", "TODO", "needs review", or notes about what an agent checked.
- Never describe the authoring process, open questions, or your own uncertainty in participant-facing text.
- Report verification results, open questions, and gaps in your chat summary instead. Record lasting planning notes in the `notes` column of `content/policy-catalog.csv` when relevant. Do not create migration or author-note files unless explicitly requested.

When editing existing content, fix grammar mistakes and typos, but do not
rephrase it unless the user asks you to. Preserve author wording during
mechanical migration and report ambiguity instead of rewriting meaning.

## Catalog coverage

`content/policy-catalog.csv` is the high-level plan of all policies and the
block that should cover each one. Its row IDs link to content with
`**Catalog IDs:**` on every Decision, Recipe, and Additional steps card (or
`none`). A decision lists the union of planning rows represented by the recipes
referenced by its resolved options, including guidance recipes. These are not
`**Policies:**` runtime IDs and participants never see them.

Every active row assigned to a block should eventually appear in that block,
usually in Configure. Check this with:

```sh
node scripts/catalog-coverage.mjs
```

The content is a work in progress, so gaps are expected. Mention them gently
as open planning items. Do not treat them as errors, do not block other work
on them, and do not invent product guidance just to close a gap.

### Not applicable in the lab

Some settings cannot be practiced with the lab accounts. For example, the test
accounts have one user and are pre-configured, so participants cannot attach an
Azure subscription or really manage access. That is fine.

- Mark such a row by starting its `notes` cell in the CSV with
  `Not applicable in the lab:` followed by a short reason. Keep the rest of the
  note. The coverage report shows these rows separately.
- The content can still explain the setting, for example in Understand, in a
  decision answer, or in a guidance recipe. Do not create an exercise or add
  actionable Configure steps for it.
- Do not include instructions to change enterprise or organization roles, or
  assign or remove licenses for another person. If a production design depends
  on those actions, use only a brief hint to apply the design in the production
  instance.
- The Azure subscription is already connected and cannot be changed or
  supplemented. Do not include steps to alter its connection or add a
  subscription.
- Only flag a row when the lab limitation is clear. Ask or record an open
  question when it is not.

## Scope and sources

- Edit block Markdown and, when needed, shared runtime metadata in
  `content/policy-catalog.json`. Activate sources through `content/manifest.json`
  only when requested and structurally valid.
- Do not edit extension runtime, state, or parser code to make content pass.
  Runtime work belongs to `lab-canvas`. Contract changes must update the shared
  core, standalone validation tests, specification, and template deliberately.
- The CSV is editable planning data, not a generated export or a mirror of
  runtime policy IDs. Preserve IDs, notes, removal markers, and classification
  questions.
- Scenarios are supporting drafts, not rendered sources.
  Report unmatched material in chat; do not create migration or author-note
  files unless explicitly requested, and do not invent an exercise to absorb it.

## Grounding: non-negotiable

For every claim about GitHub products, settings, policies, availability,
defaults, limits, permissions, terminology, UI locations, URLs, or endpoints:

1. Open the official source during this session: `docs.github.com`, the GitHub
   changelog, or the GitHub REST/GraphQL reference. Existing text and search
   snippets are not proof.
2. Cite only opened pages. Do not infer endpoint placeholders, admin URL
   patterns, defaults, availability, or unsupported product behavior.
3. Use the terminology of the opened source.
4. If a claim cannot be confirmed, leave a new claim out. For an existing draft
   claim, report it in your summary as needing review. Do not mark it inside
   the content and do not add structural fields to hold a note.
5. Only an explicit human exception permits an undocumented claim. Write the
   claim plainly in the content. Content must not contain ANY markers that are
   not participant content (see No working state in content).
6. Admin-page URLs supplied by the author are authoritative. Use them as
   the truth without verifying them or asking for a source.

Grounding is how you check content, not something the content talks about.
Once a claim is grounded, state it with authority (see Voice and authority).

The validator checks structure and link syntax. It does not check whether a
page exists, a claim is true, or a source is current.

## Navigation steps

Whenever content asks participants to go to a GitHub page, write the UI path as one bold run. Start it at **Enterprise Settings**, **Organization Settings**, or **Repository Settings**, and put ` -> ` between UI labels. Use the labels of the opened official docs.

```text
Navigate to your **Enterprise Settings -> AI controls -> Copilot -> Configure models**.
```

When a page URL is known, make the whole path the link, with the bold outside the link. Do not write "click here". Link labels render as plain text, so `**` inside a label shows literally.

```text
Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
```

- If the URL only reaches part of the path, link just that prefix: `**[Enterprise Settings -> AI controls](…) -> Agent sessions -> View all**`.
- Use the `{{enterprise.slug}}` or `{{organization.slug}}` placeholders, never a real slug such as `octodemo`. Add the fallback `https://github.com/settings/enterprises` or `https://github.com/settings/organizations`.
- Repository Settings links use `https://github.com/{{organization.slug}}/{{repository.name}}/settings` with the organization fallback. The profile repository defaults to `pets-workshop`. Link only the Settings prefix unless an authoritative deeper URL exists; explicitly named shared repositories such as `.github-private` stay literal.

When you add or change a navigation path, link it only when the author supplies the URL or an opened official doc states that exact page URL. If a URL contains a real slug, put `{{enterprise.slug}}` after `/enterprises/`, and `{{organization.slug}}` after `/orgs/` or `/organizations/` or as the owner of an organization-owned repository URL. If you cannot resolve the URL, leave the path unlinked and mention it in your summary.

Do not guess URLs from other entries, from patterns, or from the browser address bar.

## Terminal commands

When a step asks participants to run a command, put it in a shell fence. The canvas shows an **Open terminal and run** button beside it. One click runs the displayed command in a native terminal in the GitHub Copilot app, without a confirmation popup.

Pick the fence info string by what the command needs:

| Info string | Use it when | Button |
| --- | --- | --- |
| `sh` (also `bash`, `shell`) | The command runs exactly as written. | Yes |
| `sh profile` | The command needs a configured enterprise, organization, or repository, or participant input. Use `{{enterprise.slug}}`, `{{organization.slug}}`, `{{repository.name}}`, and/or `{{input.field-id}}`. | Yes |
| `sh manual` | Reference-only shell examples that participants must not run from the workshop. | No |

````text
2. Request the report. This command uses the enterprise saved in your workshop profile.

   ```sh profile
   gh api --method GET "/enterprises/{{enterprise.slug}}/settings/billing/budgets"
   ```

3. Enter a budget ID returned by the previous command:

   ```sh profile
   BUDGET_ID={{input.budget-id}}
   gh api --method GET "/enterprises/{{enterprise.slug}}/settings/billing/budgets/$BUDGET_ID"
   ```
````

- Every enterprise, organization, or repository target in a runnable command must use its corresponding profile placeholder. Never ask participants to replace a visible fallback manually; they must configure the profile before the command can run.
- Use `{{input.field-id}}` for values the participant must supply. Each unique field ID creates a required text field; IDs ending in `-url` receive URL validation. Assign the placeholder directly to a shell variable without quotes, then use the variable in the command. Inputs are shell-quoted on the server and are not persisted.
- Do not leave values such as `YOUR-BUDGET-ID` in runnable commands. Use a form input for values returned by an earlier command.
- All commands in a workshop document run in the same terminal, so later steps can use variables and files from earlier steps. Say "In the same terminal" when a step depends on that. If a participant closes the terminal, the next click starts a new shell, so keep each step's needed variables recoverable.
- Use exactly these info strings. Any other info string, such as `console` or `sh example`, renders as plain code without a button.
- Commands must be grounded like any other claim. A button is not authorization for consequential writes outside the participant's test environment.

## Authoring contract

- Keep explicit, stable block, decision, answer, recipe, exercise, and policy
  IDs. Never derive identity from a renamed label.
- Answers reference zero or more local recipes. Recipes reference shared
  runtime policy IDs. Keep setup instructions in the block, not in per-policy
  files or generated command templates.
- A recipe is guidance or an exercise. Several answers can share one. Support
  guidance-only, exercise-only, mixed, and no-action answers.
- Configure resolves and deduplicates selected recipes in authored order and
  checks explicit prerequisites and conflicts.
- Every exercise has a matching Validation definition with clear steps and an expected result.
  Guidance has no completion record. Needs Review stays unresolved.
- Use the format's exercise variants when answers need different steps for the
  same exercise. Do not invent branching syntax.
- Do not invent live configuration requirements for fictional analysis or
  prepared examples.

Use only the Markdown and metadata defined in the format. Expressions, scripts,
templated endpoints, and dynamic URLs are not general authoring mechanisms. The exceptions are the profile link placeholders described in Navigation steps and `sh profile` fences, which support `{{enterprise.slug}}`, `{{organization.slug}}`, `{{repository.name}}`, and declared `{{input.field-id}}` values. Profile placeholders display the globally configured workshop identifiers; missing or invalid values prevent execution. Rendering never executes commands; the participant canvas offers an explicit **Open terminal and run** button on runnable shell fences. Use `sh manual` only for reference-only examples that are not to be run from the workshop. See the content format for the exact contract.

## Safety and approval

Participants do not need facilitator approval or confirmation for actions in their assigned test environment. This lab is for trying settings and observing their effects. Do not add "check with the facilitator" steps, facilitator-approved amounts, or similar gates. Keep explicit reference-only boundaries, such as the provided Azure subscription, and distinguish test actions from production changes.

Participant walkthroughs are not authorization for an agent to execute changes. Agents performing consequential writes need explicit
confirmation of the exact target, scope, and consequences. Never store
credentials or require spending or weakened safeguards to prove an exercise
works. Keep live evidence, fictional data, and prepared work clearly apart.

Preserve saved participant identities and meaning. Renaming an exercise or
changing what it means can require an explicit state migration. Never treat old
evidence as new completion.

Agents must not grant human review or approval. Changed sources or referenced
policies need re-review, without hiding participant content.

## Validation loop

Run validation after every content edit, not only at the end:

```sh
node scripts/validate-content.mjs
node scripts/validate-content.mjs --file content/<block-id>.md
node --test tests/content-validation/*.test.mjs
```

Fix reported problems right away and rerun until the check passes. Follow the
diagnostic's file, line, code, section, and repair hint. Fixes must keep IDs
stable and must not weaken the validator or drop content. If a fix would need a
product claim you cannot ground or an ID change, stop and report it instead.

Exit codes: 0 valid, 1 invalid content, 2 invocation or read failure. The
single-file mode checks one block plus the shared catalog. Run the full check
before integration.

Then run `node scripts/catalog-coverage.mjs` and mention remaining gaps as
open items.

For changes that affect rendering or resolution, also run:

```sh
node --test .github/extensions/governance-lab/*.test.mjs
npm test --prefix tests/canvas-e2e
```

After Markdown or policy metadata edits, click **Reload** (dev mode) in
`governance-lab` to preview new content while preserving saved progress.
Invalid content shows diagnostics and the previous content stays active.
The separate **Reset** control clears the document's progress, not content.

Report structural validity, catalog coverage, browser tests, native acceptance,
factual verification, and human approval as separate outcomes.
