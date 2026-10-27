# Billing & Cost Control
**Format version:** 1
**Block ID:** billing-cost-control
**Description:** Who pays, how is consumption allocated, and how do we prevent unexpected costs?
**Subtitle:** Understand, allocate and control AI spending
**Duration minutes:** 15

## Understand

### How Copilot is billed

Copilot requests that use AI models consume `AI credits`, where 1 AI Credit equals $0.01 USD. AI Credits are accumulated through Token usage, whereas the price per token depends on the selected Model as well as the Token type. 

In this Lab, we're assuming you already have a basic understanding of this cost mechanism, so we won't go deeper into it at this point - but if you want to understand this better, refer to GitHub's documentation on [AI credit consumption](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing) and [models and pricing](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-billing/models-and-pricing).

Payment methods for AI credit usage depend on your account's billing arrangement:

- Credit card or PayPal for unmanaged accounts; available only as nonrecurring payment methods for managed accounts.
- An eligible Azure subscription.
- Invoice or Automated Clearing House (ACH) for managed accounts only.

See [supported payment methods for GitHub](https://docs.github.com/en/billing/reference/supported-payment-methods) for eligibility and unsupported Azure subscription types.


> [!NOTE]
> **Seat cost:** Before the Universe announcement, Copilot Business cost $19 USD and Copilot Enterprise cost $39 USD per seat per month. Each seat came with included AI credits pooled across the billing entity. See [Copilot plans](https://docs.github.com/en/copilot/get-started/plans).
>
> At Universe, we announced a new model: Copilot is bundled with GitHub Enterprise licenses, or available standalone for $10 USD per user per month, without an included-credit pool.
>
> Existing Copilot customers can choose to remain on the old model or switch to the new one. New Copilot customers automatically receive the new model. These announcement details are undocumented - confirmed by @davelosert.

### How to control Copilot cost

Customers often ask how they can estimate their potential spend. That's difficult: the cost of a single Copilot session depends on the model and tokens consumed, and the work people hand over to agents varies. Estimating hundreds or thousands of sessions across a company adds more uncertainty. As developers gain practical experience, the tasks they use agents for may also change, so a forecast needs to be revisited.

GitHub's recommendation is to manage AI consumption much like cloud infrastructure: make costs visible, assign spending owners, and use budgets and alerts to manage risk. Start by measuring consumption and agreeing how much financial exposure you can accept. Balance that against the impact of stopping people or automated workflows mid-task.

Cost control is therefore an ongoing process of monitoring, evaluating, and adjusting. Assign someone to investigate unexpected usage and respond to budget alerts. Review consumption weekly while usage patterns are emerging, then monthly once they are more predictable. Use what you learn to update forecasts, budget amounts, and usage guidance rather than expecting the first estimate to remain accurate.

> [!NOTE]
> For more detailed guidance, see [Managing AI credits in GitHub's Well-Architected Framework](https://learn.github.com/well-architected/governance/recommendations/managing-ai-credits). It covers attribution, budgets, and ongoing cost management in greater depth. Its pool-specific recommendations apply only if you intentionally retain the pooled billing model.

### GitHub primitives

GitHub provides budgets to control consumption and spending, cost centers to attribute costs, and billing reports to review usage and charges.

#### Budgets

AI credits are not limited to Copilot. AI-powered features in [GitHub Advanced Security](https://docs.github.com/en/billing/concepts/product-billing/github-advanced-security#how-ai-feature-usage-is-billed), such as AI Scan and agentic autofix, and [GitHub Code Quality](https://docs.github.com/en/billing/concepts/product-billing/github-code-quality#github-ai-credits) also consume them. Factor these workloads into your spending plans alongside developer use of Copilot.

A budget's type determines which usage it covers; its scope determines whose usage it covers. A **Bundled AI credits budget** covers metered spending across all AI-credit SKUs, so one product can exhaust a shared hard budget and interrupt another. SKU-level budgets let you control specific usage separately, such as **Code Security AI Credits** for AI Scan and agentic autofix. If both a shared and a SKU-level hard budget apply, exhausting either can block that usage. See [setting up budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets).

Budgets at different scopes are separate guardrails, and a hard stop may interrupt work. See [budgets for usage-based billing](https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

| Budget | What it controls | Does it stop usage? | Behavior with pooled AI credits |
| --- | --- | --- | --- |
| User-level budget | One user's total AI credit consumption. It can be universal, set for each user in a cost center, or set for an individual user; the most specific applicable budget takes precedence. | Always enforces a hard stop. | Counts both included and metered usage. |
| Cost center budget | Total metered charges for a cost center's assigned users or organization. | Only when **Stop usage when budget limit is reached** is enabled. | Applies after the shared pool is exhausted. |
| Organization budget | Metered charges for users whose Copilot license is billed to the organization. | Only when the setting is enabled. | Applies after the shared pool is exhausted. |
| Enterprise budget | Total metered charges across the enterprise. | Only when the setting is enabled. | Applies after the shared pool is exhausted. |

#### Cost centers

Cost centers group usage for cost attribution, such as by business unit or project. Check which users, organizations, or teams are assigned before relying on that view, since allocation depends on the product and billing arrangement. See [cost center allocation](https://docs.github.com/en/billing/reference/cost-center-allocation).

#### Available Billing Reports

Billing reports show usage, AI credit consumption, and billing amounts. Available reports include:

| Report | What it shows |
| --- | --- |
| Summarized usage report | Usage and amounts grouped by date, SKU, repository, and cost center, for up to one year. |
| Detailed usage report | Adds username and workflow path to usage details, for up to 31 days; available through the GitHub web interface. |
| AI usage report | Per-user AI credit consumption by model, with token details, for up to 31 days. |

See the [billing reports reference](https://docs.github.com/en/billing/reference/billing-reports) for report fields and limits.

## Decisions

### Decision: BC-01
**Title:** Who should pay for AI consumption?
**Policies:** billing.cost-centers

#### Question

Who should pay for AI consumption?

#### Guidance

Your organization has successfully piloted Copilot and wants to expand to hundreds of developers. Finance wants predictable costs, engineering teams want flexibility, and different departments need accountability for their AI consumption.

Choose who owns the pilot's costs, not a new payment connection. Use the approved cost center for attribution; allocation precedence is explained in the policy guidance below.

#### Option: central
**Label:** Central funding with pilot showback
**Configure:** bc-lab-exercise

Finance funds the pilot centrally; use one pilot cost center to show consumption without treating attribution as a separate invoice.

#### Option: department
**Label:** Departmental accountability through users or enterprise teams
**Configure:** bc-lab-exercise

Use a departmental cost center for internal chargeback. Enterprise-team membership stays current automatically; inspect direct assignments and overlapping teams before relying on attribution.

#### Option: organization
**Label:** Allocate through the licensing organization
**Configure:** bc-lab-exercise

Use an organization-aligned cost center when the licensing boundary matches the funding owner. Multiple license sources and direct assignments can make the expected allocation differ.

#### Option: review
**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Keep existing allocation unchanged until Finance agrees the owner and confirms the pilot's membership and licensing source.

### Decision: BC-02
**Title:** How should we control spending?
**Policies:** billing.ai-credit-guardrails

#### Question

How should we control spending?

#### Guidance

One pilot developer reaches their individual consumption limit while the shared pool and the team's metered budget still have capacity. Finance asks whether the unused team budget lets that developer continue.

User-level budgets always stop each user's included and metered consumption at their limit; group metered budgets need Stop usage enabled and do not cap license fees or pool consumption. Remaining group budget cannot override a reached user limit; inspect existing overrides and included usage controls without setting zero budgets or enabling paid usage.

#### Checkpoint: prediction-1

##### Question

The user-level limit is reached, but the pool and cost-center budget have capacity. Can the user continue?

##### Answer

No. The user-level budget always enforces a hard stop across pool and metered consumption. Remaining cost-center budget cannot override it.

#### Checkpoint: prediction-2

##### Question

The pool is exhausted and a cost-center metered budget has reached its limit, but Stop usage is off. Does that budget stop spending?

##### Answer

No. That budget only monitors spending. Charges can continue if paid usage is enabled and no other applicable control blocks the user.

#### Checkpoint: prediction-3

##### Question

The pool still has credits and there is no user-level limit. Does a positive cost-center metered budget limit each member's included consumption?

##### Answer

No. That budget applies in the metered phase. A user-level budget or separate cost-center included usage control addresses included consumption. Other applicable controls can still block usage.

#### Option: user
**Label:** Limit each pilot user's consumption
**Configure:** bc-lab-exercise

Set a cost-center user-level budget for a per-user hard stop across included and metered usage. It is not the team's total metered-spending cap; inspect any individual overrides.

#### Option: metered
**Label:** Cap the pilot's additional metered spending
**Configure:** bc-lab-exercise

Use a cost-center budget with Stop usage enabled. It caps the group's metered charges, not individual pool consumption; existing user limits still apply.

#### Option: layered
**Label:** Combine per-user limits and a group metered guardrail
**Configure:** bc-lab-exercise

Use both a cost-center user-level budget and an enforced cost-center budget. Different protections require checking both scopes and the earliest blocking control.

#### Option: review
**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Inspect existing budgets without changing them until Finance approves the amounts, scopes, and enforcement behavior.

### Decision: BC-03
**Title:** How should we track and allocate costs?
**Policies:** billing.usage-reporting

#### Question

How should we track and allocate costs?

#### Guidance

Finance wants a departmental view, while engineering wants to identify high-consumption users and models. Your fresh sandbox has little or no usage, so analysis must distinguish sample data from live evidence.

Use AI usage for consumption by user and model, and metered usage by cost center for attribution. Practice with the fictional worksheet; report fields and API options are optional policy guidance, not another exercise or evidence of engineering impact.

#### Option: dashboard
**Label:** Dashboard-led pilot review
**Configure:** none

Review AI consumption and metered allocation at an agreed cadence. Record the period, filters, and missing data before drawing conclusions.

#### Option: reports
**Label:** Exports and a repeatable billing report
**Configure:** none

Use AI and detailed metered reports for reconciliation; evaluate the documented AI credit API for later automation. Handle user-level reports as sensitive data and keep credentials outside the canvas.

#### Option: review
**Label:** I don't know yet
**Configure:** none
**Deferred:** true

Use the fictional worksheet now and record who must agree the reporting scope, access, retention, and cadence.

## Configure

### Recipe: bc-lab-exercise
**Title:** Configure a cost center and spending guardrail for your AI pilot
**Kind:** exercise
**Exercise ID:** BC-LAB
**Policies:** billing.cost-centers, billing.ai-credit-guardrails, billing.usage-reporting
**Requires decisions:** BC-01, BC-02
**Variant decision:** BC-02
**Target:** github-page

One shared lab: inspect or configure the approved pilot cost center and the guardrail chosen in BC-02. BC-01 and BC-02 must be resolved before marking configuration complete. BC-03 remains an explored reporting approach, not a deployed integration. Verification checks scope and expected behavior without exhausting a budget.

#### Safety

Use only the facilitator-approved sandbox. The facilitator preconfigures the billing connection and approves nonzero amounts, membership, and retention. Do not change payment methods, enable paid usage, remove existing budgets, move shared resources, or generate consumption to reach a limit. Inspect matching controls if changes are not authorized. Use Blocked or proposal-only mode if the required controls are unavailable.

#### Prerequisites

- An enterprise owner or enterprise billing manager for this exercise, with a preconfigured billing connection and permitted AI budget controls.
- A dedicated pilot cost center or permission to create one, approved test users or an existing enterprise team, and known licensing and allocation sources.
- Facilitator-approved nonzero budget amounts and a record of existing user-level overrides, metered budgets, paid-usage policy, and included usage controls. Never enable overage merely to expose a budget option.
- The fictional consumption worksheet below for a fresh sandbox; it is not live billing evidence. Completing User Governance in this canvas is not required if the sandbox already has approved pilot licenses.
- A rollback or retention plan owned by the facilitator. Do not delete a shared budget or cost center as cleanup.

#### Steps

1. Open the assigned enterprise, then Billing and licensing > Cost centers. Inspect the approved pilot cost center first.
2. Apply BC-01: for central funding, use the approved centrally funded pilot cost center; for departmental accountability, use the approved department's pilot cost center and its users or enterprise team; for organization allocation, use only an isolated, approved licensing organization.
3. If creation is authorized, select New cost center, enter the approved name, and choose the approved Resources. Inspect any move warning: a resource belongs to one cost center, so do not move an existing shared resource. Do not add or change an Azure subscription. Review with the facilitator, then Create cost center.
4. Confirm pilot membership: direct user assignment wins over a conflicting team assignment; among conflicting teams, the team created first applies. Inspect existing membership without changing shared resources.
5. Open Billing & Licensing > Budgets and alerts and follow the selected guardrail steps below. If the required controls are unavailable, record Blocked instead of enabling paid usage; otherwise save the confirmed budget page URL.

#### Variant: user

##### Scope

enterprise

##### Role

Enterprise owner or enterprise billing manager

##### Steps

1. Inspect an existing matching budget, or with approval choose New budget > Bundled AI credits budget.
2. Choose Users under Budget scope, then select the approved pilot cost center to set one per-user amount for its current and future members. Do not leave the user field empty, which would create a universal budget.
3. Review individual overrides for pilot users: an individual budget takes precedence over the cost-center default. Use the facilitator-approved nonzero amount; this budget always hard-stops and has no optional Stop usage toggle.
4. Review the exact users, amount, and any approved alert recipients, then Create budget only with facilitator approval. Reopen and inspect it. Record that this is per-user consumption protection, not a total group metered-spending cap.

#### Variant: metered

##### Scope

enterprise

##### Role

Enterprise owner or enterprise billing manager

##### Steps

1. Inspect an existing matching budget, or with approval choose New budget > Bundled AI credits budget.
2. Choose Cost center under Budget scope and select the approved pilot cost center, not Users, Organization, or Enterprise.
3. Set the facilitator-approved nonzero amount and explicitly select Stop usage when budget limit is reached. Confirm any alert recipients separately; alerts do not enforce the limit.
4. Review with the facilitator before Create budget, then reopen and verify the scope and enforcement. Record that this controls the pilot's metered charges after pool exhaustion, not each member's included consumption or license fees. Inspect wider enterprise and user controls without changing them.

#### Variant: layered

##### Scope

enterprise

##### Role

Enterprise owner or enterprise billing manager

##### Steps

1. Inspect or, with approval, create a Bundled AI credits budget with Users scope and the pilot cost center selected. Set the approved nonzero per-user amount; review individual overrides. User-level budgets always hard-stop.
2. Separately inspect or, with approval, create a Bundled AI credits budget with Cost center scope for the same pilot. Set the approved nonzero group metered amount and explicitly enable Stop usage when budget limit is reached.
3. Review both scopes and amounts with the facilitator before saving. Do not add a duplicate budget if an approved matching one exists. Reopen both records.
4. Record which protection applies during included usage and which applies to metered charges. A reached user-level limit cannot be supplemented by the group's remaining budget. Inspect other applicable controls and explain the earliest possible block.

## Validation

### Exercise: BC-LAB
**Title:** Verify allocation, coverage, and stopping behavior
**Attestation:** I inspected the pilot membership and guardrail, explained its scope and stopping behavior, and distinguished sample analysis from live data.
**Navigation label:** Verify guardrails

#### Steps

1. Compare the cost-center resources with the approved pilot. Explain whether direct users, enterprise-team membership, or the licensing organization determines allocation; note any precedence conflict.
2. Inspect the saved guardrail's scope, nonzero amount, and enforcement. For user-level budgets, identify the effective override and both included and metered coverage. For group metered budgets, confirm Stop usage is enabled and explain that license fees and pool consumption are not capped by that budget.
3. Without issuing an AI request, predict what happens when the effective user limit is reached, and when metered spending reaches an enforced group limit. Explain why alerts alone are not a spending stop. Inspect other applicable controls before claiming the selected budget is the only limit.
4. Open the enterprise's Billing & Licensing > Usage > AI usage. Inspect the available time period, users, and model consumption. Use Metered usage grouped or filtered by cost center to inspect attribution. Record an empty view as missing live data, not proof of zero cost.
5. Use the fictional worksheet below even when the sandbox is empty. Identify the highest consumer and model, compare gross and net amounts, and state what the data cannot prove about engineering impact.
6. Record scope, coverage, enforcement, data source, and limitations in evidence. Mark verified only after inspecting the real approved cost center and guardrail. Sample analysis alone, missing permissions, or unavailable controls must remain unverified.

#### Expected result

The approved pilot cost center and selected guardrail are visible. The participant identifies the effective users, covered consumption, enforcement behavior, and any overrides, and labels the worksheet analysis as synthetic. No budget exhaustion or additional consumption is needed.

#### Evidence

Record the pilot scope without identities, allocation basis, effective budget type and coverage, Stop usage state or mandatory user hard stop, predicted limit behavior, live-data availability, and synthetic worksheet findings. Do not paste bills, user reports, credentials, or private data.

- [Cost center setup](https://docs.github.com/en/billing/how-tos/products/use-cost-centers)
- [Cost center allocation and precedence](https://docs.github.com/en/billing/reference/cost-center-allocation)
- [Budget coverage and enforcement](https://docs.github.com/en/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets)
- [AI usage and report navigation](https://docs.github.com/en/billing/how-tos/products/view-productlicense-use)
- [Billing report fields](https://docs.github.com/en/billing/reference/billing-reports)

#### Checkpoint: fictional-worksheet

##### Question

Fictional pilot consumption worksheet

Synthetic teaching data for one fictional billing period. Pilot users, model labels, attribution, and amounts are invented, not a GitHub export schema, model price list, or your sandbox's bill. Amounts are USD; consumption is AI credits.

| Pilot user | Cost center | Model | AI credits | Gross USD | Discount USD | Net USD |
| --- | --- | --- | --- | --- | --- | --- |
| Pilot A | Engineering | Model X | 600 | 6.00 | 6.00 | 0.00 |
| Pilot B | Engineering | Model Y | 1400 | 14.00 | 10.00 | 4.00 |
| Pilot C | Research | Model Y | 1000 | 10.00 | 8.00 | 2.00 |

Which user and model account for the most consumption? How much is attributed to each department, and why is total consumption not the same as the bill?

##### Answer

Pilot B consumes the most: 1,400 AI credits. Model Y totals 2,400 credits versus Model X's 600. Engineering totals 2,000 credits and $4 net; Research totals 1,000 credits and $2 net. Across the worksheet, $30 gross minus $24 discounts equals $6 net. These fictional numbers do not prove adoption quality, model efficiency, or engineering impact, and do not verify any live guardrail.
