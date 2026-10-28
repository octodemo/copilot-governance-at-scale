# Billing & Cost Control
**Format version:** 1
**Block ID:** billing-cost-control
**Description:** Who pays, how is consumption allocated, and how do we prevent unexpected costs?
**Subtitle:** Understand, allocate and control AI spending
**Duration minutes:** 15

## Understand

Billing and budget controls can be confusing, especially with GitHub's Usage Based Billing (UBB). This block explains common spending needs, helps you choose controls, and walks through sandbox exercises.

If you’re already familiar with Copilot billing and controls, you can go straight to the decisions. Otherwise, read on for a refresher on how Copilot billing works and an overview of the available billing and budgeting options.

> [!NOTE]
> **Payment setup:** Your sandbox already has an Azure subscription, so you will not set up a payment method here. See GitHub's [supported payment methods](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/supported-payment-methods) for an overview.

### How Copilot is billed

Copilot requests that use AI models consume `AI credits`, where 1 AI credit equals $0.01 USD. AI credits are accumulated through token usage, and the price per token depends on the selected model as well as the token type. You can get an overview of the different token cost per model on our [models and pricing guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-billing/models-and-pricing)


> [!NOTE]
> **Updated license model:** Previously, Copilot Business cost $19 USD and Copilot Enterprise cost $39 USD per seat per month. Each seat comes with included AI credits pooled across the enterprise.
>
> This Universe 26, we announced a new and simpler model: Copilot can now be bundled directly with your GitHub Enterprise licenses, removing any additional Copilot license cost, but also removing the pooling model entirely. This simplifies budgets and spending controls significantly. **Recommended —** We recommend switching to the new model as soon as it is available to you.
>
> `Copilot only` seats can still be acquired in the new model at $10 per user per month, but they do not include any AI credit allowance. AI credit usage is billed separately.
>
> Existing Copilot customers can choose to remain on the old model or switch to the new one. New Copilot customers automatically receive the new model.

The pooled-credit explanations below apply to accounts retaining pooled credits, not to the announced non-pooled model.

See GitHub’s [AI credit documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing) and [models and pricing guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-billing/models-and-pricing) for more information about Copilot billing.

### How to control Copilot costs

Customers often ask how they can estimate and control their potential spend. That's difficult: the cost of a single Copilot session depends on the model and tokens consumed, and the work people hand over to agents varies. Estimating hundreds or thousands of sessions across a company adds more uncertainty. As developers gain practical experience, the tasks they use agents for may also change, so a forecast needs to be revisited.

**Recommended —** We recommend managing AI consumption much like cloud infrastructure: make costs visible, assign spending owners, and use budgets and alerts to manage risk. Start by measuring consumption and agreeing how much financial exposure you can accept. Balance that against the impact of stopping people or automated workflows mid-task.

Cost control takes ongoing review. Assign someone to investigate unexpected usage and respond to budget alerts. Review consumption weekly while usage patterns are emerging, then monthly once they are more predictable. Use those reviews to update forecasts, budgets, and usage guidance.

> [!NOTE]
> See [Managing AI credits in GitHub's Well-Architected Framework](https://learn.github.com/well-architected/governance/recommendations/managing-ai-credits) for more detailed guidance. It covers attribution, budgets, and ongoing cost management in greater depth. Its pool-specific recommendations apply only if you intentionally retain the pooled billing model.

### GitHub primitives

GitHub provides budgets to control consumption and spending, cost centers to attribute costs, and billing reports to review usage and charges.

#### Budgets

Budgets are the primitive to keep control over individual costs in GitHub. Each budget comes with a dollar amount and the option to stop usage once that amount is exceeded, except user-level budgets, which always stop usage.

When setting a budget, consider two separate choices: its **scope**, which determines whose spending it covers, and its **type**, which determines whether it applies to bundled AI credits or a specific SKU. The table below compares scopes and how they behave with pooled AI credits.

| Scope | What it controls | Behavior with pooled AI credits |
| --- | --- | --- |
| User-level budget | One user's total AI credit consumption. It can be universal, set for each user in a cost center, or set for an individual user; the most specific applicable budget takes precedence. | Counts both included usage from the shared pool and overages. |
| Cost center budget | Total metered charges for a cost center's assigned users or organization. | Applies after the shared pool is exhausted. |
| Organization budget | Metered charges for users whose Copilot license is billed to the organization. | Applies after the shared pool is exhausted. |
| Enterprise budget | Total metered charges across the enterprise. | Applies after the shared pool is exhausted. |

> [!NOTE]
> In the pooled model, user-level budgets and cost-center included usage controls can limit consumption while included credits remain in the pool. Enterprise and SKU-level spending budgets apply only after the pool is exhausted.

AI credits are not limited to Copilot. AI-powered features in [GitHub Advanced Security](https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing/github-advanced-security#how-ai-feature-usage-is-billed), such as AI Scan and agentic autofix, and [GitHub Code Quality](https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing/github-code-quality#github-ai-credits) also consume them. Factor these workloads into your spending plans alongside developer use of Copilot.

Choose a budget type based on the spending you want to control:

- `Bundled AI credits budget`: One shared budget for metered spending across all AI-credit SKUs. Usage by one product can exhaust the budget and interrupt other products if stopping is enabled.
- `SKU-level budget`: A separate budget for a specific usage category. For example, `Code Security AI Credits` covers AI Scan and agentic autofix.

If both budgets enforce a stop, reaching either limit can block the covered usage. See [setting up budgets](https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/set-up-budgets).


#### Cost centers

Cost centers let you group spending by assigning users, organizations, or repositories to them. Which resources determine the charge depends on the product: for Copilot license and AI credit usage, attribution is generally based on the user, or on the organization that granted the user's license when the user is not directly assigned to a cost center. See [cost center allocation](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation).

#### Spending and budget visibility

| View or report | What it shows |
| --- | --- |
| `Usage` or `Metered usage` in `Billing & Licensing` | Charts and breakdowns of charges that can be filtered, grouped, and viewed over a selected period. |
| `AI usage` in `Billing & Licensing` | Included and metered AI credit usage across products, including Copilot and Advanced Security. Enterprise owners and billing managers can filter by user. Organization owners can use a report to see per-user consumption. |
| `AI usage CSV report` | Detailed per-user AI credit consumption, model, and token information for the selected period. Request it from the `AI usage` page to receive an emailed download link, or create and download an export through the [usage reports REST API](https://docs.github.com/en/enterprise-cloud@latest/rest/billing/usage-reports?apiVersion=2026-03-10). See the [billing reports reference](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/billing-reports#ai-usage-report) for the report fields. |
| **Enterprise budgets REST API** | List budgets or retrieve one by ID to inspect its amount, enforcement setting, and consumed amount. The list endpoint can also return a user's effective budget. See the [budgets API reference](https://docs.github.com/en/enterprise-cloud@latest/rest/billing/budgets). |

Use these views and APIs to review spending and budget status. They do not include session histories or a billing ledger.

## Decisions

Answer with your production enterprise in mind. Some settings cannot be practiced in this sandbox.

### Decision: BC-01
**Title:** Billing responsibility
**Policies:** billing.billing-managers
**Catalog IDs:** billing.billing-managers

#### Question

Who should be responsible for managing your billing, including settings, budgets, payment information, and viewing usage?

#### Guidance

Billing may be managed by people who are not enterprise administrators.

GitHub's enterprise-level billing manager role lets you delegate billing tasks without granting enterprise-owner permissions.

Billing managers can monitor costs and respond to budget alerts.


#### Option: owners
**Label:** Enterprise owners
**Configure:** none

Enterprise owners are responsible for these settings.

#### Option: delegate
**Label:** Delegated billing manager (e.g., Finance or FinOps colleagues)
**Configure:** bc-billing-managers

Assign the billing manager role for billing tasks; reserve enterprise-owner access for broader administration.

### Decision: BC-02
**Title:** Cross-payment: Azure subscriptions
**Policies:** billing.payment-methods, billing.cost-centers, billing.usage-reporting
**Catalog IDs:** billing.cost-centers, billing.cost-center-azure-subscription, billing.usage-reports

#### Question

Do different parts of your enterprise need to pay for Copilot usage through separate Azure subscriptions?

#### Guidance

You can connect different Azure subscriptions to different cost centers, so each cost center's attributed costs are billed to its connected subscription.

To route payments for different departments or teams separately, group their users or organizations into cost centers and connect each cost center to an Azure subscription. The next question covers internal cross-charging when payment remains centralized.

> [!WARNING]
> A user's Copilot costs are attributed to one cost center, even if the user belongs to several. Consider this when choosing cost centers for payment and user-level budgets. See [cost center allocation](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation#details-for-license-based-products).

#### Option: separate
**Label:** Separate Azure subscriptions by cost center
**Configure:** bc-cost-centers, bc-azure-routing

Link different Azure subscriptions to different cost centers to have payment for these cost centers occur directly on those subscriptions rather than the default enterprise-configured one.

#### Option: reporting
**Label:** Central Azure subscription; allocate costs internally
**Configure:** bc-user-visibility

Use reports to allocate costs internally while payment remains on a central Azure subscription.

#### Option: not-applicable
**Label:** Not applicable; no Azure billing or no separate payment required
**Configure:** none

No separate Azure payment routing is needed. You can still choose internal cost allocation in **Cross-charging: Allocation level**.

### Decision: BC-03
**Title:** Cross-charging: Allocation level
**Policies:** billing.cost-centers, billing.usage-reporting
**Catalog IDs:** billing.cost-centers, billing.usage-reports

#### Question

Do you need to cross-charge Copilot usage internally, and at what level?

#### Guidance

If your company does not need payments routed to separate Azure subscriptions, you may still need to allocate a central AI bill across departments or teams. In that case, decide which groups should carry the cost internally and use cost centers and usage reports to understand how charges are attributed.

> [!NOTE]
> Use this question to decide how Finance will allocate costs across users, departments, or teams. The previous question covers routing payments to separate Azure subscriptions.

See [cost attribution](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation) and [billing reports](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/billing-reports).

#### Option: central
**Label:** No cross-charging; central AI bill
**Configure:** none

Keep financial ownership central.

#### Option: unit
**Label:** By business unit, department, or team
**Configure:** bc-cost-centers, bc-user-visibility

Attribute usage to the responsible unit and agree how Finance will recover the cost.

#### Option: user
**Label:** By individual user
**Configure:** bc-user-visibility

Use per-user reports rather than assuming a separate invoice for every person.

### Decision: BC-04
**Title:** Budgets: Enterprise level
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.budgets

#### Question

Should your enterprise enforce a maximum spending limit for AI-credit usage?

#### Guidance

An enterprise budget sets the upper limit of financial exposure your company is willing to accept. Use it as a threshold to define how much AI-credit spending is allowed before usage is stopped or an alert is sent.

Agree on the amount, who responds to alerts, and who can authorize an increase. A spending stop protects the limit but can interrupt work.

This Budget will cover all AI-credit workloads, not just Copilot.

See [enterprise budget behavior](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

#### Option: enforce
**Label:** Yes, enforce a spending limit — Recommended
**Configure:** bc-enterprise-budget

Choose an approved maximum risk amount and enable stopping at the limit.

#### Option: monitor
**Label:** Monitor and alert without stopping usage
**Configure:** bc-enterprise-budget

Assign an owner who can respond; alerts alone do not cap spending.

#### Option: none
**Label:** No enterprise-level budget
**Configure:** none

Accept that this decision adds no enterprise-wide spending protection.

### Decision: BC-05
**Title:** Budgets: User-level limits
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.user-level-budgets

#### Question

Should each user have an individual consumption limit?

#### Guidance

The enterprise budget sets the overall spending ceiling. A user-level budget (ULB) sets the maximum AI-credit consumption for each person, helping prevent a few users from exhausting the enterprise limit or spending more than intended. ULBs can also help identify power users and guide decisions about higher limits or additional support.

There are three types of user-level budgets:

- `Universal`: Consider this the default budget that applies to every user in your enterprise.
- `Cost center`: Allows you to override the universal ULB for specific groups of people, teams, or organizations. It takes precedence over the universal ULB.
- `Individual`: Overrides both the universal and the cost-center ULB, so it can be used to grant exceptions for higher (or lower) consumption on an individual user basis.

This question relates to the universal ULB. The next question guides you through specific overrides.

> [!NOTE]
> User-level budgets (ULBs) always stop further AI credit consumption when exhausted, so it is a good idea to define how users request an increase before they are blocked. See [user-level budgets](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

#### Option: yes
**Label:** Yes, set per-user limits — Recommended
**Configure:** bc-universal-ulb

Establish a universal ULB before considering group or individual exceptions.

#### Option: no
**Label:** No per-user limits
**Configure:** none

Accept that this decision adds no individual consumption cap.

### Decision: BC-06
**Title:** Budgets: Differentiated user-level limits
**Policies:** billing.cost-centers, billing.ai-credit-guardrails
**Catalog IDs:** billing.cost-centers, billing.user-level-budgets

#### Question

Do different groups or individuals need different per-user limits?

#### Guidance

As indicated in the previous decision, you can and should allow overrides of a universal user-level budget for individuals or groups of users to accommodate different usage patterns and levels of maturity.

If you chose **No per-user limits** in **Budgets: User-level limits**, choose **Not applicable** here, or revisit **Budgets: User-level limits** to experiment with limits. The universal baseline is a workshop convention, not a product prerequisite for cost-center or individual ULBs.

A cost-center ULB gives each member the same per-user limit.

In many enterprises, this is used to create `cohorts` with fixed budgets that accommodate the spending needs of groups of users - e.g., `$100`, `$500`, and `$5,000`.

> [!NOTE]
> An individual ULB takes precedence over a ULB assigned to a cost center, which takes precedence over the universal ULB. See [ULB types and precedence](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

#### Option: universal
**Label:** No - only a single universal ULB
**Configure:** bc-universal-ulb

Keep things simple and just have a large enough universal ULB. Applicable to smaller enterprises.

#### Option: individuals
**Label:** Universal ULB with individual exceptions
**Configure:** bc-universal-ulb, bc-differentiated-ulbs

The second-simplest option. Use individual ULBs for justified exceptions. Applicable to smaller enterprises.

#### Option: cost-centers
**Label:** Different ULBs assigned to cost centers
**Configure:** bc-universal-ulb, bc-cost-centers, bc-differentiated-ulbs

**Recommended —** We recommend setting one per-user amount for each group that needs a different allowance. This allows you to create cohorts and manage them at scale.

#### Option: mixed
**Label:** ULBs assigned to cost centers with individual exceptions
**Configure:** bc-universal-ulb, bc-cost-centers, bc-differentiated-ulbs

Of course, you can also mix cost centers with individual ULBs while still accommodating individual power users with potentially very high (or low) limits.

#### Option: not-applicable
**Label:** Not applicable; no per-user limits
**Configure:** none

Use this when you decided against ULBs.

### Decision: BC-07
**Title:** Budgets: Organizations and cost centers
**Policies:** billing.cost-centers, billing.ai-credit-guardrails
**Catalog IDs:** billing.cost-centers, billing.budgets

#### Question

Do business units or teams need their own spending limits?

#### Guidance

Company budgets or internal policies may set a spending limit for a department, business unit, or team. This is a limit for the group as a whole, separate from the enterprise-wide limit.

User-level budgets (ULBs) set limits on individual users. In the pooled model, they count both included credits and metered usage, so they can restrict how much of the shared pool each person uses. They do not set a separate maximum for a group's total metered spending. If you tried to create a group total by adding up individual user budgets, you would need to keep adjusting those budgets as the group's membership changed.

An organization budget can fit when your GitHub organization structure reflects your department or business-unit boundaries. If the group instead spans organizations or follows a team or department structure that does not match GitHub organizations, use a cost center to define the group. Both budget types can cap the group's total metered charges after the shared pool is exhausted. Cost centers also support a separate included usage control that caps the cost center's draw from the shared pool.

For example, a department may want to cap total metered spending at $1,000, while its users each have individual ULBs. The group budget sets the department's total spending limit; the ULBs continue to set individual consumption limits. See [organization and cost center budgets](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

#### Option: none
**Label:** No group-level metered-spending budget
**Configure:** none

Rely on the other controls you selected.

#### Option: organization
**Label:** Organization-level controls
**Configure:** bc-group-budgets

Create a budget for one or several organizations.

#### Option: cost-center
**Label:** Cost-center-level controls
**Configure:** bc-cost-centers, bc-group-budgets

Use a cost center matching the spending owner's group.

#### Option: both
**Label:** Both, for different responsibilities
**Configure:** bc-cost-centers, bc-group-budgets

Check how the applicable controls interact rather than treating them as extra allowances.

### Decision: BC-08
**Title:** Budgets: AI workloads
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.budgets

#### Question

Do you want to set up SKU-level budgets for other AI-credit-consuming products?

#### Guidance

GitHub keeps adding AI capabilities to other areas of the product - such as [GitHub Advanced Security](https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing/github-advanced-security#how-ai-feature-usage-is-billed) or [GitHub Code Quality](https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing/github-code-quality#github-ai-credits) - adding additional metered costs on top of the license charges.

These AI credit costs are not charged against a user, but are general product-level charges (such as Actions minutes). This means they will be part of existing or future budgets that target the entire product - but you can set more fine-grained controls and decide to set individual caps for each of the different AI-credit SKUs.

#### Option: shared
**Label:** One shared AI-credit budget
**Configure:** bc-enterprise-budget

Choose a bundled AI credits budget and include all covered workloads in the amount.

#### Option: separate
**Label:** Separate limits for specific AI workloads
**Configure:** bc-workload-budgets

Use documented SKU-level controls where available. If you selected an enforced overall limit, it remains an additional shared constraint.

#### Option: layered
**Label:** Shared budget with additional workload-specific limits
**Configure:** bc-enterprise-budget, bc-workload-budgets

Review both limits and the effect of either one being exhausted.

### Decision: BC-09
**Title:** Organization-billed CLI and code review
**Policies:** billing.organization-billed-usage
**Catalog IDs:** billing.cli-organization-billing, billing.code-review-organization-billing, billing.ai-credits-paid-usage-policy

#### Question

Should Copilot CLI automation and Copilot code review be allowed to charge AI credits directly to the organization where the work runs, rather than to a user's Copilot entitlement?

#### Guidance

**Recommended —** We recommend organization billing for shared automation and code review, so these costs are managed by the organization rather than consuming an individual's allowance.

- **Copilot CLI:** In GitHub Actions, workflows using `GITHUB_TOKEN` can bill the repository's organization directly. This is separate from CLI sessions or workflows authenticated as a user.
- **Copilot code review:** For requests associated with members who have paid Copilot licenses, you can choose organization billing instead of the member's entitlement. This applies to both manually requested and automatic reviews. It changes billing, not access to code review.

Organization-billed usage needs group-level spending oversight rather than an individual's ULB. Code review requires `AI credits paid usage` for organization billing. Disabling the optional billing choice does not remove every organization charge: reviews requested by other bots and eligible reviews by users without a license are also billed to the organization.

See [CLI authentication and billing](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/copilot-cli-in-github-actions), [code review usage and billing](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review#code-review-usage-and-billing).

#### Option: yes
**Label:** Yes, allow organization billing — Recommended
**Configure:** bc-cli-organization-billing, bc-code-review-organization-billing

Configure both controls and review the budgets covering the organization's usage.

#### Option: no
**Label:** No, do not opt in to organization billing
**Configure:** bc-cli-organization-billing-no, bc-code-review-organization-billing

Disable organization-billed CLI automation and retain member-entitlement billing for applicable code reviews.

### Decision: BC-10
**Title:** Central cost and budget reporting
**Policies:** billing.usage-reporting
**Catalog IDs:** billing.usage-reports

#### Question

Do you want to provide central insights into current Copilot spending and budget status?

#### Guidance

Users can see their individual AI credit consumption and budgets through the different Copilot surfaces and on their personal [github.com/settings/copilot](https://github.com/settings/copilot) page, or the corresponding page on their enterprise's data residency host. However, there is currently no built-in end-user view of organization- or cost-center-level spending and budget status.

To provide these insights, you can use GitHub's APIs to retrieve the necessary data and present it to your users under your own control, for example through existing dashboard tools or purpose-built tooling for Copilot.

See [Usage report fields](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/billing-reports), [budget state API](https://docs.github.com/en/enterprise-cloud@latest/rest/billing/budgets).

#### Option: budget
**Label:** Yes, provide central cost and budget reporting
**Configure:** bc-user-visibility

Explore the usage report and budgets APIs in Configure.

#### Option: none
**Label:** No, keep individual Copilot views
**Configure:** none

Keep users' individual Copilot views without adding central reporting.

## Configure

In your sandbox enterprise, create cost centers and budgets, then try the settings. Choose your budget amounts, including zero to explore blocking usage. If a control is unavailable, record that limitation.

Your sandbox already has an Azure subscription. Leave its connection unchanged.

### Recipe: bc-billing-managers
**Title:** Review the enterprise billing manager setting
**Kind:** guidance
**Policies:** billing.billing-managers
**Catalog IDs:** billing.billing-managers

> [!WARNING]
> Review the setting without changing your role or inviting anyone. Your sandbox account already has enterprise administrator access.

#### Steps

1. Navigate to your **[Enterprise Settings -> People -> Administrators](https://github.com/enterprises/{{enterprise.slug}}/admins "fallback=https://github.com/settings/enterprises")**.
2. Review the enterprise administrator roles shown there. `Billing Manager` and `Owner` are alternative roles; do not try to assign yourself the `Billing Manager` role.

### Recipe: bc-cost-centers
**Title:** Create a cost center
**Kind:** exercise
**Exercise ID:** BC-VERIFY-COST-CENTER
**Target:** enterprise
**Policies:** billing.cost-centers
**Catalog IDs:** billing.cost-centers

> [!NOTE]
> Payment routing, departmental attribution, allowance cohorts, and group spending caps may need different groupings. A cross-department allowance cohort, for example, may not fit departmental chargeback. Review [cost-center membership](https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/products/use-cost-centers) and [allocation priority](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation) when choosing a grouping.

#### Safety

Preserve the original membership and leave the provided Azure subscription unchanged.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Cost centers](https://github.com/enterprises/{{enterprise.slug}}/billing/cost_centers "fallback=https://github.com/settings/enterprises")**.
2. Choose `New cost center` and enter a name for the cost center.
3. Under `Resources`, select your user, an enterprise team, or your organization.
4. Leave the Azure connection unchanged.
5. Choose `Create cost center`.

### Recipe: bc-azure-routing
**Title:** Connect a cost center to Azure (reference only)
**Kind:** guidance
**Policies:** billing.payment-methods, billing.cost-centers
**Catalog IDs:** billing.cost-center-azure-subscription
**Requires answers:** BC-02.separate

> [!NOTE]
> Use this guidance if you selected **Separate Azure subscriptions by cost center** in **Cross-payment: Azure subscriptions**. For a central subscription, use the reporting guidance for internal allocation.

Your sandbox already has an Azure subscription. These steps are for production payment routing; use **Cross-charging: Allocation level** to plan internal allocation.

#### Steps

1. For a production change you are authorized to make, navigate to your **[Enterprise Settings -> Billing and licensing -> Cost centers](https://github.com/enterprises/{{enterprise.slug}}/billing/cost_centers "fallback=https://github.com/settings/enterprises")** and choose `Edit` for the target cost center.
2. Select the approved Azure ID available to your account. You can also supply it when creating a cost center.
3. Confirm the cost center, subscription, and billing consequences before saving.

A cost center without its own subscription uses the enterprise's Azure subscription. Future usage also falls back there if the cost center becomes invalid or is deleted.

### Recipe: bc-enterprise-budget
**Title:** Set the enterprise spending guardrail
**Kind:** exercise
**Exercise ID:** BC-VERIFY-ENTERPRISE
**Target:** enterprise
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.budgets
**Requires decisions:** BC-04, BC-08

> [!NOTE]
> If you selected **One shared AI-credit budget** or **Shared budget with additional workload-specific limits** in **Budgets: AI workloads**, configure the shared budget here. If you selected separate workload-specific limits only, follow your enterprise-budget choice from **Budgets: Enterprise level** separately.

#### Warning: rejected-budget-shared
**When:** BC-04.none, BC-08.shared

You selected no enterprise-level budget in **Budgets: Enterprise level**, but **Budgets: AI workloads** selects this shared-budget recipe. Return to Decisions and reconcile those choices before creating a budget.

#### Warning: rejected-budget-layered
**When:** BC-04.none, BC-08.layered

You selected no enterprise-level budget in **Budgets: Enterprise level**, but **Budgets: AI workloads** selects this shared-budget recipe. Return to Decisions and reconcile those choices before creating a budget.

#### Safety

Record the original amount, stop and alert settings before changing them, and keep billing settings open in a separate browser tab for restoration.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")**.
2. Choose `New budget -> Bundled AI credits budget`, then `Enterprise` scope.
3. Choose the desired budget amount.
4. If you selected an enforced limit, enable `Stop usage when budget limit is reached`. For monitoring only, leave it off; charges can continue beyond the amount.
5. Enable `Receive budget threshold alerts` and select the recipients.
6. Choose `Create budget`.

### Recipe: bc-universal-ulb
**Title:** Set a universal user-level budget
**Kind:** exercise
**Exercise ID:** BC-VERIFY-UNIVERSAL
**Target:** enterprise
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.user-level-budgets
**Requires answers:** BC-05.yes

#### Safety

A universal ULB can affect every licensed user. In your sandbox, you are the only user. Keep billing settings open in a separate browser tab before testing a block.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")**.
2. Choose `New budget -> Bundled AI credits budget`.
3. Under `Budget scope`, choose `Users`, then select `Universal`.
4. Enter the desired per-user amount. ULBs always enforce a hard stop; a zero amount blocks users immediately.
5. Choose `Create budget`.

> [!NOTE]
> This budget limits each user's AI credit usage, including consumption from the shared pool. It works before the pool is exhausted and continues to apply to metered usage afterward. Remaining group budget does not override an exhausted ULB.

### Recipe: bc-differentiated-ulbs
**Title:** Assign ULBs to cost centers or individual users
**Kind:** exercise
**Exercise ID:** BC-VERIFY-ULB-OVERRIDES
**Target:** enterprise
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.user-level-budgets
**Requires answers:** BC-05.yes

#### Safety

Record the original amounts, expiration, and membership before testing overrides.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")** and choose `New budget -> Bundled AI credits budget`.
2. Choose the scope: `Users`.
   - `Cost Center`: Select your cost center and enter the desired per-user amount. This is each member's allowance, not the group's total budget.
   - `Individual`: Select your user and enter the desired amount. For a temporary exception, select an expiration at the end of the billing cycle or a specific date.
3. Choose `Create budget`. Repeat for the other type if you selected both.
> [!NOTE]
> Identify the effective limit: individual ULB, then ULB assigned to a cost center, then universal ULB. The amounts are not added together.

### Recipe: bc-group-budgets
**Title:** Set organization or cost center spending limits
**Kind:** exercise
**Exercise ID:** BC-VERIFY-GROUP
**Target:** enterprise
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.budgets

#### Safety

Record the original amount, stop and alert settings, and restore them after each experiment.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")**.
2. Choose `New budget -> Bundled AI credits budget`.
3. Select `Organization` or `Cost center` scope and your organization or cost center. Do not choose `Users` for a total group-spending limit.
4. Enter the desired budget amount.
5. Enable `Stop usage when budget limit is reached` for an enforced cap and select alert recipients.
6. Choose `Create budget`.

> [!NOTE]
> In the pooled model, these budgets apply only after the shared pool is exhausted. They control metered spending, not usage within the pool. If you selected both scopes, repeat for the other target; their allowances are not added together.

### Recipe: bc-workload-budgets
**Title:** Set workload-specific spending controls
**Kind:** guidance
**Policies:** billing.ai-credit-guardrails
**Catalog IDs:** billing.budgets
**Requires decisions:** BC-04, BC-08

> [!NOTE]
> If you selected **Separate limits for specific AI workloads** in **Budgets: AI workloads**, configure the workload-specific limits here. If you selected **Shared budget with additional workload-specific limits**, configure both these limits and the shared budget. If you selected one shared budget, skip this recipe.

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")** and choose `New budget -> SKU-level budget`.
2. For AI Scan and agentic autofix, select `Advanced Security -> Code Security AI Credits`.
3. Select the scope and enter the desired budget amount.
4. Enable `Stop usage when budget limit is reached` for an enforced cap and select alert recipients.
5. Choose `Create budget`.

### Recipe: bc-cli-organization-billing
**Title:** Configure organization-billed Copilot CLI
**Kind:** guidance
**Policies:** billing.organization-billed-usage
**Catalog IDs:** billing.cli-organization-billing
**Requires decisions:** BC-09

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
2. Find `Copilot CLI` and inspect `Allow use of Copilot CLI billed to the organization`.
3. Select the organization-billing option. Apply the change. If the option is unavailable, record the limitation.
4. Check the policy value. If the enterprise delegates this setting, inspect the effective policy in your organization as well.
5. Inspect the organization's cost attribution and applicable budgets. CLI workflows using `GITHUB_TOKEN` in organization-owned repositories bill the organization directly and do not use individual ULBs.

### Recipe: bc-cli-organization-billing-no
**Title:** Keep Copilot CLI off organization billing
**Kind:** guidance
**Policies:** billing.organization-billed-usage
**Catalog IDs:** billing.cli-organization-billing
**Requires decisions:** BC-09

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot -> Features & clients -> Configure features & clients](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot/features "fallback=https://github.com/settings/enterprises")**.
2. Find `Copilot CLI` and inspect `Allow use of Copilot CLI billed to the organization`.
3. Clear the organization-billing option. Apply the change. If the option is unavailable, record the limitation.
4. Check the policy value. If the enterprise delegates this setting, inspect the effective policy in your organization as well.
5. Inspect the organization's cost attribution and applicable budgets. CLI workflows using `GITHUB_TOKEN` in organization-owned repositories bill the organization directly and do not use individual ULBs.

### Recipe: bc-code-review-organization-billing
**Title:** Configure organization billing for Copilot code review
**Kind:** exercise
**Exercise ID:** BC-VERIFY-CODE-REVIEW
**Target:** repository
**Policies:** billing.organization-billed-usage
**Catalog IDs:** billing.code-review-organization-billing, billing.ai-credits-paid-usage-policy
**Requires decisions:** BC-09
**Variant decision:** BC-09

#### Safety

Use a test repository and pull request in your sandbox organization. Reviews can consume AI credits and Actions minutes. You may enable `AI credits paid usage` in your sandbox for organization-billed reviews. Keep existing budgets and unrelated access settings unchanged.

#### Variant: yes

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot code review](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**.
2. Inspect the billing choice for reviews associated with members who have paid Copilot licenses. Choose organization billing.
3. For organization billing, check `AI credits paid usage` and enable it in your sandbox if it is disabled.
4. Apply the billing choice. Leave code-review access, automatic-review rules, and access for users without licenses unchanged.
5. Inspect the setting's value. Check the applicable organization, cost-center, or enterprise spending controls for organization-billed reviews.

#### Variant: no

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agents -> Copilot code review](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/policies "fallback=https://github.com/settings/enterprises")**.
2. Inspect the billing choice for reviews associated with members who have paid Copilot licenses. Retain billing against the member's Copilot entitlement.
3. Apply the billing choice. Leave code-review access, automatic-review rules, and access for users without licenses unchanged.
4. Inspect the setting's value.

### Recipe: bc-user-visibility
**Title:** Explore the APIs for central cost and budget reporting
**Kind:** guidance
**Policies:** billing.usage-reporting
**Catalog IDs:** billing.usage-reports

> [!NOTE]
> If you selected **Central Azure subscription; allocate costs internally** in **Cross-payment: Azure subscriptions**, use these reports and budget queries to support internal allocation without changing payment routing.

#### Steps

> [!WARNING]
> Usage data may be empty because these are test accounts.

**Download a CSV usage report**

1. Open a terminal directly in the GitHub Copilot app and use GitHub CLI with your test account.
2. Add the enterprise billing scope to your GitHub CLI authentication and complete the browser authorization. This scope permits reading and writing enterprise billing data; it does not grant a billing role to an account that lacks one.

   ```sh
   gh auth refresh --scopes manage_billing:enterprise
   ```

3. Request an `AI usage report` for October 2026. This command uses the enterprise saved in your workshop profile. The API requires `start_date`; the end date is set explicitly here.

   ```sh profile
   START_DATE='2026-10-01'
   END_DATE='2026-10-31'

   gh api --method POST \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/settings/billing/reports" \
     -f report_type=ai_credit \
     -f start_date="$START_DATE" \
     -f end_date="$END_DATE"
   ```

   ```powershell profile
   $START_DATE='2026-10-01'
   $END_DATE='2026-10-31'

   gh api --method POST -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/{{enterprise.slug}}/settings/billing/reports" -f report_type=ai_credit -f start_date="$START_DATE" -f end_date="$END_DATE"
   ```

4. In the same terminal, enter the returned `id` in the **Report ID** field to retrieve that export's status. If it is `processing`, wait and repeat this GET rather than creating another report. If it is `failed`, stop and inspect the response; do not treat it as an empty report.

   ```sh profile
   REPORT_ID={{input.report-id}}

   gh api --method GET \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/settings/billing/reports/$REPORT_ID"
   ```

   ```powershell profile
   $REPORT_ID={{input.report-id}}

   gh api --method GET -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/{{enterprise.slug}}/settings/billing/reports/$REPORT_ID"
   ```

5. Once `status` is `completed`, enter a URL from `download_urls` in the **Download URL** field and choose an absolute path in the **Output file** field. Use a private folder outside the repository and choose a new filename for each download. Do not forward GitHub credentials to the download URL or share the URL.

   ```sh profile
   DOWNLOAD_URL={{input.download-url}}
   OUTPUT_FILE={{input.output-file}}

   curl --fail --location --proto '=https' --proto-redir '=https' \
     --output "$OUTPUT_FILE" "$DOWNLOAD_URL"
   ```

   ```powershell profile
   $DOWNLOAD_URL={{input.download-url}}
   $OUTPUT_FILE={{input.output-file}}

   curl.exe --fail --location --proto '=https' --proto-redir '=https' --output "$OUTPUT_FILE" "$DOWNLOAD_URL"
   ```

6. Open the CSV locally. Find your user's rows and compare `gross_amount`, `discount_amount`, and `net_amount` for the requested period. If you selected **By individual user** in **Cross-charging: Allocation level**, use these per-user rows; this path does not require a cost center. If you selected a group allocation and created a cost center, use the [detailed usage report](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/billing-reports) to filter by its `cost_center_name`; that field is not included in the AI usage report.

**Query budget status**

1. In the same terminal, query the budgets API to find budgets you created earlier. This command uses the enterprise saved in your workshop profile. Inspect `id`, `budget_scope`, `budget_entity_name`, `budget_amount`, `consumed_amount`, and `prevent_further_usage`. If `has_next_page` is true, increase `page` and repeat until you find your budgets.

   ```sh profile
   gh api --method GET \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/settings/billing/budgets" \
     -f per_page=100 -f page=1
   ```

   ```powershell profile
   gh api --method GET -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/{{enterprise.slug}}/settings/billing/budgets" -f per_page=100 -f page=1
   ```

2. Enter one of your budget IDs in the **Budget ID** field to retrieve it directly. Compare its scope, configured amount, consumed amount, and enforcement setting with the budget you saved in the UI. Repeat for another budget you created to see how the scopes differ.

   ```sh profile
   BUDGET_ID={{input.budget-id}}

   gh api --method GET \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/settings/billing/budgets/$BUDGET_ID"
   ```

   ```powershell profile
   $BUDGET_ID={{input.budget-id}}

   gh api --method GET -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/{{enterprise.slug}}/settings/billing/budgets/$BUDGET_ID"
   ```

3. Enter your user's login in the **User login** field to query your budget position. Inspect the returned `effective_budget`, including its amount and consumed amount.

   ```sh profile
   USER_LOGIN={{input.user-login}}

   gh api --method GET \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/settings/billing/budgets" \
     -f user="$USER_LOGIN"
   ```

   ```powershell profile
   $USER_LOGIN={{input.user-login}}

   gh api --method GET -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/{{enterprise.slug}}/settings/billing/budgets" -f user="$USER_LOGIN"
   ```

### Additional steps

#### Included usage controls for cost centers
**Catalog IDs:** billing.cost-center-included-usage-controls

Cost centers have a separate included usage control that caps how much of the shared pool the cost center can use. GitHub calculates the cap from the AI credits included with licenses assigned to the cost center. When the cap is reached, you can block further usage or allow paid overage. This is separate from a cost center spending budget, which caps metered charges after the shared pool is exhausted.

See [cost center included usage controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets#included-usage-controls-for-cost-centers).

## Validation

Verify the settings you configured, one at a time. Your answers select the checks shown here. If you did not configure a setting, skip its experiment and leave its verification incomplete.

### Exercise: BC-VERIFY-COST-CENTER
**Title:** Check your cost-center membership and attribution

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Cost centers](https://github.com/enterprises/{{enterprise.slug}}/billing/cost_centers "fallback=https://github.com/settings/enterprises")** and select the cost center you created in Configure. Note how your user is associated with it: directly, through an enterprise team, or through the organization that provides their Copilot license.
2. Temporarily move your user into and out of the cost center using direct user assignment. If an indirect assignment still applies after removing the direct one, note it rather than assuming the user has no cost center.
3. Inspect the membership after each change. If you also configured a cost-center ULB, use the ULB override check to test its effect on your user.
4. If usage is available, open `Usage` and group or filter by cost center. Compare the recorded usage with the timing of your membership changes. An empty report is a lab limitation, not evidence that allocation failed.
5. Restore your original cost-center membership before continuing.

#### Expected result

You can identify how your user is assigned to the cost center. Direct assignment takes precedence over indirect assignments. Membership changes affect future usage, not earlier charges. Compare usage reports to check charge attribution.

See [cost-center allocation and membership changes](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation).

### Exercise: BC-VERIFY-ENTERPRISE
**Title:** Try the enterprise spending guardrail

#### Steps

1. Navigate to your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")** and find the enterprise budget you created. Record its original amount, `Stop usage when budget limit is reached`, and `Receive budget threshold alerts` settings.
2. Temporarily set the enterprise budget to **$0**, enable `Stop usage when budget limit is reached`, and save. This can affect every user in the enterprise. In your sandbox, you are the only user.
3. Try one small Copilot request in this app and observe whether it is blocked. Check whether included credits remain and whether an exhausted ULB or another budget could explain the result. Do not deliberately exhaust the shared pool.
4. Inspect the monitoring-only alternative by clearing `Stop usage when budget limit is reached` and reviewing the alert setting. Do not submit another request while the stop is disabled: this setting allows charges beyond the budget.
5. Restore the original amount, stop behavior, and alert settings in your browser before continuing.

#### Expected result

You can distinguish a spending stop from an alert-only budget. In the pooled model, enterprise spending controls apply to metered spending after the shared pool is exhausted; a request served from remaining included credits does not validate a metered-spending stop. If you cannot isolate this budget from other controls, record the outcome as inconclusive.

> [!NOTE]
> Alerts are usually sent by email. The lab accounts cannot access those messages, so email delivery cannot be verified here.

See [budget behavior](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets) and [editing budgets and alerts](https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/set-up-budgets).

### Exercise: BC-VERIFY-UNIVERSAL
**Title:** Block your own usage with a user-level budget

#### Steps

1. Find the universal ULB you created in your **[Enterprise Settings -> Billing and licensing -> Budgets and alerts](https://github.com/enterprises/{{enterprise.slug}}/billing/budgets "fallback=https://github.com/settings/enterprises")**. Check whether a cost-center or individual ULB overrides it for your user.
2. If the universal ULB is your effective budget, record its amount and temporarily set it to **$0**. If a more-specific ULB applies, leave it unchanged and use the ULB override check instead.
3. Save, then try one small Copilot request in this app. Observe whether Copilot blocks further AI credit use for your user.
4. Restore the original amount through the browser tab you kept open. Retry the request only within your restored allowance. If it remains blocked, inspect the other applicable limits rather than increasing them.

#### Expected result

A **$0** effective ULB blocks the user's AI credit consumption, including usage from the shared pool. A universal ULB does not override a more-specific cost-center or individual ULB. Restoring it returns to the configured baseline, not necessarily restored access: a zero or exhausted baseline can still block usage.

See [user-level budgets and precedence](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets).

### Exercise: BC-VERIFY-ULB-OVERRIDES
**Title:** Compare cost-center and individual user limits

#### Steps

1. Find the ULBs you configured and record their amounts, any individual expiration, and your original cost-center membership. Test only the types you selected in Decisions.
2. **Cost-center ULB:** If you selected cost-center limits, use the cost center containing your user. With no individual override in effect, temporarily set its per-user amount to **$0**, save, and try one small Copilot request in this app. If an individual override already exists, do not delete it merely to force the test; inspect the precedence and record the limitation.
3. **Membership:** With the cost-center ULB still at **$0**, remove your user's direct assignment and check which ULB now applies. If another indirect assignment still associates your user with that cost center, record it. Only retry Copilot if the fallback allowance permits it, then restore the cost-center amount and your membership.
4. **Individual ULB:** If you selected individual exceptions, temporarily set your own individual ULB to **$0**, save, and try one small request. Check that this limit applies even when the universal or cost-center ULB has remaining allowance.
5. Restore every amount, expiration, and membership you changed. Retry only within the restored allowance; do not raise a limit to force success.

#### Expected result

The most specific applicable ULB wins: individual, then cost center, then universal. The amounts are not added together. Moving a user changes which group-scoped ULB applies only when their effective cost-center association changes. A **$0** effective ULB blocks both included and metered AI credit consumption.

See [ULB precedence](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets) and [cost-center assignment priority](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/cost-center-allocation).

### Exercise: BC-VERIFY-GROUP
**Title:** Test your cost-center or organization spending limit

#### Steps

1. Follow your group-budget answer: **Organization-level controls** means the organization budget, **Cost-center-level controls** means the cost-center budget, and **Both** means repeat this check separately for each. Use the targets you configured.
2. Check that your user is covered. For a cost-center budget, inspect effective cost-center membership. For an organization budget, check which organization provides the Copilot license and whether cost-center attribution takes precedence.
3. Record the selected budget's amount, stop and alert settings, and your user's effective ULB. Leave the ULB unchanged. If it is already zero or exhausted, it can mask the group-budget test; inspect the settings instead of trying requests or raising that limit.
4. If the ULB is not already blocking, temporarily set the selected spending budget to **$0**, enable `Stop usage when budget limit is reached`, and save. Try one small Copilot request in this app and observe the result.
5. Inspect the monitoring-only alternative and `Receive budget threshold alerts`, without generating usage while the stop is disabled. Email delivery cannot be checked with the lab accounts.
6. Restore the budget's original amount, stop and alert settings before testing another scope.

#### Expected result

You can identify the group covered by the budget and distinguish a group spending cap from a per-user allowance. In the pooled model, cost-center and organization spending budgets apply after the shared pool is exhausted. Remaining included credits, another exhausted budget, or a different billing scope can make this test inconclusive; do not consume credits to force a block.

See [organization and cost-center budget behavior](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/budgets) and [budget settings](https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/set-up-budgets).

### Exercise: BC-VERIFY-CODE-REVIEW
**Title:** Request a code review in your sandbox organization

**Variant decision:** BC-09

#### Variant: yes

##### Steps

1. Confirm that you configured organization billing for licensed members' code reviews. Do not change code-review access policies for this check.
2. Open a repository in your sandbox organization, then open an existing test pull request with a small code change, or create one there. Do not use a personal repository or a production pull request.
3. Before requesting a review, note the selected billing source and its applicable budget. Confirm that `AI credits paid usage` is enabled and inspect the applicable organization, cost-center, or enterprise spending control. Proceed only within the lab's existing allowance. Do not raise a budget to obtain a review.
4. In the pull request's `Reviewers` sidebar, next to `Copilot`, click `Request`. Observe whether the review starts or is blocked. If Copilot is unavailable, record the access limitation rather than changing unrelated policies.
5. If the review runs, read its result. If it is blocked, compare the message with the applicable billing controls. A user-level budget and an organization-billed review use different billing sources; do not assume the app's ULB block must also block that review.
6. If you also configured a group spending limit and want to test a blocked review, temporarily set the applicable organization or cost-center budget to **$0** with `Stop usage when budget limit is reached` enabled, then request or re-request one review. Record the outcome and restore the budget immediately. Do not spend through included credits to force a failure.
7. Restore any settings changed for this check. If you created a throwaway pull request, close it without merging.

##### Expected result

You can request a Copilot review from a pull request and compare the outcome with its billing source. Organization-billed reviews use the applicable organization, cost-center, or enterprise spending controls, not the member's ULB. A completed review shows that the request ran, but not which account was charged; check usage data to identify the charge. A blocked request does not identify which budget stopped it.

See [requesting and re-requesting a review](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/use-code-review) and [code-review billing and budget behavior](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review).

#### Variant: no

##### Steps

1. Leave member billing selected and compare the expected billing source. Do not change code-review access policies for this check.
2. Open a repository in your sandbox organization, then open an existing test pull request with a small code change, or create one there. Do not use a personal repository or a production pull request.
3. Before requesting a review, note the selected billing source and your effective ULB. Proceed only within the lab's existing allowance. Do not raise a budget to obtain a review.
4. In the pull request's `Reviewers` sidebar, next to `Copilot`, click `Request`. Observe whether the review starts or is blocked. If Copilot is unavailable, record the access limitation rather than changing unrelated policies.
5. If the review runs, read its result. If it is blocked, compare the message with the applicable billing controls.
6. Restore any settings changed for this check. If you created a throwaway pull request, close it without merging.

##### Expected result

You can request a Copilot review from a pull request and compare the outcome with its billing source. A completed review shows that the request ran, but not which account was charged; check usage data to identify the charge. A blocked request does not identify which budget stopped it.

See [requesting and re-requesting a review](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/use-code-review) and [code-review billing and budget behavior](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/code-review).
