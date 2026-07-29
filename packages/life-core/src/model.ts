import { validateExtension as validateExtensionInput } from "./extensions";
import type { ExtensionDefinition } from "./extensions";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_TEXT_LENGTH = 500;
const MAX_LIST_ITEMS = 100;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export type LifeList = {
  id: string;
  title: string;
  recordIds: string[];
};

export type LifeRecordValue = string | number | boolean | null;

export type LifeRecord = {
  id: string;
  listId: string;
  title: string;
  values: Record<string, LifeRecordValue>;
};

export type LifeTask = {
  id: string;
  title: string;
  status: "open" | "done";
  dueDate?: string;
};

export type LifeReminder = {
  id: string;
  title: string;
  time: string;
  enabled: boolean;
};

export type PersonalWorkspace = {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lists: LifeList[];
  records: LifeRecord[];
  tasks: LifeTask[];
  reminders: LifeReminder[];
  extensions: ExtensionDefinition[];
};

export function createEmptyWorkspace(now = new Date().toISOString()): PersonalWorkspace {
  return {
    schemaVersion: 1,
    id: "personal-workspace",
    title: "개인 생활",
    createdAt: now,
    updatedAt: now,
    lists: [],
    records: [],
    tasks: [],
    reminders: [],
    extensions: [],
  };
}

export function validateWorkspace(input: unknown): ValidationResult<PersonalWorkspace> {
  const errors: string[] = [];
  if (!isPlainObject(input)) return invalid("workspace must be an object");

  rejectUnknownKeys(input, ["schemaVersion", "id", "title", "createdAt", "updatedAt", "lists", "records", "tasks", "reminders", "extensions"], "workspace", errors);
  if (input.schemaVersion !== 1) errors.push("workspace.schemaVersion must be 1");
  validateId(input.id, "workspace.id", errors);
  validateText(input.title, "workspace.title", errors);
  validateTimestamp(input.createdAt, "workspace.createdAt", errors);
  validateTimestamp(input.updatedAt, "workspace.updatedAt", errors);
  validateArray(input.lists, "workspace.lists", MAX_LIST_ITEMS, errors, validateList);
  validateArray(input.records, "workspace.records", MAX_LIST_ITEMS, errors, validateRecord);
  validateArray(input.tasks, "workspace.tasks", MAX_LIST_ITEMS, errors, validateTask);
  validateArray(input.reminders, "workspace.reminders", MAX_LIST_ITEMS, errors, validateReminder);
  validateArray(input.extensions, "workspace.extensions", MAX_LIST_ITEMS, errors, validateExtension);

  return errors.length === 0
    ? { ok: true, value: input as PersonalWorkspace }
    : { ok: false, errors };
}

function validateList(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["id", "title", "recordIds"], path, errors);
  validateId(value.id, `${path}.id`, errors);
  validateText(value.title, `${path}.title`, errors);
  validateStringArray(value.recordIds, `${path}.recordIds`, MAX_LIST_ITEMS, errors, true);
}

function validateRecord(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["id", "listId", "title", "values"], path, errors);
  validateId(value.id, `${path}.id`, errors);
  validateId(value.listId, `${path}.listId`, errors);
  validateText(value.title, `${path}.title`, errors);
  if (!isPlainObject(value.values)) {
    errors.push(`${path}.values must be an object`);
    return;
  }
  const entries = Object.entries(value.values);
  if (entries.length > MAX_LIST_ITEMS) errors.push(`${path}.values has too many entries`);
  for (const [key, entryValue] of entries) {
    validateId(key, `${path}.values key`, errors);
    if (typeof entryValue === "string") validateText(entryValue, `${path}.values.${key}`, errors);
    else if (typeof entryValue !== "number" && typeof entryValue !== "boolean" && entryValue !== null) errors.push(`${path}.values.${key} has an invalid value`);
  }
}

function validateTask(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["id", "title", "status", "dueDate"], path, errors);
  validateId(value.id, `${path}.id`, errors);
  validateText(value.title, `${path}.title`, errors);
  if (value.status !== "open" && value.status !== "done") errors.push(`${path}.status is invalid`);
  if (value.dueDate !== undefined) validateDate(value.dueDate, `${path}.dueDate`, errors);
}

function validateReminder(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(value, ["id", "title", "time", "enabled"], path, errors);
  validateId(value.id, `${path}.id`, errors);
  validateText(value.title, `${path}.title`, errors);
  if (typeof value.time !== "string" || !TIME_PATTERN.test(value.time)) errors.push(`${path}.time must use HH:mm`);
  if (typeof value.enabled !== "boolean") errors.push(`${path}.enabled must be a boolean`);
}

function validateExtension(value: unknown, path: string, errors: string[]): void {
  const result = validateExtensionDefinition(value);
  if (result.ok === false) errors.push(...result.errors.map((error) => `${path}: ${error}`));
}

export function validateExtensionDefinition(input: unknown): ValidationResult<ExtensionDefinition> {
  return validateExtensionInput(input);
}

function validateArray(value: unknown, path: string, limit: number, errors: string[], itemValidator: (item: unknown, path: string, errors: string[]) => void): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length > limit) errors.push(`${path} has too many items`);
  value.forEach((item, index) => itemValidator(item, `${path}[${index}]`, errors));
}

function validateStringArray(value: unknown, path: string, limit: number, errors: string[], ids = false): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length > limit) errors.push(`${path} has too many items`);
  value.forEach((item, index) => ids ? validateId(item, `${path}[${index}]`, errors) : validateText(item, `${path}[${index}]`, errors));
}

function validateId(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) errors.push(`${path} must be a valid identifier`);
}

function validateText(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT_LENGTH) errors.push(`${path} must be 1-${MAX_TEXT_LENGTH} characters`);
}

function validateDate(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) errors.push(`${path} must be an ISO date`);
}

function validateTimestamp(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value))) errors.push(`${path} must be an ISO timestamp`);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function invalid<T>(error: string): ValidationResult<T> {
  return { ok: false, errors: [error] };
}
