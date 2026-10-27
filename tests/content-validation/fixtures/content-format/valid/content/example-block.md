# Example block
**Format version:** 1
**Block ID:** example-block
**Description:** Fictional contract data, not product guidance.

## Understand

Read this fictional example.

```markdown
## Not a real stage
**Not metadata:** literal example
```

## Decisions

### Decision: EX-01
**Title:** Choose an example
**Policies:** user.example

#### Question

What should this fictional exercise explore?

#### Checkpoint: predict

##### Question

What might you observe?

##### Answer

A limited fictional result.

#### Option: inspect
**Label:** Inspect
**Configure:** first-exercise, shared-notes

Inspect only an authorized example.

#### Option: mixed
**Label:** Two examples
**Configure:** shared-notes, second-exercise, first-exercise

This explicitly activates two exercises.

#### Option: notes
**Label:** Read guidance
**Configure:** shared-notes

No exercise is implied.

#### Option: no-action
**Label:** Nothing to configure
**Configure:** none

An explicit no-action answer.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Unresolved, not complete.

### Decision: EX-02
**Title:** A supporting choice
**Policies:** none

#### Question

Is the fictional example prepared?

#### Option: ready
**Label:** Prepared
**Configure:** shared-notes

Yes, this fictional example is prepared.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Still unresolved.

## Configure

### Recipe: shared-notes
**Title:** Shared notes
**Kind:** guidance
**Policies:** user.example

Informational guidance, never a completed exercise.

### Recipe: first-exercise
**Title:** First example
**Kind:** exercise
**Exercise ID:** EX-FIRST
**Policies:** user.example
**Requires decisions:** EX-01, EX-02
**Requires answers:** EX-02.ready
**Target:** repository

#### Safety

Use an authorized fictional example.

#### Steps

1. Inspect the prepared example.

#### Warning: example-boundary
**When:** EX-01.mixed, EX-02.ready

Do not confuse the two fictional outcomes.

#### Field: observation
**Label:** Observation
**Type:** textarea
**Required:** true

Record only nonsensitive observations.

### Recipe: second-exercise
**Title:** Second example
**Kind:** exercise
**Exercise ID:** EX-SECOND
**Policies:** user.example
**Requires decisions:** EX-01

#### Safety

These records are fictional.

#### Steps

1. Interpret the fictional records.

#### Dataset: sample
**Fictional:** true

Fictional sample, not real telemetry.

| group | count |
| --- | --- |
| alpha | 2 |
| beta | 5 |

#### Field: interpretation
**Label:** Interpretation
**Type:** text
**Required:** true

Explain this limited result.

## Validation

### Exercise: EX-FIRST

#### Steps

1. Compare the observation with the example.

#### Expected result

Only the limited example is checked.

### Exercise: EX-SECOND

#### Steps

1. Compare the interpretation with the fictional sample.

#### Expected result

The interpretation acknowledges limitations.
