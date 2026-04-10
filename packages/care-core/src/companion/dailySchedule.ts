import type { CareManual, CareRoutineItem, MedicationItem } from "../manual/manualSchema";

export type ScheduleCardKind = "routine" | "medication";

export interface ScheduleCard {
  id: string;
  title: string;
  description: string;
  kind: ScheduleCardKind;
  period: "morning" | "afternoon" | "evening" | "night";
}

function routineCard(period: ScheduleCard["period"], item: CareRoutineItem, index: number): ScheduleCard {
  const periodLabelMap: Record<ScheduleCard["period"], string> = {
    morning: "아침",
    afternoon: "오후",
    evening: "저녁",
    night: "밤"
  };

  return {
    id: `${period}-${index}`,
    title: `${periodLabelMap[period]} · ${item.title}`,
    description: item.notes,
    kind: "routine",
    period
  };
}

function medicationCard(item: MedicationItem, index: number): ScheduleCard {
  return {
    id: `medication-${index}`,
    title: `복약 · ${item.name}`,
    description: `${item.timing} / ${item.method}`,
    kind: "medication",
    period: "morning"
  };
}

export function buildDailyScheduleCards(manual: CareManual): ScheduleCard[] {
  const cards: ScheduleCard[] = [];

  (["morning", "afternoon", "evening", "night"] as const).forEach((period) => {
    manual.sections.daily_routine[period].forEach((item, index) => {
      cards.push(routineCard(period, item, index));
    });
  });

  manual.sections.medication.drugs.forEach((item, index) => {
    cards.push(medicationCard(item, index));
  });

  return cards;
}
