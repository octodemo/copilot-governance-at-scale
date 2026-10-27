# Agent Governance
**Format version:** 1
**Block ID:** agent-governance
**Description:** Where can agents operate, what can they do, and who oversees their work?
**Subtitle:** Establish your agent governance model

## Understand

Agents can help developers turn a task into a proposed code change. Start with the work your teams need to do, then decide where agents can operate and which tools that work needs. A small pilot helps you learn before expanding. Broader availability can help more teams once the boundaries and review process are clear.

We recommend balancing developer access with specific security and compliance needs, rather than restricting every team in the same way. Review these choices as usage grows. See [Governing Copilot to support developer productivity](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/govern-for-adoption).

Work through six decisions:

1. **Scope:** where agents may operate.
2. **Coverage:** which changes should receive Copilot review.
3. **Timing:** when automatic reviews should run.
4. **Approval:** what oversight is needed before merging.
5. **Execution:** which tools and resources agents may use.
6. **Accountability:** who reviews activity and follows up on problems.

These are separate choices. For example, allowing a tool does not decide whether its actions need approval. A cloud firewall does not isolate a local process. See [managed client controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [cloud network controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-firewall).

### How the controls fit together

| Control | What it covers |
| --- | --- |
| Enterprise cloud-agent policy | Which organizations can use Copilot cloud agent, or whether organization administrators decide. Organization owners cannot override an enterprise-enforced policy. |
| Organization repository access | Which repositories allow cloud-agent work. A user also needs access to the agent and write permission to the repository. |
| Repository safeguards | Branch protection, rulesets, required checks and human review still matter when an agent proposes changes. |
| MCP policies and configuration | Whether third-party tools are allowed, and which tools and data are available on the chosen Copilot surface. |
| Code review and approval | AI review availability, when reviews are requested, and whether an AI approval can count toward merge requirements are separate controls. |
| Execution environment | Runners, firewall rules and Agents secrets govern different parts of cloud execution. Managed sandbox settings apply to supported local clients. |

See [enterprise agent management](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/agent-management), [enterprise scope options](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-coding-agent-management), [organization repository access](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/add-copilot-cloud-agent) and [code review controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review).

### Tool access depends on where the agent runs

Cloud agent uses repository MCP settings and can also use MCP servers defined in custom agent profiles. It calls configured tools autonomously, without asking for approval before each call. We recommend allowing only the tools needed for the task, preferably read-only tools.

Copilot app and CLI use client controls such as managed MCP allowlists. Those allowlists and registry restrictions do not control cloud agent. A built-in server is also different from a third-party integration: disabling third-party access does not establish that every tool is unavailable.

See [MCP configuration and defaults](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/customizations/mcp) and [enterprise MCP allowlists](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist).

### Connect this to your other decisions

Use Access Management for licenses and policy groups, and User Governance for model and feature availability. Billing & Cost Control owns spending limits. Context Management covers guidance and sensitive information, while Observability covers adoption, agent activity and engineering impact.

Here, you will inspect or change cloud-agent scope in your assigned sandbox, then check one repository. The other choices produce configuration proposals and read-only inspections, not deployed integrations or client policies. These checks support governance decisions; they do not certify regulatory compliance or prove that every repository is safe.

Follow **Understand -> Decide -> Configure -> Verify**. Start with the need, choose an approach, inspect the relevant controls, then check what your sandbox can demonstrate. The result is a governance plan with named owners and clear limits on what you verified. See [Rolling out GitHub Copilot at scale](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale).

## Decisions

Answer for your enterprise's needs. In Configure, apply the scope choice only to your assigned test resources.

### Decision: AG-01
**Title:** Agent operating scope
**Policies:** agent.cloud-availability, agent.repository-safeguards
**Catalog IDs:** agents-context.cloud-agent-access, agents-context.repository-rulesets

#### Question

Where should your teams be able to use agents?

#### Guidance

Some teams are ready to use agents in everyday work. Others need a smaller trial or have requirements to resolve first. Choose the scope that fits those needs, with an owner for reviewing results and handling exceptions.

This choice concerns Copilot cloud agent. Enterprise availability and organization repository access are separate controls. It does not set policy for local agents or third-party agents. Consider repository sensitivity, regulatory requirements and organizational readiness.

#### Option: all
**Label:** Enterprise-wide with repository restrictions
**Configure:** ag-lab-exercise

Teams are ready for broader use. Keep sensitive repositories outside the permitted repository selection. Broad availability does not remove review requirements.

#### Option: pilot
**Label:** Selected organizations and repositories
**Configure:** ag-lab-exercise

Start with a limited group, a small task and a reviewable result before deciding whether to expand.

#### Option: disabled
**Label:** Approval-based access
**Configure:** ag-lab-exercise

Keep cloud agent disabled until the responsible owner approves a defined scope. This is your approval process, not an automatic access-request workflow.

### Decision: AG-02
**Title:** Code review coverage
**Policies:** agent.code-review
**Catalog IDs:** agents-context.code-review-policy, agents-context.code-review-effort-level, agents-context.repository-rulesets

#### Question

Which code changes need Copilot review?

#### Guidance

Consider code quality, repository criticality and review consistency. Choose the repositories and branches first; the next decision addresses timing. Automatic review requests do not replace required merge approvals. Consumption planning belongs in Billing & Cost Control.

#### Option: all
**Label:** All pull requests in governed repositories
**Configure:** ag-code-review

Plan automatic requests across the governed repositories and target branches. Availability and timing still determine which pull requests can be reviewed.

#### Option: critical
**Label:** Critical repositories only
**Configure:** ag-code-review

Target automatic requests at named business-critical or sensitive repositories.

#### Option: requested
**Label:** Developer-requested reviews
**Configure:** ag-code-review

Make reviews available to the intended developers without adding an automatic review requirement.

### Decision: AG-03
**Title:** Code review timing
**Policies:** agent.code-review
**Catalog IDs:** agents-context.code-review-policy, agents-context.repository-rulesets

#### Question

When would automatic review feedback be most useful?

#### Guidance

Consider early feedback, review frequency, developer workflow and consumption. Draft coverage and new-push coverage are independent settings. Choose the starting pattern that fits your workflow, then record whether you need both. If reviews are developer-requested, this is a future preference, not a request to enable automatic review.

#### Option: opened
**Label:** When a pull request is opened or becomes ready
**Configure:** ag-review-timing

Request one automatic review when a non-draft pull request is opened or a draft first becomes ready for review.

#### Option: drafts
**Label:** Include draft pull requests
**Configure:** ag-review-timing

Include drafts for earlier feedback. Decide separately whether later pushes also need another review.

#### Option: pushes
**Label:** On every new push
**Configure:** ag-review-timing

Request another review as commits are added. Decide separately whether this also includes draft pull requests.

### Decision: AG-04
**Title:** Approval requirements
**Policies:** agent.repository-safeguards, agent.code-review
**Catalog IDs:** agents-context.repository-rulesets, agents-context.code-review-policy

#### Question

What oversight is required before changes are merged?

#### Guidance

Consider risk, segregation of duties, required reviewers and human accountability. An AI review comment, an approving review and an approval that counts toward merge requirements are different outcomes. Copilot approvals are in public preview and require separate controls. Keep existing sandbox protections intact.

#### Option: human
**Label:** Single human approval
**Configure:** ag-merge-oversight, ag-review-approval

Set a minimum of one human reviewer for ordinary changes. Existing protections may require more; do not reduce them for this exercise.

#### Option: critical
**Label:** Additional approvals for critical code
**Configure:** ag-merge-oversight, ag-review-approval

Plan multiple reviewers or designated code owners for the relevant changes.

#### Option: ai
**Label:** AI-assisted approval where explicitly enabled
**Configure:** ag-merge-oversight, ag-review-approval

Assess a defined scope where Copilot approvals could count toward merge requirements. Record the remaining human responsibilities before any rollout.

### Decision: AG-05
**Title:** Agent execution and tool permissions
**Policies:** agent.cloud-mcp, agent.client-managed-settings, agent.repository-safeguards, agent.runners, agent.firewall, agent.credentials, agent.custom-agents, agent.plugin-standards, agent.sandbox, agent.computer-use, agent.remote-control, agent.partner-agents, agent.automations
**Catalog IDs:** extensions-plugins.mcp-servers-policy, extensions-plugins.mcp-allowlist, extensions-plugins.mcp-registry, extensions-plugins.managed-settings, agents-context.tool-permissions, agents-context.repository-rulesets, agents-context.cloud-agent-access, agents-context.code-review-runners, agents-context.agent-firewall, agents-context.agent-secrets-and-variables, agents-context.custom-agents, extensions-plugins.plugin-standards, agents-context.sandbox, models-features.computer-use, agents-context.remote-control, agents-context.partner-agents, agents-context.agent-apps, agents-context.automations

#### Question

How much autonomy do your teams' agent tasks need?

#### Guidance

Start with the task, tools, data and consequences. Consider MCP access, commands, external integrations, credentials, network destinations and workflow approvals. Cloud and local clients use different controls; there is no universal autonomy switch. The linked guidance keeps those controls separate.

Apply only the guidance relevant to your workload. Selecting a posture does not authorize every capability, a partner integration or recurring work.

#### Option: restricted
**Label:** Restricted execution
**Configure:** ag-cloud-tool-review, ag-client-tool-review, ag-client-approvals, ag-workflow-approval, ag-cloud-runners, ag-review-runners, ag-firewall, ag-credentials, ag-custom-agents, ag-plugin-standards, ag-sandbox, ag-computer-use, ag-remote-control, ag-partner-agents, ag-agent-apps, ag-automations

Limit work to approved tools, commands, resources and explicitly authorized workflows. Keep unnecessary capabilities outside the intended scope.

#### Option: risk
**Label:** Risk-based permissions
**Configure:** ag-cloud-tool-review, ag-client-tool-review, ag-client-approvals, ag-workflow-approval, ag-cloud-runners, ag-review-runners, ag-firewall, ag-credentials, ag-custom-agents, ag-plugin-standards, ag-sandbox, ag-computer-use, ag-remote-control, ag-partner-agents, ag-agent-apps, ag-automations

Permit named low-risk operations automatically where supported. Require human approval for sensitive actions through the control that governs each surface.

#### Option: broader
**Label:** Broader autonomous execution within defined boundaries
**Configure:** ag-cloud-tool-review, ag-client-tool-review, ag-client-approvals, ag-workflow-approval, ag-cloud-runners, ag-review-runners, ag-firewall, ag-credentials, ag-custom-agents, ag-plugin-standards, ag-sandbox, ag-computer-use, ag-remote-control, ag-partner-agents, ag-agent-apps, ag-automations

Allow more routine work under an owned policy. Keep resource limits, enforced denials, required approvals and a way to stop the work.

### Decision: AG-06
**Title:** Monitoring and accountability
**Policies:** agent.repository-safeguards
**Catalog IDs:** none

#### Question

Who will review agent activity and act on the findings?

#### Guidance

Consider audit requirements, usage, spending, policy compliance and incident ownership. Choose the operating model here. Use Observability to configure activity evidence and reporting, and Billing & Cost Control for consumption guardrails. A dashboard or audit record alone does not establish compliance.

#### Option: periodic
**Label:** Audit logging and periodic reviews
**Configure:** ag-monitoring-ownership

Name an owner, review interval and escalation path for supported activity records.

#### Option: central
**Label:** Centralized monitoring
**Configure:** ag-monitoring-ownership

Have a central team coordinate visibility and follow-up across the enterprise. Identify coverage gaps rather than assuming every action appears in one view.

#### Option: teams
**Label:** Team-managed monitoring
**Configure:** ag-monitoring-ownership

Delegate operational oversight to organizations or teams while retaining common reporting expectations and an escalation owner.

## Configure

Work in your assigned test enterprise, organization and repository. The first exercise follows your operating-scope choice. The remaining walkthroughs help you inspect controls and prepare a proposal. They do not publish managed settings, provision runners, add secrets, install apps or create automations.

### Recipe: ag-lab-exercise
**Title:** Bound a cloud agent pilot
**Kind:** exercise
**Exercise ID:** AG-LAB
**Policies:** agent.cloud-availability, agent.repository-safeguards
**Catalog IDs:** agents-context.cloud-agent-access, agents-context.repository-rulesets
**Requires decisions:** AG-01
**Variant decision:** AG-01
**Target:** github-page
**Primary choice label:** agent-scope

Inspect the current scope before changing it. Keep a record of the original policy and repository access so you can restore them after the check.

#### Safety

Use only your assigned test resources. Do not change production access, add credentials or external tools, bypass repository safeguards, or enable automatic workflow approval. Stay within the existing lab allowance; do not raise budgets or enable paid usage to make a task run.

#### Prerequisites

- Your assigned sandbox enterprise, organization, test developer and repository.
- An enterprise owner or AI manager for enterprise policy, an organization owner for repository access, and repository write access for the test developer.
- A small task, such as adding a README example, with no production data or secrets.
- Access to the original settings for restoration. If live access is unavailable, use the fictional example in Validation without claiming a live result.

#### Steps

1. Confirm the test user's license and policy group from Access Management. Leave license assignments unchanged.
2. Inspect the assigned repository's existing branch protection, rulesets and required checks. Keep those safeguards unchanged.
3. Follow the scope steps for your answer below. If the enterprise delegates availability to organization administrators (`configured_by_org_admins`), inspect the organization policy as well as repository access. Do not infer enabled access from delegation alone.
4. If a required setting or permission is unavailable, record the limitation instead of working around it. See [enterprise delegation](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-coding-agent-management).

#### Variant: pilot

##### Scope

enterprise

##### Role

Enterprise owner or AI manager; organization owner for repository access

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot Cloud Agent](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**.
2. Record the original policy. In your isolated test enterprise, choose `Enabled for selected organizations` and select your assigned organization individually. If the enterprise is shared, inspect without changing other participants' access and record that limitation.
3. Navigate to your **[Organization Settings -> Copilot -> Cloud agent](https://github.com/organizations/{{organization.slug}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations") -> Repository access**. Record the original selection. In your isolated organization, choose `Selected repositories`, select your assigned repository, then click `Select`.
4. Reopen both settings and confirm the saved scope. Continue to Validation to check the intended developer and repository.

#### Variant: all

##### Scope

enterprise

##### Role

Enterprise owner or AI manager; organization owner for repository access

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot Cloud Agent](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**.
2. Record the original policy. In an isolated enterprise where all organizations are assigned to you, enable cloud agent for all organizations. If the enterprise is shared, inspect the existing policy without expanding it and record that limitation.
3. Navigate to your **[Organization Settings -> Copilot -> Cloud agent](https://github.com/organizations/{{organization.slug}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations") -> Repository access**. Inspect whether your assigned repository is allowed. Broader enterprise availability does not require removing repository restrictions.
4. Reopen the enterprise policy and confirm its value. Validation samples your assigned repository; it does not prove availability in every organization.

#### Variant: disabled

##### Scope

enterprise

##### Role

Enterprise owner or AI manager; organization owner for repository access

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot Cloud Agent](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**.
2. Record the original policy. Disable cloud agent in your isolated test enterprise. If the enterprise is shared, inspect without changing other participants' access and record that limitation.
3. Navigate to your **[Organization Settings -> Copilot -> Cloud agent](https://github.com/organizations/{{organization.slug}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations") -> Repository access**. Inspect the repository selection. This cannot override an enterprise-enforced disabled policy.
4. Reopen the enterprise policy and confirm that it is disabled. Continue to Validation without starting an agent task.

#### Fallback

If live access or time is unavailable, read the fictional session in Validation. Keep its observations separate from settings you inspected or changed yourself.

### Recipe: ag-code-review
**Title:** Plan useful AI review coverage and depth
**Kind:** guidance
**Policies:** agent.code-review
**Catalog IDs:** agents-context.code-review-policy, agents-context.code-review-effort-level, agents-context.repository-rulesets
**Requires decisions:** AG-02

Inspect current settings and write the desired scope. Do not request a paid review or change billing settings for this walkthrough.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot code review](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**. Inspect the availability policy for the intended users.
2. For automatic coverage, navigate to your **[Organization Settings -> Repository -> Rulesets](https://github.com/organizations/{{organization.slug}}/settings/rules "fallback=https://github.com/settings/organizations")** or **[Repository Settings -> Rulesets -> Rulesets](https://github.com/{{organization.slug}}/{{repository.name}}/settings/rules "fallback=https://github.com/settings/organizations")**. Inspect a branch ruleset's targets and `Automatically request Copilot code review`. For **All pull requests in governed repositories**, list all governed repositories and relevant target branches. For **Critical repositories only**, name the critical subset.
3. For **Developer-requested reviews**, do not add a new automatic rule. Existing personal settings and repository or organization rulesets are independent sources of automatic review; inspect them before claiming that automatic reviews are off. Use the separate timing walkthrough for draft and new-push settings.
4. Navigate to your **[Organization Settings -> Copilot -> Code review](https://github.com/organizations/{{organization.slug}}/settings/copilot/code_review "fallback=https://github.com/settings/organizations")** and inspect `Review effort level` for the organization default. Inspect the same setting at **[Repository Settings -> Copilot -> Code review](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/code_review "fallback=https://github.com/settings/organizations")** for repository automatic reviews. `Lite` provides standard review; `Balanced` adds deeper analysis of complex logic, security-sensitive code and cross-service changes.
5. Review `Only allow Copilot code review to be triggered by authorized users` if external Copilot licenses should not request reviews. An organization-enforced restriction cannot be turned off by a repository administrator.
6. Record a sample pull request and the feedback that would demonstrate useful coverage in a later trial. Keep human review and required checks. Send the consumption and billing decision to Billing & Cost Control.

See [enterprise review enablement](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/enable-copilot-code-review) and [automatic reviews and effort levels](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review).

### Recipe: ag-review-timing
**Title:** Match review timing to the development workflow
**Kind:** guidance
**Policies:** agent.code-review
**Catalog IDs:** agents-context.code-review-policy, agents-context.repository-rulesets
**Requires decisions:** AG-02, AG-03

Inspect without changing review frequency or requesting a review.

#### Steps

1. Check the coverage decision. If reviews are developer-requested, record a future timing preference without enabling an automatic rule.
2. Navigate to your **[Organization Settings -> Repository -> Rulesets](https://github.com/organizations/{{organization.slug}}/settings/rules "fallback=https://github.com/settings/organizations")** or **[Repository Settings -> Rulesets -> Rulesets](https://github.com/{{organization.slug}}/{{repository.name}}/settings/rules "fallback=https://github.com/settings/organizations")**. Inspect the relevant rule's `Automatically request Copilot code review`.
3. For one review when opened or ready, plan to leave `Review new pushes` and `Review draft pull requests` off. Non-draft pull requests receive an automatic review when opened; drafts receive one when first marked ready.
4. For earlier draft feedback, propose `Review draft pull requests`. For a review after each new push, propose `Review new pushes`. These settings can be combined; record both values rather than treating the options as mutually exclusive capabilities.
5. Inspect personal settings and other applicable rulesets. One source cannot disable draft or push reviews enabled by another. Record the expected review events and the consumption owner in Billing & Cost Control.

See [automatic review settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review) and [review triggers](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review#triggering-an-automatic-pull-request-review).

### Recipe: ag-merge-oversight
**Title:** Define required reviewers without weakening protections
**Kind:** guidance
**Policies:** agent.repository-safeguards, agent.code-review
**Catalog IDs:** agents-context.repository-rulesets
**Requires decisions:** AG-04

Inspect the existing merge requirements and write a proposal. Do not lower the approval count, change bypass permissions or enable AI approval counting here.

#### Steps

1. Navigate to your **[Repository Settings -> Rulesets -> Rulesets](https://github.com/{{organization.slug}}/{{repository.name}}/settings/rules "fallback=https://github.com/settings/organizations")**. Inspect the target branches, enforcement and bypass permissions of the relevant rulesets. Also inspect existing branch protections before proposing a change.
2. Under `Require a pull request before merging`, record the required approval count. For **Single human approval**, propose a minimum of one human reviewer without reducing stronger existing requirements.
3. For **Additional approvals for critical code**, record the intended reviewer count and code-owner requirement. Multiple names in CODEOWNERS do not by themselves require multiple approvals: approval from any listed code owner can satisfy the code-owner requirement.
4. Inspect stale-approval dismissal and approval of the most recent reviewable push. Record who must review newly pushed changes and how required checks remain enforced.
5. For **AI-assisted approval where explicitly enabled**, use the separate AI approval walkthrough. Decide which requirements AI approvals may satisfy and which remain human responsibilities. A required approval count alone does not express that distinction once AI approval counting is enabled.

See [pull-request review rules](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging) and [Copilot approval controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review).

### Recipe: ag-review-approval
**Title:** Separate AI reviews from merge approval
**Kind:** guidance
**Policies:** agent.code-review, agent.repository-safeguards
**Catalog IDs:** agents-context.code-review-policy, agents-context.repository-rulesets
**Requires decisions:** AG-04

Copilot approvals are in public preview. Inspect the controls below without enabling approvals or weakening human merge requirements.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot code review](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**. Inspect `Allow Copilot to approve pull requests`. The choices are `Let organizations decide`, `Enable for selected organizations` and `Disabled everywhere`.
2. Navigate to your **[Organization Settings -> Copilot -> Code review](https://github.com/organizations/{{organization.slug}}/settings/copilot/code_review "fallback=https://github.com/settings/organizations")**. Under `Approvals`, inspect `Count Copilot approvals toward merge requirements`. Record whether it applies everywhere, to selected repositories, is delegated to repositories, or is disabled.
3. Navigate to your **[Repository Settings -> Copilot -> Code review](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/code_review "fallback=https://github.com/settings/organizations")**. Inspect `Auto-approval`, including `Allow Copilot to approve pull requests` and `Allow Copilot approvals to count toward merge requirements`. Inspect any file-path limits.
4. Compare those settings with the repository's required approvals and checks. For either human-approval choice, plan to prevent AI approvals from replacing the required human review. For **AI-assisted approval where explicitly enabled**, record the proposed file scope, approval-counting policy and remaining human responsibilities. Do not enable that proposal or weaken safeguards here.

See [code review approval controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review).

### Recipe: ag-cloud-tool-review
**Title:** Review external tools for cloud agent
**Kind:** guidance
**Policies:** agent.cloud-mcp
**Catalog IDs:** extensions-plugins.mcp-servers-policy
**Requires decisions:** AG-05

Inspect existing configuration only. This walkthrough prepares your tool proposal; it does not configure or verify MCP access.

#### Steps

1. List the external service, data and actions the task needs. Name each reviewed server and tool, the responsible owner and any third-party connections to block. Broader autonomy still needs a defined tool boundary.
2. Navigate to your **[Enterprise Settings -> AI controls -> MCP](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/mcp "fallback=https://github.com/settings/enterprises")**. Inspect `MCP servers in Copilot` without changing it. This is separate from the cloud-agent availability policy.
3. Navigate to your **[Repository Settings -> Copilot -> MCP servers](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/mcp "fallback=https://github.com/settings/organizations")**. This page is available only when MCP servers are enabled for the enterprise or organization. Inspect existing server and `tools` entries without saving changes. Repository MCP settings are shared with Copilot code review; include that impact in your proposal.
4. Review whether a custom agent profile adds MCP servers. Check the required tool permissions and credential scope without copying secret values. Prefer specific read-only tools to `*`, which enables all tools from that server.
5. Distinguish default servers from third-party connections. Cloud agent starts with GitHub and Playwright MCP servers. Registry restrictions and client managed allowlists do not apply to cloud agent.

See [repository MCP configuration](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers) and [enterprise MCP policy](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/enable-copilot-cloud-agent).

### Recipe: ag-client-tool-review
**Title:** Review external tools for Copilot app and CLI
**Kind:** guidance
**Policies:** agent.client-managed-settings
**Catalog IDs:** extensions-plugins.mcp-allowlist, extensions-plugins.mcp-registry, extensions-plugins.managed-settings, agents-context.tool-permissions
**Requires decisions:** AG-05

Use this reference for teams using Copilot app or CLI. Do not deploy managed settings or change your current client's permissions during this exercise.

#### Steps

1. Identify the client and the administrator responsible for its `managed-settings.json`. Check the supported-key matrix before proposing a setting for another client.
2. Plan `allowedMcpServers` entries for required server URLs or exact local commands. Review `deniedMcpServers` too: a deny rule takes precedence. User-chosen server names alone do not establish server identity.
3. For broader autonomous execution, review the existing lists and their scope. Do not remove restrictions simply to add a server.
4. If no external tools are needed, review the enterprise MCP policy and a client allowlist with no third-party matches. An empty `allowedMcpServers` array still permits built-in default servers.
5. Inspect any existing registry restriction before planning a change. We recommend managed allowlists for restricting MCP access rather than the public-preview registry restriction. Do not remove an existing restriction until its replacement has been reviewed.
6. Review `permissions.allow`, `permissions.ask`, `permissions.deny` and `permissions.disableBypassPermissionsMode` for action-level boundaries on supported clients. These settings do not govern cloud-agent tool calls.
7. Record the proposed controls, supported clients, expected allowed and blocked actions, and who will test them before a production rollout.

See [MCP allowlists](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist), [registry restrictions](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-mcp-registry) and [managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings).

### Recipe: ag-client-approvals
**Title:** Map client operations to approval rules
**Kind:** guidance
**Policies:** agent.client-managed-settings
**Catalog IDs:** agents-context.tool-permissions, extensions-plugins.managed-settings
**Requires decisions:** AG-05

Prepare a proposed rule list. Do not change the permissions of the client running this workshop.

#### Steps

1. Identify the client and deployment owner. For server-managed settings, inspect `copilot/managed-settings.json` in the designated `.github-private` repository. Confirm support for each key in the [managed-settings reference](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings).
2. List operations that must be blocked, operations that need a fresh approval, and any routine operations that can run without a prompt. Map them to `permissions.deny`, `permissions.ask` and `permissions.allow`. Precedence is deny, then ask, then allow.
3. For **Restricted execution**, propose explicit ask rules for consequential operations. For **Risk-based permissions**, add only named low-risk operations to the proposed allow list. For **Broader autonomous execution within defined boundaries**, document the additional operations and their owner. A managed ask rule requires fresh approval each time under all three approaches.
4. Review `permissions.disableBypassPermissionsMode: "disable"` to prevent allow-all behavior on supported clients. This is separate from sandbox bypass and cloud workflow approval.
5. Record a harmless allowed, prompted and blocked test for a later controlled rollout. Do not treat an unsupported client or a rules-file review as enforcement evidence. In VS Code, granular rules apply to Agent Host sessions.

See [managed-settings deployment](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/get-started).

### Recipe: ag-workflow-approval
**Title:** Keep cloud workflow approval explicit
**Kind:** guidance
**Policies:** agent.repository-safeguards
**Catalog IDs:** agents-context.repository-rulesets
**Requires decisions:** AG-05

#### Steps

1. Navigate to your **[Repository Settings -> Copilot -> Cloud agent](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations")**. Inspect `Actions workflow approval` and `Require approval for workflow runs` without changing them.
2. Record who reviews a proposed change before allowing its workflows to run. Pay particular attention to changes under `.github/workflows/`, because workflows can have repository write access and secrets.
3. Keep workflow approval, required checks and human review intact in the sandbox. Also leave `Validation tools` enabled. Do not turn off safeguards to speed up a demonstration.

Cloud-agent workflows require approval by default, but a repository administrator can configure automatic runs. Client permission rules do not control this switch. See [cloud-agent settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings).

### Recipe: ag-cloud-runners
**Title:** Review the cloud runner baseline and override authority
**Kind:** guidance
**Policies:** agent.runners
**Catalog IDs:** agents-context.cloud-agent-access
**Requires decisions:** AG-05

#### Steps

1. List the task's operating system, build tools, capacity and private-resource needs. Do not provision infrastructure during this walkthrough.
2. Navigate to your **[Organization Settings -> Copilot -> Cloud agent](https://github.com/organizations/{{organization.slug}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations")** and inspect `Runner type`. `Standard GitHub runner` uses `ubuntu-latest`; `Labeled runner` selects a runner group and/or label.
3. Record whether standard hosted runners meet the task's needs. If specialized runners are required, identify the proposed runner group, label and infrastructure owner without saving a change.
4. Inspect `Allow repositories to customize the runner type`. Decide whether teams can override the organization baseline through `runs-on` in the `copilot-setup-steps` job in `.github/workflows/copilot-setup-steps.yml`.
5. Record the proposed override authority. Review network access and credentials separately; selecting a runner does not establish least-privilege access.

See [organization runner configuration](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/configure-runner-for-coding-agent).

### Recipe: ag-review-runners
**Title:** Check code review runner compatibility
**Kind:** guidance
**Policies:** agent.runners
**Catalog IDs:** agents-context.code-review-runners
**Requires decisions:** AG-05

#### Steps

1. Navigate to your **[Organization Settings -> Copilot -> Runner type](https://github.com/organizations/{{organization.slug}}/settings/copilot/runner_type "fallback=https://github.com/settings/organizations")** and inspect the organization runner configuration. The organization default and repository-override control apply to both cloud agent and code review.
2. Inspect any `.github/workflows/copilot-code-review.yml` file in the assigned repository. Code review uses `copilot-setup-steps.yml` if the review-specific file is absent. Record which configuration is relevant without editing either.
3. For specialized infrastructure, check compatibility before proposing reuse. Code review supports Ubuntu x64 Linux runners. Actions Runner Controller (ARC) is the only supported self-hosted solution for code review.
4. Have the infrastructure owner plan required outbound connectivity and network security controls using the runner guide. Do not assume a cloud-agent-compatible runner is automatically suitable for code review.
5. Record a later trial that checks the actual review environment. A settings inspection does not establish private-resource connectivity or runner isolation.

See [code review runner requirements](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/set-up-copilot/configure-runners).

### Recipe: ag-firewall
**Title:** Review cloud network allowances and exceptions
**Kind:** guidance
**Policies:** agent.firewall
**Catalog IDs:** agents-context.agent-firewall
**Requires decisions:** AG-05

#### Steps

1. Navigate to your **[Organization Settings -> Copilot -> Internet access](https://github.com/organizations/{{organization.slug}}/settings/copilot/internet_access "fallback=https://github.com/settings/organizations")**. Inspect the separate cloud-agent and code-review sections. Record `Enable firewall`, `Recommended allowlist`, `Allow repository custom rules` and the organization custom allowlist.
2. Compare the required destinations with the existing allowances. Propose narrow URLs where path-level access is sufficient; a domain allowance also includes its subdomains.
3. Identify the organization-owned destination list and whether repository custom rules should remain available. List any required repository-specific destinations and their owners separately.
4. Navigate to your **[Repository Settings -> Copilot -> Internet access](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/internet_access "fallback=https://github.com/settings/organizations")** and inspect inherited settings and custom rules. Organization and repository allowances combine; repositories cannot delete organization allowances.
5. Keep the firewall enabled. Record an expected allowed request and an expected blocked request for a later trial, without making network probes or saving new rules here.

The firewall applies to processes the agent starts through its Bash tool inside the GitHub Actions appliance. It does not directly cover MCP server processes or setup-step processes, and it is not a complete defense against data exfiltration. See [firewall configuration and limitations](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-firewall).

### Recipe: ag-credentials
**Title:** Scope Agents secrets and variables
**Kind:** guidance
**Policies:** agent.credentials
**Catalog IDs:** agents-context.agent-secrets-and-variables
**Requires decisions:** AG-05

Inspect names and access scope only. Do not reveal, copy, create or rotate secret values during this walkthrough.

#### Steps

1. List the private resource and required operation, or record that no additional credential is needed. Keep data classification with Context Management.
2. Navigate to your **[Organization Settings -> Secrets and variables -> Agents](https://github.com/organizations/{{organization.slug}}/settings/secrets/agents "fallback=https://github.com/settings/organizations")**. Inspect which repositories can access existing entries: all, private, or selected repositories. Propose only the repositories that need each entry.
3. Navigate to your **[Repository Settings -> Secrets and variables -> Agents](https://github.com/{{organization.slug}}/{{repository.name}}/settings/secrets/agents "fallback=https://github.com/settings/organizations")**. Identify repository-specific names and any override of an organization-level name. Repository values take precedence.
4. Use a secret for sensitive values and a variable for nonsecret configuration. Agents secrets and variables are exposed as environment variables, except names prefixed with `COPILOT_MCP_`, which are only available to MCP servers. Do not assume Actions, Codespaces or Dependabot entries are available to cloud agent.
5. For a later deployment, name the credential owner, resource permissions, rotation plan and removal condition. If no additional credentials are needed, record unnecessary access for owner review without deleting anything here.

See [Agents secrets and variables](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/configure-secrets-and-variables).

### Recipe: ag-custom-agents
**Title:** Assign custom-agent publishers and protect their files
**Kind:** guidance
**Policies:** agent.custom-agents
**Catalog IDs:** agents-context.custom-agents, agents-context.repository-rulesets
**Requires decisions:** AG-05

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents "fallback=https://github.com/settings/enterprises") -> Configuration source**. In this lab, the configuration source is already set up with a `.github-private` repository. Identify the source organization and its `.github-private` repository without changing the source.
2. List the people responsible for publishing, reviewing and maintaining agent profiles. For central ownership, name the central team. For delegated ownership, identify the domain owners and the review boundary they share.
3. Inspect `Protect agent files using rulesets` on **[Enterprise Settings -> AI controls -> Agents](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents "fallback=https://github.com/settings/enterprises")**. Do not create the ruleset in this walkthrough.
4. Review the proposed ruleset's scope and bypass authority. The generated ruleset limits profile edits to enterprise owners and can also block organization owners from creating or editing organization-level agents. Narrowing its target to the source organization changes that impact.
5. Record who may propose changes and who may merge them. Keep instruction content and sensitive-data boundaries in Context Management.

See [custom-agent preparation](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/prepare-for-custom-agents).

### Recipe: ag-plugin-standards
**Title:** Plan plugin distribution from the approved baseline
**Kind:** guidance
**Policies:** agent.plugin-standards
**Catalog IDs:** extensions-plugins.plugin-standards, extensions-plugins.managed-settings
**Requires decisions:** AG-05

#### Steps

1. Inspect `copilot/managed-settings.json` in the designated `.github-private` repository. Identify who reviews marketplace and plugin changes before they reach users.
2. List the approved sources in a proposed `extraKnownMarketplaces` map. Decide whether marketplace updates should be centrally controlled with `autoUpdate`.
3. Review `enabledPlugins` for plugins that must be enabled or disabled. Review `strictKnownMarketplaces` separately for installation restrictions; an empty list is a lockdown, not a request to use defaults.
4. For delegated publishing, record the shared baseline and which team differences need review. Confirm client support before proposing distribution. Do not install plugins or publish the settings here.
5. Plan a later supported-client check for an approved plugin and a blocked source. A version-controlled file supplies review history, but does not prove that clients received it.

See [plugin standards](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/plugin-standards) and [plugin settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings).

### Recipe: ag-sandbox
**Title:** Define local isolation requirements
**Kind:** guidance
**Policies:** agent.sandbox
**Catalog IDs:** agents-context.sandbox, extensions-plugins.managed-settings
**Requires decisions:** AG-05

Do not alter the sandbox of the running workshop client.

#### Steps

1. Record the target client, version and operating system. Check the supported-key matrix and host requirements before proposing a `sandbox` object in managed settings.
2. For mandatory isolation, propose `enabled: true`, `failIfUnavailable: true` and `allowBypass: false`. Together these require enforcement and prevent bypass; `enabled` alone does not establish all three requirements.
3. For reviewed exceptions, document the exceptional task and owner before considering bypass. Keep the mandatory baseline in the sandbox exercise unchanged.
4. Review `userPolicy.filesystem` read/write, read-only and denied paths, and `userPolicy.network` outbound access and host restrictions. Also review credential injection and whether local MCP and language servers must run inside the sandbox. Remote MCP servers do not run in the local sandbox.
5. Record a later allowed/blocked test and the expected failure when isolation is unavailable. Do not infer enforcement from the app's project settings: they do not display the complete effective managed policy.

Support differs by client, version and host. VS Code support applies to Agent Host sessions. On Windows, CLI host rules rely on programs honoring proxy settings and do not provide the same protection against direct connections as on macOS and Linux. See [sandbox settings and limitations](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings#sandbox).

### Recipe: ag-computer-use
**Title:** Set the desktop-interaction boundary
**Kind:** guidance
**Policies:** agent.computer-use
**Catalog IDs:** models-features.computer-use, extensions-plugins.managed-settings
**Requires decisions:** AG-05

#### Steps

1. Identify the desktop application, task and intended client. The `features.computerUse` managed setting applies to Copilot CLI and the GitHub Copilot app.
2. Inspect the existing setting without changing it. For tasks outside scope, propose `features.computerUse: false`; local settings cannot override that restriction.
3. For a required task, note that `true` or omission allows users to control computer use through local settings. It does not itself start desktop interaction or authorize an action.
4. Record the human approval boundaries and a harmless application task for a later trial. Do not open applications, submit forms or change device permissions in this walkthrough.

See [computer-use policy](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings#featurescomputeruse).

### Recipe: ag-remote-control
**Title:** Review incoming control of hosted sessions
**Kind:** guidance
**Policies:** agent.remote-control
**Catalog IDs:** agents-context.remote-control, extensions-plugins.managed-settings
**Requires decisions:** AG-05

#### Steps

1. Identify the device hosting the session and its managed-settings deployment. Check support for `remoteControl` in the target client.
2. For organization-authorized access, propose `mode: "requireSSO"` and the intended organization logins in `githubDotComOrganizations`. The controlling client must be SSO-authorized for the listed organizations.
3. For local-only hosting, propose `mode: "disabled"`. For unrestricted access under existing policy, record `mode: "enabled"` and the accountable owner. Do not make a remote connection or deploy this proposal here.
4. Plan a later authorized/unauthorized client check against the hosting device. This setting does not govern the user's ability to control sessions on another device and is not the computer-use control.

See [remote-control policy](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings#remotecontrol).

### Recipe: ag-partner-agents
**Title:** Assess third-party coding-agent availability
**Kind:** guidance
**Policies:** agent.partner-agents
**Catalog IDs:** agents-context.partner-agents
**Requires decisions:** AG-05

#### Steps

1. List each proposed provider, task, data access and responsible owner, or record that no partner integration is needed.
2. Inspect the enterprise and organization policies using the [third-party agent policy guidance](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/about-agents/about-third-party-coding-agents). Treat each partner agent separately from Copilot cloud-agent availability.
3. Record the required organization scope and repository safeguards without enabling an agent. Partner-agent enablement installs a corresponding GitHub App; it is not merely a model choice.
4. Keep the evaluation specific to agents on GitHub. These policies do not govern local agents in VS Code. Leave model availability with User Governance and financial ownership with Billing & Cost Control.

See [enterprise partner-agent enablement](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/enable-copilot-cloud-agent).

### Recipe: ag-agent-apps
**Title:** Review agent-app installation and authorization separately
**Kind:** guidance
**Policies:** agent.partner-agents
**Catalog IDs:** agents-context.agent-apps
**Requires decisions:** AG-05

#### Steps

1. Identify the proposed app, installation account, repository scope, requested permissions and partner services, or record that additional app features are outside scope.
2. Check whether the GitHub App is installed and whether its agent features are enabled. For an enterprise-owned organization, the enterprise `Agent apps` policy must also be enabled. Do not install or enable an app in this walkthrough.
3. Include user authorization in the rollout plan. First use asks the user to authorize the app through an OAuth flow so it can act on their behalf. Installation and user authorization are distinct.
4. Review the app's tools and MCP connections with the service owner. Record the expected access and removal owner without approving the OAuth flow or running a task.

See [agent apps and authorization](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/about-agents/agent-apps).

### Recipe: ag-automations
**Title:** Bound work that starts automatically
**Kind:** guidance
**Policies:** agent.automations
**Catalog IDs:** agents-context.automations
**Requires decisions:** AG-05

Do not create or run an automation during this walkthrough.

#### Steps

1. Identify the private or internal repository, task owner and permitted output. Automations are not available in public repositories. The creator needs repository write access and cloud agent must be available.
2. Navigate to your **[Organization Settings -> Copilot -> Cloud agent](https://github.com/organizations/{{organization.slug}}/settings/copilot/coding_agent "fallback=https://github.com/settings/organizations")** and inspect `Allow automations`. It is separate from cloud-agent availability. If a person should start every task, record the proposed restriction while preserving manual task access. Broader autonomy does not by itself authorize recurring work.
3. For scheduled work, record the interval. For event-driven work, record the issue or pull-request event and filters. Keep the default protection that ignores events from users without write access.
4. List only the tools the task needs. An automation acts in its single scoped repository and inherits its cloud-agent firewall, secrets, variables and customizations. Recheck approval boundaries separately.
5. Plan how the owner will review, change and stop the automation. Definitions are private to their creator, including from repository administrators, and are not committed to Git. Sessions and logs are visible to people with repository access. Do not put secrets in the prompt or promise an administrator-visible inventory of definitions.
6. Record a later bounded trial and hand consumption planning to Billing & Cost Control. Use Observability for session activity and outcomes; configuration proposals are not evidence that recurring work ran.

See [automation scope, tools and visibility](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/about-automations) and [organization automation control](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/add-copilot-cloud-agent#controlling-automations-in-your-repositories).

### Recipe: ag-monitoring-ownership
**Title:** Assign monitoring owners and hand off reporting needs
**Kind:** guidance
**Policies:** agent.repository-safeguards
**Catalog IDs:** none
**Requires decisions:** AG-06

This is an ownership plan. Configure evidence sources and reporting in Observability, not a second monitoring setup in this block.

#### Steps

1. Name the review owner, audience, review interval and escalation contact. For periodic reviews, specify the review schedule. For centralized monitoring, name the central team. For team-managed monitoring, name each team's owner and the common reporting expectations.
2. List the questions the owner needs to answer: what ran, which repositories and tools were involved, what required approval, and which exceptions need follow-up. Use the Observability block to select the relevant audit, session and usage evidence.
3. Agree how the owner will review consumption with Billing & Cost Control. Do not treat usage totals as proof of code quality, policy enforcement or regulatory compliance.
4. Record missing evidence, access or reporting coverage and an owner for resolving each gap. Define who can stop or restrict a problematic workload.
5. Carry the plan into Observability's Configure and Verify stages. A named owner or proposed dashboard is not evidence that monitoring is operating.

See [measuring Copilot adoption and impact](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/measure-copilot-impact) and [Rolling out GitHub Copilot at scale](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale).

### Additional steps

#### Keep review and rollout ownership clear
**Catalog IDs:** agents-context.repository-rulesets

For a real rollout, keep pull-request review, required checks and incident ownership clear. Review generated changes as thoroughly as any contribution. Custom instructions can guide the work, but do not replace enforced repository controls. See [Maintaining codebase standards](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/maintain-codebase-standards).

Use Billing & Cost Control to align spending limits with the intended agent work. Use Observability to decide how to measure adoption and outcomes. A successful sandbox task alone does not establish rollout readiness.

## Validation

Check the scope you inspected or configured. A disabled policy is a valid outcome. Do not enable it or weaken another control just to obtain a successful run. The other configuration proposals have no live validation in this block. Use their named owner and proposed checks for a later controlled rollout.

### Exercise: AG-LAB
**Title:** Verify agent scope and safeguards
**Task label:** Agent verification task
**Attestation:** I checked the actual policy, intended developer/repository scope and safeguard outcome. For a disabled policy I confirmed unavailability, not a successful run. Prepared evidence alone is not live verification.
**Next label:** Verify agent boundaries

#### Steps

1. Recheck the saved enterprise scope and organization repository access. Confirm that the intended test developer has access to cloud agent and write permission to the assigned repository, unless the policy intentionally blocks access. Do not switch accounts to work around a restriction.
2. If you chose **Approval-based access**, or the effective organization policy disables access, inspect the task entry point for your test developer and confirm cloud agent is unavailable. Do not submit a task or enable the agent. Record the policy and observation.
3. For an enabled scope, open the assigned repository's `Agents` tab. In `New agent task`, select the assigned repository and Copilot cloud agent. Ask: "Add a short README usage example and open a pull request. Do not add dependencies, external tools or secrets." Start the task only within the existing lab allowance.
4. Spend at most two minutes inspecting the session or resulting pull request. Check the repository, proposed changes, checks and required review. If it is still running or blocked, record that outcome and use the fictional example below for discussion.
5. Inspect workflow behavior without approving workflows or merging. Workflows require approval by default, but automatic runs can be configured. A missing result or blocked task does not by itself identify the policy responsible; compare the message with the scope, permissions, budgets and repository rules.
6. Restore any enterprise policy or repository selection you changed in Configure. Keep non-sensitive observations of what you inspected, what ran, and what you could not establish.

#### Expected result

For an enabled scope, the intended developer can start work in the permitted repository and explain a remaining safeguard. For a disabled scope, cloud agent remains unavailable. A task blocked by another control is inconclusive for the scope check. One repository does not establish enterprise-wide availability, MCP enforcement, code quality or regulatory compliance.

See [Enterprise cloud agent scope](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/enable-copilot-cloud-agent), [Organization repository access](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/add-copilot-cloud-agent), [Cloud agent repository compatibility](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/copilot-surfaces/copilot-on-github), [Review cloud agent output](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/use-copilot-agents/review-copilot-output), [Start a cloud agent task](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github).

#### Fallback

Prepared session - fictional read-only example

This snapshot is fictional. It is not a real session, pull request or evidence of your sandbox. Use it when live access or time is unavailable, and leave live verification incomplete. A sanitized previously prepared session is also prepared evidence, not a check of today's settings.

1. Task: Add a short README usage example in the fictional pilot repository. No external tools were requested.
2. Recorded setup: The example organization was selected for cloud agent, and its repository access allowed the test repository.
3. Recorded session: The agent proposed a README-only change on a copilot/ branch and reported a successful local documentation check.
4. Recorded PR: Draft, not merged. Required review was still outstanding, and the workflow awaited human approval in this example.
5. Discuss: Which observation shows scope, which shows a safeguard, and what live policy and repository checks are still missing? If your chosen scope is disabled, why must you not start this task?
