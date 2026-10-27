# Beta Block
**Format version:** 1
**Block ID:** beta-block
**Description:** Fictional browser-test block with guidance only.

## Understand

Fixture beta understand prose. This block is test-owned and makes no product claim.

## Decisions

### Decision: BE-01
**Title:** Beta Preset
**Policies:** user.fixture-alpha

#### Question

Which fictional preset should the beta block use?

#### Guidance

Fixture beta decision guidance.

#### Option: auto
**Label:** Fixture automatic preset
**Configure:** beta-shared-setup, beta-auto-example

Fixture automatic option prose.

#### Option: specific
**Label:** Fixture specific preset
**Configure:** beta-shared-setup, beta-specific-example

Fixture specific option prose.

#### Option: none
**Label:** Fixture no preset
**Configure:** none

Fixture no preset option prose.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Fixture deferred option prose.

## Configure

Fixture beta configure introduction.

### Recipe: beta-shared-setup
**Title:** Prepare the fixture preset file
**Kind:** guidance
**Policies:** user.fixture-alpha

Fixture shared setup prose.

#### Steps

1. Fixture shared setup step.

### Recipe: beta-auto-example
**Title:** Fixture automatic example
**Kind:** guidance
**Policies:** user.fixture-alpha

Fixture automatic example prose.

```json
{
  "model": "fixture-auto",
  "overridable": "fixture-balance"
}
```

### Recipe: beta-specific-example
**Title:** Fixture specific example
**Kind:** guidance
**Policies:** user.fixture-alpha

Fixture specific example prose.

```json
{
  "model": "FIXTURE_SPECIFIC_MODEL_ID"
}
```

### Additional steps

#### Fixture beta baseline one

1. Fixture beta baseline one step.

[Fixture beta baseline documentation](https://docs.github.com/en)

#### Fixture beta baseline two

1. Fixture beta baseline two step.

## Validation

Fixture beta validation prose.
