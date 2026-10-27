# Attendee instructions

## GitHub Copilot at scale: An interactive lab for enterprise admins

Use the GitHub Copilot app and this repository's **Copilot Governance Workshop**
canvas to explore enterprise governance decisions and record what you learn.

[Back to the workshop overview](../README.md) |
[GitHub Universe session page](https://reg.githubuniverse.com/flow/github/universe26/attendee-portal/page/sessioncatalog/session/1788880889921001wVyZ)

## Prerequisites

Before you begin, have:

- A computer with Git installed and access to the
  [GitHub Copilot app download](https://github.com/features/ai/github-app).
- A GitHub account and access to Copilot in the app. Follow the
  [official app quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app)
  for supported sign-in and model-provider options.
- Access to [this workshop repository](https://github.com/octodemo/copilot-governance-at-scale).
- For live configuration exercises, an explicitly authorized sandbox and the
  access required by the selected exercise. During the workshop, get the exact
  enterprise, organization, repository, and permitted actions from the presenters.
- An approved location outside the repository for your exported notes.

If your access comes from Copilot Business or Copilot Enterprise, your
organization's policies must permit use of the app. Resolve access issues with
your administrator rather than changing policies to get through setup. See the
[app prerequisites](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app#prerequisites).

You do not need production administrator access to discuss the decisions.
Without an authorized sandbox, stay with discussion and planning, or use a
prepared/proposal alternative where the exercise provides one. Do not mark a
live check complete when you have not performed it.

## Exercise 0: Open your workshop

### 1. Install and sign in to the GitHub Copilot app

Install the app using the
[official quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app).
Open it, select **Sign in to GitHub**, and complete sign-in with the account you
will use for the workshop.

Keep passwords, tokens, and other credentials out of chat, canvas notes, and
exports.

### 2. Connect the workshop repository

1. In the app sidebar, next to **Projects**, select **+**.
2. Under **Add project from**, choose **GitHub repository**.
3. Find and clone `octodemo/copilot-governance-at-scale`. If the presenters
   explicitly assign a different workshop copy, use that repository instead.

If you already cloned the workshop, choose **Local folder or repository** and
select that checkout instead. These connection options are described in the
[app quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app#connecting-a-repository-or-folder).

### 3. Start a session and open the participant canvas

Start a new session for the connected workshop project using **+** next to the
project. Choose **Interactive** mode, as described in the
[session quickstart](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app#making-your-first-code-changes).
Send this prompt:

```text
Open this repository's existing governance-lab canvas for me.
Use documentId "universe-2026" and dev false.
Do not create or modify a canvas, edit repository files, or change any
GitHub settings. If the canvas is unavailable, report the problem and stop.
```

The panel should be titled **Copilot Governance Workshop**. It should offer
six blocks, starting with **Access Management**. Use `governance-lab`.

This repository contains its workshop extension under
`.github/extensions/governance-lab/`. For background on repository-scoped
canvases, see
[Working with canvas extensions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions).
You are opening the existing workshop, not asking the agent to build a new one.

### 4. Confirm your lab accounts

Check **Your Enterprise** and **Your Organization** in the canvas against the
targets supplied by your presenters or approved for your own practice.
Detection is not permission to make changes.

If automatic detection fails, use **Configure enterprise profile** and enter
the approved **Enterprise slug** and **Organization slug**. Get these values
from your presenters or, when practicing on your own, from the owner of your
authorized sandbox; do not guess them or substitute a production account.
If the displayed accounts are wrong, pause and ask the presenters or sandbox
owner for help before following any settings links.

The canvas records your decisions and observations. It does not provision your
sandbox or perform administrative changes for you.

### 5. Check that you are ready

Before starting live work, confirm that the workshop panel opens, the selected
block's prerequisites are met, and you know the permitted target, scope,
consequences, and rollback steps for any change.

If an account, permission, or exercise prerequisite is missing, record the
blocker and work with your presenter. Do not enable spending, broaden access,
or weaken safeguards just to complete an exercise.

## Work through a block

During the live session, follow the presenters' selection and pace. On your
own, choose any block whose prerequisites you meet; you do not have to complete
every block in order.

| Stage in the canvas | What to do |
| --- | --- |
| **Understand** | Read the introduction and identify your enterprise's needs and the main trade-offs. |
| **Decide** | Work through the decision cards. Keep uncertain choices unresolved rather than guessing. |
| **Configure** | Follow the applicable guidance and exercises. Confirm authorization before making a live change. |
| **Verify** | Follow each exercise's validation steps and record what you observed, including limitations. |

The source documents call Decide and Verify **Decisions** and **Validation**.
A decision may lead to guidance, one or more exercises, or no action. Guidance
is not exercise completion, and reading a block is not proof of configuration.

Use the canvas as your main workspace. If you need a reading-only fallback,
the same four stages are available in each block's Markdown:

| Block | Workshop source |
| --- | --- |
| 01 - Access Management | [Read the block](../content/access-management.md) |
| 02 - User Governance | [Read the block](../content/user-governance.md) |
| 03 - Billing & Cost Control | [Read the block](../content/billing-cost-control.md) |
| 04 - Agent Governance | [Read the block](../content/agent-governance.md) |
| 05 - Context Management | [Read the block](../content/context-management.md) |
| 06 - Observability | [Read the block](../content/observability.md) |

Keep fallback notes outside the checkout. Prepared examples and fictional data
do not establish that your live environment behaves the same way.

## Save your take-home record

Form edits autosave. Resolve any visible save error before exporting or leaving
the session.

1. Open **Governance Summary**.
2. Review your decisions, exercise evidence, and unresolved items. Distinguish
   work you performed from proposals, prepared examples, and historical records.
3. Select **Export Markdown** for a readable record or **Export JSON** for
   structured data.
4. Save the export outside the repository and review it for sensitive notes,
   account details, and confidential information before sharing.
5. Complete any sandbox cleanup agreed with the presenters.

Keep the same app session and document ID when returning to your work. To
reopen the panel, reuse the prompt from Exercise 0. Do not reset progress or
start a separate attempt when you intend to resume your existing record.

Your summary is participant-reported evidence, not a live audit or approval
for a production rollout. Use it to identify the reviews and checks still
needed in your own organization.

## If you get stuck

| Problem | What to do |
| --- | --- |
| Sign-in or app access fails | Revisit the [official prerequisites](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app#prerequisites) and contact your administrator or presenter. |
| The repository is unavailable | Confirm the assigned repository and your access with the presenters. |
| The workshop canvas is unavailable | Confirm that your session belongs to the workshop repository. Ask the agent to report the loading error, not generate a replacement. Use the block Markdown as a discussion worksheet while the presenter investigates. |
| Lab accounts are missing or incorrect | Confirm the assigned targets before proceeding. Use manual profile entry when offered; do not treat discovered accounts as authorization. |
| A save fails or a revision conflict appears | Preserve nonsensitive draft notes outside the repository. Ask for help reloading and reconciling saved progress; do not reset or overwrite it. |
| You cannot perform a live exercise | Record the missing prerequisite and use an authored alternative if available. Leave live validation incomplete. |

For ongoing learning, return to the
[resources in the workshop overview](../README.md#-continue-your-learning).
