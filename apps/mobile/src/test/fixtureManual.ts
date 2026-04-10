import { createEmptyCareManual, type CareManual } from "@careguardian/care-core/manual";

export function makeMobileFixtureManual(): CareManual {
  const manual = createEmptyCareManual();

  manual.subject.name = "수호";
  manual.sections.daily_routine.morning = [
    {
      title: "아침 식사",
      notes: "파란 컵에 물을 먼저 준다."
    }
  ];
  manual.sections.medication.drugs = [
    {
      name: "빨간 알약",
      dosage: "1정",
      timing: "08:30",
      method: "물과 함께",
      warnings: "",
      photo: ""
    },
    {
      name: "파란 알약",
      dosage: "1정",
      timing: "21:00",
      method: "식후",
      warnings: "",
      photo: ""
    }
  ];
  manual.sections.communication.calming_methods = ["조용한 목소리"];
  manual.sections.emotional.safe_spaces = ["거실 소파"];

  return manual;
}
