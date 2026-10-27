# Access Management
**Format version:** 1
**Block ID:** access-management
**Description:** Who gets a Copilot license, how do they get it, and when do they lose it?
**Subtitle:** Assign, maintain and control Copilot licenses

## Understand

Access management is more than switching licenses on. Where a user gets their license decides which Copilot policies they follow. So start from the policy model you want: one set of rules for everyone, a test group that gets new features first, or different rules per business unit. Then choose a way of assigning licenses that keeps every user in the right group.

> [!NOTE]
> This block assumes the new Copilot license model. If your enterprise still uses a previous model, check its plan-specific requirements before following these steps. For current license details, see GitHub's [Copilot licensing documentation](https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing/github-copilot-licenses).

This workshop works through it in these areas:

- **Where licenses are assigned:** pick the places (organizations, the enterprise, or both) that match your policy groups.
- **How licenses are assigned:** decide whether membership is managed through your identity provider, manually, or through API automation. Users may also request a license.
- **How licenses are maintained:** decide what happens when users stop using Copilot.
- **Other controls:** decide whether to block personal Copilot plans on your network. If you require a usage-policy acknowledgment or training, include it in your own onboarding process.

### Policies follow the license

A user follows the policies of the enterprise or organization that gives them the license. So the place where you assign licenses also decides which policies a user gets.

- **Organization licenses:** enterprise owners first enable Copilot for the organization. The user then follows the enterprise policies. Where the enterprise chose `Let organizations decide`, the organization's own setting applies. If several organizations give the same user a license, the least restrictive policy usually applies.
- **Enterprise licenses:** `Policies for enterprise-assigned users` sets the defaults, and `Let organizations decide` does not cover these users.

License assignment can target everyone in an organization, selected users, or teams at the organization or enterprise level. Each option has different access and membership trade-offs:

- **All Organization members:** Every current and future organization member gets a license. You cannot select individual members, and each new member is billed.
- **Individual Organization users:** Organization owners select users by name or upload a CSV file. Users who are not members are invited to the organization; outside collaborators get a license without an invitation.
- **Organization teams:** Users get access when they join the team. A team can be synced with an IdP group. Audit log events for team-based grants name whoever first gave the team access, not the person or sync that added the member.
- **Individual Enterprise users:** Enterprise owners select users directly. Users must already be in the enterprise, invited, or provisioned from your IdP.
- **Enterprise teams:** Users get or lose access when they are added to or removed from the team. With Enterprise Managed Users, the team can be synced with an IdP group. You must create the team first, and an enterprise team holds at most 5,000 users.

> [!NOTE]
> If the same user gets a license from more than one organization, the least restrictive policy usually applies.

## Decisions

Use these questions to decide who should have access, how access is assigned, and when it should be removed.

### Decision: AM-01
**Title:** Policy groups
**Policies:** access.enterprise-assignment, access.organization-seats
**Catalog IDs:** none

#### Question

Do different groups of users need different Copilot policies?

#### Guidance

Separate policy groups give you more control and flexibility, but each one adds maintenance work and can make policy drift or confusion more likely.

Hence, even the largest customers choose a simple two-tier model here:

- **Production group:** most users follow the company's standard Copilot policies.
- **Experimentation group:** a small group of AI leaders or other designated users evaluates new models or preview features before you decide whether to offer them more widely.

This two-group approach can work at large scale. Your company may have requirements that call for more fine-grained policies.

#### Option: one
**Label:** One policy for everyone
**Configure:** am-policy-groups-one

This is the simplest: Everyone gets the same Copilot policies.

#### Option: cohorts
**Label:** A production and an experimentation group
**Configure:** am-policy-groups

A small group tries new models and features first. Everyone else gets the approved set.

#### Option: business-units
**Label:** Different policies for multiple groups
**Configure:** am-policy-groups-business-units

Different groups need different policies.

### Decision: AM-02
**Title:** License source
**Policies:** access.enterprise-assignment, access.organization-seats

#### Question

Where do users get their Copilot license?

#### Guidance

The license source decides which policies apply to a user. Use your answer to **Policy groups** to guide this choice. **Recommended —** If groups need different feature policies, we recommend organization-level assignment, with one organization per policy group. Enterprise owners can let organization owners decide their own settings. For enterprise-assigned users, `Policies for enterprise-assigned users` sets the defaults for policies delegated to organizations.

Direct enterprise assignment is available and allows `Copilot only` licenses, where a user receives a Copilot license without needing a GitHub Enterprise license. Enterprise teams mode for model access is currently an opt-in preview. It replaces organization-level model settings with model access through enterprise teams. For other Copilot feature policies, enterprise-assigned users follow the enterprise settings and the defaults above.

See [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies) and [model access through enterprise teams](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-availability-of-default-models).

#### Option: central-org
**Label:** One dedicated Copilot organization
**Configure:** am-enable-organizations, am-organization-assignment, am-lab-exercise

Users join one organization that exists only to hand out Copilot licenses. Use a few such organizations if you need separate policy groups.

#### Option: organizations
**Label:** Each existing organization
**Configure:** am-enable-organizations, am-organization-assignment, am-lab-exercise

Each working organization assigns licenses to its own members. Users in several organizations may get a license from more than one.

#### Option: enterprise
**Label:** Directly from the enterprise
**Configure:** am-enterprise-assignment, am-lab-exercise

Enterprise owners assign Copilot licenses to users or enterprise teams. This is simplest if you don't need multiple groups of feature policies. It allows you to assign `Copilot only` licenses.

#### Option: mixed
**Label:** Organizations and the enterprise — Not recommended
**Configure:** am-enable-organizations, am-organization-assignment, am-enterprise-assignment, am-lab-exercise

Some groups get licenses from organizations, others directly from the enterprise. Keep a clear record of which group uses which source and the policy that applies. **Not recommended —** We do not recommend giving the same user licenses from multiple organizations, because the least restrictive policy usually applies.

### Decision: AM-03
**Title:** Assignment method
**Policies:** access.assignment-automation, access.organization-seats, access.enterprise-assignment

#### Question

How do you want to manage Copilot license assignment?

#### Guidance

Once you have chosen the license source (the enterprise or an organization), decide how you want the assignment to happen.

For individual assignments, this means assigning a Copilot license directly at the enterprise or organization level. For team and organization assignments, it means adding users to the right team or organization.

You can choose whether to do this manually, through API-based automation, or through your identity provider.


#### Option: idp
**Label:** In our identity provider
**Configure:** am-idp-groups

An IdP group does not assign Copilot by itself. Connect it to an organization or enterprise team, then assign Copilot to that team. Only enterprises with Enterprise Managed Users can connect an enterprise team to an IdP group. Without Enterprise Managed Users, use team synchronization with organization teams.

> [!WARNING]
> This lab enterprise does not use Enterprise Managed Users or an identity provider. You cannot connect teams to IdP groups here.

> [!IMPORTANT]
> Adding someone to the IdP group happens outside GitHub. Include this in your identity-management or onboarding process. If users must acknowledge a usage policy or complete training, check that before adding them to the group. For example, your process might ask them to acknowledge rules for using a company license in personal or private projects.

#### Option: github
**Label:** Manually
**Configure:** am-team-assignment

Use the GitHub UI to assign licenses directly or grant a license to a team. Keep team membership current so access changes as users join or leave.

#### Option: api
**Label:** Automated through APIs
**Configure:** am-api-assignment

Your own scripts or workflows use APIs to assign and remove licenses for users or teams.

#### Option: mixed
**Label:** IdP for some groups, GitHub for others
**Configure:** am-idp-groups, am-team-assignment

Document which groups the IdP owns. Connect each group to an organization or enterprise team, and do not edit those groups on GitHub. Apply your onboarding checks before adding users to those groups.
Use the manual membership steps only for groups managed in GitHub.

### Decision: AM-04
**Title:** Access requests
**Policies:** access.self-serve-requests

#### Question

Do you want users to be able to self-serve a license?

#### Guidance

There are two approaches: organization owners can approve built-in requests, or your own API-based process can grant access after checks. If you use IdP groups, the request and approval process must also update the IdP group; GitHub does not add a user to that group for you.

#### Option: approval
**Label:** Yes, with an organization owner approval
**Configure:** am-request-approval

For a smaller rollout where organization owners can make the decision, the built-in request flow is a simple option. It requires an owner to review and approve each request.

#### Option: automatic
**Label:** Yes, through our own automated process
**Configure:** am-api-assignment

Your tooling checks the request, then grants access through the REST API or updates the IdP group that controls team membership.

#### Option: admin-only
**Label:** No, administrators assign licenses
**Configure:** none

Users do not request access directly. Tell them which team manages assignment.

### Decision: AM-05
**Title:** Personal plans on your network
**Policies:** access.network-routing

#### Question

Should personal Copilot plans be blocked on your corporate network?

#### Guidance

Your network can decide which Copilot plans work on it. This blocks plans, not projects. It does not stop personal use of a company license.

#### Option: block
**Label:** Yes, block personal plans
**Configure:** am-network-routing

This blocks personal Copilot plans on the corporate network.

#### Option: allow
**Label:** No, allow all plans
**Configure:** none

Users can use any Copilot plan on your network. Still allow the domains your Copilot clients need.

### Decision: AM-06
**Title:** Inactive users
**Policies:** access.license-lifecycle

#### Question

Do you need to regularly check whether users are still using their licenses or have become inactive?

#### Guidance

Each license costs money whether it is used or not. Remind inactive users first, then remove the license after a grace period.

#### Option: automated
**Label:** Automated reminders and removal
**Configure:** am-inactive-users

A scheduled job finds inactive users, reminds them, and removes licenses after the grace period.

#### Option: manual
**Label:** Regular manual review
**Configure:** am-inactive-users

An administrator reviews activity on a fixed schedule.

#### Option: keep
**Label:** Keep licenses assigned
**Configure:** none

You accept the cost of unused licenses.

## Configure

Your answers select the guidance below. Most steps describe a production setup. Do not buy, assign, or remove licenses in the lab: assigning a license can cost money. The one exercise asks you to inspect where your user gets Copilot.

### Recipe: am-policy-groups
**Title:** Plan production and experimentation groups
**Kind:** guidance
**Policies:** access.enterprise-assignment, access.organization-seats
**Catalog IDs:** none

#### Steps

1. List the controls that must differ between groups, such as models or features.
2. For groups assigned through organizations, give each policy group its own licensing organization. Users follow the policies of the organization that gives them the license. For groups assigned directly by the enterprise, use **Assign licenses directly in the enterprise** instead. See [Granting users access to GitHub Copilot in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-access/grant-access).
3. For organization-assigned groups, keep each user in one licensing organization where you can. If several organizations in one enterprise give a user a license, the least restrictive policy usually applies.

See [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

#### Warning: cohorts-enterprise
**When:** AM-01.cohorts, AM-02.enterprise

Enterprise-assigned users share the defaults from `Policies for enterprise-assigned users` for most policies. Team targeting for models is a separate opt-in preview. To give a test group different policies beyond that model preview, license it through an organization.

### Recipe: am-policy-groups-one
**Title:** Plan one policy group
**Kind:** guidance
**Policies:** access.enterprise-assignment, access.organization-seats
**Catalog IDs:** none

#### Steps

1. Keep the same Copilot policies for everyone.

See [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

### Recipe: am-policy-groups-business-units
**Title:** Plan policy groups for business units
**Kind:** guidance
**Policies:** access.enterprise-assignment, access.organization-seats
**Catalog IDs:** none

#### Steps

1. List the controls that must differ between groups, such as models or features.
2. For groups assigned through organizations, give each policy group its own licensing organization. Users follow the policies of the organization that gives them the license. For groups assigned directly by the enterprise, use **Assign licenses directly in the enterprise** instead. See [Granting users access to GitHub Copilot in your enterprise](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-access/grant-access).
3. For organization-assigned groups, keep each user in one licensing organization where you can. If several organizations in one enterprise give a user a license, the least restrictive policy usually applies.

See [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies).

#### Warning: units-enterprise
**When:** AM-01.business-units, AM-02.enterprise

Enterprise-assigned users share the defaults from `Policies for enterprise-assigned users` for most policies. Team targeting for models is a separate opt-in preview. To give business units different policies beyond that model preview, license them through organizations.

### Recipe: am-enable-organizations
**Title:** Enable Copilot for organizations
**Kind:** guidance
**Policies:** access.enterprise-assignment
**Catalog IDs:** access.copilot-org-enablement

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**.
2. Under `Organization access`, choose all organizations or `Allow for specific organizations`.
3. For specific organizations, open the `Organizations` tab. Enable Copilot for each licensing organization.
4. Organization owners now assign licenses. Enabling an organization does not assign any license by itself.

Use your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")** to review later changes to organization enablement.

### Recipe: am-organization-assignment
**Title:** Assign licenses in an organization
**Kind:** guidance
**Policies:** access.organization-seats
**Catalog IDs:** access.org-seat-assignment
**API:** https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management

> [!NOTE]
> Billing starts when access is granted, not when the user first uses Copilot. Charges are prorated.

#### Steps

1. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")**.
2. If shown, choose `Allow this organization to assign seats`, then `Start adding seats`.
3. Choose `Purchase for all members` or `Purchase for selected members`. Choose selected members if requests or checks come before access.
4. For selected members, add users or teams on the `Users and teams` tab, or use `Upload CSV`.

Without Enterprise Managed Users, a CSV upload searches all GitHub.com users. It can invite people who are not yet members of your organization.

### Recipe: am-enterprise-assignment
**Title:** Assign licenses directly in the enterprise
**Kind:** guidance
**Policies:** access.enterprise-assignment
**Catalog IDs:** access.enterprise-direct-license-assignment, access.enterprise-teams
**API:** https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management

#### Steps

1. Set `Policies for enterprise-assigned users` first. It decides the defaults for every enterprise-assigned user.
2. Invite or provision users into the enterprise first. To assign by team, create the enterprise team first in **[Enterprise Settings -> People -> Enterprise teams](https://github.com/enterprises/{{enterprise.slug}}/teams "fallback=https://github.com/settings/enterprises")**.
3. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**.
4. On the `All members` or `Enterprise Teams` tab, choose `Assign licenses`. Select the users or teams, then choose `Add licenses`.
5. If all access comes from the enterprise, you can disable Copilot for organizations. Licenses granted by those organizations are then revoked at the end of the billing period.

> [!NOTE]
> An enterprise team can have up to 5,000 users. If you give an enterprise team access to organizations, outside collaborators or unaffiliated users in the team become standard enterprise members and consume a GitHub Enterprise license. See [Creating enterprise teams](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-accounts-and-repositories/managing-users-in-your-enterprise/create-enterprise-teams).

### Recipe: am-idp-groups
**Title:** Manage membership through your identity provider
**Kind:** guidance
**Policies:** access.assignment-automation
**Catalog IDs:** access.idp-group-team-linking-scim, access.team-synchronization, access.enterprise-teams

#### Steps

1. With Enterprise Managed Users, connect an organization team or enterprise team to an IdP group. An enterprise team must have no manually added members before you connect it.
2. Without Enterprise Managed Users, use team synchronization to connect an organization team to an IdP group. It needs SAML single sign-on and Microsoft Entra ID or Okta. If SAML is configured for the enterprise, turn on team synchronization for the whole enterprise instead. This works with Microsoft Entra ID only.
3. Team synchronization only adds users who are already organization members. Without Enterprise Managed Users, enterprise teams cannot connect to an IdP group.
4. After a team is connected, change its membership in the IdP only. In Microsoft Entra ID, use a security group without nested groups.
5. Expect a delay. With Enterprise Managed Users, GitHub reconciles membership daily and on each SCIM update. If an IdP group connected to an enterprise team grows past 5,000 users, syncing stops.
6. Grant Copilot to the connected team. Joining or leaving the IdP group then grants or removes the license.

> [!WARNING]
> This lab enterprise does not use Enterprise Managed Users or an identity provider. You cannot try these steps here. Apply them in your production enterprise.

See [Managing team memberships with identity provider groups](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/provisioning-user-accounts-with-scim/managing-team-memberships-with-identity-provider-groups) and [Managing team synchronization for your organization](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-saml-single-sign-on-for-your-organization/managing-team-synchronization-for-your-organization).

### Recipe: am-team-assignment
**Title:** Assign licenses manually
**Kind:** guidance
**Policies:** access.organization-seats, access.enterprise-assignment
**Catalog IDs:** access.org-seat-assignment, access.enterprise-teams

#### Steps

1. For individual assignment, select users directly in the organization's Copilot access page or the enterprise licensing page. For team assignment, create one access team per policy group: an organization team, or an enterprise team for direct enterprise assignment.
2. For team assignment, grant Copilot to the team once. In an organization, add it on the `Users and teams` tab. In the enterprise, use the `Enterprise Teams` tab.
3. For team assignment, manage membership in GitHub only for GitHub-managed groups. For IdP-managed groups, use **Manage membership through your identity provider** instead.

### Recipe: am-api-assignment
**Title:** Assign licenses through the REST API
**Kind:** guidance
**Policies:** access.assignment-automation
**Catalog IDs:** access.org-seat-assignment, access.enterprise-direct-license-assignment
**API:** https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management

#### Steps

1. For organization licenses, call `POST /orgs/{org}/copilot/billing/selected_users` or `POST /orgs/{org}/copilot/billing/selected_teams`. These command examples are reference-only because this lab cannot assign licenses to other people.

   ```sh manual
   gh api --method POST "/orgs/YOUR-ORG/copilot/billing/selected_users" -f "selected_usernames[]=YOUR-USERNAME"
   gh api --method POST "/orgs/YOUR-ORG/copilot/billing/selected_teams" -f "selected_teams[]=YOUR-TEAM"
   ```

2. For direct enterprise licenses, call `POST /enterprises/{enterprise}/copilot/billing/selected_users` or `POST /enterprises/{enterprise}/copilot/billing/selected_enterprise_teams`. These command examples are reference-only because this lab cannot assign licenses to other people.

   ```sh manual
   gh api --method POST "/enterprises/YOUR-ENTERPRISE/copilot/billing/selected_users" -f "selected_usernames[]=YOUR-USERNAME"
   gh api --method POST "/enterprises/YOUR-ENTERPRISE/copilot/billing/selected_enterprise_teams" -f "selected_enterprise_teams[]=YOUR-ENTERPRISE-TEAM"
   ```

3. Run approval, policy, and training checks in your tool before the call.
4. Build removal with the matching `DELETE` endpoints. If the IdP owns membership, update the IdP group instead.

> [!NOTE]
> GitHub's example uses an issue and a GitHub Actions workflow, or a button in an internal portal. See [Setting up a self-serve process for Copilot licenses](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/assign-licenses/set-up-self-serve-licenses).

### Recipe: am-request-approval
**Title:** Approve access requests
**Kind:** guidance
**Policies:** access.self-serve-requests
**Catalog IDs:** access.copilot-access-requests

#### Steps

1. Tell organization members to request access from their [personal Copilot settings](https://github.com/settings/copilot).
2. Organization owners navigate to **Organization Settings -> Requests from members** in the `Access` section. Under `Copilot Business`, approve or deny the request.
3. Owners get a weekly email about pending requests.

See [Managing requests for Copilot access in your organization](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/manage-access/manage-requests-for-access).

#### Warning: enterprise-requests
**When:** AM-04.approval, AM-02.enterprise

Organization owners approve built-in requests in their organization. For direct enterprise licenses, build your own request and approval process.

### Recipe: am-network-routing
**Title:** Block personal Copilot plans on your network
**Kind:** guidance
**Policies:** access.network-routing
**Catalog IDs:** access.subscription-based-network-routing

#### Steps

1. Ask your network team to change the corporate firewall. There is no Copilot setting to turn on.
2. Allow `*.business.githubcopilot.com` and `*.enterprise.githubcopilot.com`.
3. Block `*.individual.githubcopilot.com` to stop personal plans.
4. Allow the other required hostnames in the [Copilot allowlist reference](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-allowlist-reference), but do not allow `*.githubcopilot.com` or `*.individual.githubcopilot.com`.
5. Check client versions: at least VS Code Copilot Chat 0.17, JetBrains 1.5.6.5692, or Visual Studio 2022 17.11.

This applies to code completion, chat in the IDE, Copilot Chat on GitHub, GitHub Mobile, and Copilot CLI.

### Recipe: am-inactive-users
**Title:** Find and remind inactive users
**Kind:** guidance
**Policies:** access.license-lifecycle
**Catalog IDs:** access.org-seat-assignment
**API:** https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management

#### Steps

1. Choose an inactivity limit and a grace period. GitHub's example reminds users after 30 days of inactivity and plans removal after a further 30 days.
2. To review by hand, navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")**. Sort by last activity, or download the activity report.
3. To automate, call `GET /orgs/{org}/copilot/billing/seats` and read `last_activity_at`. Enterprises and enterprise teams have similar endpoints. To try it with GitHub CLI, run the command below. It uses the organization saved in your workshop profile.

   ```sh profile
   gh api "/orgs/{{organization.slug}}/copilot/billing/seats"
   ```

4. Activity data can be up to 24 hours late. Check before you call a user inactive.
5. Remind the user and offer help. After the grace period, remove the unused license from the source that assigned it.

### Recipe: am-lab-exercise
**Title:** Find where your user gets Copilot
**Kind:** exercise
**Exercise ID:** AM-LAB
**Target:** github-page
**Policies:** access.organization-seats, access.enterprise-assignment
**Catalog IDs:** access.org-seat-assignment, access.enterprise-direct-license-assignment
**Requires decisions:** AM-02
**Variant decision:** AM-02

Look at how access is assigned in your sandbox enterprise. Compare it with your answer to **License source**.

#### Safety

Inspect only. Do not buy, assign, or remove licenses: assigning a license can cost money. Use only your sandbox enterprise, organization, and user.

#### Variant: central-org

##### Steps

1. Note your user's name.
2. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")**.
3. Find your user. Note whether the license comes from the user, a team, or all members.
4. Sort by last activity and note when your user last used Copilot.

#### Variant: organizations

##### Steps

1. Note your user's name.
2. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")**.
3. Find your user. Note whether the license comes from the user, a team, or all members.
4. Sort by last activity and note when your user last used Copilot.

#### Variant: enterprise

##### Steps

1. Note your user's name.
2. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**.
3. Look for your user on the `All members` tab, then check the `Enterprise Teams` tab.
4. Note whether the license comes from the user or from a team.

#### Variant: mixed

##### Steps

1. Note your user's name.
2. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")** and look for your user.
3. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")** and check the `All members` and `Enterprise Teams` tabs.
4. Note every source that gives your user a license.

## Validation

Use this check to compare your user's access with your plan. It does not test access requests, identity-provider membership, network routing, policy-group design, or automatic inactivity reminders and license removal. For those topics, see [Managing requests for Copilot access](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/manage-access/manage-requests-for-access), [Managing team memberships with identity provider groups](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/provisioning-user-accounts-with-scim/managing-team-memberships-with-identity-provider-groups), [Managing team synchronization](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-saml-single-sign-on-for-your-organization/managing-team-synchronization-for-your-organization), [Managing network access](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-access/manage-network-access), [GitHub Copilot policies](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/policies), and [Reminding inactive users](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/assign-licenses/remind-inactive-users).

### Exercise: AM-LAB
**Title:** Confirm your user's access
**Variant decision:** AM-02

Use the steps for your **License source** choice. See [Prepare Copilot in your IDE](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-in-your-ide/set-up-copilot/install-copilot-extension), [Ask Copilot a question in VS Code](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-in-your-ide/chat-with-copilot/chat-in-ide), and [Reviewing user activity data](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-organization/review-activity/review-user-activity-data) for the Copilot Chat and activity checks.

#### Variant: central-org

##### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**. Under `Organization access`, confirm that your dedicated Copilot organization is enabled. If access is allowed for specific organizations, check that this organization is on the `Organizations` tab.
2. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")** in the dedicated organization. Find your user and note whether the license comes from the user, a team, or all members.
3. Optionally, if you already have authorized access to the REST API, use `GET /enterprises/{enterprise}/copilot/billing/seats` to find your user's seat. Check that its `organization` is your dedicated organization. This endpoint is in public preview and requires enterprise-owner or billing-manager access. Do not share credentials. Keep downloaded data private. See the [REST API reference](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-enterprise). This command uses the enterprise saved in your workshop profile.

   ```sh profile
   gh api "/enterprises/{{enterprise.slug}}/copilot/billing/seats"
   ```
4. Signed in as your user, ask Copilot Chat a simple question, for example: Explain a JavaScript function that adds two numbers. Use no private code.
5. Note whether Copilot answers. If not, note the message and check the license, the sign-in, and the organization's chat policies.
6. Back on the organization's access page, sort by last activity and note your user's last-reported Copilot activity. Activity can take up to 24 hours to appear, so a missing or unchanged timestamp does not show that the license or Copilot is not working.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

##### Expected result

Your user's license comes from the dedicated Copilot organization, and that organization is enabled for Copilot. You can say whether Copilot answered, and you recorded the last-reported activity or noted that it has not appeared yet.

#### Variant: organizations

##### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**. Under `Organization access`, confirm that your user's organization is enabled. If access is allowed for specific organizations, check that it is on the `Organizations` tab.
2. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")**. Find your user and note whether the license comes from the user, a team, or all members. If your user belongs to more than one organization, check each one.
3. Optionally, if you already have authorized access to the REST API, use `GET /enterprises/{enterprise}/copilot/billing/seats`. The response has one seat entry for each organization or enterprise team that grants the user access, so more than one entry for your user means more than one license source. This endpoint is in public preview and requires enterprise-owner or billing-manager access. Do not share credentials. Keep downloaded data private. See the [REST API reference](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-enterprise). This command uses the enterprise saved in your workshop profile.

   ```sh profile
   gh api "/enterprises/{{enterprise.slug}}/copilot/billing/seats"
   ```
4. Signed in as your user, ask Copilot Chat a simple question, for example: Explain a JavaScript function that adds two numbers. Use no private code.
5. Note whether Copilot answers. If not, note the message and check the license, the sign-in, and the organization's chat policies.
6. Back on the organization's access page, sort by last activity and note your user's last-reported Copilot activity. Activity can take up to 24 hours to appear, so a missing or unchanged timestamp does not show that the license or Copilot is not working.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

##### Expected result

You can name each organization that gives your user a license and how it assigns it. The organization is enabled for Copilot. You can say whether Copilot answered, and you recorded the last-reported activity or noted that it has not appeared yet.

#### Variant: enterprise

##### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**.
2. Look for your user on the `All members` tab, then on the `Enterprise Teams` tab. Note whether the license is assigned to the user directly or through an enterprise team.
3. Optionally, if you already have authorized access to the REST API, use `GET /enterprises/{enterprise}/copilot/billing/seats` to find your user's seat. Note its `assigning_team` and `last_activity_at`. Users must have telemetry enabled in their IDE for IDE activity to appear in `last_activity_at`. This endpoint is in public preview and requires enterprise-owner or billing-manager access. Do not share credentials. Keep downloaded data private. See the [REST API reference](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-enterprise). This command uses the enterprise saved in your workshop profile.

   ```sh profile
   gh api "/enterprises/{{enterprise.slug}}/copilot/billing/seats"
   ```
4. Signed in as your user, ask Copilot Chat a simple question, for example: Explain a JavaScript function that adds two numbers. Use no private code.
5. Note whether Copilot answers. If not, note the message and check the license, the sign-in, and `Policies for enterprise-assigned users`.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

##### Expected result

Your user's license comes directly from the enterprise, either to the user or through an enterprise team. You can say whether Copilot answered. If you used the API, you also recorded the assigning team and the last-reported activity.

#### Variant: mixed

##### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage](https://github.com/enterprises/{{enterprise.slug}}/licensing/copilot "fallback=https://github.com/settings/enterprises")**. Look for your user on the `All members` and `Enterprise Teams` tabs.
2. On the same page, check `Organization access`. Note which organizations are enabled to assign licenses.
3. Navigate to your **[Organization Settings -> Copilot -> Access](https://github.com/organizations/{{organization.slug}}/settings/copilot/seat_management "fallback=https://github.com/settings/organizations")** and look for your user. Note whether the license comes from the user, a team, or all members.
4. Optionally, if you already have authorized access to the REST API, use `GET /enterprises/{enterprise}/copilot/billing/seats`. The response has one seat entry for each organization or enterprise team that grants the user access. Note each entry's `organization` or `assigning_team`. This endpoint is in public preview and requires enterprise-owner or billing-manager access. Do not share credentials. Keep downloaded data private. See the [REST API reference](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-enterprise). This command uses the enterprise saved in your workshop profile.

   ```sh profile
   gh api "/enterprises/{{enterprise.slug}}/copilot/billing/seats"
   ```
5. Compare every source you found with the group you planned for this user. If the user gets a license from more than one source, note it.
6. Signed in as your user, ask Copilot Chat a simple question, for example: Explain a JavaScript function that adds two numbers. Use no private code.
7. Note whether Copilot answers. If not, note the message and check the license, the sign-in, and the chat policies of the source that assigned the license.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

##### Expected result

You can name every source that gives your user a license and say whether it matches your plan. You can say whether Copilot answered.
