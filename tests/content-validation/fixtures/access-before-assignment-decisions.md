# Access Management

**Format version:** 1
**Block ID:** access-management
**Description:** Who gets access?

## Understand

The best access model depends on a multitude of factors, such as:

- The size and structure of your organization
- Whether you need the ability to apply policies to different groups of people,
  and how fine-grained this must be
- Whether you want to use automation or your IdP to manage Copilot Access centrally
- Whether you want to assign Copilot Seats to people without a GitHub Enterprise License
- Whether you have an existing GitHub account that this model needs to fit into,
  or if you are just starting fresh

### Decisions ahead

- **AM-01.** Copilot seats can generally be assigned on two layers:
  enterprise-level and organization-level. Furthermore, you can assign the seats
  individually, per Enterprise or Organization Team, or simply to every member
  of an organization.
- **AM-02.** Whether you need the ability to apply policies to different groups
  of people, and how fine-grained this must be.
- **AM-03.** Whether you want to use automation or your IdP to manage Copilot
  Access centrally.
- **AM-04.** Do you want your users to be able to self-serve Copilot? Do they
  need to go through an approval gate or have to fulfill certain preconditions
  (signing a usage policy, receiving training, etc.) before you want to enable access?

### Tradeoffs to consider

Individual: easy at first, but harder at scale. Mixed: combines individual, team,
and org-wide assignments to balance ease of management and scalability.
It is a bit harder to manage.

### Sources

- [Remind inactive users](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/assign-licenses/remind-inactive-users)
- [Granting enterprise access](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-access/grant-access)

## Decisions

### Decision: AM-01

**Title:** Access and rollout
**Policies:** access.organization-seats, access.enterprise-assignment

#### Question

Enterprise-level or organization-level? Individual, Teams, Org-Wide or Mixed?

#### Guidance

Copilot Access can be managed in multiple ways - each with its own trade-offs in terms of ease of management and scalability. Also, if you want to automate access entirely through your IdP and through GitHub's existing IdP Sync features, you have to choose one of the Teams options (Enterprise- or Organization Teams) to make that work.

Whether you have an existing GitHub account that this model needs to fit into, or if you are just starting fresh. Whether you want to assign Copilot Seats to people without a GitHub Enterprise License.

#### Option: pilot

**Label:** Individually or per Organization Team
**Configure:** am-lab-exercise

Individual: easy at first, but harder at scale. Organization Level: more administration overhead compared to enterprise-level assignment.

#### Option: organization

**Label:** Every member of an organization
**Configure:** am-lab-exercise

Org-Wide: easiest to scale for large organizations.

#### Option: enterprise-teams

**Label:** Per Enterprise Team
**Configure:** am-lab-exercise

Enterprise Level: easier, central management.

#### Option: enterprise-users

**Label:** Individually, enterprise-level
**Configure:** am-lab-exercise

Individual: easy at first, but harder at scale. Enterprise Level: easier, central management.

#### Option: mixed

**Label:** Mixed
**Configure:** am-lab-exercise

Combines individual, team, and org-wide assignments to balance ease of management and scalability. It is a bit harder to manage.

#### Option: review

**Label:** I don't know yet
**Configure:** none
**Deferred:** true

The best access model depends on a multitude of factors.

### Decision: AM-02

**Title:** Models, Clients and Features
**Policies:** models.enterprise-availability, features.enterprise-policies

#### Question

Who will make the decision about general access and policies?

#### Guidance

Whether you need the ability to apply policies to different groups of people, and how fine-grained this must be.

Some companies are fine with always staying at the cutting edge and allowing developers to use the latest and greatest; other companies prefer, or are even required, to have tighter control as to what is available where and when.

#### Option: central

**Label:** The central enterprise ownership team
**Configure:** am-02-central-guidance

Easier, central management.

#### Option: delegate

**Label:** Organization owners
**Configure:** am-02-delegate-guidance

Whether you need the ability to apply policies to different groups of people, and how fine-grained this must be.

#### Option: review

**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Who will make the decision about general access and policies?

### Decision: AM-03

**Title:** Assignment automation
**Policies:** access.assignment-automation

#### Question

Do you want to use automation or your IdP to manage Copilot Access centrally?

#### Guidance

In whatever way you choose, you have two primary ways to automate the process.

Using a custom script and/or GitHub Action that will use the APIs to manage Team Membership and/or Copilot Access. Using IdP Sync at Enterprise or Organization Team level.

#### Option: custom

**Label:** Using a custom script and/or GitHub Action
**Configure:** am-03-custom-guidance

Requires you to create and maintain this automation. Allows you to plug it into existing access-management platforms or tools you are using in your company.

#### Option: idp

**Label:** Using IdP Sync at Enterprise or Organization Team level
**Configure:** am-03-idp-guidance

Only works with Teams. You might still have to automate the team creation, but it is a one-time setup.

#### Option: review

**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Do you want to use automation or your IdP to manage Copilot Access centrally?

### Decision: AM-04

**Title:** Self-serve Copilot
**Policies:** access.assignment-automation

#### Question

Do you want your users to be able to self-serve Copilot?

#### Guidance

Do they need to go through an approval gate or have to fulfill certain preconditions before you want to enable access?

Signing a usage policy, receiving training, etc.

#### Option: self-service

**Label:** Self-serve Copilot
**Configure:** am-04-self-service-guidance

Users are able to self-serve Copilot.

#### Option: gated

**Label:** An approval gate or certain preconditions
**Configure:** am-04-gated-guidance

Signing a usage policy, receiving training, etc., before you want to enable access.

#### Option: review

**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Do they need to go through an approval gate or have to fulfill certain preconditions?

## Configure

### Recipe: am-02-central-guidance

**Title:** Models, Clients and Features: The central enterprise ownership team
**Kind:** guidance
**Policies:** models.enterprise-availability, features.enterprise-policies

Central Feature & Client Policies.

### Recipe: am-02-delegate-guidance

**Title:** Models, Clients and Features: Organization owners
**Kind:** guidance
**Policies:** models.enterprise-availability, features.enterprise-policies

Apply policies to different groups of people.

### Recipe: am-03-custom-guidance

**Title:** Assignment automation: Using a custom script and/or GitHub Action
**Kind:** guidance
**Policies:** access.assignment-automation

Use the APIs to manage Team Membership and/or Copilot Access.

### Recipe: am-03-idp-guidance

**Title:** Assignment automation: Using IdP Sync at Enterprise or Organization Team level
**Kind:** guidance
**Policies:** access.assignment-automation

Using IdP Sync at Enterprise or Organization Team level.

### Recipe: am-04-self-service-guidance

**Title:** Self-serve Copilot: Self-serve Copilot
**Kind:** guidance
**Policies:** access.assignment-automation

Users are able to self-serve Copilot.

### Recipe: am-04-gated-guidance

**Title:** Self-serve Copilot: An approval gate or certain preconditions
**Kind:** guidance
**Policies:** access.assignment-automation

Add a gate before giving access, e.g. signing a policy, requiring training.

### Recipe: am-lab-exercise

**Title:** Give a sandbox developer Copilot access
**Kind:** exercise
**Exercise ID:** AM-LAB
**Policies:** access.organization-seats, access.enterprise-assignment
**Requires decisions:** AM-01, AM-02
**Variant decision:** AM-01
**Target:** github-page

One access-configuration exercise based on AM-01. The other choices produce a follow-up configuration checklist; they are not configured or verified by this lab. Unanswered or "I don't know yet" items remain unresolved. Funding and consumption guardrails belong to Billing & Cost Control.

#### Safety

Use only assigned test accounts and approved organizations or teams: granting a license can incur charges. Get facilitator approval before any purchase or assignment; otherwise inspect an approved assignment, or choose Proposal only and Blocked if none is available.

#### Prerequisites

- A facilitator-approved sandbox, permitted license assignment, and rollback or retention plan.
- An organization owner for organization assignments, or an enterprise owner for the enterprise licensing exercise.
- A designated test developer and a known starting access state. Copilot Free or another license may make a successful response inconclusive about this assignment.
- A supported, prepared VS Code environment signed in as that test developer, with Copilot Chat permitted by the applicable policies.

#### Variant: pilot

##### Scope

organization

##### Role

Organization owner

##### Steps

1. Navigate to your **Organization Settings -> Copilot -> Access** (under "Code, planning, and automation").
2. Inspect existing assignments first. If a purchase is approved and the controls are shown, choose Allow this organization to assign seats, then Start adding seats.
3. Choose Purchase for selected members. In Users and teams, select only the facilitator-approved test user or team.
4. Review the exact target and cost with the facilitator. Only with approval, select Continue to purchase and Purchase seats.
5. Reopen Access and confirm the intended assignment. Copy this GitHub settings page URL into the canvas so you can reopen it.

#### Variant: organization

##### Scope

organization

##### Role

Organization owner

##### Steps

1. Use an isolated sandbox organization whose entire membership is approved for this exercise. If this is not available, record Blocked instead of expanding access.
2. Navigate to your **Organization Settings -> Copilot -> Access**.
3. Inspect existing assignments. If purchasing is approved and these controls are shown, choose Allow this organization to assign seats, then Start adding seats.
4. Choose Purchase for all members. Review the current and future membership implications and cost before approving Purchase seats.
5. Reopen Access and confirm the selected organization-wide access approach. Copy this settings page URL into the canvas.

#### Variant: enterprise-users

##### Scope

enterprise

##### Role

Enterprise owner

##### Steps

1. Confirm the approved test user is invited or provisioned into the enterprise and that Copilot Business assignment is approved.
2. Review Policies for enterprise-assigned users before assigning access.
3. Navigate to your **Enterprise Settings -> Billing and licensing -> Licensing**. Next to Copilot, choose **Manage**.
4. Open All members, inspect existing assignments, and only with approval choose Assign licenses, select the test user, then Add licenses.
5. Confirm the test user's assignment and copy the licensing page URL into the canvas.

#### Variant: mixed

##### Scope

enterprise

##### Role

Enterprise owner and the relevant organization owners

##### Steps

1. Map which approved audiences use individual, team or organization-wide assignment, and identify an owner for each route.
2. For this one-developer exercise, choose one approved route to inspect; do not roll out every route or expand access to finish the lab.
3. For organization assignment, navigate to your **Organization Settings -> Copilot -> Access** and inspect the approved user, team or organization-wide assignment.
4. For direct enterprise assignment, navigate to your **Enterprise Settings -> Billing and licensing -> Licensing -> Copilot -> Manage** and inspect All members or Enterprise Teams.
5. Confirm the route covering the designated developer, record the other routes as follow-up, and copy the inspected licensing or settings page URL.

#### Variant: enterprise-teams

##### Scope

enterprise

##### Role

Enterprise owner

##### Steps

1. Confirm an existing approved enterprise team, its test membership, and availability of Copilot Business licenses. Review the documented prerequisites, including policies for enterprise-assigned users.
2. Navigate to your **Enterprise Settings -> Billing and licensing -> Licensing**.
3. Next to Copilot, choose **Manage -> Enterprise Teams** tab.
4. Inspect existing assignments. Only if explicitly approved, select Assign licenses, select the approved team, and choose Add licenses.
5. Confirm the intended team assignment and membership. Copy the licensing page URL into the canvas so you can reopen it.

## Validation

### Exercise: AM-LAB

**Title:** Try Copilot as the test developer

#### Steps

1. Confirm that the saved access assignment includes the intended test developer, directly or through the approved team.
2. In the prepared VS Code environment, verify that you are signed in with the designated test developer account. Do not share credentials in the canvas.
3. Open Copilot Chat, choose Ask mode, and ask: Explain a simple JavaScript function that adds two numbers. Use no private code or sensitive context.
4. Observe whether a response is returned. If access is unavailable or blocked, record the message category and investigate licensing, authentication, chat policies, and applicable budgets without changing extra policies.
5. Compare the observation with the starting access state and saved assignment. A response alone does not prove which license supplied access.
6. Record non-sensitive evidence and any follow-up. Follow the facilitator's rollback or retention plan; do not remove shared licenses without approval.

#### Expected result

The approved assignment is visible and the designated test developer can complete the permitted chat task. If another access route makes attribution unclear, record that limitation or leave verification incomplete.

#### Evidence

Describe the assignment check, client/account-context check, and developer observation without identities, copied prompts, private code, or credentials.

- [Prepare Copilot in your IDE](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/set-up-copilot/install-copilot-extension)
- [Ask Copilot a question in VS Code](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/chat-with-copilot/chat-in-ide)
