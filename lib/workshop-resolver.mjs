/** Browser-safe, data-only resolution. Input blocks must have passed the shared validator. */
const TEMPLATE_VARIABLES = new Set(["enterprise.slug", "organization.slug", "repository.name"]);
const PROFILE_SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;
export const DEFAULT_REPOSITORY_NAME = "pets-workshop";
export const validRepositoryName = (value) => typeof value === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(value) && ![".", ".."].includes(value);
export const hasMalformedContentTemplate = (value) => /\{\{|\}\}/.test(value.replace(/\{\{[^{}]*\}\}/g, ""));

export function commandInputNames(source) {
  return [...new Set([...String(source).matchAll(/\{\{input\.([a-z][a-z0-9-]{0,63})\}\}/g)].map((match) => match[1]))];
}

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function resolveContentCommand(source, profile = {}, inputs = {}) {
  const values = {
    "enterprise.slug": [profile.enterpriseSlug, "YOUR-TEST-ENTERPRISE"],
    "organization.slug": [profile.organizationSlug, "YOUR-TEST-ORG"],
    "repository.name": [profile.repositoryName === undefined ? DEFAULT_REPOSITORY_NAME : profile.repositoryName, "YOUR-TEST-REPOSITORY"],
  };
  return source.replace(/\{\{(enterprise\.slug|organization\.slug|repository\.name|input\.([a-z][a-z0-9-]{0,63}))\}\}/g, (placeholder, name, inputName) => {
    if (inputName) {
      const value = inputs && typeof inputs === "object" && Object.hasOwn(inputs, inputName) ? inputs[inputName] : null;
      return typeof value === "string" ? shellQuote(value) : placeholder;
    }
    const [value, fallback] = values[name];
    if (name === "repository.name") return validRepositoryName(value) ? value : fallback;
    return typeof value === "string" && PROFILE_SLUG.test(value) ? value : fallback;
  });
}

export function parseContentLinkTarget(value) {
  if (typeof value !== "string") return null;
  const match = /^(https:\/\/[^\s()<>\\]+|#[A-Za-z0-9_-]+)(?: "fallback=(https:\/\/[^\s"()<>\\]+)")?$/.exec(value);
  return match ? { url: match[1], fallback: match[2] ?? null } : null;
}

function safeContentUrl(value) {
  if (typeof value !== "string" || /[\s()<>\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function resolveContentLinkTarget(value, profile = {}) {
  const target = parseContentLinkTarget(value);
  if (!target) return null;
  if (/^#[A-Za-z0-9_-]+$/.test(target.url)) return target.url;
  const matches = [...target.url.matchAll(/\{\{([^{}]+)\}\}/g)];
  if (hasMalformedContentTemplate(target.url) || matches.some((match) => !TEMPLATE_VARIABLES.has(match[1]))) return null;
  if (!matches.length) return safeContentUrl(target.url);
  const values = {
    "enterprise.slug": profile.enterpriseSlug,
    "organization.slug": profile.organizationSlug,
    "repository.name": profile.repositoryName === undefined ? DEFAULT_REPOSITORY_NAME : profile.repositoryName,
  };
  if (matches.some((match) => match[1] === "repository.name"
    ? !validRepositoryName(values[match[1]])
    : typeof values[match[1]] !== "string" || !PROFILE_SLUG.test(values[match[1]]))) {
    return target.fallback ? safeContentUrl(target.fallback) : null;
  }
  return safeContentUrl(target.url.replace(/\{\{([^{}]+)\}\}/g, (_, name) => values[name]));
}

export function resolveValidationVariant(block, validation, selections = {}) {
  if (!validation.variantDecisionId) return null;
  const decision = block.decisions.find((item) => item.id === validation.variantDecisionId);
  const option = decision?.options.find((item) => item.id === selections[validation.variantDecisionId]);
  if (!option || option.deferred) return null;
  return validation.variants?.find((variant) => variant.optionId === option.id) ?? null;
}

export function resolveConfiguration(block, selections = {}) {
  const selected = new Map();
  const unresolvedDecisionIds = [];
  for (const decision of block.decisions) {
    const option = decision.options.find((item) => item.id === selections[decision.id]);
    if (!option || option.deferred) unresolvedDecisionIds.push(decision.id);
    else selected.set(decision.id, option);
  }
  const selectedBy = new Map();
  for (const [decisionId, option] of selected) {
    for (const recipeId of option.recipeIds) {
      if (!selectedBy.has(recipeId)) selectedBy.set(recipeId, []);
      selectedBy.get(recipeId).push({ decisionId, optionId: option.id });
    }
  }
  const matches = (ref) => selected.get(ref.decisionId)?.id === ref.optionId;
  const recipes = block.recipes.filter((recipe) => selectedBy.has(recipe.id)).map((recipe) => ({
    recipe,
    variant: recipe.variants?.find((variant) => variant.optionId === selected.get(recipe.variantDecisionId)?.id) ?? null,
    selectedBy: selectedBy.get(recipe.id),
    missingDecisionIds: recipe.requiresDecisions.filter((id) => !selected.has(id)),
    missingAnswers: recipe.requiresAnswers.filter((ref) => !matches(ref)),
    conflicts: recipe.conflictsWith.filter((id) => selectedBy.has(id)),
    warnings: recipe.warnings.filter((warning) => warning.when.every(matches)),
  })).map((entry) => ({
    ...entry,
    eligible: !entry.missingDecisionIds.length && !entry.missingAnswers.length && !entry.conflicts.length,
  }));
  return {
    recipes,
    guidance: recipes.filter(({ recipe }) => recipe.kind === "guidance"),
    exercises: recipes.filter(({ recipe }) => recipe.kind === "exercise").map((entry) => {
      const validation = block.validations.find((item) => item.exerciseId === entry.recipe.exerciseId);
      const variant = validation ? resolveValidationVariant(block, validation, selections) : null;
      return {
        ...entry,
        validation: validation?.variantDecisionId
          ? { ...validation, sections: variant?.sections ?? {}, activeVariant: variant }
          : validation,
      };
    }),
    unresolvedDecisionIds,
  };
}
