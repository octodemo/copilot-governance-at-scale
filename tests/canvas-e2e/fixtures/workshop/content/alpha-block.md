# Alpha Block
**Format version:** 1
**Block ID:** alpha-block
**Description:** Fictional browser-test block with variants, warnings and two exercises.

## Understand

Fixture alpha understand prose. This block is test-owned and makes no product claim.

## Decisions

### Decision: AL-01
**Title:** Alpha Scope
**Policies:** user.fixture-alpha

#### Question

Which fictional scope should the alpha block use?

#### Guidance

Fixture alpha decision guidance.

#### Option: one
**Label:** Fixture single scope
**Configure:** alpha-lab

Fixture single scope option prose.

#### Option: many
**Label:** Fixture many scopes
**Configure:** alpha-lab

Fixture many scopes option prose.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Fixture deferred option prose.

### Decision: AL-02
**Title:** Alpha Review
**Policies:** user.fixture-alpha

#### Question

Which fictional review mode should the alpha block use?

#### Option: strict
**Label:** Fixture strict review
**Configure:** alpha-strict-guidance, alpha-audit

Fixture strict option prose.

#### Option: open
**Label:** Fixture open review
**Configure:** alpha-open-guidance

Fixture open option prose.

#### Option: review
**Label:** Needs Review
**Configure:** none
**Deferred:** true

Fixture deferred option prose.

## Configure

Fixture alpha configure introduction.

### Recipe: alpha-strict-guidance
**Title:** Apply the fixture strict review
**Kind:** guidance
**Policies:** user.fixture-alpha

Fixture strict guidance prose.

#### Steps

1. Fixture strict step one.
2. Fixture strict step two.
3. Fixture strict step three.

### Recipe: alpha-open-guidance
**Title:** Apply the fixture open review
**Kind:** guidance
**Policies:** user.fixture-alpha

Fixture open guidance prose.

#### Steps

1. Fixture open step one.

### Recipe: alpha-lab
**Title:** Inspect the fixture alpha scope
**Kind:** exercise
**Exercise ID:** AL-LAB
**Target:** none
**Policies:** user.fixture-alpha
**Requires decisions:** AL-01
**Variant decision:** AL-01

Fixture alpha lab prose.

#### Safety

Fixture safety prose.

#### Warning: many-open
**When:** AL-01.many, AL-02.open

Fixture many-open warning prose.

#### Variant: one

##### Steps

1. Fixture single-scope configure step.
2. Fixture single-scope second step.

#### Variant: many

##### Steps

1. Fixture many-scope configure step.
2. Fixture many-scope second step.

### Recipe: alpha-audit
**Title:** Inspect the fixture alpha audit
**Kind:** exercise
**Exercise ID:** AL-AUDIT
**Target:** none
**Policies:** user.fixture-alpha
**Requires decisions:** AL-02
**Requires answers:** AL-02.strict

Fixture alpha audit prose.

#### Safety

Fixture audit safety prose.

#### Warning: strict-audit
**When:** AL-02.strict

Fixture strict audit warning prose.

#### Steps

1. Fixture audit configure step.

### Additional steps

Fixture alpha additional steps introduction.

#### Fixture alpha baseline

1. Fixture alpha baseline step.

[Fixture alpha baseline documentation](https://docs.github.com/en)

#### Fixture alpha follow-up

1. Fixture alpha follow-up step.

## Validation

Fixture alpha verification introduction.

### Exercise: AL-LAB
**Title:** Confirm the fixture alpha scope
**Variant decision:** AL-01

Fixture alpha lab validation prose.

#### Variant: one

##### Steps

1. Fixture single-scope verify step.

```sh profile
gh api /orgs/{{organization.slug}}/fixture-reports
```

```sh profile
gh api /orgs/{{organization.slug}}/fixture-details
```

##### Expected result

Fixture single-scope expected result.

#### Variant: many

##### Steps

1. Fixture many-scope verify step.

```sh profile
gh api /enterprises/{{enterprise.slug}}/fixture-reports
```

##### Expected result

Fixture many-scope expected result.

### Exercise: AL-AUDIT
**Title:** Confirm the fixture alpha audit

#### Steps

1. Fixture audit verify step.

#### Expected result

Fixture audit expected result.
