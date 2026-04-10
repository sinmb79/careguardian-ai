import type { CareManual } from "../manual/manualSchema";
import { buildDailyScheduleCards } from "./dailySchedule";

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
    reply: `${manual.subject.name}, 지금은 천천히 하나씩 해봐요.`,
    references: ["personal_notes"]
  };
}
