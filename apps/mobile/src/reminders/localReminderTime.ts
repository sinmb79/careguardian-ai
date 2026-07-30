const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses an ISO calendar date as the device's local 09:00, never as UTC. */
export function localNineAmForDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(9, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function isFutureLocalReminder(value: string, now: Date): boolean {
  const trigger = localNineAmForDate(value);
  return trigger !== null && trigger.getTime() > now.getTime();
}
