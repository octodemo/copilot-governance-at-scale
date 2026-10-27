# Context Management
**Format version:** 1
**Block ID:** context-management
**Description:** Which information should Copilot use, how should teams share it, and how will they keep it trustworthy?
**Subtitle:** Govern context access, instructions, sharing, memory and quality

## Understand

Useful context helps Copilot understand the task, the code and your team's standards. More information is not always more useful. Start with what the task needs and who may access it, then decide how to provide, share and maintain that context.

This block works through six decisions:

| Decision | What you will agree |
| --- | --- |
| Access and data boundaries | Which information may be used and which needs restrictions. |
| Instructions and standards | Who owns common guidance and where teams need local detail. |
| External context | Which outside sources are needed, with what data and tool permissions. |
| Shared knowledge | How teams curate and share reusable sources. |
| Persistence and memory | Whether to use Copilot Memory and who reviews stored knowledge. |
| Quality and validation | How owners keep context relevant and check the resulting output. |

### Give Copilot useful guidance

Repository instructions describe conventions such as naming, dependencies and tests. Put the shared baseline in `.github/copilot-instructions.md`. For code areas with different needs, supported clients can also use path-specific files in `.github/instructions`.

A shared baseline is easier to maintain. Assign owners to specialized guidance so instructions do not conflict. Organization instructions support Chat, code review and cloud agent on GitHub.com. Use repository instructions for IDE workflows.

Custom instructions guide responses. Review generated changes and run tests to check them, even when the response references the instructions.

See [custom instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions) and [instruction support by client and feature](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/custom-instructions-support).

### Keep guidance separate from protection

Repository permissions control who can access files. Instructions do not change those permissions. Content exclusions are a separate control for supported workflows, with these limits:

- Edit and Agent modes in Copilot Chat in VS Code and other editors do not support content exclusion.
- An IDE can supply semantic information indirectly from an excluded file.
- Exclusions do not apply to symlinks or repositories on remote filesystems.

Use the [content exclusion support and limitations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/security-governance-and-network-settings/content-exclusion) for the intended workflow. Pair that review with [repository access management](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository).

Our [rollout guidance on codebase standards](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/maintain-codebase-standards) combines custom instructions with reviews, tests and security controls. Use this lab to compare how instructions affect sample output; it does not test regulatory compliance or data access.

### Share knowledge deliberately

MCP can connect Copilot to outside tools and data. Identify the source and minimum data needed before choosing an integration. Source permissions and tool permissions both matter. Use the separate controls for the chosen client or cloud-agent workflow.

Copilot Spaces collect sources around a task and can be shared with others. People still need access to a linked private repository. Uploaded files and pasted text are shared with the Space's audience, so review them for that audience.

Copilot Memory can retain repository facts and personal preferences for use across supported interactions. This public-preview feature has separate policy, ownership and deletion controls.

See [MCP management](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/mcp-management), [Spaces and source access](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/spaces), [Space sharing roles](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/collaborate-with-others) and [Copilot Memory](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/copilot-memory).

### How this connects to the other blocks

Access Management covers licenses and policy groups. User Governance covers general model and feature availability. Billing & Cost Control covers spending and payer choices. Agent Governance owns agent operation and tool enforcement; this block defines the information those tools need. Observability covers activity and engineering impact.

You will leave with a context plan covering access, instructions, integrations, sharing, persistence and maintenance. If you choose repository instructions, you will compare a coding task before and after adding guidance. Other walkthroughs help you prepare proposals.

## Decisions

Decide how guidance is shared, scoped, protected, and maintained.

### Decision: CM-01
**Title:** Context access and data boundaries
**Policies:** context.repository-access, context.content-exclusion
**Catalog IDs:** agents-context.repository-access, agents-context.content-exclusion

#### Question

What organizational information should Copilot be permitted to access?

#### Guidance

Start with the task, the information's classification and the people who need it. Consider sensitive code, credentials, intellectual property and regulatory obligations. Identify the actual Copilot client and mode before choosing a control.

Repository access and content exclusion address different needs. Excluding a file does not change repository access, and IDE Edit and Agent modes do not support content exclusion. Choose access and execution controls for those workflows. This walkthrough reviews settings; it does not test them live.

#### Option: broad
**Label:** Broad context within existing access
**Configure:** cm-access-review

Use permitted repository content without proposing new exclusions. Check that existing access matches the task; do not broaden permissions.

#### Option: access
**Label:** Restricted access to approved repositories
**Configure:** cm-access-review

Review who can access sensitive repositories. In production, involve the repository administrator. This is separate from Copilot license assignment and cloud-agent availability.

#### Option: exclusions
**Label:** Selective exclusions on supported surfaces
**Configure:** cm-content-exclusion

Use exclusions only where the documented client and mode support them. They do not replace repository permissions or protect every agent.

#### Option: combined
**Label:** Combine both where applicable
**Configure:** cm-access-review, cm-content-exclusion

Review repository access and add exclusions for supported surfaces where appropriate. Keep sensitive data out of this exercise.

### Decision: CM-02
**Title:** Custom instructions and context standards
**Policies:** context.repository-instructions, context.advanced-instructions, context.agent-skills
**Catalog IDs:** agents-context.repository-instructions, context.organization-instructions, context.agent-skills

#### Question

How should organizational standards and instructions be provided to Copilot?

#### Guidance

Start with standards contributors already use. Decide who owns the common guidance and where teams need local detail. **Not recommended —** We do not recommend conflicting instructions. Check support for each intended client.

Organization instructions cover supported GitHub.com workflows. All choices use the same before-and-after repository exercise to evaluate sample standards locally; organization guidance and reusable skills have separate walkthroughs. Instructions guide behavior; rulesets, permissions and security controls enforce mandatory requirements.

#### Option: centralized
**Label:** Centralized organizational standards
**Configure:** cm-lab-exercise, cm-organization-instructions

Plan a common organization baseline for supported GitHub.com workflows. Evaluate the sample standards in a repository without changing the organization policy or claiming coverage of every client.

#### Option: shared
**Label:** Repository-specific standards
**Configure:** cm-lab-exercise

Give the prepared repository a shared baseline in `.github/copilot-instructions.md`, maintained by its owners.

#### Option: scoped
**Label:** Layered instructions with team-owned detail
**Configure:** cm-lab-exercise, cm-scoped-instructions, cm-organization-instructions, cm-skills-review

Keep the shared repository baseline and plan path-specific guidance, applicable organization instructions and reusable skills independently.

### Decision: CM-03
**Title:** External context and MCP access
**Policies:** context.external-context
**Catalog IDs:** context.external-sources

#### Question

Which external systems and knowledge sources does the work need?

#### Guidance

Identify the information needed from each service, its owner and permitted operations. Consider authentication, sensitive data, server trust and how access will be reviewed. A source approved for one task is not permission for every tool or action it exposes.

This decision defines context requirements. Use Agent Governance to map them to client-managed MCP restrictions or cloud-agent configuration; it does not replace that block's tool controls.

#### Option: none
**Label:** No additional external integrations
**Configure:** cm-external-context

Use permitted repository context and review existing built-in capabilities separately.

#### Option: approved
**Label:** Approved MCP sources only
**Configure:** cm-external-context-approved

Choose from reviewed servers and name the specific information each task needs.

#### Option: managed
**Label:** Additional sources after security review
**Configure:** cm-external-context-managed

Require an owner, access assessment and review plan before adding an integration.

### Decision: CM-04
**Title:** Shared knowledge and context sources
**Policies:** context.shared-knowledge
**Catalog IDs:** context.shared-knowledge

#### Question

How should teams share and reuse organizational knowledge with Copilot?

#### Guidance

Decide whether repository documentation is enough or teams need a curated collection. Name the owner, audience and authoritative sources. Separate access to a Space from access to linked repositories, and review uploaded or pasted content for that Space's audience.

#### Option: repository
**Label:** Repository-based context
**Configure:** cm-shared-knowledge

Maintain documentation, instructions and code as the primary sources.

#### Option: curated
**Label:** Curated shared Copilot Spaces
**Configure:** cm-shared-knowledge-curated

Use a reviewed collection with named maintainers and a defined audience.

#### Option: team-owned
**Label:** Team-managed knowledge collections
**Configure:** cm-shared-knowledge-team-owned

Let teams maintain collections within common sharing and source-review standards.

### Decision: CM-05
**Title:** Context persistence and memory
**Policies:** context.memory
**Catalog IDs:** context.memory

#### Question

Should Copilot retain and reuse contextual knowledge across interactions?

#### Guidance

Decide whether the benefits of Copilot Memory fit your information-handling requirements. It is in public preview and has specific client support, ownership and deletion controls. Repository facts and personal preferences have different scopes.

These choices are about Copilot Memory. They do not control other session data, set a retention period, or enable Memory for one repository.

#### Option: session
**Label:** Session-based context without Copilot Memory
**Configure:** cm-memory-review

Plan to leave Memory disabled and supply task context when needed.

#### Option: managed
**Label:** Managed Memory adoption
**Configure:** cm-memory-review-managed

Plan review and deletion responsibilities before enabling the feature for eligible users.

#### Option: broader
**Label:** Broader Memory adoption on supported surfaces
**Configure:** cm-memory-review-broader

Extend use only after reviewing repository facts, personal preferences and administrative oversight.

### Decision: CM-06
**Title:** Context quality, efficiency and validation
**Policies:** context.quality
**Catalog IDs:** context.quality

#### Question

How will teams keep context relevant, accurate and efficient?

#### Guidance

Start with the information needed to complete a task, not the largest collection available. Decide who removes stale guidance, resolves conflicts and checks output. Consider context-window usage, duplicated instructions and the effort of maintaining shared sources.

Quality checks belong alongside code review and tests. They do not replace security controls or prove a cost saving.

#### Option: developer
**Label:** Developer-managed context
**Configure:** cm-quality-review

Developers choose task context and check results within existing safeguards.

#### Option: standardized
**Label:** Standardized context practices
**Configure:** cm-quality-review-standardized

Agree reusable patterns for documentation, instructions, skills and source selection.

#### Option: lifecycle
**Label:** Governed context lifecycle
**Configure:** cm-quality-review-lifecycle

Assign owners, review dates, validation criteria and retirement steps to shared context.

## Configure

Work only in your Petstore workshop repository. Prepare the shared instructions, then compare the same coding task in Validation. Keep the original task and existing guidance so you can make a fair comparison.

All instruction choices use the repository comparison exercise. For other walkthroughs, inspect settings and prepare proposals only. Do not change permissions, exclusions, organization policies or Memory; connect MCP servers; upload or share content; or delete stored memories. If a repository, client or setting is unavailable, record that limitation.

### Recipe: cm-lab-exercise
**Title:** Compare repository instructions
**Kind:** exercise
**Exercise ID:** CM-LAB
**Policies:** context.repository-instructions, context.advanced-instructions
**Catalog IDs:** agents-context.repository-instructions
**Requires decisions:** CM-02
**Variant decision:** CM-02
**Target:** repository
**Target label:** Confirmed sandbox GitHub repository URL
**Target help:** Use your Petstore workshop repository's root page URL, not a settings or file URL. The canvas does not inspect repository access.
**Target link label:** Open confirmed GitHub repository
**Primary choice label:** engineering-standards

All instruction choices evaluate the shared repository instructions file. The centralized choice tests sample standards locally; it does not deploy organization policy. The other instruction scopes have separate walkthroughs.

#### Safety

Use your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations"). Instructions guide behavior; they do not restrict access. Do not test restrictions with secrets or bypass existing controls.

#### Prerequisites

- A local clone of your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") with a clean working tree, and Node.js to run `node --test`.
- Your sandbox user with permission to edit the sample instructions and access to Copilot Chat in VS Code.
- Repository instructions enabled in VS Code. In Settings, search for `instruction file` and inspect `Code Generation: Use Instruction Files`.
- A place to keep the non-sensitive baseline response, generated changes and test result outside the sample repository.

See [repository instructions in your IDE](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide).

#### Steps

1. Open your local clone of the Petstore workshop repository in VS Code. Read any existing instructions and keep a copy. Do not remove existing safeguards to create a baseline.
2. Before editing instructions, submit the following prompt in Copilot Chat. Record the client, mode and selected model so you can use the same setup for the comparison.

   ```text
   Implement slugify(text) in src/slug.js: trim, lowercase, replace runs of non-alphanumeric characters with a hyphen, trim edge hyphens, and return an empty string when no characters remain.
   ```

3. Save the baseline response and generated changes outside the repository. Keep the task changes uncommitted and unstaged. Run `node --test` and record its actual result separately from Copilot's report.
4. Return only the sample task files to their starting state. Keep existing instructions, baseline observations, and unrelated work. In a terminal at the root of your local clone, inspect `git status --short`. For a task file that was already tracked before the exercise, restore that exact file:

   ```sh manual
   git restore --source=HEAD --staged --worktree -- src/slug.js
   ```

   If the task created `src/slug.js` as a new, untracked file instead, preview its removal and remove only that file:

   ```sh manual
   git clean -n -- src/slug.js
   git clean -f -- src/slug.js
   ```

   Repeat the appropriate command for each test file changed or created by this task, using its exact path. Do not reset or clean the whole repository.

5. Follow your selected variant below. Use these sample standards in the shared instructions file:

   ```markdown
   Use named exports and camelCase.
   Do not add dependencies.
   Add tests for empty input and punctuation.
   Report the test command and actual result; say if tests were not run.
   ```

#### Variant: shared

##### Scope

repository

##### Role

Sample-repository contributor with permission to edit instructions

##### Steps

1. Create or edit `.github/copilot-instructions.md` at the repository root. Add the sample standards while preserving relevant existing guidance.
2. Save the file and inspect its contents. Instructions are available for use as soon as the file is saved.
3. Check that the baseline observations and the same starting coding task are ready. Continue to Validation for the fresh-session comparison.

#### Variant: scoped

##### Scope

repository

##### Role

Sample-repository contributor maintaining the shared team baseline

##### Steps

1. Identify which standards belong in the shared baseline and who will maintain them. Use the same sample standards for this comparison.
2. Create or edit `.github/copilot-instructions.md`, preserving relevant existing guidance, and save the file.
3. Keep any proposed path-specific rules separate until after Validation. This comparison evaluates the shared baseline, not every team's local rules.

#### Variant: centralized

##### Scope

repository

##### Role

Sample-repository contributor evaluating proposed common standards

##### Steps

1. Use the sample standards as a small example of your proposed common guidance. Keep the organization proposal separate; this exercise does not deploy organization instructions.
2. Create or edit `.github/copilot-instructions.md` in your local clone, preserving relevant existing guidance, and save the file.
3. Repeat the same local task in Validation. This tests the repository copy of the standards in VS Code, not their delivery through organization settings.

### Recipe: cm-scoped-instructions
**Title:** Plan guidance for different code areas
**Kind:** guidance
**Policies:** context.advanced-instructions
**Catalog IDs:** agents-context.repository-instructions

Keep the shared exercise unchanged. Use this reference walkthrough to plan local guidance after comparing the baseline.

#### Steps

1. List the standards that differ by code area and name a maintainer for each. Keep common standards in `.github/copilot-instructions.md`.
2. Check the [instruction support matrix](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/custom-instructions-support) for the intended client and feature.
3. For a supported path-specific workflow, plan a file such as `.github/instructions/javascript.instructions.md`. Use `applyTo` to select its files. This example targets JavaScript files under `src`:

   ```markdown
   ---
   applyTo: "src/**/*.js"
   ---
   Use named exports and camelCase.
   ```

4. Review the planned rule alongside the shared baseline. Matching path-specific and repository-wide instructions are both used; **Not recommended —** We do not recommend conflicting guidance.
5. If your team already uses `AGENTS.md`, check whether the chosen feature supports it before adding another source of instructions. It provides instructions; it does not define a custom agent or permission policy.

See [path-specific instructions in IDEs](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide) and [instruction types](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions).

### Recipe: cm-access-review
**Title:** Review who can access the repository
**Kind:** guidance
**Policies:** context.repository-access
**Catalog IDs:** agents-context.repository-access

Inspect access without changing it. For a production review, involve the repository administrator and data owner.

#### Steps

1. List the information the task needs and its classification. For **Broad context within existing access**, retain current permissions rather than adding access. For restricted access, name the approved repositories and data sources.
2. In your Petstore workshop repository, navigate to **[Repository Settings -> Collaborators & teams](https://github.com/{{organization.slug}}/{{repository.name}}/settings/access "fallback=https://github.com/settings/organizations")**. You own this sandbox organization. If you cannot view access, record the limitation.
3. Under `Manage access`, find your user and inspect its role.
4. If `Mixed roles` appears, inspect the sources of access. Do not assume a single assignment explains the person's permissions.
5. Prepare a proposal naming who needs access and which roles require review. Do not add or remove people or change roles here.
6. Keep this proposal separate from Copilot license assignment in Access Management and agent operating scope in Agent Governance. This walkthrough does not change or test access.

See [managing repository access](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository).

### Recipe: cm-content-exclusion
**Title:** Review exclusions for the intended workflow
**Kind:** guidance
**Policies:** context.content-exclusion
**Catalog IDs:** agents-context.content-exclusion

Prepare an exclusion proposal without saving a policy. Use fictional paths only; do not introduce sensitive content to test a restriction.

#### Steps

1. Identify the client, mode and files the proposal should cover. Check [content exclusion support and limitations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/security-governance-and-network-settings/content-exclusion). Do not use IDE Edit or Agent mode to validate an exclusion.
2. As a repository administrator, navigate to **[Repository Settings -> Copilot -> Content exclusion](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/content_exclusion "fallback=https://github.com/settings/organizations")**. Inspect any inherited exclusions; these cannot be edited at the repository level.
3. Review `Paths to exclude in this repository`. A proposed entry for a fictional directory could be `- "/fictional-data/**"`. Keep it in your proposal rather than saving it in this lab.
4. For an organization-level proposal, an organization owner can inspect **[Organization Settings -> Copilot -> Content exclusion](https://github.com/organizations/{{organization.slug}}/settings/copilot/content_exclusion "fallback=https://github.com/settings/organizations")** and `Repositories and paths to exclude`. Organization exclusions apply to users assigned a Copilot seat through that organization. Use the license-source review from Access Management to identify those users.
5. Record the intended scope and a later test using harmless sample data on a supported surface. Include the limits for indirect semantic information, symlinks and remote filesystems.

See [excluding content](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/configure-content-exclusion/exclude-content-from-copilot).

### Recipe: cm-organization-instructions
**Title:** Plan a common organization baseline
**Kind:** guidance
**Policies:** context.advanced-instructions
**Catalog IDs:** context.organization-instructions
**Requires decisions:** CM-02

#### Steps

1. Choose a few common standards and name their owner. Separate response guidance from mandatory controls such as required reviews and checks.
2. As an organization owner, inspect **[Organization Settings -> Copilot -> Custom instructions](https://github.com/organizations/{{organization.slug}}/settings/copilot/custom_instructions "fallback=https://github.com/settings/organizations")** and `Preferences and instructions` without saving changes.
3. Identify the supported workflows: organization instructions apply to Copilot Chat, code review and cloud agent on GitHub.com. Do not treat this field as an enforced baseline for every IDE.
4. For **Centralized organizational standards**, prepare the common guidance and identify clients needing a separate repository baseline. For **Layered instructions with team-owned detail**, compare it with repository and path-specific guidance and resolve conflicts.
5. Name the reviewer and update process. Keep the organization proposal separate from the VS Code repository exercise.

See [organization instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-organization-instructions) and [instruction support](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/custom-instructions-support).

### Recipe: cm-skills-review
**Title:** Choose reusable task guidance
**Kind:** guidance
**Policies:** context.agent-skills
**Catalog IDs:** context.agent-skills
**Requires decisions:** CM-02

#### Steps

1. Identify a repeated task, such as preparing release notes, and decide which guidance belongs in a reusable skill rather than the always-relevant instructions.
2. Review the proposed skill's instructions, scripts and resources with its owner. Skills can contain executable scripts; do not install or run an unreviewed skill during this walkthrough.
3. Check support and storage locations for the intended surface. Project skills can live in `.github/skills`; do not assume a personal skill on a developer's device is available to a cloud agent.
4. Plan a harmless example, expected output and maintenance owner. Keep skill evaluation separate from **Compare repository instructions**, which tests repository instructions only.
5. Refer distribution, tool permissions and custom-agent publishing to Agent Governance. A skill is task guidance, not permission to execute every action it describes.

See [agent skills and supported locations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/customizations/agent-skills).

### Recipe: cm-external-context
**Title:** Review repository context and existing capabilities
**Kind:** guidance
**Policies:** context.external-context
**Catalog IDs:** context.external-sources
**Requires decisions:** CM-03

#### Steps

1. List the permitted repository sources and existing built-in capabilities; do not add a connection.

### Recipe: cm-external-context-approved
**Title:** Define requirements for approved MCP sources
**Kind:** guidance
**Policies:** context.external-context
**Catalog IDs:** context.external-sources
**Requires decisions:** CM-03

#### Steps

1. Name each external system, data owner and task it supports.
2. For each proposed source, list the minimum records or documents required, permitted read/write operations, authentication owner and credential scope. Record no credential values.
3. Match the need to the reviewed server list.
4. Use [enterprise MCP allowlists](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist) for supported client restrictions. An empty allowlist still permits built-in default servers, so review those separately.
5. For cloud agent, inspect **[Repository Settings -> Copilot -> MCP servers](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/mcp "fallback=https://github.com/settings/organizations")** without editing. The page is available only when MCP servers are enabled for the enterprise or organization. This configuration is shared with code review and separate from client-managed allowlists. Prefer necessary read-only tools; configured tools can be called autonomously.
6. Compare this data-source proposal with your external-tool answer in Agent Governance. Resolve disagreements with the source and tool owners before deployment. Do not install servers, authenticate integrations, or test them with sensitive data.

See [MCP management](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/mcp-management) and [repository MCP configuration](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers).

### Recipe: cm-external-context-managed
**Title:** Define review requirements for additional sources
**Kind:** guidance
**Policies:** context.external-context
**Catalog IDs:** context.external-sources
**Requires decisions:** CM-03

#### Steps

1. Name each external system, data owner and task it supports.
2. For each proposed source, list the minimum records or documents required, permitted read/write operations, authentication owner and credential scope. Record no credential values.
3. Identify the outstanding trust, access and auditability checks before requesting approval.
4. Use [enterprise MCP allowlists](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist) for supported client restrictions. An empty allowlist still permits built-in default servers, so review those separately.
5. For cloud agent, inspect **[Repository Settings -> Copilot -> MCP servers](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/mcp "fallback=https://github.com/settings/organizations")** without editing. The page is available only when MCP servers are enabled for the enterprise or organization. This configuration is shared with code review and separate from client-managed allowlists. Prefer necessary read-only tools; configured tools can be called autonomously.
6. Compare this data-source proposal with your external-tool answer in Agent Governance. Resolve disagreements with the source and tool owners before deployment. Do not install servers, authenticate integrations, or test them with sensitive data.

See [MCP management](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/mcp-management) and [repository MCP configuration](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers).

### Recipe: cm-shared-knowledge
**Title:** Review repository sources as context
**Kind:** guidance
**Policies:** context.shared-knowledge
**Catalog IDs:** context.shared-knowledge
**Requires decisions:** CM-04

#### Steps

1. Name a task and the authoritative documentation or code it needs. Review those sources and their owners without creating a Space.

### Recipe: cm-shared-knowledge-curated
**Title:** Review a curated shared Copilot Space
**Kind:** guidance
**Policies:** context.shared-knowledge
**Catalog IDs:** context.shared-knowledge
**Requires decisions:** CM-04

#### Steps

1. Name a task and the authoritative documentation or code it needs.
2. Open [Copilot Spaces](https://github.com/copilot/spaces) and inspect an existing permitted example. Use the `Organizations` tab for shared organization Spaces. If none is available, prepare the source list from the [creation guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces) without creating or uploading anything.
3. Distinguish linked repositories and files from uploaded files and pasted text. Linked GitHub sources update as they change, and viewers still need source access. Review copies and free text against the Space's audience; do not assume the original repository protects a copied document.
4. Inspect the Space's `Share` control without saving changes. For an organization-owned Space, review viewer, editor and admin roles and the organization base role, including `No access`. Organization Spaces are shared within the organization; personal Spaces have different public/private sharing choices.
5. Name central source reviewers. Agree who updates or removes stale uploads and reviews audience changes.
6. Check eligibility using the user's Copilot seat source, not just the organization that owns the Space. Disabling Spaces in the owning organization does not by itself prevent an eligible user licensed elsewhere from creating a Space there.
7. Record the proposed audience, source permissions, source owners and review date. Check that intended viewers can access each linked source.

See [Spaces availability and source permissions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/spaces) and [sharing roles](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/collaborate-with-others).

### Recipe: cm-shared-knowledge-team-owned
**Title:** Review team-managed knowledge collections
**Kind:** guidance
**Policies:** context.shared-knowledge
**Catalog IDs:** context.shared-knowledge
**Requires decisions:** CM-04

#### Steps

1. Name a task and the authoritative documentation or code it needs.
2. Open [Copilot Spaces](https://github.com/copilot/spaces) and inspect an existing permitted example. Use the `Organizations` tab for shared organization Spaces. If none is available, prepare the source list from the [creation guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces) without creating or uploading anything.
3. Distinguish linked repositories and files from uploaded files and pasted text. Linked GitHub sources update as they change, and viewers still need source access. Review copies and free text against the Space's audience; do not assume the original repository protects a copied document.
4. Inspect the Space's `Share` control without saving changes. For an organization-owned Space, review viewer, editor and admin roles and the organization base role, including `No access`. Organization Spaces are shared within the organization; personal Spaces have different public/private sharing choices.
5. Assign team maintainers within the same data-handling standards. Agree who updates or removes stale uploads and reviews audience changes.
6. Check eligibility using the user's Copilot seat source, not just the organization that owns the Space. Disabling Spaces in the owning organization does not by itself prevent an eligible user licensed elsewhere from creating a Space there.
7. Record the proposed audience, source permissions, source owners and review date. Check that intended viewers can access each linked source.

See [Spaces availability and source permissions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/spaces) and [sharing roles](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/collaborate-with-others).

### Recipe: cm-memory-review
**Title:** Plan context without Copilot Memory
**Kind:** guidance
**Policies:** context.memory
**Catalog IDs:** context.memory
**Requires decisions:** CM-05

#### Steps

1. Inspect **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**, then `Copilot Memory`. For an organization policy, inspect **[Organization Settings -> Copilot -> Policies](https://github.com/organizations/{{organization.slug}}/settings/copilot/policies "fallback=https://github.com/settings/organizations")** and its `Copilot Memory` setting. Enterprise policy can constrain the organization.
2. Propose leaving the feature disabled and supply task context when needed.

### Recipe: cm-memory-review-managed
**Title:** Plan managed Memory adoption
**Kind:** guidance
**Policies:** context.memory
**Catalog IDs:** context.memory
**Requires decisions:** CM-05

#### Steps

1. Identify the users, subscription source and supported surfaces. Copilot Memory is used by cloud agent, code review, CLI and agentic autofix. It is enabled per user, not per repository; code review uses repository facts, not personal preferences.
2. Inspect **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**, then `Copilot Memory`. For an organization policy, inspect **[Organization Settings -> Copilot -> Policies](https://github.com/organizations/{{organization.slug}}/settings/copilot/policies "fallback=https://github.com/settings/organizations")** and its `Copilot Memory` setting. Enterprise policy can constrain the organization.
3. Review eligible users and their opt-out path. Managed subscriptions are off by default until an administrator enables the policy; users with multiple organization licenses need all of those organizations to allow Memory. Leave the policy unchanged.
4. Review the scopes separately. Repository facts are used only in that repository and checked against cited code. Personal preferences follow the user, and Business/Enterprise preferences are owned by the active billing entity. Memory is not shared organization-wide.
5. Unused facts and preferences are deleted after 28 days; successful validation and use may reset the timer. Assign review and deletion owners. The retention period is not configurable or an absolute 28-day lifetime.
6. As a repository administrator, inspect **[Repository Settings -> Copilot -> Memory](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/memory "fallback=https://github.com/settings/organizations")** if available. Identify stale or inappropriate facts without deleting them. Use the [administrator guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/copilot-memory/manage-as-administrator) to plan organization/enterprise export and deletion responsibilities for user preferences. Keep personal data out of workshop evidence.
7. Define the review process before rollout. This choice does not change Memory modes or retention settings.

Copilot Memory is in public preview. See [Memory behavior and ownership](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/copilot-memory) and [administrator controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/copilot-memory/manage-as-administrator).

### Recipe: cm-memory-review-broader
**Title:** Plan Memory adoption across supported surfaces
**Kind:** guidance
**Policies:** context.memory
**Catalog IDs:** context.memory
**Requires decisions:** CM-05

#### Steps

1. Identify the users, subscription source and supported surfaces. Copilot Memory is used by cloud agent, code review, CLI and agentic autofix. It is enabled per user, not per repository; code review uses repository facts, not personal preferences.
2. Inspect **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**, then `Copilot Memory`. For an organization policy, inspect **[Organization Settings -> Copilot -> Policies](https://github.com/organizations/{{organization.slug}}/settings/copilot/policies "fallback=https://github.com/settings/organizations")** and its `Copilot Memory` setting. Enterprise policy can constrain the organization.
3. Review eligible users and their opt-out path. Managed subscriptions are off by default until an administrator enables the policy; users with multiple organization licenses need all of those organizations to allow Memory. Leave the policy unchanged.
4. Review the scopes separately. Repository facts are used only in that repository and checked against cited code. Personal preferences follow the user, and Business/Enterprise preferences are owned by the active billing entity. Memory is not shared organization-wide.
5. Unused facts and preferences are deleted after 28 days; successful validation and use may reset the timer. Assign review and deletion owners. The retention period is not configurable or an absolute 28-day lifetime.
6. As a repository administrator, inspect **[Repository Settings -> Copilot -> Memory](https://github.com/{{organization.slug}}/{{repository.name}}/settings/copilot/memory "fallback=https://github.com/settings/organizations")** if available. Identify stale or inappropriate facts without deleting them. Use the [administrator guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/copilot-memory/manage-as-administrator) to plan organization/enterprise export and deletion responsibilities for user preferences. Keep personal data out of workshop evidence.
7. Include each additional surface and owner in the review process. This choice does not change Memory modes or retention settings.

Copilot Memory is in public preview. See [Memory behavior and ownership](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/copilot-memory) and [administrator controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/copilot-memory/manage-as-administrator).

### Recipe: cm-quality-review
**Title:** Plan developer-managed context review
**Kind:** guidance
**Policies:** context.quality
**Catalog IDs:** context.quality
**Requires decisions:** CM-06

#### Steps

1. Select one representative task and write down what a correct result must include. List the relevant sources, owners and expected evidence before running it.
2. Make the developer responsible for source selection and output review.
3. Review instructions for duplicates, conflicts and outdated commands. Keep broadly applicable guidance concise; put task-specific workflows in appropriate skills and code-area detail in supported path-specific instructions.
4. Review how the chosen surface retrieves context. In Spaces, attaching a repository lets Copilot search for relevant content; attaching an individual file puts its full contents into the context window for each query. Choose the smallest useful set, and check the intended surface rather than assuming every client retrieves context the same way.
5. If a source is missing, check access and the intended surface's retrieval or indexing behavior before adding copies. Compare relevance and accuracy, and record token or context usage when the client reports it. A shorter source list alone does not show a billing saving; take spend questions to Billing & Cost Control.
6. Use **Compare repository instructions** for the selected repository-instructions comparison. For other context assets, prepare a separate harmless task, expected source references and acceptance criteria. Keep permissions and safeguards fixed, and compare results across tasks to assess reliability.
7. Assign follow-up for each stale source or failed criterion. Retest after relevant changes and keep code review, tests and security checks in place.

See [effective instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions), [Spaces source selection](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces) and [codebase safeguards](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/maintain-codebase-standards).

### Recipe: cm-quality-review-standardized
**Title:** Plan standardized context practices
**Kind:** guidance
**Policies:** context.quality
**Catalog IDs:** context.quality
**Requires decisions:** CM-06

#### Steps

1. Select one representative task and write down what a correct result must include. List the relevant sources, owners and expected evidence before running it.
2. Agree a short template for source lists, instructions and skills.
3. Review instructions for duplicates, conflicts and outdated commands. Keep broadly applicable guidance concise; put task-specific workflows in appropriate skills and code-area detail in supported path-specific instructions.
4. Review how the chosen surface retrieves context. In Spaces, attaching a repository lets Copilot search for relevant content; attaching an individual file puts its full contents into the context window for each query. Choose the smallest useful set, and check the intended surface rather than assuming every client retrieves context the same way.
5. If a source is missing, check access and the intended surface's retrieval or indexing behavior before adding copies. Compare relevance and accuracy, and record token or context usage when the client reports it. A shorter source list alone does not show a billing saving; take spend questions to Billing & Cost Control.
6. Use **Compare repository instructions** for the selected repository-instructions comparison. For other context assets, prepare a separate harmless task, expected source references and acceptance criteria. Keep permissions and safeguards fixed, and compare results across tasks to assess reliability.
7. Assign follow-up for each stale source or failed criterion. Retest after relevant changes and keep code review, tests and security checks in place.

See [effective instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions), [Spaces source selection](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces) and [codebase safeguards](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/maintain-codebase-standards).

### Recipe: cm-quality-review-lifecycle
**Title:** Plan a governed context lifecycle
**Kind:** guidance
**Policies:** context.quality
**Catalog IDs:** context.quality
**Requires decisions:** CM-06

#### Steps

1. Select one representative task and write down what a correct result must include. List the relevant sources, owners and expected evidence before running it.
2. Name review dates, change reviewers and retirement criteria for shared assets.
3. Review instructions for duplicates, conflicts and outdated commands. Keep broadly applicable guidance concise; put task-specific workflows in appropriate skills and code-area detail in supported path-specific instructions.
4. Review how the chosen surface retrieves context. In Spaces, attaching a repository lets Copilot search for relevant content; attaching an individual file puts its full contents into the context window for each query. Choose the smallest useful set, and check the intended surface rather than assuming every client retrieves context the same way.
5. If a source is missing, check access and the intended surface's retrieval or indexing behavior before adding copies. Compare relevance and accuracy, and record token or context usage when the client reports it. A shorter source list alone does not show a billing saving; take spend questions to Billing & Cost Control.
6. Use **Compare repository instructions** for the selected repository-instructions comparison. For other context assets, prepare a separate harmless task, expected source references and acceptance criteria. Keep permissions and safeguards fixed, and compare results across tasks to assess reliability.
7. Assign follow-up for each stale source or failed criterion. Retest after relevant changes and keep code review, tests and security checks in place.

See [effective instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions), [Spaces source selection](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces) and [codebase safeguards](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/maintain-codebase-standards).

### Additional steps

#### Review shared organization guidance
**Catalog IDs:** none

Before rollout, check whether existing organization guidance overlaps your proposal. An organization owner can inspect **[Organization Settings -> Copilot -> Custom instructions](https://github.com/organizations/{{organization.slug}}/settings/copilot/custom_instructions "fallback=https://github.com/settings/organizations")** and the `Preferences and instructions` field. Keep organization-wide changes outside the shared repository comparison.

Organization instructions apply to Copilot Chat, code review and cloud agent on GitHub.com. Use repository instructions for the VS Code exercise. See [organization instructions](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-organization-instructions).

## Validation

Repeat the coding task if you selected and prepared repository instructions. Keep the client, mode, model and starting code the same so you can compare the observations.

For the other choices, review your proposal's access boundaries, instruction owners, external sources, sharing audience, Memory responsibilities and maintenance checks. Identify unresolved needs and the owner of each later test. Those inspections do not establish that access, integrations, sharing, Memory or retention controls work. If you selected guidance only, there is no live exercise to complete.

### Exercise: CM-LAB
**Title:** Evaluate instruction adherence
**Task label:** Fresh-session comparison task
**Attestation:** I repeated the task in a fresh session, reviewed the generated changes against the standards, and recorded matches or deviations. This records an evaluation of the task, not a compliance or data-access certification.
**Next label:** Compare generated changes

#### Steps

1. Start a fresh Copilot Chat session in your local clone with the saved instructions and the same starting coding task. Repeat the identical slugify prompt from Configure.
2. Check the response `References` list for `.github/copilot-instructions.md` in VS Code Chat. If it is missing, inspect instruction enablement and record the uncertainty rather than assuming the file was used.
3. Compare baseline and new changes against named exports, camelCase, no added dependencies, edge-case tests and an accurate test report. Run `node --test` and distinguish observed results from Copilot's report.
4. Record which standards were followed or missed and any follow-up with the owner. Results can vary, so review the actual changes.
5. Instructions guide output; repository permissions control access. For any **Context access and data boundaries** exclusion proposal, identify the intended client and mode. This exercise does not configure or test exclusions.

#### Expected result

Compare the generated changes with the sample standards to see how instructions affected this task. References show whether the instructions were included; the output shows which standards were followed. Repeat the comparison across tasks to assess reliability. This exercise does not test regulatory compliance.

See [Repository instructions in VS Code and other IDEs](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide), [Custom instructions and non-deterministic responses](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/prompting-and-context/custom-instructions), and [Content exclusion support and limitations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/security-governance-and-network-settings/content-exclusion).
