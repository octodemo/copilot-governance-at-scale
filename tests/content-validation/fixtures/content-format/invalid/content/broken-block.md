# Broken example
**Format version:** 1
**Block ID:** broken-block
**Description:** Deliberately invalid structural fixture.
**Unsupported field:** no

## Understand

This is not product guidance.

## Decisions

### Decision: BAD-01
**Title:** Broken references
**Policies:** none

#### Question

Which fictional path?

#### Option: inspect
**Label:** Inspect
**Configure:** unknown-recipe

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

## Configure

### Recipe: unvalidated
**Title:** Broken exercise
**Kind:** exercise
**Exercise ID:** BAD-LAB
**Policies:** user.missing

#### Safety

Do not execute this invalid fixture.

#### Steps

1. This fixture has no validation definition.

## Validation
