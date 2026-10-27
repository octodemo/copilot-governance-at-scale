# Gamma Block
**Format version:** 1
**Block ID:** gamma-block
**Description:** Fictional browser-test block with one decision and one exercise.

## Understand

Fixture gamma understand prose. This block is test-owned and makes no product claim.

## Decisions

### Decision: GA-01
**Title:** Gamma Toggle
**Policies:** agent.fixture-gamma

#### Question

Should the fictional gamma setting be enabled?

#### Option: enable
**Label:** Fixture enable
**Configure:** gamma-lab

Fixture enable option prose.

#### Option: disable
**Label:** Fixture disable
**Configure:** gamma-lab

Fixture disable option prose.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Fixture deferred option prose.

## Configure

### Recipe: gamma-lab
**Title:** Inspect the fixture gamma setting
**Kind:** exercise
**Exercise ID:** GA-LAB
**Target:** none
**Policies:** agent.fixture-gamma
**Requires decisions:** GA-01

#### Safety

Fixture gamma safety prose.

#### Steps

1. Fixture gamma configure step.

## Validation

### Exercise: GA-LAB
**Title:** Confirm the fixture gamma setting

#### Steps

1. Fixture gamma verify step.

#### Expected result

Fixture gamma expected result.

[Fixture reference one](https://example.com/one)

[Fixture reference two](https://example.com/two)

[Fixture reference three](https://example.com/three)
