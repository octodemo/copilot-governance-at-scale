# Observability
**Format version:** 1
**Block ID:** observability
**Description:** How are your users using Copilot and Agents and in what capacity?
**Subtitle:** Measure AI adoption, usage and agent activity

## Understand

Copilot observability covers three related use cases:

1. **Auditability:** What did Copilot do, and when? This supports risk management and can be a prerequisite for enabling Copilot agents in an enterprise.
2. **Adoption and activity:** Who is using Copilot, and how? These signals help teams understand whether people are adopting the tools and where enablement may be needed.
3. **Impact:** Does Copilot contribute to the business outcomes that matter? Adoption and activity show where Copilot is being used; impact asks whether that use is connected to outcomes such as delivery, quality, and developer experience. Teams need relevant measures, a baseline, and regular review to understand whether the expected value is emerging and where to adjust.

### A word of caution on impact

Audit and adoption metrics are easier to define than impact. Impact depends on which outcomes matter to your company and whether you can measure them in your software development lifecycle. Active users and engagement describe usage, not business value. Pair usage with engineering outcomes and developer feedback; trends and associations alone do not prove that Copilot caused an improvement.

The Copilot impact dashboard connects adoption cohorts to pull-request output, but its signals are only one part of an assessment. This lab shows ways to surface evidence; it does not determine whether that evidence proves value. Connect it to your existing measurement practices where available. See [viewing the Copilot impact dashboard](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/view-impact-dashboard).

### Available observability options

GitHub offers several ways to review or extract Copilot data. The practical steps later in this lab explore selected sources in more detail.

- **Audit log:** Review supported GitHub-side events related to Copilot, retrieve them through the [audit log REST API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise), or [stream audit and Git events](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise) to an external system. See [Copilot agent audit events](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/agentic-audit-log-events).
- **Built-in dashboards:** Copilot usage metrics, [code generation](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/view-code-generation), and [impact](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/view-impact-dashboard) dashboards provide views of usage and related outcome signals. See [viewing Copilot usage metrics](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/view-usage-and-adoption).
- **Usage metrics API and exports:** Retrieve Copilot reports for custom analysis through the [Copilot usage metrics REST API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics).
- **OpenTelemetry (OTel):** Export supported Copilot clients' agent-session traces, metrics, and events to an OpenTelemetry-compatible backend. See [OpenTelemetry for agent monitoring](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry).

Usage metrics answer who is using Copilot and how use relates to code generation and pull-request trends; OTel answers what happened inside a supported client agent session, including model calls and tool use.

## Decisions

Use these questions to choose which evidence you need and which reporting or telemetry paths to explore.

### Decision: OB-01
**Title:** Audit evidence outside GitHub
**Policies:** observability.agent-activity
**Catalog IDs:** access.audit-log

#### Question

Do you need audit evidence to remain available for more than 180 days?

#### Guidance

The enterprise audit log records activities that affect the enterprise, including Copilot agent events. It also records other enterprise, organization, and repository changes. As agents and AI affect more parts of a system, those records can help explain what happened, where, and when across the wider environment. Audit events can also add a signal to a broader coverage and impact assessment. Keeping an event log gives teams a record to revisit when new questions arise.

GitHub's 180-day audit-event retention may be enough when the data only needs to be reviewed in GitHub. If you want to extract the audit log for more durable storage or deeper analysis, there are two options:
1. **Using the REST-API**: a simple way to retrieve a snapshot for a one-off review or analysis. Keeping another system up to date requires a script or integration that retrieves the data regularly.
2. **Streaming:** This provides an ongoing copy of audit and Git events in an external system, where they can be retained and queried under that system's controls.

#### Option: github-history
**Label:** No
**Configure:** obs-audit-review

Keep the audit evidence in GitHub's audit log.

#### Option: periodic-export
**Label:** Yes, exported regularly through the API
**Configure:** obs-audit-review

Retrieve audit records through the API on a regular schedule for use outside GitHub.

#### Option: external-stream
**Label:** Yes, streamed continuously to external storage or a system
**Configure:** obs-audit-review

Send an ongoing stream of audit and Git events to an external destination.

### Decision: OB-02
**Title:** Enable Copilot Dashboards
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.usage-metrics, metrics.impact-dashboard

#### Question

Do you want to enable Copilot dashboards?

#### Guidance

GitHub offers dashboards to view and analyze your Copilot usage, code generation and impact. The `Copilot usage metrics` setting enables or disables these dashboards for the enterprise and all organizations, or lets organization owners decide.

Turning this off is useful for companies that prefer to only make their own dashboards available where they gather the data through the APIs, OTel and/or Audit Log.

> [!WARNING]
> Letting organization owners decide gives every organization owner the power to enable the dashboards for their organization. While this choice is delegated, each organization owner controls availability in their organization. Delegation cannot be limited to selected organizations.

#### Option: enabled
**Label:** Enable everywhere
**Configure:** obs-org-metrics-access

Enable Copilot dashboards for the enterprise and all organizations.

#### Option: disabled
**Label:** Disable everywhere
**Configure:** obs-org-metrics-access

Disable Copilot dashboards for the enterprise and all organizations.

### Decision: OB-03
**Title:** View access to enterprise dashboards
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.usage-metrics

#### Question

Do people who are not enterprise owners need to view the Enterprise level Copilot dashboards?

#### Guidance

The enterprise Copilot dashboards show metrics aggregated across the whole enterprise. If enterprise owners are not the people assessing these metrics, you can grant designated members view access without making them enterprise owners. This is useful when the metrics audience is different from the people who administer the enterprise.

> [!WARNING]
> If you disabled Copilot dashboards, designated viewers cannot use them. You can plan viewer access here, but the dashboards must be enabled before anyone can view them.

#### Option: owners
**Label:** No, only Enterprise owners will review the metrics
**Configure:** none

Keep access with enterprise owners.

#### Option: delegated-viewers
**Label:** Delegate access to named metrics viewers
**Configure:** obs-metrics-access

Use a dedicated role when people outside the enterprise-owner group need to view the enterprise dashboards.

### Decision: OB-04
**Title:** Enable Copilot Metrics API
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.copilot-metrics-api-policy, metrics.team-level-metrics

#### Question

Do you want to enable the Copilot metrics API?

#### Guidance

The [Copilot usage metrics API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics) allows you to get Copilot data such as user engagement statistics, feature usage patterns, and adoption metrics—aggregated by user, organization, or enterprise, depending on the access level. This data can be used to fuel your own dashboards to get deeper insights into your Copilot usage.

On the enterprise level, you can configure whether you want to allow access to these APIs.

The Copilot metrics API policy controls access to these APIs.

While this data is of course very useful in your adoption journey, some companies have strict data collection policies for their users that might force them to disable this data.

> [!WARNING]
> This enterprise policy cannot target selected organizations. Choosing `Let organization owners decide` makes the choice available to organization owners across all organizations at once.

#### Option: no-api
**Label:** No, keep the API disabled
**Configure:** obs-usage-export

Keep the Copilot metrics API disabled.

#### Option: api-reports
**Label:** Let organization owners decide
**Configure:** obs-usage-export

Enable the Copilot metrics API for the enterprise and let organization owners choose whether to enable it for their organizations.

#### Option: api-everywhere
**Label:** Enable everywhere
**Configure:** obs-usage-export

Enable the Copilot metrics API for the enterprise and all organizations.

### Decision: OB-05
**Title:** Industry comparisons
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.industry-comparisons

#### Question

Should Copilot usage dashboards show industry comparisons?

#### Guidance

This matters only when Copilot dashboards are enabled. It determines whether the dashboards include anonymous industry benchmark comparisons, so consider whether dashboard viewers should see that data.

> [!WARNING]
> If you disabled Copilot dashboards, industry comparisons are unavailable. Enable dashboards before trying to view comparisons.

#### Option: benchmarks-on
**Label:** Show industry comparisons
**Configure:** obs-industry-comparison

Allow the configured dashboard viewers to see the comparisons.

#### Option: benchmarks-off
**Label:** Do not show industry comparisons
**Configure:** obs-industry-comparison-off

Keep comparisons out of the dashboards.

### Decision: OB-06
**Title:** Client agent-session telemetry
**Policies:** observability.agent-activity
**Catalog IDs:** metrics.otel-telemetry

#### Question

Do you need Copilot client agent-session telemetry in your own observability system?

#### Guidance

OpenTelemetry is separate from usage reports and the enterprise audit log. It can export client-side agent-session traces, metrics, and events to an OpenTelemetry-compatible backend. By default, it does not include direct identity, prompts, responses, tool arguments, tool results, or raw policy details. Capture classes can be enabled independently, and captured content may be sensitive. See [OpenTelemetry for agent monitoring](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry).

OTel provides raw agent-session data that can support deeper analysis of what agents do and how they do it. Teams can use it to assess agent maturity and efficiency and investigate problems. With identity capture enabled, they can also identify power users.

#### Option: no-client-telemetry
**Label:** Current reports and audit sources are enough
**Configure:** none

Do not add a client telemetry pipeline without a defined monitoring need.

#### Option: minimal-telemetry
**Label:** Export session telemetry without identity or content
**Configure:** obs-otel-settings

Use traces, metrics, and events with the default capture controls.

#### Option: identity-telemetry
**Label:** Attribute activity to users and devices
**Configure:** obs-otel-settings, obs-otel-identity

Consider identity capture only when attribution is needed and approved.

## Configure

The steps below follow your choices. Complete the recipes selected by your answers.

### Recipe: obs-metrics-access
**Title:** Delegate access to enterprise Copilot metrics
**Kind:** guidance
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.usage-metrics

Create a custom enterprise role for people who need to view enterprise metrics without becoming enterprise owners.

> [!WARNING]
> As we only have one user in this Sandbox, you won't be able to actually assign and test the role you create here to a user.

#### Steps

1. Navigate to your **[Enterprise Settings -> People -> Enterprise roles -> Role management](https://github.com/enterprises/{{enterprise.slug}}/enterprise_roles "fallback=https://github.com/settings/enterprises")**.
2. Create a custom role named `AI Metrics Viewer` with a clear description.
3. Add the `View Enterprise Copilot Metrics` permission and create the role.
4. **Production only:** Assign the role only to the intended metrics viewers. Skip this step in this sandbox, because you are its only user. Enterprise owners can also view enterprise metrics.

### Recipe: obs-org-metrics-access
**Title:** Set Copilot dashboard availability
**Kind:** exercise
**Exercise ID:** OB-DASHBOARDS
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.usage-metrics, metrics.impact-dashboard
**Requires decisions:** OB-02
**Variant decision:** OB-02
**Target:** enterprise

#### Safety

Change settings only in your sandbox enterprise. The dashboard setting applies to the enterprise and all its organizations. Finish with the value that matches your decision.

#### Variant: enabled

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Scroll down to the `Billing & usage` section and find `Copilot usage metrics`. This controls dashboards, not the separate `Copilot metrics API` setting.
3. Set `Copilot usage metrics` to `Enabled everywhere`.

#### Variant: disabled

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Scroll down to the `Billing & usage` section and find `Copilot usage metrics`. This controls dashboards, not the separate `Copilot metrics API` setting.
3. Set `Copilot usage metrics` to `Disabled everywhere`.

### Recipe: obs-usage-export
**Title:** Set Copilot metrics API availability
**Kind:** exercise
**Exercise ID:** OB-USAGE-EXPORT
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.copilot-metrics-api-policy, metrics.team-level-metrics
**Requires decisions:** OB-04
**Variant decision:** OB-04
**Target:** enterprise
**API:** https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics

#### Safety

Change settings only in your sandbox enterprise and organization. Finish with the value that matches your decision. Keep downloaded reports private and remove them when you no longer need them.

#### Variant: no-api

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Set `Copilot metrics API` to `Disabled`.

#### Variant: api-reports

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Set `Copilot metrics API` to `Let organization owners decide`.
3. Navigate to your **[Organization Settings -> Copilot -> Policies](https://github.com/organizations/{{organization.slug}}/settings/copilot/policies "fallback=https://github.com/settings/organizations")** in your sandbox organization. Enable `Copilot metrics API` for the export exercise.

#### Variant: api-everywhere

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Set `Copilot metrics API` to `Enabled everywhere`.

### Recipe: obs-industry-comparison
**Title:** Set industry comparison visibility
**Kind:** guidance
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.industry-comparisons

> [!NOTE]
> This sandbox has no usage metrics, so you won't be able to view industry comparisons here. See [industry comparisons in the Copilot impact dashboard](https://github.blog/changelog/2026-10-22-industry-comparisons-in-the-copilot-impact-dashboard/) to see how they look in action.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Enable `Copilot metrics industry comparison`.

> [!NOTE]
> The setting affects dashboards for all users whose dashboard access has already been configured.

### Recipe: obs-industry-comparison-off
**Title:** Hide industry comparisons
**Kind:** guidance
**Policies:** observability.usage-metrics
**Catalog IDs:** metrics.industry-comparisons

> [!NOTE]
> This sandbox has no usage metrics, so you won't be able to view industry comparisons here. See [industry comparisons in the Copilot impact dashboard](https://github.blog/changelog/2026-10-22-industry-comparisons-in-the-copilot-impact-dashboard/) to see how they look in action.

#### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**.
2. Disable `Copilot metrics industry comparison`.

### Recipe: obs-otel-settings
**Title:** Review a managed OpenTelemetry configuration
**Kind:** guidance
**Policies:** observability.agent-activity
**Catalog IDs:** metrics.otel-telemetry

Review the managed settings for a supported Copilot client.

> [!WARNING]
> This is for showcase purposes only. This lab has no OpenTelemetry collector endpoint, so you cannot test telemetry delivery here.

#### Steps

1. Open [`copilot/managed-settings.json`](https://github.com/{{organization.slug}}/.github-private/blob/HEAD/copilot/managed-settings.json "fallback=https://github.com/settings/organizations") in your organization's `.github-private` repository. The file does not contain a telemetry configuration. Review this example against the [enterprise managed settings reference](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [OpenTelemetry guide](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry). You can add it to the file if you want, but the example endpoint does not exist, so no telemetry is delivered:

   ```json
   {
     "telemetry": {
       "enabled": true,
       "endpoint": "https://otel-collector.example.com",
       "protocol": "http/protobuf",
       "capture": {
         "identity": false,
         "prompts": false,
         "responses": false,
         "toolArguments": false,
         "toolOutput": false,
         "policyDetail": false
       }
     }
   }
   ```

2. `enabled: true` enables telemetry export to the configured endpoint. The six `capture` flags control additional identity and sensitive content, not whether traces, metrics, and events are collected. They are all `false` here because this example matches **Export session telemetry without identity or content**. If you chose **Attribute activity to users and devices**, the additional configuration below enables only identity capture. See [OpenTelemetry capture controls](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry#what-data-does-copilot-send).

### Recipe: obs-otel-identity
**Title:** Review identity capture separately
**Kind:** guidance
**Policies:** observability.agent-activity
**Catalog IDs:** metrics.otel-telemetry

Identity capture adds the authenticated Copilot account name, local operating-system account, and machine name. It is separate from conversation and tool-content capture.

#### Steps

1. If you added the telemetry configuration to `copilot/managed-settings.json`, change `telemetry.capture.identity` from `false` to `true`. Leave the other capture classes set to `false`:

   ```json
   {
     "telemetry": {
       "enabled": true,
       "endpoint": "https://otel-collector.example.com",
       "protocol": "http/protobuf",
       "capture": {
         "identity": true,
         "prompts": false,
         "responses": false,
         "toolArguments": false,
         "toolOutput": false,
         "policyDetail": false
       }
     }
   }
   ```


### Recipe: obs-audit-review
**Title:** Explore audit-log options
**Kind:** exercise
**Exercise ID:** OB-AUDIT
**Policies:** observability.agent-activity
**Catalog IDs:** access.audit-log
**Requires decisions:** OB-01
**Variant decision:** OB-01
**Target:** github-page
**Inspection label:** Complete - explored audit-log options
**Configuration confirmation:** Choose Complete after exploring the audit-log options for your decision without changing them. This records an inspection, not an enabled stream, a recurring export, or external retention.
**Steps label:** Audit-log options

#### Safety

> [!WARNING]
> This is for showcase purposes only. This lab has no external streaming destination, so you cannot test audit-log streaming here.

#### Variant: github-history

##### Steps

1. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**.
2. Explore how audit events can be searched in GitHub. See the [audit search syntax](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/searching-the-audit-log-for-your-enterprise).
3. Keep the audit history in GitHub for this decision. Leave the streaming settings unchanged. No export or external destination is needed.

#### Variant: periodic-export

##### Steps

1. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**.
2. Review the [audit log REST API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise). You will use it in Validation to retrieve audit events.
3. Identify who would schedule exports and manage retention outside the lab. A single export does not establish ongoing collection. Leave the streaming settings unchanged.

#### Variant: external-stream

##### Steps

1. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**.
2. Explore the available audit-log streaming options and compare them with your need for continuous external retention. See the [audit-log streaming documentation](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise).
3. Identify the destination and its retention owner for a later rollout.

## Validation

These checks follow your decisions about audit evidence, dashboard enablement, and API access or report exports. A new test environment may have no matching events or processed usage data. Distinguish that limitation from an access error.

### Exercise: OB-DASHBOARDS
**Title:** Check Copilot dashboard enablement
**Variant decision:** OB-02

#### Variant: enabled

##### Steps

1. Open each dashboard and check whether it opens:
   - **[Enterprise Settings -> Insights -> Copilot impact](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot/impact "fallback=https://github.com/settings/enterprises")**
   - **[Enterprise Settings -> Insights -> Copilot usage](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot "fallback=https://github.com/settings/enterprises")**
   - **[Enterprise Settings -> Insights -> Code generation](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot/code-generation "fallback=https://github.com/settings/enterprises")**
2. In **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**, find `Copilot usage metrics` under `Billing & usage`. Set it to `Disabled everywhere`. This applies to all organizations in your sandbox enterprise.
3. Reload the three dashboards and compare what they show with the enabled state.
4. Restore `Enabled everywhere` and reload the dashboards.

> [!NOTE]
> You will not see usage data in this sandbox. Compare the enabled and disabled dashboard states rather than looking for charts.

##### Expected result

You have compared the enabled and disabled dashboard states and restored `Enabled everywhere`. Empty dashboards do not prove that usage has been collected.

##### Fallback

If the control or a dashboard is unavailable, identify the restriction. Do not claim that you completed a comparison you could not perform.

#### Variant: disabled

##### Steps

1. Open each dashboard:
   - **[Enterprise Settings -> Insights -> Copilot impact](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot/impact "fallback=https://github.com/settings/enterprises")**
   - **[Enterprise Settings -> Insights -> Copilot usage](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot "fallback=https://github.com/settings/enterprises")**
   - **[Enterprise Settings -> Insights -> Code generation](https://github.com/enterprises/{{enterprise.slug}}/insights/copilot/code-generation "fallback=https://github.com/settings/enterprises")**
2. Check whether each dashboard indicates Copilot usage metrics are disabled.
3. In **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")**, find `Copilot usage metrics` under `Billing & usage`. Set it to `Enabled everywhere`. This applies to all organizations in your sandbox enterprise.
4. Reload the three dashboards and compare what they show with the disabled state.
5. Restore `Disabled everywhere` and reload the dashboards.

> [!NOTE]
> You will not see usage data in this sandbox. Compare the enabled and disabled dashboard states rather than looking for charts.

##### Expected result

You have compared the disabled and enabled dashboard states and restored `Disabled everywhere`.

##### Fallback

If the control or a dashboard is unavailable, identify the restriction. An access error alone does not establish that dashboards are disabled. Do not claim that you completed a comparison you could not perform.

### Exercise: OB-USAGE-EXPORT
**Title:** Check Copilot metrics API and inspect enabled reports
**Variant decision:** OB-04

#### Variant: no-api

##### Steps

1. Reopen `Copilot metrics API` in your **[Enterprise Settings -> AI controls -> Copilot](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/copilot "fallback=https://github.com/settings/enterprises")** and check that the saved value is `Disabled`.
2. Open a terminal directly in the GitHub Copilot app and try this enterprise report request. It uses the enterprise saved in your workshop profile:

   ```sh profile
   gh api --method GET \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/copilot/metrics/reports/enterprise-28-day/latest"
   ```

3. Ensure no data or a 404 Error is returned.

See the [enterprise report endpoint](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics?apiVersion=2026-03-10#get-copilot-enterprise-usage-metrics).

##### Expected result

The saved `Copilot metrics API` setting remains `Disabled`. You have compared an API response with that setting without downloading a report. A `404` alone does not establish policy enforcement.

##### Fallback

If the request fails, distinguish authorization and data-availability limitations from the saved policy value. Do not enable reporting to make this check succeed.

#### Variant: api-reports

##### Steps

1. Open a terminal directly in the GitHub Copilot app. This command uses the organization saved in your workshop profile. Run this in a new local directory so it does not overwrite an earlier export. The request retrieves download links and the report period; it is not the usage data itself.

   ```sh profile
   gh api --method GET \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/orgs/{{organization.slug}}/copilot/metrics/reports/organization-28-day/latest" \
     > usage-report-links.json &&
   jq '{report_start_day, report_end_day, file_count: (.download_links | length)}' usage-report-links.json
   ```

2. If the request succeeded and returned download links, print them. Paste each link into your browser to download that report file. These signed links expire, so request new ones if a download fails.

   ```sh
   jq -r '.download_links[]' usage-report-links.json
   ```

   Alternatively, download every file from the terminal with this script. Do not add your GitHub token to the download request.

   ```sh
   jq -er '.download_links | if type == "array" and length > 0 then .[] else error("No report download links returned") end' \
     usage-report-links.json > usage-download-links.txt &&
   (
     set -e
     index=0
     while IFS= read -r url; do
       index=$((index + 1))
       curl --fail --location --proto '=https' --proto-redir '=https' \
         "$url" --output "copilot-usage-$index.ndjson"
     done < usage-download-links.txt
   )
   ```

3. Open each downloaded NDJSON file locally. Each line is a JSON record. Inspect a record with `head -n 1 copilot-usage-1.ndjson | jq .`. Identify a usage measure and the period it describes. Compare the available feature or IDE breakdowns without treating missing values as zero activity.
4. Explain one adoption question the report could help answer and one business-impact claim it cannot establish. Organization membership can attribute the same user's usage to more than one organization; do not add organization totals to calculate an enterprise total.

For team-level breakdowns, join user-team membership reports with per-user usage reports. See the [organization report endpoint](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics#get-copilot-organization-usage-metrics) and [metrics coverage and organization attribution](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics).

##### Expected result

A successful request returns the report period and signed download links. Downloading the files lets you inspect organization usage records. This does not prove causal business impact or complete activity coverage.

##### Fallback

If the API returns an error, record its status and message. Check authorization and policy settings separately from data availability. If no report is available, review the endpoint's response shape and record that no live report was inspected. Do not substitute an enterprise report or enable reporting against your decision.

#### Variant: api-everywhere

##### Steps

1. Open a terminal directly in the GitHub Copilot app. This command uses the enterprise saved in your workshop profile. Run this in a new local directory so it does not overwrite an earlier export. The request retrieves download links and the report period; it is not the usage data itself.

   ```sh profile
   gh api --method GET \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/copilot/metrics/reports/enterprise-28-day/latest" \
     > usage-report-links.json &&
   jq '{report_start_day, report_end_day, file_count: (.download_links | length)}' usage-report-links.json
   ```

2. If the request succeeded and returned download links, print them. Paste each link into your browser to download that report file. These signed links expire, so request new ones if a download fails.

   ```sh
   jq -r '.download_links[]' usage-report-links.json
   ```

   Alternatively, download every file from the terminal with this script. Do not add your GitHub token to the download request.

   ```sh
   jq -er '.download_links | if type == "array" and length > 0 then .[] else error("No report download links returned") end' \
     usage-report-links.json > usage-download-links.txt &&
   (
     set -e
     index=0
     while IFS= read -r url; do
       index=$((index + 1))
       curl --fail --location --proto '=https' --proto-redir '=https' \
         "$url" --output "copilot-usage-$index.ndjson"
     done < usage-download-links.txt
   )
   ```

3. Open each downloaded NDJSON file locally. Each line is a JSON record. Inspect a record with `head -n 1 copilot-usage-1.ndjson | jq .`. Identify a usage measure and the period it describes. Compare the available feature or IDE breakdowns without treating missing values as zero activity.
4. Explain one adoption question the report could help answer and one business-impact claim it cannot establish.

See the [enterprise report endpoint](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics?apiVersion=2026-03-10#get-copilot-enterprise-usage-metrics).

##### Expected result

A successful request returns the report period and signed download links. Downloading the files lets you inspect enterprise usage records.

##### Fallback

If the API returns an error, check authorization and policy settings separately from data availability. If no report is available, review the endpoint's response shape.

### Exercise: OB-AUDIT
**Title:** Review existing agent-related audit evidence
**Variant decision:** OB-01

#### Variant: github-history

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agent sessions -> View all](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/sessions "fallback=https://github.com/settings/enterprises")** and inspect whether any session evidence is available.
2. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**. Search for `action:copilot` to review Copilot policy and license events, then `actor:Copilot` for agent activity.
3. Review any returned records for the action, time, actor, and `agent_session_id`. Do not infer local prompts, a complete session trace, or streaming delivery from these records.
4. If no agent-associated events are returned, record that result and the search used. An authorization error is an access problem, not an empty result.
5. Check that the streaming settings remain unchanged. This decision keeps audit history in GitHub; no API export or external destination is needed.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

See [monitoring agentic activity](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/monitor-agentic-activity) and [agent audit event fields](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/agentic-audit-log-events).

##### Expected result

You can locate and inspect existing audit records, or explain that no matching agent-associated record was available. Streaming settings remain unchanged. This does not establish complete agent-session coverage.

##### Fallback

If access or events are unavailable, review the documented `actor:Copilot` filter and agent event fields. Treat this as documentation review, not a live audit.

#### Variant: periodic-export

##### Steps

1. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**. Search for `action:copilot` to review Copilot policy and license events, then `actor:Copilot` for agent activity.
2. Open a terminal directly in the GitHub Copilot app and run this command to query the latest audit log entries, including web and Git events. It uses the enterprise saved in your workshop profile:

   ```sh profile
   gh api --method GET \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/audit-log" \
     -f include='all' -f per_page=100
   ```

3. In the same terminal, run this command to query only Copilot entries:

   ```sh profile
   gh api --method GET \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/audit-log" \
     -f phrase='action:copilot' -f per_page=100
   ```

4. Optionally save a paginated Copilot snapshot in a new local directory:

   ```sh profile
   gh api --method GET --paginate --slurp \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2026-03-10' \
     "/enterprises/{{enterprise.slug}}/audit-log" \
     -f phrase='action:copilot' -f include='web' -f per_page=100 \
     > copilot-audit-pages.json &&
   jq 'add' copilot-audit-pages.json > copilot-audit.json
   ```

5. Inspect any returned records for the action, time, actor, and `agent_session_id`. To retrieve agent events instead, repeat the request with `phrase='actor:Copilot'` and a different output filename. If no matching events are available, distinguish that from an authorization error.
6. Keep exports private and remove them when no longer needed. This retrieves audit events, not a usage metrics report; a one-off export does not set up recurring exports, retention, or streaming.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

See [audit search syntax](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/searching-the-audit-log-for-your-enterprise), [agent audit event fields](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/agentic-audit-log-events), and the [enterprise audit log REST API](https://docs.github.com/en/enterprise-cloud@latest/rest/enterprise-admin/audit-log#get-the-audit-log-for-an-enterprise).

##### Expected result

You can compare audit-log searches with API results, or explain the access or event-availability limitation. An optional saved snapshot is a one-off export, not ongoing collection.

##### Fallback

If access or events are unavailable, review the endpoint's response shape and the documented filters. Do not claim that you exported live records.

#### Variant: external-stream

##### Steps

1. Navigate to your **[Enterprise Settings -> AI controls -> Agent sessions -> View all](https://github.com/enterprises/{{enterprise.slug}}/ai-controls/agents/sessions "fallback=https://github.com/settings/enterprises")** and inspect whether any session evidence is available.
2. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")**. Search for `action:copilot` to review Copilot policy and license events, then `actor:Copilot` for agent activity.
3. Review any returned records for the action, time, actor, and `agent_session_id`. If no agent-associated events appear, distinguish that from an authorization error.
4. Navigate to your **[Enterprise Settings -> Settings -> Audit log](https://github.com/enterprises/{{enterprise.slug}}/audit-log "fallback=https://github.com/settings/enterprises")** and explore the available streaming options. This lab has no backend for a new stream. Existing events in GitHub do not prove delivery to an external destination.

> [!TIP]
> If you do not see Copilot activity, start a [Copilot Chat session on GitHub.com](https://github.com/copilot), or open your [Petstore workshop repository](https://github.com/{{organization.slug}}/{{repository.name}} "fallback=https://github.com/settings/organizations") and start a [Copilot cloud agent session](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github) there. Ask the agent to summarize the repository without changing files, then repeat the activity check.

See [monitoring agentic activity](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/monitor-agentic-activity) and [streaming the audit log](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/streaming-the-audit-log-for-your-enterprise).

##### Expected result

You have inspected the available audit evidence without changing a stream. External delivery and retention remain unverified because this lab has no destination backend.

##### Fallback

If access or events are unavailable, review the documented filters and streaming requirements. Treat this as documentation review, not a successful audit or stream verification.

#### Field: auditEvidence
**Label:** Audit log review
**Type:** textarea
**Required:** true

Record where you looked, the filter used, whether an event appeared, and what the evidence does and does not establish. Do not include private identifiers or credentials.
