# GitHub Copilot at scale: An interactive lab for enterprise admins

[GitHub Universe 2026 session](https://reg.githubuniverse.com/flow/github/universe26/attendee-portal/page/sessioncatalog/session/1788880889921001wVyZ)

[![Open in the GitHub Copilot app](https://img.shields.io/badge/Quickstart-Open%20in%20GitHub%20Copilot%20app-8957e5?style=for-the-badge&logo=githubcopilot&logoColor=white)](https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fgithub.com%2Foctodemo%2Fcopilot-governance-at-scale)

*(The badge uses a* [*GitHub Copilot app deep link*](https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links#available-app-links) *to open this repository. See the* [*app quickstart*](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app) *for setup.)*

### Session description

Explore the decisions behind deploying GitHub Copilot at enterprise scale.
Use an interactive workshop canvas in the GitHub Copilot app to work through
access, models and features, cost control, agent governance, context, and
observability. Start with your enterprise's needs, connect decisions to
configuration guidance, and practice approved exercises in a sandbox.

Leave with a Governance Summary that captures your choices, observations, and
unresolved questions. It is a starting point for your organization's rollout
planning, not an audit or authorization to change production settings.

### 🚀 Getting started

#### In a guided session

If you're following along during the live workshop:

1. Open the [attendee instructions](instructions/README.md).
2. Review the prerequisites, then follow **Exercise 0** to connect this
   repository to the GitHub Copilot app and open the workshop canvas.
3. Confirm your assigned sandbox with the presenters and work through the
   blocks they select.

#### On your own

If you're learning at your own pace:

1. Open the [attendee instructions](instructions/README.md).
2. Complete **Exercise 0**, then choose a block whose prerequisites you meet.
3. Work through Understand, Decide, Configure, and Verify. Use only an
   authorized sandbox for live exercises, and export your Governance Summary
   when you finish.

You can explore the six blocks independently; there is no fixed exercise count.
Without sandbox access, use the material for discussion and planning without
claiming live configuration or validation.

### 🎯 Learning outcomes

By the end of this session, you will be able to:

- Identify enterprise needs and trade-offs across the six governance areas.
- Connect access, model, feature, and cost decisions to relevant configuration
  guidance.
- Define boundaries for agent actions and AI context, and distinguish adoption
  and activity from engineering impact.
- Record what an approved sandbox exercise demonstrated and what remains
  unverified.
- Export a decision record to support further review and rollout planning.

| Workshop block | Guiding question |
| --- | --- |
| **01 — Access Management** | Who gets access? |
| **02 — User Governance** | Which models and features can your users use? |
| **03 — Billing & Cost Control** | Who pays, and how do you manage consumption and financial reporting? |
| **04 — Agent Governance** | Where can agents operate, and which tools and actions can they use? |
| **05 — Context Management** | How do you guide AI behavior and handle sensitive-information concerns? |
| **06 — Observability** | How do you assess adoption, agent activity, and engineering impact? |

### 💻 Technologies used

- [GitHub Copilot app](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app)
- [Canvas extensions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions),
  including this repository's **Copilot Governance Workshop** (`governance-lab`)
- [GitHub Copilot enterprise administration](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise)
- Markdown and JSON for take-home decision records

### 📚 Continue your learning

Pick your next step based on your learning goals:

| Resource | What you'll get |
| --- | --- |
| [**Universe session page**](https://reg.githubuniverse.com/flow/github/universe26/attendee-portal/page/sessioncatalog/session/1788880889921001wVyZ) | The event listing for this workshop |
| [**Rolling out GitHub Copilot at Scale**](https://docs.github.com/copilot/tutorials/roll-out-at-scale) | Guidance on managing a Copilot rollout in your organization or enterprise |
| [**Managing Copilot in your enterprise**](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise) | Guidance on enterprise access, policies, agents, models, and audit logs |
| [**GitHub Copilot app quickstart**](https://docs.github.com/en/copilot/get-started/quickstart-copilot-app) | Installation, sign-in, repository connection, and session setup |

### 👥 Content owners

<table>
<tr>
    <td align="center"><a href="https://github.com/scubaninja">
        <img src="docs/images/scubaninja.jpg" width="100" alt="@scubaninja"/><br />
        <sub><b>@scubaninja</b></sub></a>
    </td>
    <td align="center"><a href="https://github.com/davelosert">
        <img src="docs/images/davelosert.jpg" width="100" alt="@davelosert"/><br />
        <sub><b>@davelosert</b></sub></a>
    </td>
</tr>
</table>

### Deliver this session

Presenters and re-delivery partners can use:

| Guide | What it covers |
| --- | --- |
| [**Facilitator guide**](docs/facilitator-guide.md) | Session preparation, run of show, discussion prompts, interruptions, and closeout |
| [**Workshop setup guide**](docs/setup.md) | App and repository setup, sandbox handoff, rehearsal, validation, and troubleshooting |
