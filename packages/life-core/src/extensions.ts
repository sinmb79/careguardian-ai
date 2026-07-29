import type { ValidationResult } from "./model";

export type FieldKind =
  | "text" | "longText" | "number" | "date"
  | "time" | "choice" | "boolean" | "fileReference";

export type AutomationTrigger = "manual" | "scheduled" | "fieldChanged";
export type AutomationAction = "showNotification" | "createTask" | "copyText";
export type AiAction = "summarize" | "rewriteText" | "suggestTitle" | "draftChecklist";

export type FieldDefinition = {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  choices?: string[];
};

export type ExtensionDefinition = {
  id: string;
  title: string;
  fields: FieldDefinition[];
  automations: { trigger: AutomationTrigger; action: AutomationAction }[];
  aiActions?: AiAction[];
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_TEXT_LENGTH = 500;
const MAX_FIELDS = 50;
const MAX_AUTOMATIONS = 50;
const MAX_AI_ACTIONS = 10;
const FIELD_KINDS = new Set<FieldKind>(["text", "longText", "number", "date", "time", "choice", "boolean", "fileReference"]);
const TRIGGERS = new Set<AutomationTrigger>(["manual", "scheduled", "fieldChanged"]);
const ACTIONS = new Set<AutomationAction>(["showNotification", "createTask", "copyText"]);
const AI_ACTIONS = new Set<AiAction>(["summarize", "rewriteText", "suggestTitle", "draftChecklist"]);

export function validateExtension(input: unknown): ValidationResult<ExtensionDefinition> {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ["extension must be an object"] };

  rejectUnknownKeys(input, ["id", "title", "fields", "automations", "aiActions"], "extension", errors);
  validateId(input.id, "extension.id", errors);
  validateText(input.title, "extension.title", errors);
  validateArray(input.fields, "extension.fields", MAX_FIELDS, errors, validateField);
  validateArray(input.automations, "extension.automations", MAX_AUTOMATIONS, errors, validateAutomation);
  if (input.aiActions !== undefined) validateAiActions(input.aiActions, errors);

  return errors.length === 0 ? { ok: true, value: input as ExtensionDefinition } : { ok: false, errors };
}

function validateField(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["id", "label", "kind", "required", "choices"], path, errors);
  validateId(value.id, `${path}.id`, errors);
  validateText(value.label, `${path}.label`, errors);
  if (typeof value.kind !== "string" || !FIELD_KINDS.has(value.kind as FieldKind)) errors.push(`${path}.kind is invalid`);
  if (value.required !== undefined && typeof value.required !== "boolean") errors.push(`${path}.required must be a boolean`);
  if (value.choices !== undefined) {
    if (value.kind !== "choice") errors.push(`${path}.choices is only valid for choice fields`);
    validateTextArray(value.choices, `${path}.choices`, errors);
  }
}

function validateAutomation(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["trigger", "action"], path, errors);
  if (typeof value.trigger !== "string" || !TRIGGERS.has(value.trigger as AutomationTrigger)) errors.push(`${path}.trigger is invalid`);
  if (typeof value.action !== "string" || !ACTIONS.has(value.action as AutomationAction)) errors.push(`${path}.action is invalid`);
}

function validateAiActions(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("extension.aiActions must be an array");
    return;
  }
  if (value.length > MAX_AI_ACTIONS) errors.push("extension.aiActions has too many items");
  for (const [index, action] of value.entries()) if (typeof action !== "string" || !AI_ACTIONS.has(action as AiAction)) errors.push(`extension.aiActions[${index}] is invalid`);
}

function validateArray(value: unknown, path: string, limit: number, errors: string[], itemValidator: (item: unknown, path: string, errors: string[]) => void): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length > limit) errors.push(`${path} has too many items`);
  value.forEach((item, index) => itemValidator(item, `${path}[${index}]`, errors));
}

function validateTextArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length > MAX_FIELDS) errors.push(`${path} has too many items`);
  value.forEach((item, index) => validateText(item, `${path}[${index}]`, errors));
}

function validateId(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) errors.push(`${path} must be a valid identifier`);
}

function validateText(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT_LENGTH) errors.push(`${path} must be 1-${MAX_TEXT_LENGTH} characters`);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
