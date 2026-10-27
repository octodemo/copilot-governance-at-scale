# User Governance

**Format version:** 1
**Block ID:** user-governance
**Description:** Which models and features can your users use?
**Subtitle:** Establish your user governance model

## Understand

User governance is about which features, clients and models your users are allowed to choose from and use in their day-to-day work. Many companies have different needs and requirements when it comes to controlling their users.

**Recommended —** We recommend [Govern for Adoption](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/govern-for-adoption#review-and-enable-features-promptly), which means finding the right balance between governance and developer access. Too restrictive, and developers can't use the features that make them productive. Too permissive, and you may not meet your compliance requirements.

Of course, the right balance will vary depending on your organization's size, structure, and specific compliance requirements. Things to consider are:

- Whether you want or need one central policy for all, or different policies depending on teams
- Whether models or features need to be vetted and approved before you can push them to your users
- Your general stance on allowing frontier models and preview features
- FinOps-related considerations, such as which default model to use

In the following sections, you'll be guided through some of the key decisions to take in this space, followed by configuration guidance.

Most enterprise policies let you enable a feature, disable it, or let organizations decide. An explicit enterprise setting applies across its organizations; delegation lets each organization choose its own setting. These policies generally follow the enterprise or organization that provides a user's Copilot license.

Generally available (GA) features and models are fully released. Preview features and models are still being evaluated and can change. Separate default-availability policies control unconfigured GA features and models. Preview features do not follow the feature default, and pre-GA models are outside the model default, so review their availability separately.

See [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies) and [default availability of features and models](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/default-availability).

### What's available?

The best way to see what is available for you to configure is to look at these sections in your enterprise:

- **[Features and Clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**
- **[Models](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/models "fallback=https://github.com/settings/enterprises")**

## Decisions

Start with the governance scope you need, then consider which model and feature choices fit that scope.

### Decision: UG-01

**Title:** Policy decision makers
**Policies:** features.ai-managers, features.enterprise-policies
**Catalog IDs:** intro.enterprise-custom-roles, access.enterprise-teams

#### Question

Who will make the decision about general feature and model policies?

#### Guidance

Enterprise owners and AI policy decision makers are not always the same people or teams within a company. GitHub allows you to grant specific AI policy permissions to a subset of members in your enterprise, ensuring that the right people have the appropriate level of control without overburdening the entire enterprise ownership team.

#### Option: enterprise

**Label:** The central enterprise ownership team
**Configure:** ug-01-enterprise-guidance

The enterprise ownership team manages feature and model policies centrally.

#### Option: ai-managers

**Label:** A dedicated AI governance team
**Configure:** ug-01-ai-managers-guidance

A dedicated team manages AI policies without enterprise-wide ownership.

#### Option: organizations

**Label:** One or several organization owners
**Configure:** ug-01-organizations-guidance

Many policy decisions can also be delegated to organization owners, allowing for more localized control within specific parts of the enterprise.

#### Option: mixed

**Label:** A mix
**Configure:** ug-01-enterprise-guidance, ug-01-ai-managers-guidance, ug-01-organizations-guidance

The enterprise ownership team or a dedicated AI governance team sets the central policies. Organization owners manage the policies delegated to them. Agree who owns each decision.

### Decision: UG-02

**Title:** Default model availability
**Policies:** models.enterprise-availability
**Catalog IDs:** models-features.default-availability-released-models, models-features.model-availability

#### Question

Do you want or have to vet and manually approve newly released models before you make them available to your users?

#### Guidance

GitHub allows you to create a default control for new models that determines whether they are Enabled or Disabled by default.

Enablement is great if you always want your Devs to receive the latest (GA) models. But if you have requirements or feel more comfortable in controlling which models are available, you may prefer to vet and manually approve new models before making them available.

#### Option: vetted

**Label:** Only manually approved or vetted models
**Configure:** ug-02-vetted-guidance

Tighter control as to what is available where and when. Might bar developers from using better or cheaper models.

#### Option: latest

**Label:** The most recent frontier models immediately
**Configure:** ug-02-latest-guidance

Always staying at the cutting edge and allowing developers to use the latest and greatest. Too permissive, and you may not meet your compliance requirements.

### Decision: UG-03

**Title:** Default client & feature availability
**Policies:** features.enterprise-policies
**Catalog IDs:** models-features.default-policy-new-features, models-features.copilot-feature-policies

#### Question

Do newly released features and clients require special approval or vetting before being rolled out?

#### Guidance

As with models, you may want to have a default control for new features and clients that determines whether they are Enabled or Disabled by default.

#### Option: vetted

**Label:** Special approval or vetting before being rolled out
**Configure:** ug-03-vetted-guidance

Tighter control as to what is available where and when.

#### Option: available

**Label:** Allow developers to use the latest and greatest
**Configure:** ug-03-available-guidance

Too permissive, and you may not meet your compliance requirements.

### Decision: UG-04

**Title:** Preview features
**Policies:** features.enterprise-policies
**Catalog IDs:** models-features.copilot-feature-policies

#### Question

Are you generally okay with using Preview features, or do you need to only use stable, fully released features?

#### Guidance

Some companies are fine with always staying at the cutting edge and allowing developers to use the latest and greatest.

Some companies prefer, or are even required, to have tighter control as to what is available where and when.

#### Option: stable

**Label:** Only stable, fully released features
**Configure:** ug-04-stable-guidance

Tighter control as to what is available where and when.

#### Option: previews

**Label:** Okay with using Preview features
**Configure:** ug-04-previews-guidance

Always staying at the cutting edge.

### Decision: UG-05

**Title:** Default model for new conversations
**Policies:** user.model-presets
**Catalog IDs:** models-features.default-model-and-auto-tier

#### Question

Should new Copilot conversations start with a model preset chosen for your enterprise?

#### Guidance

A model preset gives new conversations a deliberate starting point instead of relying on users to reconsider their model choice for every task. Imagine a user who selects a high-tier reasoning model for a complex debugging task, then uses the same model in a new session to edit a Markdown file without reconsidering that choice. For a straightforward task, that can mean unnecessary token consumption and higher costs without a better result. In some execution-heavy tasks, an overly capable reasoning model can even reduce quality by overthinking the work or introducing unnecessary changes.

As users move between many sessions throughout the day, it is easy to forget to choose a model appropriate to each task. A well-chosen preset can help reduce that risk, while leaving the model choice unmanaged is also a valid decision if you do not want to prescribe a starting point. See [Optimizing your AI usage](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/optimize-ai-usage).

If you set a preset, you can choose a specific model or Auto model selection. A specific model provides a consistent choice, but may not suit every task and should be reviewed as models change. This setting establishes a starting point, not a restriction on model choice: users can still select a different model for a conversation.

**Recommended —** We recommend Auto model selection if you want a preset. Auto considers task complexity and model availability, choosing among models permitted by the user's plan and administrator policies. Where supported, you can also choose an Auto routing tier.

See [Enterprise managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [About Copilot auto model selection](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/models/auto-model-selection).

#### Option: auto

**Label:** Yes, use Auto model selection as the preset — Recommended
**Configure:** ug-05-default-model-guidance, ug-05-auto-guidance, ug-05-preset-exercise

Choose any applicable routing tier in Configure.

#### Option: specific-model

**Label:** Yes, use a specific model as the preset
**Configure:** ug-05-default-model-guidance, ug-05-specific-model-guidance, ug-05-preset-exercise

Choose a consistent model for new conversations. This adds some maintenance overhead: review and update the preset if the chosen model is deprecated or replaced. See [model availability and changes](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/ai-models/supported-models).

#### Option: no-preset

**Label:** No, do not set a model preset
**Configure:** none

Leave the model choice unmanaged.

## Configure

The steps below follow the choices you made. Use Additional steps for instructions that apply regardless of those choices.

### Recipe: ug-01-enterprise-guidance

**Title:** Policy decision makers: The central enterprise ownership team
**Kind:** guidance
**Policies:** features.ai-managers, features.enterprise-policies
**Catalog IDs:** none

Enterprise owners set Copilot policies for the whole enterprise. When the enterprise sets a policy to a specific value, organization owners cannot override it.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**. Review the administration, privacy, model, billing, and usage policies.
2. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**. Review the policies for features and clients.
3. For each policy you want to control centrally, choose a specific value such as `Enabled` or `Disabled` instead of `Let organizations decide`. The baselines under **Additional steps** walk you through all policies.
4. Keep the group of people who can change policies small, and review it regularly. In the enterprise, these are enterprise owners and users with the `Manage enterprise AI controls` custom role permission.
5. Use the audit log to monitor changes to policy settings.

See [Managing policies and features for GitHub Copilot in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-enterprise-policies) and [GitHub Copilot policies for enterprises and organizations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

### Recipe: ug-01-ai-managers-guidance

**Title:** Policy decision makers: A dedicated AI governance team
**Kind:** guidance
**Policies:** features.ai-managers, features.enterprise-policies
**Catalog IDs:** intro.enterprise-custom-roles, access.enterprise-teams

Create an enterprise team and a custom role with the three permissions below. You are the only user in your sandbox, so you cannot assign and test the role with another user here. Apply the team membership and role assignments in your production enterprise. See [Establishing AI managers](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/govern-at-scale/establish-ai-managers), [Creating enterprise teams](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-accounts-and-repositories/managing-users-in-your-enterprise/create-enterprise-teams), and [Assigning roles in an enterprise](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-accounts-and-repositories/managing-roles-in-your-enterprise/assign-roles).

#### Steps

1. Navigate to your **[Enterprise Settings -> People -> Enterprise teams](https://github.com/enterprises/{{enterprise.slug}}/teams "fallback=https://github.com/settings/enterprises")**. Click `Create Enterprise team`, name the team, and create it. Leave membership unchanged in this sandbox.
2. Navigate to your **[Enterprise Settings -> People -> Enterprise roles -> Role management](https://github.com/enterprises/{{enterprise.slug}}/enterprise_roles "fallback=https://github.com/settings/enterprises")**, then click `Create custom role`. Name the role (for example, `AI & Copilot Admin`), then click `Add permissions` and add these permissions:
   - `View enterprise AI controls`
   - `Manage enterprise AI controls`
   - `View Enterprise Copilot Metrics`

   Click `Create role`.
3. Navigate to your **[Enterprise Settings -> People -> Enterprise roles -> Role assignments](https://github.com/enterprises/{{enterprise.slug}}/enterprise_role_assignments "fallback=https://github.com/settings/enterprises")** and inspect the assignment workflow without assigning a role here.

### Recipe: ug-01-organizations-guidance

**Title:** Policy decision makers: Organization owners
**Kind:** guidance
**Policies:** features.ai-managers, features.enterprise-policies
**Catalog IDs:** none

Enterprise owners can let organization owners decide most policies. Organization owners then set these policies for users who get their Copilot license through that organization.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")** and to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**. For each policy you want to hand over, select `Let organizations decide`.
2. Navigate to your **[Organization Settings -> Copilot -> Policies](https://github.com/organizations/{{organization.slug}}/settings/copilot/policies "fallback=https://github.com/settings/organizations")**. Organization owners set the delegated feature policies here.
3. Navigate to your **[Organization Settings -> Copilot -> Models](https://github.com/organizations/{{organization.slug}}/settings/copilot/models "fallback=https://github.com/settings/organizations")**. Organization owners set the delegated model policies here.
4. Check that each organization made its choices. Organization owners cannot change a policy that the enterprise has set to a specific value.

> [!NOTE]
> Users who get Copilot directly from the enterprise are not covered by `Let organizations decide`. For these users, `Policies for enterprise-assigned users` sets whether those policies default to enabled or disabled. If a user gets a license from several organizations, the least restrictive policy usually applies.

See [Managing policies and features for GitHub Copilot in your organization](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/manage-policies) and [GitHub Copilot policies for enterprises and organizations](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

### Recipe: ug-02-vetted-guidance

**Title:** Disable default availability for released models
**Kind:** guidance
**Policies:** models.enterprise-availability
**API:** none
**Catalog IDs:** models-features.default-availability-released-models, models-features.model-availability

Set `Default availability for released models` to `Disabled`. Unconfigured GA models then stay disabled until you explicitly enable them.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Configure models](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/models "fallback=https://github.com/settings/enterprises")**.
2. Disable the `Default availability for released models` policy.
3. Set each vetted model explicitly to `Enabled` or `Delegate`. Models labeled `Delegate to Default Policy` remain unconfigured.

### Recipe: ug-02-latest-guidance

**Title:** Keep default availability for released models enabled
**Kind:** guidance
**Policies:** models.enterprise-availability
**API:** none
**Catalog IDs:** models-features.default-availability-released-models, models-features.model-availability

Keep `Default availability for released models` `Enabled`. New and unconfigured GA models then become available without administrator action.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Configure models](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/models "fallback=https://github.com/settings/enterprises")**.
2. Keep the `Default availability for released models` policy enabled.
3. Explicitly set `Disabled` on any model that must never be enabled automatically.

### Recipe: ug-03-vetted-guidance

**Title:** Disable the default policy for new features
**Kind:** guidance
**Policies:** features.enterprise-policies
**API:** none
**Catalog IDs:** models-features.default-policy-new-features, models-features.copilot-feature-policies

Set `Default policy for new features` to `Disabled`. New GA features and unconfigured existing GA features then stay disabled until you explicitly enable them.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Disable the `Default policy for new features` policy.
3. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")** and explicitly configure each vetted feature. Unconfigured features are labeled `Unconfigured`.

### Recipe: ug-03-available-guidance

**Title:** Keep the default policy for new features enabled
**Kind:** guidance
**Policies:** features.enterprise-policies
**API:** none
**Catalog IDs:** models-features.default-policy-new-features, models-features.copilot-feature-policies

Keep `Default policy for new features` `Enabled`. New GA features and unconfigured existing GA features then become enabled without administrator action.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Keep the `Default policy for new features` policy enabled.
3. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")** and explicitly disable any feature that must not be enabled automatically.

### Recipe: ug-04-stable-guidance

**Title:** Preview features: Only stable, fully released features
**Kind:** guidance
**Policies:** features.enterprise-policies
**Catalog IDs:** models-features.copilot-feature-policies

Only use stable, fully released features. Preview features don't follow the `Default policy for new features`, so disable each one explicitly. See [About default availability of Copilot features and models](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/default-availability).

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
2. Find every setting labeled `Preview` and set it to `Disabled`.
3. Set `Editor preview features` to `Disabled`. This policy applies to IDEs only; see [Supported surfaces for GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/supported-surfaces-for-policies).

See [Managing policies and features for GitHub Copilot in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-enterprise-policies).

### Recipe: ug-04-previews-guidance

**Title:** Preview features: Okay with using Preview features
**Kind:** guidance
**Policies:** features.enterprise-policies
**Catalog IDs:** models-features.copilot-feature-policies

Allow Preview features. They don't follow the `Default policy for new features`, so enable each one explicitly. See [About default availability of Copilot features and models](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/default-availability).

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
2. Find every setting labeled `Preview` and set it to `Enabled`, or `Let organizations decide`.
3. Set `Editor preview features` to `Enabled` or `Let organizations decide`. This policy applies to IDEs only; see [Supported surfaces for GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/supported-surfaces-for-policies).

See [Managing policies and features for GitHub Copilot in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-enterprise-policies).

### Recipe: ug-05-default-model-guidance

**Title:** Prepare managed-settings.json, if needed
**Kind:** guidance
**Policies:** user.model-presets
**Catalog IDs:** models-features.default-model-and-auto-tier

**Already have the file?** Open your existing `copilot/managed-settings.json` and skip setup. Merge the example below into the existing JSON object; do not replace unrelated settings.

**Only if the file does not exist**, follow the setup steps below for a repository-based, server-managed deployment. If your enterprise already distributes managed settings through device management or local files, coordinate with its administrators instead of creating a second deployment.

#### Steps

1. Identify your enterprise's existing governance source. In this lab, the `Configuration source` section is already set up with a `.github-private` repository. If none is configured, follow [Creating a .github-private repository](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/create-github-private-repo) to create the repository in a designated organization and select that organization: navigate to your **[Enterprise Settings -> AI controls -> Agents](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents "fallback=https://github.com/settings/enterprises") -> Configuration source**.
2. In that `.github-private` repository, prepare `copilot/managed-settings.json` using the example below.
3. Before publishing, confirm the target enterprise, affected users, and approval for the change. Repository-based settings apply to users licensed by the enterprise or its organizations on supported clients, not just people with access to the repository.
4. After approval, publish through your repository's review process to its default branch. Follow [Getting started with enterprise-managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/get-started) to check validation and confirm that supported clients receive the settings.

Check the [supported-key matrix](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) before rollout. Preparing this example does not authorize an enterprise-wide change.

### Recipe: ug-05-auto-guidance

**Title:** Set Auto as the preset, with Balance
**Kind:** guidance
**Policies:** user.model-presets
**Catalog IDs:** models-features.default-model-and-auto-tier

Add these properties to `copilot/managed-settings.json`:

```json
{
  "model": "auto",
  "autoTier": {
    "overridable": "balance"
  }
}
```

**Recommended —** We recommend `Balance` as a general-purpose tier because it balances cost, quality, and latency. Other routing tiers are `Efficiency` (cost) and `Intelligence` (quality). The example supplies an overridable tier default; a plain tier string would lock the tier against user and repository overrides.

Auto tiers are available in VS Code, Copilot CLI, and the GitHub Copilot app. Check the managed-settings reference for minimum client versions. Users can still select another model for a conversation.

On paid plans, Auto qualifies for a 10% discount on model costs in Copilot Chat, Copilot CLI, the GitHub Copilot app, or Copilot cloud agent.

See [Enterprise managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [About Copilot auto model selection](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/models/auto-model-selection).

### Recipe: ug-05-specific-model-guidance

**Title:** Set a specific model as the preset: GPT-6 Luna
**Kind:** guidance
**Policies:** user.model-presets
**Catalog IDs:** models-features.default-model-and-auto-tier

Use `GPT-6 Luna` as the example model. Add this property to `copilot/managed-settings.json`:

```json
{
  "model": "gpt-6-luna"
}
```

Merge the `model` value into your existing file, preserving other settings. `autoTier` does not select a model and applies only when the selected model is Auto. Users can still select another model per conversation. Review the preset when the chosen model is deprecated or replaced.

See [Enterprise managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [Supported AI models](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/ai-models/supported-models).

### Recipe: ug-05-preset-exercise

**Title:** Publish the model preset in your sandbox
**Kind:** exercise
**Exercise ID:** UG-PRESET-LAB
**Policies:** user.model-presets
**Catalog IDs:** models-features.default-model-and-auto-tier
**Requires decisions:** UG-05
**Changed label:** Complete - published the preset
**Inspection label:** Complete - preset was already published

Publish the example above in the workshop sandbox so you can check it in the GitHub Copilot app during Verify.

#### Safety

Change only the workshop sandbox enterprise's `.github-private` repository. You are the only user in this sandbox. In production, managed settings apply to everyone licensed through the enterprise or its organizations. Never publish to a production enterprise without confirming the target, scope, and approval.

#### Steps

1. In the sandbox `.github-private` repository, add the example for your decision to `copilot/managed-settings.json`. Keep any other settings.
2. Commit the change to the default branch.
3. Navigate to your **[Enterprise Settings -> AI controls -> Agents](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents "fallback=https://github.com/settings/enterprises")** and check the "Copilot settings validation" section for errors. If the section isn't displayed, the validator found no issues.

### Additional steps

#### Set a Feature & Client Baseline: Choose and configure features and settings

**Catalog IDs:** models-features.copilot-feature-policies, models-features.suggestions-matching-public-code

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
2. Review every available item and choose whether to enable it, disable it, or let organizations decide where that option is available. Use the dropdown or toggle, or click the policy name for additional configuration options.
3. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**. In the `Privacy` section, review `Suggestions matching public code` and choose the setting for your enterprise.

Policy coverage varies by Copilot surface. Check the [supported surfaces for GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/supported-surfaces-for-policies) to see which policies apply to the clients in scope; the matrix does not necessarily show whether equivalent functionality is available.

See [Managing policies and features in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-enterprise-policies) and [How enterprise policies and delegation work](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

#### Set a Model Baseline: Choose and configure the models available in your enterprise

**Catalog IDs:** models-features.model-availability, models-features.model-access-for-enterprise-teams

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Configure models](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/models "fallback=https://github.com/settings/enterprises")**.
2. Review every model in the list. Set models to `Enabled` or `Disabled` for everyone, or `Delegate` for more granular access. In the default experience, delegate to organizations; if your enterprise has opted in to the enterprise teams preview for model access, delegation uses enterprise teams and apps instead.

See [Managing model availability and setting a baseline](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-availability-of-default-models).

## Validation

Some decisions in this block can't be validated in the workshop sandbox:

- **Policy decision makers:** Can't be tested here, because it requires signing in as someone who holds the assigned role.
- `Default availability for released models` and `Default policy for new features`: These settings take effect only when GitHub releases a new model or feature, so you can't trigger them during the workshop. After the next release, check that it was enabled or left disabled as you decided.
- **Preview features:** The workshop sandbox currently has no suitable preview feature to demonstrate the difference.

### Exercise: UG-PRESET-LAB

**Title:** Check the model preset in the GitHub Copilot app

#### Steps

1. Open the GitHub Copilot app with an account that receives Copilot from the sandbox enterprise. Restart the app, or sign out and back in, to load the latest settings immediately. Otherwise, they arrive within about an hour.
2. Start a new session and open the model picker. Confirm that it starts with your preset: `Auto` with the `Balance` tier, or the specific model you chose.
3. Select a different model for this session. The preset only sets the starting point; users can still choose another model.
4. Experiment: change the preset in `copilot/managed-settings.json` and commit it. For example, switch the tier to `efficiency`, or switch between Auto and a specific model. Restart the app, start another new session, and check that the model picker reflects the change.
5. Optional, for Auto: replace `{ "overridable": "balance" }` with `"balance"`. A plain tier value locks the tier against user and repository overrides. Restart the app and check whether you can still change the tier.
6. Restore the value you decided on, restart the app, and confirm that new sessions use it again.

#### Expected result

New sessions in the GitHub Copilot app start with the published preset, you can still select another model, and each published change appears in new sessions after the app refreshes its settings.

See [Getting started with enterprise-managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/get-started) and [Enterprise managed settings](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings).
