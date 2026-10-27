# Example block
**Format version:** 1
**Block ID:** example-block
**Description:** A fictional authoring example, not product guidance or an approved workshop.

## Understand

Explain the problem, trade-offs, and boundaries in ordinary Markdown.
Replace this example and `user.example` with reviewed prose and real runtime
policy IDs before adding the file to the active manifest.

An illustrative [repository link](https://example.test/{{organization.slug}}/{{repository.name}}/settings "fallback=https://example.test/organizations") uses the profile's repository name, defaulting to `pets-workshop`. This synthetic URL is not a GitHub admin-page mapping.

## Decisions

### Decision: EX-01
**Title:** Choose an illustrative path
**Policies:** user.example
**Catalog IDs:** none

#### Question

Which example should this fictional workshop explore?

#### Guidance

This is an authoring demonstration, not a recommendation.

#### Checkpoint: predict

##### Question

What do you expect the exercise to establish?

##### Answer

Only the explicitly stated expected result.

#### Option: inspect
**Label:** Inspect an authorized example
**Configure:** example-inspection, example-notes

Read the exercise's safety boundaries before attempting it.

#### Option: analyze
**Label:** Analyze fictional records
**Configure:** example-analysis, example-notes

No live configuration is implied.

#### Option: notes
**Label:** Read guidance only
**Configure:** example-notes

Guidance does not count as an exercise.

#### Option: no-action
**Label:** No action needed
**Configure:** none

This resolved answer intentionally selects no recipes.

## Configure

### Recipe: example-notes
**Title:** Shared informational notes
**Kind:** guidance
**Policies:** user.example
**API:** none

This recipe is deduplicated when several selected answers reference it.

### Recipe: example-inspection
**Title:** Inspect a prepared example
**Kind:** exercise
**Exercise ID:** EX-INSPECT
**Policies:** user.example
**Requires decisions:** EX-01
**Requires answers:** EX-01.inspect
**Target:** repository

#### Safety

Use only a facilitator-approved fictional example. Do not make live changes
without separate authorization.

#### Scope

Describe the exact scope without constructing a settings URL.

#### Role

Describe the role needed to perform the inspection.

#### Prerequisites

- An authorized example and an agreed observation.

#### Steps

1. Inspect the example.
2. Record the observation without claiming broader coverage.

An optional personalized command can display the saved workshop identifiers. Replace `YOUR-TEST-ENTERPRISE` or `YOUR-TEST-ORG` if shown:

```sh profile
printf '%s\n' '{{enterprise.slug}}' '{{organization.slug}}'
```

#### Fallback

If access is unavailable, inspect a prepared example. Record that this was
prepared evidence, not a live verification.

#### Field: observation
**Label:** Observation
**Type:** textarea
**Required:** true

Record only nonsensitive evidence.

### Recipe: example-analysis
**Title:** Analyze fictional data
**Kind:** exercise
**Exercise ID:** EX-ANALYZE
**Policies:** user.example
**Requires decisions:** EX-01
**Target:** none

#### Safety

These are fictional records, not telemetry from a real account.

#### Steps

1. Compare the two rows without inferring causation.

#### Dataset: activity
**Fictional:** true

Fictional authoring sample; not real usage data.

| group | observations |
| --- | --- |
| alpha | 2 |
| beta | 5 |

#### Field: interpretation
**Label:** Interpretation
**Type:** textarea
**Required:** true

Describe the limitations of the comparison.

#### Field: confidence
**Label:** Confidence
**Type:** select
**Options:** uncertain, needs-follow-up
**Required:** true

Choose the most appropriate description.

### Additional steps

#### Review next actions

Optional closing instructions that apply beyond the selected recipe guidance.
Keep them informational and grounded in reviewed sources.

## Validation

### Exercise: EX-INSPECT

#### Steps

1. Compare the recorded observation with the prepared example.

#### Expected result

The observation matches this example only. It does not establish a live
configuration unless the exercise was actually performed against an authorized
live target.

#### Fallback

Prepared evidence remains explicitly distinct from live validation.

### Exercise: EX-ANALYZE

#### Steps

1. Check the interpretation against the fictional table.

#### Expected result

The interpretation acknowledges the sample's limitations.
