export function withCurrentUserDecisions(content, progress) {
  const defaults = Object.fromEntries(content.paths[0].decisions.map((decision) => [decision.id, null]));
  return { ...progress, decisions: { ...defaults, ...progress.decisions } };
}
