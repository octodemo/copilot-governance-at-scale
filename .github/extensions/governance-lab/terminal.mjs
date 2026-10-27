import { createHash } from "node:crypto";
import { HttpError } from "./http.mjs";
import { renderMarkdown } from "./ui/markdown.js";
import { commandInputNames, resolveContentCommand } from "../../../lib/workshop-resolver.mjs";

export function validateTerminalCommand(input, content, state) {
  if (Object.keys(input).sort().join(",") !== "commandTemplate,contentVersion,inputs,revision" ||
      typeof input.commandTemplate !== "string" ||
      !input.commandTemplate.trim() || input.commandTemplate.length > 16_000 ||
      /[\x00-\x08\x0b-\x1f\x7f]/.test(input.commandTemplate) ||
      !input.inputs || typeof input.inputs !== "object" || Array.isArray(input.inputs)) {
    throw new HttpError(400, "Expected a runnable workshop command template and its inputs.");
  }
  if (input.contentVersion !== content.version || input.revision !== state.revision) {
    throw new HttpError(409, "The content or profile changed. Reload the workshop and review the command again.");
  }
  const fields = commandInputNames(input.commandTemplate);
  const providedFields = Object.keys(input.inputs);
  if (fields.length > 20 || providedFields.length !== fields.length ||
      fields.some((name) => !Object.hasOwn(input.inputs, name)) ||
      Object.values(input.inputs).some((value) => typeof value !== "string" || value.length > 2_000 || /[\x00-\x1f\x7f]/.test(value))) {
    throw new HttpError(400, "Provide a value for every command input field.");
  }
  const commands = new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      renderMarkdown(value, state.profile, (_command, template) => commands.add(template));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key !== "sourceText" && key !== "source") visit(child);
      }
    }
  };
  visit(content.paths);
  if (!commands.has(input.commandTemplate)) {
    throw new HttpError(400, "This command is not a shell block in the loaded workshop. Reload and try again.");
  }
  const command = resolveContentCommand(input.commandTemplate, state.profile, input.inputs);
  if (command.length > 16_000) {
    throw new HttpError(400, "The resolved workshop command exceeds 16000 characters.");
  }
  if (/\{\{|\}\}|YOUR-TEST-(?:ENTERPRISE|ORG|REPOSITORY)/.test(command)) {
    throw new HttpError(400, "Configure your enterprise, organization, or repository profile before running this command.");
  }
  return command;
}

// Reopening the same terminal instance runs the next command in the same shell,
// so variables and files from earlier workshop steps remain available.
export function terminalInstanceId(documentId) {
  return `workshop-terminal-${createHash("sha256").update(String(documentId)).digest("hex").slice(0, 16)}`;
}

export function openCommandTerminal(session, command, documentId) {
  return session.rpc.canvas.open({
    canvasId: "terminal",
    instanceId: terminalInstanceId(documentId),
    input: { title: "Workshop command", command, placement: { focus: true } },
  });
}
