import { createEmptyCareManual, type CareManual } from "../../manual/manualSchema";

export function makeFixtureManual(): CareManual {
  const manual = createEmptyCareManual();

  manual.subject.name = "수호";
  manual.sections.daily_routine.morning = [
    {
      title: "아침 식사",
      notes: "파란 컵에 물을 먼저 준다."
    }
  ];
  manual.sections.daily_routine.afternoon = [
    {
      title: "산책",
      notes: "목요일 오후 불안해하면 20분 걷기"
    }
  ];
  manual.sections.medication.drugs = [
    {
      name: "빨간 알약",
      dosage: "1정",
      timing: "아침 식사 직후",
      method: "우유와 함께",
      warnings: "공복 금지",
      photo: ""
    }
  ];
  manual.sections.communication.signals = [
    {
      behavior: "같은 소리를 반복함",
      meaning: "배가 고픔",
      response: "간식 또는 식사 준비를 안내"
    }
  ];
  manual.sections.communication.calming_methods = ["조용한 목소리", "좋아하는 담요"];
  manual.sections.emotional.triggers_anxiety = ["목요일 오후", "큰 소리"];
  manual.sections.emotional.safe_spaces = ["거실 소파"];
  manual.sections.personal_notes = "밥을 먹은 뒤에는 이를 닦자고 말하면 잘 움직인다.";

  return manual;
}
