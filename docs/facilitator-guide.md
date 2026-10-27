# Facilitator guide

## GitHub Copilot at scale: An interactive lab for enterprise admins

Use this guide to prepare and deliver the GitHub Universe workshop created by
[@scubaninja](https://github.com/scubaninja) and
[@davelosert](https://github.com/davelosert).

[Workshop overview](../README.md) |
[Workshop setup guide](setup.md) |
[Attendee instructions](../instructions/README.md)

**All workshop material is stale, unvetted draft content, including User
Governance.** This guide describes facilitation responsibilities and the
approved learning structure; it does not approve existing exercises or establish
their product accuracy.

## Delivery goal

Help enterprise administrators make explicit governance decisions, practice
authorized sandbox tasks, and leave with an honest record of what they learned.
The goal is not to make every participant choose the same settings or to
complete every exercise.

Attendees use the GitHub Copilot app and the **Copilot Governance Workshop**
canvas (`governance-lab`).

## Before the workshop

### Select and review the material

1. Choose blocks that fit the audience's needs and the available session time.
   Reserve time for setup, discussion, export, and cleanup. Do not promise a
   fixed exercise count or assume that every block contains a live exercise.
2. Read each selected `content/<block-id>.md`, its referenced policies in
   `content/policy-catalog.json`.
3. Open the official GitHub sources for product claims, prerequisites, roles,
   settings, limits, and expected behavior. Resolve unsupported guidance before
   assigning it as a live task.
4. Obtain explicit human review of the material you will deliver. Record the
   reviewed source revision, reviewer, scope, and unresolved gaps in your
   delivery preparation record. Re-review changed content or referenced policy
   metadata.

Catalog coverage and passing tests are not approval.

### Prepare the environment and teaching team

Complete the [workshop setup guide](setup.md), including a rehearsal in the
actual app. Assign a lead presenter, a participant-support contact, and a
sandbox owner who can resolve access and rollback questions. One person may
cover more than one role.

Provide participants with the attendee guide, the repository they should open,
their approved targets, and the allowed operations. Share account-specific
details through the approved event channel, not in the public repository.
Never distribute credentials through canvas notes or exports.

Prepare a demonstration record separate from participant work and identify the
fallback for each selected exercise. Use only authored prepared/proposal
alternatives; do not invent successful evidence when access is missing.

### Rehearse the participant journey

Walk through Exercise 0, one selected block, and both summary exports. Confirm
that the presenter can explain the difference between a decision, guidance,
configuration, and validation. Check that the projected interface is readable
and that participants can follow using a keyboard or a narrower display.

Record structural results, browser results, native app acceptance, product-fact
verification, and human approval separately. Do not describe an environment as
tested solely because it appears in an automated test configuration.

## Run of show

Set timings to match the published session slot and your rehearsal. The
following is a delivery sequence, not a fixed agenda or duration commitment.

| Phase | Presenter action | Participant checkpoint |
| --- | --- | --- |
| Welcome | Explain the governance goal, sandbox boundaries, and take-home record. | Understand that the workshop is not a production rollout or audit. |
| Exercise 0 | Guide attendees through the [attendee setup](../instructions/README.md#exercise-0-open-your-workshop). Have support resolve access issues. | The participant canvas opens and the assigned lab accounts are confirmed. |
| Demonstrate the flow | Show Understand, Decide, Configure, and Verify in a selected block. | Distinguish decisions and guidance from performed exercises. |
| Guided practice | Facilitate the selected blocks and pause for trade-off discussions. | Record choices, observations, blockers, and limits honestly. |
| Debrief and export | Review the Governance Summary and demonstrate export. | Save and review a take-home record outside the repository. |
| Close | Confirm sandbox cleanup and identify follow-up reviews. | Know what remains unresolved and who owns the next action. |

Suggested opening:

> Today we will explore governance choices, not prescribe one configuration for
> every enterprise. Work only in your approved sandbox. A completed checklist
> is not proof that a policy works everywhere, and your summary is a record of
> your decisions and observations, not permission to repeat changes in production.

Before moving past Exercise 0, ask attendees to compare **Your Enterprise** and
**Your Organization** with their assigned targets. If detection fails, follow
the manual profile instructions in the attendee guide.

If a saved, complete profile has the wrong target, pause live work before
following settings links. The profile editor is not available after successful
detection, and reopening the same document retains the saved target. Before
participants have recorded any work, have support correct the account used for
discovery, then reopen `governance-lab` with an unused `documentId` and `dev false`.
Confirm the new targets and keep using that document ID. If work already exists,
preserve the record and use the block Markdown for discussion while support
investigates; do not reset or overwrite progress.

## Facilitate the shared flow

### Understand

Read the authored introduction, discuss the use case and boundaries, and identify
what the participant wants to learn. Reading does not create a saved completion
record. Do not manufacture missing context or product advice from the title.

Ask: "What enterprise need are you trying to meet, and what trade-off matters
most in this situation?"

### Decide (Decisions in the source)

Work through the decision cards and their trade-offs. A participant may select
a deferred/Needs Review choice rather than guess. Keep unresolved choices
visible. The number of decisions is authored content, not an architectural
requirement.

Explain that an answer may select guidance, exercises, both, or neither. A
resolved decision alone does not demonstrate configuration.

Ask: "Why does this choice fit your needs, and what still needs review?"

### Configure

Review the applicable local recipes in authored order. Shared recipes appear
once even when several answers select them. Distinguish informational guidance
from exercises that record a concrete setup or inspection.

Confirm safety, scope, prerequisites, and change authorization before live work.
Participants act manually; the canvas is a reporting surface, not an
administrative executor. Do not enable spending, change shared resources, or
remove safeguards merely to complete an exercise.

A block may have no applicable exercises or several. Do not invent an exercise
to fill an empty result. If prerequisites are unmet, record the blocker and
follow-up; use a supported prepared/proposal alternative where authored.

Ask: "What exactly are you authorized to change or inspect, and how would you
undo a change?"

### Verify (Validation in the source)

Use the matching validation instructions for each exercise. Record observations
and limitations as evidence. Evidence should establish only that exercise's
expected result, not broad rollout success.

Prepared examples cannot prove live changes; fictional analysis cannot prove
real-account outcomes. Review the participant's reasoning: structural/form
checks cannot decide whether an explanation is true. Do not mark guidance
complete as if it were an exercise.

Ask: "What did you actually observe, and what does that observation not prove?"

### Summary and take-home

Review resolved and unresolved decisions, applicable guidance, exercise status,
and evidence. Historical/inactive results are retained records, not completion
of the current choice. Relevant choice or target changes can invalidate
dependent evidence.

Open **Governance Summary** and demonstrate **Export Markdown** and
**Export JSON** only after pending saves succeed. Give attendees time to save
their own copies outside the checkout and review them for sensitive information.
Do not collect everyone's exports by default; follow the agreed retention and
sharing process.

Ask each participant to identify a useful decision, an unresolved question, and
a next review or validation step. The artifact is participant-reported; it is
not an audit, product approval, or authorization to repeat sandbox actions in
production.

## Six preparation areas

These are workshop planning boundaries, not claims about specific product
capabilities. Verify concrete procedures in the active block's opened sources.

| Block | Preparation focus |
| --- | --- |
| Access Management | Approved access-related task, participant/client preparation, clear limits on what its evidence proves |
| User Governance | Model and feature choices; check the active block for available guidance and exercises |
| Billing & Cost Control | Funding/consumption boundaries, authorization, no intentional spending to force a result, financial-reporting scope |
| Agent Governance | Permitted operating scope and actions, harmless task, prepared alternative where needed |
| Context Management | Approved sample repository/task, comparison baseline, explicit limits on inferred adherence |
| Observability | Clearly fictional or explicitly authorized evidence, distinction between adoption/activity and impact, no financial chargeback duplication |

Participants may choose a block independently when its
prerequisites are supplied.

## Handle interruptions

| Situation | Facilitator response |
| --- | --- |
| Several attendees cannot open the app or repository | Pause the setup checkpoint and route errors to support. Use block Markdown for discussion while the cause is investigated. |
| The canvas cannot load | Preserve the reported error. Do not ask the agent to build a replacement or modify workshop code during the exercise. |
| Sandbox access or permissions are missing | Stop live actions. Use an authored alternative if available and record what remains unverified. |
| A setting or expected result differs from the instructions | Stop that procedure, check its official sources, and record the discrepancy for author review. Do not improvise a consequential change. |
| A participant selects a production target | Stop before any change and reconfirm the approved sandbox with its owner. |
| Time is running short | Reduce the number of blocks rather than skipping authorization, evidence review, or export. |
| Sensitive data appears in notes or on screen | Stop sharing it and follow the event's handling process. Do not copy it into troubleshooting messages. |

## Recovery and closeout

Form changes autosave; failed saves remain visible and preserve input. If a
stale-revision conflict occurs, copy nonsensitive draft text to an approved
location, reload saved progress, compare the other panel's changes, and retry.
Do not reset or overwrite corrupt records to make an error disappear.

If live access is unavailable, use supported proposal/prepared discussion and
record the missing live checks. If the canvas is unavailable, use the single
block Markdown file and supporting scenario as a worksheet. Neither fallback
grants live completion.

Finish with the sandbox-specific rollback and retention process. Removing
participant artifacts or changing production settings requires separate
authorization; exporting a checklist does not grant it.

Before ending the session, confirm that attendees have their reviewed exports,
know whether any authorized cleanup remains, and have a contact for unresolved
access or content questions. Capture nonsensitive delivery feedback separately
from participant evidence for the next workshop revision.
