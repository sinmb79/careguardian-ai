import type { CareManual } from "../manual/manualSchema";
import { buildDailyScheduleCards } from "./dailySchedule";

export interface EmotionOption {
  emoji: string;
  label: string;
  value: string;
}

export function getTimeOfDayGreeting(name: string, now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return `\uC88B\uC740 \uC544\uCE68\uC774\uC5D0\uC694, ${name}\uB2D8! \u{1F305}`;
  if (hour >= 12 && hour < 18) return `\uC88B\uC740 \uC624\uD6C4\uC608\uC694, ${name}\uB2D8! \u2600\uFE0F`;
  if (hour >= 18 && hour < 22) return `\uC88B\uC740 \uC800\uB155\uC774\uC5D0\uC694, ${name}\uB2D8! \u{1F319}`;
  return `\uD3B8\uC548\uD55C \uBC24\uC774\uC5D0\uC694, ${name}\uB2D8! \u{1F31F}`;
}

export function getEmotionOptions(): readonly EmotionOption[] {
  return [
    { emoji: "\u{1F60A}", label: "\uC88B\uC544\uC694", value: "good" },
    { emoji: "\u{1F610}", label: "\uBCF4\uD1B5\uC774\uC5D0\uC694", value: "neutral" },
    { emoji: "\u{1F622}", label: "\uC2AC\uD37C\uC694", value: "sad" },
    { emoji: "\u{1F630}", label: "\uBD88\uC548\uD574\uC694", value: "anxious" },
    { emoji: "\u{1F620}", label: "\uD654\uB098\uC694", value: "angry" }
  ] as const;
}

export interface CompanionReplyInput {
  manual: CareManual;
  message: string;
}

export interface CompanionReplyResult {
  reply: string;
  references: string[];
}

export function generateCompanionReply({
  manual,
  message
}: CompanionReplyInput): CompanionReplyResult {
  const normalizedMessage = message.trim();

  if (normalizedMessage.includes("오늘")) {
    const cards = buildDailyScheduleCards(manual);
    const firstRoutine = cards.find((card) => card.kind === "routine");

    return {
      reply: `${manual.subject.name}, 오늘은 ${firstRoutine?.title ?? "돌봄 일정"}부터 시작해요.`,
      references: ["daily_routine"]
    };
  }

  if (normalizedMessage.includes("불안")) {
    const calmingMethod = manual.sections.communication.calming_methods[0] ?? "천천히 숨 쉬기";
    const safeSpace = manual.sections.emotional.safe_spaces[0];
    const safeSpaceText = safeSpace ? ` 그리고 ${safeSpace}에서 쉬어도 좋아요.` : "";

    return {
      reply: `괜찮아요. ${calmingMethod}로 먼저 진정해봐요.${safeSpaceText}`,
      references: ["calming_methods", "safe_spaces"]
    };
  }

  return {
    reply: `${manual.subject.name}\uB2D8, \uC9C0\uAE08\uC740 \uCC9C\uCC9C\uD788 \uD558\uB098\uC529 \uD574\uBD10\uC694. \uC798 \uD558\uACE0 \uC788\uC5B4\uC694. \u{1F60A}`,
    references: ["personal_notes"]
  };
}
